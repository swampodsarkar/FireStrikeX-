import { useState } from 'react';
import { Emote, FREE_EMOTES, PREMIUM_EMOTES } from '../types';

interface EmoteSelectorProps {
  ownedPremiumEmoteIds: string[];
  onSelect: (emote: Emote) => void;
  onClose: () => void;
}

export default function EmoteSelector({ ownedPremiumEmoteIds, onSelect, onClose }: EmoteSelectorProps) {
  const allFree = FREE_EMOTES;
  const ownedPremium = PREMIUM_EMOTES.filter(e => ownedPremiumEmoteIds.includes(e.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 max-w-xs w-full shadow-2xl">
        <div className="flex items-center justify-between mb-2 border-b border-white/5 pb-1.5">
          <h2 className="text-xs font-heading font-black uppercase text-slate-300">😄 Emotes</h2>
          <button onClick={onClose} className="text-slate-500 text-xs cursor-pointer">✕</button>
        </div>

        <p className="text-[8px] font-heading font-black tracking-widest text-slate-500 uppercase mb-1">Free</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {allFree.map(e => (
            <button key={e.id} onClick={() => { onSelect(e); onClose(); }}
              className="text-2xl p-2 rounded-lg bg-white/[0.03] border border-white/5 active:bg-white/20 cursor-pointer active:scale-90 transition-all">
              {e.emoji}
            </button>
          ))}
        </div>

        {ownedPremium.length > 0 && (
          <>
            <p className="text-[8px] font-heading font-black tracking-widest text-amber-500 uppercase mb-1">Premium</p>
            <div className="grid grid-cols-4 gap-2">
              {ownedPremium.map(e => (
                <button key={e.id} onClick={() => { onSelect(e); onClose(); }}
                  className="text-2xl p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 active:bg-amber-500/20 cursor-pointer active:scale-90 transition-all">
                  {e.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
