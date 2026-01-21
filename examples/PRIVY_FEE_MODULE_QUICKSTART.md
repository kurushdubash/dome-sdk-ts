# Privy Fee Module Quickstart

**Manual fee authorization using the escrow module directly.**

This guide shows how to manually integrate fee authorization with Privy, giving you full control over order IDs, fee calculation, and signature timing. For automatic handling, see [ESCROW_ROUTER_QUICKSTART.md](./ESCROW_ROUTER_QUICKSTART.md).

> **Tested**: Run `npx tsx examples/test-privy-fee-module.ts` to verify the integration.

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
│  ESCROW CONTRACT (0x989876083eD929BE583b8138e40D469ea3E53a37)    │
│                                                                  │
│  • Holds USDC until order fills                                  │
│  • Distributes 80% to Dome, 20% to affiliate                     │
│  • Refunds on cancel/expire                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Fee Structure

| Item                 | Value   | Description                   |
| -------------------- | ------- | ----------------------------- |
| **Default Fee Rate** | 0.25%   | 25 basis points of order size |
| **Your Share**       | 20%     | Of collected fees             |
| **Dome Share**       | 80%     | Of collected fees             |
| **Min Fee**          | $0.01   | Floor per order               |
| **Max Fee**          | $10,000 | Cap per order                 |

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

// Import escrow module
import {
  generateOrderId,
  createFeeAuthorization,
  signFeeAuthorizationWithSigner,
  parseUsdc,
  calculateFee,
  formatUsdc,
  ESCROW_CONTRACT_POLYGON,
  TypedDataSigner,
} from '@dome-api/sdk/escrow';

// Or import as namespace
// import { escrow } from '@dome-api/sdk';
// const { generateOrderId, ... } = escrow;
```

### Step 2: Initialize Privy Client

For server wallets, you only need app ID and secret:

```typescript
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);
```

### Step 3: Create TypedDataSigner from Privy

The fee authorization requires a `TypedDataSigner`. Here's how to create one:

```typescript
function createPrivyTypedDataSigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): TypedDataSigner {
  return {
    async getAddress(): Promise<string> {
      return walletAddress;
    },

    async signTypedData(params: {
      domain: any;
      types: any;
      primaryType: string;
      message: any;
    }): Promise<string> {
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId,
        typedData: {
          domain: params.domain,
          types: params.types,
          primaryType: params.primaryType,
          message: params.message,
        },
      });

      return signature;
    },
  };
}
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

  // 3. Calculate fee (0.25% = 25 bps)
  const feeAmount = calculateFee(orderCostUsdc, 25n);

  console.log(`Order cost: $${formatUsdc(orderCostUsdc)}`);
  console.log(`Fee: $${formatUsdc(feeAmount)}`);
  console.log(`Your share (20%): $${formatUsdc((feeAmount * 2000n) / 10000n)}`);

  // 4. Create fee authorization
  const feeAuth = createFeeAuthorization(
    orderId,
    walletAddress,
    feeAmount,
    3600 // deadline: 1 hour
  );

  // 5. Create signer and sign
  const signer = createPrivyTypedDataSigner(privy, walletId, walletAddress);

  const signedAuth = await signFeeAuthorizationWithSigner(
    signer,
    ESCROW_CONTRACT_POLYGON,
    feeAuth,
    137 // Polygon chain ID
  );

  return signedAuth;
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
  generateOrderId,
  createFeeAuthorization,
  signFeeAuthorizationWithSigner,
  parseUsdc,
  calculateFee,
  formatUsdc,
  ESCROW_CONTRACT_POLYGON,
  TypedDataSigner,
} from '@dome-api/sdk/escrow';

// Configuration
const config = {
  privyAppId: process.env.PRIVY_APP_ID!,
  privyAppSecret: process.env.PRIVY_APP_SECRET!,
  walletId: process.env.PRIVY_WALLET_ID!,
  walletAddress: process.env.PRIVY_WALLET_ADDRESS!,
};

// Create TypedDataSigner from Privy
function createPrivySigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): TypedDataSigner {
  return {
    getAddress: async () => walletAddress,
    signTypedData: async params => {
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId,
        typedData: params,
      });
      return signature;
    },
  };
}

async function main() {
  console.log('Privy Fee Module Test\n');

  // Initialize Privy
  const privy = new PrivyClient(config.privyAppId, config.privyAppSecret);
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

  // Calculate fee
  const feeAmount = calculateFee(orderCost, 25n);
  const affiliateShare = (feeAmount * 2000n) / 10000n;

  console.log(`Order cost: $${formatUsdc(orderCost)}`);
  console.log(`Fee: $${formatUsdc(feeAmount)}`);
  console.log(`Affiliate share: $${formatUsdc(affiliateShare)}`);

  // Create and sign fee authorization
  const feeAuth = createFeeAuthorization(
    orderId,
    config.walletAddress,
    feeAmount,
    3600
  );
  const signer = createPrivySigner(
    privy,
    config.walletId,
    config.walletAddress
  );

  console.log('\nSigning with Privy...');
  const signedAuth = await signFeeAuthorizationWithSigner(
    signer,
    ESCROW_CONTRACT_POLYGON,
    feeAuth,
    137
  );

  console.log(`Signature: ${signedAuth.signature.substring(0, 20)}...`);

  // Prepare API payload
  const apiPayload = {
    order: {
      marketId: order.marketId,
      side: order.side,
      size: order.size,
      price: order.price,
    },
    feeAuth: {
      orderId: signedAuth.orderId,
      payer: signedAuth.payer,
      feeAmount: signedAuth.feeAmount.toString(),
      deadline: signedAuth.deadline.toString(),
      signature: signedAuth.signature,
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
    feeAmount: string; // USDC amount (6 decimals) as string
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
const ESCROW = '0x989876083eD929BE583b8138e40D469ea3E53a37';

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
import { parseUsdc, calculateFee, formatUsdc } from '@dome-api/sdk/escrow';

// Order: 50 shares at $0.70 = $35 cost
const orderCost = parseUsdc(35); // 35000000n

// Fee: 0.25% of $35 = $0.0875
const fee = calculateFee(orderCost, 25n); // 87500n

console.log(`Fee: $${formatUsdc(fee)}`); // "0.0875"

// Affiliate share: 20% of $0.0875 = $0.0175
const affiliateShare = (fee * 2000n) / 10000n; // 17500n
console.log(`Your share: $${formatUsdc(affiliateShare)}`); // "0.0175"
```

---

## Testing

Run the included test script to verify your setup:

```bash
cd dome-sdk-ts-pr

# With .env file
npx tsx examples/test-privy-fee-module.ts

# Or with environment variables
export PRIVY_APP_ID="..."
export PRIVY_APP_SECRET="..."
export PRIVY_WALLET_ID="..."
export PRIVY_WALLET_ADDRESS="..."
npx tsx examples/test-privy-fee-module.ts
```

Expected output:

```
🧪 Privy Fee Module Integration Test

============================================================
  OFFLINE TESTS (Escrow Module)
============================================================

📋 Generate Order ID
   ✅ PASSED

📋 Calculate Fee (0.25% of $100)
   ✅ PASSED
   {"orderSize":"$100.0","feeBps":"0.25%","fee":"$0.25","affiliateShare":"$0.05"}

...

============================================================
  PRIVY INTEGRATION TESTS
============================================================

📋 Sign Fee Authorization with Privy
   ✅ PASSED

📋 Full Order Flow Simulation
   ✅ PASSED

🎉 All tests passed!
```

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
| Fee Escrow | `0x989876083eD929BE583b8138e40D469ea3E53a37` | Polygon |
| USDC       | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Polygon |

---

## Support

- **Technical Integration**: kunal@domeapi.com
- **Affiliate Registration**: kurush@domeapi.com
- **Automatic Fee Handling**: See [ESCROW_ROUTER_QUICKSTART.md](./ESCROW_ROUTER_QUICKSTART.md)
