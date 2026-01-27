/**
 * DomeFeeEscrow Configuration
 *
 * Default configuration values and configuration types for the escrow system.
 */

import {
  CHAIN_ID_POLYGON,
  CHAIN_ID_AMOY,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
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
 * Fee escrow configuration
 */
export interface EscrowConfig {
  escrowAddress?: string;
  domeFeeBps?: number;
  minDomeFee?: bigint;
  clientFeeBps?: number;
  clientAddress?: string;
  deadlineSeconds?: number;
  rpcUrl?: string;
}

/**
 * Resolved escrow configuration with all required fields
 */
export type ResolvedEscrowConfig = Required<EscrowConfig>;

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

export function resolveEscrowConfig(
  config: EscrowConfig = {},
  chainId: number
): ResolvedEscrowConfig {
  return {
    escrowAddress: config.escrowAddress ?? getEscrowAddress(chainId),
    domeFeeBps: config.domeFeeBps ?? Number(DEFAULT_DOME_FEE_BPS),
    minDomeFee: config.minDomeFee ?? DEFAULT_MIN_DOME_FEE,
    clientFeeBps: config.clientFeeBps ?? Number(DEFAULT_CLIENT_FEE_BPS),
    clientAddress: config.clientAddress ?? DEFAULT_CLIENT_ADDRESS,
    deadlineSeconds: config.deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS,
    rpcUrl: config.rpcUrl ?? getDefaultRpcUrl(chainId),
  };
}
