/**
 * Privy Utility Functions
 *
 * Helper functions to easily integrate Privy with Dome SDK for Polymarket trading.
 * These utilities handle server-side wallet signing using Privy's authorization keys.
 */

import { PrivyClient } from '@privy-io/server-auth';
import { RouterSigner, Eip712Payload } from '../types.js';

/**
 * Configuration for Privy integration
 */
export interface PrivyConfig {
  /** Privy App ID */
  appId: string;
  /** Privy App Secret */
  appSecret: string;
  /** Privy Authorization Private Key (wallet-auth:...) */
  authorizationKey: string;
}

/**
 * Creates a Privy client instance for server-side operations
 *
 * @param config - Privy configuration
 * @returns Configured PrivyClient instance
 *
 * @example
 * ```typescript
 * const privy = createPrivyClient({
 *   appId: process.env.PRIVY_APP_ID!,
 *   appSecret: process.env.PRIVY_APP_SECRET!,
 *   authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
 * });
 * ```
 */
export function createPrivyClient(config: PrivyConfig): PrivyClient {
  return new PrivyClient(config.appId, config.appSecret, {
    walletApi: {
      authorizationPrivateKey: config.authorizationKey,
    },
  });
}

/**
 * Creates a RouterSigner from a Privy wallet for Polymarket trading
 *
 * This signer can be used with PolymarketRouter to sign orders server-side
 * without requiring user interaction.
 *
 * @param privy - Configured PrivyClient instance
 * @param walletId - Privy wallet ID
 * @param walletAddress - Wallet address (0x...)
 * @returns RouterSigner that can be used with PolymarketRouter
 *
 * @example
 * ```typescript
 * const privy = createPrivyClient({ ... });
 * const signer = createPrivySigner(
 *   privy,
 *   'wallet-id-from-privy',
 *   '0x1234...'
 * );
 *
 * // Use with PolymarketRouter
 * await router.linkUser({ userId: 'user-123', signer });
 * ```
 */
export function createPrivySigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): RouterSigner {
  return {
    async getAddress(): Promise<string> {
      return walletAddress;
    },

    async signTypedData(payload: Eip712Payload): Promise<string> {
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId,
        typedData: {
          domain: payload.domain,
          types: payload.types,
          primaryType: payload.primaryType,
          message: payload.message,
        },
      });

      return signature;
    },
  };
}

/**
 * All-in-one helper to create a Privy signer from environment variables
 *
 * Expects the following environment variables:
 * - PRIVY_APP_ID
 * - PRIVY_APP_SECRET
 * - PRIVY_AUTHORIZATION_KEY
 *
 * @param walletId - Privy wallet ID
 * @param walletAddress - Wallet address (0x...)
 * @returns RouterSigner ready to use
 *
 * @example
 * ```typescript
 * // Simplest usage - just pass wallet info
 * const signer = createPrivySignerFromEnv(
 *   user.privyWalletId,
 *   user.walletAddress
 * );
 *
 * await router.placeOrder({
 *   userId: user.id,
 *   marketId: '60487116984468020978247225474488676749601001829886755968952521846780452448915',
 *   side: 'buy',
 *   size: 10,
 *   price: 0.65,
 *   signer,
 * }, credentials);
 * ```
 */
export function createPrivySignerFromEnv(
  walletId: string,
  walletAddress: string
): RouterSigner {
  const config: PrivyConfig = {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  };

  if (!config.appId || !config.appSecret || !config.authorizationKey) {
    throw new Error(
      'Missing Privy environment variables: PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_AUTHORIZATION_KEY'
    );
  }

  const privy = createPrivyClient(config);
  return createPrivySigner(privy, walletId, walletAddress);
}
