/**
 * Simple Privy + Polymarket Example
 *
 * This example shows how to use Dome SDK with Privy-managed wallets
 * to place orders on Polymarket with just a few lines of code.
 *
 * Prerequisites:
 * 1. Set up Privy account and get credentials
 * 2. Set environment variables (see .env.example)
 * 3. Create a wallet with Privy (or use existing user wallet)
 * 4. Fund wallet with USDC.e on Polygon
 * 5. Get a Dome API key (set DOME_API_KEY env var)
 */

import 'dotenv/config';
import {
  PolymarketRouter,
  createPrivySignerFromEnv,
  PolymarketCredentials,
} from '../src';

interface User {
  id: string;
  privyWalletId: string;
  walletAddress: string;
  polymarketCredentials?: PolymarketCredentials;
}

async function main() {
  // Your user data (from your database)
  const user: User = {
    id: 'user-123',
    privyWalletId: 'uecc6exvtwc66dv10ffazzn0',
    walletAddress: '0xC6702E6d5C7D2B1E94e0E407a73bcf13B7A7B5e8',
    // polymarketCredentials would be stored in your DB after first linkUser call
  };

  // Initialize Polymarket router with Dome API key
  // Orders are placed via Dome server for geo-unrestricted access and observability
  const router = new PolymarketRouter({
    chainId: 137, // Polygon mainnet
    apiKey: process.env.DOME_API_KEY || 'dome_test', // Required for placeOrder
  });

  // Step 1: Create a signer from Privy (ONE LINE!)
  const signer = createPrivySignerFromEnv(
    user.privyWalletId,
    user.walletAddress
  );

  // Step 2: Link user to Polymarket (ONE-TIME SETUP)
  // This creates API credentials that you should store in your database
  let credentials = user.polymarketCredentials;
  if (!credentials) {
    console.log('Linking user to Polymarket...');
    credentials = await router.linkUser({
      userId: user.id,
      signer,
    });

    console.log('✅ Credentials created! Store these in your database:');
    console.log(`  API Key: ${credentials.apiKey}`);
    console.log(`  API Secret: ${credentials.apiSecret.substring(0, 20)}...`);
    console.log(
      `  Passphrase: ${credentials.apiPassphrase.substring(0, 20)}...`
    );

    // TODO: Save credentials to your database
    // await db.users.update(user.id, { polymarketCredentials: credentials });
  }

  // Step 3: Place a GTC order (Good Till Cancelled - stays on book)
  // Orders are signed locally then submitted via Dome server
  console.log('\n--- GTC Order (Good Till Cancelled) ---');
  console.log('Placing GTC order on Polymarket...');
  try {
    const gtcOrder = await router.placeOrder(
      {
        userId: user.id,
        // Example: "US recession in 2025?" - Yes token
        // Find active markets at https://polymarket.com or via CLOB API
        marketId:
          '104173557214744537570424345347209544585775842950109756851652855913015295701992',
        side: 'buy',
        size: 100, // Number of shares (min $1 order value)
        price: 0.01, // Price per share (0-1)
        orderType: 'GTC', // Good Till Cancelled (default)
        signer,
      },
      credentials
    );

    console.log('✅ GTC Order placed successfully!');
    console.log('Order:', JSON.stringify(gtcOrder, null, 2));
  } catch (error: any) {
    handleOrderError(error, user.walletAddress);
  }

  // Step 4: Place a FOK order (Fill Or Kill - must fill immediately or cancel)
  // Useful for copy trading where you need instant confirmation
  // Note: FOK/FAK orders require minimum $1 order value AND liquidity at the price
  console.log('\n--- FOK Order (Fill Or Kill) ---');
  console.log('Placing FOK order on Polymarket...');
  try {
    const fokOrder = await router.placeOrder(
      {
        userId: user.id,
        marketId:
          '104173557214744537570424345347209544585775842950109756851652855913015295701992',
        side: 'buy',
        size: 100, // 100 shares at $0.01 = $1 minimum
        price: 0.01,
        orderType: 'FOK', // Fill Or Kill - must fill completely immediately or cancel
        signer,
      },
      credentials
    );

    console.log('✅ FOK Order placed successfully!');
    console.log('Order:', JSON.stringify(fokOrder, null, 2));

    // FOK orders give instant confirmation
    if (fokOrder.status === 'matched') {
      console.log('📊 FOK order was FILLED immediately');
    } else {
      console.log('📊 FOK order status:', fokOrder.status);
    }
  } catch (error: any) {
    handleOrderError(error, user.walletAddress);
  }
}

function handleOrderError(error: any, walletAddress: string) {
  const msg = error.message || '';
  if (
    msg.includes('not enough balance') ||
    msg.includes('balance / allowance')
  ) {
    console.log('⚠️  Wallet needs USDC.e funding on Polygon');
    console.log(`   Wallet address: ${walletAddress}`);
    console.log(
      '   Token: USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)'
    );
    console.log(
      `   Check balance: https://polygonscan.com/address/${walletAddress}`
    );
  } else if (msg.includes('Dome API key')) {
    console.log('⚠️  Missing Dome API key');
    console.log('   Set DOME_API_KEY environment variable');
  } else if (msg.includes('min size')) {
    console.log('❌ Order size too small');
    console.log('   Minimum order value is $1');
    console.log('   Increase size or price to meet minimum');
  } else if (msg.includes('400')) {
    console.log('❌ Order rejected (HTTP 400)');
    console.log(`   Error: ${msg}`);
    console.log(`   Wallet address: ${walletAddress}`);
  } else {
    console.error('❌ Error placing order:', msg);
  }
}

main();
