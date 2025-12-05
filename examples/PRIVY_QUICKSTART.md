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
// This automatically sets token allowances if needed!
async function linkUser(user) {
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  // Pass privyWalletId to enable automatic allowance setup
  const credentials = await router.linkUser({
    userId: user.id,
    signer,
    privyWalletId: user.privyWalletId, // Enables auto-allowances
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
   - Token allowances are automatically set if `privyWalletId` is passed
3. **Trade freely** - Place unlimited orders by just passing wallet ID and address

## Key Features

- ✅ **Multi-user** - Works with unlimited users/wallets
- ✅ **Server-side** - No frontend dependencies or user popups
- ✅ **One signature per user** - Users sign once, trade forever
- ✅ **Auto-allowances** - Token approvals handled automatically during `linkUser()`
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

## Token Allowances (Automatic!)

Token allowances are **automatically handled** when you call `linkUser()` with `privyWalletId`. The SDK will:

1. Check if all 6 required allowances are set
2. If any are missing, send the approval transactions automatically
3. Then proceed with credential creation

**No manual allowance setup needed!** Just pass `privyWalletId` to `linkUser()`.

### Manual Control (Optional)

If you prefer to manage allowances separately:

```typescript
// Check current allowance status
const status = await router.checkAllowances(user.walletAddress);

if (!status.allSet) {
  const signer = createPrivySigner(
    privy,
    user.privyWalletId,
    user.walletAddress
  );

  // Set all allowances (6 transactions, one-time only)
  await router.setAllowances(signer, undefined, (step, current, total) => {
    console.log(`[${current}/${total}] ${step}`);
  });
}

// Then link without auto-allowances
const credentials = await router.linkUser({
  userId: user.id,
  signer,
  autoSetAllowances: false, // Disable auto-allowances
});
```

**Cost**: ~$0.006 USD in MATIC for gas fees (6 approval transactions, one-time per wallet).

See [ALLOWANCES_GUIDE.md](../ALLOWANCES_GUIDE.md) for detailed information.

## Privy Wallet Policy Setup (Required)

For auto-allowances to work, your Privy wallet policy must allow `eth_sendTransaction` to the Polymarket token contracts. This is a **one-time setup per Privy app**.

### Step 1: Create a Policy

First, create a policy that allows the required operations:

```bash
curl -X POST https://auth.privy.io/api/v1/policies \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '$PRIVY_APP_ID:$PRIVY_APP_SECRET' | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{
    "version": "1.0.0",
    "name": "Polymarket Trading Policy",
    "chain_type": "ethereum",
    "method_rules": [
      {
        "name": "Allow EIP-712 signing",
        "method": "eth_signTypedData_v4",
        "action": "ALLOW",
        "conditions": []
      }
    ],
    "default_action": "DENY"
  }'
```

Save the returned `id` (e.g., `xels4ezr77ek8ol9d1m8tqac`) - you'll need it for the next steps.

### Step 2: Add Token Approval Rules

Add rules to allow transactions to the USDC and CTF token contracts:

```bash
# Allow USDC token approvals
curl -X POST "https://auth.privy.io/api/v1/policies/$POLICY_ID/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '$PRIVY_APP_ID:$PRIVY_APP_SECRET' | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{
    "name": "Allow USDC token approvals",
    "method": "eth_sendTransaction",
    "action": "ALLOW",
    "conditions": [
      {
        "field_source": "ethereum_transaction",
        "field": "to",
        "operator": "eq",
        "value": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"
      }
    ]
  }'

# Allow CTF token approvals
curl -X POST "https://auth.privy.io/api/v1/policies/$POLICY_ID/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '$PRIVY_APP_ID:$PRIVY_APP_SECRET' | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{
    "name": "Allow CTF token approvals",
    "method": "eth_sendTransaction",
    "action": "ALLOW",
    "conditions": [
      {
        "field_source": "ethereum_transaction",
        "field": "to",
        "operator": "eq",
        "value": "0x4d97dcd97ec945f40cf65f87097ace5ea0476045"
      }
    ]
  }'
```

### Step 3: Attach Policy to Wallets

When creating wallets, attach the policy:

```typescript
const wallet = await privy.walletApi.create({
  chainType: 'ethereum',
  policyIds: ['your-policy-id-here'],
});
```

Or update existing wallets:

```bash
curl -X PATCH "https://auth.privy.io/api/v1/wallets/$WALLET_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '$PRIVY_APP_ID:$PRIVY_APP_SECRET' | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{
    "policy_ids": ["your-policy-id-here"]
  }'
```

### Verify Your Policy

Check that your policy is correctly configured:

```bash
curl "https://auth.privy.io/api/v1/policies/$POLICY_ID" \
  -H "Authorization: Basic $(echo -n '$PRIVY_APP_ID:$PRIVY_APP_SECRET' | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID"
```

You should see rules for:

- `eth_signTypedData_v4` (ALLOW) - for signing Polymarket orders
- `eth_sendTransaction` to USDC contract (ALLOW) - for token approvals
- `eth_sendTransaction` to CTF contract (ALLOW) - for token approvals

### Contract Addresses Reference

| Contract | Address                                      | Purpose                     |
| -------- | -------------------------------------------- | --------------------------- |
| USDC     | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Stablecoin for trading      |
| CTF      | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | Conditional Token Framework |

See [Privy Policies Documentation](https://docs.privy.io/guide/server/policies) for more details.

## Funding Wallets

Users need both tokens on Polygon to trade:

1. **USDC** (for trading)
   - **Contract**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
   - Send USDC to `user.walletAddress` on Polygon network

2. **POL/MATIC** (for gas fees during allowance setup)
   - **Amount needed**: ~0.01 POL (~$0.005 USD)
   - Only needed once for setting allowances

## Support

- **File**: [`privy-polymarket-simple.ts`](./privy-polymarket-simple.ts) - Full working example
- **Docs**: [Privy Authorization Keys](https://docs.privy.io/controls/authorization-keys)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
