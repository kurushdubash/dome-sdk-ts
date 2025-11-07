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

  await runTest('Polymarket: Get Orderbooks', () =>
    dome.polymarket.markets.getOrderbooks({
      token_id: testTokenId,
      start_time: Date.now() - 86400000, // 24 hours ago in milliseconds
      end_time: Date.now(), // now in milliseconds
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Markets (by slug)', () =>
    dome.polymarket.markets.getMarkets({
      market_slug: [testMarketSlug],
      limit: 10,
    })
  );

  // Comprehensive validation test for markets endpoint
  // This test validates the exact curl request:
  // curl --request GET \
  //   --url 'https://api.domeapi.io/v1/polymarket/markets?limit=10&market_slug=bitcoin-up-or-down-july-25-8pm-et'
  // And ensures all fields in the response match the expected structure
  await runTest('Polymarket: Get Markets - Full Field Validation', async () => {
    const response = await dome.polymarket.markets.getMarkets({
      market_slug: ['bitcoin-up-or-down-july-25-8pm-et'],
      limit: 10,
    });

    // Validate response structure
    if (!response.markets || !Array.isArray(response.markets)) {
      throw new Error('Response must have markets array');
    }

    if (!response.pagination) {
      throw new Error('Response must have pagination object');
    }

    // Validate pagination fields
    const { pagination } = response;
    if (typeof pagination.limit !== 'number') {
      throw new Error('pagination.limit must be a number');
    }
    if (typeof pagination.offset !== 'number') {
      throw new Error('pagination.offset must be a number');
    }
    if (typeof pagination.total !== 'number') {
      throw new Error('pagination.total must be a number');
    }
    if (typeof pagination.has_more !== 'boolean') {
      throw new Error('pagination.has_more must be a boolean');
    }

    // Validate each market in the response
    for (const market of response.markets) {
      // Required string fields
      if (typeof market.market_slug !== 'string' || !market.market_slug) {
        throw new Error('market.market_slug must be a non-empty string');
      }
      if (typeof market.condition_id !== 'string' || !market.condition_id) {
        throw new Error('market.condition_id must be a non-empty string');
      }
      if (typeof market.title !== 'string' || !market.title) {
        throw new Error('market.title must be a non-empty string');
      }

      // Required number fields (timestamps)
      if (typeof market.start_time !== 'number') {
        throw new Error('market.start_time must be a number');
      }
      if (typeof market.end_time !== 'number') {
        throw new Error('market.end_time must be a number');
      }

      // Nullable timestamp fields
      if (
        market.completed_time !== null &&
        typeof market.completed_time !== 'number'
      ) {
        throw new Error('market.completed_time must be a number or null');
      }
      if (market.close_time !== null && typeof market.close_time !== 'number') {
        throw new Error('market.close_time must be a number or null');
      }

      // Tags array
      if (!Array.isArray(market.tags)) {
        throw new Error('market.tags must be an array');
      }
      market.tags.forEach((tag, index) => {
        if (typeof tag !== 'string') {
          throw new Error(`market.tags[${index}] must be a string`);
        }
      });

      // Volume fields
      if (typeof market.volume_1_week !== 'number') {
        throw new Error('market.volume_1_week must be a number');
      }
      if (typeof market.volume_1_month !== 'number') {
        throw new Error('market.volume_1_month must be a number');
      }
      if (typeof market.volume_1_year !== 'number') {
        throw new Error('market.volume_1_year must be a number');
      }
      if (typeof market.volume_total !== 'number') {
        throw new Error('market.volume_total must be a number');
      }

      // String fields
      if (typeof market.resolution_source !== 'string') {
        throw new Error('market.resolution_source must be a string');
      }
      if (typeof market.image !== 'string') {
        throw new Error('market.image must be a string');
      }

      // Side objects
      if (!market.side_a || typeof market.side_a !== 'object') {
        throw new Error('market.side_a must be an object');
      }
      if (typeof market.side_a.id !== 'string' || !market.side_a.id) {
        throw new Error('market.side_a.id must be a non-empty string');
      }
      if (typeof market.side_a.label !== 'string' || !market.side_a.label) {
        throw new Error('market.side_a.label must be a non-empty string');
      }

      if (!market.side_b || typeof market.side_b !== 'object') {
        throw new Error('market.side_b must be an object');
      }
      if (typeof market.side_b.id !== 'string' || !market.side_b.id) {
        throw new Error('market.side_b.id must be a non-empty string');
      }
      if (typeof market.side_b.label !== 'string' || !market.side_b.label) {
        throw new Error('market.side_b.label must be a non-empty string');
      }

      // Winning side (nullable object)
      if (market.winning_side !== null) {
        if (!market.winning_side || typeof market.winning_side !== 'object') {
          throw new Error('market.winning_side must be an object or null');
        }
        if (
          typeof market.winning_side.id !== 'string' ||
          !market.winning_side.id
        ) {
          throw new Error(
            'market.winning_side.id must be a non-empty string when winning_side is not null'
          );
        }
        if (
          typeof market.winning_side.label !== 'string' ||
          !market.winning_side.label
        ) {
          throw new Error(
            'market.winning_side.label must be a non-empty string when winning_side is not null'
          );
        }
      }

      // Status enum
      if (market.status !== 'open' && market.status !== 'closed') {
        throw new Error(
          `market.status must be 'open' or 'closed', got: ${market.status}`
        );
      }
    }

    return response;
  });

  await runTest('Polymarket: Get Markets (by condition ID)', () =>
    dome.polymarket.markets.getMarkets({
      condition_id: [testConditionId],
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Markets (with filters)', () =>
    dome.polymarket.markets.getMarkets({
      status: 'open',
      limit: 20,
      offset: 0,
    })
  );

  // ===== POLYMARKET WALLET ENDPOINTS =====
  console.log('💰 Testing Polymarket Wallet Endpoints...\n');

  await runTest('Polymarket: Get Wallet PnL (daily granularity)', () =>
    dome.polymarket.wallet.getWalletPnL({
      wallet_address: testWalletAddress,
      granularity: 'day',
      start_time: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
      end_time: Math.floor(Date.now() / 1000), // now
    })
  );

  await runTest('Polymarket: Get Wallet PnL (all time)', () =>
    dome.polymarket.wallet.getWalletPnL({
      wallet_address: testWalletAddress,
      granularity: 'all',
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

  await runTest('Polymarket: Get Activity (by user)', () =>
    dome.polymarket.orders.getActivity({
      user: testWalletAddress,
      limit: 10,
    })
  );

  await runTest('Polymarket: Get Activity (with time range)', () =>
    dome.polymarket.orders.getActivity({
      user: testWalletAddress,
      start_time: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
      end_time: Math.floor(Date.now() / 1000), // now
      limit: 20,
    })
  );

  await runTest('Polymarket: Get Activity (by market slug)', () =>
    dome.polymarket.orders.getActivity({
      user: testWalletAddress,
      market_slug: testMarketSlug,
      limit: 10,
    })
  );

  // ===== KALSHI ENDPOINTS =====
  console.log('🏈 Testing Kalshi Endpoints...\n');

  await runTest('Kalshi: Get Markets (no filters)', () =>
    dome.kalshi.markets.getMarkets({
      limit: 10,
    })
  );

  await runTest('Kalshi: Get Markets (by status)', () =>
    dome.kalshi.markets.getMarkets({
      status: 'open',
      limit: 20,
    })
  );

  await runTest('Kalshi: Get Markets (by event ticker)', () =>
    dome.kalshi.markets.getMarkets({
      event_ticker: ['KXNFLGAME-25AUG16ARIDEN'],
      limit: 10,
    })
  );

  await runTest('Kalshi: Get Orderbooks', () =>
    dome.kalshi.markets.getOrderbooks({
      ticker: 'KXNFLGAME-25AUG16ARIDEN-ARI',
      start_time: Date.now() - 86400000, // 24 hours ago in milliseconds
      end_time: Date.now(), // now in milliseconds
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

  await runTest('Matching Markets: Get by sport and date (CFB)', () =>
    dome.matchingMarkets.getMatchingMarketsBySport({
      sport: 'cfb',
      date: '2025-09-14',
    })
  );

  await runTest('Matching Markets: Get by sport and date (NBA)', () =>
    dome.matchingMarkets.getMatchingMarketsBySport({
      sport: 'nba',
      date: '2025-11-15',
    })
  );

  await runTest('Matching Markets: Get by sport and date (NHL)', () =>
    dome.matchingMarkets.getMatchingMarketsBySport({
      sport: 'nhl',
      date: '2025-10-20',
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
