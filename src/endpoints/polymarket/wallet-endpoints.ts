import { BaseClient } from '../../base-client.js';
import {
  WalletPnLResponse,
  GetWalletPnLParams,
  RequestConfig,
} from '../../types.js';

/**
 * Wallet-related endpoints for the Dome API
 * Handles wallet analytics and PnL data
 */
export class WalletEndpoints extends BaseClient {
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
}
