'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { providers } from 'ethers';
import { RelayClient } from '@polymarket/builder-relayer-client';
import { deriveSafe } from '@polymarket/builder-relayer-client/dist/builder/derive';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import {
  loadSession,
  saveSession,
  clearSession,
  TradingSession,
} from '@/utils/session';

export type SessionStep =
  | 'idle'
  | 'checking'
  | 'deploying'
  | 'allowances'
  | 'complete';

const POLYGON_CHAIN_ID = 137;
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';

// Get the signing URL - use local API route which proxies to Dome's builder signer
const getSigningUrl = () =>
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/polymarket/sign`
    : '/api/polymarket/sign';

/**
 * Hook for managing the Polymarket trading session with Safe wallets
 */
export function useTradingSession() {
  const { address: eoaAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [session, setSession] = useState<TradingSession | null>(null);
  const [currentStep, setCurrentStep] = useState<SessionStep>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [relayClient, setRelayClient] = useState<RelayClient | null>(null);

  // Derive Safe address from EOA
  const safeAddress = useMemo(() => {
    if (!eoaAddress) return null;
    try {
      const config = getContractConfig(POLYGON_CHAIN_ID);
      return deriveSafe(eoaAddress, config.SafeContracts.SafeFactory);
    } catch (err) {
      console.error('Error deriving Safe address:', err);
      return null;
    }
  }, [eoaAddress]);

  // Load session from localStorage when address changes
  useEffect(() => {
    if (!eoaAddress) {
      setSession(null);
      setCurrentStep('idle');
      setError(null);
      return;
    }

    const stored = loadSession(eoaAddress);
    if (stored) {
      setSession(stored);
      setCurrentStep('complete');
    }
  }, [eoaAddress]);

  // Check if session is complete
  const isSessionComplete = useMemo(() => {
    return session?.isSafeDeployed && session?.hasAllowances;
  }, [session]);

  // Initialize RelayClient
  const initializeRelayClient = useCallback(async () => {
    if (!eoaAddress || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const provider = new providers.Web3Provider(walletClient as any);
    const signer = provider.getSigner();

    const builderConfig = new BuilderConfig({
      remoteBuilderConfig: {
        url: getSigningUrl(),
      },
    });

    const client = new RelayClient(
      RELAYER_URL,
      POLYGON_CHAIN_ID,
      signer,
      builderConfig
    );

    setRelayClient(client);
    return client;
  }, [eoaAddress, walletClient]);

  // Check if Safe is deployed
  const checkSafeDeployed = useCallback(
    async (client: RelayClient, safeAddr: string): Promise<boolean> => {
      try {
        const deployed = await (client as any).getDeployed(safeAddr);
        return deployed;
      } catch (err) {
        console.warn('API check failed, falling back to RPC', err);
        if (walletClient) {
          const provider = new providers.Web3Provider(walletClient as any);
          const code = await provider.getCode(safeAddr);
          return code !== '0x' && code.length > 2;
        }
        return false;
      }
    },
    [walletClient]
  );

  // Deploy Safe
  const deploySafe = useCallback(
    async (client: RelayClient): Promise<string> => {
      const response = await client.deploy();
      const result = await response.wait();

      if (!result) {
        throw new Error('Safe deployment failed');
      }

      return result.proxyAddress;
    },
    []
  );

  // Set allowances
  const setAllowances = useCallback(async (client: RelayClient) => {
    // The RelayClient handles setting approvals for trading
    const clientAny = client as any;
    if (typeof clientAny.setAllowances === 'function') {
      await clientAny.setAllowances();
    } else if (typeof clientAny.approveAll === 'function') {
      await clientAny.approveAll();
    }
  }, []);

  // Initialize a new trading session
  const initializeSession = useCallback(async () => {
    if (!eoaAddress || !walletClient || !safeAddress) {
      throw new Error('Wallet not connected');
    }

    setIsInitializing(true);
    setCurrentStep('checking');
    setError(null);

    try {
      // Initialize relay client
      console.log('Initializing relay client...');
      const client = await initializeRelayClient();

      // Check if Safe is deployed
      console.log('Checking Safe deployment...');
      let deployed = await checkSafeDeployed(client, safeAddress);

      if (!deployed) {
        // Deploy Safe
        setCurrentStep('deploying');
        console.log('Deploying Safe wallet...');
        await deploySafe(client);
        deployed = true;
      }

      // Set allowances
      setCurrentStep('allowances');
      console.log('Setting allowances...');
      await setAllowances(client);

      // Create session
      const newSession: TradingSession = {
        eoaAddress,
        safeAddress,
        isSafeDeployed: true,
        hasApiCredentials: false, // API credentials derived separately if needed
        hasAllowances: true,
        lastChecked: Date.now(),
      };

      setSession(newSession);
      saveSession(eoaAddress, newSession);
      setCurrentStep('complete');

      console.log('Session initialized successfully!');
      return newSession;
    } catch (err) {
      console.error('Session initialization error:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setCurrentStep('idle');
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [
    eoaAddress,
    walletClient,
    safeAddress,
    initializeRelayClient,
    checkSafeDeployed,
    deploySafe,
    setAllowances,
  ]);

  // End the trading session
  const endSession = useCallback(() => {
    if (!eoaAddress) return;

    clearSession(eoaAddress);
    setSession(null);
    setRelayClient(null);
    setCurrentStep('idle');
    setError(null);
  }, [eoaAddress]);

  return {
    session,
    currentStep,
    error,
    isConnected,
    isInitializing,
    isSessionComplete,
    eoaAddress,
    safeAddress,
    relayClient,
    initializeSession,
    endSession,
  };
}
