# Integration Tests

This directory contains integration tests for the Dome SDK that make live calls to the real API endpoints.

## Running Integration Tests

The integration test script verifies that the SDK works correctly with the actual Dome API by making real HTTP requests to all endpoints.

### Prerequisites

1. A valid Dome API key
2. Node.js and npm installed

### Usage

```bash
# Using yarn (recommended)
yarn integration-test YOUR_API_KEY

# Using npm
npm run integration-test YOUR_API_KEY

# Using ts-node directly
npx ts-node src/tests/integration-test.ts YOUR_API_KEY
```

### Example

```bash
yarn integration-test dome_1234567890abcdef
```

## What the Integration Test Does

The integration test covers all SDK endpoints with various parameter combinations (12 total tests):

### Polymarket Market Endpoints

- ✅ Get market price (current)
- ✅ Get market price (historical with timestamp)
- ✅ Get candlesticks (1 hour intervals)
- ✅ Get candlesticks (1 day intervals)

### Polymarket Wallet Endpoints

- ⏭️ Wallet PnL tests removed (requires specific wallet data)

### Polymarket Orders Endpoints

- ✅ Get orders (by market slug)
- ✅ Get orders (by token ID)
- ✅ Get orders (with time range and pagination)
- ✅ Get orders (by user)

### Matching Markets Endpoints

- ✅ Get matching markets (by Polymarket slug)
- ✅ Get matching markets (by Kalshi ticker)
- ✅ Get matching markets by sport and date (NFL)
- ✅ Get matching markets by sport and date (MLB)

## Test Results

The integration test provides:

- ✅ Pass/fail status for each endpoint
- 📊 Success rate percentage
- 📋 Detailed error messages for failed tests
- 🎯 Summary of all test results

## Notes

- The test uses sample data that may or may not exist in the API
- Some tests may fail due to invalid test data, rate limiting, or network issues
- This is expected behavior for a smoke test
- The important thing is that the SDK structure and HTTP calls work correctly
- Failed tests due to invalid data are not necessarily SDK issues

## Troubleshooting

If tests fail, check:

1. **API Key**: Ensure your API key is valid and has proper permissions
2. **Network**: Check your internet connection
3. **Rate Limiting**: Wait a moment and try again
4. **Test Data**: Some test IDs may not exist in the API (this is normal)

The integration test is designed to be a smoke test - it verifies the SDK works with the real API, not that all test data exists.
