import { BaseClient } from '../../base-client';
import { OrdersResponse, GetOrdersParams, RequestConfig } from '../../types';

/**
 * Orders-related endpoints for the Dome API
 * Handles order data retrieval and filtering
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
    const queryParams: Record<string, unknown> = {};

    if (params.market_slug) queryParams.market_slug = params.market_slug;
    if (params.condition_id) queryParams.condition_id = params.condition_id;
    if (params.token_id) queryParams.token_id = params.token_id;
    if (params.start_time !== undefined)
      queryParams.start_time = params.start_time;
    if (params.end_time !== undefined) queryParams.end_time = params.end_time;
    if (params.limit !== undefined) queryParams.limit = params.limit;
    if (params.offset !== undefined) queryParams.offset = params.offset;
    if (params.user) queryParams.user = params.user;

    return this.makeRequest<OrdersResponse>('GET', '/polymarket/orders', {
      query: queryParams,
      ...(options ? { options } : {}),
    });
  }
}
