/**
 * Polymarket Router with DomeFeeEscrow Integration
 *
 * Drop-in replacement for PolymarketRouter that automatically handles
 * fee escrow for every order. Users simply swap the class name:
 *
 * Before: const router = new PolymarketRouter({ apiKey });
 * After:  const router = new PolymarketEscrowRouter({ apiKey, escrow: { ... } });
 *
 * The router will:
 * 1. Generate a unique orderId for each order
 * 2. Calculate fees based on order size
 * 3. Create and sign a fee authorization (EIP-712 for Smart Wallets, EIP-2612 permit for EOA)
 * 4. Include the signed fee auth in the order request
 * 5. The Dome server then pulls the fee to escrow before placing the order
 *
 * DomeFeeEscrow Contract Features:
 * - State Machine: EMPTY → HELD → SENT/REFUNDED
 * - Dual wallet support: EOA (EIP-2612 permit) and Smart Wallets (EIP-1271)
 * - Proportional fee distribution on fills
 * - Automatic refund on cancellation
 */

import { PolymarketRouter } from './polymarket.js';
import { ethers } from 'ethers';
import {
  PlaceOrderParams,
  PolymarketCredentials,
  PolymarketRouterConfig,
  RouterSigner,
  SignedPolymarketOrder,
  ServerPlaceOrderRequest,
  ServerPlaceOrderResponse,
} from '../types.js';

// Import from escrow module to avoid duplication
import {
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  CHAIN_ID_POLYGON,
  CHAIN_ID_AMOY,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  HoldState,
  type EscrowData,
  type EscrowStatus,
  type FeeCalculation,
  calculateFees as escrowCalculateFees,
  parseUsdc as escrowParseUsdc,
  formatUsdc as escrowFormatUsdc,
  generateOrderId as escrowGenerateOrderId,
  createEIP712Domain,
  FEE_AUTH_TYPES,
  PERMIT_TYPES,
  createPermitDomain,
  getPermitNonce,
} from '../escrow/index.js';

// ============================================================================
// Re-export escrow types and constants for convenience
// ============================================================================

export {
  HoldState,
  FEE_AUTH_TYPES,
  PERMIT_TYPES,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
};

// Re-export MAX_CLIENT_FEE_BPS from escrow module
export { MAX_CLIENT_FEE_BPS } from '../escrow/index.js';

export type {
  EscrowData,
  EscrowStatus,
  FeeCalculation,
};

// ============================================================================
// Contract Constants (chain-specific, extending escrow constants)
// ============================================================================

/** DomeFeeEscrow contract address on Polygon mainnet */
export const DOME_FEE_ESCROW_POLYGON = ESCROW_CONTRACT_POLYGON;

/** DomeFeeEscrow contract address on Polygon Amoy testnet */
export const DOME_FEE_ESCROW_AMOY = '0x0000000000000000000000000000000000000000'; // TODO: Deploy and update

/** USDC.e token address on Polygon mainnet (bridged USDC, 6 decimals, EIP-2612 permit supported) */
export { USDC_POLYGON };

/** USDC token address on Polygon Amoy testnet */
export const USDC_AMOY = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';

/** Polygon chain ID */
export const POLYGON_CHAIN_ID = CHAIN_ID_POLYGON;

/** Polygon Amoy testnet chain ID */
export const AMOY_CHAIN_ID = CHAIN_ID_AMOY;

/** Dome API endpoint */
const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

// ============================================================================
// EIP-712 Types
// ============================================================================

/**
 * EIP-712 domain for DomeFeeEscrow contract
 */
export interface DomeFeeEscrowDomain {
  name: 'DomeFeeEscrow';
  version: '1';
  chainId: number;
  verifyingContract: string;
}

// ============================================================================
// Router Configuration Types
// ============================================================================

/**
 * Fee escrow configuration for the router
 */
export interface FeeEscrowConfig {
  /** Escrow contract address (defaults to chain-specific address) */
  escrowAddress?: string;
  /** Dome fee in basis points (default: 10 = 0.1%) */
  domeFeeBps?: number;
  /** Minimum dome fee in USDC smallest units (default: 10000 = $0.01) */
  minDomeFee?: bigint;
  /** Client/affiliate fee in basis points (default: 0) */
  clientFeeBps?: number;
  /** Client/affiliate address to receive client fee (default: zero address) */
  clientAddress?: string;
  /** Deadline for fee authorization in seconds from now (default: 3600 = 1 hour) */
  deadlineSeconds?: number;
  /** RPC URL for fetching permit nonce (default: https://polygon-rpc.com) */
  rpcUrl?: string;
}

/**
 * Extended router config with escrow settings
 */
export interface PolymarketEscrowRouterConfig extends PolymarketRouterConfig {
  escrow?: FeeEscrowConfig;
}

/**
 * Signed fee authorization to include with order
 */
export interface SignedFeeAuth {
  /** Unique order identifier (bytes32) */
  orderId: string;
  /** Payer address */
  payer: string;
  /** Order size in USDC (6 decimals) - used by contract to calculate fees */
  orderSize: string;
  /** Client fee in basis points - used by contract to calculate client fee */
  clientFeeBps: number;
  /** Total fee amount (dome + client) in string format - V1 format */
  feeAmount: string;
  /** Dome fee portion */
  domeFee: string;
  /** Client fee portion */
  clientFee: string;
  /** Signature expiration timestamp */
  deadline: number;
  /** EIP-712 or EIP-2612 signature */
  signature: string;
  /** Whether payer is a smart wallet (affects how server processes signature) */
  isSmartWallet: boolean;
  /** Client/affiliate address */
  client: string;
  /** Permit nonce used for EOA signatures (required for EIP-2612 permit) */
  permitNonce?: string;
}

/**
 * Extended place order params with fee escrow options
 */
export interface PlaceOrderWithEscrowParams extends PlaceOrderParams {
  /** Override dome fee basis points for this order */
  domeFeeBps?: number;
  /** Override client fee basis points for this order */
  clientFeeBps?: number;
  /** Override client address for this order */
  clientAddress?: string;
  /** Skip fee escrow for this order */
  skipEscrow?: boolean;
}

/**
 * Extended server request with fee auth
 */
interface ServerPlaceOrderWithFeeRequest extends ServerPlaceOrderRequest {
  params: ServerPlaceOrderRequest['params'] & {
    /** Payer address (wallet that pays the fee) */
    payerAddress?: string;
    /** Signer address (EOA that signs) */
    signerAddress?: string;
    /** Fee authorization data */
    feeAuth?: SignedFeeAuth;
  };
}

// ============================================================================
// Utility Functions (wrappers around escrow module functions)
// ============================================================================

/**
 * Create EIP-712 domain for DomeFeeEscrow contract
 * @deprecated Use createEIP712Domain from escrow module
 */
export function createFeeEscrowDomain(
  escrowAddress: string,
  chainId: number
): DomeFeeEscrowDomain {
  const domain = createEIP712Domain(escrowAddress, chainId);
  return {
    name: DOMAIN_NAME as 'DomeFeeEscrow',
    version: DOMAIN_VERSION as '1',
    chainId: domain.chainId as number,
    verifyingContract: domain.verifyingContract as string,
  };
}

/**
 * Get USDC EIP-2612 permit domain
 * USDC.e on Polygon uses legacy domain with salt (chainId as bytes32) instead of chainId
 */
export function getUsdcPermitDomain(chainId: number): {
  name: string;
  version: string;
  verifyingContract: string;
  salt: string;
} {
  const usdcAddress = chainId === POLYGON_CHAIN_ID ? USDC_POLYGON : USDC_AMOY;
  const domain = createPermitDomain(usdcAddress, chainId);
  return {
    name: domain.name as string,
    version: domain.version as string,
    verifyingContract: domain.verifyingContract as string,
    salt: domain.salt as string,
  };
}

/**
 * Calculate fees for a given order size
 * Wrapper around escrow module's calculateFees
 */
export function calculateFees(
  orderSize: bigint,
  domeFeeBps: number = Number(DEFAULT_DOME_FEE_BPS),
  clientFeeBps: number = 0,
  minDomeFee: bigint = DEFAULT_MIN_DOME_FEE
): FeeCalculation {
  return escrowCalculateFees(orderSize, BigInt(clientFeeBps), BigInt(domeFeeBps), minDomeFee);
}

/**
 * Parse USDC amount from number to bigint (6 decimals)
 */
export function parseUsdc(amount: number): bigint {
  // Round to 6 decimals to avoid IEEE-754 floating-point artifacts
  // e.g., 7 * 0.1 = 0.7000000000000001 → 0.700000
  const rounded = Math.round(amount * 1e6) / 1e6;
  return escrowParseUsdc(rounded);
}

/**
 * Format USDC amount from bigint to decimal string (6 decimals)
 */
export function formatUsdc(amount: bigint): string {
  return escrowFormatUsdc(amount);
}

/**
 * Generate a unique order ID from order parameters
 * Uses the escrow module's generateOrderId with compatible params
 */
export function generateOrderId(params: {
  chainId: number;
  userAddress: string;
  marketId: string;
  side: 'buy' | 'sell';
  size: bigint;
  price: number;
  timestamp: number;
  nonce?: number;
}): string {
  return escrowGenerateOrderId({
    chainId: params.chainId,
    userAddress: params.userAddress,
    marketId: params.marketId,
    side: params.side,
    size: params.size,
    price: params.price,
    timestamp: params.timestamp,
  });
}

/**
 * Get escrow contract address for a chain
 */
export function getEscrowAddress(chainId: number): string {
  switch (chainId) {
    case POLYGON_CHAIN_ID:
      return DOME_FEE_ESCROW_POLYGON;
    case AMOY_CHAIN_ID:
      return DOME_FEE_ESCROW_AMOY;
    default:
      throw new Error(`Unsupported chain ID for escrow: ${chainId}`);
  }
}

/**
 * Get USDC token address for a chain
 */
export function getUsdcAddress(chainId: number): string {
  switch (chainId) {
    case POLYGON_CHAIN_ID:
      return USDC_POLYGON;
    case AMOY_CHAIN_ID:
      return USDC_AMOY;
    default:
      throw new Error(`Unsupported chain ID for USDC: ${chainId}`);
  }
}

// ============================================================================
// Polymarket Escrow Router
// ============================================================================

/**
 * Polymarket Router with automatic DomeFeeEscrow integration
 *
 * Extends PolymarketRouter to automatically generate and sign fee
 * authorizations for every order placed.
 *
 * Workflow:
 * 1. User calls placeOrder() with order params
 * 2. Router calculates fee based on order size
 * 3. Router generates unique orderId
 * 4. Router creates fee authorization signature:
 *    - EOA: EIP-2612 permit for gasless USDC approval
 *    - Smart Wallet: EIP-1271 compatible signature (requires prior approve())
 * 5. Router submits order with fee auth to Dome server
 * 6. Server calls DomeFeeEscrow.pullFee() to escrow the fee
 * 7. Server places the order on Polymarket CLOB
 * 8. On fill: Server distributes fee to Dome + client
 * 9. On cancel: Server refunds remaining fee to user
 *
 * @example
 * ```typescript
 * const router = new PolymarketEscrowRouter({
 *   apiKey: 'dome-api-key',
 *   escrow: {
 *     domeFeeBps: 10,      // 0.1% dome fee
 *     clientFeeBps: 25,    // 0.25% affiliate fee
 *     clientAddress: '0x...', // affiliate wallet
 *   },
 * });
 *
 * // Link user (same as PolymarketRouter)
 * await router.linkUser({ userId: 'user-123', signer, walletType: 'eoa' });
 *
 * // Place order with automatic fee escrow
 * const result = await router.placeOrder({
 *   userId: 'user-123',
 *   marketId: '0x...',
 *   side: 'buy',
 *   size: 100,
 *   price: 0.65,
 *   signer,
 * });
 * ```
 */
export class PolymarketEscrowRouter extends PolymarketRouter {
  private readonly escrowConfig: Required<Omit<FeeEscrowConfig, 'escrowAddress'>> & {
    escrowAddress: string;
  };
  private readonly escrowChainId: number;
  private readonly provider: ethers.providers.Provider;

  constructor(config: PolymarketEscrowRouterConfig = {}) {
    super(config);

    this.escrowChainId = config.chainId || POLYGON_CHAIN_ID;
    
    // Default RPC URL based on chain
    const defaultRpcUrl = this.escrowChainId === POLYGON_CHAIN_ID 
      ? 'https://polygon-rpc.com'
      : 'https://rpc-amoy.polygon.technology';
    
    this.provider = new ethers.providers.JsonRpcProvider(
      config.escrow?.rpcUrl || defaultRpcUrl
    );

    // Set escrow defaults (convert bigint constants to number where needed)
    this.escrowConfig = {
      escrowAddress:
        config.escrow?.escrowAddress || getEscrowAddress(this.escrowChainId),
      domeFeeBps: config.escrow?.domeFeeBps ?? Number(DEFAULT_DOME_FEE_BPS),
      minDomeFee: config.escrow?.minDomeFee ?? DEFAULT_MIN_DOME_FEE,
      clientFeeBps: config.escrow?.clientFeeBps ?? 0,
      clientAddress: config.escrow?.clientAddress ?? '0x0000000000000000000000000000000000000000',
      deadlineSeconds: config.escrow?.deadlineSeconds ?? 3600,
      rpcUrl: config.escrow?.rpcUrl || defaultRpcUrl,
    };
  }

  /**
   * Places an order on Polymarket with automatic fee escrow
   *
   * This method:
   * 1. Generates a unique orderId from order parameters
   * 2. Calculates fees based on order size
   * 3. Creates fee authorization signature:
   *    - EOA: EIP-2612 USDC permit (gasless approval)
   *    - Safe: EIP-1271 FeeAuth signature (requires prior approve())
   * 4. Submits the order with fee auth to Dome server
   * 5. Server pulls fee to escrow, then places the order
   *
   * On fill: Server distributes fee to Dome + client
   * On cancel: Server refunds remaining fee to user
   */
  async placeOrder(
    params: PlaceOrderWithEscrowParams,
    credentials?: PolymarketCredentials
  ): Promise<any> {
    
    // Validate API key
    if (!this.isApiKeyConfigured()) {
      throw new Error(
        'Dome API key not set. Pass apiKey to router constructor to use placeOrder.'
      );
    }

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
      orderType = 'GTC',
      domeFeeBps = this.escrowConfig.domeFeeBps,
      clientFeeBps = this.escrowConfig.clientFeeBps,
      clientAddress = this.escrowConfig.clientAddress,
    } = params;

    // Get or create signer
    const actualSigner = this.resolveSignerInternal(signer, privyWalletId, walletAddress);
    if (!actualSigner) {
      throw new Error(
        'Either provide a signer or Privy wallet info (privyWalletId + walletAddress)'
      );
    }

    // Get credentials
    const creds = credentials || this.getCredentials(userId);
    if (!creds) {
      throw new Error(
        `No credentials found for user ${userId}. Call linkUser() first.`
      );
    }

    const signerAddress = await actualSigner.getAddress();

    // Determine payer (who pays the fee)
    let payerAddress: string;
    const isSmartWallet = walletType === 'safe';

    if (isSmartWallet) {
      payerAddress = funderAddress || this.getSafeAddress(userId) || signerAddress;
      if (!funderAddress && !this.getSafeAddress(userId)) {
        throw new Error('funderAddress is required for Safe wallet orders.');
      }
    } else {
      payerAddress = signerAddress;
    }

    // Calculate order size in USDC (6 decimals)
    // Size is in shares, price is 0-1, so USDC cost = size * price
    const orderSizeUsdc = parseUsdc(size * price);

    // Calculate fees
    const fees = calculateFees(
      orderSizeUsdc,
      domeFeeBps,
      clientFeeBps,
      this.escrowConfig.minDomeFee
    );

    // Generate unique orderId
    const timestamp = Date.now();
    const orderId = generateOrderId({
      chainId: this.escrowChainId,
      userAddress: payerAddress,
      marketId,
      side,
      size: orderSizeUsdc,
      price,
      timestamp,
    });

    // Create fee authorization deadline
    const deadline = Math.floor(Date.now() / 1000) + this.escrowConfig.deadlineSeconds;

    // Sign fee authorization
    const feeAuth = await this.signFeeAuthorization({
      orderId,
      payer: payerAddress,
      signer: actualSigner,
      fees,
      orderSize: orderSizeUsdc,
      clientFeeBps,
      deadline,
      isSmartWallet,
      clientAddress,
    });

    // Create signed order using parent's logic
    const signedOrder = await this.createSignedOrderInternal(
      params,
      creds,
      actualSigner,
      signerAddress
    );

    // Generate client order ID
    const clientOrderId =
      (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build request with fee auth
    const request: ServerPlaceOrderWithFeeRequest = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: clientOrderId,
      params: {
        signedOrder,
        orderType,
        credentials: {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          apiPassphrase: creds.apiPassphrase,
        },
        clientOrderId,
        payerAddress,
        signerAddress,
        feeAuth,
      },
    };

    // Submit to Dome server
    const response = await fetch(`${DOME_API_ENDPOINT}/polymarket/placeOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKeyInternal()}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // Ignore
      }
      throw new Error(
        `Server request failed: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`
      );
    }

    const serverResponse: ServerPlaceOrderResponse = await response.json();

    if (serverResponse.error) {
      const reason =
        serverResponse.error.data?.reason || serverResponse.error.message;
      throw new Error(
        `Order placement failed: ${reason} (code: ${serverResponse.error.code})`
      );
    }

    if (!serverResponse.result) {
      throw new Error('Server returned empty result');
    }

    // Check for Polymarket HTTP error
    const result = serverResponse.result as any;
    if (typeof result.status === 'number' && result.status >= 400) {
      const errorMessage =
        result.errorMessage ||
        result.error ||
        `Polymarket returned HTTP ${result.status}`;
      throw new Error(`Order rejected by Polymarket: ${errorMessage}`);
    }

    return serverResponse.result;
  }

  /**
   * Get the current escrow configuration
   */
  getEscrowConfig(): FeeEscrowConfig {
    return { ...this.escrowConfig };
  }

  /**
   * Calculate the fee for an order
   */
  calculateOrderFee(
    size: number,
    price: number,
    domeFeeBps?: number,
    clientFeeBps?: number
  ): FeeCalculation {
    const orderSizeUsdc = parseUsdc(size * price);
    return calculateFees(
      orderSizeUsdc,
      domeFeeBps ?? this.escrowConfig.domeFeeBps,
      clientFeeBps ?? this.escrowConfig.clientFeeBps,
      this.escrowConfig.minDomeFee
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Sign fee authorization based on wallet type
   */
  private async signFeeAuthorization(params: {
    orderId: string;
    payer: string;
    signer: RouterSigner;
    fees: FeeCalculation;
    orderSize: bigint;
    clientFeeBps: number;
    deadline: number;
    isSmartWallet: boolean;
    clientAddress: string;
  }): Promise<SignedFeeAuth> {
    const { orderId, payer, signer, fees, orderSize, clientFeeBps, deadline, isSmartWallet, clientAddress } = params;

    let signature: string;

    if (isSmartWallet) {
      // Smart Wallet: Sign EIP-712 FeeAuth message
      // Contract will verify via EIP-1271 isValidSignature
      const domain = createEIP712Domain(
        this.escrowConfig.escrowAddress,
        this.escrowChainId
      );

      signature = await signer.signTypedData({
        domain,
        types: FEE_AUTH_TYPES,
        primaryType: 'FeeAuth',
        message: {
          orderId,
          payer,
          amount: fees.totalFee.toString(),
          deadline,
        },
      });
    } else {
      // EOA: Sign EIP-2612 USDC permit
      // This allows gasless approval for the escrow contract to pull USDC
      const permitDomain = getUsdcPermitDomain(this.escrowChainId);
      
      // Fetch the actual nonce from the USDC contract
      const usdcAddress = getUsdcAddress(this.escrowChainId);
      const nonce = await getPermitNonce(this.provider, usdcAddress, payer);

      signature = await signer.signTypedData({
        domain: permitDomain,
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message: {
          owner: payer,
          spender: this.escrowConfig.escrowAddress,
          value: fees.totalFee.toString(),
          nonce: nonce.toString(),
          deadline: deadline.toString(),
        },
      });

      // Return with nonce for EOA permits
      return {
        orderId,
        payer,
        orderSize: orderSize.toString(),
        clientFeeBps,
        feeAmount: fees.totalFee.toString(),
        domeFee: fees.domeFee.toString(),
        clientFee: fees.clientFee.toString(),
        deadline,
        signature,
        isSmartWallet,
        client: clientAddress,
        permitNonce: nonce.toString(),
      };
    }

    // Smart wallet path (no permit nonce needed)
    return {
      orderId,
      payer,
      orderSize: orderSize.toString(),
      clientFeeBps,
      feeAmount: fees.totalFee.toString(),
      domeFee: fees.domeFee.toString(),
      clientFee: fees.clientFee.toString(),
      deadline,
      signature,
      isSmartWallet,
      client: clientAddress,
    };
  }

  /**
   * Resolve signer from params (internal helper)
   */
  private resolveSignerInternal(
    signer?: RouterSigner,
    privyWalletId?: string,
    walletAddress?: string
  ): RouterSigner | undefined {
    if (signer) return signer;
    return undefined;
  }

  /**
   * Get API key (internal helper)
   */
  private getApiKeyInternal(): string {
    // Access the parent's apiKey through the public method
    if (!this.isApiKeyConfigured()) {
      throw new Error('API key not configured');
    }
    return (this as any).apiKey;
  }

  /**
   * Create signed order (internal helper that mirrors parent logic)
   */
  private async createSignedOrderInternal(
    params: PlaceOrderParams,
    creds: PolymarketCredentials,
    signer: RouterSigner,
    signerAddress: string
  ): Promise<SignedPolymarketOrder> {
    const {
      marketId,
      side,
      size,
      price,
      walletType = 'eoa',
      funderAddress,
      userId,
      negRisk = false,
    } = params;

    // Determine signature type and funder
    let signatureType: number;
    let funder: string;

    if (walletType === 'safe') {
      signatureType = 2;
      funder = funderAddress || this.getSafeAddress(userId) || signerAddress;
    } else {
      signatureType = 0;
      funder = signerAddress;
    }

    // Create ethers adapter
    const ethersAdapter = {
      getAddress: async () => signerAddress,
      _signTypedData: async (domain: any, types: any, value: any) => {
        return await signer.signTypedData({
          domain,
          types,
          primaryType:
            Object.keys(types).find((key: string) => key !== 'EIP712Domain') || '',
          message: value,
        });
      },
    };

    const apiKeyCreds = {
      key: creds.apiKey,
      secret: creds.apiSecret,
      passphrase: creds.apiPassphrase,
    };

    // Dynamic imports to avoid circular deps
    const { ClobClient } = await import('@polymarket/clob-client');
    const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');

    const builderConfig = new BuilderConfig({
      remoteBuilderConfig: {
        url: 'https://builder-signer.domeapi.io/builder-signer/sign',
      },
    });

    const userClobClient = new ClobClient(
      'https://clob.polymarket.com',
      this.escrowChainId,
      ethersAdapter as any,
      apiKeyCreds,
      signatureType,
      funder,
      undefined,
      false,
      builderConfig
    );

    const orderSide = side.toLowerCase() === 'buy' ? 'BUY' : 'SELL';

    const signedOrder = await userClobClient.createOrder(
      {
        tokenID: marketId,
        price,
        size,
        side: orderSide as any,
      },
      { negRisk }
    );

    return {
      salt: signedOrder.salt,
      maker: signedOrder.maker,
      signer: signedOrder.signer,
      taker: signedOrder.taker,
      tokenId: signedOrder.tokenId,
      makerAmount: signedOrder.makerAmount,
      takerAmount: signedOrder.takerAmount,
      expiration: signedOrder.expiration,
      nonce: signedOrder.nonce,
      feeRateBps: signedOrder.feeRateBps,
      side: orderSide as 'BUY' | 'SELL',
      signatureType: signedOrder.signatureType,
      signature: signedOrder.signature,
    };
  }
}
