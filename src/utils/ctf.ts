/**
 * CTF (Conditional Token Framework) transaction builder utilities.
 *
 * Provides helpers for building redeemPositions() transactions so EOA users
 * can sign them offline before submitting to the Dome proxy.
 */

import { ethers } from 'ethers';
import { POLYGON_ADDRESSES } from './allowances.js';

/** CTF contract address (Polygon mainnet) — same as POLYGON_ADDRESSES.CTF */
export const CTF_CONTRACT_ADDRESS = POLYGON_ADDRESSES.CTF;

/** Polygon minimum gas tip (30 gwei) — some public RPCs return stale/low estimates */
const POLYGON_MIN_TIP_WEI = ethers.BigNumber.from('30000000000');

/** Minimal ABI for redeemPositions */
const CTF_REDEEM_ABI = [
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)',
];

export interface BuildRedeemTxParams {
  /** bytes32 condition ID of the resolved market */
  conditionId: string;
  /** Winning outcome index (0 or 1) */
  outcomeIndex: number;
}

export interface SignRedeemTxParams extends BuildRedeemTxParams {
  /** Chain ID (e.g. 137 for Polygon) */
  chainId: number;
}

/**
 * Encode redeemPositions calldata for the CTF contract.
 *
 * @param params - Condition ID and outcome index
 * @returns Hex-encoded calldata string
 */
export function buildRedeemPositionsCalldata(
  params: BuildRedeemTxParams
): string {
  const iface = new ethers.utils.Interface(CTF_REDEEM_ABI);

  // parentCollectionId is always bytes32(0) for top-level conditions
  const parentCollectionId = ethers.constants.HashZero;

  // indexSets: for a binary market, outcome 0 → [1], outcome 1 → [2]
  const indexSets = [1 << params.outcomeIndex];

  return iface.encodeFunctionData('redeemPositions', [
    POLYGON_ADDRESSES.USDC,
    parentCollectionId,
    params.conditionId,
    indexSets,
  ]);
}

/**
 * Build an unsigned transaction object for redeemPositions.
 *
 * @param params - Condition ID and outcome index
 * @returns Unsigned transaction fields (to, data, value)
 */
export function buildRedeemPositionsTx(params: BuildRedeemTxParams): {
  to: string;
  data: string;
  value: 0;
} {
  return {
    to: CTF_CONTRACT_ADDRESS,
    data: buildRedeemPositionsCalldata(params),
    value: 0,
  };
}

/**
 * Build and sign a redeemPositions transaction offline.
 *
 * Returns a serialized signed transaction hex string suitable for the
 * `signedRedeemTx` field in `ClaimWinningsParams`.
 *
 * The wallet must be connected to a provider so that gas parameters
 * (gasLimit, gasPrice, nonce) can be populated automatically.
 *
 * @param wallet - ethers Wallet connected to a provider
 * @param params - Condition ID, outcome index, and chain ID
 * @returns Serialized signed transaction (hex string)
 */
export async function signRedeemPositionsTx(
  wallet: ethers.Wallet,
  params: SignRedeemTxParams
): Promise<string> {
  if (!wallet.provider) {
    throw new Error(
      'signRedeemPositionsTx requires a wallet connected to a provider ' +
        '(needed for gas estimation and nonce). Use new Wallet(key, provider).'
    );
  }

  const tx = buildRedeemPositionsTx(params);

  const populatedTx = await wallet.populateTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
    chainId: params.chainId,
  });

  // Polygon public RPCs often return stale/low gas tip estimates.
  // Enforce a floor so the transaction isn't rejected on broadcast.
  if (params.chainId === 137 && populatedTx.maxPriorityFeePerGas) {
    const tip = ethers.BigNumber.from(populatedTx.maxPriorityFeePerGas);
    if (tip.lt(POLYGON_MIN_TIP_WEI)) {
      populatedTx.maxPriorityFeePerGas = POLYGON_MIN_TIP_WEI;
      // Ensure maxFeePerGas covers the bumped tip
      const maxFee = ethers.BigNumber.from(populatedTx.maxFeePerGas || 0);
      if (maxFee.lt(POLYGON_MIN_TIP_WEI)) {
        populatedTx.maxFeePerGas = POLYGON_MIN_TIP_WEI;
      }
    }
  }

  return wallet.signTransaction(populatedTx);
}
