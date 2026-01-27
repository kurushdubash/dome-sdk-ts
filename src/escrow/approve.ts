/**
 * USDC approval helpers for DomeFeeEscrow and Polymarket contracts
 */

import { ethers } from 'ethers';
import { ESCROW_CONTRACT_POLYGON, USDC_POLYGON } from './constants.js';

/** Polymarket CTF Exchange contract address */
export const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';

/** Polymarket Neg Risk CTF Exchange contract address */
export const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

/** Polymarket Neg Risk Adapter contract address */
export const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

/** All contracts that require USDC approval for trading */
export const CONTRACTS_TO_APPROVE = {
  'Fee Escrow': ESCROW_CONTRACT_POLYGON,
  'CTF Exchange': CTF_EXCHANGE,
  'Neg Risk CTF Exchange': NEG_RISK_CTF_EXCHANGE,
  'Neg Risk Adapter': NEG_RISK_ADAPTER,
} as const;

/** Contract allowance status */
export interface AllowanceStatus {
  name: string;
  address: string;
  allowance: bigint;
  approved: boolean;
}

/** Approval transaction result */
export interface ApprovalResult {
  alreadyApproved: string[];
  approved: string[];
  txHashes: Record<string, string>;
}

/**
 * Check USDC allowances for all required contracts
 * @param provider Ethers provider
 * @param walletAddress Wallet address to check
 * @param usdcAddress USDC contract address (defaults to Polygon)
 * @returns Array of allowance statuses
 */
export async function checkAllowances(
  provider: ethers.providers.Provider,
  walletAddress: string,
  usdcAddress: string = USDC_POLYGON
): Promise<AllowanceStatus[]> {
  const usdc = new ethers.Contract(
    usdcAddress,
    ['function allowance(address owner, address spender) view returns (uint256)'],
    provider
  );

  const results: AllowanceStatus[] = [];

  for (const [name, address] of Object.entries(CONTRACTS_TO_APPROVE)) {
    const allowance = await usdc.allowance(walletAddress, address);
    const allowanceBigInt = BigInt(allowance.toString());

    results.push({
      name,
      address,
      allowance: allowanceBigInt,
      approved: allowanceBigInt > 1_000_000_000_000n,
    });
  }

  return results;
}

/**
 * Check if wallet has all required approvals
 * @param provider Ethers provider
 * @param walletAddress Wallet address to check
 * @returns true if all contracts are approved
 */
export async function hasAllApprovals(
  provider: ethers.providers.Provider,
  walletAddress: string
): Promise<boolean> {
  const statuses = await checkAllowances(provider, walletAddress);
  return statuses.every(s => s.approved);
}

/**
 * Approve USDC for all required contracts using ethers.Wallet
 * @param wallet ethers.Wallet instance (must be connected to provider)
 * @param usdcAddress USDC contract address (defaults to Polygon)
 * @returns Approval result with transaction hashes
 */
export async function approveAllContracts(
  wallet: ethers.Wallet,
  usdcAddress: string = USDC_POLYGON
): Promise<ApprovalResult> {
  const provider = wallet.provider;
  if (!provider) {
    throw new Error('Wallet must be connected to a provider');
  }

  const statuses = await checkAllowances(provider, wallet.address, usdcAddress);

  const result: ApprovalResult = {
    alreadyApproved: [],
    approved: [],
    txHashes: {},
  };

  const usdc = new ethers.Contract(
    usdcAddress,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    wallet
  );

  for (const status of statuses) {
    if (status.approved) {
      result.alreadyApproved.push(status.name);
    } else {
      const tx = await usdc.approve(status.address, ethers.constants.MaxUint256);
      await tx.wait();

      result.approved.push(status.name);
      result.txHashes[status.name] = tx.hash;
    }
  }

  return result;
}

/** Generic signer interface for transaction signing */
export interface TransactionSigner {
  getAddress(): Promise<string>;
  sendTransaction(tx: {
    to: string;
    data: string;
    chainId?: number;
  }): Promise<{ hash: string }>;
}

/**
 * Approve USDC for all required contracts using any compatible signer (Privy, MetaMask, etc.)
 * @param signer Signer implementing TransactionSigner interface
 * @param provider Ethers provider for reading state
 * @param usdcAddress USDC contract address (defaults to Polygon)
 * @param chainId Chain ID (defaults to 137 for Polygon)
 * @returns Approval result with transaction hashes
 */
export async function approveWithSigner(
  signer: TransactionSigner,
  provider: ethers.providers.Provider,
  usdcAddress: string = USDC_POLYGON,
  chainId: number = 137
): Promise<ApprovalResult> {
  const walletAddress = await signer.getAddress();

  const statuses = await checkAllowances(provider, walletAddress, usdcAddress);

  const result: ApprovalResult = {
    alreadyApproved: [],
    approved: [],
    txHashes: {},
  };

  const iface = new ethers.utils.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  for (const status of statuses) {
    if (status.approved) {
      result.alreadyApproved.push(status.name);
    } else {
      const data = iface.encodeFunctionData('approve', [
        status.address,
        ethers.constants.MaxUint256,
      ]);

      const tx = await signer.sendTransaction({
        to: usdcAddress,
        data,
        chainId,
      });

      result.approved.push(status.name);
      result.txHashes[status.name] = tx.hash;
    }
  }

  return result;
}

/**
 * Build an approval transaction for use with Safe or other smart wallets
 * @param spenderAddress Contract address to approve
 * @param usdcAddress USDC contract address
 * @returns Transaction data
 */
export function buildApprovalTx(
  spenderAddress: string,
  usdcAddress: string = USDC_POLYGON
): { to: string; data: string; value: string } {
  const iface = new ethers.utils.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  return {
    to: usdcAddress,
    data: iface.encodeFunctionData('approve', [
      spenderAddress,
      ethers.constants.MaxUint256,
    ]),
    value: '0',
  };
}

/**
 * Build all approval transactions for required contracts
 * @param usdcAddress USDC contract address
 * @returns Array of transactions with contract names
 */
export function buildAllApprovalTxs(
  usdcAddress: string = USDC_POLYGON
): Array<{ name: string; tx: { to: string; data: string; value: string } }> {
  return Object.entries(CONTRACTS_TO_APPROVE).map(([name, address]) => ({
    name,
    tx: buildApprovalTx(address, usdcAddress),
  }));
}
