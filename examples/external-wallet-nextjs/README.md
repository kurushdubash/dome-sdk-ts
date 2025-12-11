# External Wallet Trading Example

A Next.js example app demonstrating how to integrate Polymarket trading with external wallets (MetaMask, Rabby, etc.) using Safe smart accounts.

## Features

- Connect external wallets via wagmi (injected connector)
- Derive and deploy Safe smart account for trading
- Set token allowances automatically
- Session persistence in localStorage
- Builder signing via Dome's remote service (no credentials needed)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

No environment configuration is required - builder signing is handled automatically via Dome's service.

### Optional: Custom RPC URL

If you want to use a custom Polygon RPC URL:

```bash
cp .env.local.example .env.local
# Edit .env.local with your RPC URL
```

## How It Works

### 1. Wallet Connection

The app uses wagmi with the `injected` connector to connect to any browser wallet (MetaMask, Rabby, Coinbase Wallet, etc.).

### 2. Safe Address Derivation

When connected, a Safe smart account address is **deterministically derived** from your EOA address. This address is always the same for a given wallet.

### 3. Trading Session Initialization

When "Start Trading Session" is clicked:

1. **RelayClient Creation**: Creates a client with your wallet signer and Dome's builder config
2. **Safe Deployment Check**: Checks if Safe is already deployed on-chain
3. **Safe Deployment**: If not deployed, deploys the Safe (requires signature)
4. **Allowance Setting**: Sets USDC approvals for Polymarket exchange contracts

### 4. Funding

After initialization, send USDC to your Safe address. The app displays the Safe address for funding.

### 5. Trading

Orders are placed using:

- **Signer**: Your EOA signs the order
- **Funder**: The Safe holds the USDC and executes the trade
- **Signature Type**: 2 (browser wallet with Safe)

## Architecture

```
User's MetaMask (EOA)
       |
       | signs transactions
       v
RelayClient + BuilderConfig
       |
       | manages
       v
Safe Smart Account (holds USDC)
       |
       | trades via
       v
Polymarket CLOB
```

## Key Files

| File                                | Description                      |
| ----------------------------------- | -------------------------------- |
| `hooks/useTradingSession.ts`        | Main trading session logic       |
| `providers/WagmiProvider.tsx`       | Wagmi + React Query setup        |
| `app/api/polymarket/sign/route.ts`  | Builder signing proxy endpoint   |
| `utils/session.ts`                  | Session localStorage persistence |
| `app/components/TradingSession.tsx` | Session UI component             |
| `app/components/ConnectWallet.tsx`  | Wallet connection UI             |

## Dependencies

- **@polymarket/builder-relayer-client**: Safe deployment and relay operations
- **@polymarket/builder-signing-sdk**: Builder HMAC signing configuration
- **ethers**: Ethereum library (v5)
- **wagmi**: React hooks for Ethereum
- **viem**: TypeScript Ethereum library

## Builder Signing

All orders are attributed through Dome's builder-signer service:

```
https://builder-signer.domeapi.io/builder-signer/sign
```

The `/api/polymarket/sign` route proxies requests to this service. No local builder credentials are needed.

## Session Persistence

Sessions are stored in localStorage with the key format:

```
trading_session_{eoaAddress}
```

This allows users to return to a previously initialized session without re-deploying.

## Learn More

- [External Wallet Guide](../EOA.md) - Detailed integration guide
- [Dome SDK Documentation](https://github.com/domeapi/dome-sdk-ts)
- [wagmi Documentation](https://wagmi.sh)
- [Safe Smart Accounts](https://safe.global/)
