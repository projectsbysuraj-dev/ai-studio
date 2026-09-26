import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  RotateCw,
  CheckCircle,
  XCircle,
  LogOut,
  ArrowLeft,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  Palette,
  Code2,
  Check,
  Copy,
  Download,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  ThemeSettings,
  ThemePreset,
  UserProfile,
} from '../types';
import {
  getAllWithdrawals,
  syncWithdrawalsFromFirebase,
  syncUsersFromFirebase,
  wipeAllFirebaseData,
  approveWithdrawal,
  rejectWithdrawal,
  deleteWithdrawalPermanently,
  deleteUserPermanently,
  saveSettings,
  saveTheme,
  THEME_PRESETS,
  getAllUsers,
  addSpinsToUser,
  addBalanceToUser,
  subscribeRealtime,
  getAdminCredentials,
  verifyAdminLogin,
  updateAdminPassword,
  updateAdminEmail,
  isAdminLoggedIn,
  setAdminLoggedIn,
  logoutAdmin,
} from '../services/store';
import { generateStandaloneHtml } from '../services/standaloneHtmlGenerator';
import { triggerHaptic } from '../services/telegram';
import { AppLogo } from './AppLogo';

interface AdminPortalProps {
  settings: AppSettings;
  theme: ThemeSettings;
  onNavigateToUserApp: () => void;
}

type AdminTab = 'withdrawals' | 'users' | 'security' | 'settings' | 'theme' | 'code';

export const AdminPortal: React.FC<AdminPortalProps> = ({
  settings,
  theme,
  onNavigateToUserApp,
}) => {
  // Authentication state - Empty by default (Manual fill as requested)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(isAdminLoggedIn());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState(getAllWithdrawals());
  const [users, setUsers] = useState(getAllUsers());
  const [adminCreds, setAdminCreds] = useState(getAdminCredentials());
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [deleteConfirmWithdrawal, setDeleteConfirmWithdrawal] = useState<string | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  // Settings form state
  const [botUsername, setBotUsername] = useState(settings.botUsername);
  const [channelLink, setChannelLink] = useState(settings.telegramChannelUrl);
  const [appTitle, setAppTitle] = useState(settings.appTitle);
  const [spinWinAmount, setSpinWinAmount] = useState(String(settings.spinWinAmount));
  const [minWithdrawal, setMinWithdrawal] = useState(String(settings.minWithdrawalLimit));
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // User management state
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [spinsToAdd, setSpinsToAdd] = useState('');
  const [balanceToAdd, setBalanceToAdd] = useState('');
  const [userActionToast, setUserActionToast] = useState<string | null>(null);

  // Security / Password change state
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [newEmailInput, setNewEmailInput] = useState(adminCreds.email);
  const [securityToast, setSecurityToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Standalone code state
  const [copiedCode, setCopiedCode] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // 1. Initial live sync from Firebase
    syncWithdrawalsFromFirebase().then((data) => {
      setWithdrawals(data);
    });
    syncUsersFromFirebase().then((uList) => {
      setUsers(uList);
    });

    // 2. Active background sync every 3.5s so newly submitted withdrawals show up immediately
    const interval = setInterval(() => {
      syncWithdrawalsFromFirebase().then((data) => {
        setWithdrawals(data);
      });
      syncUsersFromFirebase().then((uList) => {
        setUsers(uList);
      });
    }, 3500);

    const unsub = subscribeRealtime(() => {
      setWithdrawals(getAllWithdrawals());
      setUsers(getAllUsers());
      setAdminCreds(getAdminCredentials());
    });
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  useEffect(() => {
    setBotUsername(settings.botUsername);
    setChannelLink(settings.telegramChannelUrl);
    setAppTitle(settings.appTitle);
    setSpinWinAmount(String(settings.spinWinAmount));
    setMinWithdrawal(String(settings.minWithdrawalLimit));
    setNewEmailInput(adminCreds.email);
  }, [settings, adminCreds.email]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const result = verifyAdminLogin(loginEmail, loginPassword);
    if (result.success) {
      triggerHaptic('success');
      setIsAuthenticated(true);
      // Immediately pull fresh withdrawals from Firebase on login
      syncWithdrawalsFromFirebase().then((data) => setWithdrawals(data));
    } else {
      triggerHaptic('error');
      setLoginError(result.error || 'Invalid credentials');
    }
  };

  const handleLogout = () => {
    triggerHaptic('medium');
    logoutAdmin();
    setIsAuthenticated(false);
  };

  const handleRefresh = async () => {
    triggerHaptic('light');
    setIsRefreshing(true);
    const freshW = await syncWithdrawalsFromFirebase();
    const freshU = await syncUsersFromFirebase();
    setWithdrawals(freshW);
    setUsers(freshU);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleWipeDatabase = async () => {
    triggerHaptic('medium');
    await wipeAllFirebaseData();
    setWithdrawals([]);
    setUsers([]);
    setShowWipeConfirm(false);
    setUserActionToast('🧹 All users, withdrawals, and referrals wiped out! Database user count is now 0.');
    setTimeout(() => setUserActionToast(null), 4000);
  };

  const handleApproveWithdrawal = (id: string) => {
    triggerHaptic('success');
    approveWithdrawal(id);
    setWithdrawals(getAllWithdrawals());
  };

  const handleRejectWithdrawal = (id: string) => {
    triggerHaptic('error');
    const reason = prompt('Reason for rejection (e.g. Invalid UPI ID / Incorrect Bank Details):', 'Invalid UPI ID / Details');
    if (reason !== null) {
      rejectWithdrawal(id, reason || 'Verification failed');
      setWithdrawals(getAllWithdrawals());
    }
  };

  const handleDeleteWithdrawal = async (id: string) => {
    triggerHaptic('medium');
    await deleteWithdrawalPermanently(id);
    setDeleteConfirmWithdrawal(null);
    setWithdrawals(getAllWithdrawals());
    setUserActionToast(`🗑️ Withdrawal request #${id} permanently deleted from database.`);
    setTimeout(() => setUserActionToast(null), 3500);
  };

  const handleDeleteUser = async (userId: string) => {
    triggerHaptic('medium');
    await deleteUserPermanently(userId);
    setDeleteConfirmUser(null);
    setUsers(getAllUsers());
    setUserActionToast(`🗑️ User #${userId} permanently deleted from database.`);
    setTimeout(() => setUserActionToast(null), 3500);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('success');
    saveSettings({
      botUsername: botUsername.replace(/^@/, '').trim(),
      telegramChannelUrl: channelLink.trim(),
      appTitle: appTitle.trim() || 'Rohit Giveaway',
      spinWinAmount: Number(spinWinAmount) || 5,
      minWithdrawalLimit: Number(minWithdrawal) || 20,
    });
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityToast(null);

    if (newPassInput !== confirmPassInput) {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: 'New password and confirm password do not match!' });
      return;
    }

    const res = updateAdminPassword(currentPassInput, newPassInput);
    if (res.success) {
      triggerHaptic('success');
      setSecurityToast({ type: 'success', message: 'Password changed successfully! Keep it safe.' });
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setAdminCreds(getAdminCredentials());
    } else {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: res.error || 'Failed to update password' });
    }
  };

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityToast(null);
    const res = updateAdminEmail(newEmailInput);
    if (res.success) {
      triggerHaptic('success');
      setSecurityToast({ type: 'success', message: 'Admin Gmail updated successfully!' });
      setAdminCreds(getAdminCredentials());
    } else {
      triggerHaptic('error');
      setSecurityToast({ type: 'error', message: res.error || 'Failed to update email' });
    }
  };

  const handleApplyUserAdjustments = (targetUser: UserProfile) => {
    triggerHaptic('success');
    let msg = '';
    const spins = parseInt(spinsToAdd);
    if (!isNaN(spins) && spins !== 0) {
      addSpinsToUser(targetUser.id, spins);
      msg += `${spins > 0 ? '+' : ''}${spins} Spins `;
    }

    const bal = parseFloat(balanceToAdd);
    if (!isNaN(bal) && bal !== 0) {
      addBalanceToUser(targetUser.id, bal, 'Admin Manual Adjustment');
      msg += `${bal > 0 ? '+' : ''}₹${bal} Balance `;
    }

    if (msg) {
      setUserActionToast(`✅ Successfully applied ${msg} to User #${targetUser.id}`);
      setSpinsToAdd('');
      setBalanceToAdd('');
      setUsers(getAllUsers());
      setTimeout(() => setUserActionToast(null), 3500);
    }
  };

  const handleSelectThemePreset = (presetKey: ThemePreset) => {
    triggerHaptic('medium');
    const p = THEME_PRESETS[presetKey];
    saveTheme({
      preset: presetKey,
      primaryColor: p.primary,
      glowColor: p.glow,
      bgGradientStart: p.bgStart,
      bgGradientEnd: p.bgEnd,
    });
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN: Shown if not authenticated
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900/90 border border-sky-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Top glow decoration */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center shadow-lg shadow-sky-500/30 mb-3 border border-white/20">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <h1 className="font-['Outfit'] font-black text-2xl text-white tracking-tight">
              Admin Control Panel
            </h1>
            <p className="text-xs text-sky-200 mt-1">
              Secure Administration Portal (/admin)
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin ID / Gmail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter Admin ID or Gmail"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="off"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter Admin Password"
                  className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-500 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-sky-600/30 active:scale-95 transition-all mt-2"
            >
              Sign In to Admin Dashboard 🔐
            </button>
          </form>

          {/* Return to user app link */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onNavigateToUserApp}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to User App (Live Client)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  const pendingCount = withdrawals.filter((w) => w.status === 'pending').length;
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
      u.id.includes(searchUserQuery) ||
      u.username.toLowerCase().includes(searchUserQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Admin Navbar */}
      <header className="w-full bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0284c7] to-[#38bdf8] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-['Outfit'] font-black text-lg text-white leading-tight">
                  Admin Control Panel
                </h1>
                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {adminCreds.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Live Sync'}</span>
            </button>

            <button
              onClick={onNavigateToUserApp}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">User App</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content Container */}
      <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 border-b border-slate-800 no-scrollbar">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Withdrawals</span>
            {pendingCount > 0 && (
              <span className="bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-full text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'users'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users &amp; Spins</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-300">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'security'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Password &amp; Security</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'settings'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Bot &amp; App Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'theme'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Theme &amp; Colors</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-600/25'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Standalone HTML Export</span>
          </button>
        </div>

        {/* ----------------- TAB 1: WITHDRAWALS ----------------- */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-['Outfit'] font-black text-xl text-white">
                  Withdrawal Requests Queue
                </h2>
                <p className="text-xs text-slate-400">
                  Realtime pending UPI and Bank withdrawal requests from users
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    triggerHaptic('medium');
                    const fresh = await syncWithdrawalsFromFirebase();
                    setWithdrawals(fresh);
                    setTimeout(() => setIsRefreshing(false), 400);
                  }}
                  disabled={isRefreshing}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-sky-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Refreshing...' : 'Refresh Queue'}</span>
                </button>
                <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                  Total: {withdrawals.length}
                </span>
              </div>
            </div>

            {withdrawals.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-500">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50 text-slate-400" />
                <p className="font-bold text-sm">No withdrawal requests found</p>
                <p className="text-xs mt-1">
                  Requests created by users will automatically show up here in real-time.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-['Outfit'] font-black text-lg text-emerald-400">
                          ₹{item.amount}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            item.status === 'pending'
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : item.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ID: #{item.id}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300">
                        <strong className="text-white">{item.userName}</strong> (User #{item.userId})
                      </div>

                      <div className="text-xs font-mono text-sky-300 bg-sky-950/40 border border-sky-800/40 px-3 py-1.5 rounded-xl inline-block">
                        {item.method === 'upi' ? (
                          <span>UPI ID: <strong>{item.upiId}</strong></span>
                        ) : (
                          <span>
                            Bank: <strong>{item.bankName}</strong> | A/C: <strong>{item.accountNumber}</strong> | IFSC: <strong>{item.ifsc}</strong> | Name: <strong>{item.accountHolder}</strong>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Created: {new Date(item.createdAt).toLocaleString()}
                        {item.rejectReason && (
                          <span className="text-rose-400 ml-2 font-medium">
                            Reason: {item.rejectReason}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveWithdrawal(item.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-700/30 transition-all active:scale-95"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve &amp; Pay</span>
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(item.id)}
                            className="bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border border-rose-500/40"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setDeleteConfirmWithdrawal(item.id)}
                        title="Delete withdrawal record permanently from database"
                        className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 p-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-1 text-xs"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: USERS & SPINS ----------------- */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-['Outfit'] font-black text-xl text-white">
                  Users Database &amp; Spin Management
                </h2>
                <p className="text-xs text-slate-400">
                  Manage user balances, spins, referrals, and adjustments
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search user by name or ID..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-sm px-4 py-2 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(true)}
                  className="bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap active:scale-95"
                  title="Wipe database: delete all users, referrals, and withdrawals"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Wipe All (0 Users)</span>
                </button>
              </div>
            </div>

            {userActionToast && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold animate-fade-in">
                {userActionToast}
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 rounded-3xl border border-slate-800 p-8 space-y-2">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-['Outfit'] font-black text-lg text-slate-300">0 Users In Database</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Database is completely clean (0 users). When someone opens the app or starts the bot, their profile will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <strong className="text-white text-sm block leading-tight">{u.name}</strong>
                          <span className="text-xs text-slate-400 font-mono">@{u.username} (#{u.id})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                          ₹{u.balance.toFixed(2)}
                        </span>
                        <button
                          onClick={() => setDeleteConfirmUser(u)}
                          title="Permanently delete user from database"
                          className="bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 p-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[10px] text-rose-400 font-semibold hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Current Spins</span>
                        <strong className="text-sm font-['Outfit'] font-black text-sky-300">{u.spins}</strong>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Friends Joined</span>
                        <strong className="text-sm font-['Outfit'] font-black text-emerald-300">{u.friendsJoined || 0}</strong>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Spins Earned</span>
                        <strong className="text-sm font-['Outfit'] font-black text-amber-300">{u.spinsEarned || 0}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Adjuster for this user */}
                  <div className="border-t border-slate-800 pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="+/- Spins (e.g. 5)"
                        value={selectedUser?.id === u.id ? spinsToAdd : ''}
                        onChange={(e) => {
                          setSelectedUser(u);
                          setSpinsToAdd(e.target.value);
                        }}
                        className="w-1/2 bg-slate-800 border border-slate-700 text-xs p-2 rounded-xl text-white placeholder-slate-500"
                      />
                      <input
                        type="number"
                        placeholder="+/- ₹ Cash (e.g. 50)"
                        value={selectedUser?.id === u.id ? balanceToAdd : ''}
                        onChange={(e) => {
                          setSelectedUser(u);
                          setBalanceToAdd(e.target.value);
                        }}
                        className="w-1/2 bg-slate-800 border border-slate-700 text-xs p-2 rounded-xl text-white placeholder-slate-500"
                      />
                      <button
                        onClick={() => handleApplyUserAdjustments(u)}
                        className="bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}

        {/* ----------------- TAB 3: PASSWORD & SECURITY (ROHIT'S REQUEST) ----------------- */}
        {activeTab === 'security' && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Admin Security &amp; Password Management
              </h2>
              <p className="text-xs text-slate-400">
                Change your admin password and credentials. Saved directly into secure database.
              </p>
            </div>

            {securityToast && (
              <div
                className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
                  securityToast.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {securityToast.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{securityToast.message}</span>
              </div>
            )}

            {/* Change Password Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-['Outfit'] font-bold text-sm text-white">
                  Change Admin Password
                </h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    placeholder="Enter current password (adminrohit10)"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassInput}
                    onChange={(e) => setConfirmPassInput(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-['Outfit'] font-black text-sm py-3.5 rounded-xl shadow-lg shadow-amber-600/20 active:scale-95 transition-all"
                >
                  Update Admin Password 🔒
                </button>
              </form>
            </div>

            {/* Change Admin ID / Email Card */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-sky-400" />
                  <h3 className="font-['Outfit'] font-bold text-sm text-white">
                    Admin Login ID / Gmail
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800/60 px-2 py-0.5 rounded-full">
                  Active: {adminCreds.email}
                </span>
              </div>

              <form onSubmit={handleChangeEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Set New Admin ID or Gmail
                  </label>
                  <input
                    type="text"
                    required
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="e.g. admin or rohit@gmail.com"
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-medium"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    You can log in using this ID or Gmail from the admin login page.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-3 rounded-xl transition-colors border border-slate-700 active:scale-95"
                >
                  Save Admin ID / Gmail 📝
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: APP & BOT SETTINGS ----------------- */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Bot &amp; App Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Manage bot links, channel URL, win amounts, and limits
              </p>
            </div>

            {settingsSavedToast && (
              <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Settings saved and broadcasted to all active clients!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Telegram Bot Username (without @)
                </label>
                <input
                  type="text"
                  required
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="RohitGiveawayBot"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Official Telegram Channel URL
                </label>
                <input
                  type="url"
                  required
                  value={channelLink}
                  onChange={(e) => setChannelLink(e.target.value)}
                  placeholder="https://t.me/RohitGiveaway"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Application Title
                </label>
                <input
                  type="text"
                  required
                  value={appTitle}
                  onChange={(e) => setAppTitle(e.target.value)}
                  placeholder="Rohit Giveaway"
                  className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Spin Win Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={spinWinAmount}
                    onChange={(e) => setSpinWinAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Min Withdrawal Limit (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minWithdrawal}
                    onChange={(e) => setMinWithdrawal(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-sm p-3 rounded-xl text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-['Outfit'] font-black text-sm py-3.5 rounded-xl shadow-lg shadow-sky-600/30 active:scale-95 transition-all mt-4"
              >
                Save App Settings 💾
              </button>
            </form>
          </div>
        )}

        {/* ----------------- TAB 5: THEME & BRANDING ----------------- */}
        {activeTab === 'theme' && (
          <div className="max-w-2xl mx-auto w-full space-y-6">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Theme Presets &amp; Brand Styling
              </h2>
              <p className="text-xs text-slate-400">
                Choose a visual preset for the Telegram Mini App client
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(THEME_PRESETS) as ThemePreset[]).map((key) => {
                const p = THEME_PRESETS[key];
                const isSelected = theme.preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectThemePreset(key)}
                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-sky-400 bg-sky-950/40 shadow-lg shadow-sky-500/20'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-7 h-7 rounded-full shadow-inner border border-white/40"
                        style={{ backgroundColor: p.primary }}
                      />
                      {isSelected && <Check className="w-4 h-4 text-sky-400" />}
                    </div>
                    <span className="font-bold text-xs text-white">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ----------------- TAB 6: STANDALONE HTML EXPORT ----------------- */}
        {activeTab === 'code' && (
          <div className="max-w-3xl mx-auto w-full space-y-4">
            <div>
              <h2 className="font-['Outfit'] font-black text-xl text-white">
                Standalone Single-File HTML Generator
              </h2>
              <p className="text-xs text-slate-400">
                Export full app as a single .html file that runs directly in Telegram bots or browser!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  const html = generateStandaloneHtml();
                  navigator.clipboard.writeText(html);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-sky-600/30"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied HTML!' : 'Copy Single-File HTML'}</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic('success');
                  const html = generateStandaloneHtml();
                  const blob = new Blob([html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${settings.botUsername || 'giveaway'}_miniapp.html`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download .html File</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <pre className="text-xs font-mono text-slate-400 max-h-96 overflow-y-auto whitespace-pre-wrap select-all">
                {generateStandaloneHtml().slice(0, 3000)}...
              </pre>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal for User */}
        {deleteConfirmUser && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-scale-up">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-['Outfit'] font-black text-lg text-white">Permanently Delete User?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to permanently delete user <strong className="text-rose-300">{deleteConfirmUser.name}</strong> (#{deleteConfirmUser.id}) from the database? All their data, spins, and balance will be wiped out.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUser(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(deleteConfirmUser.id)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal for Withdrawal Record */}
        {deleteConfirmWithdrawal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-scale-up">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h3 className="font-['Outfit'] font-black text-lg text-white">Delete Withdrawal Record?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Permanently delete withdrawal request <strong className="text-rose-300">#{deleteConfirmWithdrawal}</strong> from the database?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmWithdrawal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteWithdrawal(deleteConfirmWithdrawal)}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
                >
                  Yes, Delete Record
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wipe / Reset Database Confirmation Modal */}
        {showWipeConfirm && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-rose-600 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-scale-up">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="w-7 h-7" />
              </div>
              <div className="text-center">
                <h3 className="font-['Outfit'] font-black text-xl text-white">Reset Database to 0 Users?</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  This will <strong className="text-rose-400">permanently delete ALL users, all withdrawals, all referral links, and transactions</strong> from Firebase and local storage.
                  <br /><br />
                  User count will be reset to <strong className="text-emerald-400">0</strong>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWipeConfirm(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWipeDatabase}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-rose-600/40 active:scale-95 transition-all"
                >
                  Yes, Wipe Database 🧹
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPortal;
