'use client';

import { ReactNode } from 'react';
import {
  WagmiProvider as WagmiConfigProvider,
  createConfig,
  http,
} from 'wagmi';
import { polygon } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create wagmi config
const config = createConfig({
  chains: [polygon],
  connectors: [
    injected(), // MetaMask, Rabby, etc.
  ],
  transports: {
    [polygon.id]: http(
      process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com'
    ),
  },
});

// Create query client
const queryClient = new QueryClient();

interface WagmiProviderProps {
  children: ReactNode;
}

export function WagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiConfigProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiConfigProvider>
  );
}
