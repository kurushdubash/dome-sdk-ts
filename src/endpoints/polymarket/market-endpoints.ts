import { BaseClient } from '../../base-client.js';
import {
  MarketPriceResponse,
  GetMarketPriceParams,
  CandlesticksResponse,
  GetCandlesticksParams,
  PolymarketOrderbooksResponse,
  GetPolymarketOrderbooksParams,
  MarketsResponse,
  GetMarketsParams,
  EventsResponse,
  GetEventsParams,
  RequestConfig,
} from '../../types.js';

/**
 * Market-related endpoints for the Dome API
 * Handles market price and candlestick data
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
   * Get Orderbook History
   *
   * Fetches historical orderbook snapshots for a specific asset (token ID)
   * over a specified time range. Returns snapshots of the order book including
   * bids, asks, and market metadata. All timestamps are in milliseconds.
   *
   * @param params - Parameters for the orderbook request
   * @param options - Optional request configuration
   * @returns Promise resolving to orderbook history data
   */
  async getOrderbooks(
    params: GetPolymarketOrderbooksParams,
    options?: RequestConfig
  ): Promise<PolymarketOrderbooksResponse> {
    const { token_id, start_time, end_time, limit, pagination_key } = params;
    const queryParams: Record<string, any> = {
      token_id,
      start_time,
      end_time,
    };

    if (limit !== undefined) {
      queryParams.limit = limit;
    }

    if (pagination_key !== undefined) {
      queryParams.pagination_key = pagination_key;
    }

    return this.makeRequest<PolymarketOrderbooksResponse>(
      'GET',
      '/polymarket/orderbooks',
      queryParams,
      options
    );
  }

  /**
   * Get Markets
   *
   * Fetches market data with optional filtering and search functionality.
   * Supports filtering by market slug, event slug, condition ID, token ID, or tags.
   * Returns markets ordered by volume (most popular first) when filters are applied,
   * or by start_time (most recent first) when no filters are provided.
   *
   * @param params - Parameters for the markets request
   * @param options - Optional request configuration
   * @returns Promise resolving to markets data with pagination
   */
  async getMarkets(
    params: GetMarketsParams = {},
    options?: RequestConfig
  ): Promise<MarketsResponse> {
    const queryParams: Record<string, any> = {};

    if (params.market_slug) {
      queryParams.market_slug = params.market_slug;
    }
    if (params.event_slug) {
      queryParams.event_slug = params.event_slug;
    }
    if (params.condition_id) {
      queryParams.condition_id = params.condition_id;
    }
    if (params.token_id) {
      queryParams.token_id = params.token_id;
    }
    if (params.tags) {
      queryParams.tags = params.tags;
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
    // Prefer pagination_key (cursor-based) over offset for pagination
    if (params.pagination_key !== undefined) {
      queryParams.pagination_key = params.pagination_key;
    } else if (params.offset !== undefined) {
      queryParams.offset = params.offset;
    }
    if (params.start_time !== undefined) {
      queryParams.start_time = params.start_time;
    }
    if (params.end_time !== undefined) {
      queryParams.end_time = params.end_time;
    }

    return this.makeRequest<MarketsResponse>(
      'GET',
      '/polymarket/markets',
      queryParams,
      options
    );
  }

  /**
   * Get Events
   *
   * Fetches events (groups of related markets) with optional filtering by event_slug,
   * tags/categories and status. Events aggregate multiple markets under a single topic.
   * Returns events ordered by total volume (most popular first).
   *
   * @param params - Parameters for the events request
   * @param options - Optional request configuration
   * @returns Promise resolving to events data with pagination
   */
  async getEvents(
    params: GetEventsParams = {},
    options?: RequestConfig
  ): Promise<EventsResponse> {
    const queryParams: Record<string, any> = {};

    if (params.event_slug !== undefined) {
      queryParams.event_slug = params.event_slug;
    }
    if (params.tags) {
      queryParams.tags = params.tags;
    }
    if (params.status !== undefined) {
      queryParams.status = params.status;
    }
    if (params.include_markets !== undefined) {
      queryParams.include_markets = String(params.include_markets);
    }
    if (params.start_time !== undefined) {
      queryParams.start_time = params.start_time;
    }
    if (params.end_time !== undefined) {
      queryParams.end_time = params.end_time;
    }
    if (params.game_start_time !== undefined) {
      queryParams.game_start_time = params.game_start_time;
    }
    if (params.limit !== undefined) {
      queryParams.limit = params.limit;
    }
    if (params.offset !== undefined) {
      queryParams.offset = params.offset;
    }

    return this.makeRequest<EventsResponse>(
      'GET',
      '/polymarket/events',
      queryParams,
      options
    );
  }
}
