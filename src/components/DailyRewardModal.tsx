import { motion } from 'motion/react';
import { Calendar, CheckCircle2, Gift, X } from 'lucide-react';
import { PlayerProfile } from '../types';

interface DailyRewardModalProps {
  profile: PlayerProfile;
  onClaim: (claimedAmt: number, rewardType: string, newStreak: number) => void;
  onClose: () => void;
}

const REWARDS_PLAN = [
  { day: 1, reward: '100 Coins', type: 'coins', amt: 100, icon: '🪙' },
  { day: 2, reward: '150 Coins', type: 'coins', amt: 150, icon: '🪙' },
  { day: 3, reward: '250 Coins', type: 'coins', amt: 250, icon: '🪙' },
  { day: 4, reward: '15 Gems', type: 'gems', amt: 15, icon: '💎' },
  { day: 5, reward: '400 Coins', type: 'coins', amt: 400, icon: '🪙' },
  { day: 6, reward: '35 Gems', type: 'gems', amt: 35, icon: '💎' },
  { day: 7, reward: 'Rare Hero Chest', type: 'chest', amt: 1, icon: '🎁' },
];

export default function DailyRewardModal({ profile, onClaim, onClose }: DailyRewardModalProps) {
  // Check if reward is already claimed today
  const lastClaimed = profile.lastClaimedRewardDate ? new Date(profile.lastClaimedRewardDate) : null;
  const today = new Date();
  const alreadyClaimedToday = lastClaimed && lastClaimed.toDateString() === today.toDateString();

  // Streak index to claim
  const currentStreakIndex = profile.dailyStreak % 7; // 0 to 6
  const nextReward = REWARDS_PLAN[currentStreakIndex];

  const handleClaim = () => {
    if (alreadyClaimedToday) return;

    const claimedAmt = nextReward.amt;
    const rewardType = nextReward.type;
    const newStreak = profile.dailyStreak + 1;

    onClaim(claimedAmt, rewardType, newStreak);
  };

  return (
    <div className="fixed inset-0 h-full w-full flex items-center justify-center bg-black/80 z-50 p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 15 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden shadow-2xl space-y-6"
      >
        {/* Background glow flares */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-orange-500/20 rounded-full blur-xl" />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 h-10 w-10 flex items-center justify-center bg-orange-950 border border-orange-900 text-orange-400 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold">Daily Bonuses</h3>
              <p className="text-xs text-slate-400 font-mono">STREAK: {profile.dailyStreak} DAYS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="btn_daily_close"
            className="p-1 rounded-lg border border-slate-800 hover:bg-slate-850 text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reward Plan Calendar */}
        <div className="grid grid-cols-4 gap-2">
          {REWARDS_PLAN.map((item, index) => {
            const isCompleted = index < currentStreakIndex;
            const isCurrent = index === currentStreakIndex && !alreadyClaimedToday;
            const isFuture = index > currentStreakIndex || (index === currentStreakIndex && alreadyClaimedToday);

            const displayDay = item.day;

            return (
              <div
                key={item.day}
                className={`relative flex flex-col items-center justify-between p-2 rounded-xl text-center border aspect-square transition-all duration-300 ${
                  isCompleted
                    ? 'bg-slate-950/40 border-slate-800 text-slate-500'
                    : isCurrent
                    ? 'bg-orange-950/20 border-orange-500 shadow-md shadow-orange-500/5 text-slate-100 scale-102'
                    : 'bg-slate-950/20 border-slate-850 text-slate-450'
                } ${displayDay === 7 ? 'col-span-2 aspect-auto h-full py-4 bg-gradient-to-br from-indigo-950/30 to-violet-950/30 border-indigo-700/45' : ''}`}
              >
                <span className="text-[10px] font-mono tracking-wider font-bold">DAY {item.day}</span>
                <span className="text-2xl my-1">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.reward}</span>

                {isCompleted && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-950" />
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-1 -left-1">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div>
          {alreadyClaimedToday ? (
            <div className="w-full h-12 flex items-center justify-center space-x-2 rounded-xl bg-slate-950/40 border border-slate-850 text-slate-500 font-heading text-xs font-bold tracking-wider">
              <span>ALREADY CLAIMED TODAY (RESET IN 18h)</span>
            </div>
          ) : (
            <button
              onClick={handleClaim}
              id="btn_claim_daily"
              className="w-full h-12 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-650 text-slate-100 font-heading font-bold text-sm tracking-widest cursor-pointer active:scale-98 shadow-xl shadow-orange-950/30"
            >
              <Gift className="w-4 h-4" />
              <span>CLAIM DAY {currentStreakIndex + 1} REWARD</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
