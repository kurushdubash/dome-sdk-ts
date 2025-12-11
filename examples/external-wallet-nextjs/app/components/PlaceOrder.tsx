'use client';

import { useTradingSession } from '@/hooks/useTradingSession';

export function PlaceOrder() {
  const { session, isSessionComplete, safeAddress } = useTradingSession();

  if (!isSessionComplete) {
    return (
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-gray-600">
          Initialize your trading session to place orders
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded space-y-4">
      <h2 className="text-xl font-bold">Ready to Trade</h2>

      <div className="p-4 bg-green-50 rounded space-y-3">
        <p className="text-green-800">
          Your Safe wallet is set up and ready for trading on Polymarket!
        </p>

        <div className="space-y-2">
          <p className="text-sm text-green-700">
            <strong>Next steps:</strong>
          </p>
          <ol className="list-decimal list-inside text-sm text-green-700 space-y-1">
            <li>
              Send USDC to your Safe address:{' '}
              <code className="bg-green-100 px-1 rounded text-xs">
                {safeAddress}
              </code>
            </li>
            <li>Use the Polymarket CLOB client to place orders</li>
            <li>Your EOA signs orders, but funds come from the Safe wallet</li>
          </ol>
        </div>

        <div className="pt-2">
          <a
            href={`https://polygonscan.com/address/${safeAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View Safe on Polygonscan →
          </a>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Order placement UI coming soon. For now, you
          can use the Polymarket CLOB client directly with your derived
          credentials.
        </p>
      </div>
    </div>
  );
}
