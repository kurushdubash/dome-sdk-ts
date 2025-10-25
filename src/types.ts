/**
 * Configuration options for initializing the Dome SDK
 */
export interface DomeSDKConfig {
  /** Authentication token for API requests */
  apiKey: string;
  /** Base URL for the API (defaults to https://api.domeapi.io/v1/) */
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

// ===== Orderbook History Types =====
export interface OrderbookLevel {
  size: string;
  price: string;
}

export interface OrderbookSnapshot {
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  hash: string;
  minOrderSize: string;
  negRisk: boolean;
  assetId: string;
  timestamp: number;
  tickSize: string;
  indexedAt: number;
  market: string;
}

export interface OrderbookHistoryPagination {
  limit: number;
  count: number;
  has_more: boolean;
}

export interface OrderbookHistoryResponse {
  snapshots: OrderbookSnapshot[];
  pagination: OrderbookHistoryPagination;
}

export interface GetOrderbookHistoryParams {
  token_id: string;
  start_time: number;
  end_time: number;
  limit?: number;
}

// ===== Markets Types =====
export interface MarketOutcome {
  outcome: string;
  token_id: string;
}

export interface Market {
  market_slug: string;
  condition_id: string;
  title: string;
  description: string;
  outcomes: MarketOutcome[];
  start_time: number;
  end_time: number;
  volume: number;
  liquidity: number;
  tags: string[];
  status: 'ACTIVE' | 'CLOSED' | 'RESOLVED';
}

export interface MarketsResponse {
  markets: Market[];
  pagination: Pagination;
}

export interface GetMarketsParams {
  market_slug?: string[];
  condition_id?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
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
  sport: 'nfl' | 'mlb';
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

// ===== HTTP Client Types =====
export interface RequestConfig {
  timeout?: number;
  headers?: Record<string, string>;
}
