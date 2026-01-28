/**
 * Fee Authorization Signing for Dome Fee Escrow
 *
 * Provides EIP-712 signing functions that work with various wallet types:
 * - ethers.Wallet (direct signing)
 * - RouterSigner (Privy, MetaMask, etc.)
 */

import { ethers, Wallet } from 'ethers';
import type { FeeAuthorization, SignedFeeAuthorization } from './types.js';

// EIP-712 types for fee authorization
export const FEE_AUTHORIZATION_TYPES = {
  FeeAuthorization: [
    { name: 'orderId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

// Deadline bounds
const MIN_DEADLINE_SECONDS = 60; // 1 minute
const MAX_DEADLINE_SECONDS = 86400; // 24 hours

/**
 * Create EIP-712 domain for the escrow contract
 */
export function createEIP712Domain(
  escrowAddress: string,
  chainId: number
): ethers.TypedDataDomain {
  if (!ethers.utils.isAddress(escrowAddress)) {
    throw new Error(`Invalid escrow address: ${escrowAddress}`);
  }

  return {
    name: 'DomeFeeEscrow',
    version: '1',
    chainId,
    verifyingContract: escrowAddress,
  };
}

/**
 * Create a fee authorization object
 */
export function createFeeAuthorization(
  orderId: string,
  payer: string,
  feeAmount: bigint,
  deadlineSeconds: number = 3600
): FeeAuthorization {
  if (!ethers.utils.isAddress(payer)) {
    throw new Error(`Invalid payer address: ${payer}`);
  }

  if (deadlineSeconds < MIN_DEADLINE_SECONDS) {
    throw new Error(
      `Deadline too short: ${deadlineSeconds}s. Minimum: ${MIN_DEADLINE_SECONDS}s`
    );
  }
  if (deadlineSeconds > MAX_DEADLINE_SECONDS) {
    throw new Error(
      `Deadline too long: ${deadlineSeconds}s. Maximum: ${MAX_DEADLINE_SECONDS}s`
    );
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  return {
    orderId,
    payer: ethers.utils.getAddress(payer),
    feeAmount,
    deadline,
  };
}

/**
 * Sign a fee authorization with EIP-712 using ethers.Wallet
 *
 * Use this when you have direct access to an ethers.Wallet instance.
 */
export async function signFeeAuthorization(
  wallet: Wallet,
  escrowAddress: string,
  feeAuth: FeeAuthorization,
  expectedChainId: number = 137
): Promise<SignedFeeAuthorization> {
  const provider = wallet.provider;
  if (!provider) {
    throw new Error('Wallet must be connected to a provider');
  }

  // Verify chain ID before signing
  const network = await provider.getNetwork();
  const actualChainId = network.chainId;
  if (actualChainId !== expectedChainId) {
    throw new Error(
      `Chain ID mismatch: expected ${expectedChainId}, got ${actualChainId}. ` +
        'Refusing to sign for wrong network.'
    );
  }

  const domain = createEIP712Domain(escrowAddress, actualChainId);

  const message = {
    orderId: feeAuth.orderId,
    payer: feeAuth.payer,
    feeAmount: feeAuth.feeAmount,
    deadline: feeAuth.deadline,
  };

  const signature = await wallet._signTypedData(
    domain,
    FEE_AUTHORIZATION_TYPES,
    message
  );

  return {
    ...feeAuth,
    signature,
  };
}

/**
 * Generic signer interface compatible with RouterSigner
 */
export interface TypedDataSigner {
  getAddress(): Promise<string>;
  signTypedData(params: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  }): Promise<string>;
}

/**
 * Sign a fee authorization with EIP-712 using any compatible signer
 *
 * Use this when working with RouterSigner (Privy, MetaMask, etc.)
 * or any wallet that implements the TypedDataSigner interface.
 */
export async function signFeeAuthorizationWithSigner(
  signer: TypedDataSigner,
  escrowAddress: string,
  feeAuth: FeeAuthorization,
  chainId: number = 137
): Promise<SignedFeeAuthorization> {
  const domain = createEIP712Domain(escrowAddress, chainId);

  const message = {
    orderId: feeAuth.orderId,
    payer: feeAuth.payer,
    feeAmount: feeAuth.feeAmount.toString(), // Convert to string for signing
    deadline: feeAuth.deadline.toString(), // Convert to string for signing
  };

  const signature = await signer.signTypedData({
    domain,
    types: FEE_AUTHORIZATION_TYPES,
    primaryType: 'FeeAuthorization',
    message,
  });

  return {
    ...feeAuth,
    signature,
  };
}

/**
 * Verify a fee authorization signature locally (for EOA signatures)
 *
 * Note: This only works for EOA signatures. For SAFE signatures,
 * verification must happen on-chain via EIP-1271.
 */
export function verifyFeeAuthorizationSignature(
  signedAuth: SignedFeeAuthorization,
  escrowAddress: string,
  chainId: number,
  expectedSigner: string
): boolean {
  const domain = createEIP712Domain(escrowAddress, chainId);

  const message = {
    orderId: signedAuth.orderId,
    payer: signedAuth.payer,
    feeAmount: signedAuth.feeAmount,
    deadline: signedAuth.deadline,
  };

  const recovered = ethers.utils.verifyTypedData(
    domain,
    FEE_AUTHORIZATION_TYPES,
    message,
    signedAuth.signature
  );

  return recovered.toLowerCase() === expectedSigner.toLowerCase();
}
