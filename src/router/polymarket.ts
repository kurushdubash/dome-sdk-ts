import { ClobClient } from '@polymarket/clob-client';
import {
  LinkPolymarketUserParams,
  PlaceOrderParams,
  PolymarketRouterConfig,
  RouterSigner,
} from '../types';
import { createPrivyClient, createPrivySigner } from '../utils/privy';

/**
 * Polymarket Router Helper (v0 - Direct CLOB Integration)
 *
 * This helper provides a simple interface for Polymarket CLOB client integration
 * with any wallet provider (Privy, MetaMask, etc.).
 *
 * Key flows:
 * 1. User signs ONE EIP-712 message to create a Polymarket CLOB API key
 * 2. API key and credentials are stored in-memory (or your preferred storage)
 * 3. All future trading uses the API key - no wallet signatures required
 *
 * This v0 version talks directly to Polymarket CLOB.
 * Future versions will route through Dome backend for additional features.
 *
 * @example
 * ```typescript
 * import { PolymarketRouter } from '@dome-api/sdk/router';
 * import { createPrivySigner } from './privy-adapter';
 *
 * const router = new PolymarketRouter({
 *   chainId: 137, // Polygon mainnet
 * });
 *
 * // One-time setup: Link user to Polymarket
 * const signer = await createPrivySigner(privyUser);
 * const credentials = await router.linkUser({
 *   userId: 'user-123',
 *   signer
 * });
 *
 * // Store credentials.apiKey and credentials.apiSecret securely
 *
 * // Place orders using API keys (no more wallet signatures!)
 * await router.placeOrder({
 *   userId: 'user-123',
 *   marketId: '0x123...',  // condition_id
 *   side: 'buy',
 *   size: 10,
 *   price: 0.65,
 * }, credentials);
 * ```
 */

interface PolymarketCredentials {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

export class PolymarketRouter {
  private readonly chainId: number;
  private readonly clobClient: ClobClient;
  // In-memory storage of user credentials (use your preferred storage in production)
  private readonly userCredentials = new Map<string, PolymarketCredentials>();
  private readonly privyClient?: any; // PrivyClient type
  private readonly privyConfig?: PolymarketRouterConfig['privy'];

  constructor(config: PolymarketRouterConfig = {}) {
    this.chainId = config.chainId || 137; // Polygon mainnet by default

    // Initialize CLOB client (we'll set credentials per-user)
    this.clobClient = new ClobClient(
      config.clobEndpoint || 'https://clob.polymarket.com',
      this.chainId
    );

    // Initialize Privy if config provided
    if (config.privy) {
      this.privyConfig = config.privy;
      this.privyClient = createPrivyClient(config.privy);
    }
  }

  /**
   * Create a signer from Privy wallet info (internal helper)
   */
  private createPrivySignerFromWallet(
    walletId: string,
    walletAddress: string
  ): RouterSigner {
    if (!this.privyClient) {
      throw new Error(
        'Privy not configured. Either pass privy config to router constructor or provide a signer.'
      );
    }
    return createPrivySigner(this.privyClient, walletId, walletAddress);
  }

  /**
   * Links a user to Polymarket by creating a CLOB API key
   *
   * This method:
   * 1. Gets the user's wallet address
   * 2. Creates a Polymarket CLOB client for the user
   * 3. Derives API credentials using ONE signature
   * 4. Returns credentials to be stored securely
   *
   * After this completes, the user can trade using API keys without signing each order.
   *
   * @param params - User ID and signer implementation
   * @returns Promise that resolves with Polymarket CLOB credentials
   *
   * @example
   * ```typescript
   * const signer = await createPrivySigner(privyUser);
   * const credentials = await router.linkUser({
   *   userId: 'user-123',
   *   signer: signer,
   * });
   *
   * // Store credentials.apiKey, credentials.apiSecret, credentials.apiPassphrase
   * // in your database or secure storage
   * ```
   */
  async linkUser(
    params: LinkPolymarketUserParams
  ): Promise<PolymarketCredentials> {
    const { userId, signer } = params;

    // Get the user's wallet address
    const address = await signer.getAddress();

    // Create user-specific CLOB client with the signer
    // We need to adapt RouterSigner to ethers Wallet interface
    const ethersAdapter = {
      getAddress: async () => address,
      _signTypedData: async (domain: any, types: any, value: any) => {
        // Convert ethers _signTypedData call to our Eip712Payload format
        return await signer.signTypedData({
          domain,
          types,
          primaryType:
            Object.keys(types).find(key => key !== 'EIP712Domain') || '',
          message: value,
        });
      },
    };

    const userClobClient = new ClobClient(
      this.clobClient.host,
      this.chainId,
      ethersAdapter as any // Adapt our signer to ethers interface
    );

    // Try to derive existing API credentials first
    let apiKeyCreds;
    try {
      console.log('   Attempting to derive existing API credentials...');
      apiKeyCreds = await userClobClient.deriveApiKey();

      // Validate credentials
      if (
        !apiKeyCreds ||
        !apiKeyCreds.key ||
        !apiKeyCreds.secret ||
        !apiKeyCreds.passphrase
      ) {
        throw new Error('Derived credentials are invalid or incomplete');
      }

      console.log('   ✅ Successfully derived existing API credentials');
    } catch (deriveError: any) {
      console.log(
        `   Derive failed (${deriveError.message}), attempting to create new credentials...`
      );

      try {
        apiKeyCreds = await userClobClient.createApiKey();
        console.log('   ✅ Successfully created new API credentials');
      } catch (createError: any) {
        console.error(
          '   ❌ Failed to create API credentials:',
          createError.message
        );
        throw new Error(
          `Failed to obtain Polymarket API credentials: ${createError.message}`
        );
      }
    }

    // Convert ApiKeyCreds to our PolymarketCredentials format
    const credentials: PolymarketCredentials = {
      apiKey: apiKeyCreds.key,
      apiSecret: apiKeyCreds.secret,
      apiPassphrase: apiKeyCreds.passphrase,
    };

    // Store credentials in memory (you should store in your DB)
    this.userCredentials.set(userId, credentials);

    return credentials;
  }

  /**
   * Places an order on Polymarket directly via CLOB
   *
   * This uses the API credentials created during linkUser(), so no wallet signature is needed.
   * Communicates directly with Polymarket CLOB.
   *
   * @param params - Order parameters
   * @param credentials - Polymarket CLOB credentials (from linkUser)
   * @returns Promise that resolves with the order response
   *
   * @example
   * ```typescript
   * const orderResponse = await router.placeOrder({
   *   userId: 'user-123',
   *   marketId: '0x123...', // condition_id
   *   side: 'buy',
   *   size: 10,
   *   price: 0.65,
   * }, credentials);
   * ```
   */
  async placeOrder(
    params: PlaceOrderParams,
    credentials?: PolymarketCredentials
  ): Promise<any> {
    const {
      userId,
      marketId,
      side,
      size,
      price,
      signer,
      privyWalletId,
      walletAddress,
    } = params;

    // Auto-create signer if Privy wallet info provided
    const actualSigner =
      signer ||
      (privyWalletId && walletAddress
        ? this.createPrivySignerFromWallet(privyWalletId, walletAddress)
        : undefined);

    if (!actualSigner) {
      throw new Error(
        'Either provide a signer or Privy wallet info (privyWalletId + walletAddress)'
      );
    }

    // Get credentials (from parameter or in-memory storage)
    const creds = credentials || this.userCredentials.get(userId);
    if (!creds) {
      throw new Error(
        `No credentials found for user ${userId}. Call linkUser() first.`
      );
    }

    // Convert credentials format from PolymarketCredentials to ApiKeyCreds
    const apiKeyCreds = {
      key: creds.apiKey,
      secret: creds.apiSecret,
      passphrase: creds.apiPassphrase,
    };

    // Get the user's wallet address
    const address = await actualSigner.getAddress();

    // Create ethers adapter for the signer (same as in linkUser)
    const ethersAdapter = {
      getAddress: async () => address,
      _signTypedData: async (domain: any, types: any, value: any) => {
        return await actualSigner.signTypedData({
          domain,
          types,
          primaryType:
            Object.keys(types).find(key => key !== 'EIP712Domain') || '',
          message: value,
        });
      },
    };

    // Create authenticated CLOB client for this user with both credentials AND signer
    // For EOA wallets, the signer address is also the funder (where USDC is held)
    // Using signatureType = 0 for standard EOA/browser wallet signing
    const userClobClient = new ClobClient(
      this.clobClient.host,
      this.chainId,
      ethersAdapter as any, // Signer for order signing
      apiKeyCreds, // API credentials for authentication
      0, // signatureType = 0 for browser wallet/EOA
      undefined, // funderAddress (undefined for EOA - uses signer address)
      undefined, // geoBlockToken
      false // useServerTime
    );

    // Place order using CLOB client
    // Convert side to correct enum format
    const orderSide = side.toLowerCase() === 'buy' ? 'BUY' : 'SELL';

    const orderResponse = await userClobClient.createAndPostOrder({
      tokenID: marketId,
      price,
      size,
      side: orderSide as any, // Use any to avoid type issues with the enum
    });

    return orderResponse;
  }

  /**
   * Checks if a user has already been linked to Polymarket
   *
   * @param userId - Customer's internal user ID
   * @returns Promise that resolves to true if linked, false otherwise
   *
   * @example
   * ```typescript
   * const isLinked = await router.isUserLinked('user-123');
   * if (!isLinked) {
   *   const credentials = await router.linkUser({ userId: 'user-123', signer });
   *   // Store credentials
   * }
   * ```
   */
  isUserLinked(userId: string): boolean {
    return this.userCredentials.has(userId);
  }

  /**
   * Manually set credentials for a user (if you stored them previously)
   *
   * @param userId - Customer's internal user ID
   * @param credentials - Previously stored credentials
   *
   * @example
   * ```typescript
   * // After retrieving from your database
   * router.setCredentials('user-123', {
   *   apiKey: '...',
   *   apiSecret: '...',
   *   apiPassphrase: '...',
   * });
   * ```
   */
  setCredentials(userId: string, credentials: PolymarketCredentials): void {
    this.userCredentials.set(userId, credentials);
  }

  /**
   * Get stored credentials for a user
   *
   * @param userId - Customer's internal user ID
   * @returns Credentials if found, undefined otherwise
   */
  getCredentials(userId: string): PolymarketCredentials | undefined {
    return this.userCredentials.get(userId);
  }
}

// Export the credentials type for use by consumers
export type { PolymarketCredentials };
