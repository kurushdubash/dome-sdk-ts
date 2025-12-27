/**
 * Polymarket Wallet Export Example
 *
 * This example shows the SIMPLEST way to trade on Polymarket using Dome SDK.
 * Perfect for users who already have a Polymarket account and want to trade programmatically.
 *
 * How it works:
 * 1. Sign up on Polymarket (creates a proxy wallet for you)
 * 2. Fund your Polymarket wallet with USDC (via deposit or crypto transfer)
 * 3. Export your private key from Polymarket settings
 * 4. Use this SDK to place orders!
 *
 * Prerequisites:
 * 1. Polymarket account with funded wallet
 * 2. Export your private key from: Polymarket Settings > Export Private Key
 * 3. Set environment variables:
 *    - PRIVATE_KEY: Your exported Polymarket private key
 *    - DOME_API_KEY: Your Dome API key (get from domeapi.io)
 */

import 'dotenv/config';
import { PolymarketRouter, createEoaSignerFromEnv } from '../src';

async function main() {
  console.log('=== Polymarket Wallet Export Example ===\n');

  // Step 1: Create signer from your exported private key
  // This is the key you exported from Polymarket settings
  console.log('Creating signer from PRIVATE_KEY...');
  const signer = createEoaSignerFromEnv();

  // Get your wallet address
  const walletAddress = await signer.getAddress();
  console.log(`Wallet address: ${walletAddress}`);

  // Step 2: Initialize Polymarket router
  const router = new PolymarketRouter({
    chainId: 137, // Polygon mainnet
    apiKey: process.env.DOME_API_KEY,
  });

  // Step 3: Check your wallet's token allowances
  // Polymarket wallets should already have these set, but let's verify
  console.log('\nChecking token allowances...');
  const allowances = await router.checkAllowances(walletAddress);

  if (allowances.allSet) {
    console.log('All allowances are set! Ready to trade.');
  } else {
    console.log('Missing some allowances:');
    console.log('  USDC -> CTF Exchange:', allowances.usdc.ctfExchange);
    console.log(
      '  USDC -> Neg Risk CTF Exchange:',
      allowances.usdc.negRiskCtfExchange
    );
    console.log('  USDC -> Neg Risk Adapter:', allowances.usdc.negRiskAdapter);
    console.log('  CTF -> CTF Exchange:', allowances.ctf.ctfExchange);
    console.log(
      '  CTF -> Neg Risk CTF Exchange:',
      allowances.ctf.negRiskCtfExchange
    );
    console.log('  CTF -> Neg Risk Adapter:', allowances.ctf.negRiskAdapter);

    // If allowances aren't set (shouldn't happen for Polymarket wallets),
    // you'd need to set them. But this is rare.
    console.log('\nNote: Polymarket wallets should have allowances pre-set.');
    console.log(
      'If missing, you may need to set them via the Polymarket web interface first.'
    );
  }

  // Step 4: Link user to Polymarket (creates API credentials)
  // This is a ONE-TIME operation per wallet
  console.log('\nLinking wallet to Polymarket (deriving API credentials)...');

  const credentials = await router.linkUser({
    userId: walletAddress, // Using wallet address as user ID for simplicity
    signer,
    autoSetAllowances: false, // Polymarket wallets already have allowances
  });

  console.log('API credentials created!');
  console.log(`  API Key: ${credentials.apiKey}`);
  console.log(`  API Secret: ${credentials.apiSecret.substring(0, 20)}...`);

  // In production, you'd save these credentials to your database
  // so you don't need to derive them again

  // Step 5: Place an order!
  console.log('\n--- Placing Order ---');
  console.log('Market: "Will BTC hit $150K in 2026?" (Yes side)');

  try {
    const order = await router.placeOrder(
      {
        userId: walletAddress,
        // Example market - "Will BTC hit $150K in 2026?" Yes token
        // Find markets at https://polymarket.com or via CLOB API
        marketId:
          '104173557214744537570424345347209544585775842950109756851652855913015295701992',
        side: 'buy',
        size: 100, // Number of shares
        price: 0.01, // Price per share (0.01 = 1 cent)
        orderType: 'GTC', // Good Till Cancelled
        signer,
      },
      credentials
    );

    console.log('\nOrder placed successfully!');
    console.log('Order details:', JSON.stringify(order, null, 2));
  } catch (error: any) {
    handleOrderError(error, walletAddress);
  }

  // Step 6: Example of a FOK order (Fill Or Kill)
  // Useful for copy trading - instant confirmation of fill status
  console.log('\n--- FOK Order Example ---');
  console.log('FOK orders must fill completely immediately or cancel entirely');

  try {
    const fokOrder = await router.placeOrder(
      {
        userId: walletAddress,
        marketId:
          '104173557214744537570424345347209544585775842950109756851652855913015295701992',
        side: 'buy',
        size: 100,
        price: 0.01,
        orderType: 'FOK', // Fill Or Kill
        signer,
      },
      credentials
    );

    console.log('\nFOK Order result:');
    if (fokOrder.status === 'matched') {
      console.log('Order FILLED immediately!');
    } else {
      console.log('Order status:', fokOrder.status);
    }
    console.log('Details:', JSON.stringify(fokOrder, null, 2));
  } catch (error: any) {
    handleOrderError(error, walletAddress);
  }
}

function handleOrderError(error: any, walletAddress: string) {
  const msg = error.message || '';

  if (
    msg.includes('not enough balance') ||
    msg.includes('balance / allowance')
  ) {
    console.log('\n*** Insufficient Balance ***');
    console.log(`Wallet: ${walletAddress}`);
    console.log('Your Polymarket wallet needs more USDC.');
    console.log('Deposit funds at: https://polymarket.com (Transfer Crypto)');
    console.log(
      `Check balance: https://polygonscan.com/address/${walletAddress}`
    );
  } else if (msg.includes('Dome API key')) {
    console.log('\n*** Missing Dome API Key ***');
    console.log('Set DOME_API_KEY environment variable');
    console.log('Get your API key at: https://domeapi.io');
  } else if (msg.includes('PRIVATE_KEY')) {
    console.log('\n*** Missing Private Key ***');
    console.log('Set PRIVATE_KEY environment variable');
    console.log('Export from: Polymarket Settings > Export Private Key');
  } else if (msg.includes('min size')) {
    console.log('\n*** Order Size Too Small ***');
    console.log('Minimum order value is $1');
    console.log('Increase size * price to meet minimum');
  } else {
    console.error('\n*** Order Error ***');
    console.error(msg);
  }
}

main().catch(console.error);
