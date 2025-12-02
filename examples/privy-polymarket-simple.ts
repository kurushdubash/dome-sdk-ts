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

  // Initialize Polymarket router
  const router = new PolymarketRouter({
    chainId: 137, // Polygon mainnet
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
  console.log('\nPlacing order on Polymarket...');
  try {
    const order = await router.placeOrder(
      {
        userId: user.id,
        marketId:
          '60487116984468020978247225474488676749601001829886755968952521846780452448915', // "Fed rate hike in 2025?" market
        side: 'buy',
        size: 5,
        price: 0.99,
        signer,
      },
      credentials
    );

    console.log('✅ Order placed successfully!');
    console.log('Order:', order);
  } catch (error: any) {
    if (error.message?.includes('not enough balance')) {
      console.log('⚠️  Wallet needs USDC.e funding on Polygon');
      console.log(`   Wallet address: ${user.walletAddress}`);
      console.log(
        '   Token: USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)'
      );
    } else {
      console.error('❌ Error placing order:', error.message);
    }
  }
}

main();
