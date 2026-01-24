/**
 * Dome Fee Escrow Module
 *
 * Provides tools for users to participate in the fee escrow system:
 * - Deterministic orderId generation
 * - EIP-712 fee authorization creation and signing
 * - Utility functions for USDC formatting
 *
 * This module supports two contract versions:
 * - DomeFeeEscrow (v1): Original escrow with single fee type
 * - DomeFeeEscrow (v2): New escrow with order fees AND performance fees
 *
 * This module is designed for end-users. Operator-side functionality
 * (pullFee, distribute, refund) is handled by the Dome server.
 */

// Types
export type {
  OrderParams,
  FeeAuthorization,
  SignedFeeAuthorization,
} from './types.js';

// Order ID generation
export { generateOrderId, verifyOrderId } from './order-id.js';

// Fee authorization signing (DomeFeeEscrow v1)
export {
  createEIP712Domain,
  createFeeAuthorization,
  signFeeAuthorization,
  signFeeAuthorizationWithSigner,
  verifyFeeAuthorizationSignature,
  FEE_AUTHORIZATION_TYPES,
} from './signing.js';

export type { TypedDataSigner } from './signing.js';

// Utilities
export {
  formatUsdc,
  parseUsdc,
  formatBps,
  calculateFee,
  USDC_POLYGON,
  ESCROW_CONTRACT_POLYGON,
} from './utils.js';

// Approval
export {
  approveEscrow,
  checkAllowances,
  hasRequiredApprovals,
  POLYMARKET_CONTRACTS,
  ALL_CONTRACTS_TO_APPROVE,
} from './approve.js';

export type { ApproveEscrowOptions, ApproveEscrowResult } from './approve.js';

// Performance Fee (wins-only model - legacy)
export {
  calculatePerformanceFee,
  verifyPerformanceFeePayment,
  buildUsdcTransfer,
  buildPerformanceFeeTransactions,
} from './performance-fee.js';

export type {
  FeeConfig,
  PerformanceFeeSplit,
  PaymentVerification,
} from './performance-fee.js';

// ============ DomeFeeEscrow (v2) ============

// DomeFeeEscrow Client
export { DomeFeeEscrowClient } from './dome-client.js';

// DomeFeeEscrow Types
export type {
  OrderFeeAuthorization,
  PerformanceFeeAuthorization,
  SignedOrderFeeAuth,
  SignedPerformanceFeeAuth,
  EscrowStatus,
  RemainingEscrow,
  FeeCalculation,
  DomeFeeEscrowClientConfig,
  TypedDataSigner as UnifiedTypedDataSigner,
} from './dome-client.js';

// DomeFeeEscrow EIP-712 Types
export {
  ORDER_FEE_TYPES,
  PERFORMANCE_FEE_TYPES,
  createUnifiedEIP712Domain,
} from './dome-client.js';

// DomeFeeEscrow Constants
export {
  DOMAIN_NAME,
  DOMAIN_VERSION,
  MIN_ORDER_FEE,
  MIN_PERFORMANCE_FEE,
  MAX_FEE_ABSOLUTE,
  MAX_ORDER_FEE_BPS,
  MAX_PERFORMANCE_FEE_BPS,
  ESCROW_TIMEOUT_SECONDS,
  FeeType,
} from './dome-client.js';
