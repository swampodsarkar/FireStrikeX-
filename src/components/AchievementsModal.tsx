import { motion } from 'motion/react';
import { Achievement, ACHIEVEMENTS } from '../types';

interface AchievementsModalProps {
  achievements: Achievement[];
  onClaim: (achievementId: string) => void;
  onClose: () => void;
}

export default function AchievementsModal({ achievements, onClaim, onClose }: AchievementsModalProps) {
  const all = ACHIEVEMENTS.map(t => {
    const player = achievements.find(a => a.id === t.id);
    return {
      ...t,
      progress: player?.progress ?? 0,
      unlocked: player?.unlocked ?? false,
      unlockedAt: player?.unlockedAt,
    };
  });

  const unlocked = all.filter(a => a.unlocked);
  const locked = all.filter(a => !a.unlocked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-950 border border-white/10 rounded-2xl p-4 max-w-sm w-full shadow-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2 sticky top-0 bg-slate-950 z-10">
          <h2 className="text-sm font-heading font-black tracking-widest uppercase text-yellow-300">🏅 Achievements</h2>
          <button onClick={onClose} className="text-slate-500 text-xs cursor-pointer active:scale-90">✕</button>
        </div>

        {unlocked.length > 0 && (
          <div className="mb-3">
            <p className="text-[8px] font-heading font-black tracking-widest text-emerald-400 uppercase mb-1.5">Unlocked ({unlocked.length})</p>
            <div className="space-y-1.5">
              {unlocked.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/20 border border-emerald-600/20">
                  <span className="text-lg">{a.icon}</span>
                  <div className="flex-grow">
                    <p className="text-[10px] font-heading font-bold text-emerald-300">{a.name}</p>
                    <p className="text-[7px] font-mono text-slate-500">{a.description}</p>
                  </div>
                  <span className="text-[10px]">✅</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[8px] font-heading font-black tracking-widest text-slate-500 uppercase mb-1.5">Locked ({locked.length})</p>
          <div className="space-y-1.5">
            {locked.map(a => {
              const pct = Math.min(100, (a.progress / a.maxProgress) * 100);
              return (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-lg opacity-50">{a.icon}</span>
                  <div className="flex-grow">
                    <p className="text-[10px] font-heading font-bold text-slate-400">{a.name}</p>
                    <p className="text-[7px] font-mono text-slate-600">{a.description}</p>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-gradient-to-r from-slate-600 to-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {a.rewardAmount && (
                    <span className="text-[7px] font-mono text-amber-500/60 whitespace-nowrap">+{a.rewardAmount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
