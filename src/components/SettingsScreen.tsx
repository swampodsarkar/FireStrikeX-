import { motion } from 'motion/react';
import { User, LogOut, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { PlayerProfile } from '../types';
import { db, doc, updateDoc } from '../lib/firebase';
import { useState } from 'react';

interface SettingsScreenProps {
  profile: PlayerProfile;
  onUpdateProfile: (updated: Partial<PlayerProfile>) => void;
  onLogout: () => void;
  onBack: () => void;
}

export default function SettingsScreen({ profile, onUpdateProfile, onLogout, onBack }: SettingsScreenProps) {
  const [success, setSuccess] = useState('');

  const grantGold = async () => {
    try {
      const playerRef = doc(db, 'players', profile.uid);
      const addedCoins = 5000;
      const newCoins = profile.coins + addedCoins;
      await updateDoc(playerRef, { coins: newCoins });
      onUpdateProfile({ coins: newCoins });
      setSuccess(`[SYSTEM] Added 🪙 ${addedCoins} Test Coins!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const grantCrystals = async () => {
    try {
      const playerRef = doc(db, 'players', profile.uid);
      const addedGems = 500;
      const newGems = profile.gems + addedGems;
      await updateDoc(playerRef, { gems: newGems });
      onUpdateProfile({ gems: newGems });
      setSuccess(`[SYSTEM] Added 💎 ${addedGems} Test Gems!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none overflow-hidden">
      {/* Top Header bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0">
        <button
          onClick={onBack}
          id="btn_settings_back"
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 font-heading text-xs uppercase cursor-pointer"
        >
          Back
        </button>
        <span className="font-heading font-extrabold text-sm uppercase tracking-wide">System Controls</span>
        <div className="w-12" /> {/* Spacer */}
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-6 pb-20">
        {success && (
          <div className="p-3 bg-emerald-950/40 border-2 border-emerald-850 text-emerald-200 text-xs rounded-xl font-bold uppercase text-center animate-bounce">
            {success}
          </div>
        )}

        {/* Account Info Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-orange-400" />
            <h4 className="font-heading text-xs font-bold text-slate-350 uppercase tracking-wider">Active Combatant Info</h4>
          </div>
          
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-950 py-1.5">
              <span className="text-slate-500">GLADIATOR:</span>
              <span className="text-slate-100 font-bold">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-950 py-1.5">
              <span className="text-slate-500">IDENTIFIER:</span>
              <span className="text-slate-400 select-all truncate max-w-[150px]">{profile.uid}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-950 py-1.5">
              <span className="text-slate-500">ACTIVE LEAGUE:</span>
              <span className="text-orange-400 font-bold uppercase">{profile.league}</span>
            </div>
          </div>
        </div>

        {/* Sandbox Admin Cheats Menu */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-3 text-left">
          <div className="flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-yellow-400 fill-yellow-950" />
            <h4 className="font-heading text-xs font-bold text-slate-300 uppercase tracking-wider">Lobby Sandbox Debugger</h4>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal">
            Expedite evaluation and skip matching/unlock grinds! Load gold to buy out the entire legendary shop skin collection instantly.
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={grantGold}
              id="btn_cheat_gold"
              className="h-9 flex items-center justify-center space-x-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-yellow-600/30 text-yellow-400 font-heading font-extrabold text-[10px] uppercase cursor-pointer"
            >
              <span>+🪙 5K Coins</span>
            </button>
            <button
              onClick={grantCrystals}
              id="btn_cheat_gems"
              className="h-9 flex items-center justify-center space-x-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-600/30 text-cyan-400 font-heading font-extrabold text-[10px] uppercase cursor-pointer"
            >
              <span>+💎 500 Gems</span>
            </button>
          </div>
        </div>

        {/* Danger zone / logout actions */}
        <div className="p-4 rounded-xl border border-red-900/30 bg-red-950/5 space-y-3">
          <div className="flex items-center space-x-1.5 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider">Terminal Actions</h4>
          </div>

          <button
            onClick={onLogout}
            id="btn_settings_logout"
            className="w-full h-11 flex items-center justify-center space-x-2 rounded-lg bg-red-950/40 hover:bg-red-950/70 border border-red-800 text-red-200 text-xs font-heading font-bold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>DISCONNECT PROFILE</span>
          </button>
        </div>

      </div>
    </div>
  );
}
