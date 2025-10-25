import { BaseClient } from '../../base-client';
import {
  MarketPriceResponse,
  GetMarketPriceParams,
  CandlesticksResponse,
  GetCandlesticksParams,
  MarketsResponse,
  GetMarketsParams,
  RequestConfig,
} from '../../types';

/**
 * Market-related endpoints for the Dome API
 * Handles market discovery, market price, and candlestick data
 */
export class MarketEndpoints extends BaseClient {
  /**
   * Get Market Price
   *
   * Fetches the current market price for a market by token_id.
   * Allows historical lookups via the at_time query parameter.
   *
   * @param params - Parameters for the market price request
   * @param options - Optional request configuration
   * @returns Promise resolving to market price data
   */
  async getMarketPrice(
    params: GetMarketPriceParams,
    options?: RequestConfig
  ): Promise<MarketPriceResponse> {
    const { token_id, at_time } = params;
    const queryParams: Record<string, any> = {};

    if (at_time !== undefined) {
      queryParams.at_time = at_time;
    }

    return this.makeRequest<MarketPriceResponse>(
      'GET',
      `/polymarket/market-price/${token_id}`,
      queryParams,
      options
    );
  }

  /**
   * Get Candlestick Data
   *
   * Fetches historical candlestick data for a market identified by condition_id,
   * over a specified interval.
   *
   * @param params - Parameters for the candlestick request
   * @param options - Optional request configuration
   * @returns Promise resolving to candlestick data
   */
  async getCandlesticks(
    params: GetCandlesticksParams,
    options?: RequestConfig
  ): Promise<CandlesticksResponse> {
    const { condition_id, start_time, end_time, interval } = params;
    const queryParams: Record<string, any> = {
      start_time,
      end_time,
    };

    if (interval !== undefined) {
      queryParams.interval = interval;
    }

    return this.makeRequest<CandlesticksResponse>(
      'GET',
      `/polymarket/candlesticks/${condition_id}`,
      queryParams,
      options
    );
  }

  /**
   * Get Markets
   *
   * Fetches markets on Polymarket using various filters including market slug,
   * condition ID, and tags.
   *
   * @param params - Parameters for filtering markets
   * @param options - Optional request configuration
   * @returns Promise resolving to markets data with pagination
   */
  async getMarkets(
    params?: GetMarketsParams,
    options?: RequestConfig
  ): Promise<MarketsResponse> {
    const queryParams: Record<string, any> = {};

    if (params?.market_slug !== undefined) {
      queryParams.market_slug = params.market_slug;
    }

    if (params?.condition_id !== undefined) {
      queryParams.condition_id = params.condition_id;
    }

    if (params?.tags !== undefined) {
      queryParams.tags = params.tags;
    }

    if (params?.limit !== undefined) {
      queryParams.limit = params.limit;
    }

    if (params?.offset !== undefined) {
      queryParams.offset = params.offset;
    }

    return this.makeRequest<MarketsResponse>(
      'GET',
      '/polymarket/markets',
      queryParams,
      options
    );
  }
}
