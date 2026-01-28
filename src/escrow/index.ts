/**
 * DomeFeeEscrow Module
 *
 * SDK for interacting with the DomeFeeEscrow contract.
 *
 * Features:
 * - Deterministic orderId generation
 * - EIP-712 fee authorization signing
 * - Fee calculation utilities
 * - USDC formatting helpers
 *
 * Wallet Support:
 * - EOA wallets (via EIP-2612 permit)
 * - Smart wallets like Safe (via EIP-1271)
 */

// Types
export type {
  OrderParams,
  FeeAuth,
  SignedFeeAuth,
  PullFeeParams,
  EscrowData,
  EscrowStatus,
  FeeCalculation,
  DistributeParams,
  DistributeBatchParams,
} from './types.js';

export { HoldState } from './types.js';

// Constants
export {
  CHAIN_ID_POLYGON,
  CHAIN_ID_AMOY,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
  DEFAULT_CLIENT_FEE_BPS,
  DEFAULT_CLIENT_ADDRESS,
  MAX_CLIENT_FEE_BPS,
  USDC_DECIMALS,
  FEE_AUTH_TYPEHASH,
} from './constants.js';

// Order ID
export { generateOrderId, verifyOrderId } from './id.js';

// Signing
export {
  // FeeAuth (for Smart Wallets - EIP-1271)
  FEE_AUTH_TYPES,
  createEIP712Domain,
  createFeeAuth,
  signFeeAuth,
  signFeeAuthWithSigner,
  verifyFeeAuthSignature,
  // Permit (for EOA wallets - EIP-2612)
  PERMIT_TYPES,
  createPermitDomain,
  signPermit,
  signPermitWithSigner,
  getPermitNonce,
} from './auth.js';

export type { TypedDataSigner, PermitMessage, SignedPermit } from './auth.js';

// Utilities
export {
  parseUsdc,
  formatUsdc,
  formatBps,
  calculateFees,
  isValidAddress,
  normalizeAddress,
  isValidOrderId,
} from './utils.js';

// Approvals
export {
  CTF_EXCHANGE,
  NEG_RISK_CTF_EXCHANGE,
  NEG_RISK_ADAPTER,
  CONTRACTS_TO_APPROVE,
  checkAllowances,
  hasAllApprovals,
  approveAllContracts,
  approveWithSigner,
  buildApprovalTx,
  buildAllApprovalTxs,
} from './approve.js';

export type {
  AllowanceStatus,
  ApprovalResult,
  TransactionSigner,
} from './approve.js';

// Configuration
export {
  ESCROW_CONTRACT_AMOY,
  USDC_AMOY,
  DEFAULT_DEADLINE_SECONDS,
  DEFAULT_RPC_URL_POLYGON,
  DEFAULT_RPC_URL_AMOY,
  getEscrowAddress,
  getUsdcAddress,
  getDefaultRpcUrl,
  resolveEscrowConfig,
} from './config.js';

export type {
  EscrowConfig,
  ResolvedEscrowConfig,
} from './config.js';
