import { ClobClient } from '@polymarket/clob-client';
import { BuilderConfig as PolymarketBuilderConfig } from '@polymarket/builder-signing-sdk';
import { RelayClient } from '@polymarket/builder-relayer-client';
import {
  LinkPolymarketUserParams,
  PlaceOrderParams,
  PolymarketRouterConfig,
  RouterSigner,
  WalletType,
  SafeLinkResult,
} from '../types.js';
import {
  createPrivyClient,
  createPrivySigner,
  checkPrivyWalletAllowances,
  setPrivyWalletAllowances,
} from '../utils/privy.js';
import {
  checkAllAllowances,
  setAllAllowances,
  getPolygonProvider,
} from '../utils/allowances.js';
import {
  deriveSafeAddress,
  isSafeDeployed,
  createRelayClient,
  deploySafe,
  setSafeUsdcApproval,
  checkSafeAllowances,
  POLYGON_CHAIN_ID,
  DEFAULT_RELAYER_URL,
  DEFAULT_RPC_URL,
} from '../utils/safe.js';

/**
 * Polymarket Router Helper (v0 - Direct CLOB Integration)
 *
 * This helper provides a simple interface for Polymarket CLOB client integration
 * with any wallet provider (Privy, MetaMask, etc.).
 *
 * Supports two wallet types:
 * 1. EOA wallets (Privy embedded, direct signing) - simpler setup
 * 2. Safe wallets (external wallets like MetaMask) - requires Safe deployment
 *
 * Key flows:
 * 1. User signs ONE EIP-712 message to create a Polymarket CLOB API key
 * 2. API key and credentials are stored in-memory (or your preferred storage)
 * 3. All future trading uses the API key - no wallet signatures required
 *
 * This v0 version talks directly to Polymarket CLOB.
 * Future versions will route through Dome backend for additional features.
 *
 * @example EOA wallet (Privy):
 * ```typescript
 * const router = new PolymarketRouter({
 *   chainId: 137,
 *   privy: { appId, appSecret, authorizationKey },
 * });
 *
 * const credentials = await router.linkUser({
 *   userId: 'user-123',
 *   signer,
 *   walletType: 'eoa',  // default
 * });
 * ```
 *
 * @example Safe wallet (external):
 * ```typescript
 * const router = new PolymarketRouter({ chainId: 137 });
 *
 * const result = await router.linkUser({
 *   userId: 'user-123',
 *   signer,
 *   walletType: 'safe',
 *   autoDeploySafe: true,
 * });
 *
 * // result includes safeAddress for placing orders
 * await router.placeOrder({
 *   userId: 'user-123',
 *   marketId: '0x...',
 *   side: 'buy',
 *   size: 10,
 *   price: 0.65,
 *   walletType: 'safe',
 *   funderAddress: result.safeAddress,
 *   signer,
 * }, credentials);
 * ```
 */

interface PolymarketCredentials {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
}

interface AllowanceCheckResult {
  allSet: boolean;
  usdc: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  };
  ctf: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  };
}

export class PolymarketRouter {
  private readonly chainId: number;
  private readonly clobClient: ClobClient;
  private readonly relayerUrl: string;
  private readonly rpcUrl: string;
  // In-memory storage of user credentials (use your preferred storage in production)
  private readonly userCredentials = new Map<string, PolymarketCredentials>();
  // In-memory storage of user Safe addresses
  private readonly userSafeAddresses = new Map<string, string>();
  private readonly privyClient?: any; // PrivyClient type
  private readonly privyConfig?: PolymarketRouterConfig['privy'];
  private readonly builderConfig?: PolymarketBuilderConfig;

  constructor(config: PolymarketRouterConfig = {}) {
    this.chainId = config.chainId || POLYGON_CHAIN_ID;
    this.relayerUrl = config.relayerEndpoint || DEFAULT_RELAYER_URL;
    this.rpcUrl = config.rpcUrl || DEFAULT_RPC_URL;

    // Always use Dome builder server for improved order execution
    this.builderConfig = new PolymarketBuilderConfig({
      remoteBuilderConfig: {
        url: 'https://builder-signer.domeapi.io/builder-signer/sign',
      },
    });

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
   * Create ethers adapter from RouterSigner
   */
  private createEthersAdapter(
    signer: RouterSigner,
    address: string
  ): {
    getAddress: () => Promise<string>;
    _signTypedData: (domain: any, types: any, value: any) => Promise<string>;
  } {
    return {
      getAddress: async () => address,
      _signTypedData: async (domain: any, types: any, value: any) => {
        return await signer.signTypedData({
          domain,
          types,
          primaryType:
            Object.keys(types).find(key => key !== 'EIP712Domain') || '',
          message: value,
        });
      },
    };
  }

  /**
   * Links a user to Polymarket by creating a CLOB API key
   *
   * For EOA wallets (walletType: 'eoa'):
   * - Gets the user's wallet address
   * - Creates a Polymarket CLOB client for the user
   * - Derives API credentials using ONE signature
   *
   * For Safe wallets (walletType: 'safe'):
   * - Derives the Safe address from the EOA
   * - Deploys the Safe if needed
   * - Sets token allowances from the Safe
   * - Creates API credentials
   *
   * After this completes, the user can trade using API keys without signing each order.
   */
  async linkUser(
    params: LinkPolymarketUserParams
  ): Promise<PolymarketCredentials | SafeLinkResult> {
    const walletType = params.walletType || 'eoa';

    if (walletType === 'safe') {
      return this.linkUserWithSafe(params);
    } else {
      return this.linkUserWithEoa(params);
    }
  }

  /**
   * Link user with EOA wallet (Privy or direct signing)
   */
  private async linkUserWithEoa(
    params: LinkPolymarketUserParams
  ): Promise<PolymarketCredentials> {
    const {
      userId,
      signer,
      privyWalletId,
      autoSetAllowances = true,
      sponsorGas = false,
    } = params;

    // Get the user's wallet address
    const address = await signer.getAddress();

    // Auto-set allowances if Privy is configured and wallet ID provided
    if (autoSetAllowances && this.privyClient && privyWalletId) {
      console.log('   Checking token allowances...');
      const allowances = await checkPrivyWalletAllowances(address);

      if (!allowances.allSet) {
        console.log(
          `   Setting missing token allowances${sponsorGas ? ' (sponsored)' : ''}...`
        );
        await setPrivyWalletAllowances(
          this.privyClient,
          privyWalletId,
          address,
          {
            onProgress: (step, current, total) => {
              console.log(`   [${current}/${total}] ${step}...`);
            },
            sponsor: sponsorGas,
          }
        );
        console.log('   Token allowances set');
      } else {
        console.log('   Token allowances already set');
      }
    }

    // Create ethers adapter
    const ethersAdapter = this.createEthersAdapter(signer, address);

    const userClobClient = new ClobClient(
      this.clobClient.host,
      this.chainId,
      ethersAdapter as any,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      this.builderConfig
    );

    // Derive or create API credentials
    const apiKeyCreds = await this.deriveOrCreateApiCredentials(userClobClient);

    const credentials: PolymarketCredentials = {
      apiKey: apiKeyCreds.key,
      apiSecret: apiKeyCreds.secret,
      apiPassphrase: apiKeyCreds.passphrase,
    };

    this.userCredentials.set(userId, credentials);

    return credentials;
  }

  /**
   * Link user with Safe wallet (external wallets)
   */
  private async linkUserWithSafe(
    params: LinkPolymarketUserParams
  ): Promise<SafeLinkResult> {
    const {
      userId,
      signer,
      autoDeploySafe = true,
      autoSetAllowances = true,
    } = params;

    const eoaAddress = await signer.getAddress();
    console.log(`   EOA address: ${eoaAddress}`);

    // Step 1: Derive Safe address
    console.log('   Deriving Safe address...');
    const safeAddress = deriveSafeAddress(eoaAddress, this.chainId);
    console.log(`   Safe address: ${safeAddress}`);

    // Step 2: Check if Safe is deployed
    const provider = getPolygonProvider(this.rpcUrl);
    let safeDeployed = await isSafeDeployed(safeAddress, provider);

    // Step 3: Deploy Safe if needed
    if (!safeDeployed && autoDeploySafe) {
      console.log('   Deploying Safe wallet...');
      const relayClient = createRelayClient(signer, {
        relayerUrl: this.relayerUrl,
        rpcUrl: this.rpcUrl,
        chainId: this.chainId,
      });

      const deployResult = await deploySafe(relayClient);
      console.log(`   Safe deployed: ${deployResult.safeAddress}`);
      safeDeployed = true;
    } else if (!safeDeployed) {
      throw new Error(
        `Safe not deployed at ${safeAddress}. Set autoDeploySafe: true to deploy automatically.`
      );
    } else {
      console.log('   Safe already deployed');
    }

    // Step 4: Set allowances from Safe if needed
    let allowancesSet = 0;
    if (autoSetAllowances) {
      console.log('   Checking Safe allowances...');
      const allowances = await checkSafeAllowances(safeAddress, provider);

      if (!allowances.allSet) {
        console.log('   Setting Safe allowances...');
        const relayClient = createRelayClient(signer, {
          relayerUrl: this.relayerUrl,
          rpcUrl: this.rpcUrl,
          chainId: this.chainId,
        });
        await setSafeUsdcApproval(relayClient);
        allowancesSet = 3; // CTF Exchange, Neg Risk CTF Exchange, Neg Risk Adapter
        console.log('   Safe allowances set');
      } else {
        console.log('   Safe allowances already set');
      }
    }

    // Step 5: Create API credentials
    // For Safe wallets, we use signatureType = 2 (browser wallet)
    console.log('   Deriving API credentials...');
    const ethersAdapter = this.createEthersAdapter(signer, eoaAddress);

    // Create CLOB client with Safe as funder
    const userClobClient = new ClobClient(
      this.clobClient.host,
      this.chainId,
      ethersAdapter as any,
      undefined,
      2, // signatureType = 2 for browser wallet with Safe
      safeAddress, // funderAddress = Safe
      undefined,
      false,
      this.builderConfig
    );

    const apiKeyCreds = await this.deriveOrCreateApiCredentials(userClobClient);

    const credentials: PolymarketCredentials = {
      apiKey: apiKeyCreds.key,
      apiSecret: apiKeyCreds.secret,
      apiPassphrase: apiKeyCreds.passphrase,
    };

    // Store credentials and Safe address
    this.userCredentials.set(userId, credentials);
    this.userSafeAddresses.set(userId, safeAddress);

    console.log('   User linked successfully');

    return {
      credentials,
      safeAddress,
      signerAddress: eoaAddress,
      safeDeployed: !safeDeployed, // true if we deployed it during this call
      allowancesSet,
    };
  }

  /**
   * Helper to derive or create API credentials
   */
  private async deriveOrCreateApiCredentials(
    clobClient: ClobClient
  ): Promise<{ key: string; secret: string; passphrase: string }> {
    try {
      console.log('   Attempting to derive existing API credentials...');
      const apiKeyCreds = await clobClient.deriveApiKey();

      if (
        !apiKeyCreds ||
        !apiKeyCreds.key ||
        !apiKeyCreds.secret ||
        !apiKeyCreds.passphrase
      ) {
        throw new Error('Derived credentials are invalid or incomplete');
      }

      console.log('   Successfully derived existing API credentials');
      return apiKeyCreds;
    } catch (deriveError: any) {
      console.log(
        `   Derive failed (${deriveError.message}), attempting to create new credentials...`
      );

      try {
        const apiKeyCreds = await clobClient.createApiKey();
        console.log('   Successfully created new API credentials');
        return apiKeyCreds;
      } catch (createError: any) {
        console.error(
          '   Failed to create API credentials:',
          createError.message
        );
        throw new Error(
          `Failed to obtain Polymarket API credentials: ${createError.message}`
        );
      }
    }
  }

  /**
   * Places an order on Polymarket directly via CLOB
   *
   * This uses the API credentials created during linkUser(), so no wallet signature is needed.
   * Communicates directly with Polymarket CLOB.
   *
   * For EOA wallets: signer address is the funder
   * For Safe wallets: Safe address is the funder, EOA is the signer
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
      walletType = 'eoa',
      funderAddress,
      privyWalletId,
      walletAddress,
      negRisk = false,
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

    // Get credentials
    const creds = credentials || this.userCredentials.get(userId);
    if (!creds) {
      throw new Error(
        `No credentials found for user ${userId}. Call linkUser() first.`
      );
    }

    const apiKeyCreds = {
      key: creds.apiKey,
      secret: creds.apiSecret,
      passphrase: creds.apiPassphrase,
    };

    const signerAddress = await actualSigner.getAddress();
    const ethersAdapter = this.createEthersAdapter(actualSigner, signerAddress);

    // Determine signature type and funder based on wallet type
    let signatureType: number;
    let funder: string | undefined;

    if (walletType === 'safe') {
      signatureType = 2; // Browser wallet with Safe
      funder = funderAddress || this.userSafeAddresses.get(userId) || undefined;

      if (!funder) {
        throw new Error(
          'funderAddress is required for Safe wallet orders. Pass it explicitly or ensure linkUser was called with walletType: "safe".'
        );
      }
    } else {
      signatureType = 0; // EOA
      funder = undefined; // Uses signer address
    }

    // Create authenticated CLOB client
    const userClobClient = new ClobClient(
      this.clobClient.host,
      this.chainId,
      ethersAdapter as any,
      apiKeyCreds,
      signatureType,
      funder,
      undefined,
      false,
      this.builderConfig
    );

    // Place order
    const orderSide = side.toLowerCase() === 'buy' ? 'BUY' : 'SELL';

    const orderResponse = await userClobClient.createAndPostOrder(
      {
        tokenID: marketId,
        price,
        size,
        side: orderSide as any,
      },
      { negRisk }
    );

    return orderResponse;
  }

  /**
   * Get the Safe address for a user (if using Safe wallet)
   */
  getSafeAddress(userId: string): string | undefined {
    return this.userSafeAddresses.get(userId);
  }

  /**
   * Derive Safe address from EOA (without deployment)
   */
  deriveSafeAddress(eoaAddress: string): string {
    return deriveSafeAddress(eoaAddress, this.chainId);
  }

  /**
   * Check if a Safe is deployed
   */
  async isSafeDeployed(safeAddress: string): Promise<boolean> {
    const provider = getPolygonProvider(this.rpcUrl);
    return isSafeDeployed(safeAddress, provider);
  }

  /**
   * Create a RelayClient for Safe operations
   */
  createRelayClient(signer: RouterSigner): RelayClient {
    return createRelayClient(signer, {
      relayerUrl: this.relayerUrl,
      rpcUrl: this.rpcUrl,
      chainId: this.chainId,
    });
  }

  /**
   * Checks if a user has already been linked to Polymarket
   */
  isUserLinked(userId: string): boolean {
    return this.userCredentials.has(userId);
  }

  /**
   * Manually set credentials for a user
   */
  setCredentials(userId: string, credentials: PolymarketCredentials): void {
    this.userCredentials.set(userId, credentials);
  }

  /**
   * Manually set Safe address for a user
   */
  setSafeAddress(userId: string, safeAddress: string): void {
    this.userSafeAddresses.set(userId, safeAddress);
  }

  /**
   * Get stored credentials for a user
   */
  getCredentials(userId: string): PolymarketCredentials | undefined {
    return this.userCredentials.get(userId);
  }

  /**
   * Check if a wallet has all required token allowances for Polymarket trading
   */
  async checkAllowances(
    walletAddress: string,
    rpcUrl?: string
  ): Promise<AllowanceCheckResult> {
    const provider = getPolygonProvider(rpcUrl || this.rpcUrl);
    return await checkAllAllowances(walletAddress, provider);
  }

  /**
   * Check if a Safe has all required allowances
   */
  async checkSafeAllowances(
    safeAddress: string,
    rpcUrl?: string
  ): Promise<{
    allSet: boolean;
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  }> {
    const provider = getPolygonProvider(rpcUrl || this.rpcUrl);
    return await checkSafeAllowances(safeAddress, provider);
  }

  /**
   * Set all required token allowances for Polymarket trading (EOA wallets)
   */
  async setAllowances(
    signer: RouterSigner,
    rpcUrl?: string,
    onProgress?: (step: string, current: number, total: number) => void
  ): Promise<{
    usdc: {
      ctfExchange?: string;
      negRiskCtfExchange?: string;
      negRiskAdapter?: string;
    };
    ctf: {
      ctfExchange?: string;
      negRiskCtfExchange?: string;
      negRiskAdapter?: string;
    };
  }> {
    const provider = getPolygonProvider(rpcUrl || this.rpcUrl);
    return await setAllAllowances(signer, provider, onProgress);
  }

  /**
   * Set allowances for a Safe wallet
   */
  async setSafeAllowances(
    signer: RouterSigner,
    onProgress?: (step: string) => void
  ): Promise<void> {
    const relayClient = this.createRelayClient(signer);
    await setSafeUsdcApproval(relayClient, onProgress);
  }
}

// Export the credentials type for use by consumers
export type { PolymarketCredentials };
