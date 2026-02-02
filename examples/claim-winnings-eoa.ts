#!/usr/bin/env npx tsx

/**
 * EOA Wallet — Claim Winnings with Performance Fee
 *
 * This example shows how to claim winnings from a resolved Polymarket
 * market using the Dome SDK with a standard EOA wallet (private key).
 *
 * Flow:
 * [1] Validate config
 * [2] Setup wallet + escrow client
 * [3] Calculate performance fees (local)
 * [4] Sign performance fee authorization (EIP-712)
 * [5] Build and sign redeemPositions transaction (offline)
 * [6] Submit claim via router.claimWinnings({ walletType: 'eoa', signedRedeemTx, ... })
 * [7] Display results
 *
 * Prerequisites:
 * 1. Private key (PRIVATE_KEY) — EOA private key
 * 2. Dome API key (DOME_API_KEY)
 * 3. Condition ID (CONDITION_ID) — condition ID of a resolved market
 *
 * Optional:
 * - RPC_URL — Polygon RPC URL (defaults to https://polygon-rpc.com)
 * - OUTCOME_INDEX — Winning outcome index, 0 or 1 (defaults to 1 for "Yes wins")
 *
 * Usage:
 *   PRIVATE_KEY=0x... DOME_API_KEY=... CONDITION_ID=0x... \
 *   npx tsx examples/claim-winnings-eoa.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  PolymarketRouter,
  DomeFeeEscrowClient,
  parseUsdc,
  formatUsdc,
  ESCROW_CONTRACT_V2_POLYGON,
  signRedeemPositionsTx,
} from '../src/index.js';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY || '',
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
// Main
// =============================================================================

async function main() {
  console.log('=== EOA Wallet — Claim Winnings with Performance Fee ===\n');

  // ── [1] Validate configuration ───────────────────────────────────────
  console.log('[1] Validating configuration...');

  if (!CONFIG.privateKey) {
    console.error('Missing PRIVATE_KEY environment variable');
    process.exit(1);
  }

  if (!CONFIG.domeApiKey) {
    console.error('Missing DOME_API_KEY environment variable');
    process.exit(1);
  }

  if (!CONFIG.conditionId) {
    console.error('Missing CONDITION_ID environment variable');
    process.exit(1);
  }

  console.log(`  Condition ID:   ${CONFIG.conditionId}`);
  console.log(`  Outcome Index:  ${CONFIG.outcomeIndex}`);

  // ── [2] Setup wallet + escrow client ─────────────────────────────────
  console.log('\n[2] Setting up wallet and escrow client...');

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

  console.log(`  Wallet: ${wallet.address}`);

  const escrowClient = new DomeFeeEscrowClient({
    provider,
    signer: wallet,
    contractAddress: ESCROW_CONTRACT_V2_POLYGON,
    chainId: CONFIG.chainId,
  });

  // ── [3] Calculate performance fees ───────────────────────────────────
  console.log('\n[3] Calculating performance fees (local)...');

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

  // ── [4] Sign performance fee authorization ───────────────────────────
  console.log('\n[4] Signing performance fee authorization (EIP-712)...');

  // Generate a position ID for the fee auth
  const positionId = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(ethers.utils.randomBytes(32)),
    32
  );

  const { auth, signature } = await escrowClient.signPerformanceFeeAuth({
    positionId,
    expectedWinnings: PERF_FEE.expectedWinnings,
    domeAmount: fees.domeFee,
    affiliateAmount: fees.affiliateFee,
    deadline: PERF_FEE.deadlineSeconds,
  });

  console.log(`  Position ID: ${positionId.substring(0, 18)}...`);
  console.log(`  Deadline:    ${new Date(auth.deadline * 1000).toISOString()}`);
  console.log(`  Signature:   ${signature.substring(0, 18)}...`);

  // ── [5] Build and sign redeemPositions transaction ───────────────────
  console.log(
    '\n[5] Building and signing redeemPositions transaction (offline)...'
  );

  const signedRedeemTx = await signRedeemPositionsTx(wallet, {
    conditionId: CONFIG.conditionId,
    outcomeIndex: CONFIG.outcomeIndex,
    chainId: CONFIG.chainId,
  });

  console.log(`  Signed TX: ${signedRedeemTx.substring(0, 18)}...`);

  // ── [6] Submit claim via PolymarketRouter ────────────────────────────
  console.log('\n[6] Submitting claim winnings via Dome API...');

  const router = new PolymarketRouter({
    apiKey: CONFIG.domeApiKey,
    chainId: CONFIG.chainId,
  });

  try {
    const result = await router.claimWinnings({
      positionId,
      walletType: 'eoa',
      payerAddress: wallet.address,
      signerAddress: wallet.address,
      signedRedeemTx,
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
