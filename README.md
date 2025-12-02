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

// Listen for order events
ws.on('order', order => {
  console.log('New order received:', {
    token_id: order.token_id,
    side: order.side,
    market_slug: order.market_slug,
    price: order.price,
    shares: order.shares_normalized,
    user: order.user,
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
```

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
```

##### Managing Subscriptions

```typescript
// Subscribe to multiple users
const sub1 = await ws.subscribe({
  users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'],
});

const sub2 = await ws.subscribe({
  users: ['0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'],
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
//     filters: { users: ['0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'] }
//   }
// ]

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
    user: order.user, // User wallet address
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
      price: order.price,
      shares: order.shares_normalized,
      user: order.user,
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

**Important Notes:**

- The WebSocket server only supports receiving order information (no user inputs besides subscribe/unsubscribe)
- If disconnected, the SDK automatically reconnects and re-subscribes to all previous subscriptions
- Order event data follows the same format as the [orders API endpoint](https://docs.domeapi.io/api-reference/endpoint/get-trade-history)
- Subscriptions are tracked internally and can be managed via `getActiveSubscriptions()`

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
