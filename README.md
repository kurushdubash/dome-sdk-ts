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
  token_id:
    '56369772478534954338683665819559528414197495274302917800610633957542171787417',
});

console.log('Market Price:', marketPrice);
// { price: 0.65, at_time: 1766634610 }
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

## Pagination

Most endpoints that return lists support cursor-based pagination using `pagination_key` for efficient navigation through large datasets. The SDK maintains backwards compatibility with offset-based pagination, but `pagination_key` is recommended for better performance.

### Using Cursor-Based Pagination (Recommended)

```typescript
// Get first page
const firstPage = await dome.polymarket.orders.getOrders({
  market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
  limit: 50,
});

// Check if more results exist
if (firstPage.pagination.has_more) {
  // Get next page using pagination_key
  const secondPage = await dome.polymarket.orders.getOrders({
    market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
    limit: 50,
    pagination_key: firstPage.pagination.pagination_key,
  });
}
```

### Using Offset-Based Pagination (Legacy)

For backwards compatibility, offset-based pagination is still supported:

```typescript
// First page
const firstPage = await dome.polymarket.markets.getMarkets({
  status: 'open',
  limit: 20,
  offset: 0,
});

// Second page
const secondPage = await dome.polymarket.markets.getMarkets({
  status: 'open',
  limit: 20,
  offset: 20,
});
```

**Note:** Offset-based pagination may have limitations for large offsets. Use `pagination_key` for optimal performance.

## API Endpoints

### Polymarket

#### Markets

##### Get Market Price

Get current or historical market prices by token ID:

```typescript
// Current price
const price = await dome.polymarket.markets.getMarketPrice({
  token_id:
    '56369772478534954338683665819559528414197495274302917800610633957542171787417',
});

// Historical price at specific timestamp
const historicalPrice = await dome.polymarket.markets.getMarketPrice({
  token_id:
    '56369772478534954338683665819559528414197495274302917800610633957542171787417',
  at_time: 1760470000, // Unix timestamp (optional)
});
```

**Response:**

```typescript
{
  price: 0.65,
  at_time: 1766634610
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
  token_id:
    '56369772478534954338683665819559528414197495274302917800610633957542171787417',
  start_time: 1760470000000, // Unix timestamp in milliseconds (required)
  end_time: 1760480000000, // Unix timestamp in milliseconds (required)
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
  limit: 10,
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
- `token_id` (string[], optional): Array of token IDs
- `tags` (string[], optional): Array of tags to filter by
- `status` ('open' | 'closed', optional): Market status filter
- `min_volume` (number, optional): Minimum volume filter
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset (deprecated, use pagination_key)
- `pagination_key` (string, optional): Pagination key for next page (recommended)
- `start_time` (number, optional): Filter markets from this timestamp
- `end_time` (number, optional): Filter markets until this timestamp

##### Get Events

Fetch events (groups of related markets) with optional filtering:

```typescript
// Get all open events
const events = await dome.polymarket.markets.getEvents({
  status: 'open',
  limit: 10,
});

// Get specific event with its markets
const event = await dome.polymarket.markets.getEvents({
  event_slug: 'presidential-election-winner-2028',
  include_markets: true,
});

// Filter by tags
const sportsEvents = await dome.polymarket.markets.getEvents({
  tags: ['sports', 'football'],
  limit: 20,
});
```

**Parameters:**

- `event_slug` (string, optional): Specific event slug to fetch
- `tags` (string[], optional): Array of tags to filter by
- `status` ('open' | 'closed', optional): Event status filter
- `include_markets` (boolean, optional): Include full market data in response
- `start_time` (number, optional): Filter events from this timestamp
- `end_time` (number, optional): Filter events until this timestamp
- `game_start_time` (number, optional): Filter by game start time (for sports events)
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  events: [
    {
      event_slug: 'presidential-election-winner-2028',
      title: 'Presidential Election Winner 2028',
      subtitle: 'Who will win the 2028 US Presidential Election?',
      status: 'open',
      start_time: 1704067200,
      end_time: 1730851200,
      volume_fiat_amount: 3686335059.29,
      settlement_sources: 'Associated Press',
      rules_url: null,
      image: 'https://polymarket.com/images/election-2024.png',
      tags: ['politics', 'elections'],
      market_count: 17,
      markets: [...] // Only present when include_markets=true
    }
  ],
  pagination: {
    limit: 10,
    offset: 0,
    total: 500,
    has_more: true
  }
}
```

#### Wallet

##### Get Wallet

Get wallet information by EOA or proxy address:

```typescript
// Get wallet by EOA address
const wallet = await dome.polymarket.wallet.getWallet({
  eoa: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  with_metrics: true, // Optional: include trading metrics
});

// Get wallet by proxy address
const walletByProxy = await dome.polymarket.wallet.getWallet({
  proxy: '0x60881d7dce725bfb0399ee0b11cc11f5782f257d',
});
```

**Parameters:**

- `eoa` (string, optional): EOA wallet address (either eoa or proxy required)
- `proxy` (string, optional): Proxy wallet address (either eoa or proxy required)
- `with_metrics` (boolean, optional): Include trading metrics in response
- `start_time` (number, optional): Start time for metrics calculation
- `end_time` (number, optional): End time for metrics calculation

**Response:**

```typescript
{
  eoa: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  proxy: '0x60881d7dce725bfb0399ee0b11cc11f5782f257d',
  wallet_type: 'safe',
  wallet_metrics: {
    total_volume: 150000.50,
    total_trades: 450,
    total_markets: 25,
    highest_volume_day: {
      date: '2025-10-12',
      volume: 25000.75,
      trades: 145
    },
    merges: 262,
    splits: 31,
    conversions: 4,
    redemptions: 2338
  }
}
```

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

##### Get Positions

Fetch active positions for a specific wallet address:

```typescript
const positions = await dome.polymarket.wallet.getPositions({
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  limit: 50, // Optional: results per page (default: 100)
  pagination_key: 'abc123', // Optional: pagination key for next page
});
```

**Parameters:**

- `wallet_address` (string, required): Ethereum wallet address
- `limit` (number, optional): Results per page (default: 100)
- `pagination_key` (string, optional): Key for pagination

**Response:**

```typescript
{
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  positions: [
    {
      wallet: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
      token_id: '56369772478534954338683665819559528414197495274302917800610633957542171787417',
      condition_id: '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
      title: 'Will Bitcoin reach $100K by December 2025?',
      shares: 1500000,
      shares_normalized: 1.5,
      redeemable: false,
      market_slug: 'bitcoin-above-100k',
      event_slug: 'bitcoin-price-2025',
      image: 'https://...',
      label: 'Yes',
      winning_outcome: null, // null if market not resolved, otherwise { outcome_index: 0, outcome_label: 'Yes' }
      start_time: 1640995200,
      end_time: 1672531200,
      completed_time: null,
      close_time: 1672531200,
      game_start_time: null,
      market_status: 'open',
      negativeRisk: false
    },
    // ... more positions
  ],
  pagination: {
    has_more: true,
    limit: 50,
    pagination_key: 'next_page_key'
  }
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
  token_id:
    '56369772478534954338683665819559528414197495274302917800610633957542171787417',
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
      token_id: '56369772478534954338683665819559528414197495274302917800610633957542171787417',
      token_label: 'Yes',
      side: 'BUY',
      market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
      condition_id: '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
      shares: 1000000,
      shares_normalized: 1.0,
      price: 0.65,
      tx_hash: '0x...',
      title: 'Bitcoin Price',
      timestamp: 1640995200,
      order_hash: '0x...',
      user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
      taker: '0x...'
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
      token_id: '56369772478534954338683665819559528414197495274302917800610633957542171787417',
      side: 'MERGE', // or 'SPLIT' or 'REDEEM'
      market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
      condition_id: '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
      shares: 1000000,
      shares_normalized: 1.0,
      price: 1.0,
      tx_hash: '0x...',
      title: 'Bitcoin Price',
      timestamp: 1640995200,
      order_hash: '',
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

#### WebSocket - Real-time Order Events

Subscribe to real-time Polymarket order data via WebSocket. Perfect for copy-trading applications where speed is critical.

##### Basic Usage

```typescript
// Create a WebSocket client
const ws = dome.polymarket.createWebSocket();

// Connect to the WebSocket server
await ws.connect();

// Subscribe to orders for specific wallet addresses
const subscription = await ws.subscribe({
  users: [
    '0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d',
    '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  ],
});

console.log('Subscribed with ID:', subscription.subscription_id);
```

##### Filter Types

The WebSocket supports three types of filters:

**Filter by Users:**

```typescript
const subscription = await ws.subscribe({
  users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'],
});
```

**Filter by Condition IDs:**

```typescript
const subscription = await ws.subscribe({
  condition_ids: [
    '0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113',
  ],
});
```

**Filter by Market Slugs:**

```typescript
const subscription = await ws.subscribe({
  market_slugs: ['btc-updown-15m-1762755300'],
});
```

// Subscribe to orders by condition IDs
const subscriptionByCondition = await ws.subscribe({
condition_ids: [
'0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113',
],
});

// Subscribe to orders by market slugs
const subscriptionByMarket = await ws.subscribe({
market_slugs: ['btc-updown-15m-1762755300'],
});

// Listen for order events
ws.on('order', order => {
console.log('New order received:', {
token_id: order.token_id,
token_label: order.token_label,
side: order.side,
market_slug: order.market_slug,
price: order.price,
shares: order.shares_normalized,
user: order.user,
taker: order.taker,
timestamp: order.timestamp,
});
});

// Listen for connection events
ws.on('open', () => {
console.log('WebSocket connected');
});

ws.on('close', () => {
console.log('WebSocket disconnected');
});

ws.on('error', error => {
console.error('WebSocket error:', error);
});

````

##### Configuration Options

Configure reconnection behavior and event handlers:

```typescript
const ws = dome.polymarket.createWebSocket({
  // Custom WebSocket URL (defaults to wss://ws.domeapi.io)
  wsURL: 'wss://ws.domeapi.io',

  // Reconnection settings
  reconnect: {
    enabled: true, // Enable automatic reconnection (default: true)
    maxAttempts: 10, // Maximum reconnection attempts (default: 10)
    delay: 1000, // Base delay in milliseconds for exponential backoff (default: 1000)
    // Reconnection delays: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s
  },

  // Event callbacks
  onOpen: () => {
    console.log('Connection opened');
  },
  onClose: () => {
    console.log('Connection closed');
  },
  onError: error => {
    console.error('Connection error:', error);
  },
});
````

##### Managing Subscriptions

```typescript
// Subscribe to multiple users
const sub1 = await ws.subscribe({
  users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'],
});

const sub2 = await ws.subscribe({
  condition_ids: [
    '0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113',
  ],
});

// Get all active subscriptions
const activeSubscriptions = ws.getActiveSubscriptions();
console.log('Active subscriptions:', activeSubscriptions);
// [
//   {
//     subscription_id: 'sub_abc123',
//     filters: { users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'] }
//   },
//   {
//     subscription_id: 'sub_def456',
//     filters: { condition_ids: ['0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113'] }
//   }
// ]

// Update an existing subscription's filters (more efficient than unsubscribe + subscribe)
await ws.update(sub1.subscription_id, {
  users: ['0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'],
});

// Switch from user filters to condition ID filters
await ws.update(sub1.subscription_id, {
  condition_ids: [
    '0x17815081230e3b9c78b098162c33b1ffa68c4ec29c123d3d14989599e0c2e113',
  ],
});

// Unsubscribe from a specific subscription
await ws.unsubscribe(sub1.subscription_id);

// Check connection status
if (ws.isConnected()) {
  console.log('WebSocket is connected');
}

// Close the connection (automatically unsubscribes from all subscriptions)
ws.close();
```

##### Automatic Reconnection

The SDK automatically handles reconnection with exponential backoff:

- **Automatic reconnection**: Enabled by default
- **Exponential backoff**: Delays increase exponentially (1s, 2s, 4s, 8s, etc.)
- **Max attempts**: Default 10 attempts (configurable)
- **Auto re-subscription**: All subscriptions are automatically re-established after reconnection

```typescript
// Disable auto-reconnection if needed
const ws = dome.polymarket.createWebSocket({
  reconnect: {
    enabled: false,
  },
});

// Or customize reconnection behavior
const ws = dome.polymarket.createWebSocket({
  reconnect: {
    enabled: true,
    maxAttempts: 5, // Only try 5 times
    delay: 2000, // Start with 2 second delays
  },
});
```

##### Order Event Data

Order events match the format of the orders API endpoint:

```typescript
ws.on('order', order => {
  // Order object structure:
  console.log({
    token_id: order.token_id, // Token ID
    token_label: order.token_label, // Token label (e.g., 'Yes', 'No')
    side: order.side, // 'BUY' or 'SELL'
    market_slug: order.market_slug, // Market identifier
    condition_id: order.condition_id, // Condition ID
    shares: order.shares, // Raw shares amount
    shares_normalized: order.shares_normalized, // Normalized shares
    price: order.price, // Price (0-1)
    tx_hash: order.tx_hash, // Transaction hash
    title: order.title, // Market title
    timestamp: order.timestamp, // Unix timestamp
    order_hash: order.order_hash, // Order hash
    user: order.user, // User wallet address (maker)
    taker: order.taker, // Taker wallet address
  });
});
```

##### Complete Example

```typescript
import { DomeClient } from '@dome-api/sdk';

const dome = new DomeClient({
  apiKey: 'your-api-key',
});

async function trackOrders() {
  const ws = dome.polymarket.createWebSocket({
    reconnect: {
      enabled: true,
      maxAttempts: 10,
    },
  });

  // Handle connection events
  ws.on('open', () => {
    console.log('✅ Connected to WebSocket');
  });

  ws.on('close', () => {
    console.log('❌ Disconnected from WebSocket');
  });

  ws.on('error', error => {
    console.error('⚠️ WebSocket error:', error.message);
  });

  // Connect
  await ws.connect();

  // Subscribe to orders
  const subscription = await ws.subscribe({
    users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'],
  });

  console.log(`📡 Subscribed: ${subscription.subscription_id}`);

  // Handle incoming orders
  ws.on('order', order => {
    console.log(`📦 New ${order.side} order:`, {
      market: order.market_slug,
      token_label: order.token_label,
      price: order.price,
      shares: order.shares_normalized,
      user: order.user,
      taker: order.taker,
    });
  });

  // Keep the process alive
  // In a real application, you might want to keep this running
  // process.on('SIGINT', () => {
  //   ws.close();
  //   process.exit(0);
  // });
}

trackOrders().catch(console.error);
```

**Filter Types:**

You can filter orders by:

- **users**: Array of wallet addresses to track
- **condition_ids**: Array of condition IDs to track
- **market_slugs**: Array of market slugs to track

**Important Notes:**

- The WebSocket server only supports receiving order information (no user inputs besides subscribe/unsubscribe/update)
- If disconnected, the SDK automatically reconnects and re-subscribes to all previous subscriptions
- Order event data follows the same format as the [orders API endpoint](https://docs.domeapi.io/api-reference/endpoint/get-trade-history)
- Subscriptions are tracked internally and can be managed via `getActiveSubscriptions()`
- Use `update()` to modify subscription filters without creating a new subscription (more efficient than unsubscribe + subscribe)

### Kalshi

#### Markets

##### Get Market Price

Get current or historical market prices for a Kalshi market by ticker:

```typescript
// Get current price for both yes and no sides
const price = await dome.kalshi.markets.getMarketPrice({
  market_ticker: 'KXMAYORNYCPARTY-25-D',
});

// Get historical price at specific timestamp
const historicalPrice = await dome.kalshi.markets.getMarketPrice({
  market_ticker: 'KXMAYORNYCPARTY-25-D',
  at_time: 1760470000, // Unix timestamp in seconds (optional)
});
```

**Parameters:**

- `market_ticker` (string, required): The Kalshi market ticker
- `at_time` (number, optional): Unix timestamp in seconds for historical price

**Response:**

```typescript
{
  yes: {
    price: 89,
    at_time: 1766634610
  },
  no: {
    price: 11,
    at_time: 1766634610
  }
}
```

##### Get Markets

Fetch Kalshi market data with optional filtering:

```typescript
// Get markets by market ticker (tickers can contain special characters like ".", "/", ")", "(")
const markets = await dome.kalshi.markets.getMarkets({
  market_ticker: ['KXMAYORNYCPARTY-25-D', '538APPROVE-22AUG03-B38.4'],
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

- `market_ticker` (string[], optional): Array of market tickers (can contain special characters like ".", "/", ")", "(")
- `event_ticker` (string[], optional): Array of event tickers (can contain special characters like ".", "/", ")", "(")
- `status` ('open' | 'closed', optional): Market status filter
- `min_volume` (number, optional): Minimum volume filter
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  markets: [
    {
      event_ticker: 'KXMAYORNYCPARTY-25',
      market_ticker: 'KXMAYORNYCPARTY-25-D', // Can contain special characters like ".", "/", ")", "("
      title: 'Will a representative of the Democratic party win the NYC Mayor race in 2025?',
      start_time: 1731150000,
      end_time: 1793775600,
      close_time: 1793775600,
      status: 'open',
      last_price: 89,
      volume: 18261146,
      volume_24h: 931138,
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
// Ticker can contain special characters like ".", "/", ")", "("
const orderbooks = await dome.kalshi.markets.getOrderbooks({
  ticker: 'KXMAYORNYCPARTY-25-D',
  start_time: 1760470000000, // Unix timestamp in milliseconds (required)
  end_time: 1760480000000, // Unix timestamp in milliseconds (required)
  limit: 100, // Optional: number of snapshots per page
});
```

**Parameters:**

- `ticker` (string, required): Market ticker (can contain special characters like ".", "/", ")", "(")
- `start_time` (number, required): Unix timestamp in milliseconds
- `end_time` (number, required): Unix timestamp in milliseconds
- `limit` (number, optional): Results per page

##### Get Trades

Fetch historical trade data for Kalshi markets:

```typescript
// Get trades by ticker (ticker can contain special characters like ".", "/", ")", "(")
const trades = await dome.kalshi.markets.getTrades({
  ticker: 'KXNFLGAME-25NOV09PITLAC-PIT',
  limit: 50,
  offset: 0,
});

// Get trades with time range
const tradesByTime = await dome.kalshi.markets.getTrades({
  ticker: 'KXNFLGAME-25NOV09PITLAC-PIT',
  start_time: 1762716000, // Unix timestamp in seconds
  end_time: 1762720600,
  limit: 100,
});
```

**Parameters:**

- `ticker` (string, optional): Market ticker to filter trades (can contain special characters)
- `start_time` (number, optional): Start time in Unix timestamp (seconds)
- `end_time` (number, optional): End time in Unix timestamp (seconds)
- `limit` (number, optional): Results per page
- `offset` (number, optional): Pagination offset

**Response:**

```typescript
{
  trades: [
    {
      trade_id: '587f9eb0-1ae1-7b53-9536-fcf3fc503630',
      market_ticker: 'KXNFLGAME-25NOV09PITLAC-PIT',
      count: 93,
      yes_price: 1,
      no_price: 99,
      yes_price_dollars: 0.01,
      no_price_dollars: 0.99,
      taker_side: 'yes',
      created_time: 1762718746
    },
    // ... more trades
  ],
  pagination: {
    limit: 50,
    offset: 0,
    total: 43154,
    has_more: true
  }
}
```

**Response:**

```typescript
{
  snapshots: [
    {
      orderbook: {
        yes: [[75, 100], [76, 150]], // [price_in_cents, size]
        no: [[24, 200], [25, 250]],
        yes_dollars: [['0.75', 100], ['0.76', 150]], // [price_in_dollars, size]
        no_dollars: [['0.24', 200], ['0.25', 250]]
      },
      timestamp: 1760471849407,
      ticker: 'KXMAYORNYCPARTY-25-D' // Can contain special characters
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
    sport: 'nfl', // 'nfl', 'mlb', 'cfb', 'nba', 'nhl', or 'cbb'
    date: '2025-08-16', // YYYY-MM-DD format
  });
```

**Parameters for `getMatchingMarkets`:**

- `polymarket_market_slug` (string[], optional): Array of Polymarket market slugs
- `kalshi_event_ticker` (string[], optional): Array of Kalshi event tickers (can contain special characters like ".", "/", ")", "(")

**Parameters for `getMatchingMarketsBySport`:**

- `sport` ('nfl' | 'mlb' | 'cfb' | 'nba' | 'nhl' | 'cbb', required): Sport type
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
        market_tickers: ['KXNFLGAME-25AUG16ARIDEN-ARI', 'KXNFLGAME-25AUG16ARIDEN-DEN'] // Can contain special characters
      }
    ]
  }
}
```

### Crypto Prices

#### Binance Prices

Fetch historical crypto price data from Binance:

```typescript
// Get latest price
const latestPrice = await dome.cryptoPrices.getBinancePrices({
  currency: 'btcusdt', // Currency format: lowercase, no separators (e.g., btcusdt, ethusdt)
});

// Get prices with time range
const prices = await dome.cryptoPrices.getBinancePrices({
  currency: 'btcusdt',
  start_time: 1766130000000, // Unix timestamp in milliseconds
  end_time: 1766131000000,
  limit: 100,
  pagination_key: 'abc123', // Optional: for pagination
});
```

**Parameters:**

- `currency` (string, required): Currency pair (lowercase, no separators, e.g., `btcusdt`, `ethusdt`)
- `start_time` (number, optional): Start time in Unix milliseconds
- `end_time` (number, optional): End time in Unix milliseconds
- `limit` (number, optional): Results per page (max: 100)
- `pagination_key` (string, optional): Pagination key for next page

**Response:**

```typescript
{
  prices: [
    {
      symbol: 'btcusdt',
      value: '67500.50',
      timestamp: 1766130500000
    },
    // ... more prices
  ],
  pagination_key: 'eyJpZCI6IlBSSUNFI2J0Y3VzZHQiLCJ0aW1lc3RhbXAiOjE3NjYxMzEwMDAwMDB9',
  total: 100
}
```

#### Chainlink Prices

Fetch historical crypto price data from Chainlink:

```typescript
// Get latest price
const latestPrice = await dome.cryptoPrices.getChainlinkPrices({
  currency: 'eth/usd', // Currency format: slash-separated (e.g., btc/usd, eth/usd)
});

// Get prices with time range
const prices = await dome.cryptoPrices.getChainlinkPrices({
  currency: 'eth/usd',
  start_time: 1766130000000, // Unix timestamp in milliseconds
  end_time: 1766131000000,
  limit: 100,
  pagination_key: 'abc123', // Optional: for pagination
});
```

**Parameters:**

- `currency` (string, required): Currency pair (slash-separated, e.g., `btc/usd`, `eth/usd`)
- `start_time` (number, optional): Start time in Unix milliseconds
- `end_time` (number, optional): End time in Unix milliseconds
- `limit` (number, optional): Results per page (max: 100)
- `pagination_key` (string, optional): Pagination key for next page

**Response:**

```typescript
{
  prices: [
    {
      symbol: 'eth/usd',
      value: 3250.75,
      timestamp: 1766130500000
    },
    // ... more prices
  ],
  pagination_key: 'eyJpZCI6IkNIQUlOTElOSyNidGMvdXNkIiwidGltZXN0YW1wIjoxNzY2MTMxMDAwMDAwfQ==',
  total: 100
}
```

## Router Integration (Wallet-Agnostic Trading)

The SDK includes router helpers for integrating prediction market trading into your application with any wallet provider (Privy, MetaMask, WalletConnect, etc.).

### Quick Start with Privy (Server-Side)

For backends using Privy to manage user wallets, integration is **extremely simple** - just pass wallet info from your database:

```typescript
import { PolymarketRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// Step 1: Initialize router with Privy config (ONCE in your app)
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  }
);

const router = new PolymarketRouter({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  // Builder server automatically enabled for all orders
});

// Step 2: Link user (one-time per user, store credentials in your DB)
const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);
const credentials = await router.linkUser({
  userId: user.id,
  signer,
});
// Store credentials in your database

// Step 3: Place orders - JUST PASS WALLET INFO!
await router.placeOrder(
  {
    userId: user.id,
    marketId:
      '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    side: 'buy',
    size: 5,
    price: 0.99,
    // No signer needed - router uses Privy config automatically!
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);
```

**Key Benefits:**

- ✅ **Multi-user support** - Works with any number of wallets
- ✅ **No manual signer creation per order** - Just pass `privyWalletId` and `walletAddress`
- ✅ **Server-side only** - No user popups or frontend dependencies
- ✅ **Direct CLOB** - Places orders directly on Polymarket

See [`examples/privy-polymarket-simple.ts`](./examples/privy-polymarket-simple.ts) for a complete working example.

### Dome Builder Server (Always Enabled)

All orders automatically use Dome's builder server (`https://builder-signer.domeapi.io/builder-signer/sign`) for:

- **Better order routing and execution** - Access to private order flow
- **Reduced MEV exposure** - Orders are less visible to front-runners
- **Priority order matching** - Builder-signed orders get priority
- **Zero configuration** - Works automatically with no setup required

The builder server signs orders alongside your user's signature, providing these benefits transparently. See [`examples/privy-with-builder.ts`](./examples/privy-with-builder.ts) for implementation details.

### Overview

The router pattern allows users to:

1. Sign **ONE** EIP-712 message to create a Polymarket CLOB API key
2. Trade using API keys thereafter (no wallet signatures per trade)
3. Works with any wallet provider that implements the `RouterSigner` interface

This is ideal for applications that want to abstract away the complexity of prediction market trading while providing a smooth user experience.

### Basic Example

```typescript
import { PolymarketRouter, RouterSigner, Eip712Payload } from '@dome-api/sdk';

// Step 1: Create a signer adapter for your wallet provider
const signer: RouterSigner = {
  async getAddress() {
    // Return user's wallet address
    return '0x...';
  },
  async signTypedData(payload: Eip712Payload) {
    // Sign EIP-712 payload with user's wallet
    return '0x...signature...';
  },
};

// Step 2: Initialize router
const router = new PolymarketRouter({
  baseURL: 'https://api.domeapi.io/v1',
  apiKey: process.env.DOME_API_KEY,
});

// Step 3: Link user (one-time setup)
await router.linkUser({
  userId: 'user-123',
  signer,
});

// Step 4: Place orders without signatures!
await router.placeOrder({
  userId: 'user-123',
  marketId: 'bitcoin-above-100k',
  side: 'buy',
  size: 10,
  price: 0.65,
});
```

### Wallet Provider Adapters

The SDK is wallet-agnostic. You just need to implement the `RouterSigner` interface:

**Privy Example:**

```typescript
import { usePrivy } from '@privy-io/react-auth';

const { user, signTypedData } = usePrivy();

const signer: RouterSigner = {
  async getAddress() {
    return user.wallet.address;
  },
  async signTypedData(payload) {
    return await signTypedData(payload);
  },
};
```

**MetaMask Example:**

```typescript
const signer: RouterSigner = {
  async getAddress() {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    return accounts[0];
  },
  async signTypedData(payload) {
    const address = await this.getAddress();
    return await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(payload)],
    });
  },
};
```

### Complete Example

See the [`examples/`](./examples) directory for complete integration examples:

- **Privy Integration** ([`examples/privy-integration.ts`](./examples/privy-integration.ts)): Server-side and client-side Privy integration
- **Router README** ([`examples/README.md`](./examples/README.md)): Architecture overview, custom signer examples, and more

### Architecture

```
User Wallet → RouterSigner → Dome Router → Polymarket CLOB
   (Privy, MetaMask, etc.)     (SDK)       (Backend)     (Exchange)
```

**Benefits:**

- Users sign once, trade forever (with API keys)
- Works with any wallet provider
- Your backend handles exchange-specific complexity
- Easy to add more exchanges in the future

## Fee Escrow

The SDK includes support for Dome's fee escrow system, which enables secure fee collection for prediction market orders. The escrow module provides EIP-712 signed fee authorizations that are verified on-chain.

### PolymarketRouterWithEscrow

For automatic fee handling, use `PolymarketRouterWithEscrow` which extends the standard router:

```typescript
import { PolymarketRouterWithEscrow, escrow } from '@dome-api/sdk';

const router = new PolymarketRouterWithEscrow({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  escrow: {
    feeBps: 25n, // 0.25% fee
    escrowAddress: escrow.ESCROW_CONTRACT_POLYGON,
  },
});

// Place order with automatic fee authorization
const result = await router.placeOrderWithEscrow(
  {
    userId: user.id,
    marketId: 'token-id-here',
    side: 'buy',
    size: 100, // $100 USDC
    price: 0.65,
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);

// Result includes signed fee authorization
console.log(result.feeAuth); // { orderId, payer, feeAmount, deadline, signature }
```

### Direct Escrow Module Usage

For more control, use the escrow module directly:

```typescript
import { escrow } from '@dome-api/sdk';

// Generate deterministic order ID
const orderId = escrow.generateOrderId({
  chainId: 137,
  userAddress: '0x...',
  marketId: 'market-token-id',
  side: 'buy',
  size: escrow.parseUsdc(100), // $100
  price: 0.65,
  timestamp: Date.now(),
});

// Create fee authorization
const feeAmount = escrow.calculateFee(escrow.parseUsdc(100), 25n); // 0.25% of $100
const feeAuth = escrow.createFeeAuthorization(orderId, payerAddress, feeAmount);

// Sign with ethers wallet
const signedAuth = await escrow.signFeeAuthorization(
  wallet,
  escrow.ESCROW_CONTRACT_POLYGON,
  feeAuth,
  137 // chainId
);

// Or sign with RouterSigner (Privy, MetaMask, etc.)
const signedAuth = await escrow.signFeeAuthorizationWithSigner(
  signer,
  escrow.ESCROW_CONTRACT_POLYGON,
  feeAuth,
  137
);
```

### Utility Functions

```typescript
import { escrow } from '@dome-api/sdk';

// USDC formatting (6 decimals)
const amount = escrow.parseUsdc(100); // 100000000n ($100)
const formatted = escrow.formatUsdc(amount); // "100.00"

// Fee calculation
const fee = escrow.calculateFee(escrow.parseUsdc(100), 25n); // 0.25% = $0.25
console.log(escrow.formatUsdc(fee)); // "0.25"

// BPS formatting
console.log(escrow.formatBps(25n)); // "0.25%"

// Verify order ID
const isValid = escrow.verifyOrderId(orderId, orderParams);
```

### Constants

```typescript
import { escrow } from '@dome-api/sdk';

// Polygon contract addresses
escrow.ESCROW_CONTRACT_POLYGON; // Fee escrow contract
escrow.USDC_POLYGON; // USDC token address
```

### Wallet Types: EOA vs SAFE

The escrow system supports two wallet types. The key difference is **who signs** vs **who pays**.

**EOA (Externally Owned Account)**

Standard wallet where the same address signs and pays:

```typescript
// EOA: Same address signs and pays
const signature = await userWallet.signTypedData(domain, types, {
  orderId,
  payer: userWallet.address, // EOA is the payer
  feeAmount,
  deadline,
});

// Signature verification: ECDSA (ecrecover)
// Contract checks: recovered_signer == payer
```

**SAFE (Smart Contract Wallet)**

Multi-sig wallet where an EOA owner signs, but the SAFE contract pays:

```typescript
// SAFE: EOA owner signs, Safe pays
const signature = await safeOwnerWallet.signTypedData(domain, types, {
  orderId,
  payer: safeContractAddress, // SAFE is the payer (not the signer!)
  feeAmount,
  deadline,
});

// Signature verification: EIP-1271
// Contract calls: Safe.isValidSignature(hash, signature)
// Safe validates that the EOA owner is an authorized signer
```

| Aspect | EOA | SAFE |
|--------|-----|------|
| `payer` parameter | User's EOA address | SAFE contract address |
| Who signs | EOA (same as payer) | EOA owner of the SAFE |
| Who holds USDC | EOA | SAFE contract |
| Signature verification | ECDSA | EIP-1271 |
| USDC approval from | EOA | SAFE (via Safe tx) |

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

The SDK includes a comprehensive integration test suite that makes live calls to the real API endpoints to verify everything works correctly. The tests cover all endpoints including markets, orders, wallet analytics, events, and cross-platform matching.

### Running Tests

#### Test Against Local Source (Development)

Test your local changes before publishing:

```bash
# Run integration tests against local source code
yarn integration-test YOUR_API_KEY

# Or with npm
npm run integration-test YOUR_API_KEY
```

#### Test Against Published Package (Verification)

Test the published npm package to verify it works correctly in production:

```bash
# Run integration tests against the published @dome-api/sdk package
yarn integration-test YOUR_API_KEY --external

# Or with npm
npm run integration-test YOUR_API_KEY --external
```

**What the `--external` flag does:**

- Fetches the latest published version from npm
- Installs `@dome-api/sdk` (if not already present)
- Imports `DomeClient` from the published package
- Runs all tests against the published version

This is useful for:

- ✅ Verifying the published package works correctly
- ✅ Testing that build/packaging didn't break anything
- ✅ Comparing local changes vs. published version
- ✅ Pre-publish verification

### Complete Testing Workflow

Here's the recommended workflow before publishing a new version:

```bash
# Step 1: Build your changes
yarn build

# Step 2: Test local changes
yarn integration-test YOUR_API_KEY

# Step 3: Publish to npm (if tests pass)
npm publish

# Step 4: Verify published package works
yarn integration-test YOUR_API_KEY --external
```

### Test Coverage

The integration tests verify:

**Polymarket Endpoints:**

- ✅ Market price (current & historical)
- ✅ Candlestick data
- ✅ Orderbook history with pagination
- ✅ Markets filtering (by slug, event, condition, token, tags, status, volume)
- ✅ Events (by slug, tags, status, with/without markets)
- ✅ Wallet information and metrics
- ✅ Wallet PnL (all granularities)
- ✅ Positions with pagination
- ✅ Orders with pagination_key based pagination
- ✅ Activity tracking
- ✅ WebSocket subscriptions

**Kalshi Endpoints:**

- ✅ Market price (current & historical)
- ✅ Markets filtering
- ✅ Trades with pagination
- ✅ Orderbook history

**Cross-Platform:**

- ✅ Matching markets by slug/ticker
- ✅ Matching markets by sport and date

**Crypto Prices:**

- ✅ Binance prices with pagination
- ✅ Chainlink prices with pagination

### Example Output

```
🚀 Starting Dome SDK Integration Test...

📊 Testing Polymarket Market Endpoints...
✅ PASSED: Polymarket: Get Market Price (current)
✅ PASSED: Polymarket: Get Candlesticks (1 hour intervals)
✅ PASSED: Polymarket: Get Markets (by slug)
✅ PASSED: Polymarket: Get Events (by event slug with markets)

💰 Testing Polymarket Wallet Endpoints...
✅ PASSED: Polymarket: Get Wallet
✅ PASSED: Polymarket: Get Positions (pagination with pagination_key)

📋 Testing Polymarket Orders Endpoints...
✅ PASSED: Polymarket: Get Orders (pagination with pagination_key)

📊 Integration Test Summary
========================
✅ Passed: 85
❌ Failed: 0
📈 Success Rate: 100.0%

🎉 All integration tests passed!
```

### Testing Specific Scenarios

You can modify the test file to focus on specific endpoints:

```typescript
// In src/tests/integration-test.ts
// Comment out test sections you don't need to run
```

### Troubleshooting

**"Package not found" error with `--external`:**

```bash
# Manually install the package first
npm install @dome-api/sdk --no-save
```

**Test a specific published version:**

```bash
# Install specific version
npm install @dome-api/sdk@1.2.3 --no-save

# Run tests
yarn integration-test YOUR_API_KEY --external
```

**Test local build without publishing:**

```bash
# Create a local package
yarn build
yarn pack

# Install in a test project
npm install /path/to/dome-api-sdk-x.x.x.tgz
```

### API Rate Limits

The integration tests make many API calls. If you encounter rate limiting:

- Wait a few minutes between test runs
- Contact support to increase your rate limits
- Run tests with a smaller subset of endpoints

For more details on the test implementation, see [`src/tests/integration-test.ts`](./src/tests/integration-test.ts).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- **Kurush Dubash** - [kurush@domeapi.com](mailto:kurush@domeapi.com)
- **Kunal Roy** - [kunal@domeapi.com](mailto:kunal@domeapi.com)
