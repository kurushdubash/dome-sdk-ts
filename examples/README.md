# Dome SDK Examples

This directory contains example implementations showing how to integrate the Dome SDK with various wallet providers and use cases.

## Quick Start: Privy + Polymarket (Server-Side)

**The simplest way to integrate Polymarket trading with Privy-managed wallets.**

See [`privy-polymarket-simple.ts`](./privy-polymarket-simple.ts) for a complete, production-ready example.

### 30-Second Setup

```bash
# 1. Install dependencies
npm install @dome-api/sdk @privy-io/server-auth

# 2. Set environment variables
export PRIVY_APP_ID="your-privy-app-id"
export PRIVY_APP_SECRET="your-privy-app-secret"
export PRIVY_AUTHORIZATION_KEY="wallet-auth:..." # From Privy dashboard
```

### 3-Step Integration

```typescript
import { PolymarketRouter } from '@dome-api/sdk';

// Step 1: Initialize router with Privy config (ONCE in your app)
const router = new PolymarketRouter({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
});

// Step 2: Link user (one-time per user, store credentials in your DB)
const credentials = await router.linkUser({
  userId: user.id,
  signer: createPrivySigner(privy, user.privyWalletId, user.walletAddress),
});

// Step 3: Place orders - JUST PASS WALLET INFO!
await router.placeOrder(
  {
    userId: user.id,
    marketId:
      '60487116984468020978247225474488676749601001829886755968952521846780452448915',
    side: 'buy',
    size: 5,
    price: 0.99,
    // No signer needed - just pass Privy wallet info!
    privyWalletId: user.privyWalletId,
    walletAddress: user.walletAddress,
  },
  credentials
);
```

### What This Does

1. ✅ **Server-side signing** - No user popups, completely backend-driven
2. ✅ **One-time setup** - User signs once to create Polymarket API credentials
3. ✅ **Persistent credentials** - Store in your database, reuse forever
4. ✅ **Direct CLOB access** - Places orders directly on Polymarket (no Dome backend needed)
5. ✅ **Same wallet** - EOA wallet is both signer and funder

### Running the Example

```bash
# Set your Privy credentials
export PRIVY_APP_ID="..."
export PRIVY_APP_SECRET="..."
export PRIVY_AUTHORIZATION_KEY="wallet-auth:..."

# Run the example
npx tsx examples/privy-polymarket-simple.ts
```

---

## Examples

### Privy Integration (`privy-integration.ts`)

Demonstrates end-to-end integration with [Privy](https://privy.io) for wallet-agnostic Polymarket trading.

**Key Features:**

- Server-side signing with Privy authorization keys
- One-time EIP-712 signature to create Polymarket CLOB API key
- All subsequent trading uses API keys (no wallet signatures)
- Wallet-agnostic design (works with any signer implementation)

**What it demonstrates:**

1. Creating a `RouterSigner` adapter for Privy
2. Linking users to Polymarket via the Dome router
3. Placing orders using API keys
4. Both server-side and client-side implementations

**Setup:**

```bash
# Install dependencies
npm install @privy-io/server-auth @dome-api/sdk

# Set environment variables
export PRIVY_APP_ID="your-privy-app-id"
export PRIVY_APP_SECRET="your-privy-app-secret"
export PRIVY_AUTHORIZATION_KEY="your-privy-auth-key"
export DOME_API_KEY="your-dome-api-key"
export DOME_API_URL="https://api.domeapi.io/v1"
```

**Usage:**

```typescript
import { completeFlow } from './examples/privy-integration';

// Run the complete E2E flow
await completeFlow();
```

## Architecture Overview

The router integration follows this flow:

```
┌──────────────┐
│   Frontend   │
│  (Privy UI)  │
└──────┬───────┘
       │ 1. User logs in
       │
       v
┌──────────────────────────────────────────┐
│         Dome SDK Router Layer            │
│  ┌────────────────────────────────────┐  │
│  │  RouterSigner (wallet-agnostic)    │  │
│  │  • getAddress()                    │  │
│  │  • signTypedData()                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  2. ONE signature to create API key      │
│  3. Store API key in Dome backend        │
└──────────┬───────────────────────────────┘
           │
           v
┌──────────────────────────────────────────┐
│         Dome Router Backend              │
│  • Stores Polymarket CLOB API keys       │
│  • Handles all Polymarket CLOB signing   │
│  • Routes orders to exchanges            │
└──────────┬───────────────────────────────┘
           │
           v
┌──────────────────────────────────────────┐
│      Polymarket CLOB API                 │
│  • Receives signed orders                │
│  • Executes trades                       │
└──────────────────────────────────────────┘
```

## Benefits of This Approach

1. **Single Signature:** Users only sign once to create the API key
2. **Wallet-Agnostic:** Works with Privy, MetaMask, RainbowKit, WalletConnect, etc.
3. **Backend Abstraction:** Your backend handles all exchange-specific logic
4. **Better UX:** No signature prompts for every trade
5. **Scalable:** Easy to add more exchanges (Kalshi, Manifold, etc.)

## Creating Custom Signers

To integrate with a different wallet provider, implement the `RouterSigner` interface:

```typescript
import { RouterSigner, Eip712Payload } from '@dome-api/sdk';

class MyCustomSigner implements RouterSigner {
  async getAddress(): Promise<string> {
    // Return the user's wallet address
    return '0x...';
  }

  async signTypedData(payload: Eip712Payload): Promise<string> {
    // Sign the EIP-712 payload and return a 0x-prefixed signature
    return '0x...';
  }
}
```

### MetaMask Example

```typescript
import { RouterSigner, Eip712Payload } from '@dome-api/sdk';

function createMetaMaskSigner(ethereum: any): RouterSigner {
  return {
    async getAddress() {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });
      return accounts[0];
    },

    async signTypedData(payload: Eip712Payload) {
      const address = await this.getAddress();
      const signature = await ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(payload)],
      });
      return signature;
    },
  };
}
```

### WalletConnect Example

```typescript
import { RouterSigner, Eip712Payload } from '@dome-api/sdk';
import { WalletConnectModal } from '@walletconnect/modal';

function createWalletConnectSigner(modal: WalletConnectModal): RouterSigner {
  return {
    async getAddress() {
      const session = modal.getSession();
      return session.namespaces.eip155.accounts[0].split(':')[2];
    },

    async signTypedData(payload: Eip712Payload) {
      const address = await this.getAddress();
      const signature = await modal.request({
        chainId: 'eip155:1',
        topic: modal.getSession().topic,
        request: {
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(payload)],
        },
      });
      return signature;
    },
  };
}
```

## Testing

To test the router integration locally:

1. Set up a local Dome router backend (or use staging environment)
2. Configure environment variables
3. Run the example:

```bash
ts-node examples/privy-integration.ts
```

## Additional Resources

- [Privy Documentation](https://docs.privy.io)
- [Privy Authorization Keys](https://docs.privy.io/controls/authorization-keys)
- [Dome API Documentation](https://domeapi.io)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Polymarket CLOB API](https://docs.polymarket.com)

## Questions?

For questions about the router integration:

- Email: kurush@domeapi.com or kunal@domeapi.com
- See main README for additional support options
