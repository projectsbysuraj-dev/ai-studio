import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, ExternalLink, Trophy, User } from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { TabType } from './BottomNav';
import { WithdrawModal } from './WithdrawModal';
import { openExternalOrTelegramLink, triggerHaptic } from '../services/telegram';
import { AppLogo } from './AppLogo';
import { LeaderboardView } from './LeaderboardView';
import { getReferralLeaderboard, getUserLeaderboardRank } from '../services/store';

interface ProfileScreenProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: TabType) => void;
  onOpenWithdraw?: () => void;
}

export type ProfileCategory = 'account' | 'leaderboard';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  settings,
  onNavigate,
  onOpenWithdraw,
}) => {
  const [activeCategory, setActiveCategory] = useState<ProfileCategory>('account');
  const [showWithdraw, setShowWithdraw] = useState(false);

  const leaderboardEntries = getReferralLeaderboard(user.id, 10);
  const userRankInfo = getUserLeaderboardRank(user.id);

  const handleWithdrawClick = () => {
    if (onOpenWithdraw) {
      onOpenWithdraw();
    } else {
      setShowWithdraw(true);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 pb-20 animate-fade-in">
      {/* Category Navigation Pills at top of Profile */}
      <div className="w-full bg-black/20 backdrop-blur-md p-1 rounded-2xl flex items-center gap-1 border border-white/10">
        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveCategory('account');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-['Outfit'] font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeCategory === 'account'
              ? 'bg-white text-slate-800 shadow-md'
              : 'text-sky-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>My Profile</span>
        </button>

        <button
          onClick={() => {
            triggerHaptic('light');
            setActiveCategory('leaderboard');
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-['Outfit'] font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
            activeCategory === 'leaderboard'
              ? 'bg-white text-[#0284c7] shadow-md'
              : 'text-sky-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Leaderboard 🏆</span>
        </button>
      </div>

      {activeCategory === 'account' ? (
        <>
          {/* Profile Card matching Screenshot 4 */}
          <div className="w-full bg-white rounded-[26px] p-5 shadow-xl shadow-sky-950/10 border border-white flex items-center gap-4">
            {/* App Logo Avatar */}
            <div className="relative shrink-0">
              <AppLogo className="w-16 h-16 filter drop-shadow-md" />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="font-['Outfit'] font-black text-xl text-slate-800 tracking-tight leading-tight truncate">
                {user.name}
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 mb-1.5 font-mono">
                User ID: #{user.id}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <div className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-[#0284c7] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider">
                  <ShieldCheck className="w-3 h-3 text-[#0284c7]" />
                  <span>VERIFIED TELEGRAM USER</span>
                </div>
                <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  <span>@{settings.botUsername || 'RohitGiveawayBot'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Quick Actions */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-1.5 h-5 bg-[#38bdf8] rounded-full"></span>
              <h2 className="font-['Outfit'] font-extrabold text-white text-lg tracking-tight">
                Categories & Actions
              </h2>
            </div>

            {/* Action List matching user panel without any admin button */}
            <div className="bg-white rounded-[26px] shadow-xl shadow-sky-950/10 border border-white overflow-hidden divide-y divide-slate-100">
              {/* Category Action: Leaderboard */}
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setActiveCategory('leaderboard');
                }}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-sky-50/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🏆</span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-[#0284c7] block">
                      Referral Leaderboard (Top 10)
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Check your rank #{userRankInfo.rank} • Top referral champions
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-[#0284c7]">
                  <span>View</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Action 1: Lucky Spin Wheel */}
              <button
                onClick={() => onNavigate('home')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🎡</span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                    Lucky Spin Wheel
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Action 2: Refer Friends */}
              <button
                onClick={() => onNavigate('invite')}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🤝</span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                    Refer Friends (1 Refer = 1 Spin)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Action 3: Withdraw Cash */}
              <button
                onClick={handleWithdrawClick}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">💸</span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                    Withdraw Cash (Bank / UPI)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Action 4: Official Telegram Channel */}
              <button
                onClick={() => openExternalOrTelegramLink(settings.telegramChannelUrl)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">💬</span>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">
                    Official Telegram Channel
                  </span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Leaderboard Category View */
        <div className="w-full bg-white rounded-[26px] p-5 shadow-xl shadow-sky-950/10 border border-white">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-['Outfit'] font-black text-slate-900 text-lg flex items-center gap-2">
                <span>🏆</span>
                <span>Referral Leaderboard</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Top 10 users with the most referral points
              </p>
            </div>
            <div className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Live Ranking
            </div>
          </div>

          <LeaderboardView
            entries={leaderboardEntries}
            currentUserRank={userRankInfo}
            onInviteClick={() => onNavigate('invite')}
            showFullDetails={true}
          />
        </div>
      )}

      {showWithdraw && !onOpenWithdraw && (
        <WithdrawModal
          user={user}
          settings={settings}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => setShowWithdraw(false)}
        />
      )}
    </div>
  );
};


export default ProfileScreen;
