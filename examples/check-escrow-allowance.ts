#!/usr/bin/env npx tsx

/**
 * Check Safe Wallet Approvals
 *
 * Checks if a Safe wallet has the required USDC approvals for trading.
 *
 * Usage:
 *   npx tsx examples/check-safe-approvals.ts
 *
 * Configuration:
 *   Set SAFE_ADDRESS in the CONFIG below, or via environment variable.
 */

import 'dotenv/config';
import { ethers } from 'ethers';
import {
  isSafeDeployed,
  getPolygonProvider,
} from '../src/utils/safe.js';
import { ESCROW_CONTRACT_POLYGON, USDC_POLYGON } from '../src/escrow/constants.js';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  // Safe address to check - set this or use SAFE_ADDRESS env var
  safeAddress: process.env.SAFE_ADDRESS || '0xYOUR_SAFE_ADDRESS_HERE',
  chainId: 137,
  usdcAddress: USDC_POLYGON,
};

// All contracts that need USDC approval from the Safe
const CONTRACTS_TO_APPROVE = {
  // Dome Fee Escrow - REQUIRED for fee escrow orders
  'Dome Fee Escrow': ESCROW_CONTRACT_POLYGON,
  // Polymarket Exchange contracts - for trading
  'CTF Exchange': '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  'Neg Risk CTF Exchange': '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  'Neg Risk Adapter': '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

// =============================================================================
// Helper Functions
// =============================================================================

function log(msg: string) {
  console.log(msg);
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  log('Check Safe Wallet Approvals');

  const safeAddress = CONFIG.safeAddress;
  if (!safeAddress || safeAddress === '0xYOUR_SAFE_ADDRESS_HERE') {
    log('\nERROR: Set SAFE_ADDRESS in CONFIG or environment variable');
    process.exit(1);
  }
  log(`Safe: ${safeAddress}`);

  const provider = getPolygonProvider(CONFIG.rpcUrl);
  const deployed = await isSafeDeployed(safeAddress, provider);

  if (!deployed) {
    log('\n✗ Safe not deployed');
    return;
  }
  log('\n✓ Safe deployed');

  const usdc = new ethers.Contract(
    CONFIG.usdcAddress,
    [
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address,address) view returns (uint256)',
    ],
    provider
  );

  const balance = await usdc.balanceOf(safeAddress);
  const balanceFormatted = ethers.utils.formatUnits(balance, 6);
  log(`\nBalance: ${balanceFormatted} USDC${balance.isZero() ? ' (⚠ Empty)' : ''}`);

  log('\nChecking allowances...');
  let allApproved = true;

  for (const [name, address] of Object.entries(CONTRACTS_TO_APPROVE)) {
    const allowance = await usdc.allowance(safeAddress, address);
    const hasAllowance = !allowance.isZero() && allowance.gt(ethers.utils.parseUnits('1000000', 6));
    const status = hasAllowance ? '✓' : '✗';
    log(`${status} ${name}`);
    if (!hasAllowance) allApproved = false;
    await sleep(2.5); // Wait 2.5 seconds between RPC calls to avoid rate limit
  }

  log(allApproved ? '\n✓ Ready to trade' : '\n✗ Missing approvals - set via Safe UI');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
