import { motion } from 'motion/react';
import { PlayerProfile } from '../types';
import ThreeHeroView from './ThreeHeroView';
import { Coins, Gem, Swords, Users, ShoppingBag, UserPlus, Calendar, Shield, Settings as SettingsIcon, Star } from 'lucide-react';

interface HomeScreenProps {
  profile: PlayerProfile;
  selectedChar: string;
  onNavigate: (screen: string) => void;
  onUpdateProfile: (up: Partial<PlayerProfile>) => void;
}

export default function HomeScreen({ profile, selectedChar, onNavigate, onUpdateProfile }: HomeScreenProps) {
  const ranks = [
    { name: 'Bronze', min: 0, color: '#cd7f32' },
    { name: 'Silver', min: 300, color: '#c0c0c0' },
    { name: 'Gold', min: 700, color: '#ffd700' },
    { name: 'Platinum', min: 1200, color: '#e5e4e2' },
    { name: 'Diamond', min: 1800, color: '#b9f2ff' },
    { name: 'Heroic', min: 2500, color: '#ff4444' },
    { name: 'Grandmaster', min: 3500, color: '#ff00ff' },
  ];
  const currentRank = ranks.filter(r => profile.rankPoints >= r.min).pop() || ranks[0];

  const sidebarItems = [
    { icon: Calendar, label: 'Events', screen: 'events', color: '#ff6b35' },
    { icon: ShoppingBag, label: 'Shop', screen: 'shop', color: '#ffd700' },
    { icon: UserPlus, label: 'Friends', screen: 'friends', color: '#00bfff' },
    { icon: Star, label: 'Rank', screen: 'settings', color: '#ff44ff' },
  ];

  return (
    <div className="relative h-full w-full bg-[#050508] text-white overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-[#050508] to-orange-950/20 z-0" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-b from-orange-600/5 to-transparent rounded-full blur-[100px]" />

      {/* 3D Character */}
      <div className="absolute inset-0 z-0 flex items-center justify-center mt-10">
        <div className="w-64 h-64 opacity-90">
          <ThreeHeroView heroId={selectedChar} skin="default" isAnimated={true} isLobby={true} />
        </div>
      </div>

      {/* Overlay gradient for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-[#050508]/80 z-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/60 via-transparent to-[#050508]/60 z-0" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">

        {/* TOP BAR */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-[13px] font-black tracking-widest text-white leading-tight">FIRESTRIKE X</h1>
              <div className="flex items-center gap-1">
                <span className="text-[7px] font-mono text-slate-500">LV.{profile.level}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[7px] font-mono text-emerald-400/60">ONLINE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <Coins className="w-3 h-3 text-yellow-500 fill-yellow-500/30" />
              <span className="text-[9px] font-mono font-bold text-yellow-400">{profile.coins}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
              <Gem className="w-3 h-3 text-cyan-400 fill-cyan-400/30" />
              <span className="text-[9px] font-mono font-bold text-cyan-400">{profile.gems}</span>
            </div>
            <button onClick={() => onNavigate('settings')} className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer">
              <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Rank & Username */}
        <div className="flex items-center justify-between px-3 mt-1">
          <div>
            <p className="font-heading text-sm font-black text-white">{profile.username}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300" style={{ color: currentRank.color }}>
                {currentRank.name} {Math.floor(profile.rankPoints / 100) % 3 + 1}
              </span>
              <span className="text-[7px] font-mono text-slate-600">{profile.rankPoints} RP</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono text-slate-500">WINS</p>
            <p className="font-heading text-base font-black text-emerald-400">{profile.wins}</p>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* MODE SELECTION + PLAY BUTTON */}
        <div className="px-3 pb-2 space-y-2">
          {/* Mode buttons */}
          <div className="flex gap-2">
            <button onClick={() => onNavigate('br_lobby')}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(255,50,0,0.3)]">
              <Swords className="w-5 h-5 text-white" />
              <span className="font-heading text-xs font-black uppercase tracking-widest text-white">CLASSIC</span>
            </button>
            <button onClick={() => onNavigate('br_lobby')}
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-700 to-pink-600 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(150,0,255,0.3)]">
              <Star className="w-5 h-5 text-yellow-300" />
              <span className="font-heading text-xs font-black uppercase tracking-widest text-white">RANKED</span>
            </button>
          </div>

          {/* Bottom info bar */}
          <div className="flex items-center justify-between bg-white/[0.03] rounded-xl border border-white/[0.05] px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[8px] font-mono text-slate-500">
                <Users className="w-3 h-3" /> 2,847 Online
              </div>
              <div className="flex items-center gap-1 text-[8px] font-mono text-slate-500">
                <Swords className="w-3 h-3" /> {profile.wins + profile.losses || 0} Matches
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-mono text-slate-600">K/D</span>
              <span className="text-[9px] font-mono font-bold text-red-400">{(profile.wins / Math.max(1, profile.losses)).toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* SIDEBAR (fixed right) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          {sidebarItems.map((item) => (
            <button key={item.screen} onClick={() => onNavigate(item.screen)}
              className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10 hover:border-white/30 flex items-center justify-center cursor-pointer active:scale-90 transition-all group"
              style={{ borderColor: item.color + '30', '--hover-color': item.color } as any}>
              <item.icon className="w-4 h-4" style={{ color: item.color }} />
            </button>
          ))}
        </div>

        {/* Admin link */}
        <a href="/admin.html" className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/40 border border-white/5 text-slate-600 hover:text-red-400 z-20">
          <Shield className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
