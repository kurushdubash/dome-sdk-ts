import { BaseClient } from '../base-client';
import {
  MatchingMarketsResponse,
  GetMatchingMarketsParams,
  MatchingMarketsBySportResponse,
  GetMatchingMarketsBySportParams,
  RequestConfig,
} from '../types';

/**
 * Matching Markets-related endpoints for the Dome API
 * Handles cross-platform market matching functionality
 */
export class MatchingMarketsEndpoints extends BaseClient {
  /**
   * Get Matching Markets for Sports
   *
   * Find equivalent markets across different prediction market platforms
   * (Polymarket, Kalshi, etc.) for sports events.
   *
   * @param params - Parameters for the matching markets request
   * @param options - Optional request configuration
   * @returns Promise resolving to matching markets data
   */
  async getMatchingMarkets(
    params: GetMatchingMarketsParams,
    options?: RequestConfig
  ): Promise<MatchingMarketsResponse> {
    const queryParams: Record<string, unknown> = {};

    if (params.polymarket_market_slug) {
      queryParams.polymarket_market_slug = params.polymarket_market_slug;
    }

    if (params.kalshi_event_ticker) {
      queryParams.kalshi_event_ticker = params.kalshi_event_ticker;
    }

    return this.makeRequest<MatchingMarketsResponse>(
      'GET',
      '/matching-markets/sports/',
      {
        query: queryParams,
        ...(options ? { options } : {}),
      }
    );
  }

  /**
   * Get Matching Markets for Sports by Sport and Date
   *
   * Find equivalent markets across different prediction market platforms
   * for sports events by sport and date.
   *
   * @param params - Parameters for the matching markets by sport request
   * @param options - Optional request configuration
   * @returns Promise resolving to matching markets data
   */
  async getMatchingMarketsBySport(
    params: GetMatchingMarketsBySportParams,
    options?: RequestConfig
  ): Promise<MatchingMarketsBySportResponse> {
    const { sport, date } = params;
    const queryParams = { date };

    return this.makeRequest<MatchingMarketsBySportResponse>(
      'GET',
      `/matching-markets/sports/${sport}/`,
      {
        query: queryParams,
        ...(options ? { options } : {}),
      }
    );
  }
}
