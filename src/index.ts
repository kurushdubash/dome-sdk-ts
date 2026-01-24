import { DomeSDKConfig } from './types.js';
import {
  PolymarketClient,
  MatchingMarketsEndpoints,
  KalshiClient,
  CryptoPricesEndpoints,
} from './endpoints/index.js';

/**
 * Main Dome SDK Client
 *
 * Provides a comprehensive TypeScript SDK for interacting with Dome API.
 * Features include market data, wallet analytics, order tracking, and cross-platform market matching.
 *
 * @example
 * ```typescript
 * import { DomeClient } from '@dome-api/sdk';
 *
 * const dome = new DomeClient({
 *   apiKey: 'your-api-key'
 * });
 *
 * const marketPrice = await dome.polymarket.markets.getMarketPrice({
 *   token_id: '1234567890'
 * });
 * ```
 */
export class DomeClient {
  public readonly polymarket: PolymarketClient;
  public readonly matchingMarkets: MatchingMarketsEndpoints;
  public readonly kalshi: KalshiClient;
  public readonly cryptoPrices: CryptoPricesEndpoints;

  /**
   * Creates a new instance of the Dome SDK
   *
   * @param config - Configuration options for the SDK
   */
  constructor(config: DomeSDKConfig) {
    // Initialize all endpoint modules with the same config
    this.polymarket = new PolymarketClient(config);
    this.matchingMarkets = new MatchingMarketsEndpoints(config);
    this.kalshi = new KalshiClient(config);
    this.cryptoPrices = new CryptoPricesEndpoints(config);
  }
}

// Re-export types for convenience
export * from './types.js';

// Re-export router helpers
export * from './router/index.js';

// Re-export utility helpers
export * from './utils/privy.js';

// Re-export escrow module (as namespace and direct exports)
export * as escrow from './escrow/index.js';
export {
  // DomeFeeEscrow v1 exports
  approveEscrow,
  checkAllowances,
  hasRequiredApprovals,
  generateOrderId,
  createFeeAuthorization,
  signFeeAuthorization,
  signFeeAuthorizationWithSigner,
  formatUsdc,
  parseUsdc,
  calculateFee,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  // DomeFeeEscrow v2 exports
  DomeFeeEscrowClient,
  ORDER_FEE_TYPES,
  PERFORMANCE_FEE_TYPES,
  createUnifiedEIP712Domain,
  DOMAIN_NAME,
  DOMAIN_VERSION,
  MIN_ORDER_FEE,
  MIN_PERFORMANCE_FEE,
  MAX_FEE_ABSOLUTE,
  MAX_ORDER_FEE_BPS,
  MAX_PERFORMANCE_FEE_BPS,
  ESCROW_TIMEOUT_SECONDS,
  FeeType,
} from './escrow/index.js';

// Default export
export default DomeClient;
