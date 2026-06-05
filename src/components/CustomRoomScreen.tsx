import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, updateDoc, deleteDoc } from '../lib/firebase';
import { PlayerProfile, UserHero, CustomRoom, HEROES_DATABASE } from '../types';
import { DoorOpen, Users, Key, Copy, Check, ArrowLeft, Play } from 'lucide-react';

interface CustomRoomScreenProps {
  profile: PlayerProfile;
  heroes: UserHero[];
  onBack: () => void;
  onStartMatch: (roomId: string, matchId: string) => void;
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CustomRoomScreen({ profile, heroes, onBack, onStartMatch }: CustomRoomScreenProps) {
  const [rooms, setRooms] = useState<CustomRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<CustomRoom | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedHeroId, setSelectedHeroId] = useState(heroes[0]?.heroId || 'fire_warrior');

  // Load all open rooms
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'customRooms'), (snap) => {
      const list: CustomRoom[] = [];
      snap.forEach((d) => list.push(d.data() as CustomRoom));
      setRooms(list.filter(r => r.status === 'lobby'));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    const ref = doc(db, 'customRooms', activeRoom.roomId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setActiveRoom(snap.data() as CustomRoom);
    });
    return () => unsub();
  }, [activeRoom?.roomId]);

  const createRoom = async () => {
    const roomId = `room_custom_${profile.uid}_${Date.now()}`;
    const code = generateCode();
    const room: CustomRoom = {
      roomId,
      name: roomName || `${profile.username}'s Room`,
      code,
      hostUid: profile.uid,
      mode: 'classic',
      maxPlayers: 2,
      players: [{ uid: profile.uid, username: profile.username, heroId: selectedHeroId, ready: true }],
      status: 'lobby',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'customRooms', roomId), room);
    setActiveRoom(room);
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    const match = rooms.find(r => r.code === joinCode.trim().toUpperCase());
    if (!match) return;
    if (match.players.length >= match.maxPlayers) return;

    const updatedPlayers = [...match.players, { uid: profile.uid, username: profile.username, heroId: selectedHeroId, ready: true }];
    await updateDoc(doc(db, 'customRooms', match.roomId), { players: updatedPlayers });
    setActiveRoom({ ...match, players: updatedPlayers });
  };

  const leaveRoom = async () => {
    if (!activeRoom) return;
    const updatedPlayers = activeRoom.players.filter(p => p.uid !== profile.uid);
    if (updatedPlayers.length === 0) {
      await deleteDoc(doc(db, 'customRooms', activeRoom.roomId));
    } else {
      await updateDoc(doc(db, 'customRooms', activeRoom.roomId), { players: updatedPlayers });
    }
    setActiveRoom(null);
  };

  const startRoomMatch = async () => {
    if (!activeRoom || activeRoom.players.length < 2) return;
    const mid = `match_custom_${activeRoom.roomId}_${Date.now()}`;
    await updateDoc(doc(db, 'customRooms', activeRoom.roomId), { status: 'in_progress', matchId: mid });
    onStartMatch(activeRoom.roomId, mid);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button onClick={activeRoom ? leaveRoom : onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {activeRoom ? 'Leave' : 'Back'}
        </button>
        <div className="flex items-center gap-1.5">
          <DoorOpen className="w-4 h-4 text-violet-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-violet-400">Custom Rooms</span>
        </div>
        <div className="w-14" />
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        {!activeRoom ? (
          <div className="space-y-6 max-w-md mx-auto">
            {/* Create Room */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <h3 className="text-[10px] font-heading font-black text-slate-300 uppercase tracking-wider">Create Room</h3>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Room name..."
                className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <select value={selectedHeroId} onChange={(e) => setSelectedHeroId(e.target.value)}
                  className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-2 text-[10px] font-mono text-slate-200 focus:border-violet-500 focus:outline-none">
                  {heroes.filter(h => h.unlocked).map(h => (
                    <option key={h.heroId} value={h.heroId}>{HEROES_DATABASE[h.heroId]?.name || h.heroId}</option>
                  ))}
                </select>
                <button onClick={createRoom} className="h-9 px-4 bg-violet-600 hover:bg-violet-500 rounded-lg flex items-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
                  <Play className="w-3 h-3" /> Create
                </button>
              </div>
            </div>

            {/* Join Room */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <h3 className="text-[10px] font-heading font-black text-slate-300 uppercase tracking-wider">Join by Code</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter Room Code (e.g. ABC123)"
                  maxLength={6}
                  className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 uppercase tracking-widest focus:border-emerald-500 focus:outline-none"
                />
                <button onClick={joinRoom} disabled={joinCode.length < 3} className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded-lg flex items-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
                  <Key className="w-3 h-3" /> Join
                </button>
              </div>
            </div>

            {/* Open rooms list */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-heading font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" /> Open Rooms ({rooms.length})
              </h3>
              {rooms.filter(r => r.players.length < r.maxPlayers && r.hostUid !== profile.uid).map((room) => (
                <div key={room.roomId} className="bg-white/5 rounded-lg p-3 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-heading font-black text-slate-200">{room.name}</p>
                    <p className="text-[8px] font-mono text-slate-500">{room.players.length}/{room.maxPlayers} players • Code: {room.code}</p>
                  </div>
                  <button onClick={() => setJoinCode(room.code)} className="text-[9px] font-heading font-black bg-white/10 px-2 py-1 rounded cursor-pointer active:scale-90 uppercase">Join</button>
                </div>
              ))}
              {rooms.length === 0 && <p className="text-[9px] font-mono text-slate-600 text-center py-4">No open rooms. Create one!</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            {/* Room Lobby */}
            <div className="bg-white/5 rounded-xl p-4 border border-violet-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-heading font-black text-violet-300">{activeRoom.name}</h3>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${activeRoom.status === 'lobby' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {activeRoom.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                <Key className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-mono font-black tracking-widest text-amber-400">{activeRoom.code}</span>
                <button onClick={() => { navigator.clipboard.writeText(activeRoom.code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="ml-auto text-[9px] font-heading font-black bg-white/10 px-2 py-0.5 rounded cursor-pointer active:scale-90 flex items-center gap-1">
                  {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Players list */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider">Players ({activeRoom.players.length}/{activeRoom.maxPlayers})</h4>
              {activeRoom.players.map((p) => (
                <div key={p.uid} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.ready ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-mono">{p.username} {p.uid === activeRoom.hostUid && '(Host)'}</span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500">{HEROES_DATABASE[p.heroId]?.name || p.heroId}</span>
                </div>
              ))}
            </div>

            {/* Start match (host only) */}
            {activeRoom.hostUid === profile.uid && activeRoom.players.length >= 2 && activeRoom.status === 'lobby' && (
              <button onClick={startRoomMatch} className="w-full h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl flex items-center justify-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
                <Play className="w-3.5 h-3.5" /> Start Match
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
