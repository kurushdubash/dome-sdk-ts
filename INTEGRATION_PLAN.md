# SDK Escrow Integration Plan

## Overview

Integrate escrow module from `dome-sdk` into `dome-sdk-ts` (fork) for PR.

**Source:** `/home/codeandtest/proj/dome/dome-sdk/src/`
**Target:** `/home/codeandtest/proj/dome/dome-sdk-ts-pr/src/`

---

## Files to Add/Modify

### Phase 1: New Escrow Module (5 files)

| #   | File                     | Description                       | Status  |
| --- | ------------------------ | --------------------------------- | ------- |
| 1   | `src/escrow/types.ts`    | Type definitions for fee auth     | Pending |
| 2   | `src/escrow/utils.ts`    | Utility functions                 | Pending |
| 3   | `src/escrow/order-id.ts` | Order ID generation (keccak256)   | Pending |
| 4   | `src/escrow/signing.ts`  | EIP-712 fee authorization signing | Pending |
| 5   | `src/escrow/index.ts`    | Module exports                    | Pending |

### Phase 2: New Router (1 file)

| #   | File                              | Description                   | Status  |
| --- | --------------------------------- | ----------------------------- | ------- |
| 6   | `src/router/polymarket-escrow.ts` | Polymarket router with escrow | Pending |

### Phase 3: Updated Exports (2 files)

| #   | File                  | Description              | Status  |
| --- | --------------------- | ------------------------ | ------- |
| 7   | `src/index.ts`        | Add escrow exports       | Pending |
| 8   | `src/router/index.ts` | Add escrow router export | Pending |

### Phase 4: Tests (1 file)

| #   | File                                   | Description       | Status  |
| --- | -------------------------------------- | ----------------- | ------- |
| 9   | `src/tests/escrow-integration-test.ts` | Integration tests | Pending |

---

## Execution Order

1. **Review each file** from dome-sdk before copying
2. **Security check** for hardcoded secrets/addresses
3. **Copy to target**
4. **Verify imports** work correctly
5. **Mark complete** in this plan

---

## Security Checklist (per file)

- [ ] No hardcoded private keys
- [ ] No hardcoded wallet addresses (use env vars)
- [ ] No API keys/secrets
- [ ] Contract addresses are public (OK)

---

## Current Step

**Ready to start Phase 1, File 1: `src/escrow/types.ts`**
