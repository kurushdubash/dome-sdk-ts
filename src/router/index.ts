/**
 * Router module for wallet-agnostic trading integrations
 *
 * This module provides helpers for integrating with prediction market platforms,
 * abstracting away platform-specific details and wallet signing complexity.
 *
 * v0: Direct integration with Polymarket CLOB
 * Future: Will route through Dome backend for additional features
 */

export { PolymarketRouter } from './polymarket';
export type { PolymarketCredentials } from './polymarket';
export type {
  RouterSigner,
  LinkPolymarketUserParams,
  PlaceOrderParams,
  PolymarketRouterConfig,
  Eip712Payload,
} from '../types';
