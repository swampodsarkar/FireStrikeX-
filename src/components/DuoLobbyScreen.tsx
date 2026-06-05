import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, updateDoc, deleteDoc } from '../lib/firebase';
import { PlayerProfile, UserHero, DuoTeam, HEROES_DATABASE } from '../types';
import { joinVoiceChannel, leaveVoiceChannel, toggleVoiceMute, isVoiceMuted, isAgoraAvailable } from '../lib/agoraVoice';
import { Users, Key, Copy, Check, ArrowLeft, Mic, MicOff, Play, Shield } from 'lucide-react';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface DuoLobbyScreenProps {
  profile: PlayerProfile;
  heroes: UserHero[];
  onBack: () => void;
  onStartDuoMatch: (teamId: string, matchId: string) => void;
}

export default function DuoLobbyScreen({ profile, heroes, onBack, onStartDuoMatch }: DuoLobbyScreenProps) {
  const [team, setTeam] = useState<DuoTeam | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [voiceAvailable] = useState(isAgoraAvailable());
  const [voiceOn, setVoiceOn] = useState(false);
  const heroOptions = heroes.filter(h => h.unlocked);

  // Listen to team changes
  useEffect(() => {
    if (!team) return;
    const ref = doc(db, 'duoTeams', team.teamId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setTeam(snap.data() as DuoTeam);
      else setTeam(null);
    });
    return () => unsub();
  }, [team?.teamId]);

  const createTeam = async () => {
    const teamId = `duo_${profile.uid}_${Date.now()}`;
    const code = generateCode();
    const t: DuoTeam = {
      teamId, hostUid: profile.uid, code,
      members: [{ uid: profile.uid, username: profile.username, heroId: heroOptions[0]?.heroId || 'fire_warrior', skin: 'default', ready: true }],
      status: 'lobby', createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'duoTeams', teamId), t);
    setTeam(t);
  };

  const joinTeam = async () => {
    if (!joinCode.trim()) return;
    const code = joinCode.trim().toUpperCase();
    const snap = await getDocs(collection(db, 'duoTeams'));
    let found: DuoTeam | null = null;
    snap.forEach((d) => {
      const t = d.data() as DuoTeam;
      if (t.code === code && t.status === 'lobby' && t.members.length < 2) found = t;
    });
    if (!found) return;
    if (found.members.find(m => m.uid === profile.uid)) return;
    const updated = [...found.members, { uid: profile.uid, username: profile.username, heroId: heroOptions[0]?.heroId || 'fire_warrior', skin: 'default', ready: true }];
    await updateDoc(doc(db, 'duoTeams', found.teamId), { members: updated });
    setTeam({ ...found, members: updated });
  };

  const leaveTeam = async () => {
    if (!team) return;
    const updated = team.members.filter(m => m.uid !== profile.uid);
    if (updated.length === 0) {
      await deleteDoc(doc(db, 'duoTeams', team.teamId));
    } else {
      await updateDoc(doc(db, 'duoTeams', team.teamId), { members: updated });
    }
    if (voiceOn) { await leaveVoiceChannel(); setVoiceOn(false); }
    setTeam(null);
  };

  const toggleVoice = async () => {
    if (!team) return;
    if (voiceOn) {
      await leaveVoiceChannel();
      setVoiceOn(false);
    } else {
      const ok = await joinVoiceChannel(`duo_${team.teamId}`, profile.uid);
      if (ok) setVoiceOn(true);
    }
  };

  const startQueue = async () => {
    if (!team || team.members.length < 2) return;
    await updateDoc(doc(db, 'duoTeams', team.teamId), { status: 'queueing' });
    // Join voice for battle
    if (!voiceOn) await toggleVoice();

    // Simple matchmaking: find another queueing duo
    const snap = await getDocs(collection(db, 'duoTeams'));
    let opponent: DuoTeam | null = null;
    snap.forEach((d) => {
      const t = d.data() as DuoTeam;
      if (t.teamId !== team.teamId && t.status === 'queueing' && t.members.length === 2) {
        opponent = t;
      }
    });

    if (opponent) {
      const matchId = `duo_match_${team.teamId}_vs_${opponent.teamId}`;
      // Mark both as in_match
      await updateDoc(doc(db, 'duoTeams', team.teamId), { status: 'in_match', matchId });
      await updateDoc(doc(db, 'duoTeams', opponent.teamId), { status: 'in_match', matchId });
      // Create match with all 4 participants
      const allMembers = [...team.members, ...opponent.members];
      const midScore = allMembers.reduce((s, m) => s + (m.uid === profile.uid ? 1000 : 500), 0);
      // Simple match doc
      await setDoc(doc(db, 'matches', matchId), {
        matchId, status: 'active', turnNumber: 0,
        isDuo: true, teamA: team.members, teamB: opponent.members,
        winnerId: '', loserId: '',
        currentTurn: team.members[0].uid,
        battleLogs: [{ id: 'start', timestamp: new Date().toISOString(), playerId: 'system', playerName: 'OVERLORD', actionText: 'DUO MATCH INITIATED! 2V2 BRAWL!' }],
      });
      onStartDuoMatch(team.teamId, matchId);
    } else {
      // No opponent yet — poll briefly
      setTimeout(async () => {
        const snap2 = await getDocs(collection(db, 'duoTeams'));
        let opp2: DuoTeam | null = null;
        snap2.forEach((d) => {
          const t = d.data() as DuoTeam;
          if (t.teamId !== team.teamId && t.status === 'queueing' && t.members.length === 2) opp2 = t;
        });
        if (opp2) {
          const matchId2 = `duo_match_${team.teamId}_vs_${opp2.teamId}`;
          await updateDoc(doc(db, 'duoTeams', team.teamId), { status: 'in_match', matchId: matchId2 });
          await updateDoc(doc(db, 'duoTeams', opp2.teamId), { status: 'in_match', matchId: matchId2 });
          await setDoc(doc(db, 'matches', matchId2), {
            matchId: matchId2, status: 'active', turnNumber: 0,
            isDuo: true, teamA: team.members, teamB: opp2.members,
            winnerId: '', loserId: '',
            currentTurn: team.members[0].uid,
            battleLogs: [{ id: 'start', timestamp: new Date().toISOString(), playerId: 'system', playerName: 'OVERLORD', actionText: 'DUO MATCH INITIATED! 2V2 BRAWL!' }],
          });
          onStartDuoMatch(team.teamId, matchId2);
        } else {
          // fallback: cancel queue
          await updateDoc(doc(db, 'duoTeams', team.teamId), { status: 'lobby' });
        }
      }, 5000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button onClick={team ? leaveTeam : onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {team ? 'Leave' : 'Back'}
        </button>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-emerald-400">Duo Lobby</span>
        </div>
        <div className="w-14" />
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        {!team ? (
          <div className="space-y-6 max-w-md mx-auto mt-8">
            {/* Create Team */}
            <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/20 space-y-3">
              <h3 className="text-[10px] font-heading font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> Create Duo Team
              </h3>
              <p className="text-[8px] font-mono text-slate-500">Form a 2-player team and queue for duo battles</p>
              <button onClick={createTeam} className="w-full h-9 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <Users className="w-3 h-3" /> Create Team
              </button>
            </div>

            {/* Join Team */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <h3 className="text-[10px] font-heading font-black text-slate-300 uppercase tracking-wider">Join by Code</h3>
              <div className="flex gap-2">
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="TEAM CODE" maxLength={6}
                  className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 uppercase tracking-widest focus:border-emerald-500 focus:outline-none" />
                <button onClick={joinTeam} disabled={joinCode.length < 3} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded-lg font-heading text-[9px] font-black uppercase cursor-pointer active:scale-95 flex items-center gap-1.5">
                  <Key className="w-3 h-3" /> Join
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            {/* Team Info */}
            <div className="bg-white/5 rounded-xl p-4 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-heading font-black text-emerald-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Duo Team
                </h3>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${team.status === 'queueing' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {team.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <Key className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-mono font-black tracking-widest text-amber-400">{team.code}</span>
                <button onClick={() => { navigator.clipboard.writeText(team.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="ml-auto text-[8px] font-heading font-black bg-white/10 px-2 py-0.5 rounded cursor-pointer active:scale-90 flex items-center gap-1">
                  {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
            </div>

            {/* Members */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider">Teammates</h4>
              {team.members.map((m) => (
                <div key={m.uid} className={`flex items-center justify-between bg-white/5 rounded-lg p-2 border ${m.uid === profile.uid ? 'border-emerald-500/30' : 'border-transparent'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${m.ready ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-mono font-bold">{m.username} {m.uid === profile.uid && '(You)'}</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500">{HEROES_DATABASE[m.heroId]?.name || m.heroId}</span>
                </div>
              ))}
              {team.members.length < 2 && (
                <div className="flex items-center justify-center h-10 border border-dashed border-white/10 rounded-lg text-[8px] font-mono text-slate-600">
                  Waiting for partner... Share the code above
                </div>
              )}
            </div>

            {/* Voice Chat */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider">Voice Chat</h4>
                {voiceAvailable ? (
                  <button onClick={toggleVoice} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-heading font-black uppercase cursor-pointer active:scale-90 transition-all ${
                    voiceOn ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-white/10'
                  }`}>
                    {voiceOn ? <Mic className="w-2.5 h-2.5" /> : <MicOff className="w-2.5 h-2.5" />}
                    {voiceOn ? 'Connected' : 'Join Voice'}
                  </button>
                ) : (
                  <span className="text-[8px] font-mono text-slate-600">Set VITE_AGORA_APP_ID in .env</span>
                )}
              </div>
            </div>

            {/* Find Match Button */}
            {team.members.length === 2 && team.hostUid === profile.uid && team.status === 'lobby' && (
              <button onClick={startQueue} className="w-full h-10 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5">
                <Play className="w-3.5 h-3.5" /> Find Duo Match
              </button>
            )}
            {team.status === 'queueing' && (
              <div className="text-center space-y-2">
                <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
                <p className="text-[10px] font-mono text-emerald-400 animate-pulse">Searching for opponent duo...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
