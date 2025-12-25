import { EventEmitter } from 'events';
import {
  DomeSDKConfig,
  WebSocketConfig,
  WebSocketSubscribeMessage,
  WebSocketUpdateMessage,
  WebSocketUnsubscribeMessage,
  WebSocketMessage,
  WebSocketAckMessage,
  WebSocketEventMessage,
  WebSocketSubscriptionFilters,
  Order,
} from '../../types.js';

// Use ws package in Node.js, native WebSocket in browsers
// eslint-disable-next-line no-undef
type WebSocketType = typeof WebSocket;

// Lazy-loaded WebSocket implementation
let WebSocketImpl: WebSocketType | null = null;

async function getWebSocketImpl(): Promise<WebSocketType> {
  if (WebSocketImpl) {
    return WebSocketImpl;
  }

  if (typeof window === 'undefined') {
    // Node.js environment - dynamically import ws package
    const { default: WS } = await import('ws');
    WebSocketImpl = WS as unknown as WebSocketType;
  } else {
    // Browser environment - use native WebSocket
    // eslint-disable-next-line no-undef
    WebSocketImpl = WebSocket;
  }

  return WebSocketImpl;
}

/**
 * WebSocket client for real-time Polymarket order data
 *
 * Provides real-time order information from Polymarket via WebSocket.
 * Supports subscribing to orders for specific wallet addresses.
 *
 * @example
 * ```typescript
 * const ws = new PolymarketWebSocketClient({ apiKey: 'your-api-key' });
 *
 * // Subscribe to orders
 * const subscription = await ws.subscribe({
 *   users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d']
 * });
 *
 * // Listen for order events
 * ws.on('order', (order) => {
 *   console.log('New order:', order);
 * });
 *
 * // Unsubscribe
 * await ws.unsubscribe(subscription.subscription_id);
 *
 * // Close connection
 * ws.close();
 * ```
 */
interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelay: number; // Base delay in milliseconds for exponential backoff
}

export class PolymarketWebSocketClient extends EventEmitter {
  private readonly apiKey: string;
  private readonly wsURL: string;
  private readonly reconnectConfig: ReconnectConfig;
  // eslint-disable-next-line no-undef
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscriptions = new Map<string, WebSocketSubscribeMessage>();
  private isConnecting = false;
  private isIntentionallyClosed = false;

  /**
   * Creates a new WebSocket client instance
   *
   * @param config - Configuration options including API key
   * @param wsConfig - Optional WebSocket-specific configuration
   */
  constructor(config: DomeSDKConfig, wsConfig?: WebSocketConfig) {
    super();

    if (!config.apiKey) {
      throw new Error('DOME_API_KEY is required');
    }

    this.apiKey = config.apiKey;
    this.wsURL = wsConfig?.wsURL || 'wss://ws.domeapi.io';
    this.reconnectConfig = {
      enabled: wsConfig?.reconnect?.enabled ?? true,
      maxAttempts: wsConfig?.reconnect?.maxAttempts ?? 10,
      baseDelay: wsConfig?.reconnect?.delay ?? 1000,
    };

    // Set up event handlers from config
    if (wsConfig?.onOpen) {
      this.on('open', wsConfig.onOpen);
    }
    if (wsConfig?.onClose) {
      this.on('close', wsConfig.onClose);
    }
    if (wsConfig?.onError) {
      this.on('error', wsConfig.onError);
    }
  }

  /**
   * Connects to the WebSocket server
   *
   * @returns Promise that resolves when connection is established
   */
  async connect(): Promise<void> {
    const WS = await getWebSocketImpl();

    // eslint-disable-next-line no-undef
    if (this.ws?.readyState === WS.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    return new Promise((resolve, reject) => {
      try {
        const url = `${this.wsURL}/${this.apiKey}`;
        this.ws = new WS(url);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('open');

          // Re-subscribe to all previous subscriptions
          this.resubscribeAll();

          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data as string);
            this.handleMessage(message);
          } catch (error) {
            this.emit(
              'error',
              new Error(`Failed to parse WebSocket message: ${error}`)
            );
          }
        };

        this.ws.onerror = error => {
          this.isConnecting = false;
          const err = new Error(`WebSocket error: ${error}`);
          this.emit('error', err);
          reject(err);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.emit('close');

          // Attempt reconnection if enabled and not intentionally closed
          if (
            !this.isIntentionallyClosed &&
            this.reconnectConfig.enabled &&
            this.reconnectAttempts < this.reconnectConfig.maxAttempts
          ) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this.isConnecting = false;
        const err =
          error instanceof Error
            ? error
            : new Error(`Connection failed: ${error}`);
        this.emit('error', err);
        reject(err);
      }
    });
  }

  /**
   * Subscribes to order events with various filter options
   *
   * @param filters - Subscription filters. Can filter by:
   *   - users: Array of wallet addresses
   *   - condition_ids: Array of condition IDs
   *   - market_slugs: Array of market slugs
   * @returns Promise resolving to subscription acknowledgment
   *
   * @example
   * ```typescript
   * // Subscribe to specific users
   * await ws.subscribe({ users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'] });
   *
   * // Subscribe to specific condition IDs
   * await ws.subscribe({ condition_ids: ['0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113'] });
   *
   * // Subscribe to specific market slugs
   * await ws.subscribe({ market_slugs: ['btc-updown-15m-1762755300'] });
   * ```
   */
  async subscribe(
    filters: WebSocketSubscriptionFilters
  ): Promise<WebSocketAckMessage> {
    // Validate that at least one filter is provided
    if (!filters.users && !filters.condition_ids && !filters.market_slugs) {
      throw new Error(
        'At least one filter (users, condition_ids, or market_slugs) must be provided'
      );
    }

    const WS = await getWebSocketImpl();
    // eslint-disable-next-line no-undef
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      await this.connect();
    }

    const subscribeMessage: WebSocketSubscribeMessage = {
      action: 'subscribe',
      platform: 'polymarket',
      version: 1,
      type: 'orders',
      filters,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Subscription timeout: No acknowledgment received'));
      }, 10000); // 10 second timeout

      const messageHandler = (message: WebSocketMessage) => {
        if (message.type === 'ack') {
          clearTimeout(timeout);
          this.removeListener('message', messageHandler);
          // Store subscription for reconnection
          this.subscriptions.set(message.subscription_id, subscribeMessage);
          resolve(message);
        }
      };

      this.once('message', messageHandler);

      try {
        this.ws!.send(JSON.stringify(subscribeMessage));
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('message', messageHandler);
        reject(new Error(`Failed to send subscription: ${error}`));
      }
    });
  }

  /**
   * Updates an existing subscription's filters without creating a new subscription
   *
   * @param subscriptionId - The subscription ID to update
   * @param filters - New filter configuration (same format as subscribe)
   * @returns Promise that resolves when update is acknowledged
   *
   * @example
   * ```typescript
   * // Update subscription to track different users
   * await ws.update('sub_abc123', { users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'] });
   *
   * // Switch from user filters to condition ID filters
   * await ws.update('sub_abc123', { condition_ids: ['0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113'] });
   * ```
   */
  async update(
    subscriptionId: string,
    filters: WebSocketSubscriptionFilters
  ): Promise<void> {
    // Validate that at least one filter is provided
    if (!filters.users && !filters.condition_ids && !filters.market_slugs) {
      throw new Error(
        'At least one filter (users, condition_ids, or market_slugs) must be provided'
      );
    }

    const WS = await getWebSocketImpl();
    // eslint-disable-next-line no-undef
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    // Store reference to ws after null check
    const ws = this.ws;

    // Verify subscription exists
    if (!this.subscriptions.has(subscriptionId)) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const updateMessage: WebSocketUpdateMessage = {
      action: 'update',
      subscription_id: subscriptionId,
      platform: 'polymarket',
      version: 1,
      type: 'orders',
      filters,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Update timeout: No acknowledgment received'));
      }, 10000); // 10 second timeout

      const messageHandler = (message: WebSocketMessage) => {
        if (
          message.type === 'ack' &&
          message.subscription_id === subscriptionId
        ) {
          clearTimeout(timeout);
          this.removeListener('message', messageHandler);
          // Update the stored subscription with new filters
          const existingSubscription = this.subscriptions.get(subscriptionId);
          if (existingSubscription) {
            const updatedSubscription: WebSocketSubscribeMessage = {
              ...existingSubscription,
              filters,
            };
            this.subscriptions.set(subscriptionId, updatedSubscription);
          }
          resolve();
        }
      };

      this.once('message', messageHandler);

      try {
        ws.send(JSON.stringify(updateMessage));
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('message', messageHandler);
        reject(new Error(`Failed to send update: ${error}`));
      }
    });
  }

  /**
   * Unsubscribes from a subscription
   *
   * @param subscriptionId - The subscription ID to unsubscribe from
   * @returns Promise that resolves when unsubscribed
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const WS = await getWebSocketImpl();
    // eslint-disable-next-line no-undef
    if (!this.ws || this.ws.readyState !== WS.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const unsubscribeMessage: WebSocketUnsubscribeMessage = {
      action: 'unsubscribe',
      version: 1,
      subscription_id: subscriptionId,
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Closes the WebSocket connection
   */
  close(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }

  /**
   * Gets the current connection state
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    if (!this.ws) return false;
    // Can't use async here, so we check against the standard WebSocket.OPEN constant
    // In both browser and Node.js ws package, OPEN = 1
    return this.ws.readyState === 1; // WebSocket.OPEN
  }

  /**
   * Gets all active subscriptions with their IDs and filter details
   *
   * @returns Array of active subscriptions with subscription IDs and filters
   *
   * @example
   * ```typescript
   * const subscriptions = ws.getActiveSubscriptions();
   * console.log('Active subscriptions:', subscriptions);
   * // [
   * //   {
   * //     subscription_id: 'sub_abc123',
   * //     filters: { users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'] }
   * //   }
   * // ]
   * ```
   */
  getActiveSubscriptions(): Array<{
    subscription_id: string;
    filters: WebSocketSubscriptionFilters;
  }> {
    return Array.from(this.subscriptions.entries()).map(
      ([subscriptionId, subscribeMessage]) => ({
        subscription_id: subscriptionId,
        filters: subscribeMessage.filters,
      })
    );
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    this.emit('message', message);

    if (message.type === 'event') {
      this.emit('order', message.data);
    }
  }

  /**
   * Schedules a reconnection attempt with exponential backoff
   * Delay increases exponentially: baseDelay * 2^(attempt-1)
   * This gives the server space between reconnection attempts
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      this.emit(
        'error',
        new Error(
          `Max reconnection attempts (${this.reconnectConfig.maxAttempts}) reached. Giving up.`
        )
      );
      return;
    }

    this.reconnectAttempts++;

    // Calculate exponential backoff delay: baseDelay * 2^(attempt-1)
    // Attempt 1: baseDelay * 1
    // Attempt 2: baseDelay * 2
    // Attempt 3: baseDelay * 4
    // Attempt 4: baseDelay * 8
    // etc.
    const delay =
      this.reconnectConfig.baseDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        this.emit('error', error);
        // If connection fails, scheduleReconnect will be called again
        // from the onclose handler if we haven't exceeded max attempts
      });
    }, delay);
  }

  /**
   * Re-subscribes to all previous subscriptions after reconnection
   */
  private resubscribeAll(): void {
    // Store subscription messages temporarily
    const subscriptionMessages = Array.from(this.subscriptions.values());
    // Clear old subscription IDs (they're no longer valid)
    this.subscriptions.clear();

    if (subscriptionMessages.length === 0) {
      return;
    }

    // Queue to match acks to subscriptions in order
    const pendingSubscriptions = [...subscriptionMessages];

    // Set up a handler to catch acks for re-subscriptions
    const ackHandler = (message: WebSocketMessage) => {
      if (message.type === 'ack' && pendingSubscriptions.length > 0) {
        // Match ack to the next pending subscription (FIFO)
        const subscriptionMessage = pendingSubscriptions.shift();
        if (subscriptionMessage) {
          // Store with new subscription ID
          this.subscriptions.set(message.subscription_id, subscriptionMessage);
        }

        // Remove handler once all subscriptions are re-established
        if (pendingSubscriptions.length === 0) {
          this.removeListener('message', ackHandler);
        }
      }
    };

    // Listen for acks temporarily
    this.on('message', ackHandler);

    // Re-subscribe to all previous subscriptions
    for (const subscribeMessage of subscriptionMessages) {
      this.ws!.send(JSON.stringify(subscribeMessage));
    }

    // Safety: Remove handler after timeout in case some acks don't arrive
    setTimeout(() => {
      this.removeListener('message', ackHandler);
    }, 10000);
  }
}
