# Link Flow Example

Self-contained example demonstrating the complete Polymarket account linking flow through the Dome API.

## What This Tests

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `/link-prepare` | Get EIP-712 payload to sign |
| 2 | (client) | Sign EIP-712 payload (+ deployment payload if needed) |
| 3 | `/link-complete` | Submit signature, get API credentials (+ safeTxPayload for fresh Safes) |
| 4a | (client) | Sign messageHash with eth_sign |
| 4b | `/link-set-allowances` | Submit signature, set USDC allowances |

**Streamlined Flow:** For freshly deployed Safes (nonce=0), `/link-complete` returns `safeTxPayload` directly, allowing you to skip `/link-set-allowances-prepare`. This reduces the number of API calls from 4 to 3.

## Setup

```bash
npm install
```

## Usage

### EOA Wallet (simple)

```bash
API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key npm test
```

### Safe Wallet (with auto-deploy)

```bash
API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key WALLET_TYPE=safe npm test
```

### Safe Wallet + Set Allowances

```bash
API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key WALLET_TYPE=safe TEST_ALLOWANCES=true npm test
```

### Using an Existing Wallet

```bash
API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key PRIVATE_KEY=0x... WALLET_TYPE=safe TEST_ALLOWANCES=true npm test
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_BASE_URL` | Yes | - | Dome API endpoint |
| `API_KEY` | Yes | - | Dome API key for authentication |
| `PRIVATE_KEY` | No | (generates new) | Existing wallet private key |
| `WALLET_TYPE` | No | `eoa` | `eoa` or `safe` |
| `TEST_ALLOWANCES` | No | `false` | Set to `true` to test allowance flow |
| `AUTO_DEPLOY_SAFE` | No | `true` | Set to `false` to skip Safe deployment |
| `CHAIN_ID` | No | `137` | Polygon mainnet |

## Output

The script outputs:

- **Wallet address** (and private key if newly generated)
- **API credentials** (apiKey, apiSecret, apiPassphrase)
- **Safe address** (for Safe wallets)
- **Transaction hashes** (for deployments/allowances)

**Important:** Save the private key if you want to reuse the wallet for future tests.

## Example Output

```
========================================
Dome Polymarket Link Flow Test
========================================
Configuration:
  API URL: https://api.domeapi.io
  Wallet Type: safe
  Chain ID: 137
  Auto Deploy Safe: true
  Test Allowances: true

=== WALLET INFO ===
Address: 0x1234...
Private Key: 0xabcd...
(Save this if you want to reuse the wallet)

Step 1: Calling /link-prepare...
✅ link-prepare succeeded
  Session ID: 550e8400-e29b-41d4-a716-446655440000
  Safe Address: 0x5678...
  Safe Deployed: true

Step 2: Signing EIP-712 payload...
  Signature valid: true

Step 3: Calling /link-complete...
✅ link-complete succeeded!
  API Key: abc123...
  API Secret: xyz789...

Step 4: Testing set-allowances flow...
✅ set-allowances succeeded!
  Allowances set: ["CTF_EXCHANGE", "NEG_RISK_CTF_EXCHANGE", "NEG_RISK_ADAPTER"]
  Transaction Hash: 0x9876...

========================================
✅ All tests passed!
========================================
```

## Troubleshooting

### "Session not found" error
The session from `/link-prepare` expires after 10 minutes. Run the full flow again.

### "Session expired" on set-allowances
The session for allowances is available for 30 minutes after `/link-complete`. If expired, restart the linking flow.

### Signature verification failed
- For `/link-complete`: Use `signTypedData` (EIP-712)
- For `/link-set-allowances`: Use `signMessage` (eth_sign / personal_sign)
