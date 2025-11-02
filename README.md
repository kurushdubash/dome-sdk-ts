# Dome TypeScript SDK

A comprehensive TypeScript SDK for interacting with the Dome API. Features include market data, wallet analytics, order tracking, and cross-platform market matching for prediction markets. For detailed API documentation, visit [DomeApi.io](https://www.domeapi.io/).

## Installation

```bash
# Using npm
npm install @dome-api/sdk

# Using yarn
yarn add @dome-api/sdk

# Using pnpm
pnpm add @dome-api/sdk
```

## Quick Start

```typescript
import { DomeClient } from '@dome-api/sdk';

// Initialize the client with your API key
const dome = new DomeClient({
  apiKey: 'your-dome-api-key-here',
});

// Get market price
const marketPrice = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
});

console.log('Market Price:', marketPrice);
```

## Configuration

The SDK accepts the following configuration options:

```typescript
interface DomeSDKConfig {
  /** Authentication token for API requests (required) */
  apiKey: string;
  /** Base URL for the API (optional, defaults to https://api.domeapi.io/v1) */
  baseURL?: string;
}
```

### Environment Variables

You can also configure the SDK using environment variables:

```bash
DOME_API_KEY=your-api-token
```

```typescript
const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY!,
});
```

## API Endpoints

### Polymarket

#### Markets

##### Get Market Price

Get current or historical market prices by token ID:

```typescript
// Current price
const price = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
});

// Historical price at specific timestamp
const historicalPrice = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
  at_time: 1740000000, // Unix timestamp (optional)
});
```

**Response:**

```typescript
{
  price: 0.65,
  at_time: 1740000000
}
```

##### Get Candlesticks

Get historical candlestick data for market analysis:

```typescript
const candlesticks = await dome.polymarket.markets.getCandlesticks({
  condition_id:
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  start_time: 1640995200, // Unix timestamp (required)
  end_time: 1672531200, // Unix timestamp (required)
  interval: 60, // Optional: 1 = 1 minute, 60 = 1 hour, 1440 = 1 day (default)
});
```

**Parameters:**

- `condition_id` (string, required): The condition ID for the market
- `start_time` (number, required): Unix timestamp for start time
- `end_time` (number, required): Unix timestamp for end time
- `interval` (1 | 60 | 1440, optional): Time interval for candles

##### Get Orderbooks

Fetch historical orderbook snapshots for a specific asset:

```typescript
const orderbooks = await dome.polymarket.markets.getOrderbooks({
  token_id: '1234567890',
  start_time: 1640995200000, // Unix timestamp in milliseconds (required)
  end_time: 1672531200000, // Unix timestamp in milliseconds (required)
  limit: 100, // Optional: number of snapshots per page (default: 100)
  pagination_key: 'abc123', // Optional: pagination key for next page
});
```

**Parameters:**

- `token_id` (string, required): The token ID for the market
- `start_time` (number, required): Unix timestamp in milliseconds
- `end_time` (number, required): Unix timestamp in milliseconds
- `limit` (number, optional): Results per page
- `pagination_key` (string, optional): Key for pagination

##### Get Markets

Fetch market data with filtering and search functionality:

```typescript
// Search by market slug
const markets = await dome.polymarket.markets.getMarkets({
  market_slug: ['bitcoin-up-or-down-july-25-8pm-et'],
  limit: 50,
  offset: 0,
});

// Filter by condition ID
const marketsByCondition = await dome.polymarket.markets.getMarkets({
  condition_id: [
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  ],
});

// Filter by tags and status
const marketsByTags = await dome.polymarket.markets.getMarkets({
  tags: ['politics', 'election'],
  status: 'open',
  min_volume: 10000,
  limit: 20,
});

// Search by event slug
const marketsByEvent = await dome.polymarket.markets.getMarkets({
  event_slug: ['presidential-election-2024'],
});
```

**Parameters:**

- `market_slug` (string[], optional): Array of market slugs
- `event_slug` (string[], optional): Array of event slugs
- `condition_id` (string[], optional): Array of condition IDs
- `tags` (string[], optional): Array of tags to filter by
- `status` ('open' | 'closed', optional): Market status filter
- `min_volume` (number, optional): Minimum volume filter
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

#### Wallet

##### Get Wallet PnL

Get profit and loss data for a wallet address:

```typescript
const walletPnL = await dome.polymarket.wallet.getWalletPnL({
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  granularity: 'day', // Required: 'day', 'week', 'month', 'year', or 'all'
  start_time: 1726857600, // Optional: Unix timestamp
  end_time: 1758316829, // Optional: Unix timestamp
});
```

**Parameters:**

- `wallet_address` (string, required): Ethereum wallet address
- `granularity` ('day' | 'week' | 'month' | 'year' | 'all', required): Time granularity
- `start_time` (number, optional): Unix timestamp for start time
- `end_time` (number, optional): Unix timestamp for end time

**Response:**

```typescript
{
  granularity: 'day',
  start_time: 1726857600,
  end_time: 1758316829,
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  pnl_over_time: [
    {
      timestamp: 1726857600,
      pnl_to_date: 1250.50
    },
    // ... more data points
  ]
}
```

#### Orders

##### Get Orders

Fetch order data with optional filtering:

```typescript
// Get orders by market
const orders = await dome.polymarket.orders.getOrders({
  market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
  limit: 50,
  offset: 0,
});

// Get orders by condition ID and time range
const ordersByCondition = await dome.polymarket.orders.getOrders({
  condition_id:
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  start_time: 1640995200,
  end_time: 1672531200,
  limit: 100,
});

// Get orders by token ID
const ordersByToken = await dome.polymarket.orders.getOrders({
  token_id: '1234567890',
  limit: 25,
});

// Get orders for a specific user
const userOrders = await dome.polymarket.orders.getOrders({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  start_time: 1640995200,
  end_time: 1672531200,
  limit: 50,
});
```

**Parameters:**

- `market_slug` (string, optional): Market slug to filter by
- `condition_id` (string, optional): Condition ID to filter by
- `token_id` (string, optional): Token ID to filter by
- `user` (string, optional): User address to filter by
- `start_time` (number, optional): Unix timestamp for start time
- `end_time` (number, optional): Unix timestamp for end time
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  orders: [
    {
      token_id: '1234567890',
      side: 'BUY',
      market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
      condition_id: '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
      shares: 100,
      shares_normalized: 0.01,
      price: 0.65,
      tx_hash: '0x...',
      title: 'Bitcoin Price',
      timestamp: 1640995200,
      order_hash: '0x...',
      user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'
    },
    // ... more orders
  ],
  pagination: {
    limit: 50,
    offset: 0,
    total: 150,
    has_more: true
  }
}
```

##### Get Activity

Fetch trading activity for a specific user (including MERGES, SPLITS, and REDEEMS):

```typescript
const activity = await dome.polymarket.orders.getActivity({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  start_time: 1640995200,
  end_time: 1672531200,
  limit: 50,
  offset: 0,
});

// Filter activity by market
const activityByMarket = await dome.polymarket.orders.getActivity({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
  limit: 25,
});

// Filter activity by condition
const activityByCondition = await dome.polymarket.orders.getActivity({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  condition_id:
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  limit: 50,
});
```

**Parameters:**

- `user` (string, required): User address
- `start_time` (number, optional): Unix timestamp for start time
- `end_time` (number, optional): Unix timestamp for end time
- `market_slug` (string, optional): Market slug to filter by
- `condition_id` (string, optional): Condition ID to filter by
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  activities: [
    {
      token_id: '1234567890',
      side: 'MERGE', // or 'SPLIT' or 'REDEEM'
      market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
      condition_id: '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
      shares: 100,
      shares_normalized: 0.01,
      price: 0.65,
      tx_hash: '0x...',
      title: 'Bitcoin Price',
      timestamp: 1640995200,
      order_hash: '0x...',
      user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'
    },
    // ... more activities
  ],
  pagination: {
    limit: 50,
    offset: 0,
    count: 75,
    has_more: true
  }
}
```

### Kalshi

#### Markets

##### Get Markets

Fetch Kalshi market data with optional filtering:

```typescript
// Get markets by market ticker
const markets = await dome.kalshi.markets.getMarkets({
  market_ticker: ['MARKET-TICKER-123'],
  limit: 50,
  offset: 0,
});

// Get markets by event ticker
const marketsByEvent = await dome.kalshi.markets.getMarkets({
  event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
  limit: 100,
});

// Filter by status and minimum volume
const openMarkets = await dome.kalshi.markets.getMarkets({
  status: 'open',
  min_volume: 50000,
  limit: 20,
});

// Get closed markets
const closedMarkets = await dome.kalshi.markets.getMarkets({
  status: 'closed',
  limit: 50,
});
```

**Parameters:**

- `market_ticker` (string[], optional): Array of market tickers
- `event_ticker` (string[], optional): Array of event tickers
- `status` ('open' | 'closed', optional): Market status filter
- `min_volume` (number, optional): Minimum volume filter
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  markets: [
    {
      event_ticker: 'KXNFLGAME-25AUG16ARIDEN',
      market_ticker: 'MARKET-TICKER-123',
      title: 'Will Team A win?',
      start_time: 1726459200,
      end_time: 1726473600,
      close_time: 1726473600,
      status: 'open',
      last_price: 65,
      volume: 125000,
      volume_24h: 25000,
      result: null
    },
    // ... more markets
  ],
  pagination: {
    limit: 50,
    offset: 0,
    total: 200,
    has_more: true
  }
}
```

##### Get Orderbooks

Fetch historical orderbook snapshots for a specific Kalshi market:

```typescript
const orderbooks = await dome.kalshi.markets.getOrderbooks({
  ticker: 'MARKET-TICKER-123',
  start_time: 1640995200000, // Unix timestamp in milliseconds (required)
  end_time: 1672531200000, // Unix timestamp in milliseconds (required)
  limit: 100, // Optional: number of snapshots per page
});
```

**Parameters:**

- `ticker` (string, required): Market ticker
- `start_time` (number, required): Unix timestamp in milliseconds
- `end_time` (number, required): Unix timestamp in milliseconds
- `limit` (number, optional): Results per page

**Response:**

```typescript
{
  snapshots: [
    {
      orderbook: {
        yes: [[65, 100], [66, 150]], // [price_in_cents, size]
        no: [[34, 200], [35, 250]],
        yes_dollars: [['0.65', 100], ['0.66', 150]], // [price_in_dollars, size]
        no_dollars: [['0.34', 200], ['0.35', 250]]
      },
      timestamp: 1640995200000,
      ticker: 'MARKET-TICKER-123'
    },
    // ... more snapshots
  ],
  pagination: {
    limit: 100,
    count: 150,
    has_more: true
  }
}
```

### Matching Markets

Find equivalent markets across different platforms:

```typescript
// By Polymarket market slugs
const matchingMarkets = await dome.matchingMarkets.getMatchingMarkets({
  polymarket_market_slug: ['nfl-ari-den-2025-08-16'],
});

// By Kalshi event tickers
const matchingMarketsKalshi = await dome.matchingMarkets.getMatchingMarkets({
  kalshi_event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
});

// By sport and date
const matchingMarketsBySport =
  await dome.matchingMarkets.getMatchingMarketsBySport({
    sport: 'nfl', // 'nfl', 'mlb', 'cfb', 'nba', or 'nhl'
    date: '2025-08-16', // YYYY-MM-DD format
  });
```

**Parameters for `getMatchingMarkets`:**

- `polymarket_market_slug` (string[], optional): Array of Polymarket market slugs
- `kalshi_event_ticker` (string[], optional): Array of Kalshi event tickers

**Parameters for `getMatchingMarketsBySport`:**

- `sport` ('nfl' | 'mlb' | 'cfb' | 'nba' | 'nhl', required): Sport type
- `date` (string, required): Date in YYYY-MM-DD format

**Response:**

```typescript
{
  markets: {
    'nfl-ari-den-2025-08-16': [
      {
        platform: 'POLYMARKET',
        market_slug: 'nfl-ari-den-2025-08-16',
        token_ids: ['1234567890', '0987654321']
      },
      {
        platform: 'KALSHI',
        event_ticker: 'KXNFLGAME-25AUG16ARIDEN',
        market_tickers: ['MARKET-TICKER-123', 'MARKET-TICKER-456']
      }
    ]
  }
}
```

## Error Handling

The SDK provides comprehensive error handling:

```typescript
try {
  const result = await dome.polymarket.markets.getMarketPrice({
    token_id: 'invalid-token',
  });
} catch (error) {
  if (error.message.includes('API Error')) {
    console.error('API Error:', error.message);
  } else {
    console.error('Network Error:', error.message);
  }
}
```

## Integration Testing

The SDK includes a comprehensive integration test that makes live calls to the real API endpoints to verify everything works correctly.

```bash
# Run integration tests with your API key
yarn integration-test YOUR_API_KEY
```

This smoke test covers all endpoints with various parameter combinations and provides detailed results. See `src/tests/README.md` for more information.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- **Kurush Dubash** - [kurush@domeapi.com](mailto:kurush@domeapi.com)
- **Kunal Roy** - [kunal@domeapi.com](mailto:kunal@domeapi.com)
