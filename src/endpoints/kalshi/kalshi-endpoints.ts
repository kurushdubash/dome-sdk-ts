import { BaseClient } from '../../base-client.js';
import {
  KalshiMarketPriceResponse,
  GetKalshiMarketPriceParams,
  KalshiMarketsResponse,
  GetKalshiMarketsParams,
  KalshiOrderbooksResponse,
  GetKalshiOrderbooksParams,
  KalshiTradesResponse,
  GetKalshiTradesParams,
  RequestConfig,
} from '../../types.js';

/**
 * Kalshi-related endpoints for the Dome API
 * Handles Kalshi market data and orderbook history
 */
export class KalshiEndpoints extends BaseClient {
  /**
   * Get Kalshi Market Price
   *
   * Fetches the current market price for a Kalshi market by market ticker.
   * Returns both yes and no side prices. Allows historical lookups via the at_time query parameter.
   *
   * @param params - Parameters for the market price request
   * @param options - Optional request configuration
   * @returns Promise resolving to market price data with yes/no sides
   */
  async getMarketPrice(
    params: GetKalshiMarketPriceParams,
    options?: RequestConfig
  ): Promise<KalshiMarketPriceResponse> {
    const { market_ticker, at_time } = params;
    const queryParams: Record<string, any> = {};

    if (at_time !== undefined) {
      queryParams.at_time = at_time;
    }

    return this.makeRequest<KalshiMarketPriceResponse>(
      'GET',
      `/kalshi/market-price/${market_ticker}`,
      queryParams,
      options
    );
  }

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

  /**
   * Get Kalshi Trades
   *
   * Fetches historical trade data for Kalshi markets with optional filtering
   * by ticker and time range. Returns executed trades with pricing, volume, and
   * taker side information. All timestamps are in seconds.
   *
   * @param params - Parameters for the Kalshi trades request
   * @param options - Optional request configuration
   * @returns Promise resolving to Kalshi trades data with pagination
   */
  async getTrades(
    params: GetKalshiTradesParams,
    options?: RequestConfig
  ): Promise<KalshiTradesResponse> {
    const { ticker, start_time, end_time, limit, offset } = params;
    const queryParams: Record<string, any> = {};

    if (ticker !== undefined) {
      queryParams.ticker = ticker;
    }
    if (start_time !== undefined) {
      queryParams.start_time = start_time;
    }
    if (end_time !== undefined) {
      queryParams.end_time = end_time;
    }
    if (limit !== undefined) {
      queryParams.limit = limit;
    }
    if (offset !== undefined) {
      queryParams.offset = offset;
    }

    return this.makeRequest<KalshiTradesResponse>(
      'GET',
      '/kalshi/trades',
      queryParams,
      options
    );
  }
}
