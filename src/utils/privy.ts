/**
 * Privy Utility Functions
 *
 * Helper functions to easily integrate Privy with Dome SDK for Polymarket trading.
 * These utilities handle server-side wallet signing using Privy's authorization keys.
 */

import { PrivyClient } from '@privy-io/server-auth';
import { RouterSigner, Eip712Payload } from '../types.js';
import { ethers } from 'ethers';

// Polygon contract addresses for Polymarket
const POLYGON_ADDRESSES = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

// ABI encoders
const ERC20_APPROVE_ABI = ['function approve(address spender, uint256 amount)'];
const ERC1155_APPROVE_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
];

/**
 * Configuration for Privy integration
 */
export interface PrivyConfig {
  /** Privy App ID */
  appId: string;
  /** Privy App Secret */
  appSecret: string;
  /** Privy Authorization Private Key (wallet-auth:...) */
  authorizationKey: string;
}

/**
 * Creates a Privy client instance for server-side operations
 *
 * @param config - Privy configuration
 * @returns Configured PrivyClient instance
 *
 * @example
 * ```typescript
 * const privy = createPrivyClient({
 *   appId: process.env.PRIVY_APP_ID!,
 *   appSecret: process.env.PRIVY_APP_SECRET!,
 *   authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
 * });
 * ```
 */
export function createPrivyClient(config: PrivyConfig): PrivyClient {
  return new PrivyClient(config.appId, config.appSecret, {
    walletApi: {
      authorizationPrivateKey: config.authorizationKey,
    },
  });
}

/**
 * Creates a RouterSigner from a Privy wallet for Polymarket trading
 *
 * This signer can be used with PolymarketRouter to sign orders server-side
 * without requiring user interaction.
 *
 * @param privy - Configured PrivyClient instance
 * @param walletId - Privy wallet ID
 * @param walletAddress - Wallet address (0x...)
 * @returns RouterSigner that can be used with PolymarketRouter
 *
 * @example
 * ```typescript
 * const privy = createPrivyClient({ ... });
 * const signer = createPrivySigner(
 *   privy,
 *   'wallet-id-from-privy',
 *   '0x1234...'
 * );
 *
 * // Use with PolymarketRouter
 * await router.linkUser({ userId: 'user-123', signer });
 * ```
 */
export function createPrivySigner(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string
): RouterSigner {
  return {
    async getAddress(): Promise<string> {
      return walletAddress;
    },

    async signTypedData(payload: Eip712Payload): Promise<string> {
      const { signature } = await privy.walletApi.ethereum.signTypedData({
        walletId,
        typedData: {
          domain: payload.domain,
          types: payload.types,
          primaryType: payload.primaryType,
          message: payload.message,
        },
      });

      return signature;
    },
  };
}

/**
 * All-in-one helper to create a Privy signer from environment variables
 *
 * Expects the following environment variables:
 * - PRIVY_APP_ID
 * - PRIVY_APP_SECRET
 * - PRIVY_AUTHORIZATION_KEY
 *
 * @param walletId - Privy wallet ID
 * @param walletAddress - Wallet address (0x...)
 * @returns RouterSigner ready to use
 *
 * @example
 * ```typescript
 * // Simplest usage - just pass wallet info
 * const signer = createPrivySignerFromEnv(
 *   user.privyWalletId,
 *   user.walletAddress
 * );
 *
 * await router.placeOrder({
 *   userId: user.id,
 *   marketId: '60487116984468020978247225474488676749601001829886755968952521846780452448915',
 *   side: 'buy',
 *   size: 10,
 *   price: 0.65,
 *   signer,
 * }, credentials);
 * ```
 */
export function createPrivySignerFromEnv(
  walletId: string,
  walletAddress: string
): RouterSigner {
  const config: PrivyConfig = {
    appId: process.env.PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
    authorizationKey: process.env.PRIVY_AUTHORIZATION_KEY!,
  };

  if (!config.appId || !config.appSecret || !config.authorizationKey) {
    throw new Error(
      'Missing Privy environment variables: PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_AUTHORIZATION_KEY'
    );
  }

  const privy = createPrivyClient(config);
  return createPrivySigner(privy, walletId, walletAddress);
}

/**
 * Check if a wallet has all required Polymarket token allowances
 *
 * @param walletAddress - The wallet address to check
 * @param rpcUrl - Optional Polygon RPC URL (defaults to public RPC)
 * @returns Object with allowance status for each contract
 */
export async function checkPrivyWalletAllowances(
  walletAddress: string,
  rpcUrl = 'https://polygon-rpc.com'
): Promise<{
  allSet: boolean;
  usdc: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  };
  ctf: {
    ctfExchange: boolean;
    negRiskCtfExchange: boolean;
    negRiskAdapter: boolean;
  };
}> {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, 137);

  const usdcContract = new ethers.Contract(
    POLYGON_ADDRESSES.USDC,
    [
      'function allowance(address owner, address spender) view returns (uint256)',
    ],
    provider
  );

  const ctfContract = new ethers.Contract(
    POLYGON_ADDRESSES.CTF,
    [
      'function isApprovedForAll(address owner, address operator) view returns (bool)',
    ],
    provider
  );

  const [usdcCtf, usdcNeg, usdcAdapter, ctfCtf, ctfNeg, ctfAdapter] =
    await Promise.all([
      usdcContract.allowance(walletAddress, POLYGON_ADDRESSES.CTF_EXCHANGE),
      usdcContract.allowance(
        walletAddress,
        POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE
      ),
      usdcContract.allowance(walletAddress, POLYGON_ADDRESSES.NEG_RISK_ADAPTER),
      ctfContract.isApprovedForAll(
        walletAddress,
        POLYGON_ADDRESSES.CTF_EXCHANGE
      ),
      ctfContract.isApprovedForAll(
        walletAddress,
        POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE
      ),
      ctfContract.isApprovedForAll(
        walletAddress,
        POLYGON_ADDRESSES.NEG_RISK_ADAPTER
      ),
    ]);

  const usdc = {
    ctfExchange: usdcCtf.gt(0),
    negRiskCtfExchange: usdcNeg.gt(0),
    negRiskAdapter: usdcAdapter.gt(0),
  };

  const ctf = {
    ctfExchange: ctfCtf,
    negRiskCtfExchange: ctfNeg,
    negRiskAdapter: ctfAdapter,
  };

  const allSet =
    usdc.ctfExchange &&
    usdc.negRiskCtfExchange &&
    usdc.negRiskAdapter &&
    ctf.ctfExchange &&
    ctf.negRiskCtfExchange &&
    ctf.negRiskAdapter;

  return { allSet, usdc, ctf };
}

/**
 * Set all required token allowances for Polymarket trading using Privy's sendTransaction
 *
 * This uses Privy's walletApi.ethereum.sendTransaction() to send approval transactions
 * directly from server-side. This is the recommended method for Privy-managed wallets.
 *
 * @param privy - Configured PrivyClient instance
 * @param walletId - Privy wallet ID
 * @param walletAddress - Wallet address (0x...)
 * @param onProgress - Optional callback for progress updates
 * @returns Object with transaction hashes for each approval
 *
 * @example
 * ```typescript
 * const privy = createPrivyClient({ ... });
 * const txs = await setPrivyWalletAllowances(
 *   privy,
 *   'wallet-id',
 *   '0x1234...',
 *   (step, current, total) => console.log(`[${current}/${total}] ${step}`)
 * );
 * ```
 */
export async function setPrivyWalletAllowances(
  privy: PrivyClient,
  walletId: string,
  walletAddress: string,
  onProgress?: (step: string, current: number, total: number) => void
): Promise<{
  usdc: {
    ctfExchange?: string;
    negRiskCtfExchange?: string;
    negRiskAdapter?: string;
  };
  ctf: {
    ctfExchange?: string;
    negRiskCtfExchange?: string;
    negRiskAdapter?: string;
  };
}> {
  // Check current allowances
  const allowances = await checkPrivyWalletAllowances(walletAddress);

  if (allowances.allSet) {
    return { usdc: {}, ctf: {} };
  }

  const erc20Interface = new ethers.utils.Interface(ERC20_APPROVE_ABI);
  const erc1155Interface = new ethers.utils.Interface(ERC1155_APPROVE_ABI);
  const maxUint256 = ethers.constants.MaxUint256;

  const txHashes: {
    usdc: {
      ctfExchange?: string;
      negRiskCtfExchange?: string;
      negRiskAdapter?: string;
    };
    ctf: {
      ctfExchange?: string;
      negRiskCtfExchange?: string;
      negRiskAdapter?: string;
    };
  } = { usdc: {}, ctf: {} };

  // Build list of needed approvals
  const approvals: Array<{
    name: string;
    token: string;
    spender: string;
    isERC20: boolean;
    key: 'ctfExchange' | 'negRiskCtfExchange' | 'negRiskAdapter';
    type: 'usdc' | 'ctf';
  }> = [];

  if (!allowances.usdc.ctfExchange) {
    approvals.push({
      name: 'USDC → CTF Exchange',
      token: POLYGON_ADDRESSES.USDC,
      spender: POLYGON_ADDRESSES.CTF_EXCHANGE,
      isERC20: true,
      key: 'ctfExchange',
      type: 'usdc',
    });
  }
  if (!allowances.usdc.negRiskCtfExchange) {
    approvals.push({
      name: 'USDC → Neg Risk CTF Exchange',
      token: POLYGON_ADDRESSES.USDC,
      spender: POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      isERC20: true,
      key: 'negRiskCtfExchange',
      type: 'usdc',
    });
  }
  if (!allowances.usdc.negRiskAdapter) {
    approvals.push({
      name: 'USDC → Neg Risk Adapter',
      token: POLYGON_ADDRESSES.USDC,
      spender: POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      isERC20: true,
      key: 'negRiskAdapter',
      type: 'usdc',
    });
  }
  if (!allowances.ctf.ctfExchange) {
    approvals.push({
      name: 'CTF → CTF Exchange',
      token: POLYGON_ADDRESSES.CTF,
      spender: POLYGON_ADDRESSES.CTF_EXCHANGE,
      isERC20: false,
      key: 'ctfExchange',
      type: 'ctf',
    });
  }
  if (!allowances.ctf.negRiskCtfExchange) {
    approvals.push({
      name: 'CTF → Neg Risk CTF Exchange',
      token: POLYGON_ADDRESSES.CTF,
      spender: POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      isERC20: false,
      key: 'negRiskCtfExchange',
      type: 'ctf',
    });
  }
  if (!allowances.ctf.negRiskAdapter) {
    approvals.push({
      name: 'CTF → Neg Risk Adapter',
      token: POLYGON_ADDRESSES.CTF,
      spender: POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      isERC20: false,
      key: 'negRiskAdapter',
      type: 'ctf',
    });
  }

  // Send each approval transaction
  for (let i = 0; i < approvals.length; i++) {
    const approval = approvals[i];
    onProgress?.(approval.name, i + 1, approvals.length);

    const data = approval.isERC20
      ? erc20Interface.encodeFunctionData('approve', [
          approval.spender,
          maxUint256,
        ])
      : erc1155Interface.encodeFunctionData('setApprovalForAll', [
          approval.spender,
          true,
        ]);

    const result = await privy.walletApi.ethereum.sendTransaction({
      walletId,
      caip2: 'eip155:137',
      transaction: {
        to: approval.token as `0x${string}`,
        data: data as `0x${string}`,
        chainId: 137,
      },
    });

    txHashes[approval.type][approval.key] = result.hash;
  }

  return txHashes;
}
