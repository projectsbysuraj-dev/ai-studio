import { useState, useEffect, useCallback } from 'react';
import {
  AppSettings,
  ThemeSettings,
  UserProfile,
} from './types';
import {
  getCurrentUser,
  getStoredSettings,
  getStoredTheme,
  subscribeRealtime,
  processReferralJoin,
} from './services/store';
import { initTelegramApp } from './services/telegram';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { InviteScreen } from './components/InviteScreen';
import { WalletScreen } from './components/WalletScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { AdminPortal } from './components/AdminPortal';

function checkIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path === '/admin' ||
    path.startsWith('/admin') ||
    hash === '#/admin' ||
    hash.startsWith('#/admin') ||
    hash === '#admin'
  );
}

export default function App() {
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminRoute());
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [theme, setTheme] = useState<ThemeSettings>(getStoredTheme());

  const handleNavigateToUserApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setIsAdminRoute(false);
  }, []);

  useEffect(() => {
    initTelegramApp();
    // Synchronize user immediately after Telegram WebApp initialization
    setUser(getCurrentUser());
    const tgTimer = setTimeout(() => {
      setUser(getCurrentUser());
    }, 250);

    // 1. Check for incoming referral in URL (?ref=123 or ?start=ref_123)
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const refParam = searchParams.get('ref') || searchParams.get('start');
        if (refParam) {
          const currentUser = getCurrentUser();
          processReferralJoin(refParam, currentUser.id);
        }

        // Also check window.Telegram WebApp start_param if available
        const tgWebApp = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } }).Telegram?.WebApp;
        const tgStartParam = tgWebApp?.initDataUnsafe?.start_param;
        if (tgStartParam) {
          const currentUser = getCurrentUser();
          processReferralJoin(tgStartParam, currentUser.id);
        }
      } catch (e) {
        console.warn('Referral check notice:', e);
      }
    }

    // 2. Listen to route / URL changes (popstate & hashchange)
    const handleUrlChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // 3. Subscribe to real-time events across all tabs, storage, and Firebase
    const unsubscribe = subscribeRealtime(() => {
      setUser(getCurrentUser());
      setSettings(getStoredSettings());
      setTheme(getStoredTheme());
    });

    return () => {
      clearTimeout(tgTimer);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // Dedicated Admin Portal at /admin
  // -------------------------------------------------------------
  if (isAdminRoute) {
    return (
      <AdminPortal
        settings={settings}
        theme={theme}
        onNavigateToUserApp={handleNavigateToUserApp}
      />
    );
  }

  // -------------------------------------------------------------
  // User Panel: Clean Telegram Mini App (0 Admin traces)
  // -------------------------------------------------------------
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start transition-colors duration-500 overflow-x-hidden"
      style={{
        background: `linear-gradient(180deg, ${theme.bgGradientStart} 0%, #0369a1 40%, #082f49 100%)`,
      }}
    >
      {/* Mobile Telegram App View Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col px-4 pt-2 pb-16 relative">
        {/* Header */}
        <Header user={user} settings={settings} theme={theme} />

        {/* Tab Views */}
        <main className="flex-1 w-full mt-2">
          {activeTab === 'home' && (
            <HomeScreen
              user={user}
              settings={settings}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'invite' && (
            <InviteScreen user={user} settings={settings} />
          )}

          {activeTab === 'wallet' && (
            <WalletScreen
              user={user}
              settings={settings}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              user={user}
              settings={settings}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
        </main>

        {/* Floating Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
        />
      </div>
    </div>
  );
}
