#!/usr/bin/env ts-node

import { DomeClient } from '../index';

/**
 * Integration test script for the Dome SDK
 *
 * This script makes live calls to the real Dome API endpoints to verify
 * that the SDK works correctly with actual data.
 *
 * Usage:
 *   yarn integration-test YOUR_API_KEY
 *   or
 *   npx ts-node src/tests/integration-test.ts YOUR_API_KEY
 */

interface TestResults {
  passed: number;
  failed: number;
  errors: string[];
}

async function runIntegrationTest(apiKey: string): Promise<void> {
  console.log('🚀 Starting Dome SDK Integration Test...\n');

  const dome = new DomeClient({
    apiKey,
  });

  const testResults: TestResults = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  // Helper function to run a test
  async function runTest(
    testName: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    try {
      console.log(`📋 Testing: ${testName}`);
      const result = await testFn();
      console.log(`✅ PASSED: ${testName}`);
      console.log(
        `   Response: ${JSON.stringify(result, null, 2).substring(0, 200)}...\n`
      );
      testResults.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`   Error: ${errorMessage}\n`);
      testResults.failed++;
      testResults.errors.push(`${testName}: ${errorMessage}`);
    }
  }

  // Test data - using real-looking IDs that might exist
  const testTokenId =
    '58519484510520807142687824915233722607092670035910114837910294451210534222702';
  const testConditionId =
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57';
  const testWalletAddress = '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b';
  const testMarketSlug = 'bitcoin-up-or-down-july-25-8pm-et';

  // ===== POLYMARKET MARKET ENDPOINTS =====
  console.log('📊 Testing Polymarket Market Endpoints...\n');

  await runTest('Polymarket: Get Market Price (current)', () =>
    dome.polymarket.markets.getMarketPrice({
      token_id:
        '24891147099018724959141647991382271578149113344000019968758330059825991230807',
      at_time: 1753533049,
    })
  );

  await runTest('Polymarket: Get Market Price (historical)', () =>
    dome.polymarket.markets.getMarketPrice({
      token_id: testTokenId,
      at_time: Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
    })
  );

  await runTest('Polymarket: Get Candlesticks (1 hour intervals)', () =>
    dome.polymarket.markets.getCandlesticks({
      condition_id: testConditionId,
      start_time: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
      end_time: Math.floor(Date.now() / 1000), // now
      interval: 60, // 1 hour
    })
  );

  await runTest('Polymarket: Get Candlesticks (1 day intervals)', () =>
    dome.polymarket.markets.getCandlesticks({
      condition_id: testConditionId,
      start_time: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
      end_time: Math.floor(Date.now() / 1000), // now
      interval: 1440, // 1 day
    })
  );

  await runTest('Polymarket: Get Markets (no filters)', () =>
    dome.polymarket.markets.getMarkets({
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Markets (with filters)', () =>
    dome.polymarket.markets.getMarkets({
      tags: ['crypto'],
      limit: 5,
    })
  );

  // ===== POLYMARKET ORDERS ENDPOINTS =====
  console.log('📋 Testing Polymarket Orders Endpoints...\n');

  await runTest('Polymarket: Get Orders (by market slug)', () =>
    dome.polymarket.orders.getOrders({
      market_slug: testMarketSlug,
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Orders (by token ID)', () =>
    dome.polymarket.orders.getOrders({
      token_id: testTokenId,
      limit: 5,
    })
  );

  await runTest('Polymarket: Get Orders (with time range)', () =>
    dome.polymarket.orders.getOrders({
      market_slug: testMarketSlug,
      start_time: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
      end_time: Math.floor(Date.now() / 1000), // now
      limit: 20,
      offset: 0,
    })
  );

  await runTest('Polymarket: Get Orders (by user)', () =>
    dome.polymarket.orders.getOrders({
      user: testWalletAddress,
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Orderbook History', () =>
    dome.polymarket.orders.getOrderbookHistory({
      token_id: testTokenId,
      start_time: Math.floor(Date.now() / 1000) - 86400, // 24 hours ago
      end_time: Math.floor(Date.now() / 1000), // now
      limit: 10,
    })
  );

  // ===== MATCHING MARKETS ENDPOINTS =====
  console.log('🔗 Testing Matching Markets Endpoints...\n');

  await runTest('Matching Markets: Get by Polymarket slug', () =>
    dome.matchingMarkets.getMatchingMarkets({
      polymarket_market_slug: ['nfl-ari-den-2025-08-16'],
    })
  );

  await runTest('Matching Markets: Get by Kalshi ticker', () =>
    dome.matchingMarkets.getMatchingMarkets({
      kalshi_event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
    })
  );

  await runTest('Matching Markets: Get by sport and date (NFL)', () =>
    dome.matchingMarkets.getMatchingMarketsBySport({
      sport: 'nfl',
      date: '2025-08-16',
    })
  );

  await runTest('Matching Markets: Get by sport and date (MLB)', () =>
    dome.matchingMarkets.getMatchingMarketsBySport({
      sport: 'mlb',
      date: '2025-08-16',
    })
  );

  // ===== SUMMARY =====
  console.log('📊 Integration Test Summary');
  console.log('========================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(
    `📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%\n`
  );

  if (testResults.errors.length > 0) {
    console.log('❌ Failed Tests:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    console.log('');
  }

  if (testResults.failed === 0) {
    console.log(
      '🎉 All integration tests passed! The SDK is working correctly with the live API.'
    );
  } else {
    console.log('⚠️  Some tests failed. This might be due to:');
    console.log('   - Invalid test data (token IDs, wallet addresses, etc.)');
    console.log('   - API rate limiting');
    console.log('   - Network issues');
    console.log('   - API changes');
    console.log('');
    console.log(
      '💡 Try running the test again or check the specific error messages above.'
    );
  }

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Main execution
async function main(): Promise<void> {
  const apiKey = process.argv[2];

  if (!apiKey) {
    console.error('❌ Error: API key is required');
    console.log('');
    console.log('Usage:');
    console.log('  yarn integration-test YOUR_API_KEY');
    console.log('  or');
    console.log('  npx ts-node src/tests/integration-test.ts YOUR_API_KEY');
    console.log('');
    console.log('Example:');
    console.log('  yarn integration-test dome_1234567890abcdef');
    process.exit(1);
  }

  try {
    await runIntegrationTest(apiKey);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('💥 Fatal error during integration test:', errorMessage);
    process.exit(1);
  }
}

// Run the test
main();
