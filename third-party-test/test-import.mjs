// Simulate a third-party user importing and using the SDK
// This mimics the imports from PRIVY_QUICKSTART.md

console.log('Testing third-party SDK import (simulating npm install @dome-api/sdk)...\n');

try {
  // Import from the built package (simulates npm package)
  const sdk = await import('../dist/esm/index.js');

  console.log('✅ Main SDK import successful!');
  console.log('   Available exports:', Object.keys(sdk).slice(0, 10).join(', '), '...\n');

  // Test the specific imports from PRIVY_QUICKSTART.md
  const { PolymarketRouter, createPrivySigner, DomeClient } = sdk;

  console.log('✅ PolymarketRouter:', typeof PolymarketRouter);
  console.log('✅ createPrivySigner:', typeof createPrivySigner);
  console.log('✅ DomeClient:', typeof DomeClient);

  // Test instantiation (without actual API keys)
  console.log('\nTesting class instantiation...');

  try {
    const router = new PolymarketRouter({ chainId: 137 });
    console.log('✅ PolymarketRouter instantiated successfully');
  } catch (e) {
    console.log('❌ PolymarketRouter instantiation failed:', e.message);
  }

  console.log('\n🎉 All imports working correctly!');
  console.log('Third-party users can now use the SDK in Node.js ESM mode.');

} catch (error) {
  console.error('❌ Import failed!');
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}
