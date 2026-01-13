# WalletConnect + Safe Wallet Integration

**Trade on Polymarket using WalletConnect with Safe smart accounts**

This guide shows how to integrate Polymarket trading when using WalletConnect to connect an external wallet (MetaMask, Rainbow, etc.) with a Safe smart account.

## Architecture

```
User's External Wallet (EOA)
       |
       | connected via WalletConnect
       v
Your App / Frontend
       |
       | signs orders with signatureType=2
       v
Safe Smart Account (holds USDC, maker)
       |
       | orders routed through
       v
Dome API -> Polymarket CLOB
```

**Key addresses:**

- **EOA (signer)**: The wallet connected via WalletConnect - signs all transactions
- **Safe (maker)**: The smart contract wallet that holds USDC and executes trades
- **API credentials**: Derived from EOA signature, registered for the EOA address

## Quick Start

### 1. Install Dependencies

```bash
npm install @dome-api/sdk @polymarket/clob-client ethers
```

### 2. Create Signer Adapter

Convert your WalletConnect/ethers signer to work with Dome SDK:

```typescript
import { ethers } from 'ethers';

function createSignerAdapter(wallet: ethers.Wallet | ethers.Signer) {
  return {
    getAddress: async () => wallet.getAddress(),
    signTypedData: async (payload: any) => {
      // For ethers v5
      return (wallet as any)._signTypedData(
        payload.domain,
        payload.types,
        payload.message
      );
    },
  };
}
```

### 3. Link User and Setup Safe

```typescript
import { PolymarketRouter } from '@dome-api/sdk';

const router = new PolymarketRouter({ chainId: 137 });

async function setupUser(wallet: ethers.Wallet) {
  const signer = createSignerAdapter(wallet);

  const result = await router.linkUser({
    userId: 'user-123',
    signer,
    walletType: 'safe',
    autoDeploySafe: true,
    autoSetAllowances: true,
  });

  console.log('EOA (signer):', await wallet.getAddress());
  console.log('Safe (maker):', result.safeAddress);
  console.log('API Key:', result.credentials.apiKey);

  return result;
}
```

### 4. Place Orders

```typescript
async function placeOrder(
  wallet: ethers.Wallet,
  safeAddress: string,
  tokenId: string
) {
  const signer = createSignerAdapter(wallet);

  const order = await router.placeOrder({
    userId: 'user-123',
    marketId: tokenId,
    side: 'buy',
    size: 10,
    price: 0.65,
    signer,
    walletType: 'safe',
    funderAddress: safeAddress,
  });

  console.log('Order result:', order);
  return order;
}
```

## Direct CLOB Client Usage (Advanced)

If you're using the `@polymarket/clob-client` directly (like in the polymarket-safe-trader example), here's the correct flow:

```typescript
import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

async function placeOrderWithClobClient(
  privateKey: string,
  safeAddress: string,
  tokenId: string
) {
  const wallet = new ethers.Wallet(privateKey);
  const eoaAddress = await wallet.getAddress();

  // Step 1: Derive API credentials (use EOA, no Safe params needed)
  const clobClientForCreds = new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet as any
  );
  const creds = await clobClientForCreds.deriveApiKey();

  // Step 2: Create order client WITH Safe params
  const clobClientForOrder = new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet as any,
    creds,
    2, // signatureType = 2 for Safe
    safeAddress // funderAddress = Safe address
  );

  // Step 3: Create and sign order
  const signedOrder = await clobClientForOrder.createOrder(
    {
      tokenID: tokenId,
      price: 0.5,
      side: 'BUY',
      size: 10,
      feeRateBps: 1000, // Check market requirements
    },
    { tickSize: '0.01', negRisk: false }
  );

  // signedOrder will have:
  // - maker: Safe address (holds funds)
  // - signer: EOA address (signs transactions)
  // - signatureType: 2

  // Step 4: POST to Dome API
  const response = await fetch('https://api.domeapi.io/v1/polymarket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: crypto.randomUUID(),
      params: {
        signedOrder: {
          ...signedOrder,
          side: signedOrder.side === 0 ? 'BUY' : 'SELL', // Convert numeric to string
        },
        orderType: 'GTC',
        credentials: {
          apiKey: creds.key,
          apiSecret: creds.secret,
          apiPassphrase: creds.passphrase,
        },
      },
    }),
  });

  return response.json();
}
```

## Important Notes

### API Credentials

- API credentials are derived from the **EOA's signature**
- Credentials are registered for the **EOA address** (signer), not the Safe (maker)
- The same credentials work for both deriveApiKey approaches (with or without Safe params)

### Order Structure

When using Safe wallets (signatureType=2):

| Field           | Value           | Description                            |
| --------------- | --------------- | -------------------------------------- |
| `maker`         | Safe address    | The account holding funds              |
| `signer`        | EOA address     | The account signing orders             |
| `signatureType` | 2               | Indicates Safe/Gnosis signature        |
| `feeRateBps`    | Market-specific | Check market requirements (often 1000) |

### Side Field Conversion

The CLOB client returns numeric side values, but Dome API expects strings:

- `0` -> `"BUY"`
- `1` -> `"SELL"`

## Troubleshooting

| Error                                          | Cause                            | Solution                                                    |
| ---------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `ORDER_REJECTED: Unauthorized/Invalid api key` | Using wrong address for API auth | Ensure Dome uses `signer` (EOA) address, not `maker` (Safe) |
| `invalid user provided fee rate`               | Fee rate doesn't match market    | Check market's required `feeRateBps`                        |
| `orderbook does not exist`                     | Invalid token ID                 | Use a valid market token ID                                 |
| `Safe not deployed`                            | Safe hasn't been created         | Use `autoDeploySafe: true` in linkUser                      |

## Example Script

See `examples/walletconnect-safe-repro.ts` for a complete working example that demonstrates:

1. Deriving API credentials
2. Creating and signing orders with Safe wallet
3. Posting orders through Dome API
4. Verifying order execution

Run it with:

```bash
EOA_PRIVATE_KEY=0x... DOME_API_KEY=... TOKEN_ID=... npx tsx examples/walletconnect-safe-repro.ts
```

## Support

- **Docs**: [Dome SDK Documentation](https://docs.domeapi.io)
- **Email**: kunal@domeapi.com or kurush@domeapi.com
