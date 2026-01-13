/**
 * WalletConnect + Safe Wallet Reproduction Script
 *
 * This script EXACTLY reproduces what the customer is doing:
 * 1. Derive API credentials (without signatureType/funder params) - POTENTIAL BUG
 * 2. Sign order with signatureType=2 and Safe as funder
 * 3. POST to Dome server
 *
 * Usage:
 *   EOA_PRIVATE_KEY=0x... npx tsx examples/walletconnect-safe-repro.ts
 *
 * Test addresses:
 *   Safe wallet: 0x1fbf0D2CC787509585A06C9E9C6691D40450B274
 *   EOA: 0x20e8f797c89aDa9A9d253B1c697a249B8599BB13
 */

import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { deriveSafeAddress } from '../src/utils/safe';
import { PolymarketRouter, RouterSigner } from '../src';

// Test addresses from user
const TEST_SAFE_ADDRESS = '0x1fbf0D2CC787509585A06C9E9C6691D40450B274';
const TEST_EOA_ADDRESS = '0x20e8f797c89aDa9A9d253B1c697a249B8599BB13';

// Default test market
const DEFAULT_TOKEN_ID =
  '104173557214744537570424345347209544585775842950109756851652855913015295701992';

const DOME_API_ENDPOINT = 'https://api.domeapi.io/v1';

async function main() {
  console.log('=== EXACT Customer Reproduction: WalletConnect + Safe ===\n');

  // Validate environment
  const privateKey = process.env.EOA_PRIVATE_KEY;
  const domeApiKey = process.env.DOME_API_KEY;
  const providedSafeAddress = process.env.SAFE_ADDRESS || TEST_SAFE_ADDRESS;
  const tokenId = process.env.TOKEN_ID || DEFAULT_TOKEN_ID;

  if (!privateKey) {
    console.error('ERROR: EOA_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  if (!domeApiKey) {
    console.error('ERROR: DOME_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create wallet (simulates WalletConnect connection)
  const wallet = new ethers.Wallet(privateKey);
  const eoaAddress = wallet.address;

  // Derive Safe address
  const derivedSafeAddress = deriveSafeAddress(eoaAddress);
  const safeAddress = providedSafeAddress;

  console.log('EOA Address (signer):', eoaAddress);
  console.log('Derived Safe Address:', derivedSafeAddress);
  console.log('Using Safe Address:', safeAddress);

  if (derivedSafeAddress.toLowerCase() !== safeAddress.toLowerCase()) {
    console.log('\n⚠️  WARNING: Provided Safe differs from derived Safe!');
    console.log('   This may indicate the Safe was created differently.');
  }

  // Create ethers adapter for ClobClient
  const ethersAdapter = {
    getAddress: async () => eoaAddress,
    _signTypedData: async (domain: any, types: any, value: any) => {
      console.log('\n   [Sign] EIP-712 typed data signing...');
      console.log('   [Sign] Domain:', JSON.stringify(domain));
      console.log('   [Sign] Primary type:', Object.keys(types)[0]);
      const sig = await wallet._signTypedData(domain, types, value);
      console.log('   [Sign] Signature:', `${sig.slice(0, 30)}...`);
      return sig;
    },
  };

  // ============================================================
  // STEP 1: Derive API credentials (EXACTLY as customer does it)
  // NOTE: Customer does NOT pass signatureType or funderAddress here!
  // This might be the bug - credentials derived for EOA, not Safe
  // ============================================================
  console.log('\n=== Step 1: Derive API Credentials ===');
  console.log('Customer code creates ClobClient WITHOUT signatureType/funder:');
  console.log('  const clobClient = new ClobClient(host, 137, signer);');
  console.log('  const creds = await clobClient.deriveApiKey();');

  // This is what the customer does - NO signatureType, NO funder
  const clobClientForCreds = new ClobClient(
    'https://clob.polymarket.com',
    137,
    ethersAdapter as any
    // Missing: undefined, // creds
    // Missing: undefined, // signatureType (defaults to 0 = EOA)
    // Missing: undefined, // funderAddress (defaults to signer address)
  );

  let creds: { key: string; secret: string; passphrase: string };
  try {
    console.log('\nDeriving credentials (without Safe params)...');
    creds = await clobClientForCreds.deriveApiKey();
    console.log('✅ Credentials derived:');
    console.log('   API Key:', creds.key);
    console.log('   Secret:', `${creds.secret.slice(0, 20)}...`);
    console.log('   Passphrase:', `${creds.passphrase.slice(0, 10)}...`);
  } catch (error: any) {
    console.error('❌ Failed to derive credentials:', error.message);
    process.exit(1);
  }

  // ============================================================
  // STEP 2: Create and sign order (EXACTLY as customer does it)
  // NOTE: Customer DOES use signatureType=2 and Safe as funder here
  // ============================================================
  console.log('\n=== Step 2: Create and Sign Order ===');
  console.log(
    'Customer code creates NEW ClobClient WITH signatureType/funder:'
  );
  console.log('  const clobClientForOrder = new ClobClient(');
  console.log('    host, 137, signer, creds,');
  console.log('    2,  // signatureType for Safe');
  console.log('    safeAddress  // funderAddress');
  console.log('  );');

  // This is what the customer does for order signing
  const clobClientForOrder = new ClobClient(
    'https://clob.polymarket.com',
    137,
    ethersAdapter as any,
    creds, // Use the credentials we just derived
    2, // signatureType = 2 for Safe
    safeAddress // funderAddress = Safe
  );

  console.log('\nCreating order with params:');
  console.log('  tokenID:', tokenId);
  console.log('  price: 0.5');
  console.log('  side: BUY');
  console.log('  size: 10');
  console.log('  signatureType: 2 (Safe)');
  console.log('  funder:', safeAddress);

  let signedOrder: any;
  try {
    signedOrder = await clobClientForOrder.createOrder(
      {
        tokenID: tokenId,
        price: 0.5,
        side: 'BUY' as any,
        size: 10,
        feeRateBps: 1000, // Market requires 1000 bps (10%)
        nonce: 0,
        expiration: 0,
        taker: '0x0000000000000000000000000000000000000000',
      },
      { tickSize: '0.01', negRisk: false }
    );

    console.log('\n✅ Order created and signed:');
    console.log('   Order:', JSON.stringify(signedOrder, null, 2));
  } catch (error: any) {
    console.error('❌ Failed to create order:', error.message);
    process.exit(1);
  }

  // ============================================================
  // STEP 3: POST to Dome server (EXACTLY as customer does it)
  // ============================================================
  console.log('\n=== Step 3: POST to Dome Server ===');

  // IMPORTANT: The CLOB client returns side as a number (0=BUY, 1=SELL)
  // but Dome server expects "BUY" or "SELL" as strings
  const sideString = signedOrder.side === 0 ? 'BUY' : 'SELL';

  // NOTE: signedOrder.signer = EOA, signedOrder.maker = Safe
  // Dome should use signedOrder.signer for POLY_ADDRESS header
  // because the API key was derived using EOA's signature
  const requestBody = {
    jsonrpc: '2.0',
    method: 'placeOrder',
    id: crypto.randomUUID?.() || `${Date.now()}`,
    params: {
      signedOrder: {
        ...signedOrder,
        side: sideString, // Convert numeric side to string
      },
      orderType: 'FOK',
      credentials: {
        apiKey: creds.key,
        apiSecret: creds.secret,
        apiPassphrase: creds.passphrase,
      },
      clientOrderId: crypto.randomUUID?.() || `${Date.now()}`,
      // Explicitly tell Dome which address to use for POLY_ADDRESS
      signerAddress: eoaAddress,
    },
  };

  console.log(
    '\nCRITICAL: For Safe wallets, POLY_ADDRESS must be the EOA (signer), not the Safe (maker)'
  );
  console.log('signedOrder.maker (Safe):', signedOrder.maker);
  console.log('signedOrder.signer (EOA):', signedOrder.signer);
  console.log('API credentials were derived for address:', eoaAddress);

  console.log('Request body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${DOME_API_ENDPOINT}/polymarket/placeOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${domeApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('\nResponse status:', response.status);
    console.log('Response body:', responseText);

    if (!response.ok) {
      console.error('\n❌ HTTP Error:', response.status, response.statusText);
    }

    try {
      const responseJson = JSON.parse(responseText);
      if (responseJson.error) {
        console.error('\n❌ JSON-RPC Error:', responseJson.error);
      } else if (responseJson.result) {
        console.log('\n✅ Success:', responseJson.result);
      }
    } catch {
      // Response wasn't JSON
    }
  } catch (error: any) {
    console.error('\n❌ Request failed:', error.message);
  }

  // ============================================================
  // COMPARISON: Try the CORRECT way (for debugging)
  // ============================================================
  console.log('\n\n=== COMPARISON: Correct Way (for debugging) ===');
  console.log(
    'Deriving credentials WITH signatureType=2 and Safe as funder...'
  );

  const clobClientCorrect = new ClobClient(
    'https://clob.polymarket.com',
    137,
    ethersAdapter as any,
    undefined, // No creds yet
    2, // signatureType = 2 for Safe
    safeAddress // funderAddress = Safe
  );

  try {
    const correctCreds = await clobClientCorrect.deriveApiKey();
    console.log('\n✅ Correct credentials derived:');
    console.log('   API Key:', correctCreds.key);
    console.log('   Secret:', `${correctCreds.secret.slice(0, 20)}...`);

    // Compare
    console.log('\n=== Credential Comparison ===');
    console.log('Wrong way (no Safe params):  API Key =', creds.key);
    console.log('Correct way (with Safe):     API Key =', correctCreds.key);

    if (creds.key !== correctCreds.key) {
      console.log('\n🔴 CREDENTIALS ARE DIFFERENT!');
      console.log('   This is likely the root cause of ORDER_REJECTED.');
      console.log(
        '   The credentials must be derived with signatureType=2 and Safe as funder.'
      );
    } else {
      console.log('\n🟢 Credentials match (unexpected)');
    }

    // Try placing order with correct credentials
    console.log('\n=== Trying order with CORRECT credentials ===');

    const clobClientForCorrectOrder = new ClobClient(
      'https://clob.polymarket.com',
      137,
      ethersAdapter as any,
      correctCreds,
      2,
      safeAddress
    );

    const correctSignedOrder = await clobClientForCorrectOrder.createOrder(
      {
        tokenID: tokenId,
        price: 0.01, // Lower price for test
        side: 'BUY' as any,
        size: 100, // $1 minimum
      },
      { tickSize: '0.01', negRisk: false }
    );

    // Convert side from numeric to string
    const correctSideString = correctSignedOrder.side === 0 ? 'BUY' : 'SELL';

    const correctRequestBody = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: crypto.randomUUID?.() || `${Date.now()}`,
      params: {
        signedOrder: {
          ...correctSignedOrder,
          side: correctSideString,
        },
        orderType: 'GTC',
        credentials: {
          apiKey: correctCreds.key,
          apiSecret: correctCreds.secret,
          apiPassphrase: correctCreds.passphrase,
        },
        clientOrderId: crypto.randomUUID?.() || `${Date.now()}`,
      },
    };

    console.log(
      'Correct request body:',
      JSON.stringify(correctRequestBody, null, 2)
    );

    const correctResponse = await fetch(
      `${DOME_API_ENDPOINT}/polymarket/placeOrder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${domeApiKey}`,
        },
        body: JSON.stringify(correctRequestBody),
      }
    );

    const correctResponseText = await correctResponse.text();
    console.log('\nCorrect response status:', correctResponse.status);
    console.log('Correct response body:', correctResponseText);
  } catch (error: any) {
    console.error('❌ Correct way also failed:', error.message);
  }

  // ============================================================
  // DEBUG: List all API keys for this wallet
  // ============================================================
  console.log('\n\n=== DEBUG: List all API keys ===');
  try {
    const clobForList = new ClobClient(
      'https://clob.polymarket.com',
      137,
      ethersAdapter as any,
      creds,
      2,
      safeAddress
    );
    const allKeys = await clobForList.getApiKeys();
    console.log('All registered API keys:', JSON.stringify(allKeys, null, 2));
  } catch (error: any) {
    console.log('Could not list API keys:', error.message);
  }

  // ============================================================
  // TEST: Post DIRECTLY to Polymarket CLOB (bypass Dome)
  // This is how the Polymarket example repo does it
  // ============================================================
  console.log('\n\n=== TEST: Direct post to Polymarket CLOB ===');
  console.log('The Polymarket Safe trader example posts directly to CLOB');
  console.log("Let's see if that works vs going through Dome");

  try {
    const directClobClient = new ClobClient(
      'https://clob.polymarket.com',
      137,
      ethersAdapter as any,
      creds,
      2, // signatureType for Safe
      safeAddress // funder = Safe
    );

    console.log('\nPosting order directly to Polymarket CLOB...');
    const directOrder = await directClobClient.createAndPostOrder(
      {
        tokenID: tokenId,
        price: 0.01,
        side: 'BUY' as any,
        size: 100,
      },
      { tickSize: '0.01', negRisk: false }
    );

    console.log('\n✅ DIRECT ORDER SUCCEEDED!');
    console.log('Order:', JSON.stringify(directOrder, null, 2));
    console.log(
      '\nThis confirms the issue is in how Dome forwards orders, not the credentials.'
    );
  } catch (error: any) {
    console.error('\n❌ Direct post also failed:', error.message);
    if (
      error.message.includes('Unauthorized') ||
      error.message.includes('api key')
    ) {
      console.log('   Same error - credentials issue affects both routes');
    } else if (error.message.includes('403')) {
      console.log('   403 error - likely geo-blocking from Polymarket');
    } else {
      console.log('   Different error - might indicate something else');
    }
  }

  // ============================================================
  // KEY FIX: Use Safe address for POLY_ADDRESS header
  // polymarket.com uses the Safe address, not EOA, for API key registration
  // ============================================================
  console.log('\n\n=== KEY FIX: Use Safe address for API key operations ===');
  console.log(
    'The issue: POLY_ADDRESS header is set to EOA, but should be Safe'
  );
  console.log('polymarket.com registers API keys against the Safe address');

  // Create an adapter that returns SAFE address for getAddress()
  // but still signs with the EOA private key
  const safeAddressAdapter = {
    getAddress: async () => {
      console.log('   [SafeAdapter] getAddress() returning SAFE:', safeAddress);
      return safeAddress; // Return Safe address for POLY_ADDRESS header
    },
    _signTypedData: async (domain: any, types: any, value: any) => {
      console.log('   [SafeAdapter] Signing with EOA:', eoaAddress);
      // Still sign with the EOA wallet
      const sig = await wallet._signTypedData(domain, types, value);
      return sig;
    },
  };

  // Create CLOB client with Safe address adapter
  const clobClientSafeAddr = new ClobClient(
    'https://clob.polymarket.com',
    137,
    safeAddressAdapter as any,
    undefined,
    2, // signatureType = 2 for Safe
    safeAddress // funderAddress = Safe
  );

  try {
    console.log(
      '\nDeriving API key with SAFE address in POLY_ADDRESS header...'
    );
    const safeAddrCreds = await clobClientSafeAddr.deriveApiKey();
    console.log('\n✅ API Key derived with Safe address:');
    console.log('   API Key:', safeAddrCreds.key);
    console.log('   Secret:', `${safeAddrCreds.secret.slice(0, 20)}...`);

    // Compare with EOA-derived key
    console.log('\n=== Credential Comparison ===');
    console.log('EOA address key:  ', creds.key);
    console.log('Safe address key: ', safeAddrCreds.key);

    if (creds.key !== safeAddrCreds.key) {
      console.log('\n🔴 DIFFERENT API KEYS! This confirms the issue.');
      console.log('   API keys are registered per-address.');
      console.log(
        '   For Safe wallets, must use Safe address in POLY_ADDRESS.'
      );
    }

    // Now try order with Safe-address credentials
    console.log('\n--- Trying order with Safe-address credentials ---');
    const clobClientWithSafeCreds = new ClobClient(
      'https://clob.polymarket.com',
      137,
      safeAddressAdapter as any,
      safeAddrCreds,
      2,
      safeAddress
    );

    const safeCredsSignedOrder = await clobClientWithSafeCreds.createOrder(
      {
        tokenID: tokenId,
        price: 0.01,
        side: 'BUY' as any,
        size: 100,
      },
      { tickSize: '0.01', negRisk: false }
    );

    const safeCreadsSideString =
      safeCredsSignedOrder.side === 0 ? 'BUY' : 'SELL';
    const safeCredsRequestBody = {
      jsonrpc: '2.0',
      method: 'placeOrder',
      id: crypto.randomUUID?.() || `${Date.now()}`,
      params: {
        signedOrder: { ...safeCredsSignedOrder, side: safeCreadsSideString },
        orderType: 'GTC',
        credentials: {
          apiKey: safeAddrCreds.key,
          apiSecret: safeAddrCreds.secret,
          apiPassphrase: safeAddrCreds.passphrase,
        },
        clientOrderId: crypto.randomUUID?.() || `${Date.now()}`,
      },
    };

    console.log(
      'Request with Safe-address creds:',
      JSON.stringify(safeCredsRequestBody, null, 2)
    );

    const safeCredsResponse = await fetch(
      `${DOME_API_ENDPOINT}/polymarket/placeOrder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${domeApiKey}`,
        },
        body: JSON.stringify(safeCredsRequestBody),
      }
    );

    const safeCredsResponseText = await safeCredsResponse.text();
    console.log(
      '\nSafe-address creds response status:',
      safeCredsResponse.status
    );
    console.log('Safe-address creds response body:', safeCredsResponseText);
  } catch (error: any) {
    console.error('❌ Safe address approach failed:', error.message);
  }

  // ============================================================
  // SOLUTION: Use SDK's linkUser method for Safe wallets
  // This properly registers credentials with Polymarket
  // ============================================================
  console.log('\n\n=== SOLUTION: Using SDK linkUser for Safe wallet ===');

  // Create RouterSigner from wallet
  const routerSigner: RouterSigner = {
    getAddress: async () => eoaAddress,
    signTypedData: async payload => {
      const filteredTypes = { ...payload.types };
      delete (filteredTypes as any)['EIP712Domain'];
      const sig = await wallet._signTypedData(
        payload.domain,
        filteredTypes,
        payload.message
      );
      console.log('   [SDK Signer] Signed typed data');
      return sig;
    },
  };

  const router = new PolymarketRouter({
    chainId: 137,
    apiKey: domeApiKey,
  });

  try {
    console.log('Linking user with Safe wallet via SDK...');
    const linkResult = await router.linkUser({
      userId: `wc-${eoaAddress.slice(2, 10)}`,
      signer: routerSigner,
      walletType: 'safe',
      autoDeploySafe: false,
      autoSetAllowances: false,
    });

    console.log('\n✅ Link result:');
    console.log('   Safe Address:', linkResult.safeAddress);
    console.log('   Signer Address:', linkResult.signerAddress);
    console.log('   API Key:', linkResult.credentials.apiKey);

    // Now place order using SDK
    console.log('\n--- Placing order via SDK ---');
    const sdkOrder = await router.placeOrder(
      {
        userId: `wc-${eoaAddress.slice(2, 10)}`,
        marketId: tokenId,
        side: 'buy',
        size: 100, // $1 minimum at 0.01 price
        price: 0.01,
        orderType: 'GTC',
        signer: routerSigner,
        walletType: 'safe',
        funderAddress: linkResult.safeAddress,
      },
      linkResult.credentials
    );

    console.log('\n✅ SDK Order placed successfully!');
    console.log('Order:', JSON.stringify(sdkOrder, null, 2));
  } catch (error: any) {
    console.error('\n❌ SDK method also failed:', error.message);

    // Additional debug info
    if (
      error.message.includes('Unauthorized') ||
      error.message.includes('api key')
    ) {
      console.log('\n=== Debug: API Key Authorization Issue ===');
      console.log(
        'The API credentials may not be registered with Polymarket for this Safe.'
      );
      console.log('This can happen if:');
      console.log('1. The Safe was never registered with Polymarket');
      console.log('2. Using deriveApiKey instead of createApiKey');
      console.log('3. The credentials were derived with wrong parameters');
    }
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
