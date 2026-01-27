/**
 * Helper functions for fee calculations and USDC formatting
 */

import { ethers } from 'ethers';
import {
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
  USDC_DECIMALS,
} from './constants.js';
import type { FeeCalculation } from './types.js';

/**
 * Convert decimal string or number to USDC base units
 * @param amount Human readable amount
 * @returns BigInt with 6 decimals
 */
export function parseUsdc(amount: string | number): bigint {
  return BigInt(ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS).toString());
}

/**
 * Convert USDC base units to decimal string representation
 * @param amount BigInt with 6 decimals
 * @returns Human readable string
 */
export function formatUsdc(amount: bigint): string {
  return ethers.utils.formatUnits(amount.toString(), USDC_DECIMALS);
}

/**
 * Format basis points to percentage string
 * @param bps Basis points
 * @returns Percentage string (e.g., "0.1%")
 */
export function formatBps(bps: bigint | number): string {
  return `${Number(bps) / 100}%`;
}

/**
 * Compute fee breakdown for an order using contract logic
 * @param orderSize Order size in USDC (6 decimals)
 * @param clientFeeBps Client fee in basis points
 * @param domeFeeBps Dome fee in basis points
 * @param minDomeFee Minimum dome fee floor
 * @returns Fee calculation
 */
export function calculateFees(
  orderSize: bigint,
  clientFeeBps: bigint = 0n,
  domeFeeBps: bigint = DEFAULT_DOME_FEE_BPS,
  minDomeFee: bigint = DEFAULT_MIN_DOME_FEE
): FeeCalculation {
  let domeFee = (orderSize * domeFeeBps) / 10000n;

  if (domeFee < minDomeFee) {
    domeFee = minDomeFee;
  }

  const clientFee = (orderSize * clientFeeBps) / 10000n;

  return {
    domeFee,
    clientFee,
    totalFee: domeFee + clientFee,
  };
}

/**
 * Check if a string is a valid Ethereum address
 * @param address Address to validate
 * @returns true if valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

/**
 * Convert address to EIP-55 checksum format
 * @param address Address to normalize
 * @returns Checksum address
 */
export function normalizeAddress(address: string): string {
  return ethers.utils.getAddress(address);
}

/**
 * Check if a string matches bytes32 hex format
 * @param orderId Order ID to validate
 * @returns true if valid
 */
export function isValidOrderId(orderId: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(orderId);
}
