/**
 * Telegram WebApp Integration & Detection
 */

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe?: {
    query_id?: string;
    user?: TelegramUser;
    auth_date?: string;
    hash?: string;
  };
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function isTelegramEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData);
}

export function initTelegramApp(): void {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp init warning:', e);
    }
  }
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'medium'): void {
  try {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success' || type === 'error') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
      } else {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      }
    }
  } catch (e) {
    // Ignore fallback
  }
}

function cacheTelegramUser(user: TelegramUser): void {
  try {
    localStorage.setItem('rg_telegram_user_cache', JSON.stringify(user));
  } catch (e) {
    // Ignore
  }
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null;

  // 1. Direct WebApp object from Telegram WebApp SDK
  if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    const u = window.Telegram.WebApp.initDataUnsafe.user;
    cacheTelegramUser(u);
    return u;
  }

  // 2. Parse from window.Telegram.WebApp.initData raw query string
  if (window.Telegram?.WebApp?.initData) {
    try {
      const params = new URLSearchParams(window.Telegram.WebApp.initData);
      const userRaw = params.get('user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw) as TelegramUser;
        if (parsed && parsed.id) {
          cacheTelegramUser(parsed);
          return parsed;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 3. Parse from URL hash (#tgWebAppData=... or query params inside hash)
  try {
    const rawHash = window.location.hash.replace(/^#/, '');
    if (rawHash) {
      const hashParams = new URLSearchParams(rawHash);
      const tgData = hashParams.get('tgWebAppData');
      if (tgData) {
        const innerParams = new URLSearchParams(tgData);
        const userRaw = innerParams.get('user');
        if (userRaw) {
          const parsed = JSON.parse(userRaw) as TelegramUser;
          if (parsed && parsed.id) {
            cacheTelegramUser(parsed);
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 4. Parse from window.location.search (?tgWebAppData=...)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const tgData = searchParams.get('tgWebAppData');
    if (tgData) {
      const innerParams = new URLSearchParams(tgData);
      const userRaw = innerParams.get('user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw) as TelegramUser;
        if (parsed && parsed.id) {
          cacheTelegramUser(parsed);
          return parsed;
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  // 5. Fallback: check session/local storage cache
  try {
    const cached = localStorage.getItem('rg_telegram_user_cache');
    if (cached) {
      const parsed = JSON.parse(cached) as TelegramUser;
      if (parsed && parsed.id) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore
  }

  return null;
}

export function openExternalOrTelegramLink(url: string): void {
  if (typeof window !== 'undefined') {
    if (window.Telegram?.WebApp?.openTelegramLink && (url.includes('t.me') || url.startsWith('tg://'))) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }
}
