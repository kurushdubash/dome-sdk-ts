# Privy + Polymarket Quick Start

**The simplest way to add Polymarket trading to your Privy-powered app.**

## Installation

```bash
npm install @dome-api/sdk @privy-io/server-auth
```

## Prerequisites

Before using the SDK, you need:

1. **Privy credentials** from your [Privy dashboard](https://dashboard.privy.io)
2. **Wallet policy** configured to allow token approvals (see [Policy Setup](#privy-wallet-policy-setup))
3. **Funded wallets** with USDC + small amount of POL for gas

## Environment Variables

```bash
export PRIVY_APP_ID="your-app-id"
export PRIVY_APP_SECRET="your-app-secret"
export PRIVY_AUTHORIZATION_KEY="wallet-auth:..."
```

## Complete Example

```typescript
import { PolymarketRouter, createPrivySigner } from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// Initialize once per app
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
  {
    walletApi: {
      authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY!,
    },
  }
);

const router = new PolymarketRouter({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
});

// Link user to Polymarket (ONE TIME per user)
// Automatically sets token allowances!
async function linkUser(user) {
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  const credentials = await router.linkUser({
    userId: user.id,
    signer,
    privyWalletId: user.privyWalletId, // Enables auto-allowances
  });

  // Store credentials in your database
  await db.users.update(user.id, { polymarketCredentials: credentials });
  return credentials;
}

// Place orders (unlimited, no signatures needed!)
async function placeOrder(user, marketId, side, size, price) {
  const credentials = await db.users.get(user.id).polymarketCredentials;

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
```

## How It Works

1. **Link user once** - Sets allowances + creates Polymarket API credentials
2. **Trade forever** - No more signatures needed, just pass wallet info

## Privy Wallet Policy Setup

**Required one-time setup.** Your wallet policy must allow `eth_sendTransaction` to token contracts.

### Step 1: Create Policy

```bash
curl -X POST https://auth.privy.io/api/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{
    "version": "1.0.0",
    "name": "Polymarket Trading Policy",
    "chain_type": "ethereum",
    "method_rules": [
      {"name": "Allow EIP-712 signing", "method": "eth_signTypedData_v4", "action": "ALLOW", "conditions": []}
    ],
    "default_action": "DENY"
  }'
```

Save the returned policy `id`.

### Step 2: Add Token Rules

```bash
# USDC approvals
curl -X POST "https://auth.privy.io/api/v1/policies/$POLICY_ID/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{"name": "USDC approvals", "method": "eth_sendTransaction", "action": "ALLOW",
       "conditions": [{"field_source": "ethereum_transaction", "field": "to", "operator": "eq",
                       "value": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"}]}'

# CTF approvals
curl -X POST "https://auth.privy.io/api/v1/policies/$POLICY_ID/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{"name": "CTF approvals", "method": "eth_sendTransaction", "action": "ALLOW",
       "conditions": [{"field_source": "ethereum_transaction", "field": "to", "operator": "eq",
                       "value": "0x4d97dcd97ec945f40cf65f87097ace5ea0476045"}]}'
```

### Step 3: Attach to Wallets

```typescript
// When creating new wallets
const wallet = await privy.walletApi.create({
  chainType: 'ethereum',
  policyIds: ['your-policy-id'],
});
```

## Token Allowances

**Handled automatically!** When you call `linkUser()` with `privyWalletId`, the SDK:

1. Checks if all 6 required allowances are set
2. Sends approval transactions if any are missing
3. Proceeds with credential creation

### Why 6 Allowances?

Polymarket uses 3 exchange contracts, each needing USDC + CTF approval:

| Contract              | Address                                      |
| --------------------- | -------------------------------------------- |
| CTF Exchange          | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |
| Neg Risk Adapter      | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |

**Cost**: ~$0.006 total in POL gas fees (one-time per wallet).

### Manual Control (Optional)

```typescript
// Check allowances
const status = await router.checkAllowances(walletAddress);

// Set manually if needed
if (!status.allSet) {
  await router.setAllowances(signer, undefined, (step, i, total) => {
    console.log(`[${i}/${total}] ${step}`);
  });
}
```

## Funding Wallets

| Token | Contract                                     | Purpose            |
| ----- | -------------------------------------------- | ------------------ |
| USDC  | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Trading capital    |
| POL   | Native token                                 | Gas (~$0.01 total) |

## Troubleshooting

| Error                    | Solution                                         |
| ------------------------ | ------------------------------------------------ |
| `insufficient allowance` | Ensure `privyWalletId` is passed to `linkUser()` |
| `policy violation`       | Add token rules to wallet policy (see above)     |
| `insufficient balance`   | Fund wallet with USDC + POL                      |
| Cloudflare 403           | Use VPN (Polymarket geo-blocks some regions)     |

## Support

- **Docs**: [Privy Authorization Keys](https://docs.privy.io/controls/authorization-keys)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
