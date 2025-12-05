# Token Allowances Guide for Polymarket Trading

## Overview

When trading on Polymarket using EOA (Externally Owned Account) wallets like MetaMask or Privy embedded wallets, you need to set **token allowances** before you can trade. This is a one-time setup per wallet.

## Why Are Allowances Needed?

Polymarket uses smart contracts to execute trades. For these contracts to move tokens on your behalf, you must:

1. **Approve USDC spending** - Allow the exchange contracts to use your USDC for buying positions
2. **Approve CTF tokens** - Allow the exchange contracts to transfer outcome tokens (Conditional Token Framework)

**Important**: This is a blockchain requirement for EOA wallets. Email/Magic wallets managed by Polymarket don't need manual allowances because they use a different architecture (smart contract wallets).

## When Do You Need to Set Allowances?

- **Once per wallet, ever** - After setting allowances, they persist forever
- **Not per-market** - Allowances work for ALL Polymarket markets
- **Not per-trade** - After setup, you can trade unlimited times without approvals

## The Allowance Error

If allowances are not set, you'll see errors like:

```
Error: insufficient allowance
Error: ERC20: transfer amount exceeds allowance
Error: ERC1155: caller is not owner nor approved
```

The confusing part: **This error only appears when the wallet has funds**. If the wallet is empty, you'll see a "insufficient balance" error first, which masks the allowance issue.

## Contracts That Need Approval

Polymarket uses 3 exchange contracts that all need approvals:

| Contract Name         | Address                                      |
| --------------------- | -------------------------------------------- |
| CTF Exchange          | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` |
| Neg Risk Adapter      | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |

For each contract, you need to approve:

- **USDC Token** (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`)
- **CTF Token** (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`)

That's **6 total approvals** (3 contracts × 2 tokens).

## Using the SDK to Manage Allowances

### Check Allowances

```typescript
import { PolymarketRouter } from '@dome-api/sdk/router';

const router = new PolymarketRouter({ chainId: 137 });

// Check if all allowances are set
const status = await router.checkAllowances(walletAddress);

if (!status.allSet) {
  console.log('Missing allowances!');
  console.log('USDC approvals:', status.usdc);
  console.log('CTF approvals:', status.ctf);
}
```

### Set All Allowances (Automated)

```typescript
import { PolymarketRouter, createPrivySigner } from '@dome-api/sdk/router';

const router = new PolymarketRouter({ chainId: 137 });
const signer = createPrivySigner(privy, walletId, walletAddress);

// Set all 6 approvals automatically
const txHashes = await router.setAllowances(
  signer,
  undefined, // Use default RPC
  (step, current, total) => {
    console.log(`[${current}/${total}] ${step}`);
  }
);

console.log('Approval transaction hashes:', txHashes);
```

### Set Allowances Manually

If you prefer to set allowances yourself:

```typescript
import {
  approveUsdc,
  approveCtf,
  getPolygonProvider,
  POLYGON_ADDRESSES,
} from '@dome-api/sdk/router';

const provider = getPolygonProvider();
const signer = createPrivySigner(privy, walletId, walletAddress);

// Approve USDC for CTF Exchange
await approveUsdc(signer, POLYGON_ADDRESSES.CTF_EXCHANGE, provider);

// Approve CTF tokens for CTF Exchange
await approveCtf(signer, POLYGON_ADDRESSES.CTF_EXCHANGE, provider);

// Repeat for other contracts...
```

## Integration Into Your Trading Flow

### Recommended Pattern

```typescript
async function ensureWalletReady(user) {
  const router = new PolymarketRouter({ chainId: 137 });

  // 1. Check if allowances are set
  const status = await router.checkAllowances(user.walletAddress);

  if (!status.allSet) {
    console.log('Setting up wallet for trading (one-time setup)...');

    // 2. Set allowances if missing
    const signer = createPrivySigner(privy, user.privyWalletId, user.walletAddress);
    await router.setAllowances(signer);

    console.log('✅ Wallet ready for trading!');
  } else {
    console.log('✅ Wallet already configured');
  }

  // 3. Now you can trade
  await router.placeOrder({...});
}
```

### Checking Before Each Trade (Defensive)

```typescript
async function placeOrderSafely(user, orderParams) {
  const router = new PolymarketRouter({ chainId: 137 });

  // Check allowances before trading
  const status = await router.checkAllowances(user.walletAddress);

  if (!status.allSet) {
    throw new Error(
      'Wallet not configured for trading. Please set token allowances first.'
    );
  }

  // Place order
  return await router.placeOrder(orderParams, user.credentials);
}
```

## Why the PRIVY_QUICKSTART Example Doesn't Mention This

The quickstart example works without explicitly setting allowances because:

1. **Test wallets are usually empty** - The error shown is "insufficient balance", not "insufficient allowance"
2. **The example doesn't fund the wallet** - You never get far enough to hit the allowance check
3. **It's demonstrating the signature flow** - The focus is on Polymarket API key derivation, not actual trading

**In production**: Once you fund a wallet with USDC and try to place a real order, you WILL hit the allowance error if allowances aren't set.

## Testing Allowances

We've included a test script:

```bash
npm run build
tsx test-allowances.ts
```

This will:

1. Create a test Privy wallet
2. Check current allowances
3. Attempt to set missing allowances (will fail if wallet has no MATIC for gas)
4. Verify final state

**Note**: To actually set allowances on-chain, the wallet needs:

- Small amount of MATIC (Polygon's native token) for gas fees (~$0.01 worth)
- The transactions will be submitted to the blockchain

## Gas Costs

Each approval transaction costs:

- ~45,000-50,000 gas
- At 30 gwei gas price: ~0.0015 MATIC (~$0.001 USD)
- Total for 6 approvals: ~$0.006 USD

These are one-time costs.

## Troubleshooting

### "insufficient balance" error when setting allowances

- The wallet needs MATIC for gas fees
- Send 0.01 MATIC to the wallet address

### "insufficient allowance" error when trading

- Run `router.checkAllowances()` to see which approvals are missing
- Use `router.setAllowances()` to fix
- Verify allowances are set before trying to trade again

### Allowances seem set but trading still fails

- Make sure wallet has USDC balance (not just MATIC)
- Verify you're using the correct network (Polygon, chainId 137)
- Check that you're using the same wallet address for both allowances and trading

### Why 6 transactions instead of 2?

- Polymarket uses 3 different exchange contracts for different market types
- Each contract needs separate USDC and CTF approvals
- This is a Polymarket architecture decision for handling different risk models

## API Reference

### `router.checkAllowances(walletAddress, rpcUrl?)`

Returns:

```typescript
{
  allSet: boolean;
  usdc: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  }
  ctf: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  }
}
```

### `router.setAllowances(signer, rpcUrl?, onProgress?)`

- Sets all missing allowances
- Skips allowances that are already set
- Optionally reports progress via callback
- Returns transaction hashes for each approval

Returns:

```typescript
{
  usdc: {
    ctfExchange?: string;      // tx hash if set
    negRiskCtfExchange?: string;
    negRiskAdapter?: string;
  };
  ctf: {
    ctfExchange?: string;
    negRiskCtfExchange?: string;
    negRiskAdapter?: string;
  };
}
```

## Additional Resources

- [Polymarket CLOB Allowances Documentation](https://github.com/Polymarket/py-clob-client?tab=readme-ov-file#important-token-allowances-for-metamaskeoa-users)
- [Python Example](https://gist.github.com/poly-rodr/44313920481de58d5a3f6d1f8226bd5e)
- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [ERC1155 Token Standard](https://eips.ethereum.org/EIPS/eip-1155)

## Support

Questions? Email:

- kunal@domeapi.com
- kurush@domeapi.com
