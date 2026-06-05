import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, updateDoc } from '../lib/firebase';
import { PlayerProfile, Tournament, TournamentParticipant, TournamentBracketEntry, TournamentMatch } from '../types';
import { Trophy, Swords, Users, Plus, ArrowLeft } from 'lucide-react';

interface TournamentScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
}

export default function TournamentScreen({ profile, onBack }: TournamentScreenProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tournaments'), (snap) => {
      const list: Tournament[] = [];
      snap.forEach((d) => list.push(d.data() as Tournament));
      setTournaments(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const ref = doc(db, 'tournaments', selected.id);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSelected(snap.data() as Tournament);
    });
    return () => unsub();
  }, [selected?.id]);

  const joinTournament = async (t: Tournament) => {
    if (t.participants.find(p => p.uid === profile.uid)) return;
    if (t.participants.length >= t.maxParticipants) return;
    const updatedParticipants = [...t.participants, { uid: profile.uid, username: profile.username, seed: t.participants.length + 1, eliminated: false }];
    await updateDoc(doc(db, 'tournaments', t.id), { participants: updatedParticipants });
  };

  const startTournament = async (t: Tournament) => {
    if (t.participants.length < 2) return;
    const bracket: TournamentBracketEntry[] = [];
    const shuffled = [...t.participants].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      bracket.push({ round: 1, matchIndex: bracket.length, playerAUid: shuffled[i].uid, playerBUid: shuffled[i + 1].uid });
    }
    await updateDoc(doc(db, 'tournaments', t.id), { status: 'in_progress', bracket, startedAt: new Date().toISOString() });
  };

  const createTournament = async () => {
    if (!name.trim()) return;
    const id = `tournament_${Date.now()}`;
    const t: Tournament = {
      id,
      name,
      description: description || `${name} Championship`,
      maxParticipants: 8,
      prizePool: { coins: 2000, gems: 200 },
      status: 'open',
      bracket: [],
      participants: [{ uid: profile.uid, username: profile.username, seed: 1, eliminated: false }],
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'tournaments', id), t);
    setCreateOpen(false);
    setName('');
    setDescription('');
  };

  const renderBracket = (t: Tournament) => (
    <div className="space-y-3">
      <h4 className="text-[10px] font-heading font-black text-slate-400 uppercase tracking-wider">Bracket</h4>
      {t.bracket.length === 0 ? (
        <p className="text-[9px] font-mono text-slate-600 text-center py-4">Bracket not yet generated. Start the tournament!</p>
      ) : (
        <div className="space-y-2">
          {t.bracket.map((m, i) => {
            const pA = t.participants.find(p => p.uid === m.playerAUid);
            const pB = t.participants.find(p => p.uid === m.playerBUid);
            return (
              <div key={i} className="bg-white/5 rounded-lg p-2 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  <span className={m.winnerUid === m.playerAUid ? 'text-emerald-400 font-bold' : m.winnerUid ? 'text-slate-600' : 'text-slate-300'}>{pA?.username || 'TBD'}</span>
                  <span className="text-slate-600">vs</span>
                  <span className={m.winnerUid === m.playerBUid ? 'text-emerald-400 font-bold' : m.winnerUid ? 'text-slate-600' : 'text-slate-300'}>{pB?.username || 'TBD'}</span>
                </div>
                {m.winnerUid && <span className="text-[8px] font-mono text-emerald-400">Winner!</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button onClick={selected ? () => setSelected(null) : onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> {selected ? 'Back' : 'Exit'}
        </button>
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-yellow-400">Tournaments</span>
        </div>
        <div className="w-14" />
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        {!selected ? (
          <div className="space-y-4 max-w-md mx-auto">
            {/* Create tournament button */}
            <button onClick={() => setCreateOpen(!createOpen)} className="w-full h-9 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl flex items-center justify-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
              <Plus className="w-3.5 h-3.5" /> {createOpen ? 'Cancel' : 'Create Tournament'}
            </button>

            {createOpen && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tournament Name" className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none" />
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none" />
                <button onClick={createTournament} disabled={!name.trim()} className="w-full h-9 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 rounded-lg text-[10px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">Create</button>
              </motion.div>
            )}

            {/* Tournament list */}
            {tournaments.map((t) => (
              <div key={t.id} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2 cursor-pointer hover:bg-white/10 transition-all" onClick={() => setSelected(t)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-heading font-black text-amber-300">{t.name}</h3>
                  <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${
                    t.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                    t.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>{t.status}</span>
                </div>
                <p className="text-[8px] font-mono text-slate-500">{t.description}</p>
                <div className="flex items-center justify-between text-[8px] font-mono">
                  <span className="text-slate-400"><Users className="w-2.5 h-2.5 inline mr-1" />{t.participants.length}/{t.maxParticipants}</span>
                  <span className="text-amber-400">Prize: {t.prizePool.coins} Coins</span>
                </div>
                {t.status === 'open' && !t.participants.find(p => p.uid === profile.uid) && (
                  <button onClick={(e) => { e.stopPropagation(); joinTournament(t); }} className="w-full h-7 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[8px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">
                    Join Tournament
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            <div className="bg-white/5 rounded-xl p-4 border border-amber-500/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-heading font-black text-amber-300">{selected.name}</h3>
                <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${
                  selected.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                  selected.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-slate-400'
                }`}>{selected.status}</span>
              </div>
              <p className="text-[8px] font-mono text-slate-500">{selected.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[8px] font-mono text-slate-400">
                <span><Users className="w-2.5 h-2.5 inline mr-1" />{selected.participants.length}/{selected.maxParticipants}</span>
                <span className="text-amber-400">🏆 {selected.prizePool.coins}C / {selected.prizePool.gems}G</span>
              </div>
            </div>

            {/* Participants */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1">
              <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider mb-2">Participants</h4>
              {selected.participants.map((p) => (
                <div key={p.uid} className="flex items-center justify-between text-[9px] font-mono bg-white/5 rounded px-2 py-1">
                  <span className={p.uid === profile.uid ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                    {p.eliminated ? '💀' : '✅'} {p.username}
                  </span>
                  <span className="text-slate-600">Seed #{p.seed}</span>
                </div>
              ))}
            </div>

            {/* Bracket */}
            {renderBracket(selected)}

            {/* Start button (host or admin) */}
            {selected.status === 'open' && selected.participants.length >= 2 && (
              <button onClick={() => startTournament(selected)} className="w-full h-9 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl text-[10px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">
                <Swords className="w-3.5 h-3.5 inline mr-1" /> Start Tournament
              </button>
            )}

            {/* Join button if not in */}
            {selected.status === 'open' && !selected.participants.find(p => p.uid === profile.uid) && (
              <button onClick={() => joinTournament(selected)} className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-[10px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">
                Join This Tournament
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
