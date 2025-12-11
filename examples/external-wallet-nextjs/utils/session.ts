import { SESSION_STORAGE_KEY } from '@/constants/polymarket';

/**
 * Trading session stored in localStorage
 */
export interface TradingSession {
  eoaAddress: string;
  safeAddress: string;
  isSafeDeployed: boolean;
  hasApiCredentials: boolean;
  hasAllowances: boolean;
  apiCredentials?: {
    key: string;
    secret: string;
    passphrase: string;
  };
  lastChecked: number;
}

/**
 * Load trading session from localStorage
 */
export function loadSession(eoaAddress: string): TradingSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = `${SESSION_STORAGE_KEY}_${eoaAddress.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const session = JSON.parse(stored) as TradingSession;

    // Verify session is for this address
    if (session.eoaAddress.toLowerCase() !== eoaAddress.toLowerCase()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Save trading session to localStorage
 */
export function saveSession(eoaAddress: string, session: TradingSession): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${SESSION_STORAGE_KEY}_${eoaAddress.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Clear trading session from localStorage
 */
export function clearSession(eoaAddress: string): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `${SESSION_STORAGE_KEY}_${eoaAddress.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}
