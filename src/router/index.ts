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
