#!/usr/bin/env npx tsx

/**
 * Cancel Order Test
 *
 * This example demonstrates canceling an order using the SDK.
 * It first places a resting order, then cancels it.
 *
 * Usage:
 *   PRIVATE_KEY=0x... DOME_API_KEY=... npx tsx examples/cancel-order-test.ts
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  PolymarketRouterWithEscrow,
  RouterSigner,
  PolymarketCredentials,
} from '../src/index.js';

const CONFIG = {
  privateKey: process.env.PRIVATE_KEY || '',
  domeApiKey: process.env.DOME_API_KEY || '',
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: 137,
};

// Test market: Trump Greenland (active market with liquidity)
const TEST_MARKET = {
  title: 'Will Trump acquire Greenland before 2027?',
  tokenId:
    '5161623255678193352839985156330393796378434470119114669671615782853260939535',
  size: 10,
  price: 0.03, // Very low price = resting order that won't fill
};

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
      const { EIP712Domain, ...types } = params.types;
      return wallet._signTypedData(params.domain, types, params.message);
    },
    async signMessage(message: string): Promise<string> {
      return wallet.signMessage(message);
    },
  };
}

async function main() {
  console.log('=== Cancel Order Test (SDK Abstraction) ===\n');

  if (!CONFIG.privateKey) {
    console.error('Missing PRIVATE_KEY environment variable');
    process.exit(1);
  }

  if (!CONFIG.domeApiKey) {
    console.error('Missing DOME_API_KEY environment variable');
    process.exit(1);
  }

  // Setup wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
  const signer = createEoaSigner(wallet);

  console.log(`Wallet: ${wallet.address}`);

  // Initialize router with escrow
  const router = new PolymarketRouterWithEscrow({
    chainId: CONFIG.chainId,
    apiKey: CONFIG.domeApiKey,
    escrow: {
      feeBps: 25,
    },
  });

  console.log('Router initialized with fee escrow (0.25%)\n');

  // Link user
  console.log('Linking user to Polymarket...');
  const userId = `cancel-test-${wallet.address}`;

  let credentials: PolymarketCredentials;
  try {
    credentials = await router.linkUser({
      userId,
      signer,
    });
    console.log(`API Key: ${credentials.apiKey.slice(0, 20)}...`);
  } catch (error: any) {
    console.error(`Failed to link user: ${error.message}`);
    process.exit(1);
  }

  // Step 1: Place a resting order
  console.log('\n[Step 1] Placing resting order...');
  console.log(`  Market: ${TEST_MARKET.title}`);
  console.log(`  Size: ${TEST_MARKET.size} shares @ $${TEST_MARKET.price}`);

  let orderId: string;
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

    orderId = result.orderId;
    console.log(`  Order placed successfully!`);
    console.log(`  Order ID: ${orderId}`);
    console.log(`  Status: ${result.status}`);
  } catch (error: any) {
    console.error(`Order placement failed: ${error.message}`);
    process.exit(1);
  }

  // Step 2: Wait a moment for order to be on the books
  console.log('\n[Step 2] Waiting 2 seconds for order to settle...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Cancel the order
  console.log('\n[Step 3] Canceling order...');
  try {
    const cancelResult = await router.cancelOrder({
      orderId,
      signerAddress: wallet.address,
      credentials,
    });

    console.log('  Order canceled successfully!');
    console.log(`  Success: ${cancelResult.success}`);
    if (cancelResult.escrow) {
      console.log(`  Refund triggered: ${cancelResult.escrow.refundTriggered}`);
      if (cancelResult.escrow.refundTxHash) {
        console.log(`  Refund TX: ${cancelResult.escrow.refundTxHash}`);
      }
    }
  } catch (error: any) {
    console.error(`Cancel failed: ${error.message}`);
    process.exit(1);
  }

  console.log('\n=== Test Complete ===');
  console.log(
    'Successfully placed and canceled a resting order using SDK abstractions.'
  );
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
