# PolymarketRouterWithEscrow Quickstart

**Automatic fee escrow for every order - zero manual setup.**

This guide shows how to use `PolymarketRouterWithEscrow`, which handles all fee authorization automatically. For manual fee control, see [PRIVY_FEE_MODULE_QUICKSTART.md](./PRIVY_FEE_MODULE_QUICKSTART.md).

---

## Why Use This Router?

| Feature             | PolymarketRouter | PolymarketRouterWithEscrow |
| ------------------- | ---------------- | -------------------------- |
| Order placement     | Yes              | Yes                        |
| Fee calculation     | Manual           | **Automatic**              |
| Order ID generation | Manual           | **Automatic**              |
| Fee auth signing    | Manual           | **Automatic**              |
| Affiliate revenue   | Manual           | **Built-in**               |

**One line change** to start earning affiliate fees on every trade.

---

## Quick Start

### Installation

```bash
npm install @dome-api/sdk @privy-io/server-auth
```

### Basic Usage

```typescript
import { PolymarketRouterWithEscrow, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// 1. Initialize Privy
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  }
);

// 2. Initialize router with escrow config
const router = new PolymarketRouterWithEscrow({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY!, // Required for escrow orders
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  escrow: {
    affiliate: '0xYourAffiliateWallet', // Your wallet - receives 20% of fees
  },
});

// 3. Link user (one-time per user)
const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);
const credentials = await router.linkUser({
  userId: user.id,
  signer,
  privyWalletId: user.privyWalletId,
});

// 4. Place orders - fees handled automatically!
const result = await router.placeOrder(
  {
    userId: user.id,
    marketId:
      '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    side: 'buy',
    size: 100, // $100 USDC
    price: 0.65, // 65 cents
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);
```

That's it. The router automatically:

1. Generates a unique order ID
2. Calculates the fee (0.25% default)
3. Signs the fee authorization with the user's Privy wallet
4. Submits order + fee auth to Dome API
5. Your affiliate wallet receives 20% of fees on fills

---

## Configuration Options

### EscrowConfig

```typescript
const router = new PolymarketRouterWithEscrow({
  chainId: 137,
  apiKey: process.env.DOME_API_KEY!,
  privy: { ... },
  escrow: {
    // Fee rate in basis points (default: 25 = 0.25%)
    feeBps: 25,

    // Your affiliate wallet address (receives 20% of fees)
    affiliate: '0xYourAffiliateWallet',

    // Signature deadline in seconds (default: 3600 = 1 hour)
    deadlineSeconds: 3600,

    // Escrow contract address (default: Polygon mainnet)
    escrowAddress: '0x989876083eD929BE583b8138e40D469ea3E53a37',

    // Chain ID (default: 137 = Polygon)
    chainId: 137,
  },
});
```

### Per-Order Overrides

```typescript
await router.placeOrder(
  {
    userId: user.id,
    marketId,
    side: 'buy',
    size: 100,
    price: 0.65,
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,

    // Override for this order only:
    feeBps: 50, // 0.50% fee for this order
    affiliate: '0xDifferentAffiliate', // Different affiliate
    skipEscrow: false, // Set true to skip fee escrow
  },
  credentials
);
```

---

## Complete Example

```typescript
// escrow-trading.ts
import { PolymarketRouterWithEscrow, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// Configuration
const config = {
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
  domeApiKey: process.env.DOME_API_KEY!,
  affiliateWallet: process.env.AFFILIATE_WALLET!, // Your wallet
};

// Initialize
const privy = new PrivyClient(config.privy.appId, config.privy.appSecret, {
  walletApi: { authorizationPrivateKey: config.privy.authorizationKey },
});

const router = new PolymarketRouterWithEscrow({
  chainId: 137,
  apiKey: config.domeApiKey,
  privy: config.privy,
  escrow: {
    affiliate: config.affiliateWallet,
  },
});

// User management
interface User {
  id: string;
  privyWalletId: string;
  walletAddress: string;
}

async function onboardUser(user: User) {
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  const credentials = await router.linkUser({
    userId: user.id,
    signer,
    privyWalletId: user.privyWalletId,
  });

  // Store credentials in your database
  await db.saveCredentials(user.id, credentials);

  return credentials;
}

async function placeUserOrder(
  user: User,
  market: string,
  side: 'buy' | 'sell',
  size: number,
  price: number
) {
  const credentials = await db.getCredentials(user.id);

  // Calculate expected fee for logging
  const expectedFee = router.calculateOrderFee(size, price);
  const affiliateShare = (expectedFee * 2000n) / 10000n; // 20%

  console.log(`Placing ${side} order: ${size} shares @ ${price}`);
  console.log(
    `Fee: ${Number(expectedFee) / 1e6} USDC (your share: ${Number(affiliateShare) / 1e6} USDC)`
  );

  const result = await router.placeOrder(
    {
      userId: user.id,
      marketId: market,
      side,
      size,
      price,
      privyWalletId: user.privyWalletId,
      walletAddress: user.walletAddress,
    },
    credentials
  );

  console.log('Order placed:', result);
  return result;
}

// Example usage
async function main() {
  const user: User = {
    id: 'user-123',
    privyWalletId: 'wallet-id-from-privy',
    walletAddress: '0x1234567890123456789012345678901234567890',
  };

  // Onboard user (one-time)
  await onboardUser(user);

  // Place orders
  await placeUserOrder(
    user,
    '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    'buy',
    100,
    0.65
  );
}

main().catch(console.error);
```

---

## Fee Calculation Helper

The router includes a helper to calculate fees before placing orders:

```typescript
// Calculate fee for a $100 order at 0.65 price
const fee = router.calculateOrderFee(100, 0.65);
// fee = 162500n (USDC with 6 decimals = $0.1625)

// With custom fee rate
const customFee = router.calculateOrderFee(100, 0.65, 50); // 0.50%
// customFee = 325000n ($0.325)
```

### Fee Formula

```
Order Cost = size × price
Fee = Order Cost × (feeBps / 10000)

Example: 100 shares × $0.65 = $65 order cost
Fee = $65 × (25 / 10000) = $0.1625
Your Share (20%) = $0.0325
```

---

## Skip Escrow for Specific Orders

To place an order without fee escrow:

```typescript
await router.placeOrder(
  {
    userId: user.id,
    marketId,
    side: 'buy',
    size: 100,
    price: 0.65,
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
    skipEscrow: true, // Uses parent PolymarketRouter behavior
  },
  credentials
);
```

---

## Get Current Config

```typescript
const escrowConfig = router.getEscrowConfig();
console.log(escrowConfig);
// {
//   feeBps: 25,
//   escrowAddress: '0x989876083eD929BE583b8138e40D469ea3E53a37',
//   chainId: 137,
//   affiliate: '0xYourAffiliateWallet',
//   deadlineSeconds: 3600,
// }
```

---

## Environment Variables

```bash
# Privy credentials
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
PRIVY_AUTHORIZATION_KEY=wallet-auth:...

# Dome API key (required for escrow orders)
DOME_API_KEY=your-dome-api-key

# Your affiliate wallet (receives 20% of fees)
AFFILIATE_WALLET=0xYourPolygonWalletAddress
```

---

## USDC Approval Requirement

Users need to approve the escrow contract to pull USDC for fees. Add this approval alongside your existing Polymarket allowances:

```typescript
import { ethers } from 'ethers';

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ESCROW = '0x989876083eD929BE583b8138e40D469ea3E53a37';

async function approveEscrow(privy: PrivyClient, walletId: string) {
  const iface = new ethers.utils.Interface([
    'function approve(address,uint256)',
  ]);
  const data = iface.encodeFunctionData('approve', [
    ESCROW,
    ethers.constants.MaxUint256,
  ]);

  return privy.walletApi.ethereum.sendTransaction({
    walletId,
    caip2: 'eip155:137',
    transaction: {
      to: USDC as `0x${string}`,
      data: data as `0x${string}`,
      chainId: 137,
    },
  });
}
```

---

## Error Handling

```typescript
try {
  await router.placeOrder({ ... }, credentials);
} catch (error) {
  if (error.message.includes('insufficient allowance')) {
    // User needs to approve escrow contract
    await approveEscrow(privy, user.privyWalletId);
    // Retry order
  } else if (error.message.includes('No credentials found')) {
    // User needs to be linked first
    await onboardUser(user);
    // Retry order
  } else {
    throw error;
  }
}
```

---

## Comparison: Manual vs Automatic

### Manual Approach (PRIVY_FEE_MODULE_QUICKSTART.md)

```typescript
// 10+ lines of setup per order
const orderId = generateOrderId({ ... });
const feeAmount = calculateFee(parseUsdc(size), feeBps);
const feeAuth = createFeeAuthorization(orderId, payer, feeAmount, deadline);
const signer = createPrivyFeeAuthSigner(privy, walletId, address);
const signedAuth = await signFeeAuthorizationWithSigner(signer, escrow, feeAuth, chainId);
await router.placeOrder({ ..., feeAuth: { ... } }, credentials);
```

### Automatic Approach (This Guide)

```typescript
// 1 line - everything handled internally
await router.placeOrder({ userId, marketId, side, size, price, ... }, credentials);
```

Use manual approach when you need:

- Custom order ID generation logic
- Per-order fee rate negotiation
- Direct control over signature timing
- Integration with external fee systems

Use automatic approach (recommended) when you want:

- Simple integration
- Consistent fee handling
- Less code to maintain
- Automatic best practices

---

## Support

- **Technical Integration**: kunal@domeapi.com
- **Affiliate Registration**: kurush@domeapi.com
- **Manual Fee Control**: See [PRIVY_FEE_MODULE_QUICKSTART.md](./PRIVY_FEE_MODULE_QUICKSTART.md)
