import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { WagmiProvider } from '@/providers/WagmiProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'External Wallet Trading - Dome SDK Example',
  description:
    'Trade on Polymarket using external wallets with Safe smart accounts',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider>{children}</WagmiProvider>
      </body>
    </html>
  );
}
