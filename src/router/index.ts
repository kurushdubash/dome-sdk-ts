/**
 * Router module for wallet-agnostic trading integrations
 *
 * This module provides helpers for integrating with prediction market platforms,
 * abstracting away platform-specific details and wallet signing complexity.
 *
 * Supports two wallet types:
 * 1. EOA wallets (Privy embedded, direct signing) - simpler setup
 * 2. Safe wallets (external wallets like MetaMask) - requires Safe deployment
 *
 * v0: Direct integration with Polymarket CLOB
 * Future: Will route through Dome backend for additional features
 */

export { PolymarketRouter } from './polymarket.js';
export { PolymarketEscrowRouter } from './polymarket-escrow.js';
export type {
  RouterSigner,
  LinkPolymarketUserParams,
  PlaceOrderParams,
  PolymarketRouterConfig,
  Eip712Payload,
  WalletType,
  TradingSession,
  SessionStep,
  SafeLinkResult,
  PolymarketCredentials,
  SignedPolymarketOrder,
  PolymarketOrderType,
  ServerPlaceOrderRequest,
  ServerPlaceOrderResponse,
  ServerPlaceOrderResult,
  ServerPlaceOrderError,
} from '../types.js';

// Re-export SafeInitResult from safe.ts (it's defined there to avoid circular deps)
export type { SafeInitResult } from '../utils/safe.js';

// EOA allowance utilities
export {
  checkAllAllowances,
  setAllAllowances,
  getPolygonProvider,
  POLYGON_ADDRESSES,
} from '../utils/allowances.js';

// Safe wallet utilities
export {
  deriveSafeAddress,
  isSafeDeployed,
  createRelayClient,
  deploySafe,
  initializeSafe,
  checkSafeAllowances,
  setSafeUsdcApproval,
  createEthersSignerFromRouter,
  POLYGON_CHAIN_ID,
  DEFAULT_RELAYER_URL,
  DEFAULT_RPC_URL,
} from '../utils/safe.js';

// Fee escrow router types
export type {
  DomeFeeEscrowDomain,
  FeeEscrowConfig,
  PolymarketEscrowRouterConfig,
  SignedFeeAuth,
  PlaceOrderWithEscrowParams,
  EscrowData,
  EscrowStatus,
  FeeCalculation,
} from './polymarket-escrow.js';

export { HoldState } from './polymarket-escrow.js';

// Fee escrow utilities
export {
  DOME_FEE_ESCROW_POLYGON,
  DOME_FEE_ESCROW_AMOY,
  USDC_POLYGON,
  USDC_AMOY,
  DEFAULT_DOME_FEE_BPS,
  MAX_CLIENT_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
  AMOY_CHAIN_ID,
  FEE_AUTH_TYPES,
  PERMIT_TYPES,
  createFeeEscrowDomain,
  getUsdcPermitDomain,
  calculateFees,
  parseUsdc,
  formatUsdc,
  generateOrderId,
  getEscrowAddress,
  getUsdcAddress,
} from './polymarket-escrow.js';
