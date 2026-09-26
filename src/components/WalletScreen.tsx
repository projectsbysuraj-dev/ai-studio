import React, { useState } from 'react';
import { Zap, RotateCw } from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { getUserTransactions } from '../services/store';
import { WithdrawModal } from './WithdrawModal';
import { TabType } from './BottomNav';
import { triggerHaptic } from '../services/telegram';

interface WalletScreenProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: TabType) => void;
  onOpenWithdraw?: () => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  user,
  settings,
  onNavigate,
  onOpenWithdraw,
}) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const transactions = getUserTransactions(user.id);

  const handleOpenWithdraw = () => {
    triggerHaptic('medium');
    if (onOpenWithdraw) {
      onOpenWithdraw();
    } else {
      setShowWithdrawModal(true);
    }
  };

  const handleWithdrawSuccess = () => {
    setShowWithdrawModal(false);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 4000);
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="w-full bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-700/30 flex items-center justify-between animate-slide-down">
          <span>✅ Withdrawal request placed! Live syncing with Admin Panel.</span>
          <button onClick={() => setSuccessToast(false)} className="text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Available Balance Card matching Screenshot 3 */}
      <div className="w-full bg-[#0a192f] border border-sky-500/25 rounded-[28px] p-6 text-white shadow-2xl shadow-sky-950/40 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            AVAILABLE BALANCE
          </span>
          <div className="bg-[#0c2e59] border border-sky-400/40 rounded-full px-3 py-1 text-[11px] font-['Outfit'] font-black text-[#38bdf8]">
            Min ₹{settings.minWithdrawalLimit} Payout
          </div>
        </div>

        <h2 className="font-['Outfit'] font-black text-4xl text-[#38bdf8] tracking-tight mb-2">
          ₹ {user.balance.toFixed(2)}
        </h2>

        <p className="text-xs text-slate-300 font-medium mb-6">
          Instant 100% Payout via Bank Account & UPI
        </p>

        {/* Buttons Row matching Screenshot 3 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleOpenWithdraw}
            className="bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-extrabold text-xs py-3 rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Withdraw Cash</span>
          </button>

          <button
            onClick={() => onNavigate('home')}
            className="bg-[#0f2744] hover:bg-[#163860] text-sky-200 font-['Outfit'] font-extrabold text-xs py-3 rounded-2xl border border-sky-700/50 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <RotateCw className="w-3.5 h-3.5 text-sky-300" />
            <span>Go to Spin</span>
          </button>
        </div>
      </div>

      {/* Section Header: Recent Transactions */}
      <div className="w-full">
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="w-1.5 h-5 bg-[#38bdf8] rounded-full"></span>
          <h2 className="font-['Outfit'] font-extrabold text-white text-lg tracking-tight">
            Recent Transactions
          </h2>
        </div>

        {/* Transaction List or Empty State */}
        {transactions.length === 0 ? (
          <div className="w-full py-12 px-6 text-center text-sky-100 text-xs font-semibold leading-relaxed">
            No transactions yet. Refer friends on Telegram to get spins & earn!
          </div>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isWithdrawal = tx.type === 'withdrawal';
              const isCompleted = tx.status === 'completed';
              const isPending = tx.status === 'pending';

              return (
                <div
                  key={tx.id}
                  className={`rounded-2xl p-4 shadow-sm border transition-all ${
                    isWithdrawal && isCompleted
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : isWithdrawal && isPending
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-slate-100'
                  } flex items-center justify-between`}
                >
                  <div className="flex-1 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-extrabold text-slate-800 leading-snug">
                        {tx.description}
                      </h4>
                      {isWithdrawal && isCompleted && (
                        <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                          Paid ✅
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : isPending
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {isCompleted
                          ? 'Successful'
                          : isPending
                          ? 'In Review'
                          : 'Rejected'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-['Outfit'] font-black text-sm block ${
                        tx.amount > 0 ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showWithdrawModal && !onOpenWithdraw && (
        <WithdrawModal
          user={user}
          settings={settings}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={handleWithdrawSuccess}
        />
      )}
    </div>
  );
};
