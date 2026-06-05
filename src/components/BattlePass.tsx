import { motion } from 'motion/react';
import { BattlePassLevel, BattlePassState, BATTLE_PASS_LEVELS } from '../types';
import { Gem, Sparkles, Lock, Check, Crown, Gift } from 'lucide-react';

interface BattlePassProps {
  state: BattlePassState;
  onClaimFree: (level: number) => void;
  onClaimPremium: (level: number) => void;
  onPurchasePremium: () => void;
  onClose: () => void;
}

export default function BattlePass({ state, onClaimFree, onClaimPremium, onPurchasePremium, onClose }: BattlePassProps) {
  const maxLevel = BATTLE_PASS_LEVELS.length;
  const currentLevel = Math.min(state.level, maxLevel);
  const pct = (currentLevel / maxLevel) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-slate-950 border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-950 z-10 border-b border-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-heading font-black tracking-widest uppercase text-orange-300">Battle Pass</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 text-xs cursor-pointer active:scale-90">✕</button>
          </div>

          {/* Level progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-slate-500 shrink-0">LV.{currentLevel}</span>
            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[8px] font-mono text-slate-500 shrink-0">{state.xp} / {currentLevel < maxLevel ? BATTLE_PASS_LEVELS[currentLevel]?.xpRequired ?? 100 : 100} XP</span>
          </div>

          {/* Premium purchase banner */}
          {!state.hasPremium && (
            <button
              onClick={onPurchasePremium}
              className="mt-2 w-full h-7 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Gem className="w-3 h-3 text-white" />
              <span className="text-[8px] font-heading font-black tracking-widest uppercase text-white">Unlock Premium Pass — 500 Gems</span>
            </button>
          )}
          {state.hasPremium && (
            <div className="mt-2 w-full h-7 bg-emerald-600/30 border border-emerald-500/30 rounded-lg flex items-center justify-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[8px] font-heading font-black tracking-widest uppercase text-emerald-300">Premium Unlocked</span>
            </div>
          )}
        </div>

        {/* Reward tiers */}
        <div className="p-3 space-y-1">
          {BATTLE_PASS_LEVELS.map((bpLevel, index) => {
            const levelNum = index + 1;
            const isUnlocked = state.level >= levelNum;
            const freeClaimed = state.claimedFree.includes(levelNum);
            const premiumClaimed = state.claimedPremium.includes(levelNum);
            const isCurrent = levelNum === currentLevel + 1;

            return (
              <div
                key={levelNum}
                className={`p-2 rounded-lg border transition-all ${
                  isCurrent ? 'border-amber-500/40 bg-amber-500/5' :
                  isUnlocked && !freeClaimed ? 'border-emerald-500/30 bg-emerald-500/5' :
                  freeClaimed ? 'border-white/5 bg-white/[0.02]' :
                  'border-white/[0.03] bg-white/[0.01] opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-heading font-black ${
                      isUnlocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-slate-800 text-slate-600 border border-white/5'
                    }`}>
                      {levelNum}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Free reward */}
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono ${
                        freeClaimed ? 'bg-emerald-900/30 text-emerald-500' :
                        isUnlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-slate-800/50 text-slate-600'
                      }`}>
                        <Gift className="w-2.5 h-2.5" />
                        <span>{bpLevel.freeReward.name}</span>
                        {freeClaimed && <Check className="w-2.5 h-2.5" />}
                      </div>
                      {/* Premium reward */}
                      {state.hasPremium && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono ${
                          premiumClaimed ? 'bg-yellow-900/30 text-yellow-500' :
                          isUnlocked ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-slate-800/50 text-slate-600'
                        }`}>
                          <Gem className="w-2.5 h-2.5" />
                          <span>{bpLevel.premiumReward.name}</span>
                          {premiumClaimed && <Check className="w-2.5 h-2.5" />}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isUnlocked && !freeClaimed && (
                      <button
                        onClick={() => onClaimFree(levelNum)}
                        className="text-[7px] font-heading font-black bg-emerald-600 hover:bg-emerald-500 px-1.5 py-0.5 rounded cursor-pointer active:scale-90 uppercase tracking-wider"
                      >
                        Claim
                      </button>
                    )}
                    {state.hasPremium && isUnlocked && !premiumClaimed && (
                      <button
                        onClick={() => onClaimPremium(levelNum)}
                        className="text-[7px] font-heading font-black bg-yellow-600 hover:bg-yellow-500 px-1.5 py-0.5 rounded cursor-pointer active:scale-90 uppercase tracking-wider"
                      >
                        Premium
                      </button>
                    )}
                    {!isUnlocked && (
                      <Lock className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
