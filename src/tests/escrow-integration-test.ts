#!/usr/bin/env tsx

/**
 * Escrow Integration Test
 *
 * Tests the Dome Fee Escrow user-facing functionality:
 * 1. Generate orderId
 * 2. Create fee authorization
 * 3. Sign authorization (EIP-712)
 * 4. Verify signature locally
 *
 * Note: On-chain operations (pullFee, distribute, refund) are handled
 * by the Dome server, not the SDK. This test only covers user-side signing.
 *
 * Usage:
 *   npx tsx src/tests/escrow-integration-test.ts
 */

import * as dotenv from 'dotenv';
import { ethers, Wallet } from 'ethers';
import {
  generateOrderId,
  verifyOrderId,
  createFeeAuthorization,
  signFeeAuthorization,
  verifyFeeAuthorizationSignature,
  formatUsdc,
  parseUsdc,
  formatBps,
  calculateFee,
  ESCROW_CONTRACT_POLYGON,
} from '../escrow/index.js';

dotenv.config();

// Configuration
const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  escrowAddress: process.env.ESCROW_ADDRESS || ESCROW_CONTRACT_POLYGON,
  userPrivateKey: process.env.USER_PRIVATE_KEY || '',
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
}

function test(name: string, fn: () => any | Promise<any>) {
  return async () => {
    try {
      log(`\n📋 Testing: ${name}`);
      const result = await fn();
      results.push({ name, passed: true, details: result });
      log(`✅ PASSED: ${name}`);
      if (result) {
        log(`   Result: ${JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2).substring(0, 200)}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMessage });
      log(`❌ FAILED: ${name}`);
      log(`   Error: ${errorMessage}`);
    }
  };
}

async function runOfflineTests() {
  log('='.repeat(60));
  log('  ESCROW OFFLINE TESTS (no network required)');
  log('='.repeat(60));

  // Test 1: Generate Order ID
  await test('Generate Order ID', () => {
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'test-market-12345',
      side: 'buy' as const,
      size: parseUsdc(10),
      price: 0.50,
      timestamp: Date.now(),
    };

    const orderId = generateOrderId(params);

    if (!orderId.startsWith('0x') || orderId.length !== 66) {
      throw new Error(`Invalid orderId format: ${orderId}`);
    }

    return { orderId, params: { ...params, size: params.size.toString() } };
  })();

  // Test 2: Verify Order ID
  await test('Verify Order ID', () => {
    const timestamp = Date.now();
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'test-market-verify',
      side: 'buy' as const,
      size: parseUsdc(25),
      price: 0.75,
      timestamp,
    };

    const orderId = generateOrderId(params);
    const isValid = verifyOrderId(orderId, params);

    if (!isValid) {
      throw new Error('Order ID verification failed');
    }

    // Test with wrong params
    const wrongParams = { ...params, price: 0.76 };
    const shouldBeInvalid = verifyOrderId(orderId, wrongParams);

    if (shouldBeInvalid) {
      throw new Error('Should have rejected mismatched params');
    }

    return { orderId, verified: true };
  })();

  // Test 3: Order ID determinism
  await test('Order ID Determinism', () => {
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'determinism-test',
      side: 'sell' as const,
      size: parseUsdc(100),
      price: 0.33,
      timestamp: 1705432800000,
    };

    const orderId1 = generateOrderId(params);
    const orderId2 = generateOrderId(params);

    if (orderId1 !== orderId2) {
      throw new Error('Order IDs should be deterministic');
    }

    return { orderId1, orderId2, match: orderId1 === orderId2 };
  })();

  // Test 4: Create Fee Authorization
  await test('Create Fee Authorization', () => {
    const orderId = '0x' + '1'.repeat(64);
    const payer = '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f';
    const feeAmount = parseUsdc(0.025); // $0.025 fee

    const feeAuth = createFeeAuthorization(orderId, payer, feeAmount, 3600);

    if (feeAuth.orderId !== orderId) {
      throw new Error('OrderId mismatch');
    }
    if (feeAuth.payer.toLowerCase() !== payer.toLowerCase()) {
      throw new Error('Payer mismatch');
    }
    if (feeAuth.feeAmount !== feeAmount) {
      throw new Error('Fee amount mismatch');
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    if (feeAuth.deadline < now || feeAuth.deadline > now + BigInt(3700)) {
      throw new Error('Deadline out of expected range');
    }

    return {
      orderId: feeAuth.orderId,
      payer: feeAuth.payer,
      feeAmount: feeAuth.feeAmount.toString(),
      deadline: feeAuth.deadline.toString(),
    };
  })();

  // Test 5: Fee Authorization deadline bounds
  await test('Fee Authorization Deadline Bounds', () => {
    const orderId = '0x' + '2'.repeat(64);
    const payer = '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f';
    const feeAmount = parseUsdc(0.01);

    // Test too short deadline
    let threwForShort = false;
    try {
      createFeeAuthorization(orderId, payer, feeAmount, 30); // 30 seconds
    } catch (e) {
      threwForShort = true;
    }

    // Test too long deadline
    let threwForLong = false;
    try {
      createFeeAuthorization(orderId, payer, feeAmount, 100000); // ~27 hours
    } catch (e) {
      threwForLong = true;
    }

    if (!threwForShort || !threwForLong) {
      throw new Error('Should enforce deadline bounds');
    }

    return { shortDeadlineRejected: threwForShort, longDeadlineRejected: threwForLong };
  })();

  // Test 6: Calculate Fee
  await test('Calculate Fee', () => {
    const orderSize = parseUsdc(100); // $100
    const feeBps = BigInt(25); // 0.25%

    const fee = calculateFee(orderSize, feeBps);
    const expectedFee = parseUsdc(0.25); // $0.25

    if (fee !== expectedFee) {
      throw new Error(`Fee mismatch: ${formatUsdc(fee)} vs expected ${formatUsdc(expectedFee)}`);
    }

    return {
      orderSize: formatUsdc(orderSize),
      feeBps: formatBps(feeBps),
      fee: formatUsdc(fee),
    };
  })();

  // Test 7: Format utilities
  await test('Format Utilities', () => {
    const usdc = parseUsdc(1234.56);
    const formatted = formatUsdc(usdc);
    if (formatted !== '1234.56') {
      throw new Error(`Format mismatch: ${formatted}`);
    }

    const bps = formatBps(BigInt(25));
    if (bps !== '0.25%') {
      throw new Error(`BPS format mismatch: ${bps}`);
    }

    return { usdc: formatted, bps };
  })();

  // Test 8: Invalid address rejection
  await test('Invalid Address Rejection', () => {
    let threwForInvalidUser = false;
    try {
      generateOrderId({
        chainId: 137,
        userAddress: 'invalid-address',
        marketId: 'test',
        side: 'buy',
        size: parseUsdc(10),
        price: 0.5,
        timestamp: Date.now(),
      });
    } catch (e) {
      threwForInvalidUser = true;
    }

    let threwForInvalidPayer = false;
    try {
      createFeeAuthorization('0x' + '1'.repeat(64), 'not-an-address', parseUsdc(0.01));
    } catch (e) {
      threwForInvalidPayer = true;
    }

    if (!threwForInvalidUser || !threwForInvalidPayer) {
      throw new Error('Should reject invalid addresses');
    }

    return { invalidUserRejected: threwForInvalidUser, invalidPayerRejected: threwForInvalidPayer };
  })();

  // Test 9: Price range validation
  await test('Price Range Validation', () => {
    const baseParams = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'test',
      side: 'buy' as const,
      size: parseUsdc(10),
      timestamp: Date.now(),
    };

    let threwForNegative = false;
    try {
      generateOrderId({ ...baseParams, price: -0.1 });
    } catch (e) {
      threwForNegative = true;
    }

    let threwForOverOne = false;
    try {
      generateOrderId({ ...baseParams, price: 1.1 });
    } catch (e) {
      threwForOverOne = true;
    }

    // Valid edge cases
    generateOrderId({ ...baseParams, price: 0 });
    generateOrderId({ ...baseParams, price: 1 });
    generateOrderId({ ...baseParams, price: 0.5 });

    if (!threwForNegative || !threwForOverOne) {
      throw new Error('Should reject prices outside [0, 1]');
    }

    return { negativeRejected: threwForNegative, overOneRejected: threwForOverOne };
  })();
}

async function runSigningTests() {
  log('\n' + '='.repeat(60));
  log('  ESCROW SIGNING TESTS (requires wallet key)');
  log('='.repeat(60));

  if (!CONFIG.userPrivateKey) {
    log('\n⚠️  USER_PRIVATE_KEY not set, skipping signing tests');
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const userWallet = new Wallet(CONFIG.userPrivateKey, provider);

  log(`\n[Config]`);
  log(`  Network: Polygon (chainId: ${CONFIG.chainId})`);
  log(`  Escrow: ${CONFIG.escrowAddress}`);
  log(`  User: ${userWallet.address}`);

  // Test: Sign and verify fee authorization
  await test('Sign and Verify Fee Authorization', async () => {
    const timestamp = Date.now();
    const orderParams = {
      chainId: CONFIG.chainId,
      userAddress: userWallet.address,
      marketId: 'escrow-test-' + timestamp,
      side: 'buy' as const,
      size: parseUsdc(10),
      price: 0.50,
      timestamp,
    };

    const orderId = generateOrderId(orderParams);
    const feeAmount = calculateFee(orderParams.size, BigInt(25)); // 0.25% fee
    const feeAuth = createFeeAuthorization(orderId, userWallet.address, feeAmount);

    const signedAuth = await signFeeAuthorization(
      userWallet,
      CONFIG.escrowAddress,
      feeAuth,
      CONFIG.chainId
    );

    // Verify signature locally
    const isValid = verifyFeeAuthorizationSignature(
      signedAuth,
      CONFIG.escrowAddress,
      CONFIG.chainId,
      userWallet.address
    );

    if (!isValid) {
      throw new Error('Signature verification failed');
    }

    return {
      orderId,
      feeAmount: formatUsdc(feeAmount),
      signatureValid: isValid,
      signature: signedAuth.signature.slice(0, 42) + '...',
    };
  })();

  // Test: Signature is deterministic for same input
  await test('Signature Determinism', async () => {
    const orderId = '0x' + 'a'.repeat(64);
    const feeAmount = parseUsdc(0.05);
    const feeAuth = createFeeAuthorization(orderId, userWallet.address, feeAmount, 3600);

    // Sign twice with same input
    const sig1 = await signFeeAuthorization(userWallet, CONFIG.escrowAddress, feeAuth, CONFIG.chainId);
    const sig2 = await signFeeAuthorization(userWallet, CONFIG.escrowAddress, feeAuth, CONFIG.chainId);

    // Signatures should be identical (deterministic ECDSA)
    if (sig1.signature !== sig2.signature) {
      throw new Error('Signatures should be deterministic');
    }

    return { signaturesMatch: true };
  })();

  // Test: Different orderId produces different signature
  await test('Different OrderId Different Signature', async () => {
    const feeAmount = parseUsdc(0.05);

    const feeAuth1 = createFeeAuthorization('0x' + 'b'.repeat(64), userWallet.address, feeAmount);
    const feeAuth2 = createFeeAuthorization('0x' + 'c'.repeat(64), userWallet.address, feeAmount);

    const sig1 = await signFeeAuthorization(userWallet, CONFIG.escrowAddress, feeAuth1, CONFIG.chainId);
    const sig2 = await signFeeAuthorization(userWallet, CONFIG.escrowAddress, feeAuth2, CONFIG.chainId);

    if (sig1.signature === sig2.signature) {
      throw new Error('Different orderIds should produce different signatures');
    }

    return { signaturesDiffer: true };
  })();
}

async function main() {
  log('🚀 Dome Fee Escrow Integration Test\n');

  // Run offline tests (no network required)
  await runOfflineTests();

  // Run signing tests (requires wallet key)
  await runSigningTests();

  // Summary
  log('\n' + '='.repeat(60));
  log('  TEST SUMMARY');
  log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  log(`\n✅ Passed: ${passed}`);
  log(`❌ Failed: ${failed}`);
  log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach((r, i) => {
      log(`   ${i + 1}. ${r.name}: ${r.error}`);
    });
  }

  if (failed === 0) {
    log('\n🎉 All tests passed!');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
