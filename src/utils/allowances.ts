/**
 * Token Allowance Utilities for Polymarket Trading
 *
 * Polymarket requires two types of token approvals for trading:
 * 1. USDC token allowance - allows exchange contracts to move USDC
 * 2. Conditional Token Framework (CTF) approval - allows trading outcome tokens
 *
 * These approvals only need to be set ONCE per wallet. After that, the wallet
 * can trade freely without additional approval transactions.
 *
 * @see https://github.com/Polymarket/py-clob-client?tab=readme-ov-file#important-token-allowances-for-metamaskeoa-users
 */

// Import ethers v5 (now that we have it as a direct dependency)
import { ethers } from 'ethers';
import { RouterSigner } from '../types.js';

// Polygon Mainnet Contract Addresses
export const POLYGON_ADDRESSES = {
  // USDC token contract (bridged USDC from Ethereum)
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  // Conditional Token Framework (CTF) - for outcome tokens
  CTF: '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045',
  // Exchange contracts that need approvals
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  NEG_RISK_ADAPTER: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

// Standard ERC20 ABI (minimal - just approve and allowance functions)
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// CTF (ERC1155) ABI (minimal - just setApprovalForAll and isApprovedForAll)
const CTF_ABI = [
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
];

/**
 * Adapter class that wraps RouterSigner as an ethers v5 Signer
 * This is needed because we're working with ethers v5 for compatibility with clob-client
 */
class RouterSignerAdapter extends ethers.Signer {
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

  // This is the key method for EIP-712 signing
  async _signTypedData(domain: any, types: any, value: any): Promise<string> {
    return await this.routerSigner.signTypedData({
      domain,
      types,
      primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || '',
      message: value,
    });
  }

  connect(provider: ethers.providers.Provider): ethers.Signer {
    return new RouterSignerAdapter(this.routerSigner, provider);
  }
}

/**
 * Convert RouterSigner to ethers v5 compatible signer
 */
function createEthersV5Signer(
  routerSigner: RouterSigner,
  provider: ethers.providers.Provider
): ethers.Signer {
  return new RouterSignerAdapter(routerSigner, provider);
}

/**
 * Check if USDC allowance is set for a specific spender
 */
export async function checkUsdcAllowance(
  walletAddress: string,
  spender: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  const usdcContract = new ethers.Contract(
    POLYGON_ADDRESSES.USDC,
    ERC20_ABI,
    provider
  );

  const allowance = await usdcContract.allowance(walletAddress, spender);
  // Check if allowance is greater than zero (we use max uint256 when approving)
  return allowance.gt(0);
}

/**
 * Check if CTF (Conditional Token Framework) approval is set for a specific operator
 */
export async function checkCtfApproval(
  walletAddress: string,
  operator: string,
  provider: ethers.providers.Provider
): Promise<boolean> {
  const ctfContract = new ethers.Contract(
    POLYGON_ADDRESSES.CTF,
    CTF_ABI,
    provider
  );

  return await ctfContract.isApprovedForAll(walletAddress, operator);
}

/**
 * Check all required allowances for Polymarket trading
 *
 * Returns an object indicating which approvals are missing
 */
export async function checkAllAllowances(
  walletAddress: string,
  provider: ethers.providers.Provider
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
  const [
    usdcCtfExchange,
    usdcNegRiskCtfExchange,
    usdcNegRiskAdapter,
    ctfCtfExchange,
    ctfNegRiskCtfExchange,
    ctfNegRiskAdapter,
  ] = await Promise.all([
    checkUsdcAllowance(walletAddress, POLYGON_ADDRESSES.CTF_EXCHANGE, provider),
    checkUsdcAllowance(
      walletAddress,
      POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      provider
    ),
    checkUsdcAllowance(
      walletAddress,
      POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      provider
    ),
    checkCtfApproval(walletAddress, POLYGON_ADDRESSES.CTF_EXCHANGE, provider),
    checkCtfApproval(
      walletAddress,
      POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      provider
    ),
    checkCtfApproval(
      walletAddress,
      POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      provider
    ),
  ]);

  const usdc = {
    ctfExchange: usdcCtfExchange,
    negRiskCtfExchange: usdcNegRiskCtfExchange,
    negRiskAdapter: usdcNegRiskAdapter,
  };

  const ctf = {
    ctfExchange: ctfCtfExchange,
    negRiskCtfExchange: ctfNegRiskCtfExchange,
    negRiskAdapter: ctfNegRiskAdapter,
  };

  const allSet =
    usdcCtfExchange &&
    usdcNegRiskCtfExchange &&
    usdcNegRiskAdapter &&
    ctfCtfExchange &&
    ctfNegRiskCtfExchange &&
    ctfNegRiskAdapter;

  return { allSet, usdc, ctf };
}

/**
 * Approve USDC spending for a specific spender
 *
 * @param signer - RouterSigner implementation (Privy, MetaMask, etc.)
 * @param spender - Address of the contract that needs approval
 * @param provider - Ethers provider for Polygon network
 * @returns Transaction hash of the approval
 */
export async function approveUsdc(
  signer: RouterSigner,
  spender: string,
  provider: ethers.providers.Provider
): Promise<string> {
  const ethersSigner = createEthersV5Signer(signer, provider);
  const usdcContract = new ethers.Contract(
    POLYGON_ADDRESSES.USDC,
    ERC20_ABI,
    ethersSigner
  );

  // Approve max uint256 amount (unlimited)
  const maxUint256 = ethers.constants.MaxUint256;
  const tx = await usdcContract.approve(spender, maxUint256);
  await tx.wait();

  return tx.hash;
}

/**
 * Set approval for all CTF tokens for a specific operator
 *
 * @param signer - RouterSigner implementation (Privy, MetaMask, etc.)
 * @param operator - Address of the contract that needs approval
 * @param provider - Ethers provider for Polygon network
 * @returns Transaction hash of the approval
 */
export async function approveCtf(
  signer: RouterSigner,
  operator: string,
  provider: ethers.providers.Provider
): Promise<string> {
  const ethersSigner = createEthersV5Signer(signer, provider);
  const ctfContract = new ethers.Contract(
    POLYGON_ADDRESSES.CTF,
    CTF_ABI,
    ethersSigner
  );

  const tx = await ctfContract.setApprovalForAll(operator, true);
  await tx.wait();

  return tx.hash;
}

/**
 * Set all required allowances for Polymarket trading
 *
 * This will:
 * 1. Approve USDC for all 3 exchange contracts
 * 2. Approve CTF tokens for all 3 exchange contracts
 *
 * Each approval requires a separate transaction, so this may take some time.
 * Only sets approvals that are not already set.
 *
 * @param signer - RouterSigner implementation (Privy, MetaMask, etc.)
 * @param provider - Ethers provider for Polygon network
 * @param onProgress - Optional callback for progress updates
 * @returns Object with transaction hashes for each approval
 */
export async function setAllAllowances(
  signer: RouterSigner,
  provider: ethers.providers.Provider,
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
  const walletAddress = await signer.getAddress();

  // Check which allowances are already set
  const allowances = await checkAllAllowances(walletAddress, provider);

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

  // Count how many approvals we need to set
  const approvalSteps = [
    { name: 'USDC for CTF Exchange', check: allowances.usdc.ctfExchange },
    {
      name: 'USDC for Neg Risk CTF Exchange',
      check: allowances.usdc.negRiskCtfExchange,
    },
    {
      name: 'USDC for Neg Risk Adapter',
      check: allowances.usdc.negRiskAdapter,
    },
    { name: 'CTF for CTF Exchange', check: allowances.ctf.ctfExchange },
    {
      name: 'CTF for Neg Risk CTF Exchange',
      check: allowances.ctf.negRiskCtfExchange,
    },
    { name: 'CTF for Neg Risk Adapter', check: allowances.ctf.negRiskAdapter },
  ];

  const totalSteps = approvalSteps.filter(s => !s.check).length;
  let currentStep = 0;

  // Set USDC approvals
  if (!allowances.usdc.ctfExchange) {
    currentStep++;
    onProgress?.('Approving USDC for CTF Exchange', currentStep, totalSteps);
    txHashes.usdc.ctfExchange = await approveUsdc(
      signer,
      POLYGON_ADDRESSES.CTF_EXCHANGE,
      provider
    );
  }

  if (!allowances.usdc.negRiskCtfExchange) {
    currentStep++;
    onProgress?.(
      'Approving USDC for Neg Risk CTF Exchange',
      currentStep,
      totalSteps
    );
    txHashes.usdc.negRiskCtfExchange = await approveUsdc(
      signer,
      POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      provider
    );
  }

  if (!allowances.usdc.negRiskAdapter) {
    currentStep++;
    onProgress?.(
      'Approving USDC for Neg Risk Adapter',
      currentStep,
      totalSteps
    );
    txHashes.usdc.negRiskAdapter = await approveUsdc(
      signer,
      POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      provider
    );
  }

  // Set CTF approvals
  if (!allowances.ctf.ctfExchange) {
    currentStep++;
    onProgress?.(
      'Approving CTF tokens for CTF Exchange',
      currentStep,
      totalSteps
    );
    txHashes.ctf.ctfExchange = await approveCtf(
      signer,
      POLYGON_ADDRESSES.CTF_EXCHANGE,
      provider
    );
  }

  if (!allowances.ctf.negRiskCtfExchange) {
    currentStep++;
    onProgress?.(
      'Approving CTF tokens for Neg Risk CTF Exchange',
      currentStep,
      totalSteps
    );
    txHashes.ctf.negRiskCtfExchange = await approveCtf(
      signer,
      POLYGON_ADDRESSES.NEG_RISK_CTF_EXCHANGE,
      provider
    );
  }

  if (!allowances.ctf.negRiskAdapter) {
    currentStep++;
    onProgress?.(
      'Approving CTF tokens for Neg Risk Adapter',
      currentStep,
      totalSteps
    );
    txHashes.ctf.negRiskAdapter = await approveCtf(
      signer,
      POLYGON_ADDRESSES.NEG_RISK_ADAPTER,
      provider
    );
  }

  return txHashes;
}

/**
 * Convenience function to get a Polygon provider
 *
 * @param rpcUrl - Optional custom RPC URL. Defaults to Polygon public RPC.
 * @returns Ethers provider configured for Polygon
 */
export function getPolygonProvider(
  rpcUrl = 'https://polygon-rpc.com'
): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: 137,
    name: 'polygon',
  });
}
