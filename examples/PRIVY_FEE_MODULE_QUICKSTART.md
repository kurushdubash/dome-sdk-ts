# Privy Fee Module Quickstart

**Manual fee authorization using the escrow module directly.**

This guide shows how to manually integrate fee authorization with Privy, giving you full control over order IDs, fee calculation, and signature timing. For automatic handling, see [ESCROW_ROUTER_QUICKSTART.md](./ESCROW_ROUTER_QUICKSTART.md).

> **Tested**: Verify the integration by running the Complete Example below with your Privy credentials.

---

## Overview

### How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR APP (Privy-powered)                                        │
│                                                                  │
│  1. User wants to place order                                    │
│  2. Your app calculates fee (0.25% of order size)                │
│  3. User signs fee authorization via Privy                       │
│  4. Your app sends order + fee auth to Dome API                  │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOME API SERVER                                                 │
│                                                                  │
│  5. Calls pullFee() with YOUR affiliate address                  │
│  6. Forwards order to Polymarket CLOB                            │
│  7. On fill: calls distribute() → 80% Dome, 20% YOU              │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  ESCROW CONTRACT (0x93519731c9d45738CD999F8b8E86936cc2a33870)    │
│                                                                  │
│  • Holds USDC until order fills                                  │
│  • Distributes 80% to Dome, 20% to affiliate                     │
│  • Refunds on cancel/expire                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Fee Structure

| Item                 | Value   | Description                         |
| -------------------- | ------- | ----------------------------------- |
| **Default Fee Rate** | 0.25%   | 25 basis points of order size       |
| **Dome Amount**      | 0.20%   | 20 bps — signed as `domeAmount`     |
| **Affiliate Amount** | 0.05%   | 5 bps — signed as `affiliateAmount` |
| **Min Fee**          | $0.01   | Floor per order                     |
| **Max Fee**          | $10,000 | Cap per order                       |

### Example Earnings

| Order Size | Fee (0.25%) | Your Share (20%) |
| ---------- | ----------- | ---------------- |
| $35        | $0.0875     | $0.0175          |
| $100       | $0.25       | $0.05            |
| $1,000     | $2.50       | $0.50            |
| $10,000    | $25.00      | $5.00            |

---

## Prerequisites

### 1. Privy Setup

You need a Privy account with a server wallet:

```bash
# Required environment variables
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
PRIVY_AUTHORIZATION_KEY=your-authorization-private-key
PRIVY_WALLET_ID=your-server-wallet-id
PRIVY_WALLET_ADDRESS=0x...
```

### 2. Install Dependencies

```bash
npm install @dome-api/sdk @privy-io/server-auth ethers@^5.7.0
```

---

## Integration Steps

### Step 1: Import the Escrow Module

The escrow utilities are exported as a namespace from the SDK:

```typescript
import { PrivyClient } from '@privy-io/server-auth';

// Import escrow module and SDK helpers
import {
  DomeFeeEscrowClient,
  createPrivySigner,
  generateOrderId,
  parseUsdc,
  formatUsdc,
  ESCROW_CONTRACT_POLYGON,
  TypedDataSigner,
} from '@dome-api/sdk';
```

### Step 2: Initialize Privy Client

For server-side signing, pass the authorization key:

```typescript
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  }
);
```

### Step 3: Create a Signer from Privy

The fee authorization requires a `TypedDataSigner`. Use `createPrivySigner()` from the SDK:

```typescript
// createPrivySigner() returns a TypedDataSigner-compatible signer
const signer = createPrivySigner(privy, walletId, walletAddress);
```

### Step 4: Generate Order ID and Sign Fee Authorization

```typescript
async function signFeeAuth(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string,
  orderParams: {
    marketId: string;
    side: 'buy' | 'sell';
    size: number; // USDC amount
    price: number; // 0.00 to 1.00
  }
) {
  const timestamp = Date.now();

  // 1. Calculate order cost in USDC (6 decimals)
  const orderCostUsdc = parseUsdc(orderParams.size * orderParams.price);

  // 2. Generate unique order ID
  const orderId = generateOrderId({
    chainId: 137,
    userAddress: walletAddress,
    marketId: orderParams.marketId,
    side: orderParams.side,
    size: orderCostUsdc,
    price: orderParams.price,
    timestamp,
  });

  // 3. Calculate split fees (20 bps Dome + 5 bps Affiliate = 25 bps total)
  const domeAmount = (orderCostUsdc * 20n) / 10000n;
  const affiliateAmount = (orderCostUsdc * 5n) / 10000n;

  console.log(`Order cost: $${formatUsdc(orderCostUsdc)}`);
  console.log(`Dome fee: $${formatUsdc(domeAmount)}`);
  console.log(`Affiliate fee: $${formatUsdc(affiliateAmount)}`);

  // 4. Create escrow client and signer, then sign
  const escrowClient = new DomeFeeEscrowClient({
    provider: null as any, // Not needed for signing-only operations
    contractAddress: ESCROW_CONTRACT_POLYGON,
    chainId: 137,
  });
  const signer = createPrivySigner(privy, walletId, walletAddress);

  const { auth, signature } = await escrowClient.signOrderFeeAuthWithSigner(
    signer,
    { orderId, domeAmount, affiliateAmount, deadline: 3600 }
  );

  return { auth, signature };
}
```

---

## Complete Example

Here's a full working example tested with real Privy credentials:

```typescript
// privy-fee-signing.ts
import 'dotenv/config';
import { PrivyClient } from '@privy-io/server-auth';
import {
  DomeFeeEscrowClient,
  createPrivySigner,
  generateOrderId,
  parseUsdc,
  formatUsdc,
  ESCROW_CONTRACT_POLYGON,
} from '@dome-api/sdk';

// Configuration
const config = {
  privyAppId: process.env.PRIVY_APP_ID!,
  privyAppSecret: process.env.PRIVY_APP_SECRET!,
  privyAuthKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  walletId: process.env.PRIVY_WALLET_ID!,
  walletAddress: process.env.PRIVY_WALLET_ADDRESS!,
};

async function main() {
  console.log('Privy Fee Module Test\n');

  // Initialize Privy with authorization key for server-side signing
  const privy = new PrivyClient(config.privyAppId, config.privyAppSecret, {
    walletApi: {
      authorizationPrivateKey: config.privyAuthKey,
    },
  });
  console.log(`Wallet: ${config.walletAddress}`);

  // Order parameters
  const order = {
    marketId:
      '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    side: 'buy' as const,
    size: 50, // shares
    price: 0.7, // $0.70 per share
  };

  const timestamp = Date.now();
  const orderCost = parseUsdc(order.size * order.price); // $35

  // Generate order ID
  const orderId = generateOrderId({
    chainId: 137,
    userAddress: config.walletAddress,
    marketId: order.marketId,
    side: order.side,
    size: orderCost,
    price: order.price,
    timestamp,
  });

  console.log(`Order ID: ${orderId.substring(0, 18)}...`);

  // Calculate split fees (20 bps Dome + 5 bps Affiliate)
  const domeAmount = (orderCost * 20n) / 10000n;
  const affiliateAmount = (orderCost * 5n) / 10000n;

  console.log(`Order cost: $${formatUsdc(orderCost)}`);
  console.log(`Dome fee: $${formatUsdc(domeAmount)}`);
  console.log(`Affiliate fee: $${formatUsdc(affiliateAmount)}`);

  // Create escrow client and signer
  const escrowClient = new DomeFeeEscrowClient({
    provider: null as any, // Not needed for signing-only operations
    contractAddress: ESCROW_CONTRACT_POLYGON,
    chainId: 137,
  });
  const signer = createPrivySigner(
    privy,
    config.walletId,
    config.walletAddress
  );

  console.log('\nSigning with Privy...');
  const { auth, signature } = await escrowClient.signOrderFeeAuthWithSigner(
    signer,
    { orderId, domeAmount, affiliateAmount, deadline: 3600 }
  );

  console.log(`Signature: ${signature.substring(0, 20)}...`);

  // Prepare API payload
  const apiPayload = {
    order: {
      marketId: order.marketId,
      side: order.side,
      size: order.size,
      price: order.price,
    },
    feeAuth: {
      orderId: auth.orderId,
      payer: auth.payer,
      domeAmount: auth.domeAmount.toString(),
      affiliateAmount: auth.affiliateAmount.toString(),
      chainId: auth.chainId.toString(),
      deadline: auth.deadline.toString(),
      signature,
    },
  };

  console.log('\nAPI Payload ready:');
  console.log(JSON.stringify(apiPayload, null, 2));
}

main().catch(console.error);
```

### Run the Example

```bash
# Set environment variables
export PRIVY_APP_ID="your-app-id"
export PRIVY_APP_SECRET="your-app-secret"
export PRIVY_AUTHORIZATION_KEY="your-authorization-private-key"
export PRIVY_WALLET_ID="your-wallet-id"
export PRIVY_WALLET_ADDRESS="0x..."

# Run
npx tsx privy-fee-signing.ts
```

---

## API Payload Format

After signing, submit this payload to the Dome API:

```typescript
interface OrderWithFeeAuth {
  order: {
    marketId: string;
    side: 'buy' | 'sell';
    size: number;
    price: number;
  };
  feeAuth: {
    orderId: string; // bytes32 hex string
    payer: string; // Wallet address
    domeAmount: string; // Dome fee in USDC (6 decimals) as string
    affiliateAmount: string; // Affiliate fee in USDC (6 decimals) as string
    chainId: string; // Chain ID as string (e.g. "137")
    deadline: string; // Unix timestamp as string
    signature: string; // 65-byte signature (0x-prefixed)
  };
}
```

---

## USDC Approval for Fee Escrow

Users need to approve the escrow contract to pull USDC for fees. This is a **one-time setup** per wallet.

```typescript
import { ethers } from 'ethers';

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ESCROW = '0x93519731c9d45738CD999F8b8E86936cc2a33870';

async function approveEscrow(privy: PrivyClient, walletId: string) {
  const iface = new ethers.utils.Interface([
    'function approve(address,uint256)',
  ]);
  const data = iface.encodeFunctionData('approve', [
    ESCROW,
    ethers.constants.MaxUint256,
  ]);

  const result = await privy.walletApi.ethereum.sendTransaction({
    walletId,
    caip2: 'eip155:137',
    transaction: {
      to: USDC as `0x${string}`,
      data: data as `0x${string}`,
      chainId: 137,
    },
  });

  console.log('Approval tx:', result.hash);
  return result.hash;
}
```

---

## Fee Calculation Reference

```typescript
import { parseUsdc, formatUsdc } from '@dome-api/sdk';

// Order: 50 shares at $0.70 = $35 cost
const orderCost = parseUsdc(35); // 35000000n

// Dome fee: 20 bps (0.20%) of $35 = $0.07
const domeAmount = (orderCost * 20n) / 10000n; // 70000n

// Affiliate fee: 5 bps (0.05%) of $35 = $0.0175
const affiliateAmount = (orderCost * 5n) / 10000n; // 17500n

console.log(`Dome fee: $${formatUsdc(domeAmount)}`); // "0.07"
console.log(`Affiliate fee: $${formatUsdc(affiliateAmount)}`); // "0.0175"
console.log(`Total fee: $${formatUsdc(domeAmount + affiliateAmount)}`); // "0.0875"
```

---

## Testing

To verify your setup, save the Complete Example above as `privy-fee-signing.ts` and run it:

```bash
# With .env file containing your Privy credentials
npx tsx privy-fee-signing.ts
```

A successful run will output the generated order ID, fee amounts, Privy signature, and the formatted API payload ready to submit to the Dome API.

---

## Troubleshooting

| Issue                    | Solution                                                |
| ------------------------ | ------------------------------------------------------- |
| `walletApi is undefined` | Ensure Privy client is initialized with app credentials |
| `signature invalid`      | Check chainId matches (should be 137 for Polygon)       |
| `insufficient allowance` | User needs to approve escrow contract for USDC          |
| `order ID mismatch`      | Verify timestamp is in milliseconds (`Date.now()`)      |
| `deadline expired`       | Increase deadline or check server time sync             |
| `fee too low`            | Fee must be at least $0.01 (MIN_FEE = 10000)            |

---

## Key Addresses

| Contract   | Address                                      | Network |
| ---------- | -------------------------------------------- | ------- |
| Fee Escrow | `0x93519731c9d45738CD999F8b8E86936cc2a33870` | Polygon |
| USDC       | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Polygon |

---

## Support

- **Technical Integration**: kunal@domeapi.com
- **Affiliate Registration**: kurush@domeapi.com
- **Automatic Fee Handling**: See [ESCROW_ROUTER_QUICKSTART.md](./ESCROW_ROUTER_QUICKSTART.md)
