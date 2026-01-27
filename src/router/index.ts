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
export { PolymarketEscrowRouter } from './polymarket-fee.js';
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
  EscrowConfig,
  ResolvedEscrowConfig,
  PolymarketEscrowRouterConfig,
  SignedFeeAuth,
  PlaceOrderWithEscrowParams,
  EscrowData,
  EscrowStatus,
  FeeCalculation,
} from './polymarket-fee.js';

export { HoldState } from './polymarket-fee.js';

// Fee escrow utilities
export {
  DOME_FEE_ESCROW_POLYGON,
  USDC_POLYGON,
  AMOY_CHAIN_ID,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
  DEFAULT_CLIENT_FEE_BPS,
  DEFAULT_CLIENT_ADDRESS,
  DEFAULT_DEADLINE_SECONDS,
  MAX_CLIENT_FEE_BPS,
  FEE_AUTH_TYPES,
  PERMIT_TYPES,
  createFeeEscrowDomain,
  getUsdcPermitDomain,
  getEscrowAddress,
  getUsdcAddress,
  getDefaultRpcUrl,
  resolveEscrowConfig,
} from './polymarket-fee.js';

// Re-export fee calculation utilities with router prefix to avoid name collision
export {
  calculateFees as routerCalculateFees,
  parseUsdc as routerParseUsdc,
  formatUsdc as routerFormatUsdc,
  generateOrderId as routerGenerateOrderId,
} from './polymarket-fee.js';
