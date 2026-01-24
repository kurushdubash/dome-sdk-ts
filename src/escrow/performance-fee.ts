/**
 * Performance Fee Functions for Dome Fee Escrow
 *
 * Provides tools for the "wins-only" fee model where users pay fees
 * only when claiming winning positions.
 *
 * Flow:
 * 1. User calculates fee based on winnings
 * 2. User sends USDC payments to DOME + affiliate addresses
 * 3. User submits payment proof to DOME API
 * 4. DOME verifies payments and claims position on user's behalf
 */

import { ethers } from 'ethers';
import { USDC_POLYGON } from './utils.js';

// ============ Types ============

/**
 * Fee configuration for a user/affiliate
 */
export interface FeeConfig {
  /** Order fee (upfront, on every order) */
  orderFee: {
    enabled: boolean;
    feeBps: number;
    minFeeUsdc: bigint;
  };
  /** Performance fee (on winning claims only) */
  performanceFee: {
    enabled: boolean;
    feeBps: number;
    minFeeUsdc: bigint;
  };
  /** Affiliate configuration */
  affiliate: {
    address: string;
    splitBps: number; // e.g., 2000 = 20% to affiliate
  };
  /** DOME treasury address */
  domeAddress: string;
}

/**
 * Calculated performance fee breakdown
 */
export interface PerformanceFeeSplit {
  totalFee: bigint;
  domeAmount: bigint;
  affiliateAmount: bigint;
  domeAddress: string;
  affiliateAddress: string;
}

/**
 * Payment verification result
 */
export interface PaymentVerification {
  verified: boolean;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  transfers: {
    to: string;
    amount: bigint;
  }[];
  errors?: string[];
}

// ============ Fee Calculation ============

/**
 * Calculate performance fee split between DOME and affiliate
 *
 * @param winnings - Total winnings amount in USDC (6 decimals)
 * @param feeConfig - Fee configuration for this user
 * @returns Fee amounts for DOME and affiliate
 *
 * @example
 * ```typescript
 * const split = calculatePerformanceFee(parseUsdc(100), feeConfig);
 * // winnings: $100, fee: 5% = $5
 * // split: $4 to DOME (80%), $1 to affiliate (20%)
 * ```
 */
export function calculatePerformanceFee(
  winnings: bigint,
  feeConfig: FeeConfig
): PerformanceFeeSplit {
  const { performanceFee, affiliate, domeAddress } = feeConfig;

  if (!performanceFee.enabled) {
    return {
      totalFee: BigInt(0),
      domeAmount: BigInt(0),
      affiliateAmount: BigInt(0),
      domeAddress,
      affiliateAddress: affiliate.address,
    };
  }

  // Calculate total fee
  let totalFee = (winnings * BigInt(performanceFee.feeBps)) / BigInt(10000);

  // Apply minimum fee
  if (totalFee < performanceFee.minFeeUsdc) {
    totalFee = performanceFee.minFeeUsdc;
  }

  // Split between DOME and affiliate
  const affiliateAmount =
    (totalFee * BigInt(affiliate.splitBps)) / BigInt(10000);
  const domeAmount = totalFee - affiliateAmount;

  return {
    totalFee,
    domeAmount,
    affiliateAmount,
    domeAddress,
    affiliateAddress: affiliate.address,
  };
}

// ============ Payment Verification ============

// USDC Transfer event signature
const TRANSFER_EVENT_SIGNATURE =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Verify that a transaction contains the expected USDC payments
 *
 * @param provider - Ethers provider
 * @param txHash - Transaction hash to verify
 * @param expectedPayments - Expected payments to verify
 * @param usdcAddress - USDC contract address (defaults to Polygon USDC)
 * @returns Verification result with details
 *
 * @example
 * ```typescript
 * const result = await verifyPerformanceFeePayment(
 *   provider,
 *   '0x...',
 *   [
 *     { to: domeAddress, amount: parseUsdc(4) },
 *     { to: affiliateAddress, amount: parseUsdc(1) },
 *   ]
 * );
 * if (result.verified) {
 *   console.log('Payment verified!');
 * }
 * ```
 */
export async function verifyPerformanceFeePayment(
  provider: ethers.providers.Provider,
  txHash: string,
  expectedPayments: { to: string; amount: bigint }[],
  usdcAddress: string = USDC_POLYGON
): Promise<PaymentVerification> {
  const errors: string[] = [];

  // Get transaction receipt
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    return {
      verified: false,
      txHash,
      blockNumber: 0,
      timestamp: 0,
      transfers: [],
      errors: ['Transaction not found or not yet confirmed'],
    };
  }

  if (receipt.status !== 1) {
    return {
      verified: false,
      txHash,
      blockNumber: receipt.blockNumber,
      timestamp: 0,
      transfers: [],
      errors: ['Transaction failed'],
    };
  }

  // Get block for timestamp
  const block = await provider.getBlock(receipt.blockNumber);

  // Parse USDC Transfer events from logs
  const transfers: { to: string; amount: bigint }[] = [];

  for (const log of receipt.logs) {
    // Check if this is a USDC Transfer event
    if (
      log.address.toLowerCase() === usdcAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE &&
      log.topics.length >= 3
    ) {
      const to = ethers.utils.getAddress(`0x${log.topics[2].slice(26)}`);
      const amount = BigInt(log.data);

      transfers.push({ to, amount });
    }
  }

  // Verify expected payments are present
  for (const expected of expectedPayments) {
    const normalizedTo = ethers.utils.getAddress(expected.to);
    const found = transfers.find(
      t =>
        t.to.toLowerCase() === normalizedTo.toLowerCase() &&
        t.amount >= expected.amount
    );

    if (!found) {
      errors.push(
        `Missing payment: expected ${ethers.utils.formatUnits(expected.amount.toString(), 6)} USDC to ${normalizedTo}`
      );
    }
  }

  const result: PaymentVerification = {
    verified: errors.length === 0,
    txHash,
    blockNumber: receipt.blockNumber,
    timestamp: block.timestamp,
    transfers,
  };

  if (errors.length > 0) {
    result.errors = errors;
  }

  return result;
}

/**
 * Build USDC transfer transaction data
 *
 * @param to - Recipient address
 * @param amount - Amount in USDC (6 decimals)
 * @returns Transaction request object
 */
export function buildUsdcTransfer(
  to: string,
  amount: bigint,
  usdcAddress: string = USDC_POLYGON
): ethers.providers.TransactionRequest {
  const iface = new ethers.utils.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
  ]);

  return {
    to: usdcAddress,
    data: iface.encodeFunctionData('transfer', [to, amount]),
  };
}

/**
 * Build batch of USDC transfer transactions for performance fee payment
 *
 * @param feeSplit - Fee split from calculatePerformanceFee
 * @param usdcAddress - USDC contract address
 * @returns Array of transaction requests [domeTx, affiliateTx]
 */
export function buildPerformanceFeeTransactions(
  feeSplit: PerformanceFeeSplit,
  usdcAddress: string = USDC_POLYGON
): ethers.providers.TransactionRequest[] {
  const txs: ethers.providers.TransactionRequest[] = [];

  if (feeSplit.domeAmount > BigInt(0)) {
    txs.push(
      buildUsdcTransfer(feeSplit.domeAddress, feeSplit.domeAmount, usdcAddress)
    );
  }

  if (feeSplit.affiliateAmount > BigInt(0)) {
    txs.push(
      buildUsdcTransfer(
        feeSplit.affiliateAddress,
        feeSplit.affiliateAmount,
        usdcAddress
      )
    );
  }

  return txs;
}
