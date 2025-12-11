'use client';

import { useTradingSession } from '@/hooks/useTradingSession';

export function TradingSession() {
  const {
    session,
    currentStep,
    error,
    isConnected,
    isInitializing,
    isSessionComplete,
    eoaAddress,
    safeAddress,
    initializeSession,
    endSession,
  } = useTradingSession();

  if (!isConnected) {
    return (
      <div className="p-4 bg-gray-100 rounded">
        <p className="text-gray-600">Connect your wallet to start trading</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded space-y-4">
      <h2 className="text-xl font-bold">Trading Session</h2>

      {/* EOA Address */}
      <div className="space-y-1">
        <p className="text-sm text-gray-600">EOA Address (Signer)</p>
        <p className="font-mono text-sm bg-gray-100 p-2 rounded">
          {eoaAddress}
        </p>
      </div>

      {/* Safe Address */}
      {safeAddress && (
        <div className="space-y-1">
          <p className="text-sm text-gray-600">Safe Address (Funds)</p>
          <p className="font-mono text-sm bg-gray-100 p-2 rounded">
            {safeAddress}
          </p>
        </div>
      )}

      {/* Session Status */}
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Session Status</p>
        <div className="flex gap-2">
          <StatusBadge
            label="Safe Deployed"
            active={session?.isSafeDeployed ?? false}
          />
          <StatusBadge
            label="Allowances Set"
            active={session?.hasAllowances ?? false}
          />
          <StatusBadge
            label="API Credentials"
            active={session?.hasApiCredentials ?? false}
          />
        </div>
      </div>

      {/* Current Step */}
      {isInitializing && (
        <div className="p-3 bg-blue-50 rounded">
          <p className="text-blue-700">
            {currentStep === 'checking' && 'Checking session status...'}
            {currentStep === 'deploying' && 'Deploying Safe wallet...'}
            {currentStep === 'allowances' && 'Setting token allowances...'}
            {currentStep === 'credentials' && 'Deriving API credentials...'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 rounded">
          <p className="text-red-700">{error.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isSessionComplete ? (
          <button
            onClick={() => initializeSession()}
            disabled={isInitializing}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isInitializing ? 'Initializing...' : 'Start Trading Session'}
          </button>
        ) : (
          <>
            <span className="px-4 py-2 bg-green-100 text-green-700 rounded">
              Ready to Trade
            </span>
            <button
              onClick={() => endSession()}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              End Session
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`px-2 py-1 text-xs rounded ${
        active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {label}
    </span>
  );
}
