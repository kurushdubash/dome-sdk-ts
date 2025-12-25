import { BaseClient } from '../base-client.js';
import {
  CryptoPricesResponse,
  GetBinanceCryptoPricesParams,
  GetChainlinkCryptoPricesParams,
  RequestConfig,
} from '../types.js';

/**
 * Crypto Prices-related endpoints for the Dome API
 * Handles historical crypto price data from Binance and Chainlink
 */
export class CryptoPricesEndpoints extends BaseClient {
  /**
   * Get Binance Crypto Prices
   *
   * Fetches historical crypto price data from Binance. Returns price data for a
   * specific currency pair over an optional time range. When no time range is
   * provided, returns the most recent price (limit 1). All timestamps are in Unix milliseconds.
   *
   * Currency format: lowercase alphanumeric with no separators (e.g., btcusdt, ethusdt).
   *
   * @param params - Parameters for the Binance crypto prices request
   * @param options - Optional request configuration
   * @returns Promise resolving to crypto prices data
   */
  async getBinancePrices(
    params: GetBinanceCryptoPricesParams,
    options?: RequestConfig
  ): Promise<CryptoPricesResponse> {
    const { currency, start_time, end_time, limit, pagination_key } = params;
    const queryParams: Record<string, any> = {
      currency,
    };

    if (start_time !== undefined) {
      queryParams.start_time = start_time;
    }
    if (end_time !== undefined) {
      queryParams.end_time = end_time;
    }
    if (limit !== undefined) {
      queryParams.limit = limit;
    }
    if (pagination_key !== undefined) {
      queryParams.pagination_key = pagination_key;
    }

    return this.makeRequest<CryptoPricesResponse>(
      'GET',
      '/crypto-prices/binance',
      queryParams,
      options
    );
  }

  /**
   * Get Chainlink Crypto Prices
   *
   * Fetches historical crypto price data from Chainlink. Returns price data for a
   * specific currency pair over an optional time range. When no time range is
   * provided, returns the most recent price (limit 1). All timestamps are in Unix milliseconds.
   *
   * Currency format: slash-separated (e.g., btc/usd, eth/usd).
   *
   * @param params - Parameters for the Chainlink crypto prices request
   * @param options - Optional request configuration
   * @returns Promise resolving to crypto prices data
   */
  async getChainlinkPrices(
    params: GetChainlinkCryptoPricesParams,
    options?: RequestConfig
  ): Promise<CryptoPricesResponse> {
    const { currency, start_time, end_time, limit, pagination_key } = params;
    const queryParams: Record<string, any> = {
      currency,
    };

    if (start_time !== undefined) {
      queryParams.start_time = start_time;
    }
    if (end_time !== undefined) {
      queryParams.end_time = end_time;
    }
    if (limit !== undefined) {
      queryParams.limit = limit;
    }
    if (pagination_key !== undefined) {
      queryParams.pagination_key = pagination_key;
    }

    return this.makeRequest<CryptoPricesResponse>(
      'GET',
      '/crypto-prices/chainlink',
      queryParams,
      options
    );
  }
}
