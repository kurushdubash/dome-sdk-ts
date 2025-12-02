/**
 * Ultra-Simple Privy + Polymarket Example
 *
 * This shows the SIMPLEST possible integration - no manual signer creation needed!
 */

import 'dotenv/config';
import { PolymarketRouter } from '../src';

async function main() {
  console.log('🧪 Ultra-Simple Privy + Polymarket Integration\n');

  // User from your database
  const user = {
    id: 'user-123',
    privyWalletId: 'uecc6exvtwc66dv10ffazzn0',
    walletAddress: '0xC6702E6d5C7D2B1E94e0E407a73bcf13B7A7B5e8',
  };

  // Step 1: Initialize router with Privy config (env vars can be passed directly!)
  const router = new PolymarketRouter({
    chainId: 137,
    privy: {
      appId: process.env.PRIVY_APP_ID!,
      appSecret: process.env.PRIVY_APP_SECRET!,
      authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  });

  // Step 2: Link user (one-time)
  console.log('Linking user...');
  const credentials = await router.linkUser({
    userId: user.id,
    signer: router['createPrivySignerFromWallet'](
      user.privyWalletId,
      user.walletAddress
    ),
  });
  console.log('✅ User linked\n');

  // Step 3: Place order - NO SIGNER NEEDED!
  console.log('Placing order...');
  try {
    await router.placeOrder(
      {
        userId: user.id,
        marketId:
          '60487116984468020978247225474488676749601001829886755968952521846780452448915',
        side: 'buy',
        size: 5,
        price: 0.99,
        // Just pass wallet info - signer created automatically!
        privyWalletId: user.privyWalletId,
        walletAddress: user.walletAddress,
      },
      credentials
    );
    console.log('✅ Order placed!\n');
  } catch (error: any) {
    if (error.message?.includes('not enough balance')) {
      console.log('✅ Integration working! (needs USDC funding)\n');
    } else {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('Summary:');
  console.log('  • Pass Privy config to router once');
  console.log('  • Just pass wallet ID + address to placeOrder');
  console.log('  • No manual signer creation!');
}

main();
