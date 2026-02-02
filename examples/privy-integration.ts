/**
 * Privy Integration Example
 *
 * This example demonstrates how to integrate Privy with the Dome SDK
 * for wallet-agnostic Polymarket trading.
 *
 * Key concepts:
 * 1. Use Privy for user authentication and wallet management
 * 2. Create a RouterSigner adapter that wraps Privy's signing methods
 * 3. Use the Dome SDK router to handle Polymarket CLOB integration
 * 4. Users sign ONE EIP-712 message to create an API key
 * 5. All subsequent trading uses API keys (no wallet signatures)
 *
 * This follows the architecture described in the E2E testing document.
 */

import { PrivyClient } from '@privy-io/server-auth';
import {
  PolymarketRouter,
  RouterSigner,
  Eip712Payload,
  createPrivySigner,
} from '@dome-api/sdk';

// Note: createPrivySigner() is imported from @dome-api/sdk — no manual signer needed.

// ============================================================================
// Step 1: Initialize Router and Link User
// ============================================================================

/**
 * Complete example of linking a Privy user to Polymarket via Dome
 *
 * This is the one-time setup that:
 * 1. Gets the user's Privy embedded wallet
 * 2. Creates a RouterSigner adapter
 * 3. Has the user sign an EIP-712 payload (via Privy authorization keys)
 * 4. Creates and stores a Polymarket CLOB API key
 *
 * After this completes, the user can trade without signing each order.
 */
async function linkUserToPolymarket(
  privyUserId: string,
  internalUserId: string
) {
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

  // Create Privy signer using SDK helper
  const signer = createPrivySigner(privy, walletId, walletAddress);

  // Initialize Dome router
  const router = new PolymarketRouter({
    chainId: 137,
    apiKey: process.env.DOME_API_KEY,
  });

  // Check if user is already linked
  const isLinked = await router.isUserLinked(internalUserId);
  if (isLinked) {
    console.log('✅ User already linked to Polymarket');
    return;
  }

  // Link user to Polymarket
  // This prompts ONE signature to create the Polymarket CLOB API key
  console.log('🔗 Linking user to Polymarket...');
  await router.linkUser({
    userId: internalUserId,
    signer,
  });

  console.log('✅ User successfully linked to Polymarket');
  console.log('   Future trades will use API keys - no wallet signatures!');
}

// ============================================================================
// Step 2: Place Orders Using API Keys
// ============================================================================

/**
 * Example of placing an order after the user is linked
 *
 * No wallet signature required - uses the API key created during linking.
 */
async function placeOrder(userId: string) {
  const router = new PolymarketRouter({
    chainId: 137,
    apiKey: process.env.DOME_API_KEY,
  });

  console.log('📊 Placing order...');

  await router.placeOrder({
    userId,
    marketId: 'bitcoin-above-100k',
    side: 'buy',
    size: 10,
    price: 0.65,
  });

  console.log('✅ Order placed successfully');
}

// ============================================================================
// Step 3: Complete Flow Example
// ============================================================================

/**
 * Full E2E flow demonstrating Privy + Dome SDK integration
 *
 * This shows the complete journey:
 * 1. User logs in with Privy (handled by your frontend)
 * 2. Backend links user to Polymarket (one-time setup)
 * 3. User can trade using API keys
 */
async function completeFlow() {
  const privyUserId = 'privy-user-123'; // From Privy authentication
  const internalUserId = 'user-123'; // Your internal user ID

  try {
    // Step 1: Link user to Polymarket (one-time setup)
    await linkUserToPolymarket(privyUserId, internalUserId);

    // Step 2: Place an order (no signature needed!)
    await placeOrder(internalUserId);

    // Step 3: Place another order (still no signature!)
    await placeOrder(internalUserId);

    console.log('');
    console.log('🎉 Complete flow successful!');
    console.log('');
    console.log('Key learnings:');
    console.log('• User signed ONCE to create Polymarket API key');
    console.log('• All trading now uses API keys - no wallet signatures');
    console.log('• Dome SDK abstracts away Polymarket CLOB complexity');
    console.log('• Frontend is wallet-agnostic (works with any signer)');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// ============================================================================
// Alternative: Client-Side Privy Integration (Frontend)
// ============================================================================

/**
 * Example of using Privy on the client-side (browser)
 *
 * This is for reference - shows how to create a signer in the browser
 * when you need the user to interactively sign the EIP-712 payload.
 */
/*
import { usePrivy } from '@privy-io/react-auth';

function usePrivyRouterSigner() {
  const { user, signTypedData } = usePrivy();

  if (!user || !user.wallet) {
    return null;
  }

  const signer: RouterSigner = {
    async getAddress() {
      return user.wallet.address;
    },

    async signTypedData(payload: Eip712Payload) {
      // Privy handles the user interaction and signing
      const signature = await signTypedData({
        domain: payload.domain,
        types: payload.types,
        primaryType: payload.primaryType,
        message: payload.message,
      });

      return signature;
    },
  };

  return signer;
}

// Usage in React component:
async function handleLinkUser() {
  const signer = usePrivyRouterSigner();
  if (!signer) {
    throw new Error('No wallet connected');
  }

  const router = new PolymarketRouter({
    chainId: 137,
    apiKey: process.env.NEXT_PUBLIC_DOME_API_KEY,
  });

  await router.linkUser({
    userId: 'user-123',
    signer,
  });
}
*/

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * Required environment variables:
 *
 * PRIVY_APP_ID - Your Privy application ID
 * PRIVY_APP_SECRET - Your Privy application secret
 * PRIVY_AUTHORIZATION_KEY - Privy authorization key for server-side signing
 * DOME_API_KEY - Your Dome API key
 */

// Export for use in other modules
export { linkUserToPolymarket, placeOrder, completeFlow };
