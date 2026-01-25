/**
 * USDC Approval for Dome Fee Escrow
 *
 * Provides functions to approve USDC spending for the escrow contract
 * and other required Polymarket contracts.
 */
import { ethers } from 'ethers';
import type { PrivyClient } from '@privy-io/server-auth';
import {
  USDC_POLYGON,
  ESCROW_CONTRACT_POLYGON,
  ESCROW_CONTRACT_V1_POLYGON,
  ESCROW_CONTRACT_V2_POLYGON,
} from './utils.js';

// Polygon Mainnet RPC endpoints (free tiers)
const POLYGON_RPCS = [
  'https://polygon.llamarpc.com',
  'https://rpc.ankr.com/polygon',
  'https://polygon-mainnet.public.blastapi.io',
  'https://1rpc.io/matic',
  'https://polygon.drpc.org',
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon-rpc.com', // Often rate-limited, keep last
];

/**
 * Test if an RPC endpoint is responsive
 */
async function testRpc(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const provider = new ethers.providers.JsonRpcProvider(url);
    await Promise.race([
      provider.getBlockNumber(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Provider with automatic retry on rate limiting
 */
class RetryProvider extends ethers.providers.JsonRpcProvider {
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    url: string,
    options: { maxRetries?: number; retryDelay?: number } = {}
  ) {
    super(url);
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 2000;
  }

  async send(method: string, params: any[]): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await super.send(method, params);
      } catch (error: any) {
        lastError = error;

        const isRetryable =
          error.code === -32090 ||
          error.code === 'NETWORK_ERROR' ||
          error.message?.includes('rate limit') ||
          error.message?.includes('Too many requests');

        if (isRetryable && attempt < this.maxRetries) {
          console.log(
            `[RPC] Retry ${attempt + 1}/${this.maxRetries} after ${this.retryDelay}ms...`
          );
          await new Promise(r => setTimeout(r, this.retryDelay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }
}

/**
 * Get a provider with retry logic, testing multiple RPCs
 */
async function getRetryProvider(customRpc?: string): Promise<RetryProvider> {
  // Check custom RPC first
  if (customRpc) {
    if (await testRpc(customRpc, 2000)) {
      return new RetryProvider(customRpc, { maxRetries: 3, retryDelay: 2000 });
    }
    console.log(`[RPC] Custom RPC not responding, trying fallbacks...`);
  }

  // Find a working RPC
  for (const rpc of POLYGON_RPCS) {
    if (await testRpc(rpc, 2000)) {
      console.log(`[RPC] Using ${rpc}`);
      return new RetryProvider(rpc, { maxRetries: 3, retryDelay: 2000 });
    }
  }

  // Fallback to first
  return new RetryProvider(POLYGON_RPCS[0], {
    maxRetries: 3,
    retryDelay: 2000,
  });
}

// Polymarket contracts that need USDC approval
export const POLYMARKET_CONTRACTS = {
  'CTF Exchange': '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  'Neg Risk CTF Exchange': '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  'Neg Risk Adapter': '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
} as const;

// All contracts that need approval (V2 escrow + polymarket)
export const ALL_CONTRACTS_TO_APPROVE = {
  'Fee Escrow (V2)': ESCROW_CONTRACT_V2_POLYGON,
  ...POLYMARKET_CONTRACTS,
} as const;

// Export escrow addresses for external use
export {
  ESCROW_CONTRACT_POLYGON,
  ESCROW_CONTRACT_V1_POLYGON,
  ESCROW_CONTRACT_V2_POLYGON,
};

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
  const usdcAddress = options.usdcAddress || USDC_POLYGON;

  // Use retry provider with fallback RPCs
  const provider = await getRetryProvider(options.rpcUrl);
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
 * import { approveEscrow } from '@dome-api/sdk/escrow';
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

  // Use retry provider with fallback RPCs
  const provider = await getRetryProvider(rpcUrl);
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

/**
 * Options for approving escrow with EOA signer
 */
export interface ApproveWithSignerOptions {
  /** Ethers Signer (Wallet) */
  signer: ethers.Signer;
  /** USDC contract address. Default: USDC.e on Polygon */
  usdcAddress?: string;
  /** Escrow contract address. Default: V2 DomeFeeEscrow */
  escrowAddress?: string;
  /** Also approve Polymarket contracts */
  includePolymarket?: boolean;
  /** Gas settings */
  gasSettings?: {
    maxFeePerGas?: ethers.BigNumber;
    maxPriorityFeePerGas?: ethers.BigNumber;
  };
}

/**
 * Result of approval with signer
 */
export interface ApproveWithSignerResult {
  /** Contracts that were approved */
  approved: string[];
  /** Contracts that already had sufficient allowance */
  skipped: string[];
  /** Transaction hashes */
  txHashes: Record<string, string>;
}

/**
 * Approve USDC spending for escrow contract using an EOA signer
 *
 * This is a simpler alternative to approveEscrow that works with
 * a standard ethers Signer/Wallet instead of Privy.
 *
 * @example
 * ```typescript
 * import { ethers } from 'ethers';
 * import { approveEscrowWithSigner } from '@dome-api/sdk/escrow';
 *
 * const wallet = new ethers.Wallet(privateKey, provider);
 * const result = await approveEscrowWithSigner({
 *   signer: wallet,
 *   includePolymarket: true,
 * });
 *
 * console.log('Approved:', result.approved);
 * ```
 */
export async function approveEscrowWithSigner(
  options: ApproveWithSignerOptions
): Promise<ApproveWithSignerResult> {
  const {
    signer,
    usdcAddress = USDC_POLYGON,
    escrowAddress = ESCROW_CONTRACT_V2_POLYGON,
    includePolymarket = false,
    gasSettings,
  } = options;

  const walletAddress = await signer.getAddress();

  // Build list of contracts to approve
  const contractsToApprove: Record<string, string> = {
    'Fee Escrow (V2)': escrowAddress,
  };

  if (includePolymarket) {
    Object.assign(contractsToApprove, POLYMARKET_CONTRACTS);
  }

  // Check current allowances using retry provider
  const allowances = await checkAllowances(walletAddress, contractsToApprove, {
    usdcAddress,
  });

  const usdc = new ethers.Contract(
    usdcAddress,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    signer
  );

  const approved: string[] = [];
  const skipped: string[] = [];
  const txHashes: Record<string, string> = {};

  // Get gas settings using retry provider to avoid rate limits
  let txOptions: Record<string, any> = {};
  if (gasSettings) {
    txOptions = { ...gasSettings };
  } else {
    // Use retry provider for fee data
    const retryProvider = await getRetryProvider();
    const feeData = await retryProvider.getFeeData();
    if (feeData.maxFeePerGas) {
      txOptions.maxFeePerGas = feeData.maxFeePerGas;
      txOptions.maxPriorityFeePerGas = ethers.utils.parseUnits('35', 'gwei');
    }
  }

  // Get retry provider for waiting on confirmations
  const retryProvider = await getRetryProvider();

  // Approve each contract
  for (const [name, address] of Object.entries(contractsToApprove)) {
    if (allowances[name]?.hasAllowance) {
      skipped.push(name);
      continue;
    }

    console.log(`  Approving ${name} (${address})...`);

    const tx = await usdc.approve(
      address,
      ethers.constants.MaxUint256,
      txOptions
    );

    txHashes[name] = tx.hash;
    console.log(`    TX: ${tx.hash}`);

    // Wait for confirmation using retry provider
    const receipt = await retryProvider.waitForTransaction(tx.hash, 1, 60000);
    if (receipt.status !== 1) {
      throw new Error(`Approval failed for ${name}: ${tx.hash}`);
    }

    console.log(`    Confirmed (block ${receipt.blockNumber})`);
    approved.push(name);
  }

  return { approved, skipped, txHashes };
}

/**
 * Check and approve USDC for escrow if needed
 *
 * Convenience function that checks allowance and approves if needed.
 * Returns true if approval was already sufficient or was successfully granted.
 * Uses retry logic to handle rate-limited RPCs.
 *
 * @example
 * ```typescript
 * const hasApproval = await ensureEscrowApproval({
 *   signer: wallet,
 *   minAmount: parseUsdc('10'), // Ensure at least $10 allowance
 * });
 * ```
 */
export async function ensureEscrowApproval(options: {
  signer: ethers.Signer;
  escrowAddress?: string;
  usdcAddress?: string;
  minAmount?: bigint;
  /** Optional RPC URL for allowance check (uses retry provider with fallbacks) */
  rpcUrl?: string;
}): Promise<{ approved: boolean; txHash?: string }> {
  const {
    signer,
    escrowAddress = ESCROW_CONTRACT_V2_POLYGON,
    usdcAddress = USDC_POLYGON,
    minAmount = BigInt(1e12), // Default: check for "unlimited" approval
    rpcUrl,
  } = options;

  const walletAddress = await signer.getAddress();

  // Use retry provider for allowance check to avoid rate limiting
  const retryProvider = await getRetryProvider(rpcUrl);
  const usdcReadOnly = new ethers.Contract(
    usdcAddress,
    [
      'function allowance(address owner, address spender) view returns (uint256)',
    ],
    retryProvider
  );

  // Check current allowance using retry provider
  const currentAllowance = await usdcReadOnly.allowance(
    walletAddress,
    escrowAddress
  );

  if (BigInt(currentAllowance.toString()) >= minAmount) {
    return { approved: true };
  }

  // Need to approve - use the signer for write operation
  console.log(`  Current allowance insufficient, approving escrow...`);

  const usdc = new ethers.Contract(
    usdcAddress,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    signer
  );

  // Get fee data using retry provider to avoid rate limits
  const feeData = await retryProvider.getFeeData();
  const tx = await usdc.approve(escrowAddress, ethers.constants.MaxUint256, {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: ethers.utils.parseUnits('35', 'gwei'),
  });

  console.log(`    TX: ${tx.hash}`);

  // Wait for confirmation using retry provider
  const receipt = await retryProvider.waitForTransaction(tx.hash, 1, 60000);

  if (receipt.status !== 1) {
    throw new Error(`Approval failed: ${tx.hash}`);
  }

  console.log(`    Confirmed`);
  return { approved: true, txHash: tx.hash };
}
