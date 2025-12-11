# External Wallet + Polymarket Quick Start

**Trade on Polymarket using any external wallet (MetaMask, Rabby, WalletConnect, etc.)**

This guide shows how to integrate Polymarket trading with external wallets using Safe smart accounts. All orders automatically use Dome's builder server for improved execution.

## How It Works

External wallets use a **Safe smart account** for trading:

1. **EOA (your wallet)** - Signs transactions and owns the Safe
2. **Safe (smart wallet)** - Holds USDC and executes trades
3. **CLOB API key** - Derived from one signature, used for all future trades

```
User's MetaMask (EOA)
       |
       | owns & signs for
       v
Safe Smart Account (holds USDC)
       |
       | trades on
       v
Polymarket CLOB
```

## Installation

```bash
npm install @dome-api/sdk wagmi viem @tanstack/react-query
```

## Quick Example (Node.js/Backend)

```typescript
import { PolymarketRouter } from '@dome-api/sdk';
import { ethers } from 'ethers';

// Create router
const router = new PolymarketRouter({ chainId: 137 });

// Create a signer adapter from ethers wallet
function createSignerFromWallet(wallet: ethers.Wallet) {
  return {
    getAddress: () => wallet.getAddress(),
    signTypedData: async payload => {
      return wallet._signTypedData(
        payload.domain,
        payload.types,
        payload.message
      );
    },
  };
}

// Initialize and link user
async function setupUser(privateKey: string) {
  const wallet = new ethers.Wallet(privateKey);
  const signer = createSignerFromWallet(wallet);

  // This will:
  // 1. Derive Safe address from EOA
  // 2. Deploy Safe if needed
  // 3. Set token allowances
  // 4. Create CLOB API credentials
  const result = await router.linkUser({
    userId: 'user-123',
    signer,
    walletType: 'safe',
    autoDeploySafe: true,
    autoSetAllowances: true,
  });

  console.log('Safe address:', result.safeAddress);
  console.log('API credentials:', result.credentials);

  return result;
}

// Place an order
async function placeOrder(privateKey: string, safeAddress: string) {
  const wallet = new ethers.Wallet(privateKey);
  const signer = createSignerFromWallet(wallet);

  const order = await router.placeOrder({
    userId: 'user-123',
    marketId: '0x...token_id',
    side: 'buy',
    size: 10,
    price: 0.65,
    signer,
    walletType: 'safe',
    funderAddress: safeAddress,
  });

  console.log('Order placed:', order);
}
```

## React/Frontend Integration

For a complete frontend example, see `examples/external-wallet-nextjs/`.

### Key Concepts

1. **Wallet Connection**: Use wagmi + your preferred connector (RainbowKit, ConnectKit, etc.)
2. **Signer Adapter**: Convert wagmi's wallet client to RouterSigner
3. **Session Storage**: Store API credentials and Safe address in localStorage
4. **Builder Signing**: API route handles builder credential signing server-side

### Creating a RouterSigner from wagmi

```typescript
import { useWalletClient } from 'wagmi';

function useRouterSigner() {
  const { data: walletClient } = useWalletClient();

  if (!walletClient) return null;

  return {
    getAddress: async () => walletClient.account.address,
    signTypedData: async payload => {
      return walletClient.signTypedData({
        domain: payload.domain as any,
        types: payload.types as any,
        primaryType: payload.primaryType,
        message: payload.message,
      });
    },
  };
}
```

## API Specification

### Future: Server-Side Endpoints (api.domeapi.io)

In future versions, the CLOB client logic will move to Dome's servers. Here's the planned API:

#### POST /v1/polymarket/link

Link a user to Polymarket by deploying their Safe and deriving API credentials.

**Request:**

```json
{
  "userId": "user-123",
  "eoaAddress": "0x...",
  "signature": "0x...",
  "walletType": "safe",
  "autoDeploySafe": true,
  "autoSetAllowances": true
}
```

**Response:**

```json
{
  "success": true,
  "safeAddress": "0x...",
  "credentials": {
    "apiKey": "...",
    "apiSecret": "...",
    "apiPassphrase": "..."
  },
  "safeDeployed": true,
  "allowancesSet": 3
}
```

#### POST /v1/polymarket/order

Place an order on behalf of a user.

**Request:**

```json
{
  "userId": "user-123",
  "marketId": "0x...token_id",
  "side": "buy",
  "size": 10,
  "price": 0.65,
  "walletType": "safe",
  "funderAddress": "0x...safe_address",
  "signature": "0x..."
}
```

**Response:**

```json
{
  "success": true,
  "orderId": "order-123",
  "status": "LIVE"
}
```

#### GET /v1/polymarket/session/:userId

Get the current trading session for a user.

**Response:**

```json
{
  "userId": "user-123",
  "eoaAddress": "0x...",
  "safeAddress": "0x...",
  "isSafeDeployed": true,
  "hasApiCredentials": true,
  "hasAllowances": true
}
```

## Wallet Types Comparison

| Feature        | EOA (Privy)      | Safe (External)       |
| -------------- | ---------------- | --------------------- |
| Signature Type | 0                | 2                     |
| Funder Address | EOA              | Safe                  |
| Deployment     | None             | Safe must be deployed |
| Allowances     | Set from EOA     | Set from Safe         |
| Gas Payer      | EOA              | EOA (for signing)     |
| Best For       | Server-side bots | User-facing apps      |

## Funding the Safe

After deployment, users need to fund their Safe with USDC:

```typescript
// Get the Safe address
const safeAddress = router.deriveSafeAddress(eoaAddress);

// User sends USDC to this address on Polygon
console.log('Send USDC to:', safeAddress);
```

**Token addresses on Polygon:**

- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- POL: Native token (for gas)

## Troubleshooting

| Error                    | Solution                                          |
| ------------------------ | ------------------------------------------------- |
| `Safe not deployed`      | Set `autoDeploySafe: true` or call `deploySafe()` |
| `funderAddress required` | Pass the Safe address when placing orders         |
| `insufficient allowance` | Allowances are set on Safe, not EOA               |
| `Cloudflare 403`         | Use VPN (Polymarket geo-blocks some regions)      |

## Support

- **Docs**: [Dome SDK Documentation](https://docs.domeapi.io)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
