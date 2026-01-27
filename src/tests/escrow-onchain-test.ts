#!/usr/bin/env npx tsx

/**
 * Escrow On-Chain Integration Test
 *
 * Tests the full production flow by interacting with the DomeFeeEscrow
 * smart contract on Polygon. This includes:
 *
 * 1. Reading contract state (fees, balances, escrow data)
 * 2. Generating order IDs and signing permits
 * 3. Simulating pullFee() calls (requires OPERATOR_ROLE for actual execution)
 * 4. Verifying contract responses match expected behavior
 *
 * Prerequisites:
 *   - PRIVATE_KEY or USER_PRIVATE_KEY env var (wallet with some MATIC for gas)
 *   - RPC_URL env var (defaults to public Polygon RPC)
 *   - Wallet should have some USDC for allowance checks
 *
 * Usage:
 *   npx tsx src/tests/escrow-onchain-test.ts
 *
 * Note: Actual pullFee() execution requires OPERATOR_ROLE on the contract.
 *       This test verifies the user-side flow and contract read operations.
 */

import * as dotenv from 'dotenv';
import { ethers, Contract, Wallet } from 'ethers';
import {
  generateOrderId,
  signPermit,
  getPermitNonce,
  calculateFees,
  parseUsdc,
  formatUsdc,
  ESCROW_CONTRACT_POLYGON,
  USDC_POLYGON,
  DEFAULT_DOME_FEE_BPS,
  DEFAULT_MIN_DOME_FEE,
} from '../escrow/index.js';

dotenv.config();

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  rpcUrl: process.env.RPC_URL || 'https://polygon-rpc.com',
  chainId: parseInt(process.env.CHAIN_ID || '137'),
  escrowAddress: process.env.ESCROW_ADDRESS || ESCROW_CONTRACT_POLYGON,
  usdcAddress: process.env.USDC_ADDRESS || USDC_POLYGON,
  privateKey: process.env.PRIVATE_KEY || process.env.USER_PRIVATE_KEY || '',
};

// =============================================================================
// Contract ABIs (minimal for testing)
// =============================================================================

const ESCROW_ABI = [
  // Read functions
  'function TOKEN() view returns (address)',
  'function domeWallet() view returns (address)',
  'function domeFeeBps() view returns (uint256)',
  'function minDomeFee() view returns (uint256)',
  'function totalHeld() view returns (uint256)',
  'function states(bytes32) view returns (uint8)',
  'function escrows(bytes32) view returns (address payer, address client, uint256 domeFee, uint256 clientFee, uint256 domeDistributed, uint256 clientDistributed, uint256 timestamp)',
  'function paused() view returns (bool)',
  'function hasRole(bytes32, address) view returns (bool)',
  // Constants
  'function OPERATOR_ROLE() view returns (bytes32)',
  'function ADMIN_ROLE() view returns (bytes32)',
  'function MAX_CLIENT_FEE_BPS() view returns (uint256)',
  'function DEFAULT_DOME_FEE_BPS() view returns (uint256)',
  'function DEFAULT_MIN_DOME_FEE() view returns (uint256)',
  // Simulate call (will revert without OPERATOR_ROLE, but we can test encoding)
  'function pullFee(bytes32 orderId, address payer, uint256 orderSize, uint256 clientFeeBps, uint256 deadline, bytes signature, address client)',
];

const USDC_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function nonces(address) view returns (uint256)',
];

// =============================================================================
// Test Infrastructure
// =============================================================================

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
        const resultStr = JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
        log(`   Result: ${resultStr.substring(0, 300)}${resultStr.length > 300 ? '...' : ''}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ name, passed: false, error: errorMessage });
      log(`❌ FAILED: ${name}`);
      log(`   Error: ${errorMessage}`);
    }
  };
}

// =============================================================================
// Contract Read Tests
// =============================================================================

async function runContractReadTests(provider: ethers.providers.JsonRpcProvider) {
  log('='.repeat(60));
  log('  CONTRACT READ TESTS');
  log('='.repeat(60));

  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, provider);
  const usdc = new Contract(CONFIG.usdcAddress, USDC_ABI, provider);

  // Test: Verify contract addresses
  await test('Verify Contract Deployment', async () => {
    const code = await provider.getCode(CONFIG.escrowAddress);
    if (code === '0x') {
      throw new Error('Escrow contract not deployed at address');
    }

    const usdcCode = await provider.getCode(CONFIG.usdcAddress);
    if (usdcCode === '0x') {
      throw new Error('USDC contract not deployed at address');
    }

    return { escrowDeployed: true, usdcDeployed: true };
  })();

  // Test: Read escrow TOKEN address
  await test('Read Escrow TOKEN Address', async () => {
    const tokenAddress = await escrow.TOKEN();
    
    if (tokenAddress.toLowerCase() !== CONFIG.usdcAddress.toLowerCase()) {
      throw new Error(`TOKEN mismatch: ${tokenAddress} vs expected ${CONFIG.usdcAddress}`);
    }

    return { token: tokenAddress };
  })();

  // Test: Read dome wallet address
  await test('Read Dome Wallet Address', async () => {
    const domeWallet = await escrow.domeWallet();
    
    if (!ethers.utils.isAddress(domeWallet)) {
      throw new Error('Invalid dome wallet address');
    }

    return { domeWallet };
  })();

  // Test: Read fee configuration
  await test('Read Fee Configuration', async () => {
    const domeFeeBps = await escrow.domeFeeBps();
    const minDomeFee = await escrow.minDomeFee();

    // Verify matches SDK constants
    if (BigInt(domeFeeBps.toString()) !== DEFAULT_DOME_FEE_BPS) {
      log(`   ⚠️  Contract domeFeeBps (${domeFeeBps}) differs from SDK default (${DEFAULT_DOME_FEE_BPS})`);
    }

    if (BigInt(minDomeFee.toString()) !== DEFAULT_MIN_DOME_FEE) {
      log(`   ⚠️  Contract minDomeFee (${minDomeFee}) differs from SDK default (${DEFAULT_MIN_DOME_FEE})`);
    }

    return {
      domeFeeBps: domeFeeBps.toString(),
      minDomeFee: formatUsdc(BigInt(minDomeFee.toString())),
    };
  })();

  // Test: Read contract constants
  await test('Read Contract Constants', async () => {
    const maxClientFeeBps = await escrow.MAX_CLIENT_FEE_BPS();
    const defaultDomeFeeBps = await escrow.DEFAULT_DOME_FEE_BPS();
    const defaultMinDomeFee = await escrow.DEFAULT_MIN_DOME_FEE();

    return {
      maxClientFeeBps: maxClientFeeBps.toString(),
      defaultDomeFeeBps: defaultDomeFeeBps.toString(),
      defaultMinDomeFee: defaultMinDomeFee.toString(),
    };
  })();

  // Test: Check contract paused state
  await test('Check Contract Paused State', async () => {
    const isPaused = await escrow.paused();

    if (isPaused) {
      log('   ⚠️  Contract is currently paused');
    }

    return { paused: isPaused };
  })();

  // Test: Read total held in escrow
  await test('Read Total Held in Escrow', async () => {
    const totalHeld = await escrow.totalHeld();

    return {
      totalHeld: formatUsdc(BigInt(totalHeld.toString())),
      totalHeldRaw: totalHeld.toString(),
    };
  })();

  // Test: Read USDC token info
  await test('Read USDC Token Info', async () => {
    const name = await usdc.name();
    const symbol = await usdc.symbol();
    const decimals = await usdc.decimals();

    if (decimals !== 6) {
      throw new Error(`USDC should have 6 decimals, got ${decimals}`);
    }

    return { name, symbol, decimals };
  })();

  // Test: Query non-existent order state (should be EMPTY = 0)
  await test('Query Non-Existent Order State', async () => {
    const randomOrderId = '0x' + 'dead'.repeat(16);
    const state = await escrow.states(randomOrderId);

    // HoldState.EMPTY = 0
    if (state !== 0) {
      throw new Error(`Empty order should have state 0, got ${state}`);
    }

    return { orderId: randomOrderId, state: state, stateName: 'EMPTY' };
  })();
}

// =============================================================================
// Wallet Integration Tests
// =============================================================================

async function runWalletTests(provider: ethers.providers.JsonRpcProvider, wallet: Wallet) {
  log('\n' + '='.repeat(60));
  log('  WALLET INTEGRATION TESTS');
  log('='.repeat(60));

  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, provider);
  const usdc = new Contract(CONFIG.usdcAddress, USDC_ABI, provider);

  // Test: Check wallet USDC balance
  await test('Check Wallet USDC Balance', async () => {
    const balance = await usdc.balanceOf(wallet.address);

    return {
      address: wallet.address,
      balance: formatUsdc(BigInt(balance.toString())),
      balanceRaw: balance.toString(),
    };
  })();

  // Test: Check wallet USDC allowance for escrow
  await test('Check Wallet USDC Allowance', async () => {
    const allowance = await usdc.allowance(wallet.address, CONFIG.escrowAddress);

    return {
      owner: wallet.address,
      spender: CONFIG.escrowAddress,
      allowance: formatUsdc(BigInt(allowance.toString())),
    };
  })();

  // Test: Get permit nonce
  await test('Get Permit Nonce from USDC', async () => {
    const nonce = await getPermitNonce(provider, CONFIG.usdcAddress, wallet.address);

    // Also verify via direct contract call
    const directNonce = await usdc.nonces(wallet.address);

    if (nonce !== BigInt(directNonce.toString())) {
      throw new Error(`Nonce mismatch: SDK ${nonce} vs contract ${directNonce}`);
    }

    return { nonce: nonce.toString(), address: wallet.address };
  })();

  // Test: Check if wallet has OPERATOR_ROLE
  await test('Check OPERATOR_ROLE', async () => {
    const operatorRole = await escrow.OPERATOR_ROLE();
    const hasOperatorRole = await escrow.hasRole(operatorRole, wallet.address);

    if (!hasOperatorRole) {
      log('   ℹ️  Wallet does not have OPERATOR_ROLE (expected for end users)');
    }

    return {
      operatorRole,
      walletAddress: wallet.address,
      hasRole: hasOperatorRole,
    };
  })();
}

// =============================================================================
// Signing Flow Tests
// =============================================================================

async function runSigningFlowTests(provider: ethers.providers.JsonRpcProvider, wallet: Wallet) {
  log('\n' + '='.repeat(60));
  log('  SIGNING FLOW TESTS (Production Flow Simulation)');
  log('='.repeat(60));

  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, provider);

  // Test: Complete permit signing flow
  await test('Complete Permit Signing Flow', async () => {
    // Step 1: Generate order parameters
    const timestamp = Date.now();
    const orderParams = {
      chainId: CONFIG.chainId,
      userAddress: wallet.address,
      marketId: 'onchain-test-' + timestamp,
      side: 'buy' as const,
      size: parseUsdc(10), // $10 order
      price: 0.50,
      timestamp,
    };

    // Step 2: Generate order ID
    const orderId = generateOrderId(orderParams);
    log(`   → Generated orderId: ${orderId.slice(0, 20)}...`);

    // Step 3: Calculate fees (matching contract logic)
    const fees = calculateFees(orderParams.size, BigInt(0)); // No client fee
    log(`   → Calculated fee: $${formatUsdc(fees.totalFee)}`);

    // Step 4: Get permit nonce
    const permitNonce = await getPermitNonce(provider, CONFIG.usdcAddress, wallet.address);
    log(`   → Current permit nonce: ${permitNonce}`);

    // Step 5: Sign permit
    const deadlineSeconds = 3600;
    const signedPermit = await signPermit(
      wallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      fees.totalFee,
      permitNonce,
      deadlineSeconds,
      CONFIG.chainId
    );
    log(`   → Permit signed successfully`);

    // Step 6: Verify signature components
    if (signedPermit.v !== 27 && signedPermit.v !== 28) {
      throw new Error(`Invalid v value: ${signedPermit.v}`);
    }

    if (signedPermit.signature.length !== 132) {
      throw new Error(`Invalid signature length: ${signedPermit.signature.length}`);
    }

    return {
      orderId,
      orderSize: formatUsdc(orderParams.size),
      totalFee: formatUsdc(fees.totalFee),
      permitNonce: permitNonce.toString(),
      deadline: signedPermit.deadline.toString(),
      signatureValid: true,
      v: signedPermit.v,
    };
  })();

  // Test: Encode pullFee transaction data
  await test('Encode PullFee Transaction Data', async () => {
    const timestamp = Date.now();
    const orderSize = parseUsdc(25); // $25 order
    const clientFeeBps = 50; // 0.5% client fee

    const orderId = generateOrderId({
      chainId: CONFIG.chainId,
      userAddress: wallet.address,
      marketId: 'encode-test-' + timestamp,
      side: 'buy',
      size: orderSize,
      price: 0.65,
      timestamp,
    });

    const fees = calculateFees(orderSize, BigInt(clientFeeBps));
    const permitNonce = await getPermitNonce(provider, CONFIG.usdcAddress, wallet.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const signedPermit = await signPermit(
      wallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      fees.totalFee,
      permitNonce,
      3600,
      CONFIG.chainId
    );

    // Encode the pullFee call data
    const pullFeeData = escrow.interface.encodeFunctionData('pullFee', [
      orderId,
      wallet.address,
      orderSize.toString(),
      clientFeeBps,
      deadline,
      signedPermit.signature,
      ethers.constants.AddressZero, // No client
    ]);

    return {
      orderId,
      encodedDataLength: pullFeeData.length,
      encodedDataPreview: pullFeeData.slice(0, 74) + '...',
      fees: {
        domeFee: formatUsdc(fees.domeFee),
        clientFee: formatUsdc(fees.clientFee),
        totalFee: formatUsdc(fees.totalFee),
      },
    };
  })();

  // Test: Verify fee calculation matches contract
  await test('Verify Fee Calculation Matches Contract', async () => {
    // Read current contract fee params
    const domeFeeBps = await escrow.domeFeeBps();
    const minDomeFee = await escrow.minDomeFee();

    const orderSize = parseUsdc(100); // $100

    // Calculate with SDK using contract params
    const sdkFees = calculateFees(
      orderSize,
      BigInt(0),
      BigInt(domeFeeBps.toString()),
      BigInt(minDomeFee.toString())
    );

    // Manual calculation (matching contract logic)
    let expectedDomeFee = (orderSize * BigInt(domeFeeBps.toString())) / 10000n;
    if (expectedDomeFee < BigInt(minDomeFee.toString())) {
      expectedDomeFee = BigInt(minDomeFee.toString());
    }

    if (sdkFees.domeFee !== expectedDomeFee) {
      throw new Error(`Fee mismatch: SDK ${sdkFees.domeFee} vs expected ${expectedDomeFee}`);
    }

    return {
      orderSize: formatUsdc(orderSize),
      domeFeeBps: domeFeeBps.toString(),
      minDomeFee: formatUsdc(BigInt(minDomeFee.toString())),
      calculatedFee: formatUsdc(sdkFees.domeFee),
      feeMatchesContract: true,
    };
  })();

  // Test: Multiple order IDs are unique
  await test('Multiple Order IDs Are Unique', async () => {
    const baseParams = {
      chainId: CONFIG.chainId,
      userAddress: wallet.address,
      marketId: 'unique-test',
      side: 'buy' as const,
      size: parseUsdc(10),
      price: 0.50,
    };

    const orderIds = new Set<string>();
    
    for (let i = 0; i < 5; i++) {
      const orderId = generateOrderId({
        ...baseParams,
        timestamp: Date.now() + i,
      });
      
      if (orderIds.has(orderId)) {
        throw new Error(`Duplicate orderId generated: ${orderId}`);
      }
      orderIds.add(orderId);
    }

    return { uniqueOrderIds: orderIds.size };
  })();

  // Test: Signature changes with different fee amounts
  await test('Signature Changes With Different Amounts', async () => {
    const permitNonce = await getPermitNonce(provider, CONFIG.usdcAddress, wallet.address);

    const sig1 = await signPermit(
      wallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      parseUsdc(0.01),
      permitNonce,
      3600,
      CONFIG.chainId
    );

    const sig2 = await signPermit(
      wallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      parseUsdc(0.02),
      permitNonce,
      3600,
      CONFIG.chainId
    );

    if (sig1.signature === sig2.signature) {
      throw new Error('Different amounts should produce different signatures');
    }

    return { signaturesDiffer: true };
  })();
}

// =============================================================================
// Escrow State Query Tests
// =============================================================================

async function runEscrowStateTests(provider: ethers.providers.JsonRpcProvider) {
  log('\n' + '='.repeat(60));
  log('  ESCROW STATE QUERY TESTS');
  log('='.repeat(60));

  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, provider);

  // Test: Query escrow data for non-existent order
  await test('Query Escrow Data for Non-Existent Order', async () => {
    const orderId = '0x' + '0'.repeat(64);
    const escrowData = await escrow.escrows(orderId);

    // Should return zeroed data
    if (escrowData.payer !== ethers.constants.AddressZero) {
      throw new Error('Non-existent order should have zero payer');
    }

    if (escrowData.timestamp.toString() !== '0') {
      throw new Error('Non-existent order should have zero timestamp');
    }

    return {
      orderId,
      payer: escrowData.payer,
      client: escrowData.client,
      domeFee: escrowData.domeFee.toString(),
      clientFee: escrowData.clientFee.toString(),
      timestamp: escrowData.timestamp.toString(),
    };
  })();

  // Test: State enum values
  await test('Verify State Enum Values', async () => {
    // Query states for various test order IDs
    const testOrderIds = [
      '0x' + '1'.repeat(64),
      '0x' + '2'.repeat(64),
      '0x' + '3'.repeat(64),
    ];

    const states: number[] = [];
    for (const orderId of testOrderIds) {
      const state = await escrow.states(orderId);
      states.push(state);
    }

    // All should be EMPTY (0) unless they've been used
    const stateNames = states.map(s => {
      switch (s) {
        case 0: return 'EMPTY';
        case 1: return 'HELD';
        case 2: return 'SENT';
        case 3: return 'REFUNDED';
        default: return 'UNKNOWN';
      }
    });

    return { states: stateNames };
  })();
}

// =============================================================================
// Gas Estimation Tests
// =============================================================================

async function runGasEstimationTests(provider: ethers.providers.JsonRpcProvider, wallet: Wallet) {
  log('\n' + '='.repeat(60));
  log('  GAS ESTIMATION TESTS');
  log('='.repeat(60));

  const escrow = new Contract(CONFIG.escrowAddress, ESCROW_ABI, wallet);

  // Test: Estimate gas for pullFee (will fail due to role, but shows encoding works)
  await test('Attempt Gas Estimation for PullFee', async () => {
    const timestamp = Date.now();
    const orderSize = parseUsdc(10);
    
    const orderId = generateOrderId({
      chainId: CONFIG.chainId,
      userAddress: wallet.address,
      marketId: 'gas-test-' + timestamp,
      side: 'buy',
      size: orderSize,
      price: 0.50,
      timestamp,
    });

    const fees = calculateFees(orderSize, BigInt(0));
    const permitNonce = await getPermitNonce(provider, CONFIG.usdcAddress, wallet.address);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const signedPermit = await signPermit(
      wallet,
      CONFIG.usdcAddress,
      CONFIG.escrowAddress,
      fees.totalFee,
      permitNonce,
      3600,
      CONFIG.chainId
    );

    try {
      const gasEstimate = await escrow.estimateGas.pullFee(
        orderId,
        wallet.address,
        orderSize.toString(),
        0, // No client fee
        deadline,
        signedPermit.signature,
        ethers.constants.AddressZero
      );

      return {
        gasEstimate: gasEstimate.toString(),
        note: 'Estimation succeeded (wallet may have OPERATOR_ROLE)',
      };
    } catch (error: any) {
      // Expected to fail without OPERATOR_ROLE
      const errorMessage = error.message || String(error);
      
      if (errorMessage.includes('AccessControl') || errorMessage.includes('OPERATOR')) {
        return {
          expectedError: true,
          reason: 'Wallet lacks OPERATOR_ROLE (expected for end users)',
        };
      }

      // Some other error
      return {
        unexpectedError: errorMessage.slice(0, 100),
      };
    }
  })();
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  log('🚀 Dome Escrow On-Chain Integration Test\n');
  log('Tests production flow with actual smart contract interactions\n');

  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  
  try {
    const network = await provider.getNetwork();
    log(`[Network] ${network.name} (chainId: ${network.chainId})`);
  } catch (error) {
    log('❌ Failed to connect to RPC');
    process.exit(1);
  }

  log(`[Escrow Contract] ${CONFIG.escrowAddress}`);
  log(`[USDC Contract] ${CONFIG.usdcAddress}`);

  // Run contract read tests (no wallet required)
  await runContractReadTests(provider);

  // Run escrow state query tests (no wallet required)
  await runEscrowStateTests(provider);

  // Wallet-dependent tests
  if (CONFIG.privateKey) {
    const wallet = new Wallet(CONFIG.privateKey, provider);
    log(`\n[Wallet] ${wallet.address}`);

    await runWalletTests(provider, wallet);
    await runSigningFlowTests(provider, wallet);
    await runGasEstimationTests(provider, wallet);
  } else {
    log('\n⚠️  No PRIVATE_KEY set, skipping wallet-dependent tests');
    log('   Set PRIVATE_KEY or USER_PRIVATE_KEY to run full test suite');
  }

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
    log('\n🎉 All on-chain tests passed!');
    log('\n📝 Notes:');
    log('   - These tests verify user-side flow and contract reads');
    log('   - Actual pullFee() execution requires OPERATOR_ROLE');
    log('   - Production flow: User signs → Dome server calls pullFee()');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});
