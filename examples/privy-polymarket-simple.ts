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
    apiKey: process.env.DOME_API_KEY, // Required for placeOrder
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

  // Step 3: Place an order (NO WALLET SIGNATURE POPUP!)
  // Orders are signed locally then submitted via Dome server
  console.log('\nPlacing order on Polymarket...');
  try {
    const order = await router.placeOrder(
      {
        userId: user.id,
        // Example: "US recession in 2025?" - Yes token
        // Find active markets at https://polymarket.com or via CLOB API
        marketId:
          '104173557214744537570424345347209544585775842950109756851652855913015295701992',
        side: 'buy',
        size: 100, // Number of shares (min $1 order value)
        price: 0.01, // Price per share (0-1)
        signer,
      },
      credentials
    );

    console.log('✅ Order placed successfully!');
    console.log('Order:', JSON.stringify(order, null, 2));
  } catch (error: any) {
    if (error.message?.includes('not enough balance')) {
      console.log('⚠️  Wallet needs USDC.e funding on Polygon');
      console.log(`   Wallet address: ${user.walletAddress}`);
      console.log(
        '   Token: USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)'
      );
    } else if (error.message?.includes('Dome API key')) {
      console.log('⚠️  Missing Dome API key');
      console.log('   Set DOME_API_KEY environment variable');
    } else {
      console.error('❌ Error placing order:', error.message);
    }
  }
}

main();
