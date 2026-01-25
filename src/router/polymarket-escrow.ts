/**
 * Polymarket Router with Fee Escrow
 *
 * Drop-in replacement for PolymarketRouter that automatically handles
 * fee escrow for every order. Users simply swap the class name:
 *
 * Before: const router = new PolymarketRouter({ apiKey });
 * After:  const router = new PolymarketRouterWithEscrow({ apiKey, escrow: { ... } });
 *
 * The router will:
 * 1. Generate a unique orderId for each order
 * 2. Create and sign a fee authorization (EIP-712)
 * 3. Include the signed fee auth in the order request
 * 4. The Dome server then pulls the fee to escrow before placing the order
 */

import * as crypto from 'crypto';
import { ethers, Wallet } from 'ethers';
import { PolymarketRouter } from './polymarket.js';
import {
  PlaceOrderParams,
  PolymarketCredentials,
  PolymarketRouterConfig,
  ServerPlaceOrderRequest,
  ServerPlaceOrderResponse,
  SignedPolymarketOrder,
} from '../types.js';
import {
  generateOrderId,
  parseUsdc,
  calculateFee,
  ESCROW_CONTRACT_V2_POLYGON,
  ORDER_FEE_TYPES,
  createDomeFeeEscrowEIP712Domain,
  MIN_ORDER_FEE,
} from '../escrow/index.js';

// Dome API endpoint
const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

/**
 * Escrow configuration for the router
 */
export interface EscrowConfig {
  /** Fee in basis points (e.g., 25 = 0.25%). Default: 25 */
  feeBps?: number;
  /** Escrow contract address. Default: Polygon mainnet contract */
  escrowAddress?: string;
  /** Chain ID. Default: 137 (Polygon) */
  chainId?: number;
  /** Affiliate address for fee sharing (optional) */
  affiliate?: string;
  /** Deadline for fee authorization in seconds. Default: 3600 (1 hour) */
  deadlineSeconds?: number;
}

/**
 * Extended router config with escrow settings
 */
export interface PolymarketRouterWithEscrowConfig extends PolymarketRouterConfig {
  escrow?: EscrowConfig;
}

/**
 * Extended place order params with escrow options
 */
export interface PlaceOrderWithEscrowParams extends PlaceOrderParams {
  /** Override fee basis points for this order */
  feeBps?: number;
  /** Override affiliate for this order */
  affiliate?: string;
  /** Skip fee escrow for this order */
  skipEscrow?: boolean;
}

/**
 * Polymarket Router with automatic fee escrow
 *
 * Extends PolymarketRouter to automatically generate and sign fee
 * authorizations for every order placed.
 */
export class PolymarketRouterWithEscrow extends PolymarketRouter {
  private readonly escrowConfig: Required<EscrowConfig>;

  constructor(config: PolymarketRouterWithEscrowConfig = {}) {
    super(config);

    // Set escrow defaults (V2 contract)
    this.escrowConfig = {
      feeBps: config.escrow?.feeBps ?? 25, // 0.25%
      escrowAddress: config.escrow?.escrowAddress ?? ESCROW_CONTRACT_V2_POLYGON,
      chainId: config.escrow?.chainId ?? 137,
      affiliate: config.escrow?.affiliate ?? ethers.constants.AddressZero,
      deadlineSeconds: config.escrow?.deadlineSeconds ?? 3600,
    };
  }

  /**
   * Places an order on Polymarket with automatic fee escrow
   *
   * This method:
   * 1. Generates a unique orderId from order parameters
   * 2. Creates and signs a fee authorization (EIP-712)
   * 3. Submits the order with fee auth to Dome server
   * 4. Server pulls fee to escrow, then places the order
   *
   * On fill: Server distributes fee to Dome + affiliate
   * On cancel: Server refunds remaining fee to user
   */
  async placeOrder(
    params: PlaceOrderWithEscrowParams,
    credentials?: PolymarketCredentials
  ): Promise<any> {
    // If skipEscrow is true, use parent implementation
    if (params.skipEscrow) {
      return super.placeOrder(params, credentials);
    }

    // We need to override the entire placeOrder to inject fee auth
    // This duplicates some logic from parent, but is necessary for the integration

    const apiKey = this.getApiKey();
    if (!apiKey) {
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
      feeBps = this.escrowConfig.feeBps,
      affiliate = this.escrowConfig.affiliate,
    } = params;

    // Get or create signer
    const actualSigner = this.getOrCreateSigner(params);
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

    // Determine funder (payer for escrow)
    let payerAddress: string;
    if (walletType === 'safe') {
      payerAddress =
        funderAddress || this.getSafeAddress(userId) || signerAddress;
      if (!funderAddress && !this.getSafeAddress(userId)) {
        throw new Error('funderAddress is required for Safe wallet orders.');
      }
    } else {
      payerAddress = signerAddress;
    }

    // Calculate order size in USDC (6 decimals)
    // Size is in shares, price is 0-1, so USDC cost = size * price
    const orderSizeUsdc = parseUsdc(size * price);
    const totalFee = calculateFee(orderSizeUsdc, BigInt(feeBps));

    // V2: Split fee between dome and affiliate
    // If affiliate specified: 80% dome, 20% affiliate
    // Otherwise: 100% dome
    let domeAmount: bigint;
    let affiliateAmount: bigint;

    if (affiliate !== ethers.constants.AddressZero) {
      // 80/20 split
      affiliateAmount = (totalFee * BigInt(20)) / BigInt(100);
      domeAmount = totalFee - affiliateAmount;
    } else {
      domeAmount = totalFee;
      affiliateAmount = BigInt(0);
    }

    // Ensure minimum fee is met
    if (domeAmount + affiliateAmount < MIN_ORDER_FEE) {
      domeAmount = MIN_ORDER_FEE;
    }

    // Generate unique orderId
    const timestamp = Date.now();
    const orderId = generateOrderId({
      chainId: this.escrowConfig.chainId,
      userAddress: payerAddress,
      marketId,
      side,
      size: orderSizeUsdc,
      price,
      timestamp,
    });

    // Create V2 order fee authorization
    const deadline =
      Math.floor(Date.now() / 1000) + this.escrowConfig.deadlineSeconds;

    const orderFeeAuth = {
      orderId,
      payer: payerAddress,
      domeAmount,
      affiliateAmount,
      chainId: this.escrowConfig.chainId,
      deadline,
    };

    // Sign V2 fee authorization using EIP-712
    const domain = createDomeFeeEscrowEIP712Domain(
      this.escrowConfig.escrowAddress,
      this.escrowConfig.chainId
    );

    const signature = await actualSigner.signTypedData({
      domain,
      types: ORDER_FEE_TYPES,
      primaryType: 'OrderFeeAuthorization',
      message: {
        orderId: orderFeeAuth.orderId,
        payer: orderFeeAuth.payer,
        domeAmount: orderFeeAuth.domeAmount.toString(),
        affiliateAmount: orderFeeAuth.affiliateAmount.toString(),
        chainId: orderFeeAuth.chainId,
        deadline: orderFeeAuth.deadline,
      },
    });

    // Create signed order using parent's CLOB client logic
    const signedOrder = await this.createSignedOrder(params, creds);

    // Build request with fee auth
    // clientOrderId must be a valid UUID per Dome API requirements
    const clientOrderId = crypto.randomUUID();

    const request: ServerPlaceOrderRequest = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: clientOrderId,
      params: {
        // Required for escrow: identify payer and signer
        payerAddress,
        signerAddress,
        signedOrder,
        orderType,
        credentials: {
          apiKey: creds.apiKey,
          apiSecret: creds.apiSecret,
          apiPassphrase: creds.apiPassphrase,
        },
        clientOrderId,
        orderFeeAuth: {
          orderId: orderFeeAuth.orderId,
          payer: orderFeeAuth.payer,
          domeAmount: orderFeeAuth.domeAmount.toString(),
          affiliateAmount: orderFeeAuth.affiliateAmount.toString(),
          chainId: orderFeeAuth.chainId,
          deadline: orderFeeAuth.deadline,
          signature,
        },
        ...(affiliate !== ethers.constants.AddressZero && { affiliate }),
      },
    };

    // Submit to Dome server
    const response = await fetch(`${DOME_API_ENDPOINT}/polymarket/placeOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
   * Get the escrow configuration
   */
  getEscrowConfig(): Required<EscrowConfig> {
    return { ...this.escrowConfig };
  }

  /**
   * Calculate the fee for an order
   */
  calculateOrderFee(size: number, price: number, feeBps?: number): bigint {
    const orderSizeUsdc = parseUsdc(size * price);
    return calculateFee(
      orderSizeUsdc,
      BigInt(feeBps ?? this.escrowConfig.feeBps)
    );
  }

  // Protected helper methods that need to be accessible

  protected getApiKey(): string | undefined {
    // Access the private apiKey from parent
    // TypeScript doesn't allow direct access, so we use a workaround
    return (this as any).apiKey;
  }

  protected getOrCreateSigner(params: PlaceOrderParams): any {
    const { signer, privyWalletId, walletAddress } = params;
    if (signer) return signer;
    if (privyWalletId && walletAddress) {
      return (this as any).createPrivySignerFromWallet(
        privyWalletId,
        walletAddress
      );
    }
    return undefined;
  }

  protected async createSignedOrder(
    params: PlaceOrderParams,
    creds: PolymarketCredentials
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

    const actualSigner = this.getOrCreateSigner(params);
    const signerAddress = await actualSigner.getAddress();

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
        return await actualSigner.signTypedData({
          domain,
          types,
          primaryType:
            Object.keys(types).find(key => key !== 'EIP712Domain') || '',
          message: value,
        });
      },
    };

    const apiKeyCreds = {
      key: creds.apiKey,
      secret: creds.apiSecret,
      passphrase: creds.apiPassphrase,
    };

    // Import ClobClient dynamically to avoid circular deps
    const { ClobClient } = await import('@polymarket/clob-client');
    const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');

    const builderConfig = new BuilderConfig({
      remoteBuilderConfig: {
        url: 'https://builder-signer.domeapi.io/builder-signer/sign',
      },
    });

    const userClobClient = new ClobClient(
      'https://clob.polymarket.com',
      this.escrowConfig.chainId,
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
