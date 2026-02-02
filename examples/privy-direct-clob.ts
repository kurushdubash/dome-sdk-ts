/**
 * Privy + Direct Polymarket CLOB Integration
 *
 * This example shows how to use Privy with the Dome SDK to trade on Polymarket
 * using direct CLOB integration (no Dome backend required).
 *
 * Key benefits:
 * - Users sign ONCE to create Polymarket API key
 * - All subsequent trading uses API keys (no wallet signatures)
 * - Works with Privy server-side signing
 * - No backend infrastructure needed to get started
 *
 * Prerequisites:
 * - Privy account (https://dashboard.privy.io)
 * - Privy authorization key for server-side signing
 */

import { PrivyClient } from '@privy-io/server-auth';
import {
  PolymarketRouter,
  PolymarketCredentials,
  createPrivySigner,
} from '@dome-api/sdk';

// Note: createPrivySigner() is imported from @dome-api/sdk — no manual signer needed.

// ============================================================================
// Step 1: Link User to Polymarket (ONE-TIME SETUP)
// ============================================================================

/**
 * Links a Privy user to Polymarket by creating CLOB API credentials
 *
 * This only needs to happen once per user. The credentials should be
 * stored securely in your database for future use.
 */
async function linkUserToPolymarket(
  privyUserId: string
): Promise<PolymarketCredentials> {
  console.log('🔗 Linking user to Polymarket...\n');

  // Initialize Privy client
  const privy = new PrivyClient(
    process.env.PRIVY_APP_ID || '',
    process.env.PRIVY_APP_SECRET || '',
    {
      walletApi: {
        authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
      },
    }
  );

  // Get user's embedded wallet from Privy
  const user = await privy.getUser(privyUserId);
  const embeddedWallet = user.linkedAccounts.find(
    account => account.type === 'wallet' && account.walletClientType === 'privy'
  );

  if (!embeddedWallet || embeddedWallet.type !== 'wallet') {
    throw new Error('User does not have an embedded wallet');
  }

  const walletAddress = embeddedWallet.address;
  const walletId = (embeddedWallet as any).id;
  console.log(`✅ Wallet address: ${walletAddress}`);

  // Create Privy signer using SDK helper
  const signer = createPrivySigner(privy, walletId, walletAddress);
  console.log('✅ Privy signer created');

  // Initialize Polymarket router
  const router = new PolymarketRouter({
    chainId: 137, // Polygon mainnet (use 80002 for Amoy testnet)
  });
  console.log('✅ Router initialized\n');

  // Link user - this prompts ONE signature via Privy
  console.log('📝 Deriving Polymarket CLOB credentials...');
  console.log('   (Signing EIP-712 payload with Privy authorization key)');

  const credentials = await router.linkUser({
    userId: privyUserId,
    signer,
  });

  console.log('✅ Credentials created!\n');
  console.log('Credentials (store these securely):');
  console.log(`  API Key: ${credentials.apiKey}`);
  console.log(`  API Secret: ${credentials.apiSecret.substring(0, 10)}...`);
  console.log(
    `  Passphrase: ${credentials.apiPassphrase.substring(0, 10)}...\n`
  );

  return credentials;
}

// ============================================================================
// Step 2: Trade on Polymarket (NO SIGNATURES NEEDED!)
// ============================================================================

/**
 * Places an order on Polymarket using stored credentials
 *
 * No wallet signatures required! Uses the API key created during linkUser().
 */
async function placeOrder(
  privyUserId: string,
  credentials: PolymarketCredentials
) {
  console.log('📊 Placing order on Polymarket...\n');

  const router = new PolymarketRouter({
    chainId: 137,
  });

  // Set credentials (if you stored them previously)
  router.setCredentials(privyUserId, credentials);

  // Place order - NO SIGNATURE REQUIRED!
  const orderResponse = await router.placeOrder(
    {
      userId: privyUserId,
      marketId:
        '21742633143463906290569050155826241533067272736897614950488156847949938836455', // Example token ID
      side: 'buy',
      size: 1, // 1 share
      price: 0.5, // $0.50
    },
    credentials // Can pass credentials directly or use setCredentials
  );

  console.log('✅ Order placed successfully!\n');
  console.log('Order response:', orderResponse);

  return orderResponse;
}

// ============================================================================
// Complete E2E Flow
// ============================================================================

async function completeFlow() {
  console.log('🧪 Testing Privy + Polymarket Direct CLOB Integration\n');
  console.log(`${'='.repeat(60)}\n`);

  try {
    // For this example, create a new Privy user
    // In production, you'd use your authenticated user
    const privy = new PrivyClient(
      process.env.PRIVY_APP_ID || '',
      process.env.PRIVY_APP_SECRET || '',
      {
        walletApi: {
          authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
        },
      }
    );

    console.log('1️⃣  Creating Privy test user...');
    const user = await privy.createUser({});
    console.log(`✅ User created: ${user.id}\n`);

    // Step 1: Link user (one-time setup)
    console.log('2️⃣  Linking user to Polymarket (ONE-TIME SETUP)');
    console.log('='.repeat(60));
    const credentials = await linkUserToPolymarket(user.id);

    // In production, store credentials in your database:
    // await db.polymarketCredentials.create({
    //   userId: user.id,
    //   apiKey: credentials.apiKey,
    //   apiSecret: credentials.apiSecret,
    //   apiPassphrase: credentials.apiPassphrase,
    // });

    // Step 2: Place order (no signatures!)
    console.log('3️⃣  Placing order (NO WALLET SIGNATURE REQUIRED!)');
    console.log('='.repeat(60));
    await placeOrder(user.id, credentials);

    // Step 3: Place another order (still no signatures!)
    console.log('4️⃣  Placing another order (STILL NO SIGNATURE!)');
    console.log('='.repeat(60));
    await placeOrder(user.id, credentials);

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Complete flow successful!');
    console.log(`${'='.repeat(60)}\n`);

    console.log('Key learnings:');
    console.log('• User signed ONCE (server-side with Privy)');
    console.log('• Created Polymarket CLOB API credentials');
    console.log('• Placed multiple orders without signatures');
    console.log('• No Dome backend required!');
    console.log('• Credentials stored for future trading\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// ============================================================================
// Credential Storage Helper
// ============================================================================

/**
 * Example of how to retrieve and use stored credentials
 *
 * In production, you'd retrieve credentials from your database
 */
async function tradeWithStoredCredentials(userId: string) {
  // Retrieve from database
  // const storedCreds = await db.polymarketCredentials.findOne({ userId });

  // For this example, we'll assume credentials are passed in
  const storedCreds: PolymarketCredentials = {
    apiKey: 'stored-api-key',
    apiSecret: 'stored-api-secret',
    apiPassphrase: 'stored-passphrase',
  };

  const router = new PolymarketRouter({ chainId: 137 });

  // Set credentials from storage
  router.setCredentials(userId, storedCreds);

  // Now you can trade without linkUser()
  await router.placeOrder({
    userId,
    marketId: 'token-id',
    side: 'buy',
    size: 10,
    price: 0.65,
  });
}

// ============================================================================
// Environment Variables Required
// ============================================================================

/**
 * Required environment variables:
 *
 * PRIVY_APP_ID             - Your Privy application ID
 * PRIVY_APP_SECRET         - Your Privy application secret
 * PRIVY_AUTHORIZATION_KEY  - Privy authorization key for server-side signing
 *
 * Get these from: https://dashboard.privy.io
 */

// Run the complete flow
if (require.main === module) {
  completeFlow().catch(console.error);
}

// Export for use in other modules
export {
  linkUserToPolymarket,
  placeOrder,
  completeFlow,
  tradeWithStoredCredentials,
};
