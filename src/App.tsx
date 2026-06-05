import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, doc, onSnapshot, getDoc, setDoc } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { PlayerProfile, BrMode } from './types';

import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import SettingsScreen from './components/SettingsScreen';
import BRLobby from './components/BRLobby';
import BRGame from './components/BRGame';
import ShopScreen from './components/ShopScreen';
import CharacterSelectScreen from './components/CharacterSelectScreen';
import FriendsScreen from './components/FriendsScreen';
import EventsScreen from './components/EventsScreen';
import DailyRewardsModal from './components/DailyRewardModal';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string>('splash');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [brMatchId, setBrMatchId] = useState<string | null>(null);
  const [brMode, setBrMode] = useState<BrMode>('solo');
  const [loading, setLoading] = useState(true);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [selectedChar, setSelectedChar] = useState('fire_warrior');

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
            // Check daily rewards
            const today = new Date().toDateString();
            if (profData.lastClaimedRewardDate !== today) {
              setShowDailyRewards(true);
            }
          } else if (guestUid) {
            localStorage.removeItem('hero_arena_guest_uid');
            setProfile(null); setCurrentScreen('auth');
          } else { setCurrentScreen('auth'); }
          setLoading(false);
        });
        return () => unsubProfile();
      } else { setCurrentScreen('auth'); setLoading(false); }
    });
    return () => unsubAuth();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('hero_arena_guest_uid');
    await signOut(auth); setProfile(null); setCurrentScreen('auth');
  };

  const updateProfile = (up: Partial<PlayerProfile>) => {
    if (!profile) return;
    const updated = { ...profile, ...up };
    setProfile(updated);
    setDoc(doc(db, 'players', profile.uid), updated).catch(() => {});
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050508] flex items-center justify-center p-0 overflow-hidden select-none">
      <div className="relative w-full h-full bg-[#0a0a0c] overflow-hidden flex flex-col">
        <div className="flex-grow flex flex-col overflow-hidden relative z-10">
          <AnimatePresence mode="wait">

            {currentScreen === 'splash' && (
              <motion.div key="splash" exit={{ opacity: 0 }} className="h-full flex-grow">
                <SplashScreen onFinish={() => setCurrentScreen('auth')} />
              </motion.div>
            )}

            {currentScreen === 'auth' && (
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-grow">
                <LoginScreen onLoginSuccess={(prof) => { setProfile(prof); setCurrentScreen('home'); }} />
              </motion.div>
            )}

            {currentScreen === 'home' && profile && (
              <HomeScreen
                profile={profile}
                selectedChar={selectedChar}
                onNavigate={(screen) => setCurrentScreen(screen)}
                onUpdateProfile={updateProfile}
              />
            )}

            {currentScreen === 'settings' && profile && (
              <motion.div key="settings" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full flex-grow">
                <SettingsScreen profile={profile} onUpdateProfile={updateProfile} onLogout={handleLogout} onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {currentScreen === 'chars' && profile && (
              <motion.div key="chars" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="h-full flex-grow">
                <CharacterSelectScreen profile={profile} selectedChar={selectedChar} onSelect={(c) => { setSelectedChar(c); setCurrentScreen('home'); }} onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {currentScreen === 'shop' && profile && (
              <motion.div key="shop" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="h-full flex-grow">
                <ShopScreen profile={profile} onUpdateProfile={updateProfile} onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {currentScreen === 'friends' && profile && (
              <motion.div key="friends" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="h-full flex-grow">
                <FriendsScreen profile={profile} onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {currentScreen === 'events' && profile && (
              <motion.div key="events" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="h-full flex-grow">
                <EventsScreen onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {currentScreen === 'br_lobby' && profile && (
              <motion.div key="br_lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRLobby profile={profile} onBack={() => setCurrentScreen('home')} onStartMatch={(mid, mode) => { setBrMatchId(mid); setBrMode(mode); setCurrentScreen('br_game'); }} />
              </motion.div>
            )}

            {currentScreen === 'br_game' && profile && brMatchId && (
              <motion.div key="br_game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRGame profile={profile} matchId={brMatchId} mode={brMode} onBack={() => { setBrMatchId(null); setCurrentScreen('home'); }} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Daily Rewards Modal (global) */}
        {showDailyRewards && profile && (
          <DailyRewardsModal
            streak={profile.dailyStreak}
            onClaim={async () => {
              const today = new Date().toDateString();
              const newStreak = profile.dailyStreak + 1;
              const reward = Math.min(newStreak, 7) * 50;
              updateProfile({ dailyStreak: newStreak, lastClaimedRewardDate: today, coins: profile.coins + reward });
              setShowDailyRewards(false);
            }}
            onClose={() => setShowDailyRewards(false)}
          />
        )}
      </div>
    </div>
  );
}
