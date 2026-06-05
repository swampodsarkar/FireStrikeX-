import { useState } from 'react';
import { motion } from 'motion/react';
import { DailyMission, DAILY_MISSIONS } from '../types';

interface DailyMissionsProps {
  missions: DailyMission[];
  onClaim: (missionId: string) => void;
  onClose: () => void;
}

export default function DailyMissions({ missions, onClaim, onClose }: DailyMissionsProps) {
  const allMissions = DAILY_MISSIONS.map(t => {
    const playerMission = missions.find(m => m.id === t.id);
    return {
      ...t,
      progress: playerMission?.progress ?? 0,
      completed: playerMission?.completed ?? false,
      claimed: playerMission?.claimed ?? false,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-950 border border-white/10 rounded-2xl p-4 max-w-sm w-full shadow-2xl"
      >
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
          <h2 className="text-sm font-heading font-black tracking-widest uppercase text-orange-300">📋 Daily Missions</h2>
          <button onClick={onClose} className="text-slate-500 text-xs cursor-pointer active:scale-90">✕</button>
        </div>

        <div className="space-y-2">
          {allMissions.map(mission => {
            const pct = Math.min(100, (mission.progress / mission.requirement) * 100);
            return (
              <div key={mission.id} className={`p-2.5 rounded-xl border ${mission.claimed ? 'border-emerald-600/30 bg-emerald-950/20' : mission.completed ? 'border-emerald-500/40 bg-emerald-950/30' : 'border-white/5 bg-white/[0.03]'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{mission.icon}</span>
                    <div>
                      <p className="text-[10px] font-heading font-bold text-slate-200">{mission.description}</p>
                      <p className="text-[8px] font-mono text-slate-500">{mission.progress}/{mission.requirement}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      +{mission.rewardAmount} {mission.rewardType === 'coins' ? '🪙' : mission.rewardType === 'gems' ? '💎' : '⭐'}
                    </span>
                    {mission.claimed ? (
                      <span className="text-[9px] text-emerald-400">✅</span>
                    ) : mission.completed ? (
                      <button
                        onClick={() => onClaim(mission.id)}
                        className="text-[8px] font-heading font-black bg-emerald-600 px-2 py-1 rounded cursor-pointer active:scale-90 uppercase tracking-wider"
                      >
                        Claim
                      </button>
                    ) : (
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
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
