# PolymarketEscrowRouter

> Automated fee escrow for Polymarket trades.

```typescript
import { PolymarketEscrowRouter, createPrivySigner } from '@dome-api/sdk';

const router = new PolymarketEscrowRouter({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY!,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  escrow: {
    clientAddress: '0xYourWallet',
    clientFeeBps: 25, // 0.25%
  },
});

// That's it. Fees are now automatic on every order.
await router.placeOrder({ userId, marketId, side, size, price, ... }, credentials);
```

---

## Table of Contents

1. [Why Use This?](#why-use-this)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Working with Fees](#working-with-fees)
5. [Wallet Types](#wallet-types)
6. [Complete Example](#complete-example)
7. [Error Handling](#error-handling)
8. [Reference](#reference)

---

## Why Use This?

| What You'd Do Manually | What the Router Does |
|------------------------|----------------------|
| Fetch `domeFeeBps` from contract | ✅ Auto-fetched (cached 5 min) |
| Generate deterministic order ID | ✅ Built-in keccak256 hash |
| Calculate dome + client fees | ✅ Computed automatically |
| Create EIP-2612/EIP-1271 signature | ✅ Wallet-type aware signing |
| Submit order with fee auth | ✅ Single `placeOrder()` call |

**Result:** Swap `PolymarketRouter` → `PolymarketEscrowRouter` and you're done.

---

## Quick Start

### Prerequisites

```bash
npm install @dome-api/sdk @privy-io/server-auth
```

### Environment Variables

```bash
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_AUTHORIZATION_KEY=wallet-auth:your-key-here
DOME_API_KEY=your-dome-api-key
CLIENT_WALLET=0xYourPolygonAddress
```

### Step-by-Step

**1. Initialize Router**

```typescript
import { PolymarketEscrowRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  { walletApi: { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY! } }
);

const router = new PolymarketEscrowRouter({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY!,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  escrow: {
    clientAddress: process.env.CLIENT_WALLET!,
    clientFeeBps: 25,
  },
});
```

**2. Link User (one-time per user)**

```typescript
const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);
const credentials = await router.linkUser({
  userId: user.id,
  signer,
  privyWalletId: user.privyWalletId,
});
```

**3. Place Orders**

```typescript
const result = await router.placeOrder(
  {
    userId: user.id,
    marketId: '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    side: 'buy',
    size: 100,
    price: 0.65,
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);
```

---

## Configuration

### Constructor Options

```typescript
new PolymarketEscrowRouter({
  chainId: 137,                          // Required: Polygon mainnet
  apiKey: 'dome-api-key',                // Required: Enables escrow
  privy: { ... },                        // Required: Privy credentials
  escrow: {
    clientFeeBps: 25,                    // Your fee (0.25%) — default: 0
    clientAddress: '0x...',              // Your wallet for fees
    deadlineSeconds: 3600,               // Signature validity — default: 1 hour
    escrowAddress: '0x...',              // Auto-detected from chainId
    rpcUrl: 'https://polygon-rpc.com',   // Auto-detected from chainId
  },
});
```

> **Note:** `domeFeeBps` and `minDomeFee` come from the smart contract. You cannot override them.

### Per-Order Overrides

```typescript
await router.placeOrder({
  // ...standard params
  clientFeeBps: 50,                      // Override: 0.50% for this order
  clientAddress: '0xDifferentWallet',    // Override: different recipient
  skipEscrow: true,                      // Skip fee escrow entirely
}, credentials);
```

### Server-Side Configuration

Configure client addresses via API instead of code:

```bash
curl -X POST https://api.domeapi.io/v1/polymarket/users/affiliate \
  -H "Authorization: Bearer $DOME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"affiliateAddress": "0xYourClientWallet"}'
```

Server-configured values take precedence over SDK settings.

---

## Working with Fees

### Fee Formula

```
Order Cost = size × price (in USDC)
Dome Fee   = max(Order Cost × domeFeeBps / 10000, minDomeFee)
Client Fee = Order Cost × clientFeeBps / 10000
Total Fee  = Dome Fee + Client Fee
```

**Example:** 100 shares × $0.65 = $65 order cost
- Dome Fee: max($65 × 10 / 10000, $0.01) = $0.065
- Client Fee: $65 × 25 / 10000 = $0.1625
- **Total: $0.2275**

### Calculate Before Ordering

```typescript
const fees = await router.calculateOrderFee(100, 0.65);
// {
//   domeFee: 6500n,     // From contract
//   clientFee: 16250n,  // Your configured rate
//   totalFee: 22750n,   // Combined
// }

// With custom client fee
const customFees = await router.calculateOrderFee(100, 0.65, 50); // 0.5%
```

### Access Contract Settings

```typescript
const config = await router.getDomeFeeConfig();
// { domeFeeBps: 10, minDomeFee: 10000n }

// Force refresh (bypasses 5-min cache)
await router.refreshDomeFeeConfig();
```

### Escrow Lifecycle

```
EMPTY → HELD → SENT (on fill) or REFUNDED (on cancel)
```

| State | Meaning |
|-------|---------|
| EMPTY | No fee escrowed |
| HELD | Fee pulled, awaiting outcome |
| SENT | Order filled, fees distributed |
| REFUNDED | Order cancelled, fee returned |

---

## Wallet Types

### EOA Wallets (Default)

Uses **EIP-2612 permit** — gasless USDC approval.

```typescript
await router.placeOrder({
  // ...params
  walletType: 'eoa', // default
}, credentials);
```

### Safe/Smart Wallets

Uses **EIP-1271** — requires prior USDC approval.

```typescript
await router.placeOrder({
  // ...params
  walletType: 'safe',
  funderAddress: safeAddress, // Required for Safe
}, credentials);
```

**One-time approval for Safe wallets:**

```typescript
import { ethers } from 'ethers';

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ESCROW = '0xc5526DEdc553D1a456D59a2C2166A81A7880730A';

const iface = new ethers.utils.Interface(['function approve(address,uint256)']);
const calldata = iface.encodeFunctionData('approve', [ESCROW, ethers.constants.MaxUint256]);

await safeWallet.sendTransaction({ to: USDC, data: calldata });
```

---

## Complete Example

```typescript
import { PolymarketEscrowRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// --- Setup ---
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  { walletApi: { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY! } }
);

const router = new PolymarketEscrowRouter({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY!,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  escrow: {
    clientAddress: process.env.CLIENT_WALLET!,
    clientFeeBps: 25,
  },
});

// --- Types ---
interface User {
  id: string;
  privyWalletId: string;
  walletAddress: string;
}

// --- User Registration ---
async function registerUser(user: User) {
  const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);
  const credentials = await router.linkUser({
    userId: user.id,
    signer,
    privyWalletId: user.privyWalletId,
  });
  await db.saveCredentials(user.id, credentials);
  return credentials;
}

// --- Trading ---
async function trade(user: User, marketId: string, side: 'buy' | 'sell', size: number, price: number) {
  const credentials = await db.getCredentials(user.id);

  // Preview fees
  const fees = await router.calculateOrderFee(size, price);
  console.log(`Fee breakdown: Dome ${Number(fees.domeFee) / 1e6} + Client ${Number(fees.clientFee) / 1e6} USDC`);

  // Execute
  return router.placeOrder(
    {
      userId: user.id,
      marketId,
      side,
      size,
      price,
      privyWalletId: user.privyWalletId,
      walletAddress: user.walletAddress,
    },
    credentials
  );
}

// --- Run ---
async function main() {
  const user: User = {
    id: 'user-abc',
    privyWalletId: 'privy-wallet-xyz',
    walletAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
  };

  await registerUser(user);
  await trade(user, '60487116984468020978247225474488676749601001829886755968952521846780452448915', 'buy', 100, 0.65);
}

main().catch(console.error);
```

---

## Error Handling

```typescript
try {
  await router.placeOrder({ ... }, credentials);
} catch (error) {
  switch (true) {
    case error.message.includes('insufficient allowance'):
      // Smart wallet needs USDC approval
      await approveEscrowForSafe(safeWallet);
      break;

    case error.message.includes('No credentials found'):
      // User not linked yet
      await registerUser(user);
      break;

    case error.message.includes('API key not set'):
      // Missing DOME_API_KEY
      throw new Error('Configure DOME_API_KEY');

    default:
      throw error;
  }
}
```

---

## Reference

### Inspect Current Settings

```typescript
// Your configuration
router.getEscrowConfig();
// { clientFeeBps, clientAddress, deadlineSeconds, escrowAddress, rpcUrl }

// Contract configuration
await router.getDomeFeeConfig();
// { domeFeeBps, minDomeFee }
```

### API Errors

| Status | Cause |
|--------|-------|
| 400 | Invalid address format |
| 404 | Unknown API key |

### Manual vs Automated

| Approach | Use When |
|----------|----------|
| **PolymarketEscrowRouter** | Standard integration, fast setup |
| **Manual fee handling** | Custom order IDs, per-order negotiation, external fee systems |

For manual control, see [PRIVY_FEE_MODULE_QUICKSTART.md](./PRIVY_FEE_MODULE_QUICKSTART.md).

---

## Support

| Topic | Contact |
|-------|---------|
| Integration | kunal@domeapi.com |
| Affiliate onboarding | kurush@domeapi.com |
| Docs | [docs.domeapi.io](https://docs.domeapi.io) |
