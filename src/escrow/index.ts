/**
 * Dome Fee Escrow Module
 *
 * Provides tools for users to participate in the fee escrow system:
 * - Deterministic orderId generation
 * - EIP-712 fee authorization creation and signing
 * - Utility functions for USDC formatting
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

// Fee authorization signing
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
