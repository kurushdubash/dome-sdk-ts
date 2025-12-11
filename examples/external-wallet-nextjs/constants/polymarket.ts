// API URLs
export const RELAYER_URL = 'https://relayer-v2.polymarket.com/';
export const CLOB_API_URL = 'https://clob.polymarket.com';

// RPC URLs
export const POLYGON_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://polygon-rpc.com';

// Remote signing - uses our Next.js API route
export const REMOTE_SIGNING_URL = () =>
  typeof window !== 'undefined'
    ? `${window.location.origin}/api/polymarket/sign`
    : '/api/polymarket/sign';

// Chain config
export const POLYGON_CHAIN_ID = 137;

// Session storage key
export const SESSION_STORAGE_KEY = 'dome_trading_session';
