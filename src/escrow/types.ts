/**
 * Escrow Types for Dome Fee Escrow
 *
 * User-facing types for fee authorization signing.
 */

export interface OrderParams {
  userAddress: string;
  marketId: string;
  side: 'buy' | 'sell';
  size: bigint; // USDC amount (6 decimals)
  price: number; // 0.00 to 1.00
  timestamp: number; // Unix milliseconds (Date.now())
  chainId: number; // Chain ID for cross-chain replay protection
}

export interface FeeAuthorization {
  orderId: string;
  payer: string; // Address that will pay (EOA or SAFE)
  feeAmount: bigint;
  deadline: bigint;
}

export interface SignedFeeAuthorization extends FeeAuthorization {
  signature: string; // Packed bytes signature (65 bytes)
}
