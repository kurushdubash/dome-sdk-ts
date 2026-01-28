/**
 * DomeFeeEscrow Client for Dome SDK
 *
 * Provides EIP-712 signing and contract interaction for the DomeFeeEscrow contract.
 * Supports both order fees and performance fees with independent Dome and Affiliate amounts.
 *
 * Key features:
 * - Two independent fee types: ORDER and PERFORMANCE
 * - Independent Dome and Affiliate fees (not a split of one fee)
 * - ChainId in EIP-712 signatures for cross-chain replay protection
 * - Support for both EOA wallets and Smart Contract wallets (EIP-1271)
 *
 * @example
 * ```typescript
 * import { DomeFeeEscrowClient } from '@dome-api/sdk';
 * import { ethers } from 'ethers';
 *
 * const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
 * const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
 *
 * const client = new DomeFeeEscrowClient({
 *   provider,
 *   signer: wallet,
 *   contractAddress: DOME_ESCROW_ADDRESS,
 *   chainId: 137, // Polygon
 * });
 *
 * // Sign order fee authorization
 * const { auth, signature } = await client.signOrderFeeAuth({
 *   orderId: '0x...',
 *   domeAmount: parseUsdc(0.50),
 *   affiliateAmount: parseUsdc(0.10),
 * });
 * ```
 */

import { ethers, Wallet } from 'ethers';

// ============ Constants ============

/**
 * EIP-712 Domain name for DomeFeeEscrow contract
 */
export const DOMAIN_NAME = 'DomeFeeEscrow';

/**
 * EIP-712 Domain version for DomeFeeEscrow contract
 */
export const DOMAIN_VERSION = '1';

/**
 * Minimum order fee in USDC (6 decimals) - $0.01
 */
export const MIN_ORDER_FEE = BigInt(10_000);

/**
 * Minimum performance fee in USDC (6 decimals) - $0.10
 */
export const MIN_PERFORMANCE_FEE = BigInt(100_000);

/**
 * Maximum absolute fee in USDC (6 decimals) - $10,000
 */
export const MAX_FEE_ABSOLUTE = BigInt(10_000_000_000);

/**
 * Maximum order fee in basis points (1% = 100 bps)
 */
export const MAX_ORDER_FEE_BPS = 100;

/**
 * Maximum performance fee in basis points (10% = 1000 bps)
 */
export const MAX_PERFORMANCE_FEE_BPS = 1000;

/**
 * Escrow timeout for user withdrawal (7 days in seconds)
 */
export const ESCROW_TIMEOUT_SECONDS = 7 * 24 * 60 * 60;

// ============ Types ============

/**
 * Fee type enum matching the contract
 */
export enum FeeType {
  ORDER = 0,
  PERFORMANCE = 1,
}

/**
 * Order fee authorization struct for EIP-712 signing
 */
export interface OrderFeeAuthorization {
  /** Unique order identifier (bytes32) */
  orderId: string;
  /** Address that will pay the fee (EOA or SAFE) */
  payer: string;
  /** Dome's fee amount in USDC (6 decimals) */
  domeAmount: bigint;
  /** Affiliate's fee amount in USDC (6 decimals) */
  affiliateAmount: bigint;
  /** Chain ID for cross-chain replay protection */
  chainId: number;
  /** Unix timestamp after which signature is invalid */
  deadline: number;
}

/**
 * Performance fee authorization struct for EIP-712 signing
 */
export interface PerformanceFeeAuthorization {
  /** Position identifier (bytes32) */
  positionId: string;
  /** Address that will pay the fee (EOA or SAFE) */
  payer: string;
  /** Expected winnings amount in USDC (6 decimals) */
  expectedWinnings: bigint;
  /** Dome's fee amount in USDC (6 decimals) */
  domeAmount: bigint;
  /** Affiliate's fee amount in USDC (6 decimals) */
  affiliateAmount: bigint;
  /** Chain ID for cross-chain replay protection */
  chainId: number;
  /** Unix timestamp after which signature is invalid */
  deadline: number;
}

/**
 * Signed order fee authorization
 */
export interface SignedOrderFeeAuth extends OrderFeeAuthorization {
  /** EIP-712 signature (65 bytes packed) */
  signature: string;
}

/**
 * Signed performance fee authorization
 */
export interface SignedPerformanceFeeAuth extends PerformanceFeeAuthorization {
  /** EIP-712 signature (65 bytes packed) */
  signature: string;
}

/**
 * Escrow status returned from getEscrowStatus
 */
export interface EscrowStatus {
  payer: string;
  affiliate: string;
  orderFeeDomeAmount: bigint;
  orderFeeAffiliateAmount: bigint;
  perfFeeDomeAmount: bigint;
  perfFeeAffiliateAmount: bigint;
  isComplete: boolean;
  timeUntilWithdraw: number;
}

/**
 * Remaining escrow amounts returned from getRemainingEscrow
 */
export interface RemainingEscrow {
  orderFeeDomeRemaining: bigint;
  orderFeeAffiliateRemaining: bigint;
  perfFeeDomeRemaining: bigint;
  perfFeeAffiliateRemaining: bigint;
  totalRemaining: bigint;
}

/**
 * Fee calculation result
 */
export interface FeeCalculation {
  domeFee: bigint;
  affiliateFee: bigint;
  totalFee: bigint;
}

/**
 * Client configuration options
 */
export interface DomeFeeEscrowClientConfig {
  /** Ethers provider for contract reads */
  provider: ethers.providers.Provider;
  /** Signer for signing authorizations (optional, required for signing) */
  signer?: ethers.Signer;
  /** DomeFeeEscrow contract address */
  contractAddress: string;
  /** Chain ID (default: 137 for Polygon) */
  chainId?: number;
}

/**
 * Generic signer interface compatible with RouterSigner
 */
export interface TypedDataSigner {
  getAddress(): Promise<string>;
  signTypedData(params: {
    domain: ethers.TypedDataDomain;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
}

// ============ EIP-712 Type Definitions ============

/**
 * EIP-712 types for OrderFeeAuthorization
 */
export const ORDER_FEE_TYPES = {
  OrderFeeAuthorization: [
    { name: 'orderId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'domeAmount', type: 'uint256' },
    { name: 'affiliateAmount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/**
 * EIP-712 types for PerformanceFeeAuthorization
 */
export const PERFORMANCE_FEE_TYPES = {
  PerformanceFeeAuthorization: [
    { name: 'positionId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'expectedWinnings', type: 'uint256' },
    { name: 'domeAmount', type: 'uint256' },
    { name: 'affiliateAmount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

// ============ Contract ABI (minimal for view functions) ============

const DOME_ESCROW_ABI = [
  // View functions
  'function getEscrowStatus(bytes32 orderId) external view returns (address payer, address affiliate, uint256 orderFeeDomeAmount, uint256 orderFeeAffiliateAmount, uint256 perfFeeDomeAmount, uint256 perfFeeAffiliateAmount, bool isComplete, uint256 timeUntilWithdraw)',
  'function getRemainingEscrow(bytes32 orderId) external view returns (uint256 orderFeeDomeRemaining, uint256 orderFeeAffiliateRemaining, uint256 perfFeeDomeRemaining, uint256 perfFeeAffiliateRemaining, uint256 totalRemaining)',
  'function calculateOrderFees(uint256 orderSize, uint256 domeFeeBps, uint256 affiliateFeeBps) external pure returns (uint256 domeFee, uint256 affiliateFee, uint256 totalFee)',
  'function calculatePerformanceFees(uint256 winnings, uint256 domeFeeBps, uint256 affiliateFeeBps) external pure returns (uint256 domeFee, uint256 affiliateFee, uint256 totalFee)',
  'function DOMAIN_SEPARATOR() external view returns (bytes32)',
  'function domeWallet() external view returns (address)',
  // Constants
  'function MIN_ORDER_FEE() external pure returns (uint256)',
  'function MIN_PERF_FEE() external pure returns (uint256)',
  'function MAX_FEE_ABSOLUTE() external pure returns (uint256)',
  'function MAX_ORDER_FEE_BPS() external pure returns (uint256)',
  'function MAX_PERF_FEE_BPS() external pure returns (uint256)',
  'function ESCROW_TIMEOUT() external pure returns (uint256)',
];

// ============ Deadline bounds ============

const MIN_DEADLINE_SECONDS = 60; // 1 minute
const MAX_DEADLINE_SECONDS = 86400; // 24 hours
const DEFAULT_DEADLINE_SECONDS = 3600; // 1 hour

// ============ Helper Functions ============

/**
 * Create EIP-712 domain for DomeFeeEscrow contract
 */
export function createDomeFeeEscrowEIP712Domain(
  contractAddress: string,
  chainId: number
): ethers.TypedDataDomain {
  if (!ethers.utils.isAddress(contractAddress)) {
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }

  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract: contractAddress,
  };
}

/**
 * Validate deadline seconds
 */
function validateDeadline(deadlineSeconds: number): void {
  if (deadlineSeconds < MIN_DEADLINE_SECONDS) {
    throw new Error(
      `Deadline too short: ${deadlineSeconds}s. Minimum: ${MIN_DEADLINE_SECONDS}s`
    );
  }
  if (deadlineSeconds > MAX_DEADLINE_SECONDS) {
    throw new Error(
      `Deadline too long: ${deadlineSeconds}s. Maximum: ${MAX_DEADLINE_SECONDS}s`
    );
  }
}

/**
 * Validate fee amounts for order fee
 */
function validateOrderFeeAmounts(
  domeAmount: bigint,
  affiliateAmount: bigint
): void {
  const totalFee = domeAmount + affiliateAmount;

  if (totalFee === BigInt(0)) {
    throw new Error('Total fee cannot be zero');
  }
  if (totalFee < MIN_ORDER_FEE) {
    throw new Error(
      `Total fee too low: ${totalFee}. Minimum: ${MIN_ORDER_FEE} ($0.01)`
    );
  }
  if (totalFee > MAX_FEE_ABSOLUTE) {
    throw new Error(
      `Total fee too high: ${totalFee}. Maximum: ${MAX_FEE_ABSOLUTE} ($10,000)`
    );
  }
}

/**
 * Validate fee amounts for performance fee
 */
function validatePerformanceFeeAmounts(
  domeAmount: bigint,
  affiliateAmount: bigint
): void {
  const totalFee = domeAmount + affiliateAmount;

  if (totalFee === BigInt(0)) {
    throw new Error('Total fee cannot be zero');
  }
  if (totalFee < MIN_PERFORMANCE_FEE) {
    throw new Error(
      `Total fee too low: ${totalFee}. Minimum: ${MIN_PERFORMANCE_FEE} ($0.10)`
    );
  }
  if (totalFee > MAX_FEE_ABSOLUTE) {
    throw new Error(
      `Total fee too high: ${totalFee}. Maximum: ${MAX_FEE_ABSOLUTE} ($10,000)`
    );
  }
}

// ============ DomeFeeEscrowClient Class ============

/**
 * Client for interacting with the DomeFeeEscrow contract
 *
 * Provides methods for:
 * - Signing order fee authorizations
 * - Signing performance fee authorizations
 * - Calculating fees
 * - Querying escrow status
 */
export class DomeFeeEscrowClient {
  private readonly provider: ethers.providers.Provider;
  private readonly signer: ethers.Signer | undefined;
  private readonly contractAddress: string;
  private readonly chainId: number;
  private readonly contract: ethers.Contract;

  /**
   * Create a new DomeFeeEscrowClient
   *
   * @param config - Client configuration
   */
  constructor(config: DomeFeeEscrowClientConfig) {
    if (!ethers.utils.isAddress(config.contractAddress)) {
      throw new Error(`Invalid contract address: ${config.contractAddress}`);
    }

    this.provider = config.provider;
    this.signer = config.signer ?? undefined;
    this.contractAddress = ethers.utils.getAddress(config.contractAddress);
    this.chainId = config.chainId ?? 137; // Default to Polygon

    this.contract = new ethers.Contract(
      this.contractAddress,
      DOME_ESCROW_ABI,
      this.provider
    );
  }

  // ============ Order Fee Authorization ============

  /**
   * Sign an order fee authorization
   *
   * @param params - Order fee parameters
   * @returns Signed authorization with signature
   *
   * @example
   * ```typescript
   * const { auth, signature } = await client.signOrderFeeAuth({
   *   orderId: '0x...',
   *   domeAmount: parseUsdc(0.50),
   *   affiliateAmount: parseUsdc(0.10),
   *   deadline: 3600, // 1 hour (optional)
   * });
   * ```
   */
  async signOrderFeeAuth(params: {
    orderId: string;
    domeAmount: bigint;
    affiliateAmount: bigint;
    deadline?: number;
  }): Promise<{ auth: OrderFeeAuthorization; signature: string }> {
    if (!this.signer) {
      throw new Error('Signer required for signing authorizations');
    }

    const deadlineSeconds = params.deadline ?? DEFAULT_DEADLINE_SECONDS;
    validateDeadline(deadlineSeconds);
    validateOrderFeeAmounts(params.domeAmount, params.affiliateAmount);

    const payerAddress = await this.signer.getAddress();
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const auth: OrderFeeAuthorization = {
      orderId: params.orderId,
      payer: ethers.utils.getAddress(payerAddress),
      domeAmount: params.domeAmount,
      affiliateAmount: params.affiliateAmount,
      chainId: this.chainId,
      deadline,
    };

    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      orderId: auth.orderId,
      payer: auth.payer,
      domeAmount: auth.domeAmount,
      affiliateAmount: auth.affiliateAmount,
      chainId: auth.chainId,
      deadline: auth.deadline,
    };

    // Use _signTypedData for ethers.Wallet
    if ('_signTypedData' in this.signer) {
      const wallet = this.signer as Wallet;
      const signature = await wallet._signTypedData(
        domain,
        ORDER_FEE_TYPES,
        message
      );
      return { auth, signature };
    }

    throw new Error(
      'Signer does not support _signTypedData. Use signOrderFeeAuthWithSigner for generic signers.'
    );
  }

  /**
   * Sign an order fee authorization using a generic TypedDataSigner
   *
   * Use this when working with RouterSigner (Privy, MetaMask, etc.)
   *
   * @param signer - TypedDataSigner compatible signer
   * @param params - Order fee parameters
   * @returns Signed authorization with signature
   */
  async signOrderFeeAuthWithSigner(
    signer: TypedDataSigner,
    params: {
      orderId: string;
      domeAmount: bigint;
      affiliateAmount: bigint;
      deadline?: number;
    }
  ): Promise<{ auth: OrderFeeAuthorization; signature: string }> {
    const deadlineSeconds = params.deadline ?? DEFAULT_DEADLINE_SECONDS;
    validateDeadline(deadlineSeconds);
    validateOrderFeeAmounts(params.domeAmount, params.affiliateAmount);

    const payerAddress = await signer.getAddress();
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const auth: OrderFeeAuthorization = {
      orderId: params.orderId,
      payer: ethers.utils.getAddress(payerAddress),
      domeAmount: params.domeAmount,
      affiliateAmount: params.affiliateAmount,
      chainId: this.chainId,
      deadline,
    };

    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      orderId: auth.orderId,
      payer: auth.payer,
      domeAmount: auth.domeAmount.toString(),
      affiliateAmount: auth.affiliateAmount.toString(),
      chainId: auth.chainId.toString(),
      deadline: auth.deadline.toString(),
    };

    const signature = await signer.signTypedData({
      domain,
      types: ORDER_FEE_TYPES,
      primaryType: 'OrderFeeAuthorization',
      message,
    });

    return { auth, signature };
  }

  // ============ Performance Fee Authorization ============

  /**
   * Sign a performance fee authorization
   *
   * @param params - Performance fee parameters
   * @returns Signed authorization with signature
   *
   * @example
   * ```typescript
   * const { auth, signature } = await client.signPerformanceFeeAuth({
   *   positionId: '0x...',
   *   expectedWinnings: parseUsdc(1000),
   *   domeAmount: parseUsdc(25),
   *   affiliateAmount: parseUsdc(5),
   *   deadline: 3600, // 1 hour (optional)
   * });
   * ```
   */
  async signPerformanceFeeAuth(params: {
    positionId: string;
    expectedWinnings: bigint;
    domeAmount: bigint;
    affiliateAmount: bigint;
    deadline?: number;
  }): Promise<{ auth: PerformanceFeeAuthorization; signature: string }> {
    if (!this.signer) {
      throw new Error('Signer required for signing authorizations');
    }

    const deadlineSeconds = params.deadline ?? DEFAULT_DEADLINE_SECONDS;
    validateDeadline(deadlineSeconds);
    validatePerformanceFeeAmounts(params.domeAmount, params.affiliateAmount);

    const payerAddress = await this.signer.getAddress();
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const auth: PerformanceFeeAuthorization = {
      positionId: params.positionId,
      payer: ethers.utils.getAddress(payerAddress),
      expectedWinnings: params.expectedWinnings,
      domeAmount: params.domeAmount,
      affiliateAmount: params.affiliateAmount,
      chainId: this.chainId,
      deadline,
    };

    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      positionId: auth.positionId,
      payer: auth.payer,
      expectedWinnings: auth.expectedWinnings,
      domeAmount: auth.domeAmount,
      affiliateAmount: auth.affiliateAmount,
      chainId: auth.chainId,
      deadline: auth.deadline,
    };

    // Use _signTypedData for ethers.Wallet
    if ('_signTypedData' in this.signer) {
      const wallet = this.signer as Wallet;
      const signature = await wallet._signTypedData(
        domain,
        PERFORMANCE_FEE_TYPES,
        message
      );
      return { auth, signature };
    }

    throw new Error(
      'Signer does not support _signTypedData. Use signPerformanceFeeAuthWithSigner for generic signers.'
    );
  }

  /**
   * Sign a performance fee authorization using a generic TypedDataSigner
   *
   * Use this when working with RouterSigner (Privy, MetaMask, etc.)
   *
   * @param signer - TypedDataSigner compatible signer
   * @param params - Performance fee parameters
   * @returns Signed authorization with signature
   */
  async signPerformanceFeeAuthWithSigner(
    signer: TypedDataSigner,
    params: {
      positionId: string;
      expectedWinnings: bigint;
      domeAmount: bigint;
      affiliateAmount: bigint;
      deadline?: number;
    }
  ): Promise<{ auth: PerformanceFeeAuthorization; signature: string }> {
    const deadlineSeconds = params.deadline ?? DEFAULT_DEADLINE_SECONDS;
    validateDeadline(deadlineSeconds);
    validatePerformanceFeeAmounts(params.domeAmount, params.affiliateAmount);

    const payerAddress = await signer.getAddress();
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const auth: PerformanceFeeAuthorization = {
      positionId: params.positionId,
      payer: ethers.utils.getAddress(payerAddress),
      expectedWinnings: params.expectedWinnings,
      domeAmount: params.domeAmount,
      affiliateAmount: params.affiliateAmount,
      chainId: this.chainId,
      deadline,
    };

    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      positionId: auth.positionId,
      payer: auth.payer,
      expectedWinnings: auth.expectedWinnings.toString(),
      domeAmount: auth.domeAmount.toString(),
      affiliateAmount: auth.affiliateAmount.toString(),
      chainId: auth.chainId.toString(),
      deadline: auth.deadline.toString(),
    };

    const signature = await signer.signTypedData({
      domain,
      types: PERFORMANCE_FEE_TYPES,
      primaryType: 'PerformanceFeeAuthorization',
      message,
    });

    return { auth, signature };
  }

  // ============ Fee Calculation ============

  /**
   * Calculate order fees using the contract's calculation logic
   *
   * @param orderSize - Order size in USDC (6 decimals)
   * @param domeFeeBps - Dome's fee rate in basis points
   * @param affiliateFeeBps - Affiliate's fee rate in basis points
   * @returns Fee amounts for Dome, Affiliate, and Total
   *
   * @example
   * ```typescript
   * const fees = await client.calculateOrderFees(
   *   parseUsdc(100),  // $100 order
   *   50,              // 0.50% dome fee
   *   10               // 0.10% affiliate fee
   * );
   * console.log(`Total fee: $${formatUsdc(fees.totalFee)}`);
   * ```
   */
  async calculateOrderFees(
    orderSize: bigint,
    domeFeeBps: number,
    affiliateFeeBps: number
  ): Promise<FeeCalculation> {
    if (domeFeeBps > MAX_ORDER_FEE_BPS) {
      throw new Error(
        `Dome fee BPS too high: ${domeFeeBps}. Maximum: ${MAX_ORDER_FEE_BPS}`
      );
    }
    if (affiliateFeeBps > MAX_ORDER_FEE_BPS) {
      throw new Error(
        `Affiliate fee BPS too high: ${affiliateFeeBps}. Maximum: ${MAX_ORDER_FEE_BPS}`
      );
    }

    const result = await this.contract.calculateOrderFees(
      orderSize,
      domeFeeBps,
      affiliateFeeBps
    );

    return {
      domeFee: BigInt(result.domeFee.toString()),
      affiliateFee: BigInt(result.affiliateFee.toString()),
      totalFee: BigInt(result.totalFee.toString()),
    };
  }

  /**
   * Calculate performance fees using the contract's calculation logic
   *
   * @param winnings - Winnings amount in USDC (6 decimals)
   * @param domeFeeBps - Dome's fee rate in basis points
   * @param affiliateFeeBps - Affiliate's fee rate in basis points
   * @returns Fee amounts for Dome, Affiliate, and Total
   *
   * @example
   * ```typescript
   * const fees = await client.calculatePerformanceFees(
   *   parseUsdc(1000),  // $1000 winnings
   *   250,              // 2.50% dome fee
   *   50                // 0.50% affiliate fee
   * );
   * console.log(`Total fee: $${formatUsdc(fees.totalFee)}`);
   * ```
   */
  async calculatePerformanceFees(
    winnings: bigint,
    domeFeeBps: number,
    affiliateFeeBps: number
  ): Promise<FeeCalculation> {
    if (domeFeeBps > MAX_PERFORMANCE_FEE_BPS) {
      throw new Error(
        `Dome fee BPS too high: ${domeFeeBps}. Maximum: ${MAX_PERFORMANCE_FEE_BPS}`
      );
    }
    if (affiliateFeeBps > MAX_PERFORMANCE_FEE_BPS) {
      throw new Error(
        `Affiliate fee BPS too high: ${affiliateFeeBps}. Maximum: ${MAX_PERFORMANCE_FEE_BPS}`
      );
    }

    const result = await this.contract.calculatePerformanceFees(
      winnings,
      domeFeeBps,
      affiliateFeeBps
    );

    return {
      domeFee: BigInt(result.domeFee.toString()),
      affiliateFee: BigInt(result.affiliateFee.toString()),
      totalFee: BigInt(result.totalFee.toString()),
    };
  }

  /**
   * Calculate order fees locally (without contract call)
   *
   * Use this for quick estimates. For final calculations, use calculateOrderFees().
   *
   * @param orderSize - Order size in USDC (6 decimals)
   * @param domeFeeBps - Dome's fee rate in basis points
   * @param affiliateFeeBps - Affiliate's fee rate in basis points
   * @returns Fee amounts for Dome, Affiliate, and Total
   */
  calculateOrderFeesLocal(
    orderSize: bigint,
    domeFeeBps: number,
    affiliateFeeBps: number
  ): FeeCalculation {
    let domeFee = (orderSize * BigInt(domeFeeBps)) / BigInt(10000);
    let affiliateFee = (orderSize * BigInt(affiliateFeeBps)) / BigInt(10000);
    let totalFee = domeFee + affiliateFee;

    // Apply minimum fee scaling
    if (totalFee < MIN_ORDER_FEE && totalFee > BigInt(0)) {
      const scale = (MIN_ORDER_FEE * BigInt(10000)) / totalFee;
      domeFee = (domeFee * scale) / BigInt(10000);
      affiliateFee = MIN_ORDER_FEE - domeFee;
      totalFee = MIN_ORDER_FEE;
    } else if (totalFee === BigInt(0)) {
      domeFee = MIN_ORDER_FEE;
      affiliateFee = BigInt(0);
      totalFee = MIN_ORDER_FEE;
    }

    return { domeFee, affiliateFee, totalFee };
  }

  /**
   * Calculate performance fees locally (without contract call)
   *
   * Use this for quick estimates. For final calculations, use calculatePerformanceFees().
   *
   * @param winnings - Winnings amount in USDC (6 decimals)
   * @param domeFeeBps - Dome's fee rate in basis points
   * @param affiliateFeeBps - Affiliate's fee rate in basis points
   * @returns Fee amounts for Dome, Affiliate, and Total
   */
  calculatePerformanceFeesLocal(
    winnings: bigint,
    domeFeeBps: number,
    affiliateFeeBps: number
  ): FeeCalculation {
    let domeFee = (winnings * BigInt(domeFeeBps)) / BigInt(10000);
    let affiliateFee = (winnings * BigInt(affiliateFeeBps)) / BigInt(10000);
    let totalFee = domeFee + affiliateFee;

    // Apply minimum fee scaling
    if (totalFee < MIN_PERFORMANCE_FEE && totalFee > BigInt(0)) {
      const scale = (MIN_PERFORMANCE_FEE * BigInt(10000)) / totalFee;
      domeFee = (domeFee * scale) / BigInt(10000);
      affiliateFee = MIN_PERFORMANCE_FEE - domeFee;
      totalFee = MIN_PERFORMANCE_FEE;
    } else if (totalFee === BigInt(0)) {
      domeFee = MIN_PERFORMANCE_FEE;
      affiliateFee = BigInt(0);
      totalFee = MIN_PERFORMANCE_FEE;
    }

    return { domeFee, affiliateFee, totalFee };
  }

  // ============ View Functions ============

  /**
   * Get full escrow status for an order/position
   *
   * @param orderId - Order/position identifier (bytes32)
   * @returns Escrow status details
   *
   * @example
   * ```typescript
   * const status = await client.getEscrowStatus(orderId);
   * if (status.isComplete) {
   *   console.log('Escrow is complete');
   * } else {
   *   console.log(`Time until withdrawal: ${status.timeUntilWithdraw}s`);
   * }
   * ```
   */
  async getEscrowStatus(orderId: string): Promise<EscrowStatus> {
    const result = await this.contract.getEscrowStatus(orderId);

    return {
      payer: result.payer,
      affiliate: result.affiliate,
      orderFeeDomeAmount: BigInt(result.orderFeeDomeAmount.toString()),
      orderFeeAffiliateAmount: BigInt(
        result.orderFeeAffiliateAmount.toString()
      ),
      perfFeeDomeAmount: BigInt(result.perfFeeDomeAmount.toString()),
      perfFeeAffiliateAmount: BigInt(result.perfFeeAffiliateAmount.toString()),
      isComplete: result.isComplete,
      timeUntilWithdraw: Number(result.timeUntilWithdraw),
    };
  }

  /**
   * Get remaining escrow amounts (detailed breakdown)
   *
   * @param orderId - Order/position identifier (bytes32)
   * @returns Remaining escrow amounts
   *
   * @example
   * ```typescript
   * const remaining = await client.getRemainingEscrow(orderId);
   * console.log(`Total remaining: $${formatUsdc(remaining.totalRemaining)}`);
   * ```
   */
  async getRemainingEscrow(orderId: string): Promise<RemainingEscrow> {
    const result = await this.contract.getRemainingEscrow(orderId);

    return {
      orderFeeDomeRemaining: BigInt(result.orderFeeDomeRemaining.toString()),
      orderFeeAffiliateRemaining: BigInt(
        result.orderFeeAffiliateRemaining.toString()
      ),
      perfFeeDomeRemaining: BigInt(result.perfFeeDomeRemaining.toString()),
      perfFeeAffiliateRemaining: BigInt(
        result.perfFeeAffiliateRemaining.toString()
      ),
      totalRemaining: BigInt(result.totalRemaining.toString()),
    };
  }

  /**
   * Check if an escrow exists for a given order/position ID
   *
   * An escrow exists if it has been funded (payer is not zero address).
   * Use this to check if authorization has already been used before signing a new one.
   *
   * @param orderId - Order/position identifier (bytes32)
   * @returns Object with boolean flags for each fee type
   *
   * @example
   * ```typescript
   * const exists = await client.hasEscrow(orderId);
   * if (exists.hasOrderFee) {
   *   console.log('Order fee already escrowed');
   * }
   * if (exists.hasPerformanceFee) {
   *   console.log('Performance fee already escrowed');
   * }
   * ```
   */
  async hasEscrow(orderId: string): Promise<{
    hasAnyEscrow: boolean;
    hasOrderFee: boolean;
    hasPerformanceFee: boolean;
    payer: string;
    affiliate: string;
  }> {
    const status = await this.getEscrowStatus(orderId);
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const hasOrderFee =
      status.orderFeeDomeAmount > BigInt(0) ||
      status.orderFeeAffiliateAmount > BigInt(0);

    const hasPerformanceFee =
      status.perfFeeDomeAmount > BigInt(0) ||
      status.perfFeeAffiliateAmount > BigInt(0);

    return {
      hasAnyEscrow: status.payer.toLowerCase() !== zeroAddress.toLowerCase(),
      hasOrderFee,
      hasPerformanceFee,
      payer: status.payer,
      affiliate: status.affiliate,
    };
  }

  /**
   * Get the EIP-712 domain separator from the contract
   *
   * @returns Domain separator hash
   */
  async getDomainSeparator(): Promise<string> {
    return await this.contract.DOMAIN_SEPARATOR();
  }

  /**
   * Get the Dome wallet address from the contract
   *
   * @returns Dome wallet address
   */
  async getDomeWallet(): Promise<string> {
    return await this.contract.domeWallet();
  }

  // ============ Signature Verification ============

  /**
   * Verify an order fee authorization signature locally (for EOA signatures)
   *
   * Note: This only works for EOA signatures. For SAFE signatures,
   * verification must happen on-chain via EIP-1271.
   *
   * @param signedAuth - Signed order fee authorization
   * @param expectedSigner - Expected signer address
   * @returns True if signature is valid
   */
  verifyOrderFeeAuthSignature(
    signedAuth: SignedOrderFeeAuth,
    expectedSigner: string
  ): boolean {
    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      orderId: signedAuth.orderId,
      payer: signedAuth.payer,
      domeAmount: signedAuth.domeAmount,
      affiliateAmount: signedAuth.affiliateAmount,
      chainId: signedAuth.chainId,
      deadline: signedAuth.deadline,
    };

    const recovered = ethers.utils.verifyTypedData(
      domain,
      ORDER_FEE_TYPES,
      message,
      signedAuth.signature
    );

    return recovered.toLowerCase() === expectedSigner.toLowerCase();
  }

  /**
   * Verify a performance fee authorization signature locally (for EOA signatures)
   *
   * Note: This only works for EOA signatures. For SAFE signatures,
   * verification must happen on-chain via EIP-1271.
   *
   * @param signedAuth - Signed performance fee authorization
   * @param expectedSigner - Expected signer address
   * @returns True if signature is valid
   */
  verifyPerformanceFeeAuthSignature(
    signedAuth: SignedPerformanceFeeAuth,
    expectedSigner: string
  ): boolean {
    const domain = createDomeFeeEscrowEIP712Domain(
      this.contractAddress,
      this.chainId
    );

    const message = {
      positionId: signedAuth.positionId,
      payer: signedAuth.payer,
      expectedWinnings: signedAuth.expectedWinnings,
      domeAmount: signedAuth.domeAmount,
      affiliateAmount: signedAuth.affiliateAmount,
      chainId: signedAuth.chainId,
      deadline: signedAuth.deadline,
    };

    const recovered = ethers.utils.verifyTypedData(
      domain,
      PERFORMANCE_FEE_TYPES,
      message,
      signedAuth.signature
    );

    return recovered.toLowerCase() === expectedSigner.toLowerCase();
  }

  // ============ Getters ============

  /**
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Get the chain ID
   */
  getChainId(): number {
    return this.chainId;
  }

  /**
   * Get the provider
   */
  getProvider(): ethers.providers.Provider {
    return this.provider;
  }
}
