import { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType, collection, query, orderBy, limit, onSnapshot, getDocs } from '../lib/firebase';
import { PlayerProfile, LEAGUES } from '../types';
import { Trophy, Medal, Search, Flame } from 'lucide-react';

interface LeaderboardScreenProps {
  currentProfile: PlayerProfile;
  onBack: () => void;
}

export default function LeaderboardScreen({ currentProfile, onBack }: LeaderboardScreenProps) {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playersPath = 'players';
    const q = query(
      collection(db, playersPath),
      orderBy('rankPoints', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: PlayerProfile[] = [];
      snapshot.forEach((doc) => {
        records.push(doc.data() as PlayerProfile);
      });
      setPlayers(records);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, playersPath);
    });

    return () => unsubscribe();
  }, []);

  const filtered = players.filter(p => p.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative z-10 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button
          onClick={onBack}
          id="btn_leaderboard_back"
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors"
        >
          Back
        </button>
        <div className="flex items-center space-x-1.5">
          <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-[#eab308]">Hall of Legends</span>
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-4 pb-20">
        
        {/* Search input to locate competitors */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            id="input_leaderboard_search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Arena Gladiators..."
            className="w-full h-10 select-none bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 text-xs font-heading font-semibold text-slate-200 placeholder-slate-500 focus:border-yellow-500 focus:outline-none transition-all"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 space-y-2">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full" />
            <p className="text-xs text-slate-500 font-mono">RETRIEVING COMBAT RANKINGS...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((player, idx) => {
              const isCurrentUser = player.uid === currentProfile.uid;
              const place = idx + 1;
              const hasMedal = place <= 3;
              const wr = player.wins + player.losses > 0 
                ? Math.round((player.wins / (player.wins + player.losses)) * 100) 
                : 0;

              return (
                <div
                  key={player.uid}
                  id={`leaderboard_item_${player.uid}`}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    isCurrentUser 
                      ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]' 
                      : 'border-white/5 bg-white/5 hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    {/* Position marker */}
                    <div className="w-6 flex items-center justify-center font-heading text-sm font-black text-slate-400">
                      {hasMedal ? (
                        <Medal className={`w-5 h-5 ${
                          place === 1 ? 'text-yellow-400 font-bold drop-shadow-[0_0_6px_rgba(250,204,21,0.4)]' : place === 2 ? 'text-slate-300' : 'text-amber-600'
                        }`} />
                      ) : (
                        <span>#{place}</span>
                      )}
                    </div>

                    {/* Avatar sphere */}
                    <div className="w-9 h-9 rounded-full bg-[#0A0A0C] border border-white/10 flex items-center justify-center text-lg shadow-inner shrink-0">
                      <span>
                        {player.avatar === 'avatar_1' ? '🔥' : player.avatar === 'avatar_2' ? '❄️' : player.avatar === 'avatar_3' ? '👤' : player.avatar === 'avatar_4' ? '⚡' : player.avatar === 'avatar_5' ? '🐉' : '🔮'}
                      </span>
                    </div>

                    {/* Competitor titles */}
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`font-heading text-xs font-bold leading-none ${isCurrentUser ? 'text-yellow-400' : 'text-slate-100'}`}>
                          {player.username}
                        </span>
                        <span className="text-[8px] font-mono font-bold bg-[#0A0A0C] border border-white/10 px-1 py-0.5 rounded-md text-slate-400">
                          LVL {player.level}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[9px] text-slate-400 font-mono mt-0.5">
                        <span className="text-emerald-400 font-bold">{player.wins}W</span>
                        <span>-</span>
                        <span className="text-red-400 font-bold">{player.losses}L</span>
                        <span>({wr}% WR)</span>
                      </div>
                    </div>
                  </div>

                  {/* Rank score indicator */}
                  <div className="text-right space-y-1">
                    <div className="flex items-center space-x-1 justify-end">
                      <Flame className="w-3.5 h-3.5 text-[#f97316] fill-[#f97316]/20 animate-pulse" />
                      <span className="font-mono text-xs font-black text-slate-100">{player.rankPoints}</span>
                    </div>
                    <p className="text-[10px] font-heading font-semibold text-amber-500 truncate max-w-[64px] uppercase tracking-wider">
                      {player.league || 'Bronze'}
                    </p>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <p className="text-center text-slate-500 text-xs py-10 font-mono">NO GLADIATORS MATCHING SEARCH CRITERIA.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
