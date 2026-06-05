import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../lib/firebase';
import { MatchState, HEROES_DATABASE } from '../types';
import { Eye, Search, ArrowLeft } from 'lucide-react';

interface SpectatorScreenProps {
  onBack: () => void;
}

export default function SpectatorScreen({ onBack }: SpectatorScreenProps) {
  const [matchId, setMatchId] = useState('');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(false);

  const watchMatch = () => {
    if (!matchId.trim()) return;
    setLoading(true);
    const ref = doc(db, 'matches', matchId.trim());
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setMatch(snap.data() as MatchState);
      } else {
        setMatch(null);
      }
      setLoading(false);
    }, () => { setLoading(false); });
    return unsub;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-cyan-400">Spectator Mode</span>
        </div>
        <div className="w-14" />
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        {!match && (
          <div className="space-y-4 max-w-md mx-auto mt-12">
            <div className="text-center space-y-2 mb-6">
              <Eye className="w-12 h-12 text-cyan-500/50 mx-auto" />
              <p className="text-[10px] font-mono text-slate-500">Enter a Match ID to spectate live battles</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="room_bot_xxx_1234567890"
                className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={watchMatch}
                disabled={loading || !matchId.trim()}
                className="h-10 px-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 rounded-xl flex items-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all"
              >
                <Search className="w-3.5 h-3.5" /> Watch
              </button>
            </div>
            {loading && <p className="text-center text-[10px] font-mono text-cyan-400 animate-pulse">Connecting to match feed...</p>}
          </div>
        )}

        {match && (
          <div className="space-y-4 max-w-2xl mx-auto">
            {/* Match header */}
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400 uppercase">LIVE</span>
                <span className="text-[9px] font-mono text-slate-500">Turn #{match.turnNumber}</span>
                <span className="text-[9px] font-mono text-slate-500">Arena: {match.arena?.toUpperCase()}</span>
              </div>
              <span className="text-[8px] font-mono text-slate-600 truncate max-w-[200px]">{match.matchId}</span>
            </div>

            {/* Side-by-side fighters */}
            <div className="grid grid-cols-2 gap-3">
              {[match.playerA, match.playerB].map((p, idx) => {
                const hero = HEROES_DATABASE[p.heroId];
                const hpPct = (p.hp / p.maxHp) * 100;
                return (
                  <div key={p.uid} className={`bg-white/5 rounded-xl p-3 border ${p.uid === match.currentTurn ? 'border-cyan-500/40' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{idx === 0 ? '🔴' : '🔵'}</span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-heading font-black truncate">{p.username}</p>
                        <p className="text-[8px] font-mono text-slate-500">{hero?.name || p.heroId}</p>
                      </div>
                    </div>
                    {/* HP bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                      <div className={`h-full rounded-full transition-all ${hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${hpPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-slate-400">
                      <span>HP: {p.hp}/{p.maxHp}</span>
                      <span>Energy: {p.energy}%</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {p.isFrozen && <span className="text-[8px] bg-sky-500/20 text-sky-400 px-1 rounded">FROZEN</span>}
                      {p.isStealth && <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">STEALTH</span>}
                      {p.shieldHp > 0 && <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1 rounded">SHIELD {p.shieldHp}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Battle Logs */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <p className="text-[9px] font-heading font-black text-slate-400 uppercase mb-2">Battle Log</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {match.battleLogs.slice(-20).reverse().map((log) => (
                  <div key={log.id} className="text-[8px] font-mono text-slate-400 border-b border-white/5 pb-0.5">
                    <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>{' '}
                    <span className={log.playerId === match.playerA.uid ? 'text-red-400' : log.playerId === match.playerB.uid ? 'text-blue-400' : 'text-yellow-400'}>
                      {log.playerName}
                    </span>{' '}
                    <span>{log.actionText}</span>
                    {log.damageDealt && <span className="text-red-400"> (-{log.damageDealt})</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <button
              onClick={() => { setMatch(null); setMatchId(''); }}
              className="w-full h-9 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all"
            >
              ← Stop Spectating
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
