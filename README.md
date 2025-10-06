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

### Market Price

Get current or historical market prices:

```typescript
// Current price
const price = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
});

// Historical price
const historicalPrice = await dome.polymarket.markets.getMarketPrice({
  token_id: '1234567890',
  at_time: 1740000000, // Unix timestamp
});
```

### Candlestick Data

Get historical candlestick data for market analysis:

```typescript
const candlesticks = await dome.polymarket.markets.getCandlesticks({
  condition_id:
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57',
  start_time: 1640995200,
  end_time: 1672531200,
  interval: 60, // 1 = 1m, 60 = 1h, 1440 = 1d
});
```

### Wallet PnL

Get profit and loss data for a wallet:

```typescript
const walletPnL = await dome.polymarket.wallet.getWalletPnL({
  wallet_address: '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b',
  granularity: 'day', // 'day', 'week', 'month', 'year', 'all'
  start_time: 1726857600,
  end_time: 1758316829,
});
```

### Orders

Get order data with filtering:

```typescript
const orders = await dome.polymarket.orders.getOrders({
  market_slug: 'bitcoin-up-or-down-july-25-8pm-et',
  limit: 50,
  offset: 0,
  start_time: 1640995200,
  end_time: 1672531200,
});
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
    sport: 'nfl',
    date: '2025-08-16',
  });
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

- **Kurush Dubash** - [kurush@dome.com](mailto:kurush@domeapi.com)
- **Kunal Roy** - [kunal@dome.com](mailto:kunal@domeapi.com)
