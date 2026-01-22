/**
 * USDC Approval for Dome Fee Escrow
 *
 * Provides functions to approve USDC spending for the escrow contract
 * and other required Polymarket contracts.
 */
import { ethers } from 'ethers';
import type { PrivyClient } from '@privy-io/server-auth';
import { USDC_POLYGON, ESCROW_CONTRACT_POLYGON } from './utils.js';

// Polymarket contracts that need USDC approval
export const POLYMARKET_CONTRACTS = {
  'CTF Exchange': '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  'Neg Risk CTF Exchange': '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  'Neg Risk Adapter': '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
} as const;

// All contracts that need approval (escrow + polymarket)
export const ALL_CONTRACTS_TO_APPROVE = {
  'Fee Escrow': ESCROW_CONTRACT_POLYGON,
  ...POLYMARKET_CONTRACTS,
} as const;

/**
 * Options for approving escrow
 */
export interface ApproveEscrowOptions {
  /** Privy client instance (must be initialized with auth key if wallet has owner) */
  privyClient: PrivyClient;
  /** Privy wallet ID */
  walletId: string;
  /** Wallet address */
  walletAddress: string;
  /** RPC URL for checking allowances. Default: https://polygon-rpc.com */
  rpcUrl?: string;
  /** Chain ID. Default: 137 (Polygon) */
  chainId?: number;
  /** USDC contract address. Default: USDC.e on Polygon */
  usdcAddress?: string;
  /** Only approve escrow contract, not Polymarket contracts */
  escrowOnly?: boolean;
  /** Custom contracts to approve (overrides defaults) */
  contracts?: Record<string, string>;
}

/**
 * Result of approval operation
 */
export interface ApproveEscrowResult {
  /** Contracts that were approved in this call */
  approved: string[];
  /** Contracts that already had sufficient allowance */
  alreadyApproved: string[];
  /** Transaction hashes for each approval (contract name -> tx hash) */
  txHashes: Record<string, string>;
}

/**
 * Check current USDC allowances for contracts
 */
export async function checkAllowances(
  walletAddress: string,
  contracts: Record<string, string>,
  options: {
    rpcUrl?: string;
    usdcAddress?: string;
  } = {}
): Promise<Record<string, { hasAllowance: boolean; allowance: bigint }>> {
  const rpcUrl = options.rpcUrl || 'https://polygon-rpc.com';
  const usdcAddress = options.usdcAddress || USDC_POLYGON;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const usdc = new ethers.Contract(
    usdcAddress,
    ['function allowance(address,address) view returns (uint256)'],
    provider
  );

  const results: Record<string, { hasAllowance: boolean; allowance: bigint }> =
    {};

  for (const [name, address] of Object.entries(contracts)) {
    const allowance = await usdc.allowance(walletAddress, address);
    const allowanceBigInt = BigInt(allowance.toString());
    // Consider "has allowance" if > 1 trillion (effectively unlimited)
    const hasAllowance = allowanceBigInt > BigInt(1e12);
    results[name] = { hasAllowance, allowance: allowanceBigInt };
  }

  return results;
}

/**
 * Approve USDC spending for Dome Fee Escrow and Polymarket contracts
 *
 * This function checks current allowances and only sends approval transactions
 * for contracts that need it.
 *
 * @example
 * ```typescript
 * import { PrivyClient } from '@privy-io/server-auth';
 * import { approveEscrow } from '@anthropic/dome-sdk/escrow';
 *
 * const privy = new PrivyClient(appId, appSecret, {
 *   walletApi: { authorizationPrivateKey: authKey }
 * });
 *
 * const result = await approveEscrow({
 *   privyClient: privy,
 *   walletId: 'wallet-id',
 *   walletAddress: '0x...',
 * });
 *
 * console.log('Approved:', result.approved);
 * console.log('Already approved:', result.alreadyApproved);
 * ```
 */
export async function approveEscrow(
  options: ApproveEscrowOptions
): Promise<ApproveEscrowResult> {
  const {
    privyClient,
    walletId,
    walletAddress,
    rpcUrl = 'https://polygon-rpc.com',
    chainId = 137,
    usdcAddress = USDC_POLYGON,
    escrowOnly = false,
    contracts: customContracts,
  } = options;

  // Determine which contracts to approve
  const contractsToApprove = customContracts
    ? customContracts
    : escrowOnly
      ? { 'Fee Escrow': ESCROW_CONTRACT_POLYGON }
      : ALL_CONTRACTS_TO_APPROVE;

  // Check current allowances
  const allowances = await checkAllowances(walletAddress, contractsToApprove, {
    rpcUrl,
    usdcAddress,
  });

  const needsApproval: { name: string; address: string }[] = [];
  const alreadyApproved: string[] = [];

  for (const [name, address] of Object.entries(contractsToApprove)) {
    if (allowances[name].hasAllowance) {
      alreadyApproved.push(name);
    } else {
      needsApproval.push({ name, address });
    }
  }

  // If nothing needs approval, return early
  if (needsApproval.length === 0) {
    return {
      approved: [],
      alreadyApproved,
      txHashes: {},
    };
  }

  // Encode approve function call
  const iface = new ethers.utils.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const approved: string[] = [];
  const txHashes: Record<string, string> = {};

  // Send approval transactions
  for (const { name, address } of needsApproval) {
    const data = iface.encodeFunctionData('approve', [
      address,
      ethers.constants.MaxUint256,
    ]);

    const result = await privyClient.walletApi.ethereum.sendTransaction({
      walletId,
      caip2: `eip155:${chainId}`,
      transaction: {
        to: usdcAddress as `0x${string}`,
        data: data as `0x${string}`,
        chainId,
      },
    });

    txHashes[name] = result.hash;

    // Wait for confirmation
    const receipt = await provider.waitForTransaction(result.hash, 1, 60000);
    if (receipt.status !== 1) {
      throw new Error(
        `Approval transaction failed for ${name}: ${result.hash}`
      );
    }

    approved.push(name);
  }

  return {
    approved,
    alreadyApproved,
    txHashes,
  };
}

/**
 * Check if wallet has approved all required contracts
 *
 * @returns true if all contracts have sufficient allowance
 */
export async function hasRequiredApprovals(
  walletAddress: string,
  options: {
    rpcUrl?: string;
    usdcAddress?: string;
    escrowOnly?: boolean;
  } = {}
): Promise<boolean> {
  const contracts = options.escrowOnly
    ? { 'Fee Escrow': ESCROW_CONTRACT_POLYGON }
    : ALL_CONTRACTS_TO_APPROVE;

  const allowances = await checkAllowances(walletAddress, contracts, options);

  return Object.values(allowances).every(a => a.hasAllowance);
}
