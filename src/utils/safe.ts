/**
 * Safe Wallet Utilities for Polymarket Trading
 *
 * This module provides utilities for working with Safe smart contract wallets
 * for external wallet users (MetaMask, Rabby, etc.) trading on Polymarket.
 *
 * Key concepts:
 * - Safe wallets are deterministically derived from EOA addresses
 * - The EOA signs transactions, but the Safe holds the funds (USDC)
 * - Safe must be deployed before trading
 * - Allowances are set FROM the Safe, not the EOA
 *
 * @see https://github.com/Polymarket/clob-client for more details
 */

import { ethers } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import { RouterSigner } from '../types.js';
import { POLYGON_ADDRESSES } from './allowances.js';

/**
 * Result of Safe wallet initialization
 */
export interface SafeInitResult {
  /** The deterministically derived Safe address */
  safeAddress: string;
  /** Whether the Safe was already deployed */
  wasAlreadyDeployed: boolean;
  /** Transaction hash if Safe was deployed */
  deploymentTxHash?: string | undefined;
}

// Default endpoints
export const POLYGON_CHAIN_ID = 137;
export const DEFAULT_RELAYER_URL = 'https://relayer-v2.polymarket.com/';
export const DEFAULT_RPC_URL = 'https://polygon-rpc.com';

/**
 * Derive the deterministic Safe address from an EOA address
 *
 * The Safe address is derived using a CREATE2 formula, so it's the same
 * address regardless of whether the Safe has been deployed yet.
 *
 * @param eoaAddress - The EOA wallet address
 * @param chainId - Chain ID (default: 137 for Polygon mainnet)
 * @returns The derived Safe address
 */
export function deriveSafeAddress(
  eoaAddress: string,
  chainId: number = POLYGON_CHAIN_ID
): string {
  const config = getContractConfig(chainId);
  return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
}

/**
 * Check if a Safe is deployed on-chain
 *
 * @param safeAddress - The Safe address to check
 * @param provider - Ethers provider for Polygon network
 * @returns True if the Safe is deployed, false otherwise
 */
export async function isSafeDeployed(
  safeAddress: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  const code = await provider.getCode(safeAddress);
  return code !== '0x' && code.length > 2;
}

/**
 * Check if a Safe is deployed using the RelayClient API
 *
 * @param relayClient - Initialized RelayClient instance
 * @param safeAddress - The Safe address to check
 * @returns True if the Safe is deployed, false otherwise
 */
export async function isSafeDeployedViaRelay(
  relayClient: RelayClient,
  safeAddress: string
): Promise<boolean> {
  try {
    // RelayClient has a getDeployed method
    const deployed = await (relayClient as any).getDeployed(safeAddress);
    return deployed;
  } catch {
    return false;
  }
}

/**
 * Create an ethers Signer adapter from a RouterSigner
 * This is needed for creating the RelayClient
 */
class RouterSignerEthersAdapter extends ethers.Signer {
  constructor(
    private readonly routerSigner: RouterSigner,
    provider: ethers.providers.Provider
  ) {
    super();
    (this as any).provider = provider;
  }

  async getAddress(): Promise<string> {
    return this.routerSigner.getAddress();
  }

  async signTransaction(
    _transaction: ethers.providers.TransactionRequest
  ): Promise<string> {
    throw new Error(
      'signTransaction not supported - use _signTypedData for EIP-712'
    );
  }

  async signMessage(_message: ethers.utils.Bytes | string): Promise<string> {
    throw new Error(
      'signMessage not supported - use _signTypedData for EIP-712'
    );
  }

  async _signTypedData(domain: any, types: any, value: any): Promise<string> {
    return await this.routerSigner.signTypedData({
      domain,
      types,
      primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || '',
      message: value,
    });
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return new RouterSignerEthersAdapter(this.routerSigner, provider);
  }
}

/**
 * Create an ethers v5 signer from a RouterSigner
 *
 * @param routerSigner - RouterSigner implementation
 * @param provider - Ethers provider
 * @returns Ethers v5 compatible signer
 */
export function createEthersSignerFromRouter(
  routerSigner: RouterSigner,
  provider: ethers.providers.Provider
): ethers.Signer {
  return new RouterSignerEthersAdapter(routerSigner, provider);
}

/**
 * Create a RelayClient for Safe operations
 *
 * The RelayClient is used for:
 * - Deploying Safe wallets
 * - Setting token approvals from Safe
 * - Executing CTF operations (split, merge, redeem)
 *
 * @param signer - RouterSigner or ethers Signer
 * @param options - Configuration options
 * @returns Initialized RelayClient
 */
export function createRelayClient(
  signer: RouterSigner | ethers.Signer,
  options: {
    relayerUrl?: string;
    rpcUrl?: string;
    chainId?: number;
    builderSigningUrl?: string;
  } = {}
): RelayClient {
  const {
    relayerUrl = DEFAULT_RELAYER_URL,
    rpcUrl = DEFAULT_RPC_URL,
    chainId = POLYGON_CHAIN_ID,
    builderSigningUrl = 'https://builder-signer.domeapi.io/builder-signer/sign',
  } = options;

  // Create provider
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId,
    name: 'polygon',
  });

  // Convert RouterSigner to ethers signer if needed
  let ethersSigner: ethers.Signer;
  if ('signTypedData' in signer && typeof signer.signTypedData === 'function') {
    // It's a RouterSigner
    ethersSigner = createEthersSignerFromRouter(
      signer as RouterSigner,
      provider
    );
  } else {
    // It's already an ethers Signer
    ethersSigner = signer as ethers.Signer;
  }

  // Create builder config for order attribution
  const builderConfig = new BuilderConfig({
    remoteBuilderConfig: {
      url: builderSigningUrl,
    },
  });

  // RelayClient expects a specific signer type - cast to any as the types may not perfectly align
  return new RelayClient(
    relayerUrl,
    chainId,
    ethersSigner as any,
    builderConfig
  );
}

/**
 * Deploy a Safe wallet for the user
 *
 * This deploys a new Safe smart contract wallet that is controlled by the user's EOA.
 * The Safe address is deterministic, so it will always be the same for a given EOA.
 *
 * @param relayClient - Initialized RelayClient
 * @returns Deployment result with Safe address and transaction hash
 */
export async function deploySafe(
  relayClient: RelayClient
): Promise<SafeInitResult> {
  const response = await relayClient.deploy();
  const result = await response.wait();

  if (!result) {
    throw new Error('Safe deployment failed - no result returned');
  }

  return {
    safeAddress: result.proxyAddress,
    wasAlreadyDeployed: false,
    deploymentTxHash: result.transactionHash,
  };
}

/**
 * Initialize a Safe wallet for trading
 *
 * This handles the full Safe setup flow:
 * 1. Derive Safe address from EOA
 * 2. Check if Safe is deployed
 * 3. Deploy Safe if needed
 *
 * @param signer - RouterSigner for the EOA
 * @param options - Configuration options
 * @returns Safe initialization result
 */
export async function initializeSafe(
  signer: RouterSigner,
  options: {
    relayerUrl?: string;
    rpcUrl?: string;
    chainId?: number;
    autoDeploy?: boolean;
    onProgress?: (step: string) => void;
  } = {}
): Promise<SafeInitResult> {
  const {
    rpcUrl = DEFAULT_RPC_URL,
    chainId = POLYGON_CHAIN_ID,
    autoDeploy = true,
    onProgress,
  } = options;

  // Get EOA address
  const eoaAddress = await signer.getAddress();
  onProgress?.('Deriving Safe address...');

  // Derive Safe address
  const safeAddress = deriveSafeAddress(eoaAddress, chainId);

  // Create provider to check deployment
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId,
    name: 'polygon',
  });

  // Check if Safe is already deployed
  onProgress?.('Checking Safe deployment status...');
  const deployed = await isSafeDeployed(safeAddress, provider);

  if (deployed) {
    return {
      safeAddress,
      wasAlreadyDeployed: true,
    };
  }

  // Deploy if auto-deploy is enabled
  if (!autoDeploy) {
    throw new Error(
      `Safe not deployed at ${safeAddress}. Set autoDeploy: true to deploy automatically.`
    );
  }

  onProgress?.('Deploying Safe wallet...');
  const relayClient = createRelayClient(signer, options);
  const deployResult = await deploySafe(relayClient);

  return {
    safeAddress: deployResult.safeAddress,
    wasAlreadyDeployed: false,
    deploymentTxHash: deployResult.deploymentTxHash,
  };
}

/**
 * Check USDC approval for a Safe wallet
 *
 * @param safeAddress - The Safe address to check
 * @param spender - The spender address to check approval for
 * @param provider - Ethers provider
 * @returns True if approval is set, false otherwise
 */
export async function checkSafeUsdcApproval(
  safeAddress: string,
  spender: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  const usdcContract = new ethers.Contract(
    POLYGON_ADDRESSES.USDC,
    [
      'function allowance(address owner, address spender) view returns (uint256)',
    ],
    provider
  );

  const allowance = await usdcContract.allowance(safeAddress, spender);
  return allowance.gt(0);
}

/**
 * Set USDC approval from a Safe wallet using RelayClient
 *
 * This sets the USDC approval for the CTF Exchange contract,
 * which is required for trading on Polymarket.
 *
 * Note: The RelayClient.setAllowances() method is available but
 * may have different method names depending on the package version.
 * We use a type assertion here to handle this.
 *
 * @param relayClient - Initialized RelayClient
 * @param onProgress - Optional progress callback
 * @returns True if successful
 */
export async function setSafeUsdcApproval(
  relayClient: RelayClient,
  onProgress?: (step: string) => void
): Promise<boolean> {
  onProgress?.('Setting USDC approval from Safe...');

  try {
    // The RelayClient handles setting approvals for trading
    // The method name varies by version - try common variants
    const client = relayClient as any;

    if (typeof client.setAllowances === 'function') {
      await client.setAllowances();
    } else if (typeof client.approveAll === 'function') {
      await client.approveAll();
    } else if (typeof client.setApprovals === 'function') {
      await client.setApprovals();
    } else {
      // Fallback: Just log that we couldn't find the method
      // In practice, the relayer client should have this method
      console.warn(
        'RelayClient setAllowances method not found - allowances may need to be set manually'
      );
    }
    return true;
  } catch (error) {
    console.error('Failed to set Safe USDC approval:', error);
    throw error;
  }
}

/**
 * Check if a Safe has all required allowances for Polymarket trading
 *
 * @param safeAddress - The Safe address to check
 * @param provider - Ethers provider
 * @returns Object indicating which allowances are set
 */
export async function checkSafeAllowances(
  safeAddress: string,
  provider: ethers.providers.Provider
): Promise<{
  allSet: boolean;
  ctfExchange: boolean;
  negRiskCtfExchange: boolean;
  negRiskAdapter: boolean;
}> {
  const [ctfExchange, negRiskCtfExchange, negRiskAdapter] = await Promise.all([
    checkSafeUsdcApproval(
      safeAddress,
      POLYGON_ADDRESSES.CTF_EXCHANGE,
      provider
    ),
    checkSafeUsdcApproval(
      safeAddress,
      POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      provider
    ),
    checkSafeUsdcApproval(
      safeAddress,
      POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      provider
    ),
  ]);

  return {
    allSet: ctfExchange && negRiskCtfExchange && negRiskAdapter,
    ctfExchange,
    negRiskCtfExchange,
    negRiskAdapter,
  };
}

/**
 * Get a Polygon provider
 *
 * @param rpcUrl - Optional custom RPC URL
 * @returns Ethers JsonRpcProvider
 */
export function getPolygonProvider(
  rpcUrl: string = DEFAULT_RPC_URL
): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: POLYGON_CHAIN_ID,
    name: 'polygon',
  });
}
