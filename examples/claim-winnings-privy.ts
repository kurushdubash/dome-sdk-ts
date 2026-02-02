#!/usr/bin/env npx tsx

/**
 * Privy Server Wallet — Claim Winnings with Performance Fee
 *
 * This example shows how to claim winnings from a resolved Polymarket
 * market using the Dome SDK with a Privy server-managed wallet.
 *
 * Flow:
 * [1] Validate config
 * [2] Setup Privy client + signer
 * [3] Setup escrow client
 * [4] Calculate performance fees (local)
 * [5] Sign performance fee auth (via Privy TypedDataSigner)
 * [6] Submit claim via router.claimWinnings({ walletType: 'privy', privyWalletId, ... })
 * [7] Display results
 *
 * No signed redeemPositions tx needed — Dome builds and submits via Privy API.
 *
 * Prerequisites:
 * 1. Privy credentials (PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_AUTHORIZATION_KEY)
 * 2. Privy wallet (PRIVY_WALLET_ID, PRIVY_WALLET_ADDRESS)
 * 3. Dome API key (DOME_API_KEY)
 * 4. Condition ID (CONDITION_ID) — condition ID of a resolved market
 *
 * Optional:
 * - RPC_URL — Polygon RPC URL (defaults to https://polygon-rpc.com)
 * - OUTCOME_INDEX — Winning outcome index, 0 or 1 (defaults to 1 for "Yes wins")
 *
 * Usage:
 *   PRIVY_APP_ID=... PRIVY_APP_SECRET=... PRIVY_AUTHORIZATION_KEY=... \
 *   PRIVY_WALLET_ID=... PRIVY_WALLET_ADDRESS=0x... \
 *   DOME_API_KEY=... CONDITION_ID=0x... \
 *   npx tsx examples/claim-winnings-privy.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import { PrivyClient } from '@privy-io/server-auth';
import {
  PolymarketRouter,
  DomeFeeEscrowClient,
  parseUsdc,
  formatUsdc,
  ESCROW_CONTRACT_V2_POLYGON,
} from '../src/index.js';
import type { TypedDataSigner } from '../src/escrow/dome-client.js';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  privyAppId: process.env.PRIVY_APP_ID || '',
  privyAppSecret: process.env.PRIVY_APP_SECRET || '',
  privyAuthKey: process.env.PRIVY_AUTHORIZATION_KEY || '',
  privyWalletId: process.env.PRIVY_WALLET_ID || '',
  privyWalletAddress: process.env.PRIVY_WALLET_ADDRESS || '',
  domeApiKey: process.env.DOME_API_KEY || '',
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  conditionId: process.env.CONDITION_ID || '',
  outcomeIndex: parseInt(process.env.OUTCOME_INDEX || '1', 10),
  chainId: 137,
};

// Performance fee configuration
const PERF_FEE = {
  domeFeeBps: 250, // 2.5% dome fee
  affiliateFeeBps: 50, // 0.5% affiliate fee
  expectedWinnings: parseUsdc(100), // $100 expected winnings (example)
  deadlineSeconds: 3600, // 1 hour
};

// =============================================================================
// Privy TypedDataSigner Adapter
// =============================================================================

function createPrivyTypedDataSigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): TypedDataSigner {
  return {
    async getAddress(): Promise<string> {
      return walletAddress;
    },
    async signTypedData(params: {
      domain: any;
      types: any;
      primaryType: string;
      message: any;
    }): Promise<string> {
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId,
        typedData: {
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType,
          message: params.message,
        },
      });
      return signature;
    },
  };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log(
    '=== Privy Server Wallet — Claim Winnings with Performance Fee ===\n'
  );

  // ── [1] Validate configuration ───────────────────────────────────────
  console.log('[1] Validating configuration...');

  if (!CONFIG.privyAppId || !CONFIG.privyAppSecret) {
    console.error('Missing PRIVY_APP_ID or PRIVY_APP_SECRET');
    process.exit(1);
  }

  if (
    !CONFIG.privyWalletId ||
    !CONFIG.privyWalletAddress ||
    !CONFIG.privyAuthKey
  ) {
    console.error('Missing wallet configuration:');
    console.error('  PRIVY_WALLET_ID=your-wallet-id');
    console.error('  PRIVY_WALLET_ADDRESS=0x...');
    console.error('  PRIVY_AUTHORIZATION_KEY=MIGHAgEA...');
    process.exit(1);
  }

  if (!CONFIG.domeApiKey) {
    console.error('Missing DOME_API_KEY');
    process.exit(1);
  }

  if (!CONFIG.conditionId) {
    console.error('Missing CONDITION_ID environment variable');
    process.exit(1);
  }

  console.log(`  Wallet:         ${CONFIG.privyWalletAddress}`);
  console.log(`  Condition ID:   ${CONFIG.conditionId}`);
  console.log(`  Outcome Index:  ${CONFIG.outcomeIndex}`);

  // ── [2] Setup Privy client + TypedDataSigner adapter ─────────────────
  console.log('\n[2] Setting up Privy client and signer...');

  const privy = new PrivyClient(CONFIG.privyAppId, CONFIG.privyAppSecret, {
    walletApi: {
      authorizationPrivateKey: CONFIG.privyAuthKey,
    },
  });

  const privySigner = createPrivyTypedDataSigner(
    privy,
    CONFIG.privyWalletId,
    CONFIG.privyWalletAddress
  );

  console.log('  Privy client initialized');

  // ── [3] Setup escrow client (no ethers signer — uses WithSigner) ────
  console.log('\n[3] Setting up escrow client...');

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);

  const escrowClient = new DomeFeeEscrowClient({
    provider,
    contractAddress: ESCROW_CONTRACT_V2_POLYGON,
    chainId: CONFIG.chainId,
  });

  console.log(`  Escrow contract: ${ESCROW_CONTRACT_V2_POLYGON}`);

  // ── [4] Calculate performance fees ───────────────────────────────────
  console.log('\n[4] Calculating performance fees (local)...');

  const fees = escrowClient.calculatePerformanceFeesLocal(
    PERF_FEE.expectedWinnings,
    PERF_FEE.domeFeeBps,
    PERF_FEE.affiliateFeeBps
  );

  console.log(`  Expected winnings: $${formatUsdc(PERF_FEE.expectedWinnings)}`);
  console.log(
    `  Dome fee:          $${formatUsdc(fees.domeFee)} (${PERF_FEE.domeFeeBps / 100}%)`
  );
  console.log(
    `  Affiliate fee:     $${formatUsdc(fees.affiliateFee)} (${PERF_FEE.affiliateFeeBps / 100}%)`
  );
  console.log(`  Total fee:         $${formatUsdc(fees.totalFee)}`);

  // ── [5] Sign performance fee authorization (via Privy) ───────────────
  console.log(
    '\n[5] Signing performance fee authorization (via Privy wallet)...'
  );

  const positionId = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(ethers.utils.randomBytes(32)),
    32
  );

  const { auth, signature } =
    await escrowClient.signPerformanceFeeAuthWithSigner(privySigner, {
      positionId,
      expectedWinnings: PERF_FEE.expectedWinnings,
      domeAmount: fees.domeFee,
      affiliateAmount: fees.affiliateFee,
      deadline: PERF_FEE.deadlineSeconds,
    });

  console.log(`  Position ID: ${positionId.substring(0, 18)}...`);
  console.log(`  Deadline:    ${new Date(auth.deadline * 1000).toISOString()}`);
  console.log(`  Signature:   ${signature.substring(0, 18)}...`);

  // ── [6] Submit claim via PolymarketRouter ────────────────────────────
  console.log('\n[6] Submitting claim winnings via Dome API...');

  const router = new PolymarketRouter({
    apiKey: CONFIG.domeApiKey,
    chainId: CONFIG.chainId,
  });

  try {
    const result = await router.claimWinnings({
      positionId,
      walletType: 'privy',
      payerAddress: CONFIG.privyWalletAddress,
      signerAddress: CONFIG.privyWalletAddress,
      privyWalletId: CONFIG.privyWalletId,
      conditionId: CONFIG.conditionId,
      outcomeIndex: CONFIG.outcomeIndex,
      performanceFeeAuth: {
        positionId: auth.positionId,
        payer: auth.payer,
        expectedWinnings: auth.expectedWinnings.toString(),
        domeAmount: auth.domeAmount.toString(),
        affiliateAmount: auth.affiliateAmount.toString(),
        chainId: auth.chainId,
        deadline: auth.deadline,
        signature,
      },
    });

    // ── [7] Display results ────────────────────────────────────────────
    console.log('\n[7] Claim winnings result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`\nClaim failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
