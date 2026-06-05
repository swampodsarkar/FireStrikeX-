import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from '../lib/firebase';
import { PlayerProfile, BR_MAX_PLAYERS, BR_MIN_PLAYERS, BrMode, BR_MODE_CONFIG, BrTeam } from '../types';
import { Swords, Users, Clock, ArrowLeft, User, Users2 } from 'lucide-react';

interface BRLobbyProps {
  profile: PlayerProfile;
  onBack: () => void;
  onStartMatch: (matchId: string, mode: BrMode) => void;
}

const LOBBY_ID = 'br_lobby_active';

export default function BRLobby({ profile, onBack, onStartMatch }: BRLobbyProps) {
  const [players, setPlayers] = useState<{ uid: string; username: string }[]>([]);
  const [mode, setMode] = useState<BrMode>('solo');
  const [matchId, setMatchId] = useState<string | null>(null);

  const cfg = BR_MODE_CONFIG[mode];
  const maxPlayers = cfg.maxPlayers;
  const maxTeams = cfg.maxTeams;
  const teamSize = cfg.teamSize;

  // Join lobby
  useEffect(() => {
    const joinLobby = async () => {
      const snap = await getDocs(collection(db, LOBBY_ID, 'players'));
      const existing: { uid: string; username: string }[] = [];
      snap.forEach((d) => existing.push(d.data() as any));
      if (existing.find((p: any) => p.uid === profile.uid)) return;
      await setDoc(doc(db, LOBBY_ID, 'players', profile.uid), { uid: profile.uid, username: profile.username });
    };
    joinLobby();

    const unsub = onSnapshot(collection(db, LOBBY_ID, 'players'), (snap) => {
      const list: { uid: string; username: string }[] = [];
      snap.forEach((d) => list.push(d.data() as any));
      setPlayers(list);
    });

    return () => {
      unsub();
      deleteDoc(doc(db, LOBBY_ID, 'players', profile.uid)).catch(() => {});
    };
  }, [profile.uid]);

  // Auto-start
  useEffect(() => {
    if (players.length >= maxPlayers) startMatch();
  }, [players.length, maxPlayers]);

  // Build teams from player list (sequential pairing)
  const buildTeams = (): BrTeam[] => {
    if (mode === 'solo') return players.map((p, i) => ({ id: i, members: [p.uid], alive: true }));
    const teams: BrTeam[] = [];
    for (let i = 0; i < players.length; i += teamSize) {
      teams.push({ id: teams.length, members: players.slice(i, i + teamSize).map(p => p.uid), alive: true });
    }
    return teams;
  };

  // Get team display for duo mode
  const getPlayerTeam = (uid: string): number => {
    for (const t of buildTeams()) {
      if (t.members.includes(uid)) return t.id;
    }
    return -1;
  };

  const startMatch = async () => {
    const mid = `br_${Date.now()}`;
    const teams = buildTeams();

    const brPlayers = players.map((p, i) => ({
      uid: p.uid, username: p.username,
      x: Math.cos((i / players.length) * Math.PI * 2) * 15,
      y: 0, z: Math.sin((i / players.length) * Math.PI * 2) * 15,
      rx: 0, ry: 0, hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol', teamId: mode === 'duo' ? getPlayerTeam(p.uid) : -1,
    }));

    await setDoc(doc(db, 'br_matches', mid), {
      matchId: mid, status: 'active', players: brPlayers,
      teams: mode === 'duo' ? teams : [],
      zone: { centerX: 0, centerZ: 0, radius: 50, nextRadius: 30, phase: 0, timer: 30 },
      loot: [], startTime: Date.now(), mode,
    });

    for (const p of players) {
      deleteDoc(doc(db, LOBBY_ID, 'players', p.uid)).catch(() => {});
    }

    setMatchId(mid);
    onStartMatch(mid, mode);
  };

  const isFull = players.length >= maxPlayers;
  const needCount = maxPlayers - players.length;

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

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 p-2 border-b border-white/5">
        {(['solo', 'duo'] as BrMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-heading text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              mode === m
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 shadow-[0_0_10px_rgba(255,50,50,0.15)]'
                : 'bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300'
            }`}>
            {m === 'solo' ? <User className="w-3 h-3" /> : <Users2 className="w-3 h-3" />}
            {BR_MODE_CONFIG[m].label} ({BR_MODE_CONFIG[m].maxTeams} {m === 'solo' ? 'players' : 'teams'})
          </button>
        ))}
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center space-y-6 max-w-sm w-full">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-dashed border-red-500/30 rounded-full animate-spin" />
            <div className="absolute inset-3 border-2 border-dashed border-red-500/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
            <Swords className="absolute inset-0 m-auto w-10 h-10 text-red-400" />
          </div>

          <div>
            <h2 className="font-heading text-lg font-black text-red-400 uppercase tracking-widest">{mode === 'solo' ? '10-Player Solo' : '5-Team Duo'}</h2>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{mode === 'solo' ? 'Last one standing wins' : 'Last team standing wins'}</p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> Players
              </span>
              <span className="text-sm font-heading font-black text-red-400">{players.length}/{maxPlayers}</span>
            </div>

            {/* Team display for DUO */}
            {mode === 'duo' ? (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {Array.from({ length: Math.ceil(players.length / 2) }, (_, ti) => {
                  const members = players.slice(ti * 2, ti * 2 + 2);
                  return (
                    <div key={ti} className="flex items-center gap-2 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/[0.06]">
                      <span className="text-[8px] font-mono text-slate-600 w-6">T{ti + 1}</span>
                      {members.map(p => (
                        <span key={p.uid} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${p.uid === profile.uid ? 'bg-red-500/20 text-red-300' : 'text-slate-300'}`}>
                          {p.username}
                        </span>
                      ))}
                      {members.length < 2 && <span className="text-[8px] font-mono text-slate-600 italic">waiting...</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Solo: plain player list */
              <div className="flex flex-wrap gap-1.5 justify-center max-h-32 overflow-y-auto">
                {players.map((p) => (
                  <div key={p.uid} className={`text-[9px] font-mono px-2 py-1 rounded-lg border ${p.uid === profile.uid ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                    {p.username}
                  </div>
                ))}
              </div>
            )}

            {players.length < BR_MIN_PLAYERS ? (
              <p className="text-[9px] font-mono text-slate-600 animate-pulse">Waiting for players to join...</p>
            ) : !isFull ? (
              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all" style={{ width: `${(players.length / maxPlayers) * 100}%` }} />
                </div>
                <p className="text-[9px] font-mono text-slate-500">
                  <Clock className="w-2.5 h-2.5 inline mr-1" />
                  {needCount} more {mode === 'duo' ? 'player' : 'player'}{needCount > 1 ? 's' : ''} needed
                </p>
                {players.length >= 2 && (
                  <button onClick={startMatch} className="w-full h-9 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-lg font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
                    Force Start ({players.length} players, {buildTeams().length} teams)
                  </button>
                )}
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
