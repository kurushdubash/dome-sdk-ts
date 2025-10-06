import { DomeSDKConfig } from './types';
import { PolymarketClient, MatchingMarketsEndpoints } from './endpoints';

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

  /**
   * Creates a new instance of the Dome SDK
   *
   * @param config - Configuration options for the SDK
   */
  constructor(config: DomeSDKConfig) {
    // Initialize all endpoint modules with the same config
    this.polymarket = new PolymarketClient(config);
    this.matchingMarkets = new MatchingMarketsEndpoints(config);
  }
}

// Re-export types for convenience
export * from './types';

// Default export
export default DomeClient;
