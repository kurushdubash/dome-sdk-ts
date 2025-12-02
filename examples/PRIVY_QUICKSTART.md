# Privy + Polymarket Quick Start

**The simplest way to add Polymarket trading to your Privy-powered app.**

## Installation

```bash
npm install @dome-api/sdk @privy-io/server-auth
```

## Setup (30 seconds)

```bash
# Get these from your Privy dashboard
export PRIVY_APP_ID="your-app-id"
export PRIVY_APP_SECRET="your-app-secret"
export PRIVY_AUTHORIZATION_KEY="wallet-auth:..."  # Create in Privy dashboard
```

## Complete Example

```typescript
import { PolymarketRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize Privy (once in your app)
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  }
);

// Initialize router with Privy (once in your app)
const router = new PolymarketRouter({
  chainId: 137, // Polygon mainnet
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
});

// For each user, link to Polymarket (ONE TIME)
async function linkUser(user) {
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  const credentials = await router.linkUser({
    userId: user.id,
    signer,
  });

  // Store credentials in your database
  await db.users.update(user.id, {
    polymarketCredentials: credentials,
  });

  return credentials;
}

// Place orders (as many as you want, no signatures!)
async function placeOrder(user, marketId, side, size, price) {
  // Get credentials from your database
  const credentials = await db.users.get(user.id).polymarketCredentials;

  const order = await router.placeOrder(
    {
      userId: user.id,
      marketId,
      side, // 'buy' or 'sell'
      size,
      price, // 0-1 for Polymarket
      // Just pass wallet info - no signer needed!
      privyWalletId: user.privyWalletId,
      walletAddress: user.walletAddress,
    },
    credentials
  );

  return order;
}

// Usage
const user = await db.users.get('user-123');

// Link user (first time only)
if (!user.polymarketCredentials) {
  await linkUser(user);
}

// Place order (no popups, no signatures!)
await placeOrder(
  user,
  '60487116984468020978247225474488676749601001829886755968952521846780452448915',
  'buy',
  5,
  0.99
);
```

## How It Works

1. **Initialize once** - Set up router with Privy config (happens once when your server starts)
2. **Link users** - Each user signs once to create Polymarket API credentials (store in your DB)
3. **Trade freely** - Place unlimited orders by just passing wallet ID and address

## Key Features

- ✅ **Multi-user** - Works with unlimited users/wallets
- ✅ **Server-side** - No frontend dependencies or user popups
- ✅ **One signature per user** - Users sign once, trade forever
- ✅ **Direct CLOB** - Orders go directly to Polymarket (no intermediaries)
- ✅ **Production-ready** - Same EOA wallet is both signer and funder

## Market IDs

Find market IDs on Polymarket or use the Dome API:

```typescript
// Get market info
const markets = await domeClient.polymarket.markets.getMarkets({
  market_slug: ['bitcoin-above-100k'],
});

console.log(markets.markets[0].side_a.id); // This is the token ID / market ID
```

## Funding Wallets

Users need USDC.e on Polygon to trade:

- **Token**: USDC.e (bridged USDC)
- **Contract**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- **Network**: Polygon (Chain ID 137)

Send USDC.e to `user.walletAddress` on Polygon network.

## Support

- **File**: [`privy-polymarket-simple.ts`](./privy-polymarket-simple.ts) - Full working example
- **Docs**: [Privy Authorization Keys](https://docs.privy.io/controls/authorization-keys)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
