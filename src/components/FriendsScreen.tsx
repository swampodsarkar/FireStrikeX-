import { useState } from 'react';
import { PlayerProfile } from '../types';
import { ArrowLeft, UserPlus, UserCheck, Search, MessageCircle } from 'lucide-react';

interface FriendsScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
}

// Simulated friends list
const SUGGESTED = [
  { uid: 'f1', username: 'ShadowStrike', level: 12, online: true },
  { uid: 'f2', username: 'PhoenixFire', level: 8, online: false },
  { uid: 'f3', username: 'IceBreaker', level: 15, online: true },
  { uid: 'f4', username: 'ThunderBolt', level: 6, online: false },
  { uid: 'f5', username: 'NightHawk', level: 10, online: true },
];

export default function FriendsScreen({ profile, onBack }: FriendsScreenProps) {
  const [tab, setTab] = useState<'friends' | 'suggested'>('friends');
  const [friends, setFriends] = useState<{ uid: string; username: string; level: number; online: boolean; added?: boolean }[]>(
    SUGGESTED.slice(0, 2).map(f => ({ ...f, added: true }))
  );
  const [sent, setSent] = useState<string[]>([]);

  const addFriend = (uid: string) => {
    setSent([...sent, uid]);
  };

  const displayList = tab === 'friends' ? friends : SUGGESTED.filter(f => !friends.find(fr => fr.uid === f.uid));

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none">
      <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-heading text-sm font-black tracking-widest">Friends</span>
        <span className="text-[9px] font-mono text-slate-500 ml-auto">{friends.filter(f => f.online).length} online</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button onClick={() => setTab('friends')} className={`flex-1 py-2 text-[9px] font-mono font-bold tracking-wider cursor-pointer transition-all ${tab === 'friends' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-slate-500'}`}>Friends ({friends.length})</button>
        <button onClick={() => setTab('suggested')} className={`flex-1 py-2 text-[9px] font-mono font-bold tracking-wider cursor-pointer transition-all ${tab === 'suggested' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-slate-500'}`}>Suggested</button>
      </div>

      <div className="flex-grow overflow-y-auto p-3 space-y-1">
        {displayList.map((f) => (
          <div key={f.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading font-black text-xs ${f.online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
              {f.username[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-heading text-[10px] font-bold">{f.username}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${f.online ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              </div>
              <p className="text-[7px] font-mono text-slate-600">LV.{f.level}</p>
            </div>
            {tab === 'friends' ? (
              <button className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-all"><MessageCircle className="w-3.5 h-3.5 text-slate-400" /></button>
            ) : (
              <button onClick={() => addFriend(f.uid)}
                className={`p-1.5 rounded-lg border cursor-pointer transition-all ${sent.includes(f.uid) ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                {sent.includes(f.uid) ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
