import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from '../lib/firebase';
import { PlayerProfile, BR_MAX_PLAYERS, BR_MIN_PLAYERS, BrMode, BR_MODE_CONFIG, BrTeam } from '../types';
import { Swords, Users, Clock, ArrowLeft, User, Users2, Bot, MessageCircle, UserPlus, UserCheck, X, Send, Bell } from 'lucide-react';

interface BRLobbyProps {
  profile: PlayerProfile;
  onBack: () => void;
  onStartMatch: (matchId: string, mode: BrMode) => void;
}

const LOBBY_ID = 'br_lobby_active';
const BOT_NAMES = ['Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta', 'Bot_Echo', 'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel', 'Bot_India', 'Bot_Juliet'];
const AUTO_START_DELAY = 30;
const FRIEND_COLORS = [0xff4444, 0x44aaff, 0xffaa44, 0xff44ff, 0xffff44, 0x44ffff, 0xff8844, 0x88ff44];

export default function BRLobby({ profile, onBack, onStartMatch }: BRLobbyProps) {
  const [players, setPlayers] = useState<{ uid: string; username: string }[]>([]);
  const [mode, setMode] = useState<BrMode>('solo');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(AUTO_START_DELAY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // Friend invite state
  const [showFriendList, setShowFriendList] = useState(false);
  const [invites, setInvites] = useState<{ fromUid: string; fromUsername: string }[]>([]);
  const [sentInvites, setSentInvites] = useState<string[]>([]);
  const [teams, setTeams] = useState<Record<string, { partnerUid: string; partnerUsername: string }>>({});
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const cfg = BR_MODE_CONFIG[mode];
  const maxPlayers = cfg.maxPlayers;
  const teamSize = cfg.teamSize;
  const myTeam = teams[profile.uid];

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToastMsg = (message: string, type: 'success' | 'info' | 'error') => {
    setShowToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowToast(null), 3000);
  };

  const [allFriends, setAllFriends] = useState<{ uid: string; username: string; inLobby: boolean }[]>([]);

  // Load ALL friends from Firebase (not just lobby)
  useEffect(() => {
    const unsubFriends = onSnapshot(collection(db, 'players', profile.uid, 'friends'), (snap) => {
      const friendsList: { uid: string; username: string }[] = [];
      snap.forEach((d) => friendsList.push({ uid: d.id, ...d.data() } as any));
      // Check who's in lobby
      const unsubLobby = onSnapshot(collection(db, LOBBY_ID, 'players'), (lsnap) => {
        const lobbyUids = new Set<string>();
        lsnap.forEach((d) => lobbyUids.add(d.id));
        setAllFriends(friendsList.map(f => ({ ...f, inLobby: lobbyUids.has(f.uid) })));
      });
      return () => unsubLobby();
    });
    return () => unsubFriends();
  }, [profile.uid]);

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

    const unsubPlayers = onSnapshot(collection(db, LOBBY_ID, 'players'), (snap) => {
      const list: { uid: string; username: string }[] = [];
      snap.forEach((d) => list.push(d.data() as any));
      setPlayers(list);
    });

    // Listen for invites sent to me
    const unsubInvites = onSnapshot(doc(db, LOBBY_ID, 'invites', profile.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.fromUid && data.fromUid !== profile.uid) {
          setInvites(prev => {
            if (prev.find(i => i.fromUid === data.fromUid)) return prev;
            return [...prev, { fromUid: data.fromUid, fromUsername: data.fromUsername }];
          });
        }
      }
    });

    // Listen for team assignments
    const unsubTeams = onSnapshot(doc(db, LOBBY_ID, 'teams', profile.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { partnerUid: string; partnerUsername: string };
        setTeams(prev => ({ ...prev, [profile.uid]: data }));
      } else {
        setTeams(prev => {
          const copy = { ...prev };
          delete copy[profile.uid];
          return copy;
        });
      }
    });

    return () => {
      unsubPlayers();
      unsubInvites();
      unsubTeams();
      deleteDoc(doc(db, LOBBY_ID, 'players', profile.uid)).catch(() => {});
      deleteDoc(doc(db, LOBBY_ID, 'invites', profile.uid)).catch(() => {});
    };
  }, [profile.uid]);

  // Auto-start timer
  useEffect(() => {
    if (startedRef.current) return;
    if (players.length >= BR_MIN_PLAYERS && players.length < maxPlayers) {
      setTimeLeft(AUTO_START_DELAY);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              startMatch();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } else if (players.length >= maxPlayers) {
      startMatch();
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(AUTO_START_DELAY);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [players.length, maxPlayers]);

  // Build teams for duo: use friend pairs first, then sequential
  const buildTeams = (): BrTeam[] => {
    if (mode === 'solo') return players.map((p, i) => ({ id: i, members: [p.uid], alive: true }));

    const paired = new Set<string>();
    const result: BrTeam[] = [];

    // First pass: find friend pairs
    for (const p of players) {
      if (paired.has(p.uid)) continue;
      const teamInfo = teams[p.uid];
      if (teamInfo && players.find(pp => pp.uid === teamInfo.partnerUid)) {
        result.push({ id: result.length, members: [p.uid, teamInfo.partnerUid], alive: true });
        paired.add(p.uid);
        paired.add(teamInfo.partnerUid);
      }
    }

    // Second pass: sequential pairing for unpaired
    const unpaired = players.filter(p => !paired.has(p.uid));
    for (let i = 0; i < unpaired.length; i += teamSize) {
      result.push({ id: result.length, members: unpaired.slice(i, i + teamSize).map(p => p.uid), alive: true });
    }
    return result;
  };

  const getPlayerTeamId = (uid: string): number => {
    for (const t of buildTeams()) { if (t.members.includes(uid)) return t.id; }
    return -1;
  };

  const startMatch = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const mid = `br_${Date.now()}`;

    const allPlayers = [...players];
    const needBots = maxPlayers - allPlayers.length;
    for (let i = 0; i < needBots; i++) {
      allPlayers.push({ uid: `bot_${Date.now()}_${i}`, username: BOT_NAMES[i % BOT_NAMES.length] });
    }

    const teamsList = buildTeams();
    if (mode === 'solo') {
      // Rebuild for solo with all players including bots
      const soloTeams = allPlayers.map((_, i) => ({ id: i, members: [allPlayers[i].uid], alive: true }));
      const brPlayers = allPlayers.map((p, i) => ({
        uid: p.uid, username: p.username,
        x: Math.cos((i / allPlayers.length) * Math.PI * 2) * 15,
        y: 0, z: Math.sin((i / allPlayers.length) * Math.PI * 2) * 15,
        rx: 0, ry: 0, hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol',
        teamId: -1,
        isBot: p.uid.startsWith('bot_'),
      }));
      setDoc(doc(db, 'br_matches', mid), {
        matchId: mid, status: 'active', players: brPlayers,
        teams: [], zone: { centerX: 0, centerZ: 0, radius: 50, nextRadius: 30, phase: 0, timer: 30 },
        loot: [], startTime: Date.now(), mode,
      }).then(() => cleanup());
    } else {
      // Duo: rebuild teamsList with allPlayers (including bots)
      const pairedAll = new Set<string>();
      const duoTeams: BrTeam[] = [];
      for (const p of allPlayers) {
        if (pairedAll.has(p.uid)) continue;
        const teamInfo = teams[p.uid];
        if (teamInfo && allPlayers.find(pp => pp.uid === teamInfo.partnerUid)) {
          duoTeams.push({ id: duoTeams.length, members: [p.uid, teamInfo.partnerUid], alive: true });
          pairedAll.add(p.uid); pairedAll.add(teamInfo.partnerUid);
        }
      }
      const unpairedAll = allPlayers.filter(p => !pairedAll.has(p.uid));
      for (let i = 0; i < unpairedAll.length; i += 2) {
        duoTeams.push({ id: duoTeams.length, members: unpairedAll.slice(i, i + 2).map(p => p.uid), alive: true });
      }

      const brPlayers = allPlayers.map((p) => ({
        uid: p.uid, username: p.username,
        x: 0, y: 0, z: 0,
        rx: 0, ry: 0, hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol',
        teamId: (() => { for (const t of duoTeams) { if (t.members.includes(p.uid)) return t.id; } return -1; })(),
        isBot: p.uid.startsWith('bot_'),
      }));
      setDoc(doc(db, 'br_matches', mid), {
        matchId: mid, status: 'active', players: brPlayers,
        teams: duoTeams, zone: { centerX: 0, centerZ: 0, radius: 50, nextRadius: 30, phase: 0, timer: 30 },
        loot: [], startTime: Date.now(), mode,
      }).then(() => cleanup());
    }

    function cleanup() {
      for (const p of players) {
        deleteDoc(doc(db, LOBBY_ID, 'players', p.uid)).catch(() => {});
        deleteDoc(doc(db, LOBBY_ID, 'teams', p.uid)).catch(() => {});
      }
      for (const p of players) {
        deleteDoc(doc(db, LOBBY_ID, 'invites', p.uid)).catch(() => {});
      }
      setMatchId(mid);
      onStartMatch(mid, mode);
    }
  };

  // Send friend invite
  const sendInvite = async (friend: { uid: string; username: string }) => {
    await setDoc(doc(db, LOBBY_ID, 'invites', friend.uid), { fromUid: profile.uid, fromUsername: profile.username });
    setSentInvites(prev => [...prev, friend.uid]);
    setInviteSentTo(friend.uid);
    showToastMsg(`Invite sent to ${friend.username}!`, 'success');
    setTimeout(() => setShowFriendList(false), 500);
  };

  // Accept invite
  const acceptInvite = async (invite: { fromUid: string; fromUsername: string }) => {
    // Write team assignments for both
    await setDoc(doc(db, LOBBY_ID, 'teams', profile.uid), { partnerUid: invite.fromUid, partnerUsername: invite.fromUsername });
    await setDoc(doc(db, LOBBY_ID, 'teams', invite.fromUid), { partnerUid: profile.uid, partnerUsername: profile.username });
    // Clear the invite
    await deleteDoc(doc(db, LOBBY_ID, 'invites', profile.uid));
    setInvites(prev => prev.filter(i => i.fromUid !== invite.fromUid));
    showToastMsg(`Teamed up with ${invite.fromUsername}!`, 'success');
  };

  // Decline invite
  const declineInvite = async (invite: { fromUid: string }) => {
    await deleteDoc(doc(db, LOBBY_ID, 'invites', profile.uid));
    setInvites(prev => prev.filter(i => i.fromUid !== invite.fromUid));
  };

  // Unlink from partner
  const unlinkTeam = async () => {
    if (!myTeam) return;
    await deleteDoc(doc(db, LOBBY_ID, 'teams', profile.uid));
    await deleteDoc(doc(db, LOBBY_ID, 'teams', myTeam.partnerUid));
    setTeams(prev => { const copy = { ...prev }; delete copy[profile.uid]; return copy; });
    showToastMsg('Left team', 'info');
  };

  const isFull = players.length >= maxPlayers;
  const needCount = maxPlayers - players.length;

  // Get player team for display
  const getTeamDisplay = () => {
    if (mode === 'solo') return null;
    const allTeams = buildTeams();
    return allTeams;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      {/* Toast notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg border text-[10px] font-mono backdrop-blur-md ${
              showToast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' :
              showToast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
              'bg-blue-500/20 border-blue-500/40 text-blue-300'
            }`}>
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="flex-grow flex flex-col items-center justify-center p-4 overflow-y-auto">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center space-y-4 max-w-sm w-full">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-dashed border-red-500/30 rounded-full animate-spin" />
            <div className="absolute inset-3 border-2 border-dashed border-red-500/20 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '3s' }} />
            <Swords className="absolute inset-0 m-auto w-8 h-8 text-red-400" />
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

            {/* Team-based display for DUO */}
            {mode === 'duo' ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {getTeamDisplay()?.map((team) => {
                  const members = team.members.map(uid => players.find(p => p.uid === uid)).filter(Boolean) as { uid: string; username: string }[];
                  return (
                    <div key={team.id} className="flex items-center gap-2 bg-white/[0.03] px-2 py-1.5 rounded-lg border border-white/[0.06]">
                      <span className="text-[8px] font-mono text-slate-600 w-5">T{team.id + 1}</span>
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

            {/* Invite notification */}
            {mode === 'duo' && invites.length > 0 && invites.map((inv) => (
              <div key={inv.fromUid} className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 flex items-center gap-2">
                <Bell className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-[9px] font-mono text-blue-300 flex-1 text-left">{inv.fromUsername} invited you!</span>
                <button onClick={() => acceptInvite(inv)} className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[8px] font-mono text-emerald-300 cursor-pointer hover:bg-emerald-500/30 transition-all">Accept</button>
                <button onClick={() => declineInvite(inv)} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-mono text-red-400 cursor-pointer hover:bg-red-500/20 transition-all">X</button>
              </div>
            ))}

            {/* My team status */}
            {mode === 'duo' && myTeam && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center gap-2">
                <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="text-[9px] font-mono text-emerald-300 flex-1 text-left">Teamed with {myTeam.partnerUsername}</span>
                <button onClick={unlinkTeam} className="text-[8px] font-mono text-red-400 cursor-pointer hover:text-red-300">Leave</button>
              </div>
            )}

            {players.length < BR_MIN_PLAYERS ? (
              <p className="text-[9px] font-mono text-slate-600 animate-pulse">Waiting for players to join...</p>
            ) : (
              <div className="space-y-2">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all" style={{ width: `${(players.length / maxPlayers) * 100}%` }} />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Clock className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] font-mono text-slate-400">
                    Auto-start in <span className="text-yellow-300 font-bold">{timeLeft}s</span>
                  </span>
                  <Bot className="w-3 h-3 text-slate-500" />
                  <span className="text-[8px] font-mono text-slate-600">+{needCount} bots</span>
                </div>
              </div>
            )}
          </div>

          {/* Duo mode: Invite Friend button */}
          {mode === 'duo' && !myTeam && (
            <button onClick={() => setShowFriendList(true)}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg font-heading text-[10px] font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2">
              <UserPlus className="w-3.5 h-3.5" />
              Invite Friend
            </button>
          )}

          {/* Duo mode info when already teamed */}
          {mode === 'duo' && myTeam && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-[9px] font-mono text-blue-300 flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" />
                You and {myTeam.partnerUsername} will drop together. Stay close!
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Friend List Overlay */}
      <AnimatePresence>
        {showFriendList && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#0a0a14] border border-white/10 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-xs font-black text-slate-300 uppercase tracking-widest">Invite Friend</h3>
                <button onClick={() => setShowFriendList(false)} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer transition-all">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {allFriends.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[9px] font-mono text-slate-600">No friends added yet</p>
                  <p className="text-[7px] font-mono text-slate-700 mt-1">Go to Home → Friends to add friends</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {allFriends.sort((a, b) => (a.inLobby === b.inLobby ? 0 : a.inLobby ? -1 : 1)).map((f, i) => {
                    const alreadySent = sentInvites.includes(f.uid);
                    const isPartner = myTeam?.partnerUid === f.uid;
                    return (
                      <div key={f.uid} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${f.inLobby ? 'bg-emerald-500/5' : 'hover:bg-white/5'}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-heading font-black text-[10px]"
                          style={{ backgroundColor: `${FRIEND_COLORS[i % FRIEND_COLORS.length].toString(16)}33`, color: `#${FRIEND_COLORS[i % FRIEND_COLORS.length].toString(16).padStart(6, '0')}` }}>
                          {f.username[0]}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading text-[10px] font-bold">{f.username}</span>
                            {f.inLobby ? (
                              <span className="text-[7px] font-mono text-emerald-500">in lobby</span>
                            ) : (
                              <span className="text-[7px] font-mono text-slate-600">offline</span>
                            )}
                          </div>
                        </div>
                        {isPartner ? (
                          <span className="text-[8px] font-mono text-emerald-400">Teammate</span>
                        ) : alreadySent ? (
                          <span className="text-[8px] font-mono text-slate-500">Invited</span>
                        ) : f.inLobby ? (
                          <button onClick={() => sendInvite(f)}
                            className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 cursor-pointer transition-all">
                            <Send className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[8px] font-mono text-slate-600">offline</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
