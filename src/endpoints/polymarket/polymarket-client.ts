import { DomeSDKConfig, WebSocketConfig } from '../../types';
import { MarketEndpoints } from './market-endpoints';
import { WalletEndpoints } from './wallet-endpoints';
import { OrdersEndpoints } from './orders-endpoints';
import { PolymarketWebSocketClient } from './websocket-client';

/**
 * Polymarket client that provides access to all Polymarket-related endpoints
 * Groups market data, wallet analytics, order functionality, and WebSocket connections
 */
export class PolymarketClient {
  public readonly markets: MarketEndpoints;
  public readonly wallet: WalletEndpoints;
  public readonly orders: OrdersEndpoints;
  private readonly config: DomeSDKConfig;

  constructor(config: DomeSDKConfig) {
    this.config = config;
    this.markets = new MarketEndpoints(config);
    this.wallet = new WalletEndpoints(config);
    this.orders = new OrdersEndpoints(config);
  }

  /**
   * Creates a new WebSocket client for real-time Polymarket order data
   *
   * @param wsConfig - Optional WebSocket-specific configuration
   * @returns A new PolymarketWebSocketClient instance
   *
   * @example
   * ```typescript
   * const ws = dome.polymarket.createWebSocket();
   * await ws.connect();
   * const subscription = await ws.subscribe({
   *   users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d']
   * });
   * ws.on('order', (order) => {
   *   console.log('New order:', order);
   * });
   * ```
   */
  createWebSocket(wsConfig?: WebSocketConfig): PolymarketWebSocketClient {
    return new PolymarketWebSocketClient(this.config, wsConfig);
  }
}
