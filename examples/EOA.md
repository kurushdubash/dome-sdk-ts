# External Wallet (EOA) Integration

This guide explains how to integrate external wallets (MetaMask, Rabby, etc.) with Polymarket trading using Safe smart contract wallets.

## Overview

Unlike Privy-managed embedded wallets, external wallets require a different architecture:

- **EOA (Externally Owned Account)**: Your browser wallet (MetaMask, Rabby) that signs transactions
- **Safe Wallet**: A smart contract wallet that holds your funds (USDC) for trading
- **Builder Signer**: Dome's remote signing service for order attribution

```
User's MetaMask (EOA)
       |
       | signs transactions
       v
Safe Smart Account (holds USDC)
       |
       | trades via
       v
Polymarket CLOB
```

## Key Concepts

### Wallet Types

| Type | Description                   | Signature Type      |
| ---- | ----------------------------- | ------------------- |
| EOA  | Direct wallet signing (Privy) | `signatureType = 0` |
| Safe | Smart contract wallet         | `signatureType = 2` |

### Safe Address Derivation

Safe addresses are **deterministically derived** from your EOA address using CREATE2. This means:

- The Safe address is always the same for a given EOA
- You can know the Safe address before deploying it
- Users fund the Safe address, not their EOA

## Frontend Integration

### Quick Start

See the complete working example in `examples/external-wallet-nextjs/`.

```bash
cd examples/external-wallet-nextjs
npm install
npm run dev
# Open http://localhost:3000
```

### Core Dependencies

```json
{
  "@polymarket/builder-relayer-client": "^0.0.6",
  "@polymarket/builder-signing-sdk": "^0.0.8",
  "ethers": "^5.8.0",
  "wagmi": "^2.5.0",
  "viem": "^2.39.2"
}
```

### Key Steps

#### 1. Derive Safe Address

```typescript
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';

const POLYGON_CHAIN_ID = 137;

function deriveSafeAddress(eoaAddress: string): string {
  const config = getContractConfig(POLYGON_CHAIN_ID);
  return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
}
```

#### 2. Create RelayClient

```typescript
import { providers } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';

const RELAYER_URL = 'https://relayer-v2.polymarket.com/';
const BUILDER_SIGNER_URL =
  'https://builder-signer.domeapi.io/builder-signer/sign';

function createRelayClient(walletClient: any): RelayClient {
  const provider = new providers.Web3Provider(walletClient);
  const signer = provider.getSigner();

  const builderConfig = new BuilderConfig({
    remoteBuilderConfig: {
      url: BUILDER_SIGNER_URL,
    },
  });

  return new RelayClient(
    RELAYER_URL,
    137, // Polygon
    signer,
    builderConfig
  );
}
```

#### 3. Deploy Safe

```typescript
async function deploySafe(relayClient: RelayClient): Promise<string> {
  const response = await relayClient.deploy();
  const result = await response.wait();

  if (!result) {
    throw new Error('Safe deployment failed');
  }

  return result.proxyAddress;
}
```

#### 4. Set Allowances

```typescript
async function setAllowances(relayClient: RelayClient): Promise<void> {
  // RelayClient handles setting USDC approvals for Polymarket contracts
  await (relayClient as any).setAllowances();
}
```

#### 5. Check Deployment Status

```typescript
async function isSafeDeployed(
  relayClient: RelayClient,
  safeAddress: string
): Promise<boolean> {
  try {
    return await (relayClient as any).getDeployed(safeAddress);
  } catch {
    // Fallback to RPC check
    const provider = new providers.JsonRpcProvider('https://polygon-rpc.com');
    const code = await provider.getCode(safeAddress);
    return code !== '0x' && code.length > 2;
  }
}
```

## Session Flow

1. **Connect Wallet**: User connects MetaMask/Rabby via wagmi
2. **Derive Safe Address**: Deterministically compute Safe address from EOA
3. **Check Deployment**: See if Safe is already deployed
4. **Deploy Safe** (if needed): Prompts user for signature
5. **Set Allowances**: Approve USDC for Polymarket contracts
6. **Fund Safe**: User sends USDC to Safe address
7. **Ready to Trade**: Safe is ready for order placement

## Builder Signing

All requests are signed through Dome's builder-signer service:

```
https://builder-signer.domeapi.io/builder-signer/sign
```

This provides:

- Better order routing and execution
- Reduced MEV exposure
- Priority order matching
- No local credentials needed

## Architecture

### Frontend (Next.js Example)

```
external-wallet-nextjs/
├── app/
│   ├── api/polymarket/sign/route.ts  # Proxies to Dome builder-signer
│   ├── components/
│   │   ├── ConnectWallet.tsx         # Wallet connection UI
│   │   ├── TradingSession.tsx        # Session management UI
│   │   └── PlaceOrder.tsx            # Order placement UI
│   └── page.tsx
├── hooks/
│   └── useTradingSession.ts          # Main session hook
├── providers/
│   └── WagmiProvider.tsx             # Wagmi + React Query setup
└── utils/
    └── session.ts                    # LocalStorage persistence
```

### Key Files

- **useTradingSession.ts**: Main hook managing Safe deployment, allowances, and session state
- **WagmiProvider.tsx**: Configures wagmi with injected connector (works with any browser wallet)
- **/api/polymarket/sign/route.ts**: Proxies signing requests to Dome's builder-signer

## Differences from Privy Integration

| Feature        | Privy (EOA)               | External Wallet (Safe)  |
| -------------- | ------------------------- | ----------------------- |
| Wallet         | Embedded, server-managed  | User's browser wallet   |
| Funds          | Held in EOA               | Held in Safe            |
| Signing        | Server-side via Privy API | Client-side via browser |
| Signature Type | 0                         | 2                       |
| Deployment     | None needed               | Safe must be deployed   |
| Gas            | Can be sponsored          | User pays (or relayer)  |

## Order Types

When placing orders, you can specify the `orderType` parameter:

| Type  | Name             | Behavior                                                |
| ----- | ---------------- | ------------------------------------------------------- |
| `GTC` | Good Till Cancel | Order stays on book until filled or cancelled (default) |
| `GTD` | Good Till Date   | Order expires at specified time                         |
| `FOK` | Fill Or Kill     | Must fill completely immediately or cancel entirely     |
| `FAK` | Fill And Kill    | Fills as much as possible immediately, cancels the rest |

```typescript
await router.placeOrder(
  {
    userId: user.id,
    marketId: '...',
    side: 'buy',
    size: 100,
    price: 0.5,
    orderType: 'FOK', // For copy trading - instant fill or cancel
    signer,
    walletType: 'safe',
    funderAddress: safeAddress,
  },
  credentials
);
```

**Copy Trading Tip**: Use `FOK` or `FAK` for instant confirmation of whether an order was filled.

## Next Steps

After initializing a trading session:

1. **Fund your Safe**: Send USDC to the Safe address shown in the UI
2. **Place Orders**: Use the Polymarket CLOB client with `signatureType: 2`
3. **Monitor Positions**: Query the CLOB API for your positions

## Troubleshooting

### "Safe deployment failed"

- Ensure you're connected to Polygon network
- Check that you approved the signature request in your wallet

### "Allowances not set"

- The RelayClient handles this automatically
- If it fails, you may need to set approvals manually via the Safe

### "Wrong network"

- The app should auto-switch to Polygon (chain ID 137)
- If not, manually switch in your wallet

## Resources

- [Polymarket CLOB Client](https://github.com/Polymarket/clob-client)
- [Safe Smart Accounts](https://safe.global/)
- [wagmi Documentation](https://wagmi.sh)
- [Dome SDK](https://github.com/domeapi/dome-sdk-ts)
