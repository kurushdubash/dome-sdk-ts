// Test CommonJS import (for users not using ESM)
console.log('Testing CommonJS import...\n');

try {
  const sdk = require('../dist/cjs/index.js');

  console.log('✅ CommonJS import successful!');
  console.log('   Available exports:', Object.keys(sdk).slice(0, 10).join(', '), '...\n');

  const { PolymarketRouter, createPrivySigner, DomeClient } = sdk;

  console.log('✅ PolymarketRouter:', typeof PolymarketRouter);
  console.log('✅ createPrivySigner:', typeof createPrivySigner);
  console.log('✅ DomeClient:', typeof DomeClient);

  // Test instantiation
  const router = new PolymarketRouter({ chainId: 137 });
  console.log('✅ PolymarketRouter instantiated successfully');

  console.log('\n🎉 CommonJS import working correctly!');
  console.log('SDK works for both ESM and CommonJS users.');

} catch (error) {
  console.error('❌ CommonJS import failed!');
  console.error('Error:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}
