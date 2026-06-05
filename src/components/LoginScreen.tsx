import { useState } from 'react';
import { motion } from 'motion/react';
import { Sword, LogIn, UserPlus } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, doc, setDoc } from '../lib/firebase';
import { PlayerProfile, LEAGUES } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (profile: PlayerProfile) => void;
}

const AVATAR_LIST = [
  { id: 'avatar_1', sym: '🔥', name: 'Flame Knight' },
  { id: 'avatar_2', sym: '❄️', name: 'Ice Empress' },
  { id: 'avatar_3', sym: '👤', name: 'Shadow Ghost' },
  { id: 'avatar_4', sym: '⚡', name: 'Volt Sage' },
  { id: 'avatar_5', sym: '🐉', name: 'Wyvern Core' },
  { id: 'avatar_6', sym: '🔮', name: 'Void Eye' }
];

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('avatar_1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Local storage guest logic or Firebase Anonymous emulation
  const handleGuestLogin = async () => {
    if (!username.trim() || username.length < 3 || username.length > 30) {
      setError('Username must be between 3 and 30 characters.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const guestUid = 'guest_' + Math.random().toString(36).substring(2, 9);
      const newProfile: PlayerProfile = {
        uid: guestUid,
        username: username.trim(),
        avatar: selectedAvatar,
        level: 1,
        xp: 0,
        coins: 1000, // Starter funds
        gems: 80,
        wins: 0,
        losses: 0,
        rankPoints: 100, // Starter bronze MMR
        league: 'Bronze',
        dailyStreak: 0
      };

      // Store in firestore so other players can see us in matchmaking!
      await setDoc(doc(db, 'players', guestUid), newProfile);

      // Save locally to represent authenticated guest
      localStorage.setItem('hero_arena_guest_uid', guestUid);
      onLoginSuccess(newProfile);
    } catch (err) {
      console.error(err);
      setError('Failed to create guest file. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        // Fallback or custom display name
        const displayUsername = user.displayName?.substring(0, 20) || 'Gladiator#' + Math.floor(Math.random() * 9000 + 1000);
        
        // Default starter values
        const googleProfile: PlayerProfile = {
          uid: user.uid,
          username: displayUsername,
          avatar: selectedAvatar,
          level: 1,
          xp: 0,
          coins: 1000,
          gems: 80,
          wins: 0,
          losses: 0,
          rankPoints: 100,
          league: 'Bronze',
          dailyStreak: 0
        };

        await setDoc(doc(db, 'players', user.uid), googleProfile);
        onLoginSuccess(googleProfile);
      }
    } catch (err: any) {
      console.warn('Google login popup cancelled or blocked:', err);
      setError('Google authenticate rejected. Guests login is fully functional.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col justify-center min-h-full bg-[#050508] text-white p-4 overflow-y-auto">
      {/* Background Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] rounded-full bg-violet-950/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[10%] w-[50%] h-[50%] rounded-full bg-orange-950/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-4xl mx-auto z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2">
        {/* Esports Banner */}
        <div className="md:col-span-5 text-center md:text-left space-y-3.5">
          <div className="inline-flex items-center justify-center space-x-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-amber-400 font-mono text-[9px] tracking-widest uppercase">
            <Sword className="w-3 h-3 animate-pulse" />
            <span>AUTHENTICATE HERO ENGINE</span>
          </div>
          <h2 className="font-heading text-3.5xl md:text-4.5xl font-black italic uppercase leading-none tracking-tight bg-gradient-to-r from-slate-100 via-amber-200 to-orange-400 bg-clip-text text-transparent">
            COMBAT<br className="hidden md:block" /> DUELISTS
          </h2>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Step into the 1v1 synchronized turn-based battleground. Deploy tactical fire, ice and shadow elementals with active live updates.
          </p>
        </div>

        {/* Form panel */}
        <div className="md:col-span-7 bg-white/5 border border-white/5 p-5 rounded-[24px] backdrop-blur-md space-y-4">
          {error && (
            <div className="p-2 bg-red-950/30 border border-red-900 text-red-200 text-xs rounded-xl text-center font-bold uppercase">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Avatar Grid Selection */}
            <div className="space-y-2">
              <label className="text-[9px] font-mono tracking-wider text-slate-400 uppercase font-semibold block">
                Select Emblem ({AVATAR_LIST.find(a => a.id === selectedAvatar)?.name})
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {AVATAR_LIST.map((avatar) => {
                  const isActive = selectedAvatar === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      id={`btn_avatar_${avatar.id}`}
                      onClick={() => {
                        setSelectedAvatar(avatar.id);
                        setError('');
                      }}
                      className={`flex flex-col items-center justify-center aspect-square rounded-xl bg-black/30 hover:bg-white/5 border cursor-pointer select-none text-xl transition-all duration-200 ${
                        isActive ? 'border-amber-500 bg-amber-500/15 scale-105 shadow-md shadow-amber-500/25' : 'border-white/5'
                      }`}
                    >
                      <span>{avatar.sym}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Username registration */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-mono tracking-wider text-slate-400 uppercase font-semibold block">
                Create Tactical Username
              </label>
              <input
                type="text"
                id="input_auth_username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                placeholder="e.g., ShadowSlayer66"
                className="w-full flex h-10 rounded-xl bg-black/45 border border-white/5 focus:border-amber-500 focus:outline-none px-4 text-xs font-heading font-medium tracking-wide text-slate-100 placeholder-slate-600 transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleGuestLogin}
                disabled={loading}
                id="btn_auth_guest"
                className="w-full h-11 flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-600 disabled:opacity-50 hover:opacity-95 text-slate-950 font-heading font-black tracking-widest uppercase transition-all cursor-pointer active:scale-98 text-xs"
              >
                <UserPlus className="w-3.5 h-3.5 text-slate-950" />
                <span>{loading ? 'CREATING...' : 'PLAY AS GUEST'}</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-white/5" />
                <span className="flex-shrink mx-4 text-slate-600 text-[8px] font-mono">OR</span>
                <div className="flex-grow border-t border-white/5" />
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                id="btn_auth_google"
                className="w-full h-10 flex items-center justify-center space-x-2 rounded-xl bg-black/35 hover:bg-white/5 hover:border-white/10 border border-white/5 disabled:opacity-50 text-slate-300 font-heading text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer active:scale-98"
              >
                <LogIn className="w-3.5 h-3.5 text-sky-400" />
                <span>{loading ? 'PLEASE WAIT...' : 'SIGN IN WITH GOOGLE'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
