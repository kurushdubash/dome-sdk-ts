/**
 * DomeFeeEscrow constants matching contract values
 */

/** Polygon mainnet chain ID */
export const CHAIN_ID_POLYGON = 137;

/** Polygon Amoy testnet chain ID */
export const CHAIN_ID_AMOY = 80002;

/** DomeFeeEscrow V1 contract address on Polygon */
export const ESCROW_CONTRACT_POLYGON = '0xc5526DEdc553D1a456D59a2C2166A81A7880730A';

/** USDC.e (PoS bridged) contract address on Polygon */
export const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

/** EIP-712 domain name */
export const DOMAIN_NAME = 'DomeFeeEscrow';

/** EIP-712 domain version */
export const DOMAIN_VERSION = '1';

/** Default Dome fee: 0.1% (10 basis points) */
export const DEFAULT_DOME_FEE_BPS = 10n;

/** Default minimum Dome fee: $0.01 (10000 with 6 decimals) */
export const DEFAULT_MIN_DOME_FEE = 10_000n;

/** Maximum client fee: 100% (10000 basis points) */
export const MAX_CLIENT_FEE_BPS = 10_000n;

/** Number of decimals for USDC token precision */
export const USDC_DECIMALS = 6;

/** EIP-712 FeeAuth struct typehash */
export const FEE_AUTH_TYPEHASH = 'FeeAuth(bytes32 orderId,address payer,uint256 amount,uint256 deadline)';
