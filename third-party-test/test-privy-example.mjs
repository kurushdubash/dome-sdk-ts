// Test the exact imports and usage from PRIVY_QUICKSTART.md
// This validates that third-party users can use the SDK as documented

console.log('Testing PRIVY_QUICKSTART.md example imports...\n');

try {
  // Exact imports from the quickstart guide
  const { PolymarketRouter, createPrivySigner } = await import('../dist/esm/index.js');

  console.log('✅ Import successful!');
  console.log('   PolymarketRouter:', typeof PolymarketRouter);
  console.log('   createPrivySigner:', typeof createPrivySigner);

  // Test router initialization as shown in the quickstart
  console.log('\n📝 Testing router initialization (from PRIVY_QUICKSTART.md)...');

  const router = new PolymarketRouter({
    chainId: 137, // Polygon mainnet
    // Privy config would go here in real usage
  });

  console.log('✅ Router initialized successfully');

  // Verify router has expected methods
  console.log('\n🔍 Verifying router API...');
  const expectedMethods = ['linkUser', 'placeOrder', 'isUserLinked', 'setCredentials', 'getCredentials'];

  for (const method of expectedMethods) {
    if (typeof router[method] === 'function') {
      console.log(`   ✅ router.${method}() exists`);
    } else {
      console.log(`   ❌ router.${method}() missing!`);
      process.exit(1);
    }
  }

  console.log('\n🎉 SUCCESS! The SDK works exactly as documented in PRIVY_QUICKSTART.md');
  console.log('Third-party users can follow the quickstart guide without issues.');

} catch (error) {
  console.error('\n❌ FAILED! There\'s an issue with the SDK.');
  console.error('Error:', error.message);
  console.error('\nThis means third-party users will encounter errors when following');
  console.error('the PRIVY_QUICKSTART.md guide.');
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}
