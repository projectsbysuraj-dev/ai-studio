import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { AppSettings, UserProfile, WithdrawalMethod } from '../types';
import { requestWithdrawal } from '../services/store';
import { triggerHaptic } from '../services/telegram';

interface WithdrawModalProps {
  user: UserProfile;
  settings: AppSettings;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  user,
  settings,
  onClose,
  onSuccess,
}) => {
  const [method, setMethod] = useState<WithdrawalMethod>('upi');
  const [amount, setAmount] = useState<string>(String(Math.max(settings.minWithdrawalLimit, 20)));
  const [upiId, setUpiId] = useState('');
  const [accountHolder, setAccountHolder] = useState(user.name);
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < settings.minWithdrawalLimit) {
      setError(`Minimum withdrawal amount is ₹${settings.minWithdrawalLimit}`);
      triggerHaptic('error');
      return;
    }

    if (numAmount > user.balance) {
      setError(`Insufficient balance! Your available balance is ₹${user.balance.toFixed(2)}`);
      triggerHaptic('error');
      return;
    }

    if (method === 'upi') {
      if (!upiId.trim() || !upiId.includes('@')) {
        setError('Please enter a valid UPI ID (e.g. username@okhdfcbank or 9876543210@paytm)');
        triggerHaptic('error');
        return;
      }
    } else {
      if (!accountNumber.trim() || accountNumber.length < 8) {
        setError('Please enter a valid Bank Account Number');
        triggerHaptic('error');
        return;
      }
      if (!ifsc.trim() || ifsc.length < 5) {
        setError('Please enter a valid IFSC code (e.g. HDFC0001234)');
        triggerHaptic('error');
        return;
      }
    }

    setIsSubmitting(true);
    triggerHaptic('medium');

    const result = requestWithdrawal({
      userId: user.id,
      userName: user.name,
      amount: numAmount,
      method,
      upiId: method === 'upi' ? upiId.trim() : undefined,
      accountHolder: method === 'bank' ? accountHolder.trim() : undefined,
      accountNumber: method === 'bank' ? accountNumber.trim() : undefined,
      bankName: method === 'bank' ? bankName.trim() : undefined,
      ifsc: method === 'bank' ? ifsc.trim().toUpperCase() : undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      triggerHaptic('success');
      onSuccess();
    } else {
      setError(result.error || 'Failed to submit withdrawal request');
      triggerHaptic('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl animate-slide-up flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {/* Header (Always Visible at Top) */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-['Outfit'] font-black text-xl text-slate-800">
                Withdraw Cash
              </h3>
              <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Instant</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              100% Payout via UPI &amp; Bank Account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold active:scale-90 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="withdraw-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {/* Available Balance Banner */}
          <div className="bg-[#0a192f] text-white rounded-2xl p-4 flex items-center justify-between shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                AVAILABLE BALANCE
              </span>
              <span className="font-['Outfit'] font-black text-2xl text-[#38bdf8]">
                ₹ {user.balance.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                MINIMUM LIMIT
              </span>
              <span className="font-['Outfit'] font-bold text-sm text-amber-300">
                ₹ {settings.minWithdrawalLimit}
              </span>
            </div>
          </div>

          {/* Method Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setMethod('upi')}
              className={`py-2.5 text-xs font-['Outfit'] font-extrabold rounded-xl transition-all ${
                method === 'upi'
                  ? 'bg-white text-[#0284c7] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ UPI Transfer
            </button>
            <button
              type="button"
              onClick={() => setMethod('bank')}
              className={`py-2.5 text-xs font-['Outfit'] font-extrabold rounded-xl transition-all ${
                method === 'bank'
                  ? 'bg-white text-[#0284c7] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏦 Bank Account
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Withdrawal Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                ₹
              </span>
              <input
                type="number"
                min={settings.minWithdrawalLimit}
                max={user.balance}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-['Outfit'] font-extrabold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder={`Min ₹${settings.minWithdrawalLimit}`}
              />
            </div>
          </div>

          {method === 'upi' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                UPI ID (VPA)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                placeholder="e.g. mobile@upi or username@okhdfcbank"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Works with Google Pay, PhonePe, Paytm, BHIM &amp; all UPI apps.
              </span>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                  placeholder="Full name as in bank passbook"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Bank Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                    placeholder="Account Number"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium uppercase text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                    placeholder="BARB0PUPRIX"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Bank Name (Optional)
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0284c7]"
                  placeholder="Bank of Baroda, SBI, HDFC, etc."
                />
              </div>
            </>
          )}

          {/* Bottom spacing buffer so inputs don't touch sticky footer */}
          <div className="h-2" />
        </form>

        {/* Sticky Bottom Footer with Submit Button (ALWAYS Visible on Phone) */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0 shadow-[0_-8px_20px_rgba(0,0,0,0.06)]">
          <button
            type="submit"
            form="withdraw-form"
            disabled={isSubmitting || user.balance < settings.minWithdrawalLimit}
            className="w-full bg-gradient-to-r from-[#0284c7] via-[#0ea5e9] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0284c7] text-white font-['Outfit'] font-black text-sm py-3.5 rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-wider"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>SUBMIT WITHDRAWAL REQUEST ⚡</span>
          </button>
        </div>
      </div>
    </div>
  );
};
