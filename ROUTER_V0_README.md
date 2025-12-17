# Polymarket Router: Server-Side Order Placement

## Overview

The Polymarket Router provides a simple interface for placing orders on Polymarket with:

- **Server-side order placement** via Dome API (geo-unrestricted)
- **Privy wallet integration** for embedded wallets
- **Safe wallet support** for external wallets (MetaMask, Rabby, etc.)
- **Builder attribution** for improved order execution

## Quick Start

### Installation

```bash
npm install @dome-api/sdk @privy-io/server-auth
```

### Basic Usage

```typescript
import { PolymarketRouter, createPrivySignerFromEnv } from '@dome-api/sdk';

// 1. Initialize router with Dome API key
const router = new PolymarketRouter({
  chainId: 137, // Polygon mainnet
  apiKey: process.env.DOME_API_KEY, // Required for placeOrder
});

// 2. Create signer from Privy credentials
const signer = createPrivySignerFromEnv(walletId, walletAddress);

// 3. Link user (ONE signature to create CLOB credentials)
const credentials = await router.linkUser({
  userId: 'user-123',
  signer,
});

// 4. Store credentials in your database!
// await db.storeCredentials(userId, credentials);

// 5. Place orders (no wallet signature required!)
const order = await router.placeOrder(
  {
    userId: 'user-123',
    marketId: 'token-id',
    side: 'buy',
    size: 100,
    price: 0.5,
    signer,
  },
  credentials
);

console.log('Order placed:', order);
// { success: true, status: 'matched', transactionHashes: [...] }
```

## How It Works

### Order Flow

```
1. SDK creates & signs order locally (using Privy/wallet)
2. SDK sends signed order to Dome server
3. Dome server adds builder attribution headers
4. Dome server posts to Polymarket CLOB
5. Response returned to SDK
```

### Benefits

- **Geo-unrestricted**: Orders placed from Dome servers (not blocked regions)
- **Builder attribution**: Orders routed through Dome's builder for better execution
- **Observability**: Order volume and latency metrics available
- **No signature popups**: After initial linkUser, no wallet signatures needed

## Configuration

### Router Options

```typescript
const router = new PolymarketRouter({
  // Required for placeOrder
  apiKey: process.env.DOME_API_KEY,

  // Optional
  chainId: 137, // 137 = Polygon mainnet, 80002 = Amoy testnet
  clobEndpoint: 'https://clob.polymarket.com',
  rpcUrl: 'https://polygon-rpc.com',
});
```

### Environment Variables

```bash
# Dome API
DOME_API_KEY=your_dome_api_key

# Privy (for embedded wallets)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_AUTHORIZATION_KEY=wallet-auth:...
```

## API Reference

### `linkUser(params)`

Creates Polymarket CLOB API credentials via one wallet signature.

```typescript
const credentials = await router.linkUser({
  userId: 'user-123',
  signer,
  walletType: 'eoa', // 'eoa' or 'safe'
});

// Returns: { apiKey, apiSecret, apiPassphrase }
// Store these in your database!
```

### `placeOrder(params, credentials?)`

Places an order on Polymarket via Dome server.

```typescript
const order = await router.placeOrder(
  {
    userId: 'user-123',
    marketId:
      '104173557214744537570424345347209544585775842950109756851652855913015295701992',
    side: 'buy',
    size: 100, // Number of shares
    price: 0.5, // Price per share (0-1)
    signer,
    negRisk: false, // Set true for neg-risk markets
  },
  credentials
);

// Returns:
// {
//   success: true,
//   orderId: '...',
//   status: 'matched' | 'LIVE' | 'DELAYED',
//   transactionHashes: ['0x...'],
//   metadata: { region: 'eu-west-1', latencyMs: 90 }
// }
```

### `setCredentials(userId, credentials)`

Manually set credentials (load from your database).

```typescript
const stored = await db.getCredentials(userId);
router.setCredentials(userId, stored);
```

### `getCredentials(userId)`

Get stored credentials from memory.

```typescript
const creds = router.getCredentials(userId);
```

## Wallet Types

### EOA Wallets (Privy Embedded)

```typescript
const router = new PolymarketRouter({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY,
});

const signer = createPrivySignerFromEnv(walletId, walletAddress);

await router.linkUser({
  userId: 'user-123',
  signer,
  walletType: 'eoa', // default
});
```

### Safe Wallets (External - MetaMask, etc.)

```typescript
const result = await router.linkUser({
  userId: 'user-123',
  signer,
  walletType: 'safe',
  autoDeploySafe: true,
  autoSetAllowances: true,
});

// Place orders with Safe address as funder
await router.placeOrder(
  {
    userId: 'user-123',
    marketId: '...',
    side: 'buy',
    size: 100,
    price: 0.5,
    signer,
    walletType: 'safe',
    funderAddress: result.safeAddress,
  },
  result.credentials
);
```

## Credential Storage

**IMPORTANT:** Store credentials securely in your database!

```typescript
// Example with Prisma
await prisma.polymarketCredentials.create({
  data: {
    userId: user.id,
    apiKey: credentials.apiKey,
    apiSecret: encrypt(credentials.apiSecret),
    apiPassphrase: encrypt(credentials.apiPassphrase),
  },
});

// Retrieve later
const stored = await prisma.polymarketCredentials.findUnique({
  where: { userId: user.id },
});

router.setCredentials(user.id, {
  apiKey: stored.apiKey,
  apiSecret: decrypt(stored.apiSecret),
  apiPassphrase: decrypt(stored.apiPassphrase),
});
```

## Error Handling

```typescript
try {
  const order = await router.placeOrder(params, credentials);
} catch (error) {
  if (error.message.includes('Dome API key')) {
    // Missing or invalid API key
  } else if (error.message.includes('Order rejected')) {
    // Polymarket rejected the order (insufficient balance, invalid market, etc.)
  } else if (error.message.includes('No credentials')) {
    // Need to call linkUser first
  }
}
```

## Examples

- **Simple Privy**: `examples/privy-polymarket-simple.ts`
- **With Allowances**: `examples/privy-with-allowances.ts`
- **External Wallet**: `examples/external-wallet-nextjs/`

## FAQ

**Q: Do I need a Dome API key?**
A: Yes, for `placeOrder()`. Get one at domeapi.io or contact support.

**Q: Where do I store credentials?**
A: In your own database. Encrypt `apiSecret` and `apiPassphrase`.

**Q: Why use Dome server instead of direct CLOB?**
A: Geo-unrestricted access, builder attribution for better execution, and observability.

**Q: What's the minimum order size?**
A: $1 minimum order value (e.g., 100 shares at $0.01 = $1).

## Support

- **Email**: kunal@domeapi.com, kurush@domeapi.com
- **Docs**: https://docs.domeapi.io
