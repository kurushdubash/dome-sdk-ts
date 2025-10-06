import { DomeSDKConfig } from '../../types';
import { MarketEndpoints } from './market-endpoints';
import { WalletEndpoints } from './wallet-endpoints';
import { OrdersEndpoints } from './orders-endpoints';

/**
 * Polymarket client that provides access to all Polymarket-related endpoints
 * Groups market data, wallet analytics, and order functionality
 */
export class PolymarketClient {
  public readonly markets: MarketEndpoints;
  public readonly wallet: WalletEndpoints;
  public readonly orders: OrdersEndpoints;

  constructor(config: DomeSDKConfig) {
    this.markets = new MarketEndpoints(config);
    this.wallet = new WalletEndpoints(config);
    this.orders = new OrdersEndpoints(config);
  }
}
