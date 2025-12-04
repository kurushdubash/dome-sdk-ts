#!/bin/bash
# Comprehensive test suite for third-party SDK usage

echo "=================================="
echo "Third-Party SDK Test Suite"
echo "=================================="
echo ""

# Test 1: ESM Import
echo "Test 1: ESM Import"
echo "------------------"
node test-import.mjs
if [ $? -ne 0 ]; then
  echo "❌ ESM import test failed"
  exit 1
fi
echo ""

# Test 2: PRIVY_QUICKSTART Example
echo "Test 2: PRIVY_QUICKSTART.md Example"
echo "------------------------------------"
node test-privy-example.mjs
if [ $? -ne 0 ]; then
  echo "❌ PRIVY_QUICKSTART example test failed"
  exit 1
fi
echo ""

# Test 3: CommonJS Import
echo "Test 3: CommonJS Import"
echo "-----------------------"
node test-cjs.cjs
if [ $? -ne 0 ]; then
  echo "❌ CommonJS import test failed"
  exit 1
fi
echo ""

echo "=================================="
echo "✅ ALL TESTS PASSED!"
echo "=================================="
echo ""
echo "The SDK is ready for third-party users to:"
echo "  • Import via ESM (import)"
echo "  • Import via CommonJS (require)"
echo "  • Follow the PRIVY_QUICKSTART.md guide"
echo ""
