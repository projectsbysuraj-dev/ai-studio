import React, { useState } from 'react';
import {
  X,
  RotateCw,
  CheckCircle,
  XCircle,
  Check,
  Copy,
  Download,
  Code2,
} from 'lucide-react';
import {
  AppSettings,
  ThemeSettings,
  ThemePreset,
  UserProfile,
} from '../types';
import {
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  saveSettings,
  saveTheme,
  THEME_PRESETS,
  getAllUsers,
  addSpinsToUser,
  addBalanceToUser,
  subscribeRealtime,
} from '../services/store';
import { generateStandaloneHtml } from '../services/standaloneHtmlGenerator';
import { triggerHaptic } from '../services/telegram';

interface AdminPanelModalProps {
  currentUser: UserProfile;
  settings: AppSettings;
  theme: ThemeSettings;
  onClose: () => void;
}

type AdminTab = 'withdrawals' | 'theme' | 'settings' | 'spins' | 'code';

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  currentUser,
  settings,
  theme,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState(getAllWithdrawals());
  const [users, setUsers] = useState(getAllUsers());

  // Form states for settings tab matching Screenshot 7
  const [botUsername, setBotUsername] = useState(settings.botUsername);
  const [channelLink, setChannelLink] = useState(settings.telegramChannelUrl);
  const [appTitle, setAppTitle] = useState(settings.appTitle);
  const [spinWinAmount, setSpinWinAmount] = useState(String(settings.spinWinAmount));
  const [minWithdrawal, setMinWithdrawal] = useState(String(settings.minWithdrawalLimit));
  const [adminPin, setAdminPin] = useState(settings.adminPin);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Form states for User Spins tab matching Screenshot 8
  const [targetUserId, setTargetUserId] = useState('');
  const [spinsToAdd, setSpinsToAdd] = useState('');
  const [balanceToAdd, setBalanceToAdd] = useState('');
  const [userUpdateToast, setUserUpdateToast] = useState<string | null>(null);

  // Standalone HTML code state
  const [copiedCode, setCopiedCode] = useState(false);

  // Real-time synchronization
  React.useEffect(() => {
    const unsub = subscribeRealtime(() => {
      setWithdrawals(getAllWithdrawals());
      setUsers(getAllUsers());
    });
    return unsub;
  }, []);

  React.useEffect(() => {
    setBotUsername(settings.botUsername);
    setChannelLink(settings.telegramChannelUrl);
    setAppTitle(settings.appTitle);
    setSpinWinAmount(String(settings.spinWinAmount));
    setMinWithdrawal(String(settings.minWithdrawalLimit));
    setAdminPin(settings.adminPin);
  }, [settings]);

  const handleRefresh = () => {
    triggerHaptic('light');
    setWithdrawals(getAllWithdrawals());
    setUsers(getAllUsers());
  };

  const handleApprove = (id: string) => {
    triggerHaptic('success');
    approveWithdrawal(id);
    setWithdrawals(getAllWithdrawals());
  };

  const handleReject = (id: string) => {
    triggerHaptic('error');
    const reason = prompt('Reason for rejection (e.g. Invalid UPI ID / Incorrect Bank Details):', 'Invalid UPI ID');
    if (reason !== null) {
      rejectWithdrawal(id, reason || 'Details verification failed');
      setWithdrawals(getAllWithdrawals());
    }
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
      adminPin: adminPin.trim() || '7777',
    });
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 3000);
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

  const handleCustomColorChange = (primary: string, glow: string) => {
    saveTheme({
      preset: 'custom',
      primaryColor: primary,
      glowColor: glow,
      bgGradientStart: primary,
      bgGradientEnd: glow,
    });
  };

  const handleUpdateUserSpinsAndBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveUserId = targetUserId.trim() || currentUser.id;
    const targetUser = users.find(u => u.id === effectiveUserId || u.telegramId === effectiveUserId);

    if (!targetUser) {
      setUserUpdateToast(`❌ User #${effectiveUserId} not found in database!`);
      return;
    }

    triggerHaptic('success');
    let message = '';

    const spinsNum = parseInt(spinsToAdd);
    if (!isNaN(spinsNum) && spinsNum !== 0) {
      addSpinsToUser(targetUser.id, spinsNum);
      message += `+${spinsNum} Spins `;
    }

    const balNum = parseFloat(balanceToAdd);
    if (!isNaN(balNum) && balNum !== 0) {
      addBalanceToUser(targetUser.id, balNum, 'Admin added balance');
      message += `+₹${balNum} Balance `;
    }

    setUsers(getAllUsers());
    setSpinsToAdd('');
    setBalanceToAdd('');
    setUserUpdateToast(`✅ Successfully updated ${targetUser.name} (${message.trim() || 'No changes'})!`);
    setTimeout(() => setUserUpdateToast(null), 4000);
  };

  const handleCopyCode = () => {
    const code = generateStandaloneHtml();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleDownloadCode = () => {
    const code = generateStandaloneHtml();
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Bottom Sheet Container matching Screenshot 5 */}
      <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Top Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 shrink-0"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h3 className="font-['Outfit'] font-black text-slate-800 text-lg sm:text-xl tracking-tight">
              Admin Control Panel
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium mb-3 shrink-0">
          Manage Withdrawals, Theme Colors, Spins & Bot Settings
        </p>

        {/* Tab Switcher Pills matching Screenshots 5, 6, 7, 8 */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 mb-4 shrink-0">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Outfit'] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>💸 Withdrawals ({pendingWithdrawals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('theme')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Outfit'] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'theme'
                ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>🎨 Colors & Theme</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Outfit'] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'settings'
                ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>⚙️ Bot & App Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('spins')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Outfit'] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'spins'
                ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>👥 User Spins</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-['Outfit'] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'bg-[#0284c7] text-white shadow-md shadow-sky-600/20'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Standalone HTML</span>
          </button>
        </div>

        {/* Tab 1: Withdrawals */}
        {activeTab === 'withdrawals' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                User Withdrawal Requests:
              </span>
              <button
                onClick={handleRefresh}
                className="text-xs text-[#0284c7] hover:text-[#0369a1] font-bold flex items-center gap-1 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100"
              >
                <RotateCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {withdrawals.length === 0 ? (
              <div className="w-full py-16 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-100">
                No withdrawal requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-['Outfit'] font-black text-sm text-slate-800">
                            {w.userName}
                          </h4>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                            #{w.userId}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(w.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-['Outfit'] font-black text-lg text-[#0284c7] block">
                          ₹{w.amount}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                            w.status === 'pending'
                              ? 'bg-amber-100 text-amber-700 border border-amber-300'
                              : w.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                              : 'bg-red-100 text-red-700 border border-red-300'
                          }`}
                        >
                          {w.status}
                        </span>
                      </div>
                    </div>

                    {/* Method Details */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 mb-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
                        <span>{w.method === 'upi' ? '⚡ UPI Transfer' : '🏦 Bank Transfer'}</span>
                      </div>
                      {w.method === 'upi' ? (
                        <div className="font-mono text-slate-800 font-bold select-all bg-sky-50 px-2 py-1 rounded border border-sky-100">
                          UPI ID: {w.upiId}
                        </div>
                      ) : (
                        <div className="space-y-0.5 text-[11px] text-slate-700">
                          <div>A/C Holder: <strong>{w.accountHolder}</strong></div>
                          <div>A/C Number: <strong className="font-mono">{w.accountNumber}</strong></div>
                          <div>IFSC: <strong className="font-mono">{w.ifsc}</strong></div>
                          {w.bankName && <div>Bank: {w.bankName}</div>}
                        </div>
                      )}
                      {w.rejectReason && (
                        <div className="mt-1 text-[11px] text-red-600 font-semibold">
                          Reason: {w.rejectReason}
                        </div>
                      )}
                    </div>

                    {/* Pending Action Buttons */}
                    {w.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleApprove(w.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-['Outfit'] font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve Payout ✅</span>
                        </button>
                        <button
                          onClick={() => handleReject(w.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-['Outfit'] font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject & Refund ❌</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Colors & Theme matching Screenshot 6 */}
        {activeTab === 'theme' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-5">
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-3">
                One-Click Color Presets:
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {/* 6 Presets matching Screenshot 6 */}
                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('sky-blue')}
                  className="bg-[#0099ff] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Sky Blue
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('sapphire')}
                  className="bg-[#1d4ed8] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Sapphire
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('purple')}
                  className="bg-[#7c3aed] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Purple
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('emerald')}
                  className="bg-[#059669] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Emerald
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('gold-sunset')}
                  className="bg-[#ea580c] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Gold Sunset
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectThemePreset('cyber-red')}
                  className="bg-[#dc2626] hover:opacity-95 text-white font-['Outfit'] font-black text-xs py-3 rounded-2xl shadow-md active:scale-95 transition-all"
                >
                  Cyber Red
                </button>
              </div>
            </div>

            {/* Custom Color Pickers matching Screenshot 6 */}
            <div className="border-t border-slate-100 pt-4">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-3">
                Custom Color Pickers:
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                    <input
                      type="color"
                      value={theme.primaryColor}
                      onChange={(e) => handleCustomColorChange(e.target.value, theme.glowColor)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {theme.primaryColor}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Glow / Accent Color
                  </label>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                    <input
                      type="color"
                      value={theme.glowColor}
                      onChange={(e) => handleCustomColorChange(theme.primaryColor, e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {theme.glowColor}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-xs text-sky-800">
              💡 Theme changes apply in <strong>0ms real time</strong> across all user screens and devices!
            </div>
          </div>
        )}

        {/* Tab 3: Bot & App Settings matching Screenshot 7 */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-3.5">
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">⚡</span>
              <div>
                <span className="text-xs font-black text-sky-900 block leading-tight">
                  Instant Real-time Sync Active
                </span>
                <span className="text-[11px] text-sky-700 font-medium leading-snug block mt-0.5">
                  Bot username ya koi bhi setting change karke Save karein — sabhi user screens aur Firebase me instant 0ms me update hoga!
                </span>
                <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-lg border border-sky-300/40">
                  <span className="font-bold">Live Bot:</span>
                  <span>t.me/{botUsername.replace(/^@/, '').trim() || 'RohitGiveawayBot'}</span>
                </div>
              </div>
            </div>

            {settingsSavedToast && (
              <div className="bg-emerald-500 text-white font-bold text-xs p-3 rounded-2xl flex items-center gap-2 animate-fade-in shadow-md">
                <Check className="w-4 h-4 shrink-0" />
                <span>Saved &amp; Updated Instantly across all User screens and Firebase!</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                TELEGRAM BOT USERNAME (Without @)
              </label>
              <input
                type="text"
                value={botUsername}
                onChange={(e) => setBotUsername(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder="RohitGiveawayBot"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                OFFICIAL TELEGRAM CHANNEL LINK
              </label>
              <input
                type="url"
                value={channelLink}
                onChange={(e) => setChannelLink(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder="https://t.me/RohitGiveaway"
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                APP TITLE
              </label>
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder="Rohit Giveaway"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  SPIN WIN AMOUNT (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={spinWinAmount}
                  onChange={(e) => setSpinWinAmount(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                  placeholder="5"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  MINIMUM WITHDRAWAL LIMIT (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={minWithdrawal}
                  onChange={(e) => setMinWithdrawal(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                  placeholder="20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                CHANGE ADMIN PIN
              </label>
              <input
                type="text"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder="Current PIN: 7777"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-['Outfit'] font-black text-sm py-3.5 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <span>SAVE ALL SETTINGS 💾</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: User Spins & Balance matching Screenshot 8 */}
        {activeTab === 'spins' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-4">
            {userUpdateToast && (
              <div className="bg-slate-900 text-white font-bold text-xs p-3 rounded-2xl animate-fade-in">
                {userUpdateToast}
              </div>
            )}

            <form onSubmit={handleUpdateUserSpinsAndBalance} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                  TARGET USER ID
                </label>
                <input
                  type="text"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                  placeholder="Enter User ID (or leave blank for yourself)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                    ADD/SET SPINS
                  </label>
                  <input
                    type="number"
                    value={spinsToAdd}
                    onChange={(e) => setSpinsToAdd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                    placeholder="e.g. 5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1">
                    ADD/SET BALANCE (₹)
                  </label>
                  <input
                    type="number"
                    value={balanceToAdd}
                    onChange={(e) => setBalanceToAdd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-['Outfit'] font-black text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <span>UPDATE USER SPINS & BALANCE ⚡</span>
              </button>
            </form>

            {/* List of Detected Users */}
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-2">
                Registered Users in Database ({users.length}):
              </span>
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <strong className="text-xs font-bold text-slate-800 block">
                        {u.name} {u.id === currentUser.id ? '(You)' : ''}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID: #{u.id} • Spins: <strong className="text-sky-600">{u.spins}</strong> • Balance: <strong className="text-emerald-600">₹{u.balance}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          addSpinsToUser(u.id, 5);
                          setUsers(getAllUsers());
                          triggerHaptic('success');
                        }}
                        className="bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[10px] px-2 py-1 rounded-lg border border-sky-200"
                      >
                        +5 Spins
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addBalanceToUser(u.id, 20, 'Admin added balance');
                          setUsers(getAllUsers());
                          triggerHaptic('success');
                        }}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] px-2 py-1 rounded-lg border border-emerald-200"
                      >
                        +₹20
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Standalone HTML Code Generator */}
        {activeTab === 'code' && (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 leading-relaxed">
              <strong className="block text-sm font-['Outfit'] font-black mb-1">
                📄 Single-File Standalone HTML Code Ready!
              </strong>
              As requested (<em>"ek admin pannel or ek user pannel ka sirf html code do usme css js sab include Krna"</em>), here is the entire standalone single-file HTML code with all CSS, JavaScript, Telegram detection, spin wheel, and admin panel fully embedded.
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-['Outfit'] font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'COPIED TO CLIPBOARD!' : 'COPY FULL HTML CODE 📋'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCode}
                className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-['Outfit'] font-black text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD INDEX.HTML 📥</span>
              </button>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                HTML Code Preview:
              </span>
              <pre className="w-full h-44 bg-slate-900 text-slate-200 text-[10px] p-3 rounded-2xl font-mono overflow-auto select-all border border-slate-800">
                {generateStandaloneHtml().slice(0, 1500) + '\n\n... [Click Copy Full HTML Code above to copy entire file] ...'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
