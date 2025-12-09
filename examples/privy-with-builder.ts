/**
 * Privy + Polymarket with Dome Builder Server
 *
 * This example demonstrates the Dome SDK's built-in builder integration.
 * All orders automatically use Dome's builder server for improved execution.
 *
 * Key features:
 * - Server-side wallet management with Privy
 * - Automatic builder routing (no configuration needed!)
 * - Better order execution and reduced MEV
 * - Automatic token allowances
 * - No wallet signatures after initial setup
 *
 * Prerequisites:
 * - Privy account (https://dashboard.privy.io)
 * - Privy authorization key for server-side signing
 *
 * Note: Builder server (https://builder-signer.domeapi.io/builder-signer/sign)
 * is automatically enabled for all orders - no setup required!
 */

import { PolymarketRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// ============================================================================
// Configuration
// ============================================================================

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const PRIVY_AUTHORIZATION_KEY = process.env.PRIVY_AUTHORIZATION_KEY!;

// ============================================================================
// Initialize SDK with Builder
// ============================================================================

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
  walletApi: {
    authorizationPrivateKey: PRIVY_AUTHORIZATION_KEY,
  },
});

const router = new PolymarketRouter({
  chainId: 137, // Polygon mainnet
  privy: {
    appId: PRIVY_APP_ID,
    appSecret: PRIVY_APP_SECRET,
    authorizationKey: PRIVY_AUTHORIZATION_KEY,
  },
  // Builder server (https://builder-signer.domeapi.io/builder-signer/sign)
  // is automatically enabled - no configuration needed!
});

// ============================================================================
// Link User to Polymarket (ONE-TIME SETUP)
// ============================================================================

async function linkUserWithBuilder(user: {
  id: string;
  privyWalletId: string;
  walletAddress: string;
}) {
  console.log(
    '🔗 Linking user to Polymarket (builder automatically enabled)...\n'
  );

  // Create signer for the user
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  // Link user - automatically sets allowances and creates API credentials
  const credentials = await router.linkUser({
    userId: user.id,
    signer,
    privyWalletId: user.privyWalletId, // Enables automatic allowances
    autoSetAllowances: true, // Set token allowances automatically
    sponsorGas: false, // Set to true to use Privy gas sponsorship
  });

  console.log('✅ User linked successfully!\n');
  console.log('Credentials (store these securely):');
  console.log(`  API Key: ${credentials.apiKey}`);
  console.log(`  API Secret: ${credentials.apiSecret.substring(0, 10)}...`);
  console.log(
    `  Passphrase: ${credentials.apiPassphrase.substring(0, 10)}...\n`
  );

  return credentials;
}

// ============================================================================
// Place Orders with Builder (NO SIGNATURES NEEDED!)
// ============================================================================

async function placeOrderWithBuilder(
  user: {
    id: string;
    privyWalletId: string;
    walletAddress: string;
  },
  credentials: {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
  },
  marketId: string,
  side: 'buy' | 'sell',
  size: number,
  price: number
) {
  console.log('📊 Placing order with builder integration...\n');
  console.log(`Market: ${marketId}`);
  console.log(`Side: ${side}`);
  console.log(`Size: ${size}`);
  console.log(`Price: ${price}\n`);

  const orderResponse = await router.placeOrder(
    {
      userId: user.id,
      marketId,
      side,
      size,
      price,
      // Just pass wallet info - no signer needed!
      privyWalletId: user.privyWalletId,
      walletAddress: user.walletAddress,
    },
    credentials
  );

  console.log('✅ Order placed successfully!\n');
  console.log('Order response:', JSON.stringify(orderResponse, null, 2));
  console.log('\n📦 Builder server signed this order for better execution!\n');

  return orderResponse;
}

// ============================================================================
// Complete E2E Flow with Builder
// ============================================================================

async function completeFlowWithBuilder() {
  console.log('🚀 Testing Privy + Polymarket (Dome Builder Enabled)\n');
  console.log(`${'='.repeat(60)}\n`);

  try {
    // For this example, we'll use a test user
    // In production, get this from your authenticated user
    const testUser = {
      id: 'test-user-123',
      privyWalletId: 'privy-wallet-id', // From Privy
      walletAddress: '0x...', // From Privy embedded wallet
    };

    // Step 1: Link user (one-time setup with builder)
    console.log('1️⃣  Linking user to Polymarket with builder');
    console.log('='.repeat(60));
    const credentials = await linkUserWithBuilder(testUser);

    // In production, store credentials in your database:
    // await db.polymarketCredentials.create({
    //   userId: testUser.id,
    //   apiKey: credentials.apiKey,
    //   apiSecret: credentials.apiSecret,
    //   apiPassphrase: credentials.apiPassphrase,
    // });

    // Step 2: Place order (no signatures! Builder signs automatically!)
    console.log('2️⃣  Placing first order with builder');
    console.log('='.repeat(60));
    await placeOrderWithBuilder(
      testUser,
      credentials,
      '60487116984468020978247225474488676749601001829886755968952521846780452448915', // Example market
      'buy',
      1, // 1 share
      0.5 // $0.50
    );

    // Step 3: Place another order (still no signatures!)
    console.log('3️⃣  Placing second order with builder');
    console.log('='.repeat(60));
    await placeOrderWithBuilder(
      testUser,
      credentials,
      '60487116984468020978247225474488676749601001829886755968952521846780452448915',
      'sell',
      1,
      0.55
    );

    console.log('='.repeat(60));
    console.log('🎉 Complete flow successful!\n');
    console.log('Key benefits:');
    console.log('• User signed ONCE (server-side with Privy)');
    console.log('• Dome builder automatically signs all orders');
    console.log('• Better order routing and reduced MEV');
    console.log('• Access to private order flow');
    console.log('• Zero builder configuration required\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// ============================================================================
// Builder Benefits Explained
// ============================================================================

/**
 * Dome Builder Server - Automatically Enabled
 *
 * The SDK automatically uses Dome's builder server for all orders:
 * https://builder-signer.domeapi.io/builder-signer/sign
 *
 * Benefits:
 *
 * 1. **Better Execution**
 *    - Access to private order flow
 *    - More efficient order routing
 *    - Reduced slippage on large orders
 *
 * 2. **MEV Protection**
 *    - Orders are less visible to front-runners
 *    - Strategic order bundling
 *    - Reduced sandwich attacks
 *
 * 3. **Priority Matching**
 *    - Builder-signed orders get priority
 *    - Faster execution times
 *    - Better prices
 *
 * 4. **Zero Configuration**
 *    - Builder automatically signs alongside user's API key
 *    - No additional user interaction needed
 *    - Works seamlessly with Privy server-side signing
 *    - No setup required - just use the SDK!
 *
 * All orders placed through the SDK automatically benefit from these features
 * with zero configuration or additional code.
 */

// ============================================================================
// Run the example
// ============================================================================

if (require.main === module) {
  completeFlowWithBuilder().catch(console.error);
}

export { linkUserWithBuilder, placeOrderWithBuilder, completeFlowWithBuilder };
