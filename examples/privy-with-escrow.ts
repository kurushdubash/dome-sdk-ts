#!/usr/bin/env npx tsx

/**
 * Privy + Polymarket with Fee Escrow
 *
 * This example shows how to use Dome SDK with Privy-managed wallets
 * and automatic fee escrow for order placement.
 *
 * Prerequisites:
 * 1. Privy credentials (PRIVY_APP_ID, PRIVY_APP_SECRET)
 * 2. Privy wallet (PRIVY_WALLET_ID, PRIVY_WALLET_ADDRESS, PRIVY_AUTHORIZATION_KEY)
 * 3. Dome API key (DOME_API_KEY)
 * 4. Wallet funded with USDC.e on Polygon
 *
 * Usage:
 *   npx tsx examples/privy-with-escrow.ts
 */

import 'dotenv/config';
import { PrivyClient } from '@privy-io/server-auth';
import {
  PolymarketRouterWithEscrow,
  RouterSigner,
  PolymarketCredentials,
  approveEscrow,
} from '../src/index.js';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  privyAppId: process.env.PRIVY_APP_ID || '',
  privyAppSecret: process.env.PRIVY_APP_SECRET || '',
  privyWalletId: process.env.PRIVY_WALLET_ID || '',
  privyWalletAddress: process.env.PRIVY_WALLET_ADDRESS || '',
  privyAuthKey: process.env.PRIVY_AUTHORIZATION_KEY || '',
  domeApiKey: process.env.DOME_API_KEY || '',
  chainId: 137,
};

// Example market for testing
// Note: Order must generate at least $0.01 fee (min fee)
// Fee = size * price * 0.25%, so need size * price >= $4
const TEST_MARKET = {
  tokenId:
    '104173557214744537570424345347209544585775842950109756851652855913015295701992',
  size: 100,
  price: 0.05, // $5 order = $0.0125 fee (above $0.01 min)
};

// =============================================================================
// Privy Signer
// =============================================================================

function createPrivySigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): RouterSigner {
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
    async signMessage(message: string): Promise<string> {
      const { signature } = await privy.walletApi.ethereum.signMessage({
        walletId,
        message,
      });
      return signature;
    },
  };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('=== Privy + Polymarket with Fee Escrow ===\n');

  // Validate configuration
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

  console.log(`Wallet: ${CONFIG.privyWalletAddress}`);

  // Initialize Privy client with authorization key
  const privy = new PrivyClient(CONFIG.privyAppId, CONFIG.privyAppSecret, {
    walletApi: {
      authorizationPrivateKey: CONFIG.privyAuthKey,
    },
  });

  // Create signer
  const signer = createPrivySigner(
    privy,
    CONFIG.privyWalletId,
    CONFIG.privyWalletAddress
  );

  // Initialize router with escrow
  const router = new PolymarketRouterWithEscrow({
    chainId: CONFIG.chainId,
    apiKey: CONFIG.domeApiKey,
    escrow: {
      feeBps: 25, // 0.25% fee
    },
  });

  console.log('Router initialized with fee escrow (0.25%)\n');

  // Approve USDC for escrow and Polymarket contracts
  console.log('Checking/approving USDC allowances...');
  try {
    const approvalResult = await approveEscrow({
      privyClient: privy,
      walletId: CONFIG.privyWalletId,
      walletAddress: CONFIG.privyWalletAddress,
    });

    if (approvalResult.approved.length > 0) {
      console.log(`  Approved: ${approvalResult.approved.join(', ')}`);
      for (const [name, hash] of Object.entries(approvalResult.txHashes)) {
        console.log(`    ${name}: ${hash}`);
      }
    }
    if (approvalResult.alreadyApproved.length > 0) {
      console.log(
        `  Already approved: ${approvalResult.alreadyApproved.join(', ')}`
      );
    }
    console.log('');
  } catch (error: any) {
    console.error(`Failed to approve contracts: ${error.message}`);
    process.exit(1);
  }

  // Link user to Polymarket
  console.log('Linking user to Polymarket...');
  const userId = `privy-escrow-${CONFIG.privyWalletId}`;

  let credentials: PolymarketCredentials;
  try {
    credentials = await router.linkUser({
      userId,
      signer,
    });
    console.log(`API Key: ${credentials.apiKey}`);
    console.log('Credentials created - store these in your database!\n');
  } catch (error: any) {
    console.error(`Failed to link user: ${error.message}`);
    process.exit(1);
  }

  // Place order with fee escrow
  console.log('Placing order with fee escrow...');
  console.log(`  Market: ${TEST_MARKET.tokenId.substring(0, 20)}...`);
  console.log(`  Size: ${TEST_MARKET.size} shares`);
  console.log(`  Price: $${TEST_MARKET.price}`);

  const fee = router.calculateOrderFee(TEST_MARKET.size, TEST_MARKET.price);
  console.log(`  Fee: $${Number(fee) / 1e6}\n`);

  try {
    const result = await router.placeOrder(
      {
        userId,
        marketId: TEST_MARKET.tokenId,
        side: 'buy',
        size: TEST_MARKET.size,
        price: TEST_MARKET.price,
        orderType: 'GTC',
        signer,
      },
      credentials
    );

    console.log('Order placed successfully!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    if (error.message.includes('balance')) {
      console.error('Insufficient USDC balance.');
    } else {
      console.error(`Order failed: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
