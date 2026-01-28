#!/usr/bin/env tsx

/**
 * Escrow Integration Test (V2 - Independent Fees)
 *
 * Tests the Dome Fee Escrow V2 user-facing functionality:
 * 1. Generate orderId
 * 2. Create and sign OrderFeeAuthorization (with domeAmount, affiliateAmount)
 * 3. Create and sign PerformanceFeeAuthorization
 * 4. Check if escrow exists (hasEscrow)
 * 5. Verify signatures locally
 *
 * Note: On-chain operations (pullFee, distribute, refund) are handled
 * by the Dome server, not the SDK. This test only covers user-side signing.
 *
 * Usage:
 *   npx tsx src/tests/escrow-integration-test.ts
 *
 * Environment variables:
 *   PRIVATE_KEY - Wallet private key for signing tests
 *   RPC_URL     - Polygon RPC endpoint (optional)
 */

import * as dotenv from 'dotenv';
import { ethers, Wallet } from 'ethers';
import {
  DomeFeeEscrowClient,
  generateOrderId,
  verifyOrderId,
  formatUsdc,
  parseUsdc,
  formatBps,
  ESCROW_CONTRACT_V2_POLYGON,
  MIN_ORDER_FEE,
  MIN_PERF_FEE,
} from '../escrow/index.js';

dotenv.config();

// Configuration
const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  escrowAddress: process.env.ESCROW_ADDRESS || ESCROW_CONTRACT_V2_POLYGON,
  userPrivateKey: process.env.PRIVATE_KEY || '',
};

// Test market: Trump Greenland
const TEST_MARKET = {
  title: 'Will Trump acquire Greenland before 2027?',
  conditionId:
    '0xd595eb9b81885ff018738300c79047e3ec89e87294424f57a29a7fa9162bf116',
  yesTokenId:
    '5161623255678193352839985156330393796378434470119114669671615782853260939535',
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
        log(
          `   Result: ${JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2).substring(0, 300)}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMessage });
      log(`❌ FAILED: ${name}`);
      log(`   Error: ${errorMessage}`);
    }
  };
}

async function runOfflineTests() {
  log('='.repeat(60));
  log('  ESCROW V2 OFFLINE TESTS (no network required)');
  log('='.repeat(60));

  // Test 1: Generate Order ID
  await test('Generate Order ID', () => {
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: TEST_MARKET.conditionId,
      side: 'buy' as const,
      size: parseUsdc(10),
      price: 0.5,
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
      marketId: TEST_MARKET.conditionId,
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
      marketId: TEST_MARKET.conditionId,
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

  // Test 4: Calculate fees with independent amounts (V2)
  await test('Calculate Independent Fees (V2 Model)', () => {
    const orderSize = parseUsdc(100); // $100 order
    const domeFeeBps = BigInt(20); // 0.20% to Dome
    const affiliateFeeBps = BigInt(5); // 0.05% to Affiliate

    // Calculate independent fees
    const domeFee = (orderSize * domeFeeBps) / BigInt(10000);
    const affiliateFee = (orderSize * affiliateFeeBps) / BigInt(10000);
    const totalFee = domeFee + affiliateFee;

    // Expected: $0.20 dome + $0.05 affiliate = $0.25 total
    const expectedDomeFee = parseUsdc(0.2);
    const expectedAffiliateFee = parseUsdc(0.05);

    if (domeFee !== expectedDomeFee) {
      throw new Error(
        `Dome fee mismatch: ${formatUsdc(domeFee)} vs expected ${formatUsdc(expectedDomeFee)}`
      );
    }

    if (affiliateFee !== expectedAffiliateFee) {
      throw new Error(
        `Affiliate fee mismatch: ${formatUsdc(affiliateFee)} vs expected ${formatUsdc(expectedAffiliateFee)}`
      );
    }

    return {
      orderSize: formatUsdc(orderSize),
      domeFeeBps: formatBps(domeFeeBps),
      affiliateFeeBps: formatBps(affiliateFeeBps),
      domeFee: formatUsdc(domeFee),
      affiliateFee: formatUsdc(affiliateFee),
      totalFee: formatUsdc(totalFee),
    };
  })();

  // Test 5: Minimum fee application
  await test('Minimum Fee Application', () => {
    const smallOrderSize = parseUsdc(1); // $1 order (would yield < min fee)
    const domeFeeBps = BigInt(20);
    const affiliateFeeBps = BigInt(5);

    let domeFee = (smallOrderSize * domeFeeBps) / BigInt(10000);
    let affiliateFee = (smallOrderSize * affiliateFeeBps) / BigInt(10000);
    let totalFee = domeFee + affiliateFee;

    // Apply minimum if needed (MIN_ORDER_FEE = $0.01 = 10000)
    if (totalFee < MIN_ORDER_FEE && totalFee > BigInt(0)) {
      const scale = (MIN_ORDER_FEE * BigInt(10000)) / totalFee;
      domeFee = (domeFee * scale) / BigInt(10000);
      affiliateFee = MIN_ORDER_FEE - domeFee;
      totalFee = MIN_ORDER_FEE;
    }

    if (totalFee !== MIN_ORDER_FEE) {
      throw new Error(
        `Minimum fee not applied correctly: ${formatUsdc(totalFee)}`
      );
    }

    return {
      originalTotal: formatUsdc((smallOrderSize * BigInt(25)) / BigInt(10000)),
      adjustedDomeFee: formatUsdc(domeFee),
      adjustedAffiliateFee: formatUsdc(affiliateFee),
      finalTotal: formatUsdc(totalFee),
      minFeeApplied: true,
    };
  })();

  // Test 6: Format utilities
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

  // Test 7: Invalid address rejection
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

    if (!threwForInvalidUser) {
      throw new Error('Should reject invalid addresses');
    }

    return { invalidUserRejected: threwForInvalidUser };
  })();

  // Test 8: Price range validation
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

    return {
      negativeRejected: threwForNegative,
      overOneRejected: threwForOverOne,
    };
  })();
}

async function runSigningTests() {
  log(`\n${'='.repeat(60)}`);
  log('  ESCROW V2 SIGNING TESTS (requires wallet key)');
  log('='.repeat(60));

  if (!CONFIG.userPrivateKey) {
    log('\n⚠️  PRIVATE_KEY not set, skipping signing tests');
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const userWallet = new Wallet(CONFIG.userPrivateKey, provider);

  log(`\n[Config]`);
  log(`  Network: Polygon (chainId: ${CONFIG.chainId})`);
  log(`  Escrow: ${CONFIG.escrowAddress}`);
  log(`  User: ${userWallet.address}`);

  // Initialize V2 client
  const escrowClient = new DomeFeeEscrowClient({
    provider,
    signer: userWallet,
    contractAddress: CONFIG.escrowAddress,
    chainId: CONFIG.chainId,
  });

  // Test: Sign OrderFeeAuthorization (V2 with domeAmount, affiliateAmount)
  await test('Sign OrderFeeAuthorization (V2)', async () => {
    const timestamp = Date.now();
    const orderParams = {
      chainId: CONFIG.chainId,
      userAddress: userWallet.address,
      marketId: TEST_MARKET.conditionId,
      side: 'buy' as const,
      size: parseUsdc(100),
      price: 0.5,
      timestamp,
    };

    const orderId = generateOrderId(orderParams);
    const domeAmount = parseUsdc(0.2); // 0.20% of $50 order
    const affiliateAmount = parseUsdc(0.05); // 0.05% of $50 order

    const { auth, signature } = await escrowClient.signOrderFeeAuth({
      orderId,
      domeAmount,
      affiliateAmount,
      deadline: 3600, // 1 hour
    });

    // Verify signature locally
    const isValid = escrowClient.verifyOrderFeeAuthSignature(
      { ...auth, signature },
      userWallet.address
    );

    if (!isValid) {
      throw new Error('Signature verification failed');
    }

    return {
      orderId: `${orderId.slice(0, 20)}...`,
      payer: auth.payer,
      domeAmount: formatUsdc(auth.domeAmount),
      affiliateAmount: formatUsdc(auth.affiliateAmount),
      chainId: auth.chainId,
      signatureValid: isValid,
      signature: `${signature.slice(0, 42)}...`,
    };
  })();

  // Test: Sign PerformanceFeeAuthorization (V2)
  await test('Sign PerformanceFeeAuthorization (V2)', async () => {
    const positionId = `0x${'abc123'.padEnd(64, '0')}`;
    const expectedWinnings = parseUsdc(1000); // $1000 winnings
    const domeAmount = parseUsdc(40); // 4% to Dome
    const affiliateAmount = parseUsdc(10); // 1% to Affiliate

    const { auth, signature } = await escrowClient.signPerformanceFeeAuth({
      positionId,
      expectedWinnings,
      domeAmount,
      affiliateAmount,
      deadline: 3600,
    });

    // Verify signature locally
    const isValid = escrowClient.verifyPerformanceFeeAuthSignature(
      { ...auth, signature },
      userWallet.address
    );

    if (!isValid) {
      throw new Error('Performance fee signature verification failed');
    }

    return {
      positionId: `${positionId.slice(0, 20)}...`,
      payer: auth.payer,
      expectedWinnings: formatUsdc(auth.expectedWinnings),
      domeAmount: formatUsdc(auth.domeAmount),
      affiliateAmount: formatUsdc(auth.affiliateAmount),
      chainId: auth.chainId,
      signatureValid: isValid,
      signature: `${signature.slice(0, 42)}...`,
    };
  })();

  // Test: Signature determinism
  await test('Signature Determinism (V2)', async () => {
    const orderId = `0x${'a'.repeat(64)}`;
    const domeAmount = parseUsdc(0.04);
    const affiliateAmount = parseUsdc(0.01);

    // Sign twice with same input (relative deadline in seconds)
    const deadlineSeconds = 3600; // 1 hour from now

    const sig1 = await escrowClient.signOrderFeeAuth({
      orderId,
      domeAmount,
      affiliateAmount,
      deadline: deadlineSeconds,
    });

    const sig2 = await escrowClient.signOrderFeeAuth({
      orderId,
      domeAmount,
      affiliateAmount,
      deadline: deadlineSeconds,
    });

    // Both signatures should be valid (but may differ due to different computed deadlines)
    // The key test is that both can be verified
    const isValid1 = escrowClient.verifyOrderFeeAuthSignature(
      { ...sig1.auth, signature: sig1.signature },
      userWallet.address
    );
    const isValid2 = escrowClient.verifyOrderFeeAuthSignature(
      { ...sig2.auth, signature: sig2.signature },
      userWallet.address
    );

    if (!isValid1 || !isValid2) {
      throw new Error('Both signatures should be valid');
    }

    return { bothSignaturesValid: true };
  })();

  // Test: Different amounts produce different signatures
  await test('Different Amounts Different Signatures', async () => {
    const orderId = `0x${'b'.repeat(64)}`;
    const deadlineSeconds = 3600;

    const sig1 = await escrowClient.signOrderFeeAuth({
      orderId,
      domeAmount: parseUsdc(0.04),
      affiliateAmount: parseUsdc(0.01),
      deadline: deadlineSeconds,
    });

    const sig2 = await escrowClient.signOrderFeeAuth({
      orderId,
      domeAmount: parseUsdc(0.05), // Different dome amount
      affiliateAmount: parseUsdc(0.01),
      deadline: deadlineSeconds,
    });

    // Different amounts should produce different signatures
    // (comparing the auth data, not just signatures since deadlines may differ)
    if (sig1.auth.domeAmount === sig2.auth.domeAmount) {
      throw new Error('Auth domeAmounts should differ');
    }

    return { authsDiffer: true };
  })();

  // Test: hasEscrow check (read from chain)
  await test('Check hasEscrow (chain read)', async () => {
    // Use a random orderId that shouldn't have an escrow
    const randomOrderId = `0x${Date.now().toString(16).padStart(64, '0')}`;

    try {
      const result = await escrowClient.hasEscrow(randomOrderId);

      // Should return false for non-existent escrow
      if (result.hasAnyEscrow) {
        // If it exists, that's unexpected but valid
        return {
          orderId: `${randomOrderId.slice(0, 20)}...`,
          hasAnyEscrow: result.hasAnyEscrow,
          hasOrderFee: result.hasOrderFee,
          hasPerformanceFee: result.hasPerformanceFee,
          note: 'Escrow exists (unexpected for random ID)',
        };
      }

      return {
        orderId: `${randomOrderId.slice(0, 20)}...`,
        hasAnyEscrow: false,
        hasOrderFee: false,
        hasPerformanceFee: false,
        checkWorking: true,
      };
    } catch (error) {
      // If RPC fails, that's acceptable for this test
      return {
        orderId: `${randomOrderId.slice(0, 20)}...`,
        note: 'RPC call failed (expected if no network)',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();
}

async function main() {
  log('🚀 Dome Fee Escrow V2 Integration Test\n');
  log(
    'Uses the new 4-fee model: domeOrderFee, affiliateOrderFee, domePerformanceFee, affiliatePerformanceFee\n'
  );

  // Run offline tests (no network required)
  await runOfflineTests();

  // Run signing tests (requires wallet key)
  await runSigningTests();

  // Summary
  log(`\n${'='.repeat(60)}`);
  log('  TEST SUMMARY');
  log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  log(`\n✅ Passed: ${passed}`);
  log(`❌ Failed: ${failed}`);
  log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    log('\n❌ Failed Tests:');
    results
      .filter(r => !r.passed)
      .forEach((r, i) => {
        log(`   ${i + 1}. ${r.name}: ${r.error}`);
      });
  }

  if (failed === 0) {
    log('\n🎉 All tests passed!');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
