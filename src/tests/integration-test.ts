#!/usr/bin/env tsx

import { DomeClient } from '../index.js';

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
    testFn: () => Promise<any>,
    validateResponse?: (result: any) => void
  ): Promise<void> {
    try {
      console.log(`📋 Testing: ${testName}`);
      const result = await testFn();

      // Validate that response has values
      if (validateResponse) {
        validateResponse(result);
      } else {
        // Default validation: check that result is not null/undefined
        if (result === null || result === undefined) {
          throw new Error('Response is null or undefined');
        }
      }

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

  // Test data - using provided base values
  const testTokenId =
    '56369772478534954338683665819559528414197495274302917800610633957542171787417';
  const testConditionId =
    '0x4567b275e6b667a6217f5cb4f06a797d3a1eaf1d0281fb5bc8c75e2046ae7e57';
  const testWalletAddress = '0x7c3db723f1d4d8cb9c550095203b686cb11e5c6b';
  const testMarketSlug = 'bitcoin-up-or-down-july-25-8pm-et';
  const testStartTime = 1760470000000; // milliseconds
  const testEndTime = 1760480000000; // milliseconds
  const testStartTimeSeconds = Math.floor(testStartTime / 1000);
  const testEndTimeSeconds = Math.floor(testEndTime / 1000);

  // Kalshi test data
  const testMarketTicker = 'KXMAYORNYCPARTY-25-D';
  const testEventTicker = 'KXMAYORNYCPARTY-25';
  const testKalshiTradesTicker = 'KXNFLGAME-25NOV09PITLAC-PIT';
  const testKalshiMarketWithSpecialChars = '538APPROVE-22AUG03-B38.4';

  // Matching markets test data
  const testMatchingMarketSlug = 'nfl-ari-den-2025-08-16';
  const testMatchingEventTicker = 'KXNFLGAME-25AUG16ARIDEN';

  // Crypto prices test data
  const testBinanceCurrency = 'btcusdt';
  const testChainlinkCurrency = 'eth/usd';
  const testCryptoStartTime = 1766130000000;
  const testCryptoEndTime = 1766131000000;

  // ===== POLYMARKET MARKET ENDPOINTS =====
  console.log('📊 Testing Polymarket Market Endpoints...\n');

  await runTest(
    'Polymarket: Get Market Price (current)',
    () =>
      dome.polymarket.markets.getMarketPrice({
        token_id: testTokenId,
      }),
    result => {
      if (typeof result.price !== 'number') {
        throw new Error('Response must have price as number');
      }
      if (typeof result.at_time !== 'number') {
        throw new Error('Response must have at_time as number');
      }
      if (result.price < 0 || result.price > 1) {
        throw new Error('Price must be between 0 and 1');
      }
    }
  );

  await runTest(
    'Polymarket: Get Market Price (historical)',
    () =>
      dome.polymarket.markets.getMarketPrice({
        token_id: testTokenId,
        at_time: testStartTimeSeconds,
      }),
    result => {
      if (typeof result.price !== 'number') {
        throw new Error('Response must have price as number');
      }
      if (typeof result.at_time !== 'number') {
        throw new Error('Response must have at_time as number');
      }
    }
  );

  await runTest(
    'Polymarket: Get Candlesticks (1 hour intervals)',
    () =>
      dome.polymarket.markets.getCandlesticks({
        condition_id: testConditionId,
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
        interval: 60, // 1 hour
      }),
    result => {
      if (!result.candlesticks || !Array.isArray(result.candlesticks)) {
        throw new Error('Response must have candlesticks array');
      }
      // Note: candlesticks array may be empty if no data exists for the time range
    }
  );

  await runTest(
    'Polymarket: Get Candlesticks (1 day intervals)',
    () =>
      dome.polymarket.markets.getCandlesticks({
        condition_id: testConditionId,
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
        interval: 1440, // 1 day
      }),
    result => {
      if (!result.candlesticks || !Array.isArray(result.candlesticks)) {
        throw new Error('Response must have candlesticks array');
      }
    }
  );

  await runTest(
    'Polymarket: Get Orderbooks',
    () =>
      dome.polymarket.markets.getOrderbooks({
        token_id: testTokenId,
        start_time: testStartTime,
        end_time: testEndTime,
        limit: 10,
      }),
    result => {
      if (!result.snapshots || !Array.isArray(result.snapshots)) {
        throw new Error('Response must have snapshots array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
      if (result.snapshots.length > 0) {
        const snapshot = result.snapshots[0];
        if (!snapshot.asks || !Array.isArray(snapshot.asks)) {
          throw new Error('Snapshot must have asks array');
        }
        if (!snapshot.bids || !Array.isArray(snapshot.bids)) {
          throw new Error('Snapshot must have bids array');
        }
      }
    }
  );

  await runTest(
    'Polymarket: Get Markets (by slug)',
    () =>
      dome.polymarket.markets.getMarkets({
        market_slug: [testMarketSlug],
        limit: 10,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (result.markets.length === 0) {
        throw new Error('Markets array should not be empty');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  // Comprehensive validation test for markets endpoint
  // This test validates the exact curl request:
  // curl --request GET \
  //   --url 'https://api.domeapi.io/v1/polymarket/markets?limit=10&market_slug=bitcoin-up-or-down-july-25-8pm-et'
  // And ensures all fields in the response match the expected structure
  await runTest('Polymarket: Get Markets - Full Field Validation', async () => {
    const response = await dome.polymarket.markets.getMarkets({
      market_slug: [
        'bitcoin-up-or-down-july-25-8pm-et',
        'nfl-ari-den-2025-08-16',
      ],
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
      if (
        market.market_slug === 'nfl-ari-den-2025-08-16' &&
        market.game_start_time !== null &&
        typeof market.game_start_time !== 'string'
      ) {
        throw new Error('market.game_start_time must be a string or null');
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

      // Winning side (nullable string)
      if (
        market.status === 'closed' &&
        market.winning_side !== null &&
        typeof market.winning_side === 'string'
      ) {
        throw new Error('market.winning_side must be an object or null');
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

  await runTest(
    'Polymarket: Get Wallet',
    () =>
      dome.polymarket.wallet.getWallet({
        eoa: testWalletAddress,
        with_metrics: true,
      }),
    result => {
      if (typeof result.eoa !== 'string' || !result.eoa) {
        throw new Error('Response must have eoa as non-empty string');
      }
      if (typeof result.proxy !== 'string' || !result.proxy) {
        throw new Error('Response must have proxy as non-empty string');
      }
      if (typeof result.wallet_type !== 'string' || !result.wallet_type) {
        throw new Error('Response must have wallet_type as non-empty string');
      }
      if (result.wallet_metrics) {
        if (typeof result.wallet_metrics.total_volume !== 'number') {
          throw new Error('wallet_metrics.total_volume must be a number');
        }
        if (typeof result.wallet_metrics.total_trades !== 'number') {
          throw new Error('wallet_metrics.total_trades must be a number');
        }
      }
    }
  );

  await runTest(
    'Polymarket: Get Wallet (without metrics)',
    () =>
      dome.polymarket.wallet.getWallet({
        eoa: testWalletAddress,
      }),
    result => {
      if (typeof result.eoa !== 'string' || !result.eoa) {
        throw new Error('Response must have eoa as non-empty string');
      }
    }
  );

  await runTest(
    'Polymarket: Get Wallet PnL (daily granularity)',
    () =>
      dome.polymarket.wallet.getWalletPnL({
        wallet_address: testWalletAddress,
        granularity: 'day',
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
      }),
    result => {
      if (typeof result.granularity !== 'string') {
        throw new Error('Response must have granularity as string');
      }
      if (!result.pnl_over_time || !Array.isArray(result.pnl_over_time)) {
        throw new Error('Response must have pnl_over_time array');
      }
      if (typeof result.wallet_addr !== 'string') {
        throw new Error('Response must have wallet_address as string');
      }
    }
  );

  await runTest(
    'Polymarket: Get Wallet PnL (all time)',
    () =>
      dome.polymarket.wallet.getWalletPnL({
        wallet_address: testWalletAddress,
        granularity: 'all',
      }),
    result => {
      if (typeof result.granularity !== 'string') {
        throw new Error('Response must have granularity as string');
      }
      if (!result.pnl_over_time || !Array.isArray(result.pnl_over_time)) {
        throw new Error('Response must have pnl_over_time array');
      }
    }
  );

  // ===== POLYMARKET ORDERS ENDPOINTS =====
  console.log('📋 Testing Polymarket Orders Endpoints...\n');

  await runTest(
    'Polymarket: Get Orders (by market slug)',
    () =>
      dome.polymarket.orders.getOrders({
        market_slug: testMarketSlug,
        limit: 10,
      }),
    result => {
      if (!result.orders || !Array.isArray(result.orders)) {
        throw new Error('Response must have orders array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
      if (result.orders.length > 0) {
        const order = result.orders[0];
        if (!order.token_id) {
          throw new Error('Order must have token_id');
        }
        if (!order.token_label) {
          throw new Error('Order must have token_label');
        }
        if (!order.taker) {
          throw new Error('Order must have taker');
        }
      }
    }
  );

  await runTest(
    'Polymarket: Get Orders (by token ID)',
    () =>
      dome.polymarket.orders.getOrders({
        token_id: testTokenId,
        limit: 5,
      }),
    result => {
      if (!result.orders || !Array.isArray(result.orders)) {
        throw new Error('Response must have orders array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Polymarket: Get Orders (with time range)',
    () =>
      dome.polymarket.orders.getOrders({
        market_slug: testMarketSlug,
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
        limit: 20,
        offset: 0,
      }),
    result => {
      if (!result.orders || !Array.isArray(result.orders)) {
        throw new Error('Response must have orders array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Polymarket: Get Orders (by user)',
    () =>
      dome.polymarket.orders.getOrders({
        user: testWalletAddress,
        limit: 10,
      }),
    result => {
      if (!result.orders || !Array.isArray(result.orders)) {
        throw new Error('Response must have orders array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Polymarket: Get Activity (by user)',
    () =>
      dome.polymarket.orders.getActivity({
        user: testWalletAddress,
        limit: 10,
      }),
    result => {
      if (!result.activities || !Array.isArray(result.activities)) {
        throw new Error('Response must have activities array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Polymarket: Get Activity (with time range)',
    () =>
      dome.polymarket.orders.getActivity({
        user: testWalletAddress,
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
        limit: 20,
      }),
    result => {
      if (!result.activities || !Array.isArray(result.activities)) {
        throw new Error('Response must have activities array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Polymarket: Get Activity (by market slug)',
    () =>
      dome.polymarket.orders.getActivity({
        user: testWalletAddress,
        market_slug: testMarketSlug,
        limit: 10,
      }),
    result => {
      if (!result.activities || !Array.isArray(result.activities)) {
        throw new Error('Response must have activities array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  // ===== POLYMARKET WEBSOCKET ENDPOINTS =====
  console.log('🔌 Testing Polymarket WebSocket Endpoints...\n');

  await runTest(
    'Polymarket: WebSocket - Subscribe and receive order events',
    async () => {
      const testUser = '0x6031b6eed1c97e853c6e0f03ad3ce3529351f96d';
      const ws = dome.polymarket.createWebSocket({
        reconnect: {
          enabled: false, // Disable auto-reconnect for test
        },
      });

      // Connect to WebSocket
      await ws.connect();

      // Subscribe to orders for the test user
      const subscription = await ws.subscribe({
        users: [testUser],
      });

      console.log(`   Subscribed with ID: ${subscription.subscription_id}`);

      // Wait up to 30 seconds for an order event
      const timeout = 30000; // 30 seconds

      return new Promise((resolve, reject) => {
        let orderReceived = false;
        let timeoutId: ReturnType<typeof setTimeout>;

        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          ws.removeListener('order', orderHandler);
          ws.removeListener('error', errorHandler);
          ws.close();
        };

        const orderHandler = (order: any) => {
          if (!orderReceived) {
            orderReceived = true;
            console.log(
              `   ✅ Order received: ${JSON.stringify(order, null, 2).substring(0, 200)}...`
            );
            cleanup();
            resolve({
              subscription_id: subscription.subscription_id,
              order_received: true,
              order: {
                token_id: order.token_id,
                side: order.side,
                market_slug: order.market_slug,
                user: order.user,
                timestamp: order.timestamp,
              },
            });
          }
        };

        const errorHandler = (error: Error) => {
          if (!orderReceived) {
            cleanup();
            reject(new Error(`WebSocket error: ${error.message}`));
          }
        };

        ws.on('order', orderHandler);
        ws.on('error', errorHandler);

        // Set up timeout - fail if no order received within 30 seconds
        timeoutId = setTimeout(() => {
          if (!orderReceived) {
            cleanup();
            reject(
              new Error(
                `No order events received within ${timeout / 1000} seconds for user ${testUser}`
              )
            );
          }
        }, timeout);
      });
    }
  );

  // ===== KALSHI ENDPOINTS =====
  console.log('🏈 Testing Kalshi Endpoints...\n');

  await runTest(
    'Kalshi: Get Markets (no filters)',
    () =>
      dome.kalshi.markets.getMarkets({
        limit: 10,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Kalshi: Get Markets (by status)',
    () =>
      dome.kalshi.markets.getMarkets({
        status: 'open',
        limit: 20,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Kalshi: Get Markets (by event ticker)',
    () =>
      dome.kalshi.markets.getMarkets({
        event_ticker: [testEventTicker],
        limit: 10,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Kalshi: Get Markets (by market ticker)',
    () =>
      dome.kalshi.markets.getMarkets({
        market_ticker: [testMarketTicker],
        limit: 10,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Kalshi: Get Markets (by market ticker with special characters)',
    () =>
      dome.kalshi.markets.getMarkets({
        market_ticker: [testKalshiMarketWithSpecialChars],
        limit: 10,
      }),
    result => {
      if (!result.markets || !Array.isArray(result.markets)) {
        throw new Error('Response must have markets array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
      if (result.markets.length > 0) {
        const market = result.markets[0];
        // Validate that market ticker with special characters (., /, ), () is handled correctly
        if (typeof market.market_ticker !== 'string' || !market.market_ticker) {
          throw new Error('market.market_ticker must be a non-empty string');
        }
        // Verify the ticker contains the special characters
        if (!market.market_ticker.includes('.')) {
          throw new Error(
            'Market ticker should support special characters like "."'
          );
        }
      }
    }
  );

  await runTest(
    'Kalshi: Get Trades',
    () =>
      dome.kalshi.markets.getTrades({
        ticker: testKalshiTradesTicker,
        limit: 10,
      }),
    result => {
      if (!result.trades || !Array.isArray(result.trades)) {
        throw new Error('Response must have trades array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
      if (result.trades.length > 0) {
        const trade = result.trades[0];
        if (!trade.trade_id) {
          throw new Error('Trade must have trade_id');
        }
        if (typeof trade.count !== 'number') {
          throw new Error('Trade must have count as number');
        }
        if (typeof trade.yes_price !== 'number') {
          throw new Error('Trade must have yes_price as number');
        }
        if (typeof trade.no_price !== 'number') {
          throw new Error('Trade must have no_price as number');
        }
      }
    }
  );

  await runTest(
    'Kalshi: Get Trades (with time range)',
    () =>
      dome.kalshi.markets.getTrades({
        ticker: testKalshiTradesTicker,
        start_time: testStartTimeSeconds,
        end_time: testEndTimeSeconds,
        limit: 10,
      }),
    result => {
      if (!result.trades || !Array.isArray(result.trades)) {
        throw new Error('Response must have trades array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
    }
  );

  await runTest(
    'Kalshi: Get Orderbooks',
    () =>
      dome.kalshi.markets.getOrderbooks({
        ticker: testMarketTicker,
        start_time: testStartTime,
        end_time: testEndTime,
        limit: 10,
      }),
    result => {
      if (!result.snapshots || !Array.isArray(result.snapshots)) {
        throw new Error('Response must have snapshots array');
      }
      if (!result.pagination) {
        throw new Error('Response must have pagination object');
      }
      if (result.snapshots.length > 0) {
        const snapshot = result.snapshots[0];
        if (!snapshot.orderbook) {
          throw new Error('Snapshot must have orderbook object');
        }
        if (!Array.isArray(snapshot.orderbook.yes)) {
          throw new Error('Orderbook must have yes array');
        }
        if (!Array.isArray(snapshot.orderbook.no)) {
          throw new Error('Orderbook must have no array');
        }
      }
    }
  );

  // ===== MATCHING MARKETS ENDPOINTS =====
  console.log('🔗 Testing Matching Markets Endpoints...\n');

  await runTest(
    'Matching Markets: Get by Polymarket slug',
    () =>
      dome.matchingMarkets.getMatchingMarkets({
        polymarket_market_slug: [testMatchingMarketSlug],
      }),
    result => {
      if (!result.markets || typeof result.markets !== 'object') {
        throw new Error('Response must have markets object');
      }
      const marketKeys = Object.keys(result.markets);
      if (marketKeys.length === 0) {
        throw new Error('Markets object should not be empty');
      }
    }
  );

  await runTest(
    'Matching Markets: Get by Kalshi ticker',
    () =>
      dome.matchingMarkets.getMatchingMarkets({
        kalshi_event_ticker: [testMatchingEventTicker],
      }),
    result => {
      if (!result.markets || typeof result.markets !== 'object') {
        throw new Error('Response must have markets object');
      }
    }
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

  await runTest(
    'Matching Markets: Get by sport and date (NHL)',
    () =>
      dome.matchingMarkets.getMatchingMarketsBySport({
        sport: 'nhl',
        date: '2025-10-20',
      }),
    result => {
      if (!result.markets || typeof result.markets !== 'object') {
        throw new Error('Response must have markets object');
      }
      if (typeof result.sport !== 'string') {
        throw new Error('Response must have sport as string');
      }
      if (typeof result.date !== 'string') {
        throw new Error('Response must have date as string');
      }
    }
  );

  await runTest(
    'Matching Markets: Get by sport and date (CBB)',
    () =>
      dome.matchingMarkets.getMatchingMarketsBySport({
        sport: 'cbb',
        date: '2025-12-20',
      }),
    result => {
      if (!result.markets || typeof result.markets !== 'object') {
        throw new Error('Response must have markets object');
      }
      if (typeof result.sport !== 'string') {
        throw new Error('Response must have sport as string');
      }
    }
  );

  // ===== CRYPTO PRICES ENDPOINTS =====
  console.log('💰 Testing Crypto Prices Endpoints...\n');

  await runTest(
    'Crypto Prices: Get Binance Prices (latest)',
    () =>
      dome.cryptoPrices.getBinancePrices({
        currency: testBinanceCurrency,
      }),
    result => {
      if (!result.prices || !Array.isArray(result.prices)) {
        throw new Error('Response must have prices array');
      }
      if (result.prices.length === 0) {
        throw new Error('Prices array should not be empty');
      }
      const price = result.prices[0];
      if (typeof price.symbol !== 'string') {
        throw new Error('Price must have symbol as string');
      }
      if (typeof price.value === 'undefined') {
        throw new Error('Price must have value');
      }
      if (typeof price.timestamp !== 'number') {
        throw new Error('Price must have timestamp as number');
      }
    }
  );

  await runTest(
    'Crypto Prices: Get Binance Prices (with time range)',
    () =>
      dome.cryptoPrices.getBinancePrices({
        currency: testBinanceCurrency,
        start_time: testCryptoStartTime,
        end_time: testCryptoEndTime,
        limit: 10,
      }),
    result => {
      if (!result.prices || !Array.isArray(result.prices)) {
        throw new Error('Response must have prices array');
      }
      if (typeof result.total !== 'number') {
        throw new Error('Response must have total as number');
      }
    }
  );

  await runTest(
    'Crypto Prices: Get Chainlink Prices (latest)',
    () =>
      dome.cryptoPrices.getChainlinkPrices({
        currency: testChainlinkCurrency,
      }),
    result => {
      if (!result.prices || !Array.isArray(result.prices)) {
        throw new Error('Response must have prices array');
      }
      if (result.prices.length === 0) {
        throw new Error('Prices array should not be empty');
      }
      const price = result.prices[0];
      if (typeof price.symbol !== 'string') {
        throw new Error('Price must have symbol as string');
      }
      if (typeof price.value === 'undefined') {
        throw new Error('Price must have value');
      }
      if (typeof price.timestamp !== 'number') {
        throw new Error('Price must have timestamp as number');
      }
    }
  );

  await runTest(
    'Crypto Prices: Get Chainlink Prices (with time range)',
    () =>
      dome.cryptoPrices.getChainlinkPrices({
        currency: testChainlinkCurrency,
        start_time: testCryptoStartTime,
        end_time: testCryptoEndTime,
        limit: 10,
      }),
    result => {
      if (!result.prices || !Array.isArray(result.prices)) {
        throw new Error('Response must have prices array');
      }
      if (typeof result.total !== 'number') {
        throw new Error('Response must have total as number');
      }
    }
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
