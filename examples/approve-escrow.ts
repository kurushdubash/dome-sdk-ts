#!/usr/bin/env npx tsx

/**
 * Approve USDC for Dome Fee Escrow and Polymarket Contracts
 *
 * This script approves all required contracts to spend USDC from the wallet.
 * Required before placing orders with fee escrow.
 *
 * Usage:
 *   npx tsx examples/approve-escrow.ts
 */

import 'dotenv/config';
import { PrivyClient } from '@privy-io/server-auth';
import { ethers } from 'ethers';

// Wallet configuration (from environment variables)
const WALLET = {
  id: process.env.PRIVY_WALLET_ID || '',
  address: process.env.PRIVY_WALLET_ADDRESS || '',
  authKey: process.env.PRIVY_AUTHORIZATION_KEY || '',
};

const CONFIG = {
  privyAppId: process.env.PRIVY_APP_ID || '',
  privyAppSecret: process.env.PRIVY_APP_SECRET || '',
  rpcUrl: 'https://polygon-rpc.com',
  chainId: 137,
  usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
};

// All contracts that need USDC approval
const CONTRACTS_TO_APPROVE = {
  'Fee Escrow': '0x93519731c9d45738CD999F8b8E86936cc2a33870',
  'CTF Exchange': '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
  'Neg Risk CTF Exchange': '0xC5d563A36AE78145C45a50134d48A1215220f80a',
  'Neg Risk Adapter': '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296',
};

function log(msg: string) {
  console.log(msg);
}

async function main() {
  log('='.repeat(60));
  log('  Approve USDC for Dome & Polymarket Contracts');
  log('='.repeat(60));

  if (!CONFIG.privyAppId || !CONFIG.privyAppSecret) {
    log('\n[ERROR] Missing PRIVY_APP_ID or PRIVY_APP_SECRET');
    process.exit(1);
  }

  if (!WALLET.id || !WALLET.address || !WALLET.authKey) {
    log(
      '\n[ERROR] Missing wallet configuration. Set these environment variables:'
    );
    log('  PRIVY_WALLET_ID=your-wallet-id');
    log('  PRIVY_WALLET_ADDRESS=0x...');
    log('  PRIVY_AUTHORIZATION_KEY=MIGHAgEA...');
    process.exit(1);
  }

  log('\n[Configuration]');
  log(`  Wallet: ${WALLET.address}`);
  log(`  USDC: ${CONFIG.usdcAddress}`);

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.rpcUrl);
  const usdc = new ethers.Contract(
    CONFIG.usdcAddress,
    ['function allowance(address,address) view returns (uint256)'],
    provider
  );

  // Check which contracts need approval
  log('\n[Step 1] Check Current Allowances');
  const needsApproval: { name: string; address: string }[] = [];

  for (const [name, address] of Object.entries(CONTRACTS_TO_APPROVE)) {
    const allowance = await usdc.allowance(WALLET.address, address);
    const hasAllowance = Number(allowance) > 1e12; // Check if unlimited
    log(`  ${name.padEnd(25)} ${hasAllowance ? 'OK' : 'NEEDS APPROVAL'}`);
    if (!hasAllowance) {
      needsApproval.push({ name, address });
    }
  }

  if (needsApproval.length === 0) {
    log('\n  All contracts already approved. No action needed.');
    return;
  }

  log(`\n  ${needsApproval.length} contract(s) need approval`);

  // Initialize Privy with authorization key
  log('\n[Step 2] Initialize Privy Client');
  const privy = new PrivyClient(CONFIG.privyAppId, CONFIG.privyAppSecret, {
    walletApi: {
      authorizationPrivateKey: WALLET.authKey,
    },
  });
  log('  Privy client initialized with auth key');

  // Approve each contract
  const iface = new ethers.utils.Interface([
    'function approve(address spender, uint256 amount) returns (bool)',
  ]);

  for (let i = 0; i < needsApproval.length; i++) {
    const { name, address } = needsApproval[i];
    log(`\n[Step ${3 + i}] Approve ${name}`);
    log(`  Address: ${address}`);

    const data = iface.encodeFunctionData('approve', [
      address,
      ethers.constants.MaxUint256,
    ]);

    try {
      const result = await privy.walletApi.ethereum.sendTransaction({
        walletId: WALLET.id,
        caip2: `eip155:${CONFIG.chainId}`,
        transaction: {
          to: CONFIG.usdcAddress as `0x${string}`,
          data: data as `0x${string}`,
          chainId: CONFIG.chainId,
        },
      });

      log(`  Tx: ${result.hash}`);

      // Wait for confirmation
      const receipt = await provider.waitForTransaction(result.hash, 1, 60000);
      if (receipt.status === 1) {
        log(`  Confirmed`);
      } else {
        log(`  FAILED`);
        process.exit(1);
      }
    } catch (error: any) {
      log(`  ERROR: ${error.message}`);
      process.exit(1);
    }
  }

  // Verify all approvals
  log('\n[Final] Verify All Approvals');
  for (const [name, address] of Object.entries(CONTRACTS_TO_APPROVE)) {
    const allowance = await usdc.allowance(WALLET.address, address);
    const hasAllowance = Number(allowance) > 1e12;
    log(`  ${name.padEnd(25)} ${hasAllowance ? 'OK' : 'FAILED'}`);
  }

  log(`\n${'='.repeat(60)}`);
  log('  SUCCESS! All contracts approved');
  log('='.repeat(60));
  log('\nYou can now place orders with fee escrow.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
