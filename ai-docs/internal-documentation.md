# Dome SDK Internal Documentation

## Overview

This is the internal documentation for the Dome TypeScript SDK. This document is intended for AI assistants and developers working on the SDK codebase itself. It provides architectural insights, implementation details, and conventions used throughout the project.

## Project Structure

```
dome-sdk-ts/
├── src/
│   ├── index.ts                 # Main entry point, exports DomeClient
│   ├── types.ts                 # All TypeScript type definitions
│   ├── base-client.ts           # Base HTTP client with auth & error handling
│   ├── endpoints/
│   │   ├── index.ts            # Re-exports all endpoint modules
│   │   ├── matching-markets-endpoints.ts
│   │   ├── polymarket/
│   │   │   ├── index.ts
│   │   │   ├── polymarket-client.ts    # Main Polymarket client
│   │   │   ├── market-endpoints.ts
│   │   │   ├── wallet-endpoints.ts
│   │   │   ├── orders-endpoints.ts
│   │   │   └── websocket-client.ts     # Real-time WebSocket client
│   │   └── kalshi/
│   │       ├── index.ts
│   │       ├── kalshi-client.ts        # Main Kalshi client
│   │       └── kalshi-endpoints.ts
│   └── tests/
│       ├── index.test.ts
│       ├── integration-test.ts
│       └── README.md
├── dist/                        # Build output (generated)
│   ├── cjs/                    # CommonJS build
│   ├── esm/                    # ES Module build
│   └── types/                  # TypeScript declarations
├── ai-docs/                    # AI-specific documentation
├── package.json
├── tsconfig.json               # Base TypeScript config
├── tsconfig.cjs.json           # CommonJS build config
├── tsconfig.esm.json           # ES Module build config
└── tsconfig.types.json         # Type declarations config
```

## Architecture

### Client Hierarchy

The SDK uses a hierarchical client structure:

1. **DomeClient** (src/index.ts:27)
   - Main entry point
   - Aggregates all platform-specific clients
   - Properties: `polymarket`, `kalshi`, `matchingMarkets`

2. **BaseClient** (src/base-client.ts:8)
   - Abstract base class for all API clients
   - Provides authenticated HTTP request functionality
   - Handles API key validation and error handling
   - Used by all endpoint classes

3. **Platform Clients**
   - **PolymarketClient** (src/endpoints/polymarket/polymarket-client.ts:11)
     - Properties: `markets`, `wallet`, `orders`
     - Method: `createWebSocket()` for real-time data
   - **KalshiClient** (src/endpoints/kalshi/kalshi-client.ts)
     - Properties: `markets`

4. **Endpoint Classes**
   - Extend BaseClient
   - Implement specific API endpoints
   - Examples: MarketEndpoints, WalletEndpoints, OrdersEndpoints

### HTTP Client Implementation

**Location:** src/base-client.ts:8

Key features:

- Uses axios for HTTP requests
- Automatic Bearer token authentication
- Query parameter serialization with array support (explode: true format)
- Error handling with typed API errors
- 30-second default timeout

**makeRequest Method** (src/base-client.ts:23):

```typescript
protected async makeRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  params?: Record<string, any>,
  options?: RequestConfig
): Promise<T>
```

**Array Serialization** (src/base-client.ts:44):
Arrays in query parameters are serialized as repeated params:

- Input: `{tags: ['a', 'b']}`
- Output: `?tags=a&tags=b`

### WebSocket Implementation

**Location:** src/endpoints/polymarket/websocket-client.ts:63

The WebSocket client provides real-time order data streaming.

**Key Features:**

1. **Cross-platform Support** (src/endpoints/polymarket/websocket-client.ts:18)
   - Uses `ws` package in Node.js
   - Uses native WebSocket in browsers

2. **Automatic Reconnection** (src/endpoints/polymarket/websocket-client.ts:326)
   - Exponential backoff: delay = baseDelay × 2^(attempt-1)
   - Configurable max attempts (default: 10)
   - Default base delay: 1000ms
   - Sequence: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s

3. **Subscription Management** (src/endpoints/polymarket/websocket-client.ts:192)
   - Subscribe/unsubscribe to user order streams
   - Automatic re-subscription after reconnection
   - Subscription tracking via Map

4. **Event Emitter** (src/endpoints/polymarket/websocket-client.ts:63)
   - Extends Node.js EventEmitter
   - Events: 'open', 'close', 'error', 'order', 'message'

**Connection Flow:**

1. Client calls `connect()`
2. WebSocket opens to `wss://ws.domeapi.io/{apiKey}`
3. Client calls `subscribe({ users: [...] })`
4. Server sends 'ack' message with subscription_id
5. Server streams 'event' messages with order data
6. On disconnect, auto-reconnect if enabled
7. After reconnect, all subscriptions are re-established

### Type System

**Location:** src/types.ts

All types are defined in a single file for easy reference. Key type categories:

1. **Configuration Types** (src/types.ts:4)
   - DomeSDKConfig: SDK initialization
   - WebSocketConfig: WebSocket options
   - RequestConfig: HTTP request options

2. **Request/Response Pairs**
   - Pattern: `Get{Feature}Params` and `{Feature}Response`
   - Example: GetMarketPriceParams, MarketPriceResponse

3. **Domain Types**
   - Order, Activity, Market types
   - Candlestick data structures
   - Orderbook snapshots

4. **WebSocket Types** (src/types.ts:365)
   - Message types: Subscribe, Unsubscribe, Ack, Event
   - Subscription filters

### Build System

The SDK supports three output formats:

1. **CommonJS** (dist/cjs/)
   - Config: tsconfig.cjs.json
   - Entry: package.json:main

2. **ES Modules** (dist/esm/)
   - Config: tsconfig.esm.json
   - Entry: package.json:module

3. **Type Declarations** (dist/types/)
   - Config: tsconfig.types.json
   - Entry: package.json:types

**Build Process:**

```bash
npm run build
# Runs: clean → build:cjs → build:esm → build:types
```

## API Patterns

### Endpoint Method Structure

All endpoint methods follow this pattern:

```typescript
async methodName(params: RequestParams): Promise<ResponseType> {
  return this.makeRequest<ResponseType>(
    'GET',  // or POST, PUT, DELETE
    '/path/to/endpoint',
    params
  );
}
```

### Error Handling

**Location:** src/base-client.ts:63

Errors are caught and transformed:

1. Axios errors with response data → `API Error: {error} - {message}`
2. Network/other errors → `Request failed: {message}`

### Pagination Pattern

Most list endpoints return pagination metadata:

```typescript
interface Pagination {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
}
```

Some endpoints (orderbooks) use cursor-based pagination with `pagination_key`.

## Development Guidelines

### Adding New Endpoints

1. **Define Types** in src/types.ts
   - Request params interface
   - Response interface
   - Add to relevant domain section

2. **Create Endpoint Class**
   - Extend BaseClient
   - Implement endpoint methods using makeRequest
   - Add JSDoc comments with examples

3. **Update Client**
   - Add property to relevant platform client
   - Initialize in constructor

4. **Export**
   - Export from module index.ts
   - Re-export types if needed

### Testing

**Unit Tests:** src/tests/index.test.ts

- Test individual functions
- Mock HTTP responses

**Integration Tests:** src/tests/integration-test.ts

- Real API calls
- Requires valid API key
- Run with: `yarn integration-test YOUR_API_KEY`

### Code Quality

**Linting:**

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

**Formatting:**

```bash
npm run format       # Format code
npm run format:check # Check formatting
```

**Pre-commit Hooks:**

- Configured via Husky
- Runs lint-staged on staged files
- Config: .lintstagedrc.json

### Versioning & Publishing

**Version Bump:**

```bash
npm run version:patch  # 0.0.1 → 0.0.2
npm run version:minor  # 0.0.1 → 0.1.0
npm run version:major  # 0.0.1 → 1.0.0
```

**Publishing:**

```bash
npm run prepublishOnly  # Runs build, lint, test
npm publish            # Publishes to npm
```

## Key Implementation Details

### WebSocket Subscription Tracking

**Location:** src/endpoints/polymarket/websocket-client.ts:71

Subscriptions are stored in a Map: `Map<subscription_id, WebSocketSubscribeMessage>`

This allows:

1. Tracking active subscriptions
2. Re-subscribing after reconnection
3. Managing unsubscribe operations

### Reconnection Logic

**Location:** src/endpoints/polymarket/websocket-client.ts:161

The `onclose` handler checks:

1. Was closure intentional? (close() called)
2. Is reconnection enabled?
3. Have we exceeded max attempts?

If all checks pass, scheduleReconnect() is called.

### Re-subscription After Reconnect

**Location:** src/endpoints/polymarket/websocket-client.ts:365

On reconnection:

1. Store all subscription messages
2. Clear old subscription IDs (invalid after reconnect)
3. Set up temporary ack handler
4. Send all subscription messages
5. Match incoming acks to subscriptions (FIFO)
6. Update Map with new subscription IDs

### Query Parameter Serialization

**Location:** src/base-client.ts:44

Custom serializer handles arrays:

- Arrays → repeated params (e.g., `tag=a&tag=b`)
- Undefined/null values are omitted
- All values converted to strings

This matches OpenAPI's "explode: true" style parameter.

## Common Patterns

### Optional Parameters

Most methods use optional parameters with default values applied server-side:

```typescript
interface GetOrdersParams {
  market_slug?: string;
  limit?: number; // Server default: 100
  offset?: number; // Server default: 0
}
```

### Timestamp Handling

Two patterns:

1. **Unix seconds:** Most endpoints (e.g., market prices, candlesticks)
2. **Unix milliseconds:** Orderbook endpoints

Always check the API docs for the expected format.

### Market Identification

Different platforms use different identifiers:

**Polymarket:**

- market_slug: Human-readable (e.g., 'bitcoin-up-or-down-july-25-8pm-et')
- condition_id: Hex string (e.g., '0x4567b275...')
- token_id: Numeric string (e.g., '1234567890')

**Kalshi:**

- event_ticker: Event identifier (e.g., 'KXNFLGAME-25AUG16ARIDEN')
- market_ticker: Specific market (e.g., 'MARKET-TICKER-123')

## Troubleshooting

### Common Issues

1. **"DOME_API_KEY is required"**
   - Config validation in BaseClient constructor
   - Ensure apiKey is provided

2. **WebSocket reconnection failures**
   - Check reconnect config
   - Verify API key is valid
   - Check network connectivity

3. **Array parameters not working**
   - Verify using array type in params
   - Check paramsSerializer in makeRequest

4. **Type errors during build**
   - Run `npm run build:types`
   - Check for circular dependencies
   - Verify all types are exported

## Future Considerations

### Planned Features

- Rate limiting handling
- Request retry logic
- Response caching
- Batch operations
- More WebSocket event types

### Extension Points

1. **New Platforms**
   - Create new client class (e.g., ManifoldClient)
   - Add endpoint classes
   - Update DomeClient to include new platform

2. **Custom HTTP Options**
   - RequestConfig can be extended
   - Pass custom headers, timeout, etc.

3. **WebSocket Extensions**
   - Support more event types
   - Add filtering options
   - Implement heartbeat/ping-pong

## Dependencies

### Production Dependencies

- **axios** (^1.7.2): HTTP client
- **ws** (^8.18.0): WebSocket for Node.js
- **tslib** (^2.8.1): TypeScript runtime helpers

### Development Dependencies

- **TypeScript** (^5.9.3): Language
- **Jest** (^29.7.0): Testing framework
- **ESLint** (^8.57.0): Linting
- **Prettier** (^3.3.2): Code formatting
- **Husky** (^9.0.11): Git hooks
- **lint-staged** (^15.2.7): Pre-commit linting

## Contact

For SDK development questions:

- Kurush Dubash: kurush@domeapi.com
- Kunal Roy: kunal@domeapi.com

## Token Allowances

### Location

- `src/utils/allowances.ts` - Generic allowance utilities
- `src/utils/privy.ts` - Privy-specific allowance utilities

### Purpose

Manages ERC20 (USDC) and ERC1155 (CTF) token allowances for Polymarket trading.

### Key Functions

**Generic (src/utils/allowances.ts):**

1. **checkAllAllowances(walletAddress, provider)** - Check if all 6 allowances are set
2. **setAllAllowances(signer, provider, onProgress?)** - Set all missing allowances
3. **getPolygonProvider(rpcUrl?)** - Get configured Polygon provider

**Privy-specific (src/utils/privy.ts):**

1. **checkPrivyWalletAllowances(walletAddress, rpcUrl?)** - Check allowances for Privy wallet
2. **setPrivyWalletAllowances(privy, walletId, walletAddress, options?)** - Set allowances using Privy's sendTransaction API
   - `options.onProgress?` - Callback for progress updates
   - `options.sponsor?` - Use Privy gas sponsorship (default: false)

### Implementation Details

- Uses ethers v5 (compatible with clob-client)
- Creates `RouterSignerAdapter` class to wrap our `RouterSigner` interface as ethers `Signer`
- Checks allowances via `allowance()` and `isApprovedForAll()` contract calls
- Sets approvals with max uint256 (unlimited allowance)
- Only sets allowances that are missing (safe to call multiple times)
- Privy allowance functions use `walletApi.ethereum.sendTransaction()` for direct transaction submission

### Privy Gas Sponsorship

When using Privy, you can enable gas sponsorship to pay for allowance transactions:

```typescript
await setPrivyWalletAllowances(privyClient, walletId, address, {
  onProgress: (step, current, total) =>
    console.log(`[${current}/${total}] ${step}`),
  sponsor: true, // Privy pays gas fees
});
```

This passes `sponsor: true` to Privy's `sendTransaction()` API.

### Integration

The `PolymarketRouter` class (src/router/polymarket.ts) exposes:

- `router.checkAllowances(address, rpcUrl?)` - Check allowance status
- `router.setAllowances(signer, rpcUrl?, onProgress?)` - Set missing allowances

For Privy integration, the router's `linkUser()` method:

- Accepts `privyWalletId` to enable auto-allowances
- Accepts `sponsorGas` to use Privy's gas sponsorship
- Automatically sets missing allowances before credential derivation

These are exported from `src/router/index.ts` for public use.

## Privy Integration

### Location

`src/utils/privy.ts`

### Purpose

Provides utility functions for integrating Privy wallets with the Dome SDK.

### Key Exports

1. **createPrivyClient(config)** - Create a PrivyClient instance
2. **createPrivySigner(privy, walletId, walletAddress)** - Create a RouterSigner from Privy wallet
3. **createPrivySignerFromEnv(walletId, walletAddress)** - Create signer using environment variables
4. **checkPrivyWalletAllowances(walletAddress, rpcUrl?)** - Check allowance status
5. **setPrivyWalletAllowances(privy, walletId, walletAddress, options?)** - Set missing allowances

### Configuration Interface

```typescript
interface PrivyConfig {
  appId: string; // PRIVY_APP_ID
  appSecret: string; // PRIVY_APP_SECRET
  authorizationKey: string; // PRIVY_AUTHORIZATION_KEY (wallet-auth:...)
}
```

### SetPrivyWalletAllowancesOptions

```typescript
interface SetPrivyWalletAllowancesOptions {
  onProgress?: (step: string, current: number, total: number) => void;
  sponsor?: boolean; // Use Privy gas sponsorship (default: false)
}
```

### RouterSigner Implementation

The `createPrivySigner()` function creates a `RouterSigner` that:

- Returns the wallet address via `getAddress()`
- Signs EIP-712 typed data via Privy's `walletApi.ethereum.signTypedData()`

This allows Privy wallets to work with any component expecting a `RouterSigner`.

## Dome Builder Server

### Location

`src/router/polymarket.ts` (lines 91-101)

### Purpose

All orders automatically route through Dome's builder server for improved execution.

### Configuration

```typescript
import { BuilderConfig as PolymarketBuilderConfig } from '@polymarket/builder-signing-sdk';

this.builderConfig = new PolymarketBuilderConfig({
  remoteBuilderConfig: {
    url: 'https://builder-signer.domeapi.io/builder-signer/sign',
  },
});
```

### Benefits

- **Better order routing and execution** - Access to private order flow
- **Reduced MEV exposure** - Orders are less visible to front-runners
- **Priority order matching** - Builder-signed orders get priority
- **Zero configuration** - Works automatically for all orders

### Integration

The `builderConfig` is passed to the ClobClient constructor when creating user-specific clients in both `linkUser()` and `placeOrder()` methods.

## Additional Resources

- User-facing README: README.md
- Integration tests: src/tests/README.md
- External documentation: ai-docs/external-documentation.md
- Allowances guide: ALLOWANCES_GUIDE.md
