import { BaseClient } from '../../base-client';
import {
  OrdersResponse,
  GetOrdersParams,
  OrderbookHistoryResponse,
  GetOrderbookHistoryParams,
  RequestConfig,
} from '../../types';

/**
 * Orders-related endpoints for the Dome API
 * Handles order data retrieval, filtering, and orderbook history
 */
export class OrdersEndpoints extends BaseClient {
  /**
   * Get Orders
   *
   * Fetches order data with optional filtering by market, condition, token,
   * time range, and user. Returns orders that match either primary or secondary
   * token IDs for markets.
   *
   * @param params - Parameters for the orders request
   * @param options - Optional request configuration
   * @returns Promise resolving to orders data with pagination
   */
  async getOrders(
    params: GetOrdersParams,
    options?: RequestConfig
  ): Promise<OrdersResponse> {
    const queryParams: Record<string, any> = {};

    if (params.market_slug) queryParams.market_slug = params.market_slug;
    if (params.condition_id) queryParams.condition_id = params.condition_id;
    if (params.token_id) queryParams.token_id = params.token_id;
    if (params.start_time !== undefined)
      queryParams.start_time = params.start_time;
    if (params.end_time !== undefined) queryParams.end_time = params.end_time;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.offset !== undefined) queryParams.offset = params.offset;
    if (params.user) queryParams.user = params.user;

    return this.makeRequest<OrdersResponse>(
      'GET',
      '/polymarket/orders',
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
   * Orderbook data has history starting from October 14th, 2025.
   *
   * @param params - Parameters for the orderbook history request
   * @param options - Optional request configuration
   * @returns Promise resolving to orderbook snapshots with pagination
   */
  async getOrderbookHistory(
    params: GetOrderbookHistoryParams,
    options?: RequestConfig
  ): Promise<OrderbookHistoryResponse> {
    const { token_id, start_time, end_time, limit } = params;
    const queryParams: Record<string, any> = {
      token_id,
      start_time,
      end_time,
    };

    if (limit !== undefined) {
      queryParams.limit = limit;
    }

    return this.makeRequest<OrderbookHistoryResponse>(
      'GET',
      '/polymarket/orderbooks',
      queryParams,
      options
    );
  }
}
