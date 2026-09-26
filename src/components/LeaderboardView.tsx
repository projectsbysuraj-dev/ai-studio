import React from 'react';
import { Trophy, Medal, Award, Flame, Users, Sparkles, ChevronRight } from 'lucide-react';
import { LeaderboardEntry } from '../types';
import { triggerHaptic } from '../services/telegram';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentUserRank?: { rank: number; referrals: number; totalPlayers: number };
  onInviteClick?: () => void;
  onViewProfile?: () => void;
  showFullDetails?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  entries,
  currentUserRank,
  onInviteClick,
  onViewProfile,
  showFullDetails = false,
}) => {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 text-slate-900 font-black text-xs flex items-center justify-center shadow-md shadow-amber-500/30 border border-yellow-200 shrink-0">
            🥇
          </div>
        );
      case 2:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-400 via-slate-200 to-white text-slate-800 font-black text-xs flex items-center justify-center shadow-md shadow-slate-400/20 border border-slate-200 shrink-0">
            🥈
          </div>
        );
      case 3:
        return (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-400 text-white font-black text-xs flex items-center justify-center shadow-md shadow-amber-700/20 border border-amber-300 shrink-0">
            🥉
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-extrabold text-xs flex items-center justify-center shrink-0">
            #{rank}
          </div>
        );
    }
  };

  const getAvatarBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-amber-400 to-yellow-600 text-white ring-2 ring-yellow-400/50';
      case 2:
        return 'bg-gradient-to-br from-slate-400 to-slate-600 text-white ring-2 ring-slate-300/50';
      case 3:
        return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-2 ring-amber-500/50';
      default:
        return 'bg-gradient-to-br from-sky-400 to-blue-600 text-white';
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Top 3 Podium Cards (when full details is true or podium mode) */}
      {showFullDetails && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 pt-4 pb-2 items-end">
          {/* #2 Rank */}
          <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-200 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-sm relative order-1">
            <span className="text-xl -mt-5 mb-1">🥈</span>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center font-black text-slate-700 text-sm mb-1.5">
              {entries[1].name.charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate w-full">
              {entries[1].name}
            </p>
            <div className="mt-1.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {entries[1].referrals} refs
            </div>
          </div>

          {/* #1 Champion */}
          <div className="bg-gradient-to-b from-amber-50 via-yellow-50/50 to-white border-2 border-amber-300 rounded-2xl p-3 flex flex-col items-center text-center shadow-md shadow-amber-500/10 relative -mt-3 order-2">
            <div className="absolute -top-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>#1 CHAMPION</span>
            </div>
            <span className="text-2xl mt-1 mb-1">🥇</span>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 border-2 border-white shadow-md flex items-center justify-center font-black text-slate-900 text-base mb-1.5 ring-2 ring-amber-300">
              {entries[0].name.charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-black text-slate-900 truncate w-full">
              {entries[0].name}
            </p>
            <div className="mt-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
              {entries[0].referrals} refs
            </div>
          </div>

          {/* #3 Rank */}
          <div className="bg-gradient-to-b from-amber-50/40 to-white border border-amber-200/80 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-sm relative order-3">
            <span className="text-xl -mt-5 mb-1">🥉</span>
            <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-white shadow-sm flex items-center justify-center font-black text-amber-800 text-sm mb-1.5">
              {entries[2].name.charAt(0).toUpperCase()}
            </div>
            <p className="text-xs font-bold text-slate-800 truncate w-full">
              {entries[2].name}
            </p>
            <div className="mt-1.5 bg-amber-50 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {entries[2].referrals} refs
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List (Top 10) or Empty State */}
      {entries.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center justify-center">
          <Trophy className="w-10 h-10 text-slate-300 mb-2 stroke-1" />
          <p className="text-xs font-bold text-slate-700">No Participants Yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5 max-w-[240px]">
            Invite friends to register and get spins to take the #1 spot on the leaderboard!
          </p>
          {onInviteClick && (
            <button
              onClick={() => {
                triggerHaptic('light');
                onInviteClick();
              }}
              className="mt-3 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
            >
              Invite Friends Now
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {entries.map((entry) => {
            const isMe = entry.isCurrentUser;
            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3 transition-colors ${
                  isMe
                    ? 'bg-sky-50/80 border-l-4 border-l-[#0284c7]'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Rank + Avatar + Name */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  {getRankBadge(entry.rank)}

                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs ${getAvatarBg(
                      entry.rank
                    )}`}
                  >
                    {entry.name ? entry.name.charAt(0).toUpperCase() : 'U'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs font-bold truncate ${
                          isMe ? 'text-[#0284c7] font-black' : 'text-slate-800'
                        }`}
                      >
                        {entry.name}
                      </p>
                      {isMe && (
                        <span className="bg-[#0284c7] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                          YOU
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Referral Points + Spins */}
                <div className="flex flex-col items-end shrink-0 pl-1">
                  <div className="flex items-center gap-1 bg-sky-100 text-[#0284c7] px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs">
                    <Users className="w-3 h-3 text-[#0284c7]" />
                    <span>{entry.referrals}</span>
                    <span className="text-[10px] font-semibold text-sky-700">refs</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                    +{entry.spinsEarned} spins won
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User's current rank bar if provided */}
      {currentUserRank && (
        <div className="bg-gradient-to-r from-[#0369a1] to-[#0284c7] text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xs text-white">
              #{currentUserRank.rank}
            </div>
            <div>
              <p className="text-xs font-black tracking-tight">Your Current Rank</p>
              <p className="text-[10px] text-sky-200">
                {currentUserRank.referrals} successful referrals
              </p>
            </div>
          </div>

          {onInviteClick && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                onInviteClick();
              }}
              className="bg-white hover:bg-sky-50 text-[#0284c7] text-xs font-black px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1 shrink-0"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Rank Up</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
