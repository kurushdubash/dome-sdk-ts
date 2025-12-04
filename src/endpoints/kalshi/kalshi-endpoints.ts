import { BaseClient } from '../../base-client.js';
import {
  KalshiMarketsResponse,
  GetKalshiMarketsParams,
  KalshiOrderbooksResponse,
  GetKalshiOrderbooksParams,
  RequestConfig,
} from '../../types.js';

/**
 * Kalshi-related endpoints for the Dome API
 * Handles Kalshi market data and orderbook history
 */
export class KalshiEndpoints extends BaseClient {
  /**
   * Get Kalshi Markets
   *
   * Fetches Kalshi market data with optional filtering by market ticker,
   * event ticker, status, and volume. Returns markets with details including
   * pricing, volume, and status information.
   *
   * @param params - Parameters for the Kalshi markets request
   * @param options - Optional request configuration
   * @returns Promise resolving to Kalshi markets data with pagination
   */
  async getMarkets(
    params: GetKalshiMarketsParams,
    options?: RequestConfig
  ): Promise<KalshiMarketsResponse> {
    const queryParams: Record<string, any> = {};

    if (params.market_ticker) {
      queryParams.market_ticker = params.market_ticker;
    }
    if (params.event_ticker) {
      queryParams.event_ticker = params.event_ticker;
    }
    if (params.status !== undefined) {
      queryParams.status = params.status;
    }
    if (params.min_volume !== undefined) {
      queryParams.min_volume = params.min_volume;
    }
    if (params.limit !== undefined) {
      queryParams.limit = params.limit;
    }
    if (params.offset !== undefined) {
      queryParams.offset = params.offset;
    }

    return this.makeRequest<KalshiMarketsResponse>(
      'GET',
      '/kalshi/markets',
      queryParams,
      options
    );
  }

  /**
   * Get Kalshi Orderbook History
   *
   * Fetches historical orderbook snapshots for a specific Kalshi market (ticker)
   * over a specified time range. Returns snapshots of the order book including
   * yes/no bids and asks with prices in both cents and dollars.
   * All timestamps are in milliseconds.
   *
   * @param params - Parameters for the Kalshi orderbook request
   * @param options - Optional request configuration
   * @returns Promise resolving to Kalshi orderbook history data
   */
  async getOrderbooks(
    params: GetKalshiOrderbooksParams,
    options?: RequestConfig
  ): Promise<KalshiOrderbooksResponse> {
    const { ticker, start_time, end_time, limit } = params;
    const queryParams: Record<string, any> = {
      ticker,
      start_time,
      end_time,
    };

    if (limit !== undefined) {
      queryParams.limit = limit;
    }

    return this.makeRequest<KalshiOrderbooksResponse>(
      'GET',
      '/kalshi/orderbooks',
      queryParams,
      options
    );
  }
}
