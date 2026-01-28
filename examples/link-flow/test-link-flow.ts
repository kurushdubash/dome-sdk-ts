/**
 * Dome Polymarket Link Flow - Test Script
 *
 * This script demonstrates the complete flow for linking a wallet to Polymarket
 * through the Dome API. It handles:
 *   1. /link-prepare - Get EIP-712 payload to sign
 *   2. /link-complete - Submit signature and receive API credentials
 *   3. /link-set-allowances - Submit allowance signature (Safe only)
 *
 * Streamlined Flow: For freshly deployed Safes, /link-complete returns safeTxPayload
 * directly, allowing you to skip /link-set-allowances-prepare.
 *
 * Usage:
 *   # Required: Set the API URL
 *   API_BASE_URL=https://api.domeapi.io npm test
 *
 *   # Use existing wallet (recommended for Safe wallets)
 *   PRIVATE_KEY=0x... WALLET_TYPE=safe npm test
 *
 *   # Enable allowance testing for Safe wallets
 *   PRIVATE_KEY=0x... WALLET_TYPE=safe TEST_ALLOWANCES=true npm test
 *
 * Environment Variables:
 *   API_BASE_URL     - Required. The Dome API endpoint
 *   API_KEY          - Required. Your Dome API key for authentication
 *   PRIVATE_KEY      - Optional. Use existing wallet instead of generating new one
 *   WALLET_TYPE      - Optional. "eoa" (default) or "safe"
 *   AUTO_DEPLOY_SAFE - Optional. Set to "false" to disable automatic Safe deployment
 *   TEST_ALLOWANCES  - Optional. Set to "true" to test allowance setting (Safe only)
 *   CHAIN_ID         - Optional. Default is 137 (Polygon mainnet)
 */

import { ethers, Wallet } from "ethers";
import { config } from "dotenv";
import axios from "axios";

config();

// ============ Configuration ============

const API_BASE_URL = process.env["API_BASE_URL"];
const API_KEY = process.env["API_KEY"];
const PRIVATE_KEY = process.env["PRIVATE_KEY"];
const WALLET_TYPE = (process.env["WALLET_TYPE"] || "eoa") as "eoa" | "safe";
const CHAIN_ID = parseInt(process.env["CHAIN_ID"] || "137", 10);
const AUTO_DEPLOY_SAFE = process.env["AUTO_DEPLOY_SAFE"] !== "false";
const TEST_ALLOWANCES = process.env["TEST_ALLOWANCES"] === "true";

if (!API_BASE_URL) {
  console.error("Error: API_BASE_URL environment variable is required");
  console.error("Example: API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key npm test");
  process.exit(1);
}

if (!API_KEY) {
  console.error("Error: API_KEY environment variable is required");
  console.error("Example: API_BASE_URL=https://api.domeapi.io API_KEY=your-api-key npm test");
  process.exit(1);
}

// Common headers for all API calls
const API_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

// ============ Types ============

interface LinkPrepareResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    sessionId: string;
    expiresAt: number;
    eip712Payload: {
      domain: {
        name: string;
        version: string;
        chainId: number;
      };
      types: {
        ClobAuth: Array<{ name: string; type: string }>;
      };
      primaryType: string;
      message: {
        address: string;
        timestamp: string;
        nonce: number;
        message: string;
      };
    };
    safeInfo?: {
      safeAddress: string;
      wasDeployed: boolean;
      isDeployed: boolean;
      hasAllowances: boolean;
      allowancesMissing: string[];
    };
    safeDeployPayload?: any;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface SafeTxPayload {
  domain: {
    chainId: number;
    verifyingContract: string;
  };
  types: {
    SafeTx: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: {
    to: string;
    value: string;
    data: string;
    operation: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
  };
  messageHash: string;
}

interface LinkCompleteResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    success: boolean;
    credentials: {
      apiKey: string;
      apiSecret: string;
      apiPassphrase: string;
    };
    signerAddress: string;
    safeAddress?: string;
    safeDeployed?: boolean;
    safeDeployTxHash?: string;
    // Streamlined flow: For freshly deployed Safes, safeTxPayload is included
    // allowing clients to skip /link-set-allowances-prepare
    safeTxPayload?: SafeTxPayload;
    allowancesToSet?: string[];
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface SetAllowancesPrepareResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    sessionId: string;
    safeAddress: string;
    safeTxPayload: {
      domain: {
        chainId: number;
        verifyingContract: string;
      };
      types: {
        SafeTx: Array<{ name: string; type: string }>;
      };
      primaryType: string;
      message: {
        to: string;
        value: string;
        data: string;
        operation: number;
        safeTxGas: string;
        baseGas: string;
        gasPrice: string;
        gasToken: string;
        refundReceiver: string;
        nonce: number;
      };
      messageHash: string;
    };
    allowancesToSet: string[];
    nonce: number;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface SetAllowancesResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    success: boolean;
    safeAddress: string;
    transactionId?: string;
    transactionHash?: string;
    allowancesSet: string[];
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// ============ Helper Functions ============

function createWallet(): Wallet {
  if (PRIVATE_KEY) {
    console.log("Using existing wallet from PRIVATE_KEY env var");
    return new Wallet(PRIVATE_KEY);
  }
  console.log("Creating new random wallet for testing");
  return Wallet.createRandom();
}

async function signEip712Payload(
  wallet: Wallet,
  domain: any,
  types: any,
  message: any
): Promise<string> {
  // Remove EIP712Domain from types if present (ethers handles it internally)
  const typesWithoutDomain = { ...types };
  delete typesWithoutDomain.EIP712Domain;

  // Remove empty string values from domain (ethers.js can't handle them)
  // EIP-712 allows omitting optional domain fields
  const cleanDomain: any = {};
  for (const [key, value] of Object.entries(domain)) {
    if (value !== "" && value !== undefined && value !== null) {
      cleanDomain[key] = value;
    }
  }

  console.log("  Signing with cleaned domain:", JSON.stringify(cleanDomain));

  const signature = await wallet._signTypedData(cleanDomain, typesWithoutDomain, message);
  return signature;
}

/**
 * Sign a message hash (for SafeTx)
 * The Polymarket SDK uses eth_sign (signMessage) which applies the Ethereum prefix.
 * The v value in the signature will then be adjusted (+4) in splitAndPackSignature
 * to tell the Safe contract to apply the same prefix during verification.
 */
async function signMessageHash(
  wallet: Wallet,
  messageHash: string
): Promise<string> {
  // Use signMessage (eth_sign) which applies "\x19Ethereum Signed Message:\n32" prefix
  // This matches the Polymarket SDK behavior
  const signature = await wallet.signMessage(ethers.utils.arrayify(messageHash));
  return signature;
}

// ============ API Calls ============

async function linkPrepare(walletAddress: string): Promise<LinkPrepareResponse> {
  const url = `${API_BASE_URL}/v1/polymarket/link-prepare`;
  const requestBody = {
    jsonrpc: "2.0",
    method: "linkPrepare",
    id: `test-${Date.now()}`,
    params: {
      walletAddress,
      walletType: WALLET_TYPE,
      autoDeploySafe: AUTO_DEPLOY_SAFE,
      chainId: CHAIN_ID,
    },
  };

  console.log("\n=== LINK-PREPARE REQUEST ===");
  console.log("URL:", url);
  console.log("Body:", JSON.stringify(requestBody, null, 2));

  const response = await axios.post(url, requestBody, {
    headers: API_HEADERS,
  });

  console.log("\n=== LINK-PREPARE RESPONSE ===");
  console.log("Status:", response.status);
  console.log("Body:", JSON.stringify(response.data, null, 2));

  return response.data;
}

async function linkComplete(
  sessionId: string,
  signature: string,
  deploymentSignature?: string
): Promise<LinkCompleteResponse> {
  const url = `${API_BASE_URL}/v1/polymarket/link-complete`;
  const requestBody: any = {
    jsonrpc: "2.0",
    method: "linkComplete",
    id: `test-${Date.now()}`,
    params: {
      sessionId,
      signature,
    },
  };

  if (deploymentSignature) {
    requestBody.params.deploymentSignature = deploymentSignature;
  }

  console.log("\n=== LINK-COMPLETE REQUEST ===");
  console.log("URL:", url);
  console.log("Body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await axios.post(url, requestBody, {
      headers: API_HEADERS,
    });

    console.log("\n=== LINK-COMPLETE RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Body:", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error: any) {
    console.log("\n=== LINK-COMPLETE ERROR ===");
    console.log("Status:", error.response?.status);
    console.log("Body:", JSON.stringify(error.response?.data, null, 2));
    return error.response?.data;
  }
}

async function setAllowancesPrepare(
  sessionId: string
): Promise<SetAllowancesPrepareResponse> {
  const url = `${API_BASE_URL}/v1/polymarket/link-set-allowances-prepare`;
  const requestBody = {
    jsonrpc: "2.0",
    method: "setAllowancesPrepare",
    id: `test-${Date.now()}`,
    params: {
      sessionId,
      chainId: CHAIN_ID,
    },
  };

  console.log("\n=== SET-ALLOWANCES-PREPARE REQUEST ===");
  console.log("URL:", url);
  console.log("Body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await axios.post(url, requestBody, {
      headers: API_HEADERS,
    });

    console.log("\n=== SET-ALLOWANCES-PREPARE RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Body:", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error: any) {
    console.log("\n=== SET-ALLOWANCES-PREPARE ERROR ===");
    console.log("Status:", error.response?.status);
    console.log("Body:", JSON.stringify(error.response?.data, null, 2));
    return error.response?.data;
  }
}

async function setAllowances(
  sessionId: string,
  allowanceSignature: string
): Promise<SetAllowancesResponse> {
  const url = `${API_BASE_URL}/v1/polymarket/link-set-allowances`;
  const requestBody = {
    jsonrpc: "2.0",
    method: "setAllowances",
    id: `test-${Date.now()}`,
    params: {
      sessionId,
      chainId: CHAIN_ID,
      allowanceSignature,
    },
  };

  console.log("\n=== SET-ALLOWANCES REQUEST ===");
  console.log("URL:", url);
  console.log("Body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await axios.post(url, requestBody, {
      headers: API_HEADERS,
    });

    console.log("\n=== SET-ALLOWANCES RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Body:", JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error: any) {
    console.log("\n=== SET-ALLOWANCES ERROR ===");
    console.log("Status:", error.response?.status);
    console.log("Body:", JSON.stringify(error.response?.data, null, 2));
    return error.response?.data;
  }
}

// ============ Main Test ============

async function main() {
  console.log("========================================");
  console.log("Dome Polymarket Link Flow Test");
  console.log("========================================");
  console.log("Configuration:");
  console.log("  API URL:", API_BASE_URL);
  console.log("  Wallet Type:", WALLET_TYPE);
  console.log("  Chain ID:", CHAIN_ID);
  console.log("  Auto Deploy Safe:", AUTO_DEPLOY_SAFE);
  console.log("  Test Allowances:", TEST_ALLOWANCES);
  console.log("");

  // Step 1: Create or load wallet
  const wallet = createWallet();
  const walletAddress = await wallet.getAddress();
  console.log("\n=== WALLET INFO ===");
  console.log("Address:", walletAddress);
  if (!PRIVATE_KEY) {
    console.log("Private Key:", wallet.privateKey);
    console.log("(Save this if you want to reuse the wallet)");
  }

  // Step 2: Call link-prepare
  console.log("\n\nStep 1: Calling /link-prepare...");
  const prepareResponse = await linkPrepare(walletAddress);

  if (prepareResponse.error) {
    console.error("\n❌ link-prepare failed:", prepareResponse.error);
    process.exit(1);
  }

  const { sessionId, eip712Payload, safeInfo, safeDeployPayload } =
    prepareResponse.result!;

  console.log("\n✅ link-prepare succeeded");
  console.log("  Session ID:", sessionId);
  console.log("  EIP-712 message.address:", eip712Payload.message.address);
  console.log("  EIP-712 message.timestamp:", eip712Payload.message.timestamp);
  console.log("  EIP-712 message.nonce:", eip712Payload.message.nonce);
  if (safeInfo) {
    console.log("  Safe Address:", safeInfo.safeAddress);
    console.log("  Safe Deployed:", safeInfo.isDeployed);
    console.log("  Has Allowances:", safeInfo.hasAllowances);
  }

  // Step 3: Sign the EIP-712 payload
  console.log("\n\nStep 2: Signing EIP-712 payload...");

  // Verify we're signing with the correct address
  console.log("  Signer address:", walletAddress);
  console.log("  Message address:", eip712Payload.message.address);
  console.log("  Addresses match:", walletAddress.toLowerCase() === eip712Payload.message.address.toLowerCase());

  const signature = await signEip712Payload(
    wallet,
    eip712Payload.domain,
    eip712Payload.types,
    eip712Payload.message
  );

  console.log("  Signature:", signature);
  console.log("  Signature length:", signature.length);

  // Verify the signature locally
  const recoveredAddress = ethers.utils.verifyTypedData(
    eip712Payload.domain,
    { ClobAuth: eip712Payload.types.ClobAuth },
    eip712Payload.message,
    signature
  );
  console.log("  Recovered signer:", recoveredAddress);
  console.log("  Signature valid:", recoveredAddress.toLowerCase() === walletAddress.toLowerCase());

  // Step 4: Sign Safe deployment payload if needed
  let deploymentSignature: string | undefined;
  if (safeDeployPayload && WALLET_TYPE === "safe") {
    console.log("\n\nStep 2b: Signing Safe deployment payload...");
    deploymentSignature = await signEip712Payload(
      wallet,
      safeDeployPayload.domain,
      safeDeployPayload.types,
      safeDeployPayload.message
    );
    console.log("  Deployment signature:", deploymentSignature);
  }

  // Step 5: Call link-complete
  console.log("\n\nStep 3: Calling /link-complete...");
  const completeResponse = await linkComplete(sessionId, signature, deploymentSignature);

  if (completeResponse.error) {
    console.error("\n❌ link-complete failed:", completeResponse.error);
    console.error("\nSigned payload details:");
    console.error("  Wallet address:", walletAddress);
    console.error("  Message address:", eip712Payload.message.address);
    console.error("  Timestamp:", eip712Payload.message.timestamp);
    console.error("  Nonce:", eip712Payload.message.nonce);
    process.exit(1);
  }

  console.log("\n✅ link-complete succeeded!");
  console.log("  Signer Address:", completeResponse.result!.signerAddress);
  if (completeResponse.result!.safeAddress) {
    console.log("  Safe Address:", completeResponse.result!.safeAddress);
  }
  if (completeResponse.result!.safeDeployed) {
    console.log("  Safe Deployed:", completeResponse.result!.safeDeployed);
    console.log("  Safe Deploy Tx:", completeResponse.result!.safeDeployTxHash);
  }
  if (completeResponse.result!.safeTxPayload) {
    console.log("  SafeTxPayload: included (streamlined flow available)");
    console.log("  Allowances to set:", completeResponse.result!.allowancesToSet);
  }
  console.log("  API Key:", completeResponse.result!.credentials.apiKey);
  console.log("  API Secret:", completeResponse.result!.credentials.apiSecret.substring(0, 20) + "...");
  console.log("  API Passphrase:", completeResponse.result!.credentials.apiPassphrase.substring(0, 10) + "...");

  // Step 6: Test set-allowances flow (only for Safe wallets when TEST_ALLOWANCES is enabled)
  if (WALLET_TYPE === "safe" && TEST_ALLOWANCES) {
    console.log("\n\nStep 4: Testing set-allowances flow...");

    // Check if streamlined flow is available (safeTxPayload in link-complete response)
    let safeTxPayload: SafeTxPayload | undefined;
    let allowancesToSet: string[] = [];

    if (completeResponse.result!.safeTxPayload) {
      // Streamlined flow: use safeTxPayload from link-complete (skip /link-set-allowances-prepare)
      console.log("\n✅ Using streamlined flow (safeTxPayload from /link-complete)");
      safeTxPayload = completeResponse.result!.safeTxPayload;
      allowancesToSet = completeResponse.result!.allowancesToSet || [];
      console.log("  Allowances to set:", allowancesToSet);
      console.log("  Message hash:", safeTxPayload.messageHash);
    } else {
      // Legacy flow: call /link-set-allowances-prepare
      console.log("\nStep 4a: Calling /link-set-allowances-prepare...");
      const allowancesPrepareResponse = await setAllowancesPrepare(sessionId);

      if (allowancesPrepareResponse.error) {
        console.error("\n❌ set-allowances-prepare failed:", allowancesPrepareResponse.error);
        process.exit(1);
      }

      safeTxPayload = allowancesPrepareResponse.result!.safeTxPayload;
      allowancesToSet = allowancesPrepareResponse.result!.allowancesToSet;
      const nonce = allowancesPrepareResponse.result!.nonce;

      console.log("\n✅ set-allowances-prepare succeeded");
      console.log("  Safe Address:", allowancesPrepareResponse.result!.safeAddress);
      console.log("  Allowances to set:", allowancesToSet);
      console.log("  Nonce:", nonce);
      console.log("  Message hash:", safeTxPayload.messageHash);
    }

    if (allowancesToSet.length === 0) {
      console.log("\n✅ All allowances already set - skipping set-allowances");
    } else {
      // Sign the SafeTx message hash using eth_sign (signMessage)
      // Note: signMessage applies the "\x19Ethereum Signed Message:\n32" prefix
      console.log("\nStep 4b: Signing SafeTx message hash...");
      const allowanceSignature = await signMessageHash(wallet, safeTxPayload!.messageHash);
      console.log("  Allowance signature:", allowanceSignature);

      // Verify the signature (using prefixed hash since we used signMessage)
      const prefixedHash = ethers.utils.hashMessage(ethers.utils.arrayify(safeTxPayload!.messageHash));
      const recoveredFromHash = ethers.utils.recoverAddress(prefixedHash, allowanceSignature);
      console.log("  Recovered address:", recoveredFromHash);
      console.log("  Signature valid:", recoveredFromHash.toLowerCase() === walletAddress.toLowerCase());

      // Call set-allowances
      console.log("\nStep 4c: Calling /link-set-allowances...");
      const allowancesResponse = await setAllowances(sessionId, allowanceSignature);

      if (allowancesResponse.error) {
        console.error("\n❌ set-allowances failed:", allowancesResponse.error);
        process.exit(1);
      }

      console.log("\n✅ set-allowances succeeded!");
      console.log("  Safe Address:", allowancesResponse.result!.safeAddress);
      console.log("  Allowances set:", allowancesResponse.result!.allowancesSet);
      if (allowancesResponse.result!.transactionId) {
        console.log("  Transaction ID:", allowancesResponse.result!.transactionId);
      }
      if (allowancesResponse.result!.transactionHash) {
        console.log("  Transaction Hash:", allowancesResponse.result!.transactionHash);
      }
    }
  } else if (WALLET_TYPE === "safe" && !TEST_ALLOWANCES) {
    console.log("\n\n(Skipping set-allowances test - set TEST_ALLOWANCES=true to test)");
  }

  console.log("\n========================================");
  console.log("✅ All tests passed!");
  console.log("========================================");

  // Output useful env vars for future testing
  if (!PRIVATE_KEY) {
    console.log("\n=== SAVE THESE FOR FUTURE TESTS ===");
    console.log(`PRIVATE_KEY=${wallet.privateKey}`);
    console.log(`WALLET_ADDRESS=${walletAddress}`);
  }
}

main().catch((error) => {
  console.error("\n❌ Test failed with error:", error.message);
  if (error.response) {
    console.error("Response status:", error.response.status);
    console.error("Response data:", JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});
