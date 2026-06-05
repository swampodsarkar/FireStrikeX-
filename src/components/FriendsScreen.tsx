import { useEffect, useState } from 'react';
import { PlayerProfile } from '../types';
import { db, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc } from '../lib/firebase';
import { ArrowLeft, UserPlus, UserCheck, UserMinus, Search, MessageCircle, X, Check, Clock } from 'lucide-react';
import { auth } from '../lib/firebase';

interface FriendsScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
}

export default function FriendsScreen({ profile, onBack }: FriendsScreenProps) {
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<{ uid: string; username: string; online: boolean }[]>([]);
  const [requests, setRequests] = useState<{ uid: string; username: string; timestamp: number }[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ uid: string; username: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ uid: string; username: string }[]>([]);
  const [lobbyUids, setLobbyUids] = useState<Set<string>>(new Set());

  // Load all players on mount (for search)
  useEffect(() => {
    getDocs(collection(db, 'players')).then((snap) => {
      const users: { uid: string; username: string }[] = [];
      snap.forEach((d) => { if (d.id !== profile.uid) users.push({ uid: d.id, ...d.data() } as any); });
      setAllUsers(users);
      setSearchResults(users);
    });
  }, [profile.uid]);

  // Load friends
  useEffect(() => {
    const unsubFriends = onSnapshot(collection(db, 'players', profile.uid, 'friends'), (snap) => {
      const list: { uid: string; username: string }[] = [];
      snap.forEach((d) => list.push({ uid: d.id, ...d.data() } as any));
      // Check online status from lobby
      const unsubLobby = onSnapshot(collection(db, 'br_lobby_active', 'players'), (lsnap) => {
        const lobbyUidSet = new Set<string>();
        lsnap.forEach((d) => lobbyUidSet.add(d.id));
        setLobbyUids(lobbyUidSet);
        setFriends(list.map(f => ({ ...f, online: lobbyUidSet.has(f.uid) })));
      });
      return () => unsubLobby();
    });

    // Load incoming requests
    const unsubReqs = onSnapshot(collection(db, 'players', profile.uid, 'friendRequests'), (snap) => {
      const list: { uid: string; username: string; timestamp: number }[] = [];
      snap.forEach((d) => list.push({ uid: d.id, ...d.data() } as any));
      setRequests(list);
    });

    // Load sent requests (so we know who we already sent to)
    const unsubSent = onSnapshot(collection(db, 'players', profile.uid, 'sentRequests'), (snap) => {
      const list: string[] = [];
      snap.forEach((d) => list.push(d.id));
      setSentRequests(list);
    });

    return () => { unsubFriends(); unsubReqs(); unsubSent(); };
  }, [profile.uid]);

  // Search users (filter from loaded allUsers)
  const handleSearch = () => {
    if (!searchQuery.trim()) { setSearchResults(allUsers); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(allUsers.filter(u => u.username.toLowerCase().includes(q)));
  };

  const sendRequest = async (toUid: string, toUsername: string) => {
    await setDoc(doc(db, 'players', toUid, 'friendRequests', profile.uid), { username: profile.username, timestamp: Date.now() });
    await setDoc(doc(db, 'players', profile.uid, 'sentRequests', toUid), { username: toUsername, timestamp: Date.now() });
  };

  const acceptRequest = async (fromUid: string, fromUsername: string) => {
    await setDoc(doc(db, 'players', profile.uid, 'friends', fromUid), { username: fromUsername, addedAt: Date.now() });
    await setDoc(doc(db, 'players', fromUid, 'friends', profile.uid), { username: profile.username, addedAt: Date.now() });
    await deleteDoc(doc(db, 'players', profile.uid, 'friendRequests', fromUid));
    await deleteDoc(doc(db, 'players', fromUid, 'sentRequests', profile.uid));
  };

  const declineRequest = async (fromUid: string) => {
    await deleteDoc(doc(db, 'players', profile.uid, 'friendRequests', fromUid));
    await deleteDoc(doc(db, 'players', fromUid, 'sentRequests', profile.uid));
  };

  const removeFriend = async (friendUid: string) => {
    await deleteDoc(doc(db, 'players', profile.uid, 'friends', friendUid));
    await deleteDoc(doc(db, 'players', friendUid, 'friends', profile.uid));
  };

  const cancelRequest = async (toUid: string) => {
    await deleteDoc(doc(db, 'players', profile.uid, 'sentRequests', toUid));
    await deleteDoc(doc(db, 'players', toUid, 'friendRequests', profile.uid));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none">
      <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-heading text-sm font-black tracking-widest">Friends</span>
        <span className="text-[9px] font-mono text-slate-500 ml-auto">{friends.filter(f => f.online).length} online</span>
        {requests.length > 0 && (
          <span className="bg-red-500 text-white text-[7px] font-mono px-1.5 py-0.5 rounded-full">{requests.length}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(['friends', 'requests', 'search'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[9px] font-mono font-bold tracking-wider cursor-pointer transition-all ${tab === t ? 'text-orange-400 border-b-2 border-orange-500' : 'text-slate-500'}`}>
            {t === 'friends' ? `Friends (${friends.length})` : t === 'requests' ? `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` : 'Search'}
          </button>
        ))}
      </div>

      <div className="flex-grow overflow-y-auto p-3 space-y-1">
        {/* Friends tab */}
        {tab === 'friends' && (
          friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[10px] font-mono text-slate-600">No friends yet</p>
              <p className="text-[8px] font-mono text-slate-700 mt-1">Search for players to add friends</p>
            </div>
          ) : (
            [...friends].sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1)).map((f) => (
              <div key={f.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading font-black text-xs ${f.online ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                  {f.username[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-[10px] font-bold">{f.username}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${f.online ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    {f.online && <span className="text-[7px] font-mono text-emerald-500">Online</span>}
                  </div>
                </div>
                <button onClick={() => removeFriend(f.uid)}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer transition-all">
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          requests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[10px] font-mono text-slate-600">No pending requests</p>
            </div>
          ) : (
            requests.map((r) => (
              <div key={r.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center font-heading font-black text-xs text-blue-400">
                  {r.username[0]}
                </div>
                <div className="flex-1">
                  <span className="font-heading text-[10px] font-bold">{r.username}</span>
                  <p className="text-[7px] font-mono text-slate-600">Wants to be friends</p>
                </div>
                <button onClick={() => acceptRequest(r.uid, r.username)}
                  className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer transition-all">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => declineRequest(r.uid)}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )
        )}

        {/* Search tab */}
        {tab === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSearchResults(allUsers); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search players... ({allUsers.length} registered)"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all" />
              <button onClick={handleSearch}
                className="px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 hover:bg-blue-500/30 cursor-pointer transition-all">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[8px] font-mono text-slate-600 text-center">{searchResults.length} player{searchResults.length !== 1 ? 's' : ''} found</p>

            {searchResults.length > 0 && searchResults.map((u) => {
              const isFriend = friends.find(f => f.uid === u.uid);
              const isPending = sentRequests.includes(u.uid);
              const isOnline = lobbyUids.has(u.uid);
              return (
                <div key={u.uid} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading font-black text-xs ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                    {u.username[0]}
                  </div>
                  <div className="flex-1">
                    <span className="font-heading text-[10px] font-bold">{u.username}</span>
                    {isOnline && <span className="text-[7px] font-mono text-emerald-500 ml-1">Online</span>}
                  </div>
                  {isFriend ? (
                    <span className="text-[8px] font-mono text-slate-500"><UserCheck className="w-3.5 h-3.5 inline" /> Friend</span>
                  ) : isPending ? (
                    <button onClick={() => cancelRequest(u.uid)}
                      className="p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer transition-all">
                      <Clock className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button onClick={() => sendRequest(u.uid, u.username)}
                      className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 cursor-pointer transition-all">
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
