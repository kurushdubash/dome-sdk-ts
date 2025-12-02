/**
 * Configuration options for initializing the Dome SDK
 */
export interface DomeSDKConfig {
  /** Authentication token for API requests */
  apiKey: string;
  /** Base URL for the API (defaults to https://api.domeapi.io/v1) */
  baseURL?: string;
}

// ===== Market Price Types =====
export interface MarketPriceResponse {
  price: number;
  at_time: number;
}

export interface GetMarketPriceParams {
  token_id: string;
  at_time?: number;
}

// ===== Candlestick Types =====
export interface CandlestickPrice {
  open: number;
  high: number;
  low: number;
  close: number;
  open_dollars: string;
  high_dollars: string;
  low_dollars: string;
  close_dollars: string;
  mean: number;
  mean_dollars: string;
  previous: number;
  previous_dollars: string;
}

export interface CandlestickAskBid {
  open: number;
  close: number;
  high: number;
  low: number;
  open_dollars: string;
  close_dollars: string;
  high_dollars: string;
  low_dollars: string;
}

export interface CandlestickData {
  end_period_ts: number;
  open_interest: number;
  price: CandlestickPrice;
  volume: number;
  yes_ask: CandlestickAskBid;
  yes_bid: CandlestickAskBid;
}

export interface TokenMetadata {
  token_id: string;
}

export type CandlestickTuple = [CandlestickData[], TokenMetadata];

export interface CandlesticksResponse {
  candlesticks: CandlestickTuple[];
}

export interface GetCandlesticksParams {
  condition_id: string;
  start_time: number;
  end_time: number;
  interval?: 1 | 60 | 1440;
}

// ===== Wallet PnL Types =====
export interface PnLDataPoint {
  timestamp: number;
  pnl_to_date: number;
}

export interface WalletPnLResponse {
  granularity: string;
  start_time: number;
  end_time: number;
  wallet_address: string;
  pnl_over_time: PnLDataPoint[];
}

export interface GetWalletPnLParams {
  wallet_address: string;
  granularity: 'day' | 'week' | 'month' | 'year' | 'all';
  start_time?: number;
  end_time?: number;
}

// ===== Orders Types =====
export interface Order {
  token_id: string;
  side: 'BUY' | 'SELL';
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
}

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: Pagination;
}

export interface GetOrdersParams {
  market_slug?: string;
  condition_id?: string;
  token_id?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
  user?: string;
}

// ===== Matching Markets Types =====
export interface KalshiMarket {
  platform: 'KALSHI';
  event_ticker: string;
  market_tickers: string[];
}

export interface PolymarketMarket {
  platform: 'POLYMARKET';
  market_slug: string;
  token_ids: string[];
}

export type MarketData = KalshiMarket | PolymarketMarket;

export interface MatchingMarketsResponse {
  markets: Record<string, MarketData[]>;
}

export interface GetMatchingMarketsParams {
  polymarket_market_slug?: string[];
  kalshi_event_ticker?: string[];
}

export interface GetMatchingMarketsBySportParams {
  sport: 'nfl' | 'mlb' | 'cfb' | 'nba' | 'nhl';
  date: string; // YYYY-MM-DD format
}

export interface MatchingMarketsBySportResponse {
  markets: Record<string, MarketData[]>;
  sport: string;
  date: string;
}

// ===== Error Types =====
export interface ApiError {
  error: string;
  message: string;
}

export interface ValidationError extends ApiError {
  required?: string;
}

// ===== Orderbooks Types =====
export interface OrderbookOrder {
  size: string;
  price: string;
}

export interface PolymarketOrderbookSnapshot {
  asks: OrderbookOrder[];
  bids: OrderbookOrder[];
  hash: string;
  minOrderSize: string;
  negRisk: boolean;
  assetId: string;
  timestamp: number;
  tickSize: string;
  indexedAt: number;
  market: string;
}

export interface OrderbooksPagination {
  limit: number;
  count: number;
  pagination_key?: string;
  has_more: boolean;
}

export interface PolymarketOrderbooksResponse {
  snapshots: PolymarketOrderbookSnapshot[];
  pagination: OrderbooksPagination;
}

export interface GetPolymarketOrderbooksParams {
  token_id: string;
  start_time: number; // milliseconds
  end_time: number; // milliseconds
  limit?: number;
  pagination_key?: string;
}

// ===== Markets Types =====
export interface MarketSide {
  id: string;
  label: string;
}

export interface PolymarketMarketInfo {
  market_slug: string;
  condition_id: string;
  title: string;
  start_time: number;
  end_time: number;
  completed_time: number | null;
  close_time: number | null;
  tags: string[];
  volume_1_week: number;
  volume_1_month: number;
  volume_1_year: number;
  volume_total: number;
  resolution_source: string;
  image: string;
  side_a: MarketSide;
  side_b: MarketSide;
  winning_side: MarketSide | null;
  status: 'open' | 'closed';
}

export interface MarketsResponse {
  markets: PolymarketMarketInfo[];
  pagination: Pagination;
}

export interface GetMarketsParams {
  market_slug?: string[];
  event_slug?: string[];
  condition_id?: string[];
  tags?: string[];
  status?: 'open' | 'closed';
  min_volume?: number;
  limit?: number;
  offset?: number;
}

// ===== Activity Types =====
export interface Activity {
  token_id: string;
  side: 'MERGE' | 'SPLIT' | 'REDEEM';
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
}

export interface ActivityPagination {
  limit: number;
  offset: number;
  count: number;
  has_more: boolean;
}

export interface ActivityResponse {
  activities: Activity[];
  pagination: ActivityPagination;
}

export interface GetActivityParams {
  user: string;
  start_time?: number;
  end_time?: number;
  market_slug?: string;
  condition_id?: string;
  limit?: number;
  offset?: number;
}

// ===== Kalshi Markets Types =====
export interface KalshiMarketInfo {
  event_ticker: string;
  market_ticker: string;
  title: string;
  start_time: number;
  end_time: number;
  close_time: number | null;
  status: 'open' | 'closed';
  last_price: number;
  volume: number;
  volume_24h: number;
  result: string | null;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarketInfo[];
  pagination: Pagination;
}

export interface GetKalshiMarketsParams {
  market_ticker?: string[];
  event_ticker?: string[];
  status?: 'open' | 'closed';
  min_volume?: number;
  limit?: number;
  offset?: number;
}

// ===== Kalshi Orderbooks Types =====
export interface KalshiOrderbookSnapshot {
  orderbook: {
    yes: Array<[number, number]>;
    no: Array<[number, number]>;
    yes_dollars: Array<[string, number]>;
    no_dollars: Array<[string, number]>;
  };
  timestamp: number;
  ticker: string;
}

export interface KalshiOrderbooksPagination {
  limit: number;
  count: number;
  has_more: boolean;
}

export interface KalshiOrderbooksResponse {
  snapshots: KalshiOrderbookSnapshot[];
  pagination: KalshiOrderbooksPagination;
}

export interface GetKalshiOrderbooksParams {
  ticker: string;
  start_time: number; // milliseconds
  end_time: number; // milliseconds
  limit?: number;
}

// ===== HTTP Client Types =====
export interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}

// ===== WebSocket Types =====
export interface WebSocketSubscriptionFilters {
  users: string[];
}

export interface WebSocketSubscribeMessage {
  action: 'subscribe';
  platform: 'polymarket';
  version: 1;
  type: 'orders';
  filters: WebSocketSubscriptionFilters;
}

export interface WebSocketUnsubscribeMessage {
  action: 'unsubscribe';
  version: 1;
  subscription_id: string;
}

export interface WebSocketAckMessage {
  type: 'ack';
  subscription_id: string;
}

export interface WebSocketEventMessage {
  type: 'event';
  subscription_id: string;
  data: Order;
}

export type WebSocketMessage = WebSocketAckMessage | WebSocketEventMessage;

export interface WebSocketConfig {
  /** WebSocket server URL (defaults to wss://ws.domeapi.io) */
  wsURL?: string;
  /** Reconnection settings */
  reconnect?: {
    /** Whether to automatically reconnect on disconnect (default: true) */
    enabled?: boolean;
    /** Maximum number of reconnection attempts with exponential backoff (default: 10) */
    maxAttempts?: number;
    /** Base delay in milliseconds for exponential backoff (default: 1000).
     * Actual delay = baseDelay * 2^(attempt-1), so attempts will be at:
     * 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s for 10 attempts */
    delay?: number;
  };
  /** Callback for connection open */
  onOpen?: () => void;
  /** Callback for connection close */
  onClose?: () => void;
  /** Callback for connection errors */
  onError?: (error: Error) => void;
}

// ===== Router Types (Wallet-Agnostic) =====

/**
 * EIP-712 payload shape used by Dome router / Polymarket
 * This is the structure that needs to be signed by the user's wallet
 */
export interface Eip712Payload {
  /** Domain information for EIP-712 signing */
  domain: Record<string, any>;
  /** Types definition for the structured data */
  types: Record<string, Array<{ name: string; type: string }>>;
  /** Primary type being signed */
  primaryType: string;
  /** The actual message data to be signed */
  message: Record<string, any>;
}

/**
 * Minimal interface your SDK needs from any wallet implementation
 * This keeps the SDK wallet-agnostic (works with Privy, MetaMask, RainbowKit, etc.)
 */
export interface RouterSigner {
  /** Returns the EVM address of the user wallet */
  getAddress(): Promise<string>;
  /** Signs EIP-712 typed data and returns a 0x-prefixed signature */
  signTypedData(payload: Eip712Payload): Promise<string>;
}

/**
 * One-time setup to link a user to Polymarket via Dome router
 * This establishes the connection between your user and their Polymarket account
 */
export interface LinkPolymarketUserParams {
  /** Customer's internal user ID in your system */
  userId: string;
  /** Wallet/signing implementation (Privy, MetaMask, etc.) */
  signer: RouterSigner;
}

/**
 * High-level order interface for routing via Dome backend
 * Abstracts away Polymarket CLOB specifics
 */
export interface PlaceOrderParams {
  /** Your internal user ID */
  userId: string;
  /** Market identifier (platform-specific) */
  marketId: string;
  /** Order side */
  side: 'buy' | 'sell';
  /** Order size (normalized) */
  size: number;
  /** Order price (0-1 for Polymarket) */
  price: number;
  /** Wallet/signing implementation (required for signing orders) */
  signer: RouterSigner;
  /** Optional: Privy wallet ID (if using Privy, avoids need for signer) */
  privyWalletId?: string;
  /** Optional: Wallet address (if using Privy, avoids need for signer) */
  walletAddress?: string;
}

/**
 * Privy configuration for automatic signer creation
 */
export interface PrivyRouterConfig {
  /** Privy App ID */
  appId: string;
  /** Privy App Secret */
  appSecret: string;
  /** Privy Authorization Private Key (wallet-auth:...) */
  authorizationKey: string;
}

/**
 * Configuration for Polymarket router helper
 */
export interface PolymarketRouterConfig {
  /** Chain ID (137 for Polygon mainnet, 80002 for Amoy testnet) */
  chainId?: number;
  /** Polymarket CLOB endpoint (defaults to https://clob.polymarket.com) */
  clobEndpoint?: string;
  /** Optional: Privy configuration for automatic signer creation */
  privy?: PrivyRouterConfig;
  /** @deprecated Use chainId and clobEndpoint instead */
  baseURL?: string;
  /** @deprecated Not used in v0 (direct CLOB integration) */
  apiKey?: string;
}
