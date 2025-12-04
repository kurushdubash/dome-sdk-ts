import { DomeSDKConfig } from '../../types.js';
import { KalshiEndpoints } from './kalshi-endpoints.js';

/**
 * Kalshi client that provides access to all Kalshi-related endpoints
 */
export class KalshiClient {
  public readonly markets: KalshiEndpoints;

  constructor(config: DomeSDKConfig) {
    this.markets = new KalshiEndpoints(config);
  }
}
