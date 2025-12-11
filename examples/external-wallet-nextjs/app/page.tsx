'use client';

import { ConnectWallet } from './components/ConnectWallet';
import { TradingSession } from './components/TradingSession';
import { PlaceOrder } from './components/PlaceOrder';

export default function Home() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">External Wallet Trading</h1>
            <p className="text-gray-600 mt-1">
              Trade on Polymarket using Safe smart accounts
            </p>
          </div>
          <ConnectWallet />
        </div>

        {/* Info */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold text-blue-900">How it works</h2>
          <ol className="mt-2 space-y-1 text-sm text-blue-800">
            <li>1. Connect your wallet (MetaMask, Rabby, etc.)</li>
            <li>2. Start a trading session (deploys Safe + sets allowances)</li>
            <li>3. Fund your Safe address with USDC</li>
            <li>4. Place orders on Polymarket markets</li>
          </ol>
        </div>

        {/* Trading Session */}
        <TradingSession />

        {/* Place Order */}
        <PlaceOrder />

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-8 border-t">
          <p>
            Built with{' '}
            <a
              href="https://github.com/domeapi/dome-sdk-ts"
              className="text-blue-500 hover:underline"
            >
              Dome SDK
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
