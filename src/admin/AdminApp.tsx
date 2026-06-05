import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { auth, db, doc, getDoc, collection, onSnapshot, setDoc, updateDoc, deleteDoc } from '../lib/firebase';
import { PlayerProfile, ServerSettings, AdminAction } from '../types';
import { Shield, Ban, Settings, Activity, Users, Swords, Trash2, Gavel, Bell, LogOut, Key, Home } from 'lucide-react';

type AdminTab = 'overview' | 'players' | 'settings' | 'matches';

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setAuthError(e.message || 'Login failed');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#050508] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-[#050508] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-950 border border-red-500/30 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="text-center space-y-1">
            <Shield className="w-10 h-10 text-red-400 mx-auto" />
            <h1 className="font-heading text-sm font-black tracking-widest uppercase text-red-400">Admin Console</h1>
            <p className="text-[9px] font-mono text-slate-500">Authenticate to access server controls</p>
          </div>
          <div className="space-y-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
              className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="Password"
              className="w-full h-10 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none" />
            {authError && <p className="text-[9px] font-mono text-red-400">{authError}</p>}
            <button onClick={handleLogin} disabled={!email || !password}
              className="w-full h-10 bg-red-600 hover:bg-red-500 disabled:opacity-30 rounded-lg flex items-center justify-center gap-1.5 font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">
              <Key className="w-3 h-3" /> Authenticate
            </button>
          </div>
          <div className="text-center">
            <a href="/" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 inline-flex items-center gap-1">
              <Home className="w-2.5 h-2.5" /> Back to Game
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <AuthenticatedAdmin user={user} />;
}

function AuthenticatedAdmin({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [settings, setSettings] = useState<ServerSettings>({
    maintenanceMode: false, matchmakingEnabled: true,
    tournamentCreationEnabled: true, botMatchEnabled: true,
    minLevelForRanked: 3,
  });
  const [allPlayers, setAllPlayers] = useState<PlayerProfile[]>([]);
  const [logs, setLogs] = useState<AdminAction[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'admin', 'settings')).then(snap => {
      if (snap.exists()) setSettings(snap.data() as ServerSettings);
    });
    const unsub1 = onSnapshot(collection(db, 'players'), (snap) => {
      const list: PlayerProfile[] = [];
      snap.forEach((d) => list.push(d.data() as PlayerProfile));
      setAllPlayers(list.sort((a, b) => b.rankPoints - a.rankPoints));
    });
    const unsub2 = onSnapshot(collection(db, 'admin', 'logs'), (snap) => {
      const list: AdminAction[] = [];
      snap.forEach((d) => list.push(d.data() as AdminAction));
      setLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
    });
    getDoc(doc(db, 'players', user.uid)).then(snap => {
      if (snap.exists()) setProfile(snap.data() as PlayerProfile);
    });
    return () => { unsub1(); unsub2(); };
  }, [user.uid]);

  const logAction = async (action: string, target: string, details?: string) => {
    const entry: AdminAction = {
      id: `log_${Date.now()}`, timestamp: new Date().toISOString(),
      adminUid: user.uid, action, target, details,
    };
    await setDoc(doc(db, 'admin', 'logs', entry.id), entry);
  };

  const updateSetting = async (key: keyof ServerSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await setDoc(doc(db, 'admin', 'settings'), updated);
    await logAction('update_setting', key as string, String(value));
  };

  const saveAnnouncement = async () => {
    if (!announcement.trim()) return;
    await updateSetting('announcement', announcement);
    setAnnouncement('');
  };

  const banPlayer = async (p: PlayerProfile) => {
    await deleteDoc(doc(db, 'players', p.uid));
    await logAction('ban_player', p.uid, p.username);
    setSelectedPlayer(null);
  };

  const resetPlayerRP = async (p: PlayerProfile) => {
    await updateDoc(doc(db, 'players', p.uid), { rankPoints: 0, league: 'Bronze' });
    await logAction('reset_rank', p.uid, p.username);
    setSelectedPlayer(null);
  };

  const deleteMatch = async (matchId: string) => {
    await deleteDoc(doc(db, 'matches', matchId));
    await logAction('delete_match', matchId);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const tabs: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'matches', label: 'Matches', icon: Swords },
  ];

  return (
    <div className="fixed inset-0 bg-[#050508] text-white flex flex-col">
      {/* TOP BAR */}
      <div className="bg-gradient-to-r from-red-950 to-slate-950 border-b border-red-500/20 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="font-heading text-[11px] font-black tracking-widest text-red-400 uppercase">Admin Console</span>
          {profile && <span className="text-[8px] font-mono text-slate-500">— {profile.username}</span>}
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="text-[8px] font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1">
            <Home className="w-2.5 h-2.5" /> Game
          </a>
          <button onClick={handleLogout} className="flex items-center gap-1 text-[8px] font-mono text-red-400 hover:text-red-300 cursor-pointer">
            <LogOut className="w-2.5 h-2.5" /> Logout
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-white/5 bg-white/5 shrink-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 h-9 flex items-center justify-center gap-1.5 text-[9px] font-heading font-black uppercase tracking-wider cursor-pointer transition-all ${
              activeTab === tab.id ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">

        {/* ─── OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-[9px] font-mono text-slate-500">Total Players</p>
                <p className="text-2xl font-heading font-black text-slate-200">{allPlayers.length}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-[9px] font-mono text-slate-500">Active Matches</p>
                <p className="text-2xl font-heading font-black text-slate-200">—</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-[9px] font-mono text-slate-500">Ranked Queue</p>
                <p className={`text-2xl font-heading font-black ${settings.matchmakingEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                  {settings.matchmakingEnabled ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
              <h4 className="text-[10px] font-heading font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Server Announcement
              </h4>
              {settings.announcement && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[10px] font-mono text-amber-300 flex items-center justify-between">
                  <span>{settings.announcement}</span>
                  <button onClick={() => updateSetting('announcement', '')} className="text-red-400 hover:text-red-300 cursor-pointer text-xs">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="New server-wide announcement..."
                  className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-[10px] font-mono text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none" />
                <button onClick={saveAnnouncement} disabled={!announcement.trim()}
                  className="h-9 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 rounded-lg text-[9px] font-heading font-black uppercase cursor-pointer active:scale-95">Set</button>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <h4 className="text-[10px] font-heading font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5" /> Recent Admin Actions
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {logs.slice(0, 30).map(log => (
                  <div key={log.id} className="text-[8px] font-mono text-slate-500 border-b border-white/5 py-1 flex items-center gap-2">
                    <span className="text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className="text-red-400 font-bold shrink-0">{log.action}</span>
                    <span className="truncate">{log.target}</span>
                    {log.details && <span className="text-slate-600 shrink-0">({log.details})</span>}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[9px] font-mono text-slate-600 text-center py-4">No actions logged yet.</p>}
              </div>
            </div>
          </>
        )}

        {/* ─── PLAYERS ─── */}
        {activeTab === 'players' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-heading font-black text-slate-400 uppercase tracking-wider">
                All Players ({allPlayers.length})
              </h3>
              <input type="text" placeholder="Search..." className="h-8 w-40 bg-white/5 border border-white/10 rounded-lg px-2 text-[9px] font-mono text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none" />
            </div>
            {selectedPlayer ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-heading font-black text-slate-200">{selectedPlayer.username}</h4>
                  <button onClick={() => setSelectedPlayer(null)} className="text-slate-500 text-[10px] cursor-pointer hover:text-slate-300">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-400">
                  <div className="bg-white/5 rounded-lg p-2">UID: <span className="text-slate-300">{selectedPlayer.uid}</span></div>
                  <div className="bg-white/5 rounded-lg p-2">Level: <span className="text-amber-400">{selectedPlayer.level}</span></div>
                  <div className="bg-white/5 rounded-lg p-2">RP: <span className="text-amber-400">{selectedPlayer.rankPoints}</span></div>
                  <div className="bg-white/5 rounded-lg p-2">League: <span className="text-amber-400">{selectedPlayer.league}</span></div>
                  <div className="bg-white/5 rounded-lg p-2">W/L: <span className="text-emerald-400">{selectedPlayer.wins}</span>/<span className="text-red-400">{selectedPlayer.losses}</span></div>
                  <div className="bg-white/5 rounded-lg p-2">Coins: <span className="text-yellow-400">{selectedPlayer.coins}</span> Gems: <span className="text-cyan-400">{selectedPlayer.gems}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resetPlayerRP(selectedPlayer)} className="flex-1 h-9 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-[9px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">Reset Rank</button>
                  <button onClick={() => banPlayer(selectedPlayer)} className="flex-1 h-9 bg-red-600 hover:bg-red-500 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-heading font-black uppercase cursor-pointer active:scale-95 transition-all">
                    <Ban className="w-3 h-3" /> Ban
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {allPlayers.map((p, i) => (
                  <div key={p.uid} onClick={() => setSelectedPlayer(p)}
                    className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 border border-white/5 cursor-pointer transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-[8px] font-mono text-slate-600 w-5">#{i + 1}</span>
                      <div>
                        <span className="text-[10px] font-mono font-bold text-slate-200">{p.username}</span>
                        <span className="text-[7px] font-mono text-slate-600 ml-2">Lv.{p.level}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[8px] font-mono">
                      <span className="text-amber-400">{p.rankPoints}RP</span>
                      <span className="text-emerald-400">{p.wins}W</span>
                      <span className="text-red-400">{p.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── SETTINGS ─── */}
        {activeTab === 'settings' && (
          <div className="space-y-3 max-w-md">
            {[
              { key: 'maintenanceMode' as const, label: 'Maintenance Mode', desc: 'Blocks all player access' },
              { key: 'matchmakingEnabled' as const, label: 'Matchmaking', desc: 'Allow queue & battles' },
              { key: 'tournamentCreationEnabled' as const, label: 'Tournament Creation', desc: 'Allow players to create tournaments' },
              { key: 'botMatchEnabled' as const, label: 'Bot Matches', desc: 'Allow bot fallback matches' },
            ].map(s => (
              <div key={s.key} className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
                <div>
                  <p className="text-[11px] font-heading font-black text-slate-200">{s.label}</p>
                  <p className="text-[8px] font-mono text-slate-500">{s.desc}</p>
                </div>
                <button onClick={() => updateSetting(s.key, !settings[s.key])}
                  className={`w-14 h-7 rounded-full transition-all cursor-pointer ${settings[s.key] ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                  <div className={`w-6 h-6 rounded-full bg-white transition-all shadow-md ${settings[s.key] ? 'translate-x-[1.6rem]' : 'translate-x-[2px]'}`} />
                </button>
              </div>
            ))}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
              <p className="text-[11px] font-heading font-black text-slate-200">Min Level for Ranked</p>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={50} value={settings.minLevelForRanked}
                  onChange={(e) => updateSetting('minLevelForRanked', parseInt(e.target.value) || 3)}
                  className="w-20 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs font-mono text-slate-200 text-center focus:border-red-500 focus:outline-none" />
                <span className="text-[9px] font-mono text-slate-500">Level {settings.minLevelForRanked}+</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── MATCHES ─── */}
        {activeTab === 'matches' && (
          <div className="space-y-1">
            <StandaloneMatchList onDelete={deleteMatch} />
          </div>
        )}
      </div>
    </div>
  );
}

function StandaloneMatchList({ onDelete }: { onDelete: (id: string) => void }) {
  const [matches, setMatches] = useState<{ id: string; status: string; players: string }[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'matches'), (snap) => {
      const list: { id: string; status: string; players: string }[] = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          status: data.status || 'unknown',
          players: `${data.playerA?.username || '?'} vs ${data.playerB?.username || '?'}`,
        });
      });
      setMatches(list.reverse().slice(0, 50));
    });
    return () => unsub();
  }, []);

  return (
    <>
      {matches.map(m => (
        <div key={m.id} className="flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 border border-white/5 transition-all">
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-slate-300 truncate">{m.players}</p>
            <p className="text-[7px] font-mono text-slate-600 truncate">{m.id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${
              m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              m.status === 'finished' ? 'bg-slate-500/20 text-slate-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>{m.status}</span>
            <button onClick={() => onDelete(m.id)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded cursor-pointer active:scale-90 transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      {matches.length === 0 && <p className="text-[10px] font-mono text-slate-600 text-center py-8">No match data found.</p>}
    </>
  );
}
