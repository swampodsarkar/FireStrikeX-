import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, updateDoc, deleteDoc } from '../lib/firebase';
import { PlayerProfile, ServerSettings, AdminAction } from '../types';
import { Shield, Ban, Settings, Activity, Users, Swords, Trash2, ArrowLeft, Gavel, Bell } from 'lucide-react';

interface AdminPanelProps {
  profile: PlayerProfile;
  onBack: () => void;
}

export default function AdminPanel({ profile, onBack }: AdminPanelProps) {
  const [settings, setSettings] = useState<ServerSettings>({
    maintenanceMode: false,
    matchmakingEnabled: true,
    tournamentCreationEnabled: true,
    botMatchEnabled: true,
    minLevelForRanked: 3,
  });
  const [allPlayers, setAllPlayers] = useState<PlayerProfile[]>([]);
  const [logs, setLogs] = useState<AdminAction[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'settings' | 'matches'>('overview');
  const [announcement, setAnnouncement] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);

  // Load settings
  useEffect(() => {
    const ref = doc(db, 'admin', 'settings');
    getDoc(ref).then((snap) => {
      if (snap.exists()) setSettings(snap.data() as ServerSettings);
    });
    const unsub = onSnapshot(collection(db, 'players'), (snap) => {
      const list: PlayerProfile[] = [];
      snap.forEach((d) => list.push(d.data() as PlayerProfile));
      setAllPlayers(list.sort((a, b) => b.rankPoints - a.rankPoints));
    });
    return () => unsub();
  }, []);

  // Load admin logs
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admin', 'logs'), (snap) => {
      const list: AdminAction[] = [];
      snap.forEach((d) => list.push(d.data() as AdminAction));
      setLogs(list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
    });
    return () => unsub();
  }, []);

  const logAction = async (action: string, target: string, details?: string) => {
    const logEntry: AdminAction = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      adminUid: profile.uid,
      action,
      target,
      details,
    };
    await setDoc(doc(db, 'admin', 'logs', logEntry.id), logEntry);
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

  const banPlayer = async (player: PlayerProfile) => {
    await deleteDoc(doc(db, 'players', player.uid));
    await logAction('ban_player', player.uid, player.username);
    setSelectedPlayer(null);
  };

  const deleteMatch = async (matchId: string) => {
    await deleteDoc(doc(db, 'matches', matchId));
    await logAction('delete_match', matchId);
  };

  const resetPlayerRP = async (player: PlayerProfile) => {
    await updateDoc(doc(db, 'players', player.uid), { rankPoints: 0, league: 'Bronze' });
    await logAction('reset_rank', player.uid, player.username);
    setSelectedPlayer(null);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-950/80 to-slate-950 border-b border-red-500/20 shrink-0 z-20">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-red-400">Admin Panel</span>
        </div>
        <div className="w-14" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-white/5">
        {[
          { id: 'overview' as const, label: 'Overview', icon: Activity },
          { id: 'players' as const, label: 'Players', icon: Users },
          { id: 'settings' as const, label: 'Settings', icon: Settings },
          { id: 'matches' as const, label: 'Matches', icon: Swords },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 h-8 flex items-center justify-center gap-1 text-[8px] font-heading font-black uppercase tracking-wider cursor-pointer transition-all ${
              activeTab === tab.id ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <tab.icon className="w-2.5 h-2.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-grow p-3 overflow-y-auto space-y-4">

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[8px] font-mono text-slate-500">Total Players</p>
                <p className="text-lg font-heading font-black text-slate-200">{allPlayers.length}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <p className="text-[8px] font-mono text-slate-500">Ranked Enabled</p>
                <p className={`text-lg font-heading font-black ${settings.matchmakingEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                  {settings.matchmakingEnabled ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>

            {/* Announcement */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Bell className="w-3 h-3" /> Server Announcement
              </h4>
              {settings.announcement && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-[9px] font-mono text-amber-300">
                  {settings.announcement}
                  <button onClick={() => updateSetting('announcement', '')} className="ml-2 text-red-400 cursor-pointer">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} placeholder="New announcement..." className="flex-1 h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-[9px] font-mono text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none" />
                <button onClick={saveAnnouncement} disabled={!announcement.trim()} className="h-8 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-30 rounded-lg text-[8px] font-heading font-black uppercase cursor-pointer active:scale-95">Set</button>
              </div>
            </div>

            {/* Admin Logs */}
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <h4 className="text-[9px] font-heading font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Gavel className="w-3 h-3" /> Admin Logs (Recent)
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.slice(0, 20).map((log) => (
                  <div key={log.id} className="text-[7px] font-mono text-slate-500 border-b border-white/5 pb-0.5">
                    <span className="text-slate-600">{new Date(log.timestamp).toLocaleString()}</span>{' '}
                    <span className="text-red-400">{log.action}</span>{' '}
                    <span>{log.target}</span>
                    {log.details && <span className="text-slate-600"> ({log.details})</span>}
                  </div>
                ))}
                {logs.length === 0 && <p className="text-[8px] font-mono text-slate-600 text-center py-2">No actions logged yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* Players */}
        {activeTab === 'players' && (
          <div className="space-y-2">
            {selectedPlayer ? (
              <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-heading font-black text-slate-200">{selectedPlayer.username}</h4>
                  <button onClick={() => setSelectedPlayer(null)} className="text-slate-500 text-[9px] cursor-pointer">✕</button>
                </div>
                <div className="text-[8px] font-mono text-slate-400 space-y-1">
                  <p>UID: {selectedPlayer.uid}</p>
                  <p>Level: {selectedPlayer.level} | RP: {selectedPlayer.rankPoints} | League: {selectedPlayer.league}</p>
                  <p>W/L: {selectedPlayer.wins}/{selectedPlayer.losses}</p>
                  <p>Coins: {selectedPlayer.coins} | Gems: {selectedPlayer.gems}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => resetPlayerRP(selectedPlayer)} className="flex-1 h-8 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-[8px] font-heading font-black uppercase cursor-pointer active:scale-95">Reset Rank</button>
                  <button onClick={() => banPlayer(selectedPlayer)} className="flex-1 h-8 bg-red-600 hover:bg-red-500 rounded-lg text-[8px] font-heading font-black uppercase cursor-pointer active:scale-95 flex items-center justify-center gap-1">
                    <Ban className="w-2.5 h-2.5" /> Ban
                  </button>
                </div>
              </div>
            ) : (
              allPlayers.map((p) => (
                <div key={p.uid} onClick={() => setSelectedPlayer(p)}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold text-slate-200">{p.username}</span>
                    <span className="text-[7px] font-mono text-slate-600">Lv.{p.level}</span>
                  </div>
                  <span className="text-[8px] font-mono text-amber-400">{p.rankPoints}RP</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-3">
            {[
              { key: 'maintenanceMode' as keyof ServerSettings, label: 'Maintenance Mode', desc: 'Blocks all player access' },
              { key: 'matchmakingEnabled' as keyof ServerSettings, label: 'Matchmaking', desc: 'Allow queue & battles' },
              { key: 'tournamentCreationEnabled' as keyof ServerSettings, label: 'Tournament Creation', desc: 'Allow players to create tournaments' },
              { key: 'botMatchEnabled' as keyof ServerSettings, label: 'Bot Matches', desc: 'Allow bot fallback matches' },
            ].map((s) => (
              <div key={s.key} className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/5">
                <div>
                  <p className="text-[10px] font-heading font-black text-slate-200">{s.label}</p>
                  <p className="text-[7px] font-mono text-slate-500">{s.desc}</p>
                </div>
                <button onClick={() => updateSetting(s.key, !settings[s.key])}
                  className={`w-12 h-6 rounded-full transition-all cursor-pointer ${
                    settings[s.key] ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    settings[s.key] ? 'translate-x-[1.4rem]' : 'translate-x-[2px]'
                  }`} />
                </button>
              </div>
            ))}

            <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-2">
              <p className="text-[10px] font-heading font-black text-slate-200">Min Level for Ranked</p>
              <div className="flex gap-2 items-center">
                <input type="number" min={1} max={50} value={settings.minLevelForRanked}
                  onChange={(e) => updateSetting('minLevelForRanked', parseInt(e.target.value) || 3)}
                  className="w-20 h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-xs font-mono text-slate-200 text-center focus:border-red-500 focus:outline-none" />
                <span className="text-[8px] font-mono text-slate-500">Level {settings.minLevelForRanked}+</span>
              </div>
            </div>
          </div>
        )}

        {/* Matches */}
        {activeTab === 'matches' && (
          <div className="space-y-2">
            <MatchList onDelete={deleteMatch} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Match List Sub-component ─── */
function MatchList({ onDelete }: { onDelete: (matchId: string) => void }) {
  const [matches, setMatches] = useState<{ id: string; status: string; players: string }[]>([]);

  useEffect(() => {
    const ref = collection(db, 'matches');
    const unsub = onSnapshot(ref, (snap) => {
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
      {matches.map((m) => (
        <div key={m.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5">
          <div className="min-w-0">
            <p className="text-[8px] font-mono text-slate-300 truncate">{m.players}</p>
            <p className="text-[7px] font-mono text-slate-600 truncate">{m.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded-full ${
              m.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
              m.status === 'finished' ? 'bg-slate-500/20 text-slate-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>{m.status}</span>
            <button onClick={() => onDelete(m.id)} className="p-1 text-red-400 hover:bg-red-500/20 rounded cursor-pointer active:scale-90">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      ))}
      {matches.length === 0 && <p className="text-[9px] font-mono text-slate-600 text-center py-4">No match data.</p>}
    </>
  );
}
