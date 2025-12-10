# External Dependencies Documentation

This document provides documentation for 3rd party APIs, SDKs, and services used in this repository. When working with this codebase, refer to this file to understand how external dependencies work.

## Privy TypeScript SDK

Privy is used for wallet authentication and management, particularly for creating embedded wallets and handling EIP-712 signing.

### Key Resources

- **Official Docs**: https://docs.privy.io
- **React SDK**: `@privy-io/react-auth` - Client-side authentication and wallet management
- **Server SDK**: `@privy-io/server-auth` - Server-side user verification and signing

### Core Concepts

#### 1. Embedded Wallets

Privy creates embedded wallets for users that are stored securely. These wallets can sign transactions on behalf of users without requiring them to have MetaMask or other external wallet extensions.

```typescript
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

// Get user and their embedded wallet
const user = await privy.getUser(privyUserId);
const embeddedWallet = user.linkedAccounts.find(
  account => account.type === 'wallet' && account.walletClientType === 'privy'
);
```

#### 2. Server-Side Signing with Authorization Keys

Privy supports server-side signing using authorization keys, which allows your backend to sign transactions/messages on behalf of users without active user interaction.

**Getting Authorization Keys:**

1. Go to https://dashboard.privy.io
2. Navigate to Settings → API Keys
3. Create an authorization key with signing permissions
4. Store as `PRIVY_AUTHORIZATION_KEY` environment variable

**Signing EIP-712 Messages (using PrivyClient):**

```typescript
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(appId, appSecret, {
  walletApi: {
    authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_KEY,
  },
});

const { signature } = await privy.walletApi.ethereum.signTypedData({
  walletId,
  typedData: {
    domain: payload.domain,
    types: payload.types,
    primaryType: payload.primaryType,
    message: payload.message,
  },
});
```

#### 3. Server-Side Transactions with sendTransaction

Privy's `sendTransaction` API allows sending transactions directly from server-side:

```typescript
const result = await privy.walletApi.ethereum.sendTransaction({
  walletId,
  caip2: 'eip155:137', // Polygon mainnet
  transaction: {
    to: contractAddress,
    data: encodedData,
    chainId: 137,
  },
  sponsor: true, // Optional: Privy pays gas fees
});

console.log('Transaction hash:', result.hash);
```

**Gas Sponsorship:**
When `sponsor: true` is passed, Privy covers the gas fees for the transaction. This requires gas sponsorship to be enabled in your Privy dashboard.

#### 4. Wallet Policies

Privy wallet policies control what operations wallets can perform. For Polymarket trading, you need to allow:

- `eth_signTypedData_v4` - For signing orders and deriving API keys
- `eth_sendTransaction` to USDC and CTF token contracts - For setting allowances

**Creating a Policy:**

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

**Adding Token Approval Rules:**

```bash
# USDC approvals
curl -X POST "https://auth.privy.io/api/v1/policies/$POLICY_ID/rules" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n "$PRIVY_APP_ID:$PRIVY_APP_SECRET" | base64)" \
  -H "privy-app-id: $PRIVY_APP_ID" \
  -d '{"name": "USDC approvals", "method": "eth_sendTransaction", "action": "ALLOW",
       "conditions": [{"field_source": "ethereum_transaction", "field": "to", "operator": "eq",
                       "value": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"}]}'
```

See `examples/PRIVY_QUICKSTART.md` for complete policy setup instructions.

#### 5. Client-Side Integration (React)

```typescript
import { usePrivy } from '@privy-io/react-auth';

function MyComponent() {
  const { user, signTypedData } = usePrivy();

  // Sign EIP-712 message client-side
  const signature = await signTypedData({
    domain: {
      /* ... */
    },
    types: {
      /* ... */
    },
    primaryType: 'TypeName',
    message: {
      /* ... */
    },
  });
}
```

### Common Patterns in This Repo

#### Creating a RouterSigner for Privy (Server-Side)

The Dome SDK provides built-in Privy utilities. Use `createPrivySigner()` from `@dome-api/sdk`:

```typescript
import {
  PolymarketRouter,
  createPrivySigner,
  createPrivyClient,
} from '@dome-api/sdk';
import { PrivyClient } from '@privy-io/server-auth';

// Create Privy client with authorization key
const privy = createPrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
});

// Create a RouterSigner from Privy wallet
const signer = createPrivySigner(privy, walletId, walletAddress);

// Use with PolymarketRouter
const router = new PolymarketRouter({
  chainId: 137,
  privy: {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  },
});

// Link user with auto-allowances and gas sponsorship
const credentials = await router.linkUser({
  userId: 'user-123',
  signer,
  privyWalletId: walletId, // Enables auto-allowances
  sponsorGas: true, // Privy pays gas fees for allowances
});
```

See `examples/PRIVY_QUICKSTART.md` for complete implementation.

#### Environment Variables

```bash
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
PRIVY_AUTHORIZATION_KEY=wallet-auth:...
```

### Key API Endpoints

- **Get User**: `GET https://auth.privy.io/api/v1/users/{user_id}`
- **Sign Typed Data**: `privy.walletApi.ethereum.signTypedData()` (via PrivyClient)
- **Send Transaction**: `privy.walletApi.ethereum.sendTransaction()` (via PrivyClient)
- **Create Policy**: `POST https://auth.privy.io/api/v1/policies`
- **Add Policy Rule**: `POST https://auth.privy.io/api/v1/policies/{policy_id}/rules`

### Important Notes

- **Authorization keys** have broad permissions - store them securely (use environment variables, not hardcoded)
- **Embedded wallets** are custodial - Privy manages the private keys
- **User IDs** are in the format `did:privy:...`
- **Wallet addresses** are lowercase checksummed Ethereum addresses
- **Wallet policies** must allow `eth_signTypedData_v4` and `eth_sendTransaction` to USDC/CTF contracts
- **Gas sponsorship** requires enabling in Privy dashboard and passing `sponsor: true`

---

## Polymarket CLOB Client

The Polymarket CLOB (Central Limit Order Book) client is used for direct trading on Polymarket.

### Key Resources

- **Package**: `@polymarket/clob-client`
- **Docs**: https://github.com/Polymarket/clob-client

### Core Concepts

#### 1. API Key Derivation

Polymarket uses EIP-712 signing to derive API credentials from a wallet signature. This happens once per user.

```typescript
import { ClobClient } from '@polymarket/clob-client';

const clobClient = new ClobClient(
  'https://clob.polymarket.com',
  137, // Polygon chainId
  signer // ethers-compatible signer
);

// Derive API key (prompts ONE signature)
const apiKeyCreds = await clobClient.deriveApiKey();
// Returns: { key, secret, passphrase }
```

#### 2. Trading with API Keys

Once credentials are derived, all trades use API keys (no more signatures):

```typescript
const authenticatedClient = new ClobClient(
  'https://clob.polymarket.com',
  137,
  undefined,
  apiKeyCreds
);

await authenticatedClient.createAndPostOrder({
  tokenID: 'market-token-id',
  price: 0.65,
  size: 10,
  side: 'BUY',
});
```

### Token Allowances for EOA Wallets

**IMPORTANT**: EOA wallets (MetaMask, Privy embedded wallets, etc.) must set token allowances before trading.

Polymarket requires two types of approvals:

1. **USDC Allowance** - Approve USDC spending for exchange contracts
   - Token: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
   - Approve for: CTF Exchange, Neg Risk CTF Exchange, Neg Risk Adapter

2. **CTF Allowance** - Approve Conditional Token Framework tokens
   - Token: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
   - Approve for: Same 3 contracts

**Why this is needed:**

- EOA wallets require explicit on-chain approvals for contracts to move tokens
- This is a one-time setup per wallet (approvals persist forever)
- Email/Magic wallets don't need this because they use smart contract wallets

**The confusing part:**

- If wallet has no funds → error is "insufficient balance"
- If wallet has funds but no allowances → error is "insufficient allowance"
- That's why test wallets don't show the allowance error!

**See**: `ALLOWANCES_GUIDE.md` for detailed implementation guide.

### Common Patterns in This Repo

We wrap the CLOB client in `PolymarketRouter` to provide a cleaner interface. See `src/router/polymarket.ts`.

The router includes `checkAllowances()` and `setAllowances()` methods to automate allowance management.

---

## Other External Dependencies

### Polymarket Builder Signing SDK

The `@polymarket/builder-signing-sdk` is used for builder server integration.

**Package**: `@polymarket/builder-signing-sdk`

**Purpose**: Builder servers sign orders alongside user signatures for improved execution.

**Configuration**:

```typescript
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const builderConfig = new BuilderConfig({
  remoteBuilderConfig: {
    url: 'https://builder-signer.domeapi.io/builder-signer/sign',
  },
});

// Pass to ClobClient
const clobClient = new ClobClient(
  host,
  chainId,
  signer,
  apiKeyCreds,
  signatureType,
  funderAddress,
  geoBlockToken,
  useServerTime,
  builderConfig // <-- Builder config here
);
```

**Benefits**:

- Better order routing and execution
- Reduced MEV exposure
- Priority order matching
- Access to private order flow

The Dome SDK automatically configures this for all orders via `PolymarketRouter`.

---

### Ethers.js (via Polymarket CLOB Client)

The `@polymarket/clob-client` uses ethers.js v5 internally. When creating signers, they must be compatible with ethers `Wallet` interface:

```typescript
interface EthersWallet {
  getAddress(): Promise<string>;
  signTypedData(domain: any, types: any, value: any): Promise<string>;
}
```

We adapt our `RouterSigner` interface to match this when needed.
