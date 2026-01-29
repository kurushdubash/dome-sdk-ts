#!/usr/bin/env npx tsx

/**
 * Permit Integration Test
 *
 * Tests the Dome Fee Escrow permit-based functionality:
 * 1. Generate orderId for pullFee
 * 2. Calculate fee amounts
 * 3. Sign EIP-2612 permit
 * 4. Verify permit parameters locally
 *
 * Note: The actual pullFee() contract call requires OPERATOR_ROLE
 * and is executed by Dome infrastructure. This test covers the
 * user-side permit signing workflow.
 *
 * Usage:
 *   npx tsx src/tests/permit-integration-test.ts
 */

import * as dotenv from 'dotenv';
import { ethers, Wallet, Contract } from 'ethers';
import {
  generateOrderId,
  verifyOrderId,
  signPermit,
  getPermitNonce,
  createPermitDomain,
  formatUsdc,
  parseUsdc,
  calculateFees,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
} from '../escrow/index.js';

dotenv.config();

// Configuration
const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  escrowAddress: process.env.ESCROW_ADDRESS || ESCROW_CONTRACT_POLYGON,
  usdcAddress: process.env.USDC_ADDRESS || USDC_POLYGON,
  userPrivateKey: process.env.USER_PRIVATE_KEY || process.env.PRIVATE_KEY || '',
};

// Minimal ABI for reading contract constants
const ESCROW_ABI = [
  'function domeFeeBps() view returns (uint256)',
  'function minDomeFee() view returns (uint256)',
];

// Contract fee configuration (fetched at runtime)
let contractDomeFeeBps: bigint;
let contractMinDomeFee: bigint;

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
  log('  PERMIT TESTS (with contract fee config)');
  log('='.repeat(60));

  // Fetch fee configuration from contract
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, provider);

  try {
    log('\n📡 Fetching fee configuration from contract...');
    const [domeFeeBps, minDomeFee] = await Promise.all([
      escrow.domeFeeBps(),
      escrow.minDomeFee(),
    ]);
    
    contractDomeFeeBps = BigInt(domeFeeBps.toString());
    contractMinDomeFee = BigInt(minDomeFee.toString());
    
    log(`✅ Dome fee: ${contractDomeFeeBps} bps (${Number(contractDomeFeeBps) / 100}%)`);
    log(`✅ Min dome fee: ${formatUsdc(contractMinDomeFee)} USDC`);
  } catch (error) {
    log(`❌ Failed to fetch from contract: ${error instanceof Error ? error.message : String(error)}`);
    log('⚠️  Falling back to default values (10 bps, $0.01)');
    contractDomeFeeBps = 10n;
    contractMinDomeFee = 10_000n;
  }

  // Test 1: Generate Order ID for pullFee
  await test('Generate Order ID for PullFee', () => {
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'pullfee-test-12345',
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

  // Test 2: Verify Order ID matches params
  await test('Verify Order ID Matches Params', () => {
    const timestamp = Date.now();
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'permit-verify-test',
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

    // Verify mismatch detection
    const wrongParams = { ...params, price: 0.76 };
    const shouldBeInvalid = verifyOrderId(orderId, wrongParams);

    if (shouldBeInvalid) {
      throw new Error('Should have detected param mismatch');
    }

    return { orderId, verified: true };
  })();

  // Test 3: Order ID consistency
  await test('Order ID Consistency', () => {
    const params = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'consistency-check',
      side: 'sell' as const,
      size: parseUsdc(100),
      price: 0.33,
      timestamp: 1705432800000,
    };

    const orderId1 = generateOrderId(params);
    const orderId2 = generateOrderId(params);

    if (orderId1 !== orderId2) {
      throw new Error('Order IDs should be consistent for same inputs');
    }

    return { orderId1, orderId2, match: orderId1 === orderId2 };
  })();

  // Test 4: Calculate Fees for PullFee
  await test('Calculate Fees for PullFee', () => {
    const orderSize = parseUsdc(100); // $100 order
    const clientFeeBps = 50n; // 0.50% client fee

    const fees = calculateFees(orderSize, clientFeeBps, contractDomeFeeBps, contractMinDomeFee);

    if (fees.domeFee <= BigInt(0)) {
      throw new Error('Dome fee should be positive');
    }

    if (fees.totalFee !== fees.domeFee + fees.clientFee) {
      throw new Error('Total fee should equal dome + client fees');
    }

    return {
      orderSize: formatUsdc(orderSize),
      domeFee: formatUsdc(fees.domeFee),
      clientFee: formatUsdc(fees.clientFee),
      totalFee: formatUsdc(fees.totalFee),
    };
  })();

  // Test 5: Zero client fee calculation
  await test('Zero Client Fee Calculation', () => {
    const orderSize = parseUsdc(50); // $50 order
    const clientFeeBps = 0n; // No affiliate

    const fees = calculateFees(orderSize, clientFeeBps, contractDomeFeeBps, contractMinDomeFee);

    if (fees.clientFee !== BigInt(0)) {
      throw new Error('Client fee should be zero');
    }

    if (fees.totalFee !== fees.domeFee) {
      throw new Error('Total should equal dome fee when no client fee');
    }

    return {
      orderSize: formatUsdc(orderSize),
      totalFee: formatUsdc(fees.totalFee),
      clientFeeIsZero: fees.clientFee === BigInt(0),
    };
  })();

  // Test 6: USDC formatting utilities
  await test('USDC Formatting Utilities', () => {
    const amount = parseUsdc(1234.56);
    const formatted = formatUsdc(amount);

    if (formatted !== '1234.56') {
      throw new Error(`Format mismatch: got ${formatted}, expected 1234.56`);
    }

    // Test small amounts (fee-sized)
    const smallAmount = parseUsdc(0.025);
    const smallFormatted = formatUsdc(smallAmount);

    if (!smallFormatted.includes('0.025')) {
      throw new Error(`Small amount format issue: ${smallFormatted}`);
    }

    return { amount: formatted, smallAmount: smallFormatted };
  })();

  // Test 7: Permit domain creation
  await test('Permit Domain Creation', () => {
    const domain = createPermitDomain(USDC_POLYGON, 137);

    // USDC.e (PoS) on Polygon uses 'USD Coin (PoS)' as the domain name
    if (!domain.name || domain.name !== 'USD Coin (PoS)') {
      throw new Error(`Domain name should be 'USD Coin (PoS)' for USDC.e on Polygon, got: ${domain.name}`);
    }

    // Polygon USDC uses salt instead of chainId for EIP-712 domain
    if (!domain.salt) {
      throw new Error('Domain should have salt for Polygon USDC');
    }

    if (domain.verifyingContract?.toLowerCase() !== USDC_POLYGON.toLowerCase()) {
      throw new Error('Verifying contract mismatch');
    }

    return { domain };
  })();

  // Test 8: Invalid address rejection
  await test('Invalid Address Rejection', () => {
    let threwForInvalidUser = false;
    try {
      generateOrderId({
        chainId: 137,
        userAddress: 'not-a-valid-address',
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
      throw new Error('Should reject invalid user address');
    }

    return { invalidAddressRejected: threwForInvalidUser };
  })();

  // Test 9: Price boundary validation
  await test('Price Boundary Validation', () => {
    const baseParams = {
      chainId: 137,
      userAddress: '0x742d35CC6634c0532925a3B844Bc9E7595f5Bb5f',
      marketId: 'price-bounds-test',
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

    // Valid boundary cases should work
    generateOrderId({ ...baseParams, price: 0 });
    generateOrderId({ ...baseParams, price: 1 });
    generateOrderId({ ...baseParams, price: 0.01 });

    if (!threwForNegative || !threwForOverOne) {
      throw new Error('Should reject prices outside [0, 1]');
    }

    return { negativePriceRejected: threwForNegative, overOnePriceRejected: threwForOverOne };
  })();

  // Test 10: Order size in USDC decimals
  await test('Order Size USDC Decimals', () => {
    // USDC has 6 decimals
    const oneUsdc = parseUsdc(1);
    const expectedRaw = BigInt(1_000_000);

    if (oneUsdc !== expectedRaw) {
      throw new Error(`1 USDC should be 1000000 raw, got ${oneUsdc}`);
    }

    const fractional = parseUsdc(0.01);
    const expectedFractional = BigInt(10_000);

    if (fractional !== expectedFractional) {
      throw new Error(`0.01 USDC should be 10000 raw, got ${fractional}`);
    }

    return { oneUsdc: oneUsdc.toString(), fractional: fractional.toString() };
  })();
}

async function runSigningTests() {
  log('\n' + '='.repeat(60));
  log('  PERMIT SIGNING TESTS (requires wallet key)');
  log('='.repeat(60));

  if (!CONFIG.userPrivateKey) {
    log('\n⚠️  PRIVATE_KEY or USER_PRIVATE_KEY not set, skipping signing tests');
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const userWallet = new Wallet(CONFIG.userPrivateKey, provider);

  log(`\n[Config]`);
  log(`  Network: Polygon (chainId: ${CONFIG.chainId})`);
  log(`  Escrow: ${CONFIG.escrowAddress}`);
  log(`  USDC: ${CONFIG.usdcAddress}`);
  log(`  User: ${userWallet.address}`);

  // Test: Get permit nonce from chain
  await test('Get Permit Nonce', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, userWallet.address);

    if (typeof nonce !== 'bigint') {
      throw new Error('Nonce should be a bigint');
    }

    return { nonce: nonce.toString(), address: userWallet.address };
  })();

  // Test: Sign EIP-2612 permit
  await test('Sign EIP-2612 Permit', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, userWallet.address);
    const feeAmount = parseUsdc(0.025); // $0.025 fee
    const deadlineSeconds = 3600; // 1 hour

    const signedPermit = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      feeAmount,
      nonce,
      deadlineSeconds,
      CONFIG.chainId
    );

    if (!signedPermit.signature || !signedPermit.signature.startsWith('0x')) {
      throw new Error('Invalid signature format');
    }

    if (signedPermit.signature.length !== 132) {
      throw new Error(`Signature should be 65 bytes (132 hex chars), got ${signedPermit.signature.length}`);
    }

    return {
      signaturePreview: signedPermit.signature.slice(0, 42) + '...',
      v: signedPermit.v,
      deadline: signedPermit.deadline.toString(),
      value: formatUsdc(signedPermit.value),
    };
  })();

  // Test: Permit signature components
  await test('Permit Signature Components', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, userWallet.address);
    const feeAmount = parseUsdc(0.05);

    const signedPermit = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      feeAmount,
      nonce,
      3600,
      CONFIG.chainId
    );

    // Verify v is valid (27 or 28)
    if (signedPermit.v !== 27 && signedPermit.v !== 28) {
      throw new Error(`Invalid v value: ${signedPermit.v}`);
    }

    // Verify r and s are 32 bytes
    if (!signedPermit.r.startsWith('0x') || signedPermit.r.length !== 66) {
      throw new Error('Invalid r component');
    }

    if (!signedPermit.s.startsWith('0x') || signedPermit.s.length !== 66) {
      throw new Error('Invalid s component');
    }

    return {
      v: signedPermit.v,
      rPreview: signedPermit.r.slice(0, 20) + '...',
      sPreview: signedPermit.s.slice(0, 20) + '...',
    };
  })();

  // Test: Permit signature determinism
  await test('Permit Signature Determinism', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, userWallet.address);
    const feeAmount = parseUsdc(0.03);
    const deadlineSeconds = 3600;

    const sig1 = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      feeAmount,
      nonce,
      deadlineSeconds,
      CONFIG.chainId
    );

    const sig2 = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      feeAmount,
      nonce,
      deadlineSeconds,
      CONFIG.chainId
    );

    // Same inputs should produce same signature (deterministic ECDSA)
    if (sig1.signature !== sig2.signature) {
      throw new Error('Permit signatures should be deterministic');
    }

    return { signaturesMatch: true };
  })();

  // Test: Different amounts produce different signatures
  await test('Different Amounts Different Signatures', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, userWallet.address);

    const sig1 = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      parseUsdc(0.01),
      nonce,
      3600,
      CONFIG.chainId
    );

    const sig2 = await signPermit(
      userWallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      parseUsdc(0.02),
      nonce,
      3600,
      CONFIG.chainId
    );

    if (sig1.signature === sig2.signature) {
      throw new Error('Different amounts should produce different signatures');
    }

    return { signaturesDiffer: true };
  })();
}

async function main() {
  log('🚀 Dome Permit Integration Test\n');
  log('Tests EIP-2612 permit signing for pullFee() contract calls\n');

  // Run offline tests (no network required)
  await runOfflineTests();

  // Run signing tests (requires wallet key and network)
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
    log('\n📝 Note: These tests verify the user-side permit signing workflow.');
    log('   The actual pullFee() call requires OPERATOR_ROLE on the contract.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
