/**
 * Deterministic order ID generation for DomeFeeEscrow
 */

import { ethers } from 'ethers';
import type { OrderParams } from './types.js';

/**
 * Generate a unique deterministic order ID using keccak256 hash
 * @param params Order parameters
 * @returns bytes32 hex string
 */
export function generateOrderId(params: OrderParams): string {
  if (params.price < 0 || params.price > 1) {
    throw new Error(`Price ${params.price} out of range (must be 0-1)`);
  }

  if (!ethers.utils.isAddress(params.userAddress)) {
    throw new Error(`Address ${params.userAddress} is not valid`);
  }

  const encoded = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'address', 'string', 'string', 'uint256', 'uint256', 'uint256'],
    [
      params.chainId,
      ethers.utils.getAddress(params.userAddress),
      params.marketId,
      params.side,
      params.size.toString(),
      Math.round(params.price * 10000),
      params.timestamp,
    ]
  );

  return ethers.utils.keccak256(encoded);
}

/**
 * Check if an order ID was generated from specific parameters
 * @param orderId bytes32 hex string to verify
 * @param params Order parameters to verify against
 * @returns true if order ID matches
 */
export function verifyOrderId(orderId: string, params: OrderParams): boolean {
  try {
    const reconstructed = generateOrderId(params);
    return reconstructed.toLowerCase() === orderId.toLowerCase();
  } catch {
    return false;
  }
}
