#!/usr/bin/env npx tsx

/**
 * EOA Wallet + Polymarket with Fee Escrow
 *
 * This example shows how to use Dome SDK with a standard EOA wallet
 * (private key) and automatic fee escrow for order placement.
 *
 * Prerequisites:
 * 1. Private key (PRIVATE_KEY) - can be exported from Polymarket
 * 2. Dome API key (DOME_API_KEY)
 * 3. Wallet funded with USDC.e on Polygon
 * 4. USDC approved for escrow contract (run approve-escrow.ts first)
 *
 * Usage:
 *   PRIVATE_KEY=0x... DOME_API_KEY=... npx tsx examples/eoa-with-escrow.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  PolymarketRouterWithEscrow,
  RouterSigner,
  PolymarketCredentials,
} from '../src/index.js';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY || '',
  domeApiKey: process.env.DOME_API_KEY || '',
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: 137,
};

// Example market for testing
const TEST_MARKET = {
  tokenId:
    '104173557214744537570424345347209544585775842950109756851652855913015295701992',
  size: 100,
  price: 0.01,
};

// =============================================================================
// EOA Signer
// =============================================================================

function createEoaSigner(wallet: ethers.Wallet): RouterSigner {
  return {
    async getAddress(): Promise<string> {
      return wallet.address;
    },
    async signTypedData(params: {
      domain: any;
      types: any;
      primaryType: string;
      message: any;
    }): Promise<string> {
      // Remove EIP712Domain from types if present (ethers handles it)
      const { EIP712Domain, ...types } = params.types;
      return wallet._signTypedData(params.domain, types, params.message);
    },
    async signMessage(message: string): Promise<string> {
      return wallet.signMessage(message);
    },
  };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('=== EOA Wallet + Polymarket with Fee Escrow ===\n');

  // Validate configuration
  if (!CONFIG.privateKey) {
    console.error('Missing PRIVATE_KEY environment variable');
    console.error('Export from Polymarket: Settings > Export Private Key');
    process.exit(1);
  }

  if (!CONFIG.domeApiKey) {
    console.error('Missing DOME_API_KEY environment variable');
    process.exit(1);
  }

  // Create wallet from private key
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(CONFIG.privateKey, provider);

  console.log(`Wallet: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`POL Balance: ${ethers.utils.formatEther(balance)}`);

  // Create signer
  const signer = createEoaSigner(wallet);

  // Initialize router with escrow
  const router = new PolymarketRouterWithEscrow({
    chainId: CONFIG.chainId,
    apiKey: CONFIG.domeApiKey,
    escrow: {
      feeBps: 25, // 0.25% fee
    },
  });

  console.log('Router initialized with fee escrow (0.25%)\n');

  // Link user to Polymarket
  console.log('Linking user to Polymarket...');
  const userId = `eoa-escrow-${wallet.address}`;

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
    if (
      error.message.includes('balance') ||
      error.message.includes('allowance')
    ) {
      console.error('Insufficient balance or allowance.');
      console.error('Make sure USDC is approved for the escrow contract.');
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
