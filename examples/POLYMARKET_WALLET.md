# Polymarket Wallet Export Guide

**The simplest way to trade on Polymarket programmatically.**

If you already have a Polymarket account with funds, you can start trading with just your exported private key. No complex setup required.

## How It Works

```
You have Polymarket account
        |
        | Export private key from Settings
        v
Set PRIVATE_KEY env variable
        |
        | Use this SDK
        v
Place orders programmatically!
```

## Quick Start

### 1. Get Your Private Key from Polymarket

1. Go to [Polymarket](https://polymarket.com)
2. Click your profile icon (top right)
3. Go to **Settings**
4. Click **Export Private Key**
5. Copy the private key

### 2. Set Environment Variables

```bash
# Your exported Polymarket private key
export PRIVATE_KEY="your-private-key-here"

# Your Dome API key (get from domeapi.io)
export DOME_API_KEY="your-dome-api-key"
```

### 3. Run the Example

```bash
npx tsx examples/polymarket-wallet.ts
```

## Code Example

```typescript
import { PolymarketRouter, createEoaSignerFromEnv } from '@dome-api/sdk';

// Create signer from your exported private key
const signer = createEoaSignerFromEnv();
const walletAddress = await signer.getAddress();

// Initialize router
const router = new PolymarketRouter({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY,
});

// Link wallet (one-time, creates API credentials)
const credentials = await router.linkUser({
  userId: walletAddress,
  signer,
  autoSetAllowances: false, // Polymarket wallets already have allowances
});

// Place an order
const order = await router.placeOrder(
  {
    userId: walletAddress,
    marketId: '104173...', // Token ID from Polymarket
    side: 'buy',
    size: 100, // Number of shares
    price: 0.5, // Price per share (0-1)
    signer,
  },
  credentials
);
```

## Finding Market IDs

Market IDs (token IDs) can be found:

1. **From Polymarket URL**: Look at the market page URL
2. **From CLOB API**: Query `https://clob.polymarket.com/markets`
3. **From Dome API**: Use our market discovery endpoints

Each market has two token IDs - one for "Yes" and one for "No".

## Order Types

| Type  | Name             | Use Case                                     |
| ----- | ---------------- | -------------------------------------------- |
| `GTC` | Good Till Cancel | Default - stays on book until filled         |
| `GTD` | Good Till Date   | Expires at specified time                    |
| `FOK` | Fill Or Kill     | Copy trading - must fill immediately or die  |
| `FAK` | Fill And Kill    | Best effort - fill what you can, cancel rest |

### FOK for Copy Trading

Use `FOK` orders when you need instant confirmation:

```typescript
const order = await router.placeOrder(
  {
    userId: walletAddress,
    marketId: '...',
    side: 'buy',
    size: 100,
    price: 0.5,
    orderType: 'FOK', // Fill Or Kill
    signer,
  },
  credentials
);

if (order.status === 'matched') {
  console.log('Order filled!');
} else {
  console.log('Order cancelled - no liquidity at price');
}
```

## Why Use Dome?

When you place orders through Dome:

1. **Geo-unrestricted** - Orders routed through Dome servers
2. **Better execution** - Builder signing for priority matching
3. **Observability** - Track your order flow and performance
4. **Reduced MEV** - Less visible to front-runners

## Storing Credentials

After calling `linkUser()`, you get API credentials. Save these to avoid re-deriving:

```typescript
// First time - derive credentials
const credentials = await router.linkUser({ userId, signer });

// Save to database
await db.saveCredentials(walletAddress, credentials);

// Later - load from database
const savedCredentials = await db.getCredentials(walletAddress);
await router.placeOrder({ ... }, savedCredentials);
```

## Troubleshooting

### "not enough balance"

Your Polymarket wallet needs more USDC. Deposit at:

- Polymarket website > Transfer Crypto
- Send USDC directly to your wallet address on Polygon

### "Missing PRIVATE_KEY"

Set the environment variable:

```bash
export PRIVATE_KEY="your-key"
```

### "Missing Dome API key"

Get your API key from [domeapi.io](https://domeapi.io) and set:

```bash
export DOME_API_KEY="your-key"
```

### "min size"

Minimum order value is $1. Increase `size * price` to meet minimum.

## Security Notes

- **Never commit your private key** to version control
- Use `.env` files (add to `.gitignore`) for local development
- Use secure secret management (AWS Secrets Manager, etc.) for production
- The private key gives full control of your Polymarket wallet

## Support

- **Docs**: [docs.domeapi.io](https://docs.domeapi.io)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
