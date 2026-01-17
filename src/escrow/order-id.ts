/**
 * Order ID Generation for Dome Fee Escrow
 *
 * Generates unique, deterministic order IDs that provide:
 * - Cross-chain replay protection (via chainId)
 * - Cross-user collision prevention (via userAddress)
 * - Same-user collision prevention (via millisecond timestamp)
 */

import { ethers } from 'ethers';
import type { OrderParams } from './types';

/**
 * Generate a unique orderId using deterministic hash
 *
 * @param params Order parameters (timestamp should be Date.now() in milliseconds)
 * @throws Error if price is outside valid range [0, 1]
 * @throws Error if userAddress is invalid
 */
export function generateOrderId(params: OrderParams): string {
  // Validate price range for binary markets
  if (params.price < 0 || params.price > 1) {
    throw new Error(`Invalid price: ${params.price}. Must be between 0 and 1`);
  }

  // Validate user address
  if (!ethers.utils.isAddress(params.userAddress)) {
    throw new Error(`Invalid userAddress: ${params.userAddress}`);
  }

  const encoded = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'address', 'string', 'string', 'uint256', 'uint256', 'uint256'],
    [
      params.chainId, // Chain ID first for cross-chain replay protection
      ethers.utils.getAddress(params.userAddress), // Normalize to checksum
      params.marketId,
      params.side,
      params.size.toString(),
      Math.round(params.price * 10000), // Price as basis points
      params.timestamp, // Milliseconds
    ]
  );

  return ethers.utils.keccak256(encoded);
}

/**
 * Verify an orderId matches the given parameters
 */
export function verifyOrderId(orderId: string, params: OrderParams): boolean {
  try {
    const reconstructed = generateOrderId(params);
    return reconstructed.toLowerCase() === orderId.toLowerCase();
  } catch {
    return false;
  }
}
