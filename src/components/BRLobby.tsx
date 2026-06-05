import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from '../lib/firebase';
import { PlayerProfile, BR_MAX_PLAYERS, BR_MIN_PLAYERS } from '../types';
import { Swords, Users, Clock, ArrowLeft } from 'lucide-react';

interface BRLobbyProps {
  profile: PlayerProfile;
  onBack: () => void;
  onStartMatch: (matchId: string) => void;
}

export default function BRLobby({ profile, onBack, onStartMatch }: BRLobbyProps) {
  const [players, setPlayers] = useState<{ uid: string; username: string }[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Join or create a BR lobby
  useEffect(() => {
    const lobbyId = 'br_lobby_active';
    const ref = doc(db, 'br_lobby', lobbyId);

    const joinLobby = async () => {
      const snap = await getDocs(collection(db, 'br_lobby', lobbyId, 'players'));
      const existing: { uid: string; username: string }[] = [];
      snap.forEach((d) => existing.push(d.data() as any));
      if (existing.find((p: any) => p.uid === profile.uid)) return;
      await setDoc(doc(db, 'br_lobby', lobbyId, 'players', profile.uid), { uid: profile.uid, username: profile.username });
    };
    joinLobby();

    const unsub = onSnapshot(collection(db, 'br_lobby', lobbyId, 'players'), (snap) => {
      const list: { uid: string; username: string }[] = [];
      snap.forEach((d) => list.push(d.data() as any));
      setPlayers(list);
    });

    return () => {
      unsub();
      deleteDoc(doc(db, 'br_lobby', lobbyId, 'players', profile.uid)).catch(() => {});
    };
  }, [profile.uid]);

  // Auto-start when enough players
  useEffect(() => {
    if (players.length >= BR_MAX_PLAYERS) {
      startMatch();
    }
  }, [players.length]);

  const startMatch = async () => {
    const mid = `br_${Date.now()}`;
    const lobbyId = 'br_lobby_active';

    // Create match
    const brPlayers = players.map((p, i) => ({
      uid: p.uid, username: p.username,
      x: Math.cos((i / players.length) * Math.PI * 2) * 15,
      y: 0, z: Math.sin((i / players.length) * Math.PI * 2) * 15,
      rx: 0, ry: 0, hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol',
    }));

    await setDoc(doc(db, 'br_matches', mid), {
      matchId: mid, status: 'active', players: brPlayers,
      zone: { centerX: 0, centerZ: 0, radius: 50, nextRadius: 30, phase: 0, timer: 30 },
      loot: [], startTime: Date.now(),
    });

    // Clean lobby
    for (const p of players) {
      deleteDoc(doc(db, 'br_lobby', lobbyId, 'players', p.uid)).catch(() => {});
    }

    setMatchId(mid);
    onStartMatch(mid);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <Swords className="w-4 h-4 text-red-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-red-400">Battle Royale</span>
        </div>
        <div className="w-14" />
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center space-y-6 max-w-sm">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-dashed border-red-500/30 rounded-full animate-spin" />
            <div className="absolute inset-3 border-2 border-dashed border-red-500/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
            <Swords className="absolute inset-0 m-auto w-10 h-10 text-red-400" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-black text-red-400 uppercase tracking-widest">Battle Royale</h2>
            <p className="text-[10px] font-mono text-slate-500 mt-1">10 players • last one standing wins</p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> Players
              </span>
              <span className="text-sm font-heading font-black text-red-400">{players.length}/{BR_MAX_PLAYERS}</span>
            </div>

            {/* Player avatars */}
            <div className="flex flex-wrap gap-1.5 justify-center max-h-32 overflow-y-auto">
              {players.map((p) => (
                <div key={p.uid} className={`text-[9px] font-mono px-2 py-1 rounded-lg border ${p.uid === profile.uid ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                  {p.username}
                </div>
              ))}
            </div>

            {players.length < BR_MIN_PLAYERS ? (
              <p className="text-[9px] font-mono text-slate-600 animate-pulse">Waiting for players to join...</p>
            ) : players.length < BR_MAX_PLAYERS ? (
              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all" style={{ width: `${(players.length / BR_MAX_PLAYERS) * 100}%` }} />
                </div>
                <p className="text-[9px] font-mono text-slate-500">
                  <Clock className="w-2.5 h-2.5 inline mr-1" />
                  Auto-start when full ({BR_MAX_PLAYERS - players.length} more needed)
                </p>
                <button onClick={startMatch} className="w-full h-9 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
                  Force Start ({players.length} players)
                </button>
              </div>
            ) : (
              <p className="text-[10px] font-mono text-emerald-400 animate-pulse">Match starting...</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
