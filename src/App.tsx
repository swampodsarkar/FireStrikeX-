import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, doc, onSnapshot, getDoc, setDoc } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { PlayerProfile, BrMode } from './types';

import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import SettingsScreen from './components/SettingsScreen';
import BRLobby from './components/BRLobby';
import BRGame from './components/BRGame';

import { Swords, Settings as SettingsIcon, Shield, Skull } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'auth' | 'home' | 'settings' | 'br_lobby' | 'br_game'>('splash');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [brMatchId, setBrMatchId] = useState<string | null>(null);
  const [brMode, setBrMode] = useState<BrMode>('solo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      const guestUid = localStorage.getItem('hero_arena_guest_uid');
      const activeUid = user?.uid || guestUid;

      if (activeUid) {
        const playerRef = doc(db, 'players', activeUid);
        const unsubProfile = onSnapshot(playerRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profData = docSnap.data() as PlayerProfile;
            setProfile(profData);
            if (currentScreen === 'splash' || currentScreen === 'auth') {
              setCurrentScreen('home');
            }
          } else if (guestUid) {
            localStorage.removeItem('hero_arena_guest_uid');
            setProfile(null);
            setCurrentScreen('auth');
          } else {
            setCurrentScreen('auth');
          }
          setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setCurrentScreen('auth');
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('hero_arena_guest_uid');
    await signOut(auth);
    setProfile(null);
    setCurrentScreen('auth');
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050508] flex items-center justify-center p-0 overflow-hidden select-none">
      <div className="relative w-full h-full bg-[#0A0A0C] overflow-hidden flex flex-col justify-between">
        <div className="absolute top-[-5%] left-[-5%] w-[420px] h-[420px] bg-amber-950/15 rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="absolute bottom-[5%] right-[-5%] w-[450px] h-[450px] bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none z-0" />

        <div className="flex-grow flex flex-col overflow-hidden relative z-10">
          <AnimatePresence mode="wait">

            {/* Splash */}
            {currentScreen === 'splash' && (
              <motion.div key="splash" exit={{ opacity: 0 }} className="h-full flex-grow">
                <SplashScreen onFinish={() => setCurrentScreen('auth')} />
              </motion.div>
            )}

            {/* Auth */}
            {currentScreen === 'auth' && (
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-grow">
                <LoginScreen onLoginSuccess={(prof) => { setProfile(prof); setCurrentScreen('home'); }} />
              </motion.div>
            )}

            {/* Home */}
            {currentScreen === 'home' && profile && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow flex flex-col bg-[#050508] text-white overflow-hidden relative select-none">

                {/* Background */}
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-red-950/10 via-[#050508] to-orange-950/10" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-600/5 rounded-full blur-[80px]" />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between p-4">

                  {/* Top bar */}
                  <div className="flex justify-between items-center bg-white/[0.03] backdrop-blur-sm px-3 py-2 rounded-xl border border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center">
                        <Skull className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h1 className="font-heading text-[11px] font-black tracking-widest text-white">FIRESTRIKE X</h1>
                        <p className="text-[7px] font-mono text-red-400/60">BATTLE ROYALE</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-slate-500">LV.{profile.level}</span>
                      <button onClick={() => setCurrentScreen('settings')} className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-all">
                        <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Center - Play button */}
                  <div className="flex-grow flex flex-col items-center justify-center -mt-12">
                    <div className="relative">
                      <div className="absolute inset-0 border-4 border-dashed border-red-500/20 rounded-full animate-spin" style={{ width: 140, height: 140, left: -10, top: -10 }} />
                      <div className="absolute inset-0 border-2 border-dashed border-red-500/10 rounded-full animate-spin" style={{ width: 120, height: 120, left: 0, top: 0, animationDirection: 'reverse', animationDuration: '3s' }} />
                      <button onClick={() => setCurrentScreen('br_lobby')}
                        className="w-28 h-28 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center shadow-[0_0_40px_rgba(255,50,0,0.3)] cursor-pointer active:scale-95 transition-all group">
                        <Swords className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 mt-6 tracking-widest uppercase">Press to Battle</p>
                  </div>

                  {/* Bottom info */}
                  <div className="flex justify-center gap-6 bg-white/[0.02] backdrop-blur-sm rounded-xl border border-white/[0.04] p-3">
                    <div className="text-center">
                      <p className="text-[9px] font-mono text-slate-500">WINS</p>
                      <p className="text-sm font-heading font-black text-emerald-400">{profile.wins || 0}</p>
                    </div>
                    <div className="w-px bg-white/5" />
                    <div className="text-center">
                      <p className="text-[9px] font-mono text-slate-500">K/D</p>
                      <p className="text-sm font-heading font-black text-red-400">{(profile.wins && profile.losses ? (profile.wins / Math.max(1, profile.losses)).toFixed(1) : '0.0')}</p>
                    </div>
                    <div className="w-px bg-white/5" />
                    <div className="text-center">
                      <p className="text-[9px] font-mono text-slate-500">LEVEL</p>
                      <p className="text-sm font-heading font-black text-amber-400">{profile.level}</p>
                    </div>
                  </div>

                  {/* Admin link */}
                  <a href="/admin.html" className="absolute bottom-2 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-red-500/30 transition-all text-[#ff4444]/40 hover:text-red-400/80">
                    <Shield className="w-3 h-3" />
                  </a>
                </div>
              </motion.div>
            )}

            {/* Settings */}
            {currentScreen === 'settings' && profile && (
              <motion.div key="settings" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full flex-grow">
                <SettingsScreen profile={profile} onUpdateProfile={(up) => setProfile(prev => prev ? { ...prev, ...up } : null)} onLogout={handleLogout} onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {/* BR Lobby */}
            {currentScreen === 'br_lobby' && profile && (
              <motion.div key="br_lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRLobby profile={profile} onBack={() => setCurrentScreen('home')} onStartMatch={(mid, mode) => { setBrMatchId(mid); setBrMode(mode); setCurrentScreen('br_game'); }} />
              </motion.div>
            )}

            {/* BR Game */}
            {currentScreen === 'br_game' && profile && brMatchId && (
              <motion.div key="br_game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRGame profile={profile} matchId={brMatchId} mode={brMode} onBack={() => { setBrMatchId(null); setCurrentScreen('home'); }} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
