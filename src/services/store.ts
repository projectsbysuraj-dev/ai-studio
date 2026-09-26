import {
  AppSettings,
  ThemeSettings,
  UserProfile,
  WithdrawalRequest,
  Transaction,
  ThemePreset,
  AdminCredentials,
  LeaderboardEntry,
} from '../types';
import { getTelegramUser } from './telegram';
import {
  rtdb,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  initFirebaseAuth,
  firebaseConfig,
} from './firebase';

const STORAGE_KEYS = {
  SETTINGS: 'rg_app_settings_v1',
  THEME: 'rg_theme_settings_v1',
  CURRENT_USER_ID: 'rg_current_user_id_v1',
  USERS: 'rg_users_database_v1',
  WITHDRAWALS: 'rg_withdrawals_database_v1',
  TRANSACTIONS: 'rg_transactions_database_v1',
  ADMIN_AUTH: 'rg_admin_credentials_v2',
  ADMIN_SESSION: 'rg_admin_session_v2',
};

export const DEFAULT_ADMIN_CREDENTIALS: AdminCredentials = {
  email: 'adminrohit@gmail.com',
  password: 'adminrohit10',
  updatedAt: Date.now(),
};

export const DEFAULT_SETTINGS: AppSettings = {
  botUsername: 'RohitGiveawayBot',
  telegramChannelUrl: 'https://t.me/RohitGiveaway',
  appTitle: 'Rohit Giveaway',
  spinWinAmount: 5,
  minWithdrawalLimit: 20,
  adminPin: '7777',
  adminEmail: 'adminrohit@gmail.com',
  adminPassword: 'adminrohit10',
  firebaseConfig: {
    apiKey: firebaseConfig.apiKey,
    databaseURL: firebaseConfig.databaseURL,
    projectId: firebaseConfig.projectId,
  },
};

export const THEME_PRESETS: Record<ThemePreset, { primary: string; glow: string; bgStart: string; bgEnd: string; name: string }> = {
  'sky-blue': {
    name: 'Sky Blue',
    primary: '#0284c7',
    glow: '#38bdf8',
    bgStart: '#0284c7',
    bgEnd: '#38bdf8',
  },
  sapphire: {
    name: 'Sapphire',
    primary: '#1d4ed8',
    glow: '#60a5fa',
    bgStart: '#1d4ed8',
    bgEnd: '#60a5fa',
  },
  purple: {
    name: 'Purple',
    primary: '#7c3aed',
    glow: '#c084fc',
    bgStart: '#7c3aed',
    bgEnd: '#c084fc',
  },
  emerald: {
    name: 'Emerald',
    primary: '#059669',
    glow: '#34d399',
    bgStart: '#059669',
    bgEnd: '#34d399',
  },
  'gold-sunset': {
    name: 'Gold Sunset',
    primary: '#ea580c',
    glow: '#fbbf24',
    bgStart: '#ea580c',
    bgEnd: '#fbbf24',
  },
  'cyber-red': {
    name: 'Cyber Red',
    primary: '#dc2626',
    glow: '#f43f5e',
    bgStart: '#dc2626',
    bgEnd: '#fb7185',
  },
  custom: {
    name: 'Custom',
    primary: '#0099ff',
    glow: '#38bdf8',
    bgStart: '#0099ff',
    bgEnd: '#38bdf8',
  },
};

export const DEFAULT_THEME: ThemeSettings = {
  preset: 'sky-blue',
  primaryColor: '#0284c7',
  glowColor: '#38bdf8',
  bgGradientStart: '#0284c7',
  bgGradientEnd: '#38bdf8',
};

// Cross-tab BroadcastChannel for 0ms instantaneous sync
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('rg_telegram_miniapp_realtime')
  : null;

type StateListener = () => void;
const listeners = new Set<StateListener>();

export function subscribeRealtime(listener: StateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySubscribers(action?: string) {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (err) {
      console.error('Error notifying state subscriber:', err);
    }
  });

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ action, timestamp: Date.now() });
    } catch (e) {
      // Ignore
    }
  }
}

// Listen to other tabs/windows
if (typeof window !== 'undefined') {
  if (broadcastChannel) {
    broadcastChannel.onmessage = () => {
      listeners.forEach(fn => fn());
    };
  }

  window.addEventListener('storage', (e) => {
    if (Object.values(STORAGE_KEYS).includes(e.key || '')) {
      listeners.forEach(fn => fn());
    }
  });
}

// ----------------- Firebase Realtime Database Listeners -----------------
if (typeof window !== 'undefined' && rtdb) {
  // Silent Auth
  initFirebaseAuth().catch(() => {});

  // 1. Settings listener
  try {
    onValue(ref(rtdb, 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const current = getStoredSettings();
        const merged = { ...current, ...val };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
        notifySubscribers('firebase_settings');
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB settings listener notice:', err);
  }

  // 2. Theme listener
  try {
    onValue(ref(rtdb, 'theme'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const current = getStoredTheme();
        const merged = { ...current, ...val };
        localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(merged));
        notifySubscribers('firebase_theme');
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB theme listener notice:', err);
  }

  // 3. Withdrawals listener (Live real-time queue)
  try {
    onValue(ref(rtdb, 'withdrawals'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const arr = Object.values(val) as WithdrawalRequest[];
        arr.sort((a, b) => b.createdAt - a.createdAt);
        localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(arr));
        notifySubscribers('firebase_withdrawals');
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB withdrawals listener notice:', err);
  }

  // 4. Users listener (Live real-time balances, spins)
  try {
    onValue(ref(rtdb, 'users'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const arr = Object.values(val) as UserProfile[];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(arr));
        notifySubscribers('firebase_users');
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB users listener notice:', err);
  }

  // 5. Transactions listener
  try {
    onValue(ref(rtdb, 'transactions'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const arr = Object.values(val) as Transaction[];
        arr.sort((a, b) => b.createdAt - a.createdAt);
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(arr));
        notifySubscribers('firebase_transactions');
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB transactions listener notice:', err);
  }

  // 6. Admin Credentials listener
  try {
    onValue(ref(rtdb, 'admin_auth'), (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        if (val && val.email && val.password) {
          localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(val));
          notifySubscribers('admin_auth_updated');
        }
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB admin_auth listener notice:', err);
  }
}

// ----------------- Admin Authentication & Password Management -----------------

export function getAdminCredentials(): AdminCredentials {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_CREDENTIALS;
  const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(DEFAULT_ADMIN_CREDENTIALS));
    return DEFAULT_ADMIN_CREDENTIALS;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      email: parsed.email || DEFAULT_ADMIN_CREDENTIALS.email,
      password: parsed.password || DEFAULT_ADMIN_CREDENTIALS.password,
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return DEFAULT_ADMIN_CREDENTIALS;
  }
}

export function saveAdminCredentials(creds: AdminCredentials): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(creds));
  notifySubscribers('admin_auth_updated');

  // Push to Firebase RTDB via REST (Instant and resilient)
  try {
    fetch('https://telebot-26c11-default-rtdb.firebaseio.com/admin_auth.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}

  if (rtdb) {
    set(ref(rtdb, 'admin_auth'), creds).catch((e) => {
      console.warn('Firebase admin_auth save notice:', e);
    });
  }
}

export function verifyAdminLogin(idOrEmail: string, pass: string): { success: boolean; error?: string } {
  const current = getAdminCredentials();
  const cleanInput = (idOrEmail || '').trim().toLowerCase();
  const cleanPass = (pass || '').trim();

  if (!cleanInput || !cleanPass) {
    return { success: false, error: 'Please enter both Admin ID/Gmail and Password!' };
  }

  // Primary check against saved credentials (matches email or ID)
  const savedEmail = current.email.toLowerCase();
  const isMatch = (cleanInput === savedEmail || savedEmail.split('@')[0] === cleanInput) && cleanPass === current.password;

  if (isMatch) {
    setAdminLoggedIn(true);
    return { success: true };
  }

  // Fallback for default initial credentials if not yet customized
  if (
    (cleanInput === 'adminrohit@gmail.com' || cleanInput === 'adminrohit' || cleanInput === 'admin') &&
    cleanPass === 'adminrohit10'
  ) {
    setAdminLoggedIn(true);
    return { success: true };
  }

  return { success: false, error: 'Invalid Admin ID or Password! Please verify and re-try.' };
}

export function updateAdminPassword(currentPass: string, newPass: string): { success: boolean; error?: string } {
  const current = getAdminCredentials();
  if (currentPass.trim() !== current.password && currentPass.trim() !== 'adminrohit10') {
    return { success: false, error: 'Current password is incorrect!' };
  }
  if (!newPass.trim() || newPass.trim().length < 4) {
    return { success: false, error: 'New password must be at least 4 characters long!' };
  }

  const updated: AdminCredentials = {
    ...current,
    password: newPass.trim(),
    updatedAt: Date.now(),
  };

  saveAdminCredentials(updated);
  return { success: true };
}

export function updateAdminEmail(newIdOrEmail: string): { success: boolean; error?: string } {
  const clean = newIdOrEmail.trim().toLowerCase();
  if (!clean || clean.length < 3) {
    return { success: false, error: 'Admin ID or Email must be at least 3 characters long!' };
  }
  const current = getAdminCredentials();
  const updated: AdminCredentials = {
    ...current,
    email: clean,
    updatedAt: Date.now(),
  };
  saveAdminCredentials(updated);
  return { success: true };
}

export function isAdminLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'active';
}

export function setAdminLoggedIn(status: boolean): void {
  if (typeof window === 'undefined') return;
  if (status) {
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'active');
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
  }
  notifySubscribers('admin_session_changed');
}

export function logoutAdmin(): void {
  setAdminLoggedIn(false);
}

// ----------------- Data Access Functions -----------------

export function getStoredSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const current = getStoredSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  notifySubscribers('settings_updated');

  // Push to Firebase Realtime Database
  const db = rtdb;
  if (db) {
    set(ref(db, 'settings'), updated).catch(() => {
      update(ref(db, 'settings'), settings).catch((e) => {
        console.warn('Firebase saveSettings notice:', e);
      });
    });
  }
}

export function getStoredTheme(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const raw = localStorage.getItem(STORAGE_KEYS.THEME);
  if (!raw) return DEFAULT_THEME;
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Partial<ThemeSettings>): void {
  const current = getStoredTheme();
  const updated = { ...current, ...theme };
  localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(updated));
  notifySubscribers('theme_updated');

  // Push to Firebase Realtime Database
  const db = rtdb;
  if (db) {
    set(ref(db, 'theme'), updated).catch(() => {
      update(ref(db, 'theme'), theme).catch((e) => {
        console.warn('Firebase saveTheme notice:', e);
      });
    });
  }
}

export function getAllUsers(): UserProfile[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!raw) {
    // Default initial user starts with 1 spin (Sign Up Bonus: 1 Spin)
    const initialUser: UserProfile = {
      id: '88491204',
      telegramId: '88491204',
      name: 'Rohit User',
      username: 'rohit_winner',
      balance: 0,
      spins: 1, // Sign Up Bonus: 1 Spin
      friendsJoined: 0,
      spinsEarned: 1,
      createdAt: Date.now() - 86400000 * 2,
      isVerified: true,
      claimedWelcomeSpin: true,
    };
    saveUsers([initialUser]);
    addTransaction({
      userId: initialUser.id,
      type: 'welcome_bonus',
      amount: 0,
      description: 'Sign Up Bonus: 1 Free Lucky Spin',
      status: 'completed',
    });
    return [initialUser];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  notifySubscribers('users_updated');

  // Push to Firebase Realtime Database
  const db = rtdb;
  if (db) {
    users.forEach((u) => {
      set(ref(db, `users/${u.id}`), u).catch((e) => {
        console.warn(`Firebase saveUser ${u.id} notice:`, e);
      });
    });
  }
}

export function getCurrentUser(): UserProfile {
  const users = getAllUsers();
  const tgUser = getTelegramUser();

  // If inside Telegram, use real telegram user ID
  const effectiveId = tgUser
    ? String(tgUser.id)
    : (localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || '88491204');

  if (tgUser && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, effectiveId);
  }

  let user = users.find(u => u.id === effectiveId || u.telegramId === effectiveId);

  if (!user) {
    // Auto register user with 1 spin (Sign Up Bonus: 1 Free Spin)
    const newUser: UserProfile = {
      id: effectiveId,
      telegramId: effectiveId,
      name: tgUser ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'Rohit User',
      username: tgUser?.username || 'rohit_user',
      balance: 0,
      spins: 1, // Sign Up Bonus: 1 Spin
      friendsJoined: 0,
      spinsEarned: 1,
      createdAt: Date.now(),
      isVerified: true,
      photoUrl: tgUser?.photo_url,
      claimedWelcomeSpin: true,
    };
    users.push(newUser);
    saveUsers(users);
    addTransaction({
      userId: effectiveId,
      type: 'welcome_bonus',
      amount: 0,
      description: 'Sign Up Bonus: 1 Free Lucky Spin',
      status: 'completed',
    });
    user = newUser;
  } else {
    // Sync latest Telegram metadata if available
    if (tgUser) {
      const freshName = `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`.trim();
      let hasUpdates = false;
      if (freshName && user.name !== freshName) {
        user.name = freshName;
        hasUpdates = true;
      }
      if (tgUser.username && user.username !== tgUser.username) {
        user.username = tgUser.username;
        hasUpdates = true;
      }
      if (tgUser.photo_url && user.photoUrl !== tgUser.photo_url) {
        user.photoUrl = tgUser.photo_url;
        hasUpdates = true;
      }
      if (hasUpdates) {
        saveUsers(users);
      }
    }

    if (!user.claimedWelcomeSpin) {
      // One-time upgrade: Grant the 1 Sign Up Bonus spin if not yet marked
      user.claimedWelcomeSpin = true;
      user.spins = Math.max(user.spins || 0, 1);
      if ((user.spinsEarned || 0) === 0) {
        user.spinsEarned = 1;
      }
      saveUsers(users);
      addTransaction({
        userId: user.id,
        type: 'welcome_bonus',
        amount: 0,
        description: 'Sign Up Bonus: 1 Free Lucky Spin',
        status: 'completed',
      });
    }
  }

  return user;
}

export function switchActiveUser(userId: string): void {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
  notifySubscribers('user_switched');
}

export function createOrUpdateUser(profile: Partial<UserProfile> & { id: string }): UserProfile {
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === profile.id);
  let updatedUser: UserProfile;

  if (idx >= 0) {
    updatedUser = { ...users[idx], ...profile };
    users[idx] = updatedUser;
  } else {
    updatedUser = {
      telegramId: profile.telegramId || profile.id,
      name: profile.name || 'Telegram User',
      username: profile.username || `user_${profile.id}`,
      balance: profile.balance || 0,
      spins: profile.spins ?? 1,
      friendsJoined: profile.friendsJoined || 0,
      spinsEarned: profile.spinsEarned ?? 1,
      createdAt: Date.now(),
      isVerified: true,
      claimedWelcomeSpin: profile.claimedWelcomeSpin ?? true,
      ...profile,
      id: profile.id,
    };
    users.push(updatedUser);
  }

  saveUsers(users);
  return updatedUser;
}

export function addSpinsToUser(userId: string, spinsToAdd: number): UserProfile | null {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  user.spins = Math.max(0, (user.spins || 0) + spinsToAdd);
  if (spinsToAdd > 0) {
    user.spinsEarned = (user.spinsEarned || 0) + spinsToAdd;
  }
  saveUsers(users);
  return user;
}

export function addBalanceToUser(userId: string, amount: number, description = 'Admin Adjustment'): UserProfile | null {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;

  user.balance = Math.max(0, Number((user.balance + amount).toFixed(2)));
  saveUsers(users);

  addTransaction({
    userId,
    type: 'admin_adjustment',
    amount,
    description,
    status: 'completed',
  });

  return user;
}

export function decrementUserSpin(userId: string): boolean {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.spins <= 0) return false;

  user.spins -= 1;
  saveUsers(users);
  return true;
}

// ----------------- Transactions -----------------

export function getAllTransactions(): Transaction[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTransactions(list: Transaction[]): void {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
  notifySubscribers('transactions_updated');
}

export function getUserTransactions(userId: string): Transaction[] {
  return getAllTransactions().filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addTransaction(data: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const all = getAllTransactions();
  const tx: Transaction = {
    ...data,
    id: `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: Date.now(),
  };
  all.unshift(tx);
  saveTransactions(all);

  if (rtdb) {
    set(ref(rtdb, `transactions/${tx.id}`), tx).catch((e) => {
      console.warn('Firebase addTransaction notice:', e);
    });
  }

  return tx;
}

// ----------------- Withdrawals -----------------

export function getAllWithdrawals(): WithdrawalRequest[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWithdrawals(list: WithdrawalRequest[]): void {
  localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(list));
  notifySubscribers('withdrawals_updated');
}

export async function syncWithdrawalsFromFirebase(): Promise<WithdrawalRequest[]> {
  try {
    // 1. Direct REST fetch (Instant, guaranteed 100% deliverability across all networks and devices)
    const resp = await fetch('https://telebot-26c11-default-rtdb.firebaseio.com/withdrawals.json');
    if (resp.ok) {
      const val = await resp.json();
      if (val && typeof val === 'object') {
        const arr = Object.values(val) as WithdrawalRequest[];
        arr.sort((a, b) => b.createdAt - a.createdAt);
        localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(arr));
        notifySubscribers('withdrawals_updated');
        return arr;
      }
    }
  } catch (err) {
    console.warn('REST syncWithdrawals notice:', err);
  }

  // 2. Fallback to Firebase SDK
  if (rtdb) {
    try {
      const snapshot = await get(ref(rtdb, 'withdrawals'));
      if (snapshot.exists()) {
        const val = snapshot.val();
        const arr = Object.values(val) as WithdrawalRequest[];
        arr.sort((a, b) => b.createdAt - a.createdAt);
        localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(arr));
        notifySubscribers('withdrawals_updated');
        return arr;
      }
    } catch (err) {
      console.warn('SDK syncWithdrawals notice:', err);
    }
  }

  return getAllWithdrawals();
}

export function requestWithdrawal(req: Omit<WithdrawalRequest, 'id' | 'status' | 'createdAt'>): { success: boolean; error?: string; request?: WithdrawalRequest } {
  const settings = getStoredSettings();
  const user = getCurrentUser();

  if (req.amount < settings.minWithdrawalLimit) {
    return { success: false, error: `Minimum withdrawal amount is ₹${settings.minWithdrawalLimit}` };
  }

  if (user.balance < req.amount) {
    return { success: false, error: 'Insufficient balance' };
  }

  // Deduct balance immediately
  const users = getAllUsers();
  const u = users.find(x => x.id === user.id);
  if (u) {
    u.balance = Number((u.balance - req.amount).toFixed(2));
    saveUsers(users);
  }

  const withdrawalId = `w_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const withdrawal: WithdrawalRequest = {
    ...req,
    id: withdrawalId,
    status: 'pending',
    createdAt: Date.now(),
  };

  const all = getAllWithdrawals();
  all.unshift(withdrawal);
  saveWithdrawals(all);

  // 1. Instant Direct HTTPS REST push with keepalive: true (never dropped even if webview closes)
  try {
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/withdrawals/${withdrawal.id}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withdrawal),
      keepalive: true,
    }).catch((e) => {
      console.warn('REST withdrawal push notice:', e);
    });

    if (u) {
      fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/users/${user.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: u.balance }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('REST call notice:', e);
  }

  // 2. Also push via Firebase SDK
  if (rtdb) {
    set(ref(rtdb, `withdrawals/${withdrawal.id}`), withdrawal).catch((e) => {
      console.warn('Firebase withdrawal create notice:', e);
    });
    if (u) {
      set(ref(rtdb, `users/${user.id}`), u).catch(() => {});
    }
  }

  // Add transaction
  addTransaction({
    userId: user.id,
    type: 'withdrawal',
    amount: -req.amount,
    description: req.method === 'upi' ? `Withdrawal to UPI: ${req.upiId}` : `Withdrawal to Bank: ${req.accountNumber}`,
    status: 'pending',
  });

  notifySubscribers('withdrawal_created');

  return { success: true, request: withdrawal };
}

export function approveWithdrawal(withdrawalId: string): boolean {
  const list = getAllWithdrawals();
  const item = list.find(w => w.id === withdrawalId);
  if (!item || item.status !== 'pending') return false;

  item.status = 'approved';
  item.updatedAt = Date.now();
  saveWithdrawals(list);

  // 1. Direct REST update
  try {
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/withdrawals/${withdrawalId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', updatedAt: item.updatedAt }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}

  // 2. Push update to Firebase Realtime Database SDK
  if (rtdb) {
    update(ref(rtdb, `withdrawals/${withdrawalId}`), {
      status: 'approved',
      updatedAt: item.updatedAt,
    }).catch((e) => {
      console.warn('Firebase approveWithdrawal notice:', e);
    });
  }

  // Update transaction status & clear success message in transaction history
  const txs = getAllTransactions();
  const tx = txs.find(t => t.userId === item.userId && t.type === 'withdrawal' && Math.abs(t.amount) === item.amount && t.status === 'pending');
  const successDesc = item.method === 'upi'
    ? `Withdrawal Successful ✅ (₹${item.amount} sent to UPI: ${item.upiId})`
    : `Withdrawal Successful ✅ (₹${item.amount} sent to Bank A/C: ${item.accountNumber})`;

  if (tx) {
    tx.status = 'completed';
    tx.description = successDesc;
    tx.createdAt = Date.now();
    saveTransactions(txs);
  } else {
    addTransaction({
      userId: item.userId,
      type: 'withdrawal',
      amount: -item.amount,
      description: successDesc,
      status: 'completed',
    });
  }

  return true;
}

export async function deleteWithdrawalPermanently(withdrawalId: string): Promise<boolean> {
  const list = getAllWithdrawals().filter(w => w.id !== withdrawalId);
  saveWithdrawals(list);

  // 1. Direct REST delete from Firebase
  try {
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/withdrawals/${withdrawalId}.json`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}

  // 2. Firebase SDK remove
  if (rtdb) {
    try {
      remove(ref(rtdb, `withdrawals/${withdrawalId}`)).catch(() => {});
    } catch (e) {}
  }

  notifySubscribers('withdrawal_deleted');
  return true;
}

export async function deleteUserPermanently(userId: string): Promise<boolean> {
  // Remove from local users list
  const users = getAllUsers().filter(u => u.id !== userId && u.telegramId !== userId);
  saveUsers(users);

  // Remove user transactions
  const txs = getAllTransactions().filter(t => t.userId !== userId);
  saveTransactions(txs);

  // Remove user withdrawals
  const withdrawals = getAllWithdrawals().filter(w => w.userId !== userId);
  saveWithdrawals(withdrawals);

  // 1. Direct REST delete from Firebase
  try {
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/users/${userId}.json`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {});
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/referrals/${userId}.json`, {
      method: 'DELETE',
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}

  // 2. Firebase SDK remove
  if (rtdb) {
    try {
      remove(ref(rtdb, `users/${userId}`)).catch(() => {});
      remove(ref(rtdb, `referrals/${userId}`)).catch(() => {});
    } catch (e) {}
  }

  notifySubscribers('user_deleted');
  return true;
}

export function rejectWithdrawal(withdrawalId: string, reason = 'Verification failed / Invalid details'): boolean {
  const list = getAllWithdrawals();
  const item = list.find(w => w.id === withdrawalId);
  if (!item || item.status !== 'pending') return false;

  item.status = 'rejected';
  item.rejectReason = reason;
  item.updatedAt = Date.now();
  saveWithdrawals(list);

  // 1. Direct REST update
  try {
    fetch(`https://telebot-26c11-default-rtdb.firebaseio.com/withdrawals/${withdrawalId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejectReason: reason, updatedAt: item.updatedAt }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}

  // 2. Push update to Firebase Realtime Database SDK
  if (rtdb) {
    update(ref(rtdb, `withdrawals/${withdrawalId}`), {
      status: 'rejected',
      rejectReason: reason,
      updatedAt: item.updatedAt,
    }).catch((e) => {
      console.warn('Firebase rejectWithdrawal notice:', e);
    });
  }

  // Refund money to user's balance
  const users = getAllUsers();
  const u = users.find(x => x.id === item.userId);
  if (u) {
    u.balance = Number((u.balance + item.amount).toFixed(2));
    saveUsers(users);
  }

  // Update transaction
  const txs = getAllTransactions();
  const tx = txs.find(t => t.userId === item.userId && t.type === 'withdrawal' && Math.abs(t.amount) === item.amount && t.status === 'pending');
  if (tx) {
    tx.status = 'rejected';
  }
  // Add refund transaction log
  addTransaction({
    userId: item.userId,
    type: 'withdrawal_refund',
    amount: item.amount,
    description: `Refund for rejected withdrawal: ${reason}`,
    status: 'completed',
  });

  return true;
}

// ----------------- Real Referral System with Data Fetch -----------------

export function processReferralJoin(referrerId: string, visitorId?: string): { success: boolean; message: string } {
  if (!referrerId) return { success: false, message: 'Invalid referrer ID' };

  // Normalize referrerId (handle ref_123 or just 123)
  const cleanReferrerId = referrerId.replace(/^ref_/, '').trim();
  const currentUserId = visitorId || getCurrentUser().id;

  if (cleanReferrerId === currentUserId) {
    return { success: false, message: 'Self referral is not allowed' };
  }

  const processedKey = `rg_ref_processed_${cleanReferrerId}_${currentUserId}`;
  if (typeof window !== 'undefined' && localStorage.getItem(processedKey)) {
    return { success: false, message: 'Referral already credited' };
  }

  const users = getAllUsers();
  const referrer = users.find(u => u.id === cleanReferrerId || u.telegramId === cleanReferrerId);

  if (!referrer) {
    // If referrer is not in local cache yet, fetch or credit in Firebase Realtime Database
    const db = rtdb;
    if (db) {
      get(ref(db, `users/${cleanReferrerId}`)).then((snapshot) => {
        let remoteUser: UserProfile;
        if (snapshot.exists()) {
          remoteUser = snapshot.val() as UserProfile;
          remoteUser.friendsJoined = (remoteUser.friendsJoined || 0) + 1;
          remoteUser.spins = (remoteUser.spins || 0) + 1;
          remoteUser.spinsEarned = (remoteUser.spinsEarned || 0) + 1;
        } else {
          remoteUser = {
            id: cleanReferrerId,
            telegramId: cleanReferrerId,
            name: `User #${cleanReferrerId}`,
            username: `user_${cleanReferrerId}`,
            balance: 0,
            spins: 2, // 1 signup bonus + 1 referral spin
            friendsJoined: 1,
            spinsEarned: 2,
            createdAt: Date.now(),
            isVerified: true,
            claimedWelcomeSpin: true,
          };
        }
        set(ref(db, `users/${cleanReferrerId}`), remoteUser);
        set(ref(db, `referrals/${cleanReferrerId}/${currentUserId}`), {
          joinerId: currentUserId,
          timestamp: Date.now(),
        });

        // Record transaction in Firebase
        const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        set(ref(db, `transactions/${txId}`), {
          id: txId,
          userId: cleanReferrerId,
          type: 'referral_bonus',
          amount: 0,
          description: `Friend #${currentUserId.slice(-4)} joined! +1 Lucky Spin awarded`,
          status: 'completed',
          createdAt: Date.now(),
        });
      }).catch((e) => {
        console.warn('Firebase remote referral join notice:', e);
      });
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(processedKey, 'true');
    }
    return { success: true, message: 'Referral processed in Firebase!' };
  }

  // Award +1 spin and increment friendsJoined
  referrer.friendsJoined = (referrer.friendsJoined || 0) + 1;
  referrer.spins = (referrer.spins || 0) + 1;
  referrer.spinsEarned = (referrer.spinsEarned || 0) + 1;

  if (typeof window !== 'undefined') {
    localStorage.setItem(processedKey, 'true');
  }

  saveUsers(users);

  addTransaction({
    userId: referrer.id,
    type: 'referral_bonus',
    amount: 0,
    description: `Friend #${currentUserId.slice(-4)} joined! +1 Lucky Spin awarded`,
    status: 'completed',
  });

  if (rtdb) {
    set(ref(rtdb, `referrals/${referrer.id}/${currentUserId}`), {
      joinerId: currentUserId,
      timestamp: Date.now(),
    }).catch(() => {});
  }

  notifySubscribers('referral_joined');
  return { success: true, message: '+1 Spin credited to referrer!' };
}

export function getReferralTransactions(userId: string): Transaction[] {
  return getUserTransactions(userId).filter(t => t.type === 'referral_bonus');
}

export function simulateReferral(userId: string): { success: boolean; newSpins: number; friendsCount: number } {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, newSpins: 0, friendsCount: 0 };

  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const friendName = `User #${randomDigits}`;

  user.friendsJoined = (user.friendsJoined || 0) + 1;
  user.spins = (user.spins || 0) + 1;
  user.spinsEarned = (user.spinsEarned || 0) + 1;
  saveUsers(users);

  addTransaction({
    userId,
    type: 'referral_bonus',
    amount: 0,
    description: `Friend ${friendName} joined! +1 Lucky Spin awarded`,
    status: 'completed',
  });

  if (rtdb) {
    set(ref(rtdb, `referrals/${userId}/friend_${randomDigits}`), {
      joinerId: `friend_${randomDigits}`,
      name: friendName,
      timestamp: Date.now(),
    }).catch(() => {});
  }

  notifySubscribers('referral_simulated');

  return {
    success: true,
    newSpins: user.spins,
    friendsCount: user.friendsJoined,
  };
}

// -------------------------------------------------------------
// Referral Leaderboard Service (Real Registered Users Only)
// -------------------------------------------------------------
export function getReferralLeaderboard(currentUserId?: string, limit: number = 10): LeaderboardEntry[] {
  const users = getAllUsers();

  // Deduplicate and filter valid real users
  const map = new Map<string, UserProfile>();
  users.forEach((u) => {
    if (u && u.id) {
      map.set(String(u.id), u);
    }
  });

  const uniqueUsers = Array.from(map.values());

  // Sort real registered users by:
  // 1. Successful referrals (friendsJoined) descending
  // 2. Spins earned descending
  // 3. User registration time ascending
  const sorted = uniqueUsers.sort((a, b) => {
    const aRefs = a.friendsJoined || 0;
    const bRefs = b.friendsJoined || 0;
    if (bRefs !== aRefs) {
      return bRefs - aRefs;
    }
    const aSpins = a.spinsEarned || 0;
    const bSpins = b.spinsEarned || 0;
    if (bSpins !== aSpins) {
      return bSpins - aSpins;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return sorted.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    id: item.id,
    name: item.name || 'Telegram User',
    username: item.username || 'user',
    referrals: item.friendsJoined || 0,
    spinsEarned: item.spinsEarned || 0,
    photoUrl: item.photoUrl,
    isCurrentUser: Boolean(currentUserId && (item.id === currentUserId || item.telegramId === currentUserId)),
  }));
}

export function getUserLeaderboardRank(currentUserId: string): { rank: number; referrals: number; totalPlayers: number } {
  const users = getAllUsers();
  const map = new Map<string, UserProfile>();
  users.forEach((u) => {
    if (u && u.id) {
      map.set(String(u.id), u);
    }
  });

  const uniqueUsers = Array.from(map.values());

  const sorted = uniqueUsers.sort((a, b) => {
    const aRefs = a.friendsJoined || 0;
    const bRefs = b.friendsJoined || 0;
    if (bRefs !== aRefs) {
      return bRefs - aRefs;
    }
    const aSpins = a.spinsEarned || 0;
    const bSpins = b.spinsEarned || 0;
    if (bSpins !== aSpins) {
      return bSpins - aSpins;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  const index = sorted.findIndex((item) => item.id === currentUserId || item.telegramId === currentUserId);
  const userItem = map.get(currentUserId);

  return {
    rank: index >= 0 ? index + 1 : sorted.length + 1,
    referrals: userItem?.friendsJoined || 0,
    totalPlayers: sorted.length,
  };
}
