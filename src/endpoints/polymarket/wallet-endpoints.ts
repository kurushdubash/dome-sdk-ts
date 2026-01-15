import { BaseClient } from '../../base-client.js';
import {
  WalletPnLResponse,
  GetWalletPnLParams,
  WalletResponse,
  GetWalletParams,
  PositionsResponse,
  GetPositionsParams,
  RequestConfig,
} from '../../types.js';

/**
 * Wallet-related endpoints for the Dome API
 * Handles wallet analytics and PnL data
 */
export class WalletEndpoints extends BaseClient {
  /**
   * Get Wallet
   *
   * Fetches wallet information by providing either an EOA (Externally Owned Account)
   * address or a proxy wallet address. Returns the associated EOA, proxy, and wallet type.
   * Optionally returns trading metrics when with_metrics=true.
   *
   * @param params - Parameters for the wallet request
   * @param options - Optional request configuration
   * @returns Promise resolving to wallet information
   */
  async getWallet(
    params: GetWalletParams,
    options?: RequestConfig
  ): Promise<WalletResponse> {
    const { eoa, proxy, with_metrics, start_time, end_time } = params;
    const queryParams: Record<string, any> = {};

    if (eoa !== undefined) {
      queryParams.eoa = eoa;
    }
    if (proxy !== undefined) {
      queryParams.proxy = proxy;
    }
    if (with_metrics !== undefined) {
      queryParams.with_metrics = String(with_metrics);
    }
    if (start_time !== undefined) {
      queryParams.start_time = start_time;
    }
    if (end_time !== undefined) {
      queryParams.end_time = end_time;
    }

    return this.makeRequest<WalletResponse>(
      'GET',
      '/polymarket/wallet',
      queryParams,
      options
    );
  }

  /**
   * Get Wallet PnL
   *
   * Fetches the profit and loss (PnL) for a specific wallet address
   * over a specified time range and granularity.
   *
   * @param params - Parameters for the wallet PnL request
   * @param options - Optional request configuration
   * @returns Promise resolving to wallet PnL data
   */
  async getWalletPnL(
    params: GetWalletPnLParams,
    options?: RequestConfig
  ): Promise<WalletPnLResponse> {
    const { wallet_address, granularity, start_time, end_time } = params;
    const queryParams: Record<string, any> = {
      granularity,
    };

    if (start_time !== undefined) {
      queryParams.start_time = start_time;
    }

    if (end_time !== undefined) {
      queryParams.end_time = end_time;
    }

    return this.makeRequest<WalletPnLResponse>(
      'GET',
      `/polymarket/wallet/pnl/${wallet_address}`,
      queryParams,
      options
    );
  }

  /**
   * Get Positions
   *
   * Fetches active positions for a specific wallet address.
   * Returns all open positions with market details, shares held, and redeemability status.
   *
   * @param params - Parameters for the positions request
   * @param options - Optional request configuration
   * @returns Promise resolving to positions data with pagination
   */
  async getPositions(
    params: GetPositionsParams,
    options?: RequestConfig
  ): Promise<PositionsResponse> {
    const { wallet_address, limit, pagination_key } = params;
    const queryParams: Record<string, any> = {};

    if (limit !== undefined) {
      queryParams.limit = limit;
    }

    if (pagination_key !== undefined) {
      queryParams.pagination_key = pagination_key;
    }

    return this.makeRequest<PositionsResponse>(
      'GET',
      `/polymarket/positions/wallet/${wallet_address}`,
      queryParams,
      options
    );
  }
}
