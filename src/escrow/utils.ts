/**
 * Utility functions for Dome Fee Escrow
 */

import { ethers } from 'ethers';

// USDC on Polygon
export const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// V1 Escrow Contract on Polygon (deprecated)
export const ESCROW_CONTRACT_V1_POLYGON =
  '0x989876083eD929BE583b8138e40D469ea3E53a37';

// V2 DomeFeeEscrow Contract on Polygon (current)
export const ESCROW_CONTRACT_V2_POLYGON =
  '0x93519731c9d45738CD999F8b8E86936cc2a33870';

// Default Escrow Contract on Polygon (V2)
export const ESCROW_CONTRACT_POLYGON = ESCROW_CONTRACT_V2_POLYGON;

/**
 * Format USDC amount (6 decimals) to human readable
 */
export function formatUsdc(amount: bigint): string {
  return ethers.utils.formatUnits(amount.toString(), 6);
}

/**
 * Parse human readable amount to USDC (6 decimals)
 */
export function parseUsdc(amount: string | number): bigint {
  return BigInt(ethers.utils.parseUnits(amount.toString(), 6).toString());
}

/**
 * Format basis points to percentage string
 */
export function formatBps(bps: bigint | number): string {
  return `${Number(bps) / 100}%`;
}

/**
 * Calculate fee amount from order size and basis points
 */
export function calculateFee(orderSize: bigint, feeBps: bigint): bigint {
  return (orderSize * feeBps) / BigInt(10000);
}
