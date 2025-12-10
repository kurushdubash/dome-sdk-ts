# Dome SDK External Documentation

## Overview

This document provides guidance for AI assistants helping users integrate and use the Dome TypeScript SDK. It includes common use cases, troubleshooting tips, best practices, and example code snippets.

## What is Dome SDK?

The Dome SDK is a TypeScript library for interacting with prediction market platforms (Polymarket, Kalshi) through a unified API. It provides:

- Market data retrieval (prices, candlesticks, orderbooks)
- Wallet analytics (PnL tracking)
- Order and activity history
- Real-time WebSocket data streaming
- Cross-platform market matching

## Installation & Setup

### Installation

```bash
npm install @dome-api/sdk
# or
yarn add @dome-api/sdk
# or
pnpm add @dome-api/sdk
```

### Basic Configuration

```typescript
import { DomeClient } from '@dome-api/sdk';

const dome = new DomeClient({
  apiKey: 'your-dome-api-key-here',
});
```

### Environment Variable Setup

```typescript
// Recommended: Use environment variables
const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY!,
});
```

## Common Use Cases

### 1. Getting Market Prices

**Simple price lookup:**

```typescript
const price = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
});

console.log(`Current price: ${price.price}`);
console.log(`Price at timestamp: ${price.at_time}`);
```

**Historical price:**

```typescript
const historicalPrice = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
  at_time: 1740000000, // Unix timestamp
});
```

### 2. Analyzing Market Trends

**Get candlestick data for charting:**

```typescript
const candlesticks = await dome.polymarket.markets.getCandlesticks({
  condition_id:
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  start_time: 1640995200,
  end_time: 1672531200,
  interval: 60, // 1 = 1 min, 60 = 1 hour, 1440 = 1 day
});

candlesticks.candlesticks.forEach(([data, metadata]) => {
  console.log(`Token: ${metadata.token_id}`);
  data.forEach(candle => {
    console.log(`Time: ${candle.end_period_ts}`);
    console.log(`Price: ${candle.price.open} → ${candle.price.close}`);
    console.log(`Volume: ${candle.volume}`);
  });
});
```

### 3. Searching for Markets

**Search by market slug:**

```typescript
const markets = await dome.polymarket.markets.getMarkets({
  market_slug: ['bitcoin-up-or-down-july-25-8pm-et'],
  limit: 50,
});

markets.markets.forEach(market => {
  console.log(`${market.title}`);
  console.log(`Status: ${market.status}`);
  console.log(`Volume: $${market.volume_total}`);
});
```

**Filter by tags and status:**

```typescript
const openPoliticsMarkets = await dome.polymarket.markets.getMarkets({
  tags: ['politics', 'election'],
  status: 'open',
  min_volume: 100000, // Minimum $100k volume
  limit: 20,
});
```

### 4. Tracking Wallet Performance

**Get wallet PnL over time:**

```typescript
const pnl = await dome.polymarket.wallet.getWalletPnL({
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  granularity: 'day', // 'day', 'week', 'month', 'year', or 'all'
  start_time: 1726857600,
  end_time: 1758316829,
});

console.log(`Wallet: ${pnl.wallet_address}`);
pnl.pnl_over_time.forEach(dataPoint => {
  const date = new Date(dataPoint.timestamp * 1000);
  console.log(`${date.toLocaleDateString()}: $${dataPoint.pnl_to_date}`);
});
```

### 5. Analyzing Order History

**Get all orders for a market:**

```typescript
const orders = await dome.polymarket.orders.getOrders({
  market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
  limit: 100,
});

orders.orders.forEach(order => {
  console.log(
    `${order.side} ${order.shares_normalized} shares at $${order.price}`
  );
  console.log(`By: ${order.user}`);
  console.log(`Time: ${new Date(order.timestamp * 1000)}`);
});
```

**Get orders for a specific user:**

```typescript
const userOrders = await dome.polymarket.orders.getOrders({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  start_time: 1640995200,
  end_time: 1672531200,
  limit: 50,
});
```

**Get user activity (including merges/splits/redeems):**

```typescript
const activity = await dome.polymarket.orders.getActivity({
  user: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  start_time: 1640995200,
  end_time: 1672531200,
  limit: 50,
});

activity.activities.forEach(act => {
  console.log(`${act.side} operation: ${act.shares_normalized} shares`);
  console.log(`Market: ${act.market_slug}`);
});
```

### 6. Real-Time Order Tracking (WebSocket)

**Basic WebSocket usage:**

```typescript
// Create WebSocket client
const ws = dome.polymarket.createWebSocket();

// Set up event handlers
ws.on('open', () => {
  console.log('Connected to WebSocket');
});

ws.on('order', order => {
  console.log(`New ${order.side} order:`);
  console.log(`  Market: ${order.market_slug}`);
  console.log(`  Price: ${order.price}`);
  console.log(`  Shares: ${order.shares_normalized}`);
  console.log(`  User: ${order.user}`);
});

ws.on('error', error => {
  console.error('WebSocket error:', error.message);
});

// Connect and subscribe
await ws.connect();

const subscription = await ws.subscribe({
  users: [
    '0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d',
    '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  ],
});

console.log(`Subscribed: ${subscription.subscription_id}`);
```

**Advanced WebSocket with custom reconnection:**

```typescript
const ws = dome.polymarket.createWebSocket({
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delay: 2000, // 2 second base delay
  },
  onOpen: () => console.log('✅ Connected'),
  onClose: () => console.log('❌ Disconnected'),
  onError: error => console.error('⚠️  Error:', error.message),
});

await ws.connect();

// Subscribe to multiple users
const sub1 = await ws.subscribe({
  users: ['0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d'],
});

const sub2 = await ws.subscribe({
  users: ['0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b'],
});

// Check active subscriptions
const activeSubscriptions = ws.getActiveSubscriptions();
console.log('Active subscriptions:', activeSubscriptions.length);

// Later: unsubscribe from specific subscription
await ws.unsubscribe(sub1.subscription_id);

// Close connection when done
ws.close();
```

### 7. Cross-Platform Market Matching

**Find equivalent markets across platforms:**

```typescript
// By Polymarket market slug
const matches = await dome.matchingMarkets.getMatchingMarkets({
  polymarket_market_slug: ['nfl-ari-den-2025-08-16'],
});

// By Kalshi event ticker
const matchesKalshi = await dome.matchingMarkets.getMatchingMarkets({
  kalshi_event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
});

// By sport and date
const sportMatches = await dome.matchingMarkets.getMatchingMarketsBySport({
  sport: 'nfl',
  date: '2025-08-16',
});

// Process matches
Object.entries(sportMatches.markets).forEach(([key, platforms]) => {
  console.log(`Market: ${key}`);
  platforms.forEach(platform => {
    if (platform.platform === 'POLYMARKET') {
      console.log(`  Polymarket: ${platform.market_slug}`);
      console.log(`  Token IDs: ${platform.token_ids.join(', ')}`);
    } else if (platform.platform === 'KALSHI') {
      console.log(`  Kalshi: ${platform.event_ticker}`);
      console.log(`  Market tickers: ${platform.market_tickers.join(', ')}`);
    }
  });
});
```

### 8. Kalshi Market Data

**Get Kalshi markets:**

```typescript
const kalshiMarkets = await dome.kalshi.markets.getMarkets({
  event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
  limit: 50,
});

kalshiMarkets.markets.forEach(market => {
  console.log(`${market.title}`);
  console.log(`Last Price: ${market.last_price} cents`);
  console.log(`Volume: $${market.volume}`);
  console.log(`Status: ${market.status}`);
});
```

**Get Kalshi orderbook history:**

```typescript
const orderbooks = await dome.kalshi.markets.getOrderbooks({
  ticker: 'MARKET-TICKER-123',
  start_time: 1640995200000, // milliseconds
  end_time: 1672531200000,
  limit: 100,
});

orderbooks.snapshots.forEach(snapshot => {
  console.log(`Timestamp: ${new Date(snapshot.timestamp)}`);
  console.log('Yes bids:', snapshot.orderbook.yes_dollars);
  console.log('No bids:', snapshot.orderbook.no_dollars);
});
```

### 9. Analyzing Orderbook Depth

**Get Polymarket orderbook snapshots:**

```typescript
const orderbooks = await dome.polymarket.markets.getOrderbooks({
  token_id: '1234567890',
  start_time: 1640995200000, // milliseconds
  end_time: 1672531200000,
  limit: 100,
});

orderbooks.snapshots.forEach(snapshot => {
  console.log(`Timestamp: ${new Date(snapshot.timestamp)}`);
  console.log(`Bids: ${snapshot.bids.length} levels`);
  console.log(`Asks: ${snapshot.asks.length} levels`);

  // Best bid/ask
  if (snapshot.bids.length > 0) {
    const bestBid = snapshot.bids[0];
    console.log(`Best bid: ${bestBid.price} (size: ${bestBid.size})`);
  }

  if (snapshot.asks.length > 0) {
    const bestAsk = snapshot.asks[0];
    console.log(`Best ask: ${bestAsk.price} (size: ${bestAsk.size})`);
  }
});
```

### 10. Router Integration - Wallet-Agnostic Trading

**What is the router?**
The router allows users to trade on prediction markets with minimal wallet interactions:

1. User signs **ONE** EIP-712 message to create a Polymarket API key
2. All subsequent trading uses API keys (no more signatures!)
3. Works with ANY wallet provider (Privy, MetaMask, WalletConnect, etc.)
4. **Automatic builder server** - All orders use Dome's builder for improved execution

This provides a much better UX and abstracts platform-specific complexity.

**Basic router usage:**

```typescript
import { PolymarketRouter, RouterSigner, Eip712Payload } from '@dome-api/sdk';

// Step 1: Create a signer adapter for your wallet
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
  chainId: 137, // Polygon mainnet
});

// Step 3: Link user (one-time setup - prompts ONE signature)
await router.linkUser({
  userId: 'user-123',
  signer,
});

// Step 4: Place orders (no signatures needed!)
await router.placeOrder({
  userId: 'user-123',
  marketId: '0x123...', // condition_id
  side: 'buy',
  size: 10,
  price: 0.65,
  signer, // Signer needed for order signing
});
```

**Privy integration (recommended for server-side):**

The SDK provides built-in Privy utilities with auto-allowances and gas sponsorship:

```typescript
import {
  PolymarketRouter,
  createPrivySigner,
  createPrivyClient,
} from '@dome-api/sdk';

// Initialize router with Privy config
const router = new PolymarketRouter({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
});

// Create Privy client and signer
const privy = createPrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
});

const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);

// Link user with auto-allowances and optional gas sponsorship
const credentials = await router.linkUser({
  userId: user.id,
  signer,
  privyWalletId: user.privyWalletId, // Enables auto-allowances
  sponsorGas: true, // Optional: Privy pays gas fees for allowances
});

// Store credentials in your database
await db.users.update(user.id, { polymarketCredentials: credentials });

// Place orders using stored credentials
await router.placeOrder(
  {
    userId: user.id,
    marketId: '0x123...',
    side: 'buy',
    size: 10,
    price: 0.65,
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);
```

**MetaMask adapter example:**

```typescript
import { RouterSigner, Eip712Payload } from '@dome-api/sdk';

function createMetaMaskSigner(): RouterSigner {
  if (!window.ethereum) {
    throw new Error('MetaMask not installed');
  }

  return {
    async getAddress() {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      return accounts[0];
    },

    async signTypedData(payload: Eip712Payload) {
      const address = await this.getAddress();
      return await window.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(payload)],
      });
    },
  };
}
```

**Token Allowances:**

EOA wallets need 6 token approvals before trading (one-time per wallet):

- USDC approvals for 3 Polymarket contracts
- CTF token approvals for 3 Polymarket contracts

With Privy integration, these are set automatically when `privyWalletId` is passed to `linkUser()`.

For manual control:

```typescript
// Check current allowance status
const status = await router.checkAllowances(walletAddress);

if (!status.allSet) {
  // Set missing allowances (requires wallet signatures)
  await router.setAllowances(signer, undefined, (step, current, total) => {
    console.log(`[${current}/${total}] ${step}`);
  });
}
```

**Checking if user is already linked:**

```typescript
const isLinked = router.isUserLinked('user-123');

if (!isLinked) {
  // Need to link user first
  const credentials = await router.linkUser({ userId: 'user-123', signer });
  // Store credentials
} else {
  // User already linked, can trade directly
  const credentials = router.getCredentials('user-123');
  await router.placeOrder(
    {
      userId: 'user-123',
      marketId: '0x123...',
      side: 'buy',
      size: 10,
      price: 0.65,
      signer,
    },
    credentials
  );
}
```

**Architecture:**

```
User's Wallet → RouterSigner → PolymarketRouter → Dome Builder → Polymarket CLOB
   (ANY wallet)    (Adapter)         (SDK)           (Server)       (Exchange)
```

**Benefits:**

- **Better UX:** Users sign once, not for every trade
- **Wallet-agnostic:** Works with Privy, MetaMask, WalletConnect, etc.
- **Auto-allowances:** With Privy, token approvals are handled automatically
- **Gas sponsorship:** Privy can pay gas fees for allowance transactions
- **Builder server:** All orders routed through Dome's builder for improved execution, reduced MEV exposure, and priority matching

**For complete examples, see:**

- `examples/PRIVY_QUICKSTART.md` - Complete Privy integration guide
- `examples/README.md` - Architecture, custom signers, and more
- Main README.md - Router integration section

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch blocks:

```typescript
try {
  const price = await dome.polymarket.markets.getMarketPrice({
    token_id: '1234567890',
  });
  console.log('Price:', price);
} catch (error) {
  if (error.message.includes('API Error')) {
    console.error('API returned an error:', error.message);
    // Handle API errors (invalid token_id, rate limits, etc.)
  } else {
    console.error('Network or other error:', error.message);
    // Handle network errors, timeouts, etc.
  }
}
```

### 2. Rate Limiting

Be mindful of API rate limits:

```typescript
// Bad: Making many rapid requests
for (const tokenId of tokenIds) {
  await dome.polymarket.markets.getMarketPrice({ token_id: tokenId });
}

// Better: Add delays between requests
for (const tokenId of tokenIds) {
  await dome.polymarket.markets.getMarketPrice({ token_id: tokenId });
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
}

// Best: Use batch endpoints when available or implement proper rate limiting
```

### 3. WebSocket Connection Management

```typescript
// Proper WebSocket lifecycle management
const ws = dome.polymarket.createWebSocket({
  reconnect: {
    enabled: true,
    maxAttempts: 10,
  },
});

// Handle cleanup on application shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  ws.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  ws.close();
  process.exit(0);
});
```

### 4. Pagination

Handle pagination for large datasets:

```typescript
async function getAllOrders(market_slug: string) {
  const allOrders = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await dome.polymarket.orders.getOrders({
      market_slug,
      limit,
      offset,
    });

    allOrders.push(...response.orders);

    if (!response.pagination.has_more) {
      break;
    }

    offset += limit;
  }

  return allOrders;
}
```

### 5. TypeScript Usage

Take advantage of TypeScript types:

```typescript
import { Order, GetMarketsParams, MarketPriceResponse } from '@dome-api/sdk';

// Types help catch errors at compile time
const params: GetMarketsParams = {
  market_slug: ['bitcoin-up-or-down-july-25-8pm-et'],
  status: 'open',
  limit: 50,
};

const markets = await dome.polymarket.markets.getMarkets(params);

// Type-safe order processing
function processOrder(order: Order) {
  console.log(`${order.side} order for ${order.shares_normalized} shares`);
}
```

## Troubleshooting

### Authentication Errors

**Problem:** "DOME_API_KEY is required"

**Solution:**

```typescript
// Ensure API key is provided
const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY || 'your-api-key',
});

// Check environment variable is set
if (!process.env.DOME_API_KEY) {
  throw new Error('Please set DOME_API_KEY environment variable');
}
```

### WebSocket Connection Issues

**Problem:** WebSocket fails to connect or keeps disconnecting

**Solutions:**

1. Check API key validity
2. Verify network connectivity
3. Increase reconnection attempts:

```typescript
const ws = dome.polymarket.createWebSocket({
  reconnect: {
    enabled: true,
    maxAttempts: 20, // Increase from default 10
    delay: 1000,
  },
});
```

4. Add connection state monitoring:

```typescript
ws.on('close', () => {
  console.log('WebSocket closed. Will attempt reconnection...');
});

ws.on('error', error => {
  console.error('WebSocket error:', error.message);
  // Log additional details for debugging
});
```

### Timestamp Confusion

**Problem:** Unexpected timestamp formats

**Solution:** Be aware of two formats:

- **Unix seconds:** Most endpoints (markets, prices, orders)
- **Unix milliseconds:** Orderbook endpoints

```typescript
// For market prices (seconds)
const price = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
  at_time: Math.floor(Date.now() / 1000), // Convert to seconds
});

// For orderbooks (milliseconds)
const orderbooks = await dome.polymarket.markets.getOrderbooks({
  token_id: '1234567890',
  start_time: Date.now() - 86400000, // Already in milliseconds
  end_time: Date.now(),
});
```

### Empty Results

**Problem:** API returns empty arrays or no data

**Possible causes:**

1. Invalid identifier (token_id, market_slug, etc.)
2. Time range has no data
3. Market hasn't started yet or already closed

**Solution:**

```typescript
const markets = await dome.polymarket.markets.getMarkets({
  market_slug: ['potential-invalid-slug'],
});

if (markets.markets.length === 0) {
  console.log('No markets found. Check:');
  console.log('1. Market slug spelling');
  console.log('2. Market status (may be closed)');
  console.log('3. Try searching by tags or broader criteria');
}
```

### Type Errors in TypeScript

**Problem:** Type mismatches or errors

**Solution:** Ensure proper imports and type usage:

```typescript
// Import types explicitly
import { DomeClient, GetMarketsParams, MarketsResponse } from '@dome-api/sdk';

// Use types correctly
const params: GetMarketsParams = {
  tags: ['politics'], // Array of strings
  status: 'open', // Enum: 'open' | 'closed'
  limit: 50, // Number
};
```

## Performance Tips

### 1. Reuse Client Instances

```typescript
// Good: Create once, reuse
const dome = new DomeClient({ apiKey: process.env.DOME_API_KEY! });

async function getPrice(tokenId: string) {
  return dome.polymarket.markets.getMarketPrice({ token_id: tokenId });
}

// Bad: Creating new client every time
async function getPriceBad(tokenId: string) {
  const dome = new DomeClient({ apiKey: process.env.DOME_API_KEY! });
  return dome.polymarket.markets.getMarketPrice({ token_id: tokenId });
}
```

### 2. Use WebSocket for Real-Time Data

```typescript
// Instead of polling:
setInterval(async () => {
  const orders = await dome.polymarket.orders.getOrders({
    user: '0x...',
    limit: 10,
  });
  // Process orders
}, 5000); // Every 5 seconds

// Use WebSocket:
const ws = dome.polymarket.createWebSocket();
await ws.connect();
await ws.subscribe({ users: ['0x...'] });
ws.on('order', order => {
  // Process order immediately
});
```

### 3. Batch Requests When Possible

```typescript
// Instead of individual requests, use filters:
const markets = await dome.polymarket.markets.getMarkets({
  market_slug: ['market-1', 'market-2', 'market-3'],
  limit: 100,
});
```

## Integration Examples

### Express.js API Endpoint

```typescript
import express from 'express';
import { DomeClient } from '@dome-api/sdk';

const app = express();
const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY!,
});

app.get('/api/market-price/:tokenId', async (req, res) => {
  try {
    const price = await dome.polymarket.markets.getMarketPrice({
      token_id: req.params.tokenId,
    });
    res.json(price);
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: 'Failed to fetch market price' });
  }
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

### Next.js API Route

```typescript
// pages/api/market-price.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { DomeClient } from '@dome-api/sdk';

const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { tokenId } = req.query;

  if (typeof tokenId !== 'string') {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  try {
    const price = await dome.polymarket.markets.getMarketPrice({
      token_id: tokenId,
    });
    res.status(200).json(price);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
}
```

### React Hook

```typescript
import { useState, useEffect } from 'react';
import { DomeClient, MarketPriceResponse } from '@dome-api/sdk';

// Initialize client outside component
const dome = new DomeClient({
  apiKey: process.env.NEXT_PUBLIC_DOME_API_KEY!,
});

export function useMarketPrice(tokenId: string) {
  const [price, setPrice] = useState<MarketPriceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchPrice() {
      try {
        setLoading(true);
        const result = await dome.polymarket.markets.getMarketPrice({
          token_id: tokenId,
        });
        if (mounted) {
          setPrice(result);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchPrice();

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  return { price, loading, error };
}
```

### Copy Trading Bot

```typescript
import { DomeClient } from '@dome-api/sdk';

const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY!,
});

async function startCopyTrading(targetWallet: string) {
  const ws = dome.polymarket.createWebSocket({
    reconnect: {
      enabled: true,
      maxAttempts: Infinity, // Never give up
    },
  });

  ws.on('order', async order => {
    console.log(`${targetWallet} placed ${order.side} order:`);
    console.log(`  Market: ${order.market_slug}`);
    console.log(`  Price: ${order.price}`);
    console.log(`  Shares: ${order.shares_normalized}`);

    // Here you would implement your copy trading logic
    // Example: Place similar order on your account
    // await placeOrder(order.market_slug, order.side, order.shares_normalized);
  });

  await ws.connect();
  await ws.subscribe({ users: [targetWallet] });

  console.log(`✅ Now copy-trading ${targetWallet}`);
}

startCopyTrading('0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d');
```

## Additional Resources

- **API Documentation:** https://www.domeapi.io/
- **npm Package:** https://www.npmjs.com/package/@dome-api/sdk
- **GitHub Issues:** Report bugs or request features
- **Support:** Contact kurush@domeapi.com or kunal@domeapi.com

## Common Questions

**Q: Do I need separate API keys for Polymarket and Kalshi?**
A: No, one Dome API key provides access to all platforms.

**Q: Can I use this SDK in a browser?**
A: Yes, but be careful not to expose your API key. Use a backend proxy for production apps.

**Q: What's the rate limit?**
A: Check the Dome API documentation for current rate limits.

**Q: Can I get real-time price updates?**
A: Use the WebSocket client for real-time order data. For prices, you may need to calculate from orders or poll the API.

**Q: How do I convert between Polymarket and Kalshi identifiers?**
A: Use the matching markets endpoints to find equivalent markets across platforms.

**Q: What Node.js version is required?**
A: Node.js >= 18.0.0 (specified in package.json engines field)

**Q: Can I use this with JavaScript instead of TypeScript?**
A: Yes, the SDK works with JavaScript. TypeScript types are optional but recommended.
