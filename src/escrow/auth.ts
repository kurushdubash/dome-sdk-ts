/**
 * Fee authorization signing with EIP-712 typed data
 */

import { ethers } from 'ethers';
import { DOMAIN_NAME, DOMAIN_VERSION } from './constants.js';
import type { FeeAuth, SignedFeeAuth } from './types.js';

/** EIP-712 type definition for FeeAuth struct */
export const FEE_AUTH_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  FeeAuth: [
    { name: 'orderId', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/**
 * Build EIP-712 domain separator for contract signatures
 * @param escrowAddress Contract address
 * @param chainId Chain ID
 * @returns EIP-712 domain
 */
export function createEIP712Domain(
  escrowAddress: string,
  chainId: number
): ethers.TypedDataDomain {
  if (!ethers.utils.isAddress(escrowAddress)) {
    throw new Error(`Invalid escrow address: ${escrowAddress}`);
  }

  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract: escrowAddress,
  };
}

/**
 * Construct a fee authorization for EIP-712 signing
 * @param orderId Unique order ID (bytes32)
 * @param payer Address that will pay the fee
 * @param amount Total fee amount in USDC (6 decimals)
 * @param deadlineSeconds Seconds until expiration (default: 1 hour)
 * @returns FeeAuth object ready for signing
 */
export function createFeeAuth(
  orderId: string,
  payer: string,
  amount: bigint,
  deadlineSeconds: number = 3600
): FeeAuth {
  if (!ethers.utils.isAddress(payer)) {
    throw new Error(`Invalid payer address: ${payer}`);
  }

  if (deadlineSeconds < 60) {
    throw new Error(`Minimum deadline is 60s, got ${deadlineSeconds}s`);
  }

  if (deadlineSeconds > 259200) {
    throw new Error(`Maximum deadline is 259200s (3d), got ${deadlineSeconds}s`);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  return {
    orderId,
    payer: ethers.utils.getAddress(payer),
    amount,
    deadline,
  };
}

/**
 * Generate EIP-712 signature for fee authorization
 * @param wallet ethers.Wallet instance
 * @param escrowAddress DomeFeeEscrow contract address
 * @param feeAuth Fee authorization to sign
 * @param chainId Chain ID (default: 137 for Polygon)
 * @returns Signed fee authorization
 */
export async function signFeeAuth(
  wallet: ethers.Wallet,
  escrowAddress: string,
  feeAuth: FeeAuth,
  chainId: number = 137
): Promise<SignedFeeAuth> {
  const domain = createEIP712Domain(escrowAddress, chainId);

  const message = {
    orderId: feeAuth.orderId,
    payer: feeAuth.payer,
    amount: feeAuth.amount,
    deadline: feeAuth.deadline,
  };

  const signature = await wallet._signTypedData(domain, FEE_AUTH_TYPES, message);

  return {
    ...feeAuth,
    signature,
  };
}

/** Generic signer interface compatible with Privy, MetaMask, etc. */
export interface TypedDataSigner {
  getAddress(): Promise<string>;
  signTypedData(params: {
    domain: ethers.TypedDataDomain;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
}

/**
 * Generate EIP-712 signature using a generic signer interface
 * @param signer Signer implementing TypedDataSigner interface
 * @param escrowAddress DomeFeeEscrow contract address
 * @param feeAuth Fee authorization to sign
 * @param chainId Chain ID (default: 137 for Polygon)
 * @returns Signed fee authorization
 */
export async function signFeeAuthWithSigner(
  signer: TypedDataSigner,
  escrowAddress: string,
  feeAuth: FeeAuth,
  chainId: number = 137
): Promise<SignedFeeAuth> {
  const domain = createEIP712Domain(escrowAddress, chainId);

  const message = {
    orderId: feeAuth.orderId,
    payer: feeAuth.payer,
    amount: feeAuth.amount.toString(),
    deadline: feeAuth.deadline.toString(),
  };

  const signature = await signer.signTypedData({
    domain,
    types: FEE_AUTH_TYPES,
    primaryType: 'FeeAuth',
    message,
  });

  return {
    ...feeAuth,
    signature,
  };
}

/**
 * Validate fee authorization signature off-chain (EOA wallets only)
 * @param signedAuth Signed fee authorization
 * @param escrowAddress DomeFeeEscrow contract address
 * @param chainId Chain ID
 * @param expectedSigner Expected signer address
 * @returns true if signature is valid
 */
export function verifyFeeAuthSignature(
  signedAuth: SignedFeeAuth,
  escrowAddress: string,
  chainId: number,
  expectedSigner: string
): boolean {
  const domain = createEIP712Domain(escrowAddress, chainId);

  const message = {
    orderId: signedAuth.orderId,
    payer: signedAuth.payer,
    amount: signedAuth.amount,
    deadline: signedAuth.deadline,
  };

  try {
    const recovered = ethers.utils.verifyTypedData(
      domain,
      FEE_AUTH_TYPES,
      message,
      signedAuth.signature
    );
    return recovered.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
}

/** EIP-712 type definition for EIP-2612 Permit (gasless USDC approval) */
export const PERMIT_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/**
 * Build EIP-712 domain for USDC permit signatures
 * @param usdcAddress USDC contract address
 * @param chainId Chain ID
 * @returns EIP-712 domain for USDC
 */
export function createPermitDomain(
  usdcAddress: string,
  chainId: number
): ethers.TypedDataDomain {
  return {
    name: 'USD Coin (PoS)',
    version: '1',
    verifyingContract: usdcAddress,
    salt: ethers.utils.hexZeroPad(ethers.BigNumber.from(chainId).toHexString(), 32),
  };
}

/** EIP-2612 permit message */
export interface PermitMessage {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}

/** Signed permit with v, r, s components */
export interface SignedPermit extends PermitMessage {
  v: number;
  r: string;
  s: string;
  signature: string;
}

/**
 * Create EIP-2612 permit signature for gasless USDC approval
 * @param wallet ethers.Wallet instance
 * @param usdcAddress USDC contract address
 * @param spender Address to approve
 * @param value Amount to approve
 * @param nonce Permit nonce from USDC.nonces(owner)
 * @param deadlineSeconds Seconds until expiration
 * @param chainId Chain ID
 * @returns Signed permit
 */
export async function signPermit(
  wallet: ethers.Wallet,
  usdcAddress: string,
  spender: string,
  value: bigint,
  nonce: bigint,
  deadlineSeconds: number = 3600,
  chainId: number = 137
): Promise<SignedPermit> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const domain = createPermitDomain(usdcAddress, chainId);

  const message = {
    owner: wallet.address,
    spender,
    value,
    nonce,
    deadline,
  };

  const signature = await wallet._signTypedData(domain, PERMIT_TYPES, message);

  const sig = ethers.utils.splitSignature(signature);

  return {
    owner: wallet.address,
    spender,
    value,
    nonce,
    deadline,
    v: sig.v,
    r: sig.r,
    s: sig.s,
    signature,
  };
}

/**
 * Create EIP-2612 permit signature using a generic signer
 * @param signer Signer implementing TypedDataSigner
 * @param usdcAddress USDC contract address
 * @param spender Address to approve
 * @param value Amount to approve
 * @param nonce Permit nonce
 * @param deadlineSeconds Seconds until expiration
 * @param chainId Chain ID
 * @returns Signed permit
 */
export async function signPermitWithSigner(
  signer: TypedDataSigner,
  usdcAddress: string,
  spender: string,
  value: bigint,
  nonce: bigint,
  deadlineSeconds: number = 3600,
  chainId: number = 137
): Promise<SignedPermit> {
  const owner = await signer.getAddress();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const domain = createPermitDomain(usdcAddress, chainId);

  const message = {
    owner,
    spender,
    value: value.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };

  const signature = await signer.signTypedData({
    domain,
    types: PERMIT_TYPES,
    primaryType: 'Permit',
    message,
  });

  const sig = ethers.utils.splitSignature(signature);

  return {
    owner,
    spender,
    value,
    nonce,
    deadline,
    v: sig.v,
    r: sig.r,
    s: sig.s,
    signature,
  };
}

/**
 * Query current permit nonce from USDC contract
 * @param provider Ethers provider
 * @param usdcAddress USDC contract address
 * @param owner Owner address
 * @returns Current nonce
 */
export async function getPermitNonce(
  provider: ethers.providers.Provider,
  usdcAddress: string,
  owner: string
): Promise<bigint> {
  const usdc = new ethers.Contract(
    usdcAddress,
    ['function nonces(address owner) view returns (uint256)'],
    provider
  );
  const nonce = await usdc.nonces(owner);
  return BigInt(nonce.toString());
}
