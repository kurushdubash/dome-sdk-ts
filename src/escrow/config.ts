/**
 * DomeFeeEscrow Configuration
 *
 * Default configuration values and configuration types for the escrow system.
 */

import { ethers } from 'ethers';
import {
  CHAIN_ID_POLYGON,
  CHAIN_ID_AMOY,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  DEFAULT_CLIENT_FEE_BPS,
  DEFAULT_CLIENT_ADDRESS,
} from './constants.js';

// ============================================================================
// Chain-specific Contract Addresses
// ============================================================================

/** DomeFeeEscrow contract address on Polygon Amoy testnet */
export const ESCROW_CONTRACT_AMOY = '0x0000000000000000000000000000000000000000'; // TODO: Deploy and update

/** USDC token address on Polygon Amoy testnet */
export const USDC_AMOY = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';

// ============================================================================
// Default Configuration Values
// ============================================================================

/** Default deadline for fee authorization in seconds (1 hour) */
export const DEFAULT_DEADLINE_SECONDS = 3600;

/** Default RPC URL for Polygon mainnet */
export const DEFAULT_RPC_URL_POLYGON = 'https://polygon-rpc.com';

/** Default RPC URL for Polygon Amoy testnet */
export const DEFAULT_RPC_URL_AMOY = 'https://rpc-amoy.polygon.technology';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Fee escrow configuration (client-side settings only)
 * domeFeeBps and minDomeFee are fetched from the contract
 */
export interface EscrowConfig {
  escrowAddress?: string;
  clientFeeBps?: number;
  clientAddress?: string;
  deadlineSeconds?: number;
  rpcUrl?: string;
}

/**
 * Resolved escrow configuration with all required fields
 */
export interface ResolvedEscrowConfig {
  escrowAddress: string;
  clientFeeBps: number;
  clientAddress: string;
  deadlineSeconds: number;
  rpcUrl: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const ESCROW_CONTRACTS: Record<number, string> = {
  [CHAIN_ID_POLYGON]: ESCROW_CONTRACT_POLYGON,
  [CHAIN_ID_AMOY]: ESCROW_CONTRACT_AMOY,
};

const USDC_ADDRESSES: Record<number, string> = {
  [CHAIN_ID_POLYGON]: USDC_POLYGON,
  [CHAIN_ID_AMOY]: USDC_AMOY,
};

const RPC_URLS: Record<number, string> = {
  [CHAIN_ID_POLYGON]: DEFAULT_RPC_URL_POLYGON,
  [CHAIN_ID_AMOY]: DEFAULT_RPC_URL_AMOY,
};

export function getEscrowAddress(chainId: number): string {
  const address = ESCROW_CONTRACTS[chainId];
  if (!address) throw new Error(`Unsupported chain ID for escrow: ${chainId}`);
  return address;
}

export function getUsdcAddress(chainId: number): string {
  const address = USDC_ADDRESSES[chainId];
  if (!address) throw new Error(`Unsupported chain ID for USDC: ${chainId}`);
  return address;
}

export function getDefaultRpcUrl(chainId: number): string {
  return RPC_URLS[chainId] ?? DEFAULT_RPC_URL_POLYGON;
}

// ============================================================================
// Contract Fee Config Fetching
// ============================================================================

/** ABI for reading fee config from DomeFeeEscrow contract */
const ESCROW_FEE_ABI = [
  'function domeFeeBps() view returns (uint256)',
  'function minDomeFee() view returns (uint256)',
];

/**
 * Dome fee configuration from contract
 */
export interface DomeFeeConfig {
  domeFeeBps: number;
  minDomeFee: bigint;
}

/** Cache for contract fee config to avoid repeated RPC calls */
const feeConfigCache = new Map<string, { config: DomeFeeConfig; timestamp: number }>();

/** Cache TTL in milliseconds (5 minutes) */
const FEE_CONFIG_CACHE_TTL = 5 * 60 * 1000;

/**
 * Fetch dome fee configuration from the escrow contract
 * Results are cached for 5 minutes to minimize RPC calls
 *
 * @param provider Ethers provider
 * @param escrowAddress Escrow contract address
 * @returns Dome fee config from contract
 */
export async function fetchDomeFeeConfig(
  provider: ethers.providers.Provider,
  escrowAddress: string
): Promise<DomeFeeConfig> {
  const cacheKey = escrowAddress.toLowerCase();
  const cached = feeConfigCache.get(cacheKey);

  // Return cached value if still valid
  if (cached && Date.now() - cached.timestamp < FEE_CONFIG_CACHE_TTL) {
    return cached.config;
  }

  const contract = new ethers.Contract(escrowAddress, ESCROW_FEE_ABI, provider);

  const [domeFeeBps, minDomeFee] = await Promise.all([
    contract.domeFeeBps(),
    contract.minDomeFee(),
  ]);

  const config: DomeFeeConfig = {
    domeFeeBps: Number(domeFeeBps),
    minDomeFee: BigInt(minDomeFee.toString()),
  };

  // Cache the result
  feeConfigCache.set(cacheKey, { config, timestamp: Date.now() });

  return config;
}

/**
 * Clear the fee config cache (useful for testing or after contract updates)
 */
export function clearFeeConfigCache(): void {
  feeConfigCache.clear();
}

export function resolveEscrowConfig(
  config: EscrowConfig = {},
  chainId: number
): ResolvedEscrowConfig {
  return {
    escrowAddress: config.escrowAddress ?? getEscrowAddress(chainId),
    clientFeeBps: config.clientFeeBps ?? Number(DEFAULT_CLIENT_FEE_BPS),
    clientAddress: config.clientAddress ?? DEFAULT_CLIENT_ADDRESS,
    deadlineSeconds: config.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS,
    rpcUrl: config.rpcUrl ?? getDefaultRpcUrl(chainId),
  };
}
