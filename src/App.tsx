import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, db, handleFirestoreError, OperationType,
  doc, onSnapshot, getDoc, setDoc, updateDoc, 
  collection, query, queryEqual, getDocs, deleteDoc 
} from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  PlayerProfile, UserHero, QueueEntry, MatchState, 
  BattleParticipant, HEROES_DATABASE, getLeagueForPoints,
  DAILY_MISSIONS, ACHIEVEMENTS, DailyMission, Achievement, BattlePassState, BATTLE_PASS_LEVELS,
  BattlePassLevel, CustomRoom
} from './types';

// Import all screens
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import HeroCollectionScreen from './components/HeroCollectionScreen';
import ShopScreen from './components/ShopScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import SettingsScreen from './components/SettingsScreen';
import BattleScreen from './components/BattleScreen';
import HeroSelectScreen from './components/HeroSelectScreen';
import DailyMissions from './components/DailyMissions';
import AchievementsModal from './components/AchievementsModal';
import BattlePass from './components/BattlePass';
import ThreeHeroView from './components/ThreeHeroView';
import SpectatorScreen from './components/SpectatorScreen';
import CustomRoomScreen from './components/CustomRoomScreen';
import TournamentScreen from './components/TournamentScreen';
import DuoLobbyScreen from './components/DuoLobbyScreen';
import BRLobby from './components/BRLobby';
import BRGame from './components/BRGame';

import { 
  Coins, Gem, Trophy, Swords, Shield, Users, 
  Sparkles, MessageSquare, Flame, Play, Settings as SettingsIcon, HelpCircle, Crown, Eye, DoorOpen, Headphones
} from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'auth' | 'home' | 'heroes' | 'shop' | 'leaderboard' | 'settings' | 'queue' | 'hero_select' | 'battle' | 'spectate' | 'custom_rooms' | 'tournaments' | 'duo_lobby' | 'br_lobby' | 'br_game'>('splash');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [heroes, setHeroes] = useState<UserHero[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [brMatchId, setBrMatchId] = useState<string | null>(null);
  const [missions, setMissions] = useState<DailyMission[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [battlePassState, setBattlePassState] = useState<BattlePassState>({ level: 0, xp: 0, hasPremium: false, claimedFree: [], claimedPremium: [] });
  const [battlePassOpen, setBattlePassOpen] = useState(false);
  const [queueTimer, setQueueTimer] = useState(0);
  const [selectedHeroId, setSelectedHeroId] = useState('fire_warrior');
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState<'classic' | 'ranked'>('classic');
  const [currentQueueMode, setCurrentQueueMode] = useState<'classic' | 'ranked'>('classic');
  const [queueMessage, setQueueMessage] = useState('');

  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMatchmakerSearching = useRef<boolean>(false);
  const queueUnsubRef = useRef<(() => void) | null>(null);

  // 1. Core Auth state listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      
      // Try local guest UID first
      const guestUid = localStorage.getItem('hero_arena_guest_uid');
      const activeUid = user?.uid || guestUid;

      if (activeUid) {
        const playerRef = doc(db, 'players', activeUid);
        
        // Listen to any changes on player record
        const unsubProfile = onSnapshot(playerRef, async (docSnap) => {
            if (docSnap.exists()) {
            const profData = docSnap.data() as PlayerProfile;
            setProfile(profData);
            
            // Sync hero collection subcollection
            const heroesColRef = collection(db, 'players', activeUid, 'heroes');
            const snap = await getDocs(heroesColRef);
            let userHeroesList: UserHero[] = [];
            snap.forEach((hDoc) => {
              userHeroesList.push(hDoc.data() as UserHero);
            });

            // If empty, prime with starter heroes
            if (userHeroesList.length === 0) {
              const starters = ['fire_warrior', 'ice_mage', 'shadow_assassin', 'paladin', 'storm_archer'];
              for (const sId of starters) {
                const hRef = doc(db, 'players', activeUid, 'heroes', sId);
                const initHero: UserHero = {
                  heroId: sId,
                  level: 1,
                  unlocked: true,
                  selectedSkin: 'default',
                  unlockedSkins: ['default']
                };
                await setDoc(hRef, initHero);
                userHeroesList.push(initHero);
              }
            }
            setHeroes(userHeroesList);

            // Load Daily Missions from Firebase
            const missionsRef = collection(db, 'players', activeUid, 'missions');
            const missionsSnap = await getDocs(missionsRef);
            const loadedMissions: DailyMission[] = [];
            missionsSnap.forEach((mDoc) => {
              loadedMissions.push(mDoc.data() as DailyMission);
            });
            if (loadedMissions.length === 0) {
              const defaults = DAILY_MISSIONS.map(m => ({ ...m, progress: 0, claimed: false }));
              for (const dm of defaults) {
                await setDoc(doc(db, 'players', activeUid, 'missions', dm.id), dm);
              }
              setMissions(defaults);
            } else {
              setMissions(loadedMissions);
            }

            // Load Achievements from Firebase
            const achRef = collection(db, 'players', activeUid, 'achievements');
            const achSnap = await getDocs(achRef);
            const loadedAch: Achievement[] = [];
            achSnap.forEach((aDoc) => {
              loadedAch.push(aDoc.data() as Achievement);
            });
            if (loadedAch.length === 0) {
              const defaults = ACHIEVEMENTS.map(a => ({ ...a, unlocked: false, claimed: false }));
              for (const a of defaults) {
                await setDoc(doc(db, 'players', activeUid, 'achievements', a.id), a);
              }
              setAchievements(defaults);
            } else {
              setAchievements(loadedAch);
            }

            // Load Battle Pass state from Firebase
            const bpRef = doc(db, 'players', activeUid, 'battlepass', 'state');
            const bpSnap = await getDoc(bpRef);
            if (bpSnap.exists()) {
              setBattlePassState(bpSnap.data() as BattlePassState);
            } else {
              const defaultBP: BattlePassState = { level: 0, xp: 0, hasPremium: false, claimedFree: [], claimedPremium: [] };
              await setDoc(bpRef, defaultBP);
              setBattlePassState(defaultBP);
            }

            // Push to home if first setup
            if (currentScreen === 'splash' || currentScreen === 'auth') {
              setCurrentScreen('home');
            }
          } else if (guestUid) {
            // Stale guest ID, reset
            localStorage.removeItem('hero_arena_guest_uid');
          }
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setHeroes([]);
        setLoading(false);
        if (currentScreen !== 'splash') {
          setCurrentScreen('auth');
        }
      }
    });

    return () => unsubAuth();
  }, [currentScreen]);

  // Matchmaking Queue Engine
  const startQueueSearch = async (mode: 'classic' | 'ranked') => {
    if (!profile) return;
    setCurrentQueueMode(mode);
    setQueueMessage(mode === 'classic' ? 'SEARCHING FOR OPPONENT (Bot fallback in 30s)' : 'SEARCHING RANKED OPPONENT (30s timeout)');
    setCurrentScreen('queue');
    setQueueTimer(0);
    isMatchmakerSearching.current = true;

    const matchedHero = heroes.find(h => h.heroId === selectedHeroId) || {
      heroId: selectedHeroId,
      level: 1,
      unlocked: true,
      selectedSkin: 'default',
      unlockedSkins: ['default']
    };

    const queueEntryPath = `matchmaking/queue/entries/${profile.uid}`;
    const queueData: QueueEntry = {
      uid: profile.uid,
      username: profile.username,
      avatar: profile.avatar,
      rankPoints: profile.rankPoints,
      league: profile.league,
      joinedAt: new Date().toISOString(),
      selectedHeroId: selectedHeroId,
      selectedSkin: matchedHero.selectedSkin
    };

    try {
      await setDoc(doc(db, queueEntryPath), queueData);
      
      queueTimerRef.current = setInterval(() => {
        setQueueTimer(prev => prev + 1);
      }, 1000);

      // 30-second timeout
      queueTimeoutRef.current = setTimeout(async () => {
        if (!isMatchmakerSearching.current) return;
        isMatchmakerSearching.current = false;
        if (queueTimerRef.current) clearInterval(queueTimerRef.current);
        if (queueUnsubRef.current) queueUnsubRef.current();

        // Clean queue
        try { await deleteDoc(doc(db, queueEntryPath)); } catch {}

        if (mode === 'classic') {
          setQueueMessage('NO PLAYER FOUND - STARTING BOT MATCH...');
          await new Promise(r => setTimeout(r, 1500));
          await matchmakingWithBot();
        } else {
          setQueueMessage('NO RANKED OPPONENT FOUND');
          await new Promise(r => setTimeout(r, 2000));
          cancelQueue();
        }
      }, 30000);

      // Start listener for queue items
      const q = collection(db, 'matchmaking/queue/entries');
      const unsubQueue = onSnapshot(q, async (snap) => {
        if (!isMatchmakerSearching.current) return;

        let contestants: QueueEntry[] = [];
        snap.forEach((docSnap) => {
          contestants.push(docSnap.data() as QueueEntry);
        });

        const opponent = contestants.find(c => c.uid !== profile.uid);

        if (opponent) {
          // Race-condition guard: only the player with lower UID creates the match
          if (profile.uid < opponent.uid) {
            isMatchmakerSearching.current = false;
            if (queueTimerRef.current) clearInterval(queueTimerRef.current);
            if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
            try { await deleteDoc(doc(db, queueEntryPath)); } catch {}

            const mid = `room_${profile.uid}_and_${opponent.uid}`;

            // Fetch opponent's hero level
            let oppHeroLevel = 1;
            try {
              const oppHeroSnap = await getDoc(doc(db, 'players', opponent.uid, 'heroes', opponent.selectedHeroId));
              if (oppHeroSnap.exists()) oppHeroLevel = (oppHeroSnap.data() as UserHero).level;
            } catch {}

            const myLvlMult = 1 + (matchedHero.level - 1) * 0.1;
            const mySpeed = HEROES_DATABASE[selectedHeroId].baseSpeed;
            const oppSpeed = HEROES_DATABASE[opponent.selectedHeroId].baseSpeed;
            const oppLvlMult = 1 + (oppHeroLevel - 1) * 0.1;

            const playerAParticipant: BattleParticipant = {
              uid: profile.uid,
              username: profile.username,
              avatar: profile.avatar,
              heroId: selectedHeroId,
              skin: matchedHero.selectedSkin,
              level: matchedHero.level,
              hp: Math.round(HEROES_DATABASE[selectedHeroId].baseHp * myLvlMult),
              maxHp: Math.round(HEROES_DATABASE[selectedHeroId].baseHp * myLvlMult),
              attack: HEROES_DATABASE[selectedHeroId].baseAttack,
              defense: HEROES_DATABASE[selectedHeroId].baseDefense,
              speed: mySpeed,
              energy: 15,
              maxEnergy: 100,
              isFrozen: false,
              isStealth: false,
              shieldHp: 0,
              effectTurns: {}
            };

            const playerBParticipant: BattleParticipant = {
              uid: opponent.uid,
              username: opponent.username,
              avatar: opponent.avatar,
              heroId: opponent.selectedHeroId,
              skin: opponent.selectedSkin,
              level: oppHeroLevel,
              hp: Math.round(HEROES_DATABASE[opponent.selectedHeroId].baseHp * oppLvlMult),
              maxHp: Math.round(HEROES_DATABASE[opponent.selectedHeroId].baseHp * oppLvlMult),
              attack: HEROES_DATABASE[opponent.selectedHeroId].baseAttack,
              defense: HEROES_DATABASE[opponent.selectedHeroId].baseDefense,
              speed: oppSpeed,
              energy: 15,
              maxEnergy: 100,
              isFrozen: false,
              isStealth: false,
              shieldHp: 0,
              effectTurns: {}
            };

            const turnDeterminer = mySpeed >= oppSpeed ? profile.uid : opponent.uid;
            const arenaOptions: ('winter' | 'volcano' | 'grass')[] = ['winter', 'volcano', 'grass'];
            const chosenArena = arenaOptions[Math.floor(Math.random() * arenaOptions.length)];

            const initMatch: MatchState = {
              matchId: mid,
              status: 'active',
              currentTurn: turnDeterminer,
              turnNumber: 1,
              arena: chosenArena,
              playerA: playerAParticipant,
              playerB: playerBParticipant,
              battleLogs: [
                { id: 'start', timestamp: new Date().toISOString(), playerId: 'system', playerName: 'OVERLORD', actionText: `Both fighters entering the ${chosenArena.toUpperCase()} ARENA! Battle loaded!` }
              ]
            };

            await setDoc(doc(db, 'matches', mid), initMatch);
            try { await deleteDoc(doc(db, `matchmaking/queue/entries/${opponent.uid}`)); } catch {}
            setActiveMatchId(mid);
            setCurrentScreen('battle');
          } else {
            // Higher-UID player: wait for the match to appear in Firebase
            unsubQueue();
            try { await deleteDoc(doc(db, queueEntryPath)); } catch {}
            const mid = `room_${opponent.uid}_and_${profile.uid}`;
            // Listen for the match to be created
            const matchRef = doc(db, 'matches', mid);
            const unsubMatch = onSnapshot(matchRef, async (snap) => {
              if (snap.exists()) {
                isMatchmakerSearching.current = false;
                if (queueTimerRef.current) clearInterval(queueTimerRef.current);
                if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
                unsubMatch();
                setActiveMatchId(mid);
                setCurrentScreen('battle');
              }
            });
            // Timeout: if match not created in 10s, go back home
            setTimeout(() => {
              unsubMatch();
              if (isMatchmakerSearching.current) {
                isMatchmakerSearching.current = false;
                setCurrentScreen('home');
              }
            }, 10000);
          }
        }
      });
      queueUnsubRef.current = unsubQueue;

    } catch (err) {
      console.error(err);
      cancelQueue();
    }
  };

  const cancelQueue = async () => {
    isMatchmakerSearching.current = false;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
    if (queueUnsubRef.current) { queueUnsubRef.current(); queueUnsubRef.current = null; }

    if (profile) {
      try {
        await deleteDoc(doc(db, `matchmaking/queue/entries/${profile.uid}`));
      } catch (err) {
        console.warn(err);
      }
    }
    setCurrentScreen('home');
  };

  // Launch AI Bot Battle Match immediately (fallback or button selection)
  const matchmakingWithBot = async () => {
    if (!profile) return;
    
    isMatchmakerSearching.current = false;
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);

    try {
      await deleteDoc(doc(db, `matchmaking/queue/entries/${profile.uid}`));
    } catch (e) {
      // safe bypass
    }

    const matchedHero = heroes.find(h => h.heroId === selectedHeroId) || {
      heroId: selectedHeroId,
      level: 1,
      unlocked: true,
      selectedSkin: 'default',
      unlockedSkins: ['default']
    };

    // Auto-select standard class for Bot opposing
    const botArchetypes = ['ice_mage', 'shadow_assassin', 'fire_warrior'];
    const botHeroId = botArchetypes.filter(a => a !== selectedHeroId)[Math.floor(Math.random() * 2)];

    const mid = `room_bot_${profile.uid}_${Date.now()}`;

    const myLvlMult = 1 + (matchedHero.level - 1) * 0.1;

    const mySpeed = HEROES_DATABASE[selectedHeroId].baseSpeed;
    const oppSpeed = HEROES_DATABASE[botHeroId].baseSpeed;

    const myParticipant: BattleParticipant = {
      uid: profile.uid,
      username: profile.username,
      avatar: profile.avatar,
      heroId: selectedHeroId,
      skin: matchedHero.selectedSkin,
      level: matchedHero.level,
      hp: Math.round(HEROES_DATABASE[selectedHeroId].baseHp * myLvlMult),
      maxHp: Math.round(HEROES_DATABASE[selectedHeroId].baseHp * myLvlMult),
      attack: HEROES_DATABASE[selectedHeroId].baseAttack,
      defense: HEROES_DATABASE[selectedHeroId].baseDefense,
      speed: mySpeed,
      energy: 15,
      maxEnergy: 100,
      isFrozen: false,
      isStealth: false,
      shieldHp: 0,
      effectTurns: {}
    };

    const botParticipant: BattleParticipant = {
      uid: 'bot_opponent',
      username: 'CPU Master',
      avatar: 'avatar_5',
      heroId: botHeroId,
      skin: 'default',
      level: Math.max(1, profile.level),
      hp: Math.round(HEROES_DATABASE[botHeroId].baseHp * (1 + (profile.level - 1) * 0.1)),
      maxHp: Math.round(HEROES_DATABASE[botHeroId].baseHp * (1 + (profile.level - 1) * 0.1)),
      attack: HEROES_DATABASE[botHeroId].baseAttack,
      defense: HEROES_DATABASE[botHeroId].baseDefense,
      speed: oppSpeed,
      energy: 15,
      maxEnergy: 100,
      isFrozen: false,
      isStealth: false,
      shieldHp: 0,
      effectTurns: {}
    };

    const arenaOptions: ('winter' | 'volcano' | 'grass')[] = ['winter', 'volcano', 'grass'];
    const chosenArena = arenaOptions[Math.floor(Math.random() * arenaOptions.length)];

    const initialMatch: MatchState = {
      matchId: mid,
      status: 'active',
      currentTurn: mySpeed >= oppSpeed ? profile.uid : 'bot_opponent',
      turnNumber: 1,
      arena: chosenArena,
      playerA: myParticipant,
      playerB: botParticipant,
      battleLogs: [
        { id: 'init', timestamp: new Date().toISOString(), playerId: 'system', playerName: 'OVERLORD', actionText: `CPU Challenger initiated in ${chosenArena.toUpperCase()} ARENA! Stand ready!` }
      ],
      isBotMatch: true
    };

    await setDoc(doc(db, 'matches', mid), initialMatch);
    setActiveMatchId(mid);
    setCurrentScreen('battle');
  };

  // Custom room → match start
  const handleCustomRoomMatch = async (roomId: string, matchId: string) => {
    if (!profile) return;
    setActiveMatchId(matchId);
    setCurrentScreen('battle');
  };

  // Duo match start
  const handleDuoMatch = async (teamId: string, matchId: string) => {
    setActiveMatchId(matchId);
    setCurrentScreen('battle');
  };

  const handleFinishBattle = async (outcome: 'win' | 'loss' | 'surrender', totalDamageDealt = 0) => {
    if (!profile) return;

    try {
      const playerRef = doc(db, 'players', profile.uid);
      let coinsReward = 150;
      let rpReward = 25;
      let gemReward = 5;

      let wins = profile.wins;
      let losses = profile.losses;

      if (outcome === 'win') {
        wins += 1;
        // ELO-like: base 25 + bonus for lower rank beating higher
        rpReward = 25 + Math.max(0, Math.floor((1500 - profile.rankPoints) / 100));
      } else if (outcome === 'loss') {
        losses += 1;
        coinsReward = 50;
        // Loss penalty scales with rank - higher ranks lose more
        rpReward = -Math.max(10, Math.floor(15 - (profile.rankPoints / 500)));
        gemReward = 0;
      } else { // surrender - full penalty
        losses += 1;
        coinsReward = 25;
        rpReward = -Math.max(20, Math.floor(25 - (profile.rankPoints / 400)));
        gemReward = 0;
      }

      const totalRankPoints = Math.max(0, profile.rankPoints + rpReward);
      const newLeague = getLeagueForPoints(totalRankPoints);

      // Add profile updates
      const updatedFields = {
        coins: profile.coins + coinsReward,
        gems: profile.gems + gemReward,
        wins,
        losses,
        rankPoints: totalRankPoints,
        league: newLeague,
        xp: profile.xp + 40,
        level: profile.level,
      };

      // Check level ups: (level * 100 XP threshold)
      let currentLvl = profile.level;
      let currentXp = updatedFields.xp;
      const nextThreshold = currentLvl * 100;
      if (currentXp >= nextThreshold) {
        currentLvl += 1;
        currentXp = currentXp - nextThreshold;
      }
      updatedFields.level = currentLvl;
      updatedFields.xp = currentXp;

      await updateDoc(playerRef, updatedFields);
      setProfile({
        ...profile,
        ...updatedFields
      });

      // Track Daily Missions progress
      const updatedMissions = missions.map(m => {
        if (m.claimed) return m;
        let newProgress = m.progress;
        if (m.id === 'win_ranked' && outcome === 'win') newProgress = Math.min(m.target, m.progress + 1);
        if (m.id === 'play_3_classic') newProgress = Math.min(m.target, m.progress + 1);
        if (m.id === 'deal_500_damage') newProgress = Math.min(m.target, totalDamageDealt);
        return { ...m, progress: newProgress, completed: newProgress >= m.target };
      });
      for (const m of updatedMissions) {
        await updateDoc(doc(db, 'players', profile.uid, 'missions', m.id), { progress: m.progress, completed: m.progress >= m.target });
      }
      setMissions(updatedMissions);

      // Track Achievements progress
      const updatedAch = achievements.map(a => {
        if (a.unlocked || a.claimed) return a;
        let newProgress = a.progress;
        if (a.id === 'first_blood' && outcome === 'win') newProgress = Math.min(a.target, a.progress + 1);
        if (a.id === 'win_streak_5' && outcome === 'win') newProgress = Math.min(a.target, a.progress + 1);
        // reset win streak on loss
        if (a.id === 'win_streak_5' && outcome !== 'win') newProgress = 0;
        return { ...a, progress: newProgress, unlocked: newProgress >= a.target };
      });
      for (const a of updatedAch) {
        await updateDoc(doc(db, 'players', profile.uid, 'achievements', a.id), { progress: a.progress, unlocked: a.progress >= a.target });
      }
      setAchievements(updatedAch);

      // Track Battle Pass XP
      const xpGain = outcome === 'win' ? 50 : 20;
      const newXp = battlePassState.xp + xpGain;
      const maxLevel = BATTLE_PASS_LEVELS.length;
      let newBpLevel = battlePassState.level;
      let remainingXp = newXp;
      const newClaimedFree = [...battlePassState.claimedFree];
      const newClaimedPremium = [...battlePassState.claimedPremium];
      while (newBpLevel < maxLevel && remainingXp >= (BATTLE_PASS_LEVELS[newBpLevel]?.xpRequired ?? 100)) {
        remainingXp -= BATTLE_PASS_LEVELS[newBpLevel].xpRequired;
        newBpLevel += 1;
      }
      const updatedBp: BattlePassState = {
        ...battlePassState,
        level: newBpLevel,
        xp: remainingXp,
      };
      setBattlePassState(updatedBp);
      await setDoc(doc(db, 'players', profile.uid, 'battlepass', 'state'), updatedBp);

    } catch (e) {
      console.warn('Post battle sync failed:', e);
    } finally {
      setActiveMatchId(null);
      setCurrentScreen('home');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('hero_arena_guest_uid');
    await signOut(auth);
    setProfile(null);
    setCurrentScreen('auth');
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050508] flex items-center justify-center p-0 overflow-hidden select-none">
      {/* Mobile Fullscreen Game Container */}
      <div className="relative w-full h-full bg-[#0A0A0C] overflow-hidden flex flex-col justify-between">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-[-5%] left-[-5%] w-[420px] h-[420px] bg-amber-950/15 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-[5%] right-[-5%] w-[450px] h-[450px] bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

        {/* Action Views container */}
        <div className="flex-grow flex flex-col overflow-hidden relative z-10">
          
          <AnimatePresence mode="wait">
            
            {/* 1. Splash Screen */}
            {currentScreen === 'splash' && (
              <motion.div key="splash" exit={{ opacity: 0 }} className="h-full flex-grow">
                <SplashScreen onFinish={() => setCurrentScreen('auth')} />
              </motion.div>
            )}

            {/* 2. Login & Onboarding Screen */}
            {currentScreen === 'auth' && (
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-grow">
                <LoginScreen onLoginSuccess={(prof) => { setProfile(prof); setCurrentScreen('home'); }} />
              </motion.div>
            )}

            {/* 3. Home / Core Lobby Dashboard Screen */}
            {currentScreen === 'home' && profile && (
              <motion.div key="home" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="h-full flex-grow flex flex-col justify-between bg-[#050508] text-white overflow-hidden relative select-none">
                
                {/* 3D CHARACTER SCENE (FULL CONTAINER BACKDROP) */}
                <div className="absolute inset-0 z-0 h-full w-full pointer-events-none hologram-scan radar-sweep">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/40 via-transparent to-[#050508]/60 z-10" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-100 scale-100">
                    <ThreeHeroView 
                      heroId={selectedHeroId} 
                      skin={heroes.find(h => h.heroId === selectedHeroId)?.selectedSkin || 'default'} 
                      isAnimated={true} 
                      isLobby={true} 
                    />
                  </div>
                </div>

                {/* FOREGROUND HUD OVERLAY */}
                <div className="relative z-20 h-full flex flex-col justify-between p-2 flex-grow">
                  
                  {/* SECTION A: TOP BAR — ultra thin */}
                  <div className="flex justify-between items-center bg-slate-950/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/[0.04] shadow-lg">
                    <div className="flex items-center space-x-2 shrink min-w-0">
                      <div 
                        className="w-7 h-7 rounded-full bg-slate-900 border border-amber-500/60 flex items-center justify-center text-sm shrink-0 cursor-pointer active:scale-90 transition-all" 
                        onClick={() => setCurrentScreen('settings')}
                      >
                        <span>{profile.avatar === 'avatar_1' ? '🔥' : profile.avatar === 'avatar_2' ? '❄️' : profile.avatar === 'avatar_3' ? '👤' : profile.avatar === 'avatar_4' ? '⚡' : profile.avatar === 'avatar_5' ? '🐉' : '🔮'}</span>
                      </div>
                      <div className="truncate leading-tight">
                        <div className="flex items-center gap-1">
                          <span className="font-heading text-[9px] font-black tracking-widest truncate text-white">{profile.username}</span>
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                        </div>
                        <p className="text-[7px] text-amber-500 font-mono font-bold leading-none">LV.{profile.level}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div onClick={() => setCurrentScreen('shop')} className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 cursor-pointer active:scale-90 transition-all">
                        <Coins className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500/30" />
                        <span className="text-[8px] font-mono font-black text-yellow-400">{profile.coins}</span>
                      </div>
                      <div onClick={() => setCurrentScreen('shop')} className="flex items-center space-x-0.5 px-1.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 cursor-pointer active:scale-90 transition-all">
                        <Gem className="w-2.5 h-2.5 text-cyan-400 fill-cyan-400/30" />
                        <span className="text-[8px] font-mono font-black text-cyan-400">{profile.gems}</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION B: CENTER — side rails flanking character */}
                  <div className="flex-grow flex items-center justify-between relative">
                    
                    {/* LEFT RAIL */}
                    <div className="flex flex-col space-y-2 z-30">
                      <button onClick={() => setCurrentScreen('heroes')} id="btn_home_heroes" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-orange-500/20 border border-white/[0.06] hover:border-orange-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Shield className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">VAULT</span>
                      </button>
                      <button onClick={() => setCurrentScreen('leaderboard')} id="btn_home_ranks" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-yellow-500/20 border border-white/[0.06] hover:border-yellow-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">LEAGUE</span>
                      </button>
                    </div>

                    {/* LEFT STATS PANEL — compact, semi-transparent */}
                    <div className="absolute left-[3.8rem] top-1/2 -translate-y-1/2 z-20 pointer-events-none w-28 bg-slate-950/60 backdrop-blur-sm border border-white/[0.04] p-2 rounded-lg space-y-1 shrink-0">
                      <div className="flex items-center gap-1 border-b border-white/[0.03] pb-0.5 mb-0.5">
                        <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[6.5px] font-heading font-black tracking-widest text-[#f97316] uppercase">STATS</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[6px] font-mono text-slate-400"><span>HP</span><span className="font-black text-emerald-400">{HEROES_DATABASE[selectedHeroId].baseHp}</span></div>
                        <div className="w-full bg-slate-900/60 h-[3px] rounded-full overflow-hidden"><div className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full" style={{width:`${(HEROES_DATABASE[selectedHeroId].baseHp/150)*100}%`}} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[6px] font-mono text-slate-400"><span>ATK</span><span className="font-black text-rose-400">{HEROES_DATABASE[selectedHeroId].baseAttack}</span></div>
                        <div className="w-full bg-slate-900/60 h-[3px] rounded-full overflow-hidden"><div className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full" style={{width:`${(HEROES_DATABASE[selectedHeroId].baseAttack/35)*100}%`}} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[6px] font-mono text-slate-400"><span>DEF</span><span className="font-black text-cyan-400">{HEROES_DATABASE[selectedHeroId].baseDefense}</span></div>
                        <div className="w-full bg-slate-900/60 h-[3px] rounded-full overflow-hidden"><div className="bg-gradient-to-r from-cyan-600 to-cyan-400 h-full rounded-full" style={{width:`${(HEROES_DATABASE[selectedHeroId].baseDefense/20)*100}%`}} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[6px] font-mono text-slate-400"><span>SPD</span><span className="font-black text-amber-400">{HEROES_DATABASE[selectedHeroId].baseSpeed}</span></div>
                        <div className="w-full bg-slate-900/60 h-[3px] rounded-full overflow-hidden"><div className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full" style={{width:`${(HEROES_DATABASE[selectedHeroId].baseSpeed/15)*100}%`}} /></div>
                      </div>
                    </div>

                    {/* RIGHT SKILLS PANEL — compact */}
                    <div className="absolute right-[3.8rem] top-1/2 -translate-y-1/2 z-20 pointer-events-none w-28 bg-slate-950/60 backdrop-blur-sm border border-white/[0.04] p-2 rounded-lg space-y-1 text-right shrink-0">
                      <div className="flex items-center justify-end gap-1 border-b border-white/[0.03] pb-0.5 mb-0.5">
                        <span className="text-[6.5px] font-heading font-black tracking-widest text-[#00ffff] uppercase">SKILLS</span>
                        <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[6.5px] font-heading font-black text-slate-200 uppercase tracking-wider leading-tight">{HEROES_DATABASE[selectedHeroId].skills.skill1.name}</p>
                        <p className="text-[5.5px] text-slate-500 leading-tight">{HEROES_DATABASE[selectedHeroId].skills.skill1.description.slice(0, 40)}</p>
                      </div>
                      <div className="border-t border-white/[0.04] pt-0.5">
                        <p className="text-[6.5px] font-heading font-black text-violet-400 uppercase tracking-wider leading-tight">ULT: {HEROES_DATABASE[selectedHeroId].skills.ultimate.name}</p>
                      </div>
                    </div>

                    {/* RIGHT RAIL */}
                    <div className="flex flex-col space-y-2 z-30">
                      <button onClick={() => setCurrentScreen('shop')} id="btn_home_shop" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-cyan-500/20 border border-white/[0.06] hover:border-cyan-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Gem className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">SHOP</span>
                      </button>
                      <button onClick={() => setMissionsOpen(true)} id="btn_home_missions" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-violet-500/20 border border-white/[0.06] hover:border-violet-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">MISSIONS</span>
                      </button>
                      <button onClick={() => setAchievementsOpen(true)} id="btn_home_achievements" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-yellow-500/20 border border-white/[0.06] hover:border-yellow-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">ACHIEVEMENTS</span>
                      </button>
                      <button onClick={() => setCurrentScreen('spectate')} id="btn_home_spectate" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-cyan-500/20 border border-white/[0.06] hover:border-cyan-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">SPECTATE</span>
                      </button>
                      <button onClick={() => setCurrentScreen('custom_rooms')} id="btn_home_rooms" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-violet-500/20 border border-white/[0.06] hover:border-violet-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <DoorOpen className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">ROOMS</span>
                      </button>
                      <button onClick={() => setCurrentScreen('tournaments')} id="btn_home_tournaments" 
                        className="group flex flex-col items-center justify-center p-1.5 h-12 w-12 bg-slate-950/80 hover:bg-amber-500/20 border border-white/[0.06] hover:border-amber-500/50 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.85] text-center relative overflow-hidden shrink-0">
                        <Swords className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[6px] font-heading font-black mt-1 text-slate-300 tracking-widest">EVENTS</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION C: BOTTOM CONTROLS — ultra compact single row */}
                  <div className="relative z-30">
                    <div className="flex items-center gap-1">
                      {/* Hero quick pick */}
                      <div className="flex items-center gap-0.5 bg-slate-950/70 backdrop-blur-sm px-1.5 py-1 rounded-lg border border-white/[0.04] shadow-lg">
                        {Object.keys(HEROES_DATABASE).map((hId) => {
                          const sel = selectedHeroId === hId;
                          return (
                            <button key={hId} onClick={() => setSelectedHeroId(hId)}
                              className={`px-1.5 py-0.5 rounded text-[7px] font-heading font-black tracking-wider transition-all cursor-pointer uppercase ${
                                sel ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-[0_0_6px_rgba(245,158,11,0.3)]' : 'bg-white/[0.04] text-slate-400 hover:bg-white/10'
                              }`}>
                              {hId === 'fire_warrior' ? '🔥' : hId === 'ice_mage' ? '❄️' : '👤'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Mode selector */}
                      <div className="flex items-center gap-0.5 bg-slate-950/70 backdrop-blur-sm px-1 py-1 rounded-lg border border-white/[0.04] shadow-lg">
                        <button onClick={() => setGameMode('classic')}
                          className={`px-1.5 py-0.5 rounded text-[7px] font-heading font-black tracking-widest uppercase transition-all cursor-pointer ${
                            gameMode === 'classic' ? 'bg-emerald-600/30 border border-emerald-500/30 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
                          }`}>⚔️ CLASSIC</button>
                        <button onClick={() => setGameMode('ranked')}
                          className={`px-1.5 py-0.5 rounded text-[7px] font-heading font-black tracking-widest uppercase transition-all cursor-pointer ${
                            gameMode === 'ranked' ? 'bg-rose-600/30 border border-rose-500/30 text-rose-300' : 'text-slate-500 hover:text-slate-300'
                          }`}>🏆 RANKED</button>
                        <button onClick={() => { setGameMode('classic'); setCurrentScreen('duo_lobby'); }}
                          className={`px-1.5 py-0.5 rounded text-[7px] font-heading font-black tracking-widest uppercase transition-all cursor-pointer ${
                            false ? '' : 'text-slate-500 hover:text-slate-300'
                          }`}>👥 DUO</button>
                        <button onClick={() => setCurrentScreen('br_lobby')}
                          className={`px-1.5 py-0.5 rounded text-[7px] font-heading font-black tracking-widest uppercase transition-all cursor-pointer ${
                            false ? '' : 'text-slate-500 hover:text-slate-300'
                          }`}>🎯 BR</button>
                      </div>

                      {/* PLAY button */}
                      <button onClick={() => setCurrentScreen('hero_select')} id="btn_home_play"
                        className="group relative flex-1 h-8 rounded-lg bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-600 active:scale-[0.97] cursor-pointer overflow-hidden flex items-center justify-center gap-1 shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                        <Swords className="w-3 h-3 text-slate-950 fill-white/10" />
                        <span className="text-[8px] tracking-wider font-heading font-black text-slate-950">{gameMode === 'classic' ? 'PLAY' : 'RANKED'}</span>
                      </button>

                      {/* Stats footer chip */}
                      <div className="flex items-center gap-1 bg-slate-950/70 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/[0.04] shadow-lg">
                        <Trophy className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[6.5px] font-mono text-slate-400 font-bold whitespace-nowrap">{profile.league.slice(0,3).toUpperCase()} {profile.rankPoints}</span>
                      </div>

                      {/* Battle Pass chip */}
                      <button onClick={() => setBattlePassOpen(true)} id="btn_home_battlepass"
                        className="p-1.5 bg-slate-950/70 backdrop-blur-sm rounded-lg border border-white/[0.04] cursor-pointer active:scale-[0.85] transition-all">
                        <Crown className="w-2.5 h-2.5 text-yellow-500" />
                      </button>

                      {/* Admin link to standalone page */}
                      <a href="/admin.html"
                        className="p-1.5 bg-slate-950/70 backdrop-blur-sm rounded-lg border border-white/[0.04] hover:border-red-500/30 transition-all inline-flex items-center">
                        <Shield className="w-2.5 h-2.5 text-red-500/60" />
                      </a>

                      {/* Settings chip */}
                      <button onClick={() => setCurrentScreen('settings')} id="btn_home_settings"
                        className="p-1.5 bg-slate-950/70 backdrop-blur-sm rounded-lg border border-white/[0.04] cursor-pointer active:scale-[0.85] transition-all">
                        <SettingsIcon className="w-2.5 h-2.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                </div>

                {/* MODAL OVERLAYS */}
                {missionsOpen && (
                  <DailyMissions
                    missions={missions}
                    onClaim={async (missionId) => {
                      const updated = missions.map(m => m.id === missionId ? { ...m, claimed: true } : m);
                      setMissions(updated);
                      await updateDoc(doc(db, 'players', profile.uid, 'missions', missionId), { claimed: true });
                      const rewards: Record<string, { coins: number; gems: number }> = {
                        'win_ranked': { coins: 200, gems: 10 },
                        'play_3_classic': { coins: 100, gems: 5 },
                        'deal_500_damage': { coins: 150, gems: 8 },
                      };
                      const r = rewards[missionId] || { coins: 50, gems: 2 };
                      const updatedProfile = { ...profile, coins: profile.coins + r.coins, gems: profile.gems + r.gems };
                      setProfile(updatedProfile);
                      await updateDoc(doc(db, 'players', profile.uid), { coins: updatedProfile.coins, gems: updatedProfile.gems });
                    }}
                    onClose={() => setMissionsOpen(false)}
                  />
                )}
                {achievementsOpen && (
                  <AchievementsModal
                    achievements={achievements}
                    onClaim={async (achievementId) => {
                      const updated = achievements.map(a => a.id === achievementId ? { ...a, claimed: true } : a);
                      setAchievements(updated);
                      await updateDoc(doc(db, 'players', profile.uid, 'achievements', achievementId), { claimed: true });
                      const rewards: Record<string, { coins: number; gems: number }> = {
                        'first_blood': { coins: 50, gems: 5 },
                        'win_streak_5': { coins: 300, gems: 20 },
                        'collector_10': { coins: 200, gems: 15 },
                        'fashionista': { coins: 100, gems: 10 },
                        'big_spender': { coins: 500, gems: 30 },
                        'rank_warrior': { coins: 400, gems: 25 },
                      };
                      const r = rewards[achievementId] || { coins: 100, gems: 5 };
                      const updatedProfile = { ...profile, coins: profile.coins + r.coins, gems: profile.gems + r.gems };
                      setProfile(updatedProfile);
                      await updateDoc(doc(db, 'players', profile.uid), { coins: updatedProfile.coins, gems: updatedProfile.gems });
                    }}
                    onClose={() => setAchievementsOpen(false)}
                  />
                )}
                {battlePassOpen && (
                  <BattlePass
                    state={battlePassState}
                    onClaimFree={async (level) => {
                      const updated = { ...battlePassState, claimedFree: [...battlePassState.claimedFree, level] };
                      setBattlePassState(updated);
                      await updateDoc(doc(db, 'players', profile.uid, 'battlepass', 'state'), updated);
                    }}
                    onClaimPremium={async (level) => {
                      const updated = { ...battlePassState, claimedPremium: [...battlePassState.claimedPremium, level] };
                      setBattlePassState(updated);
                      await updateDoc(doc(db, 'players', profile.uid, 'battlepass', 'state'), updated);
                    }}
                    onPurchasePremium={async () => {
                      if (profile.gems < 500) return;
                      const updated = { ...battlePassState, hasPremium: true };
                      setBattlePassState(updated);
                      setProfile({ ...profile, gems: profile.gems - 500 });
                      await updateDoc(doc(db, 'players', profile.uid), { gems: profile.gems - 500 });
                      await setDoc(doc(db, 'players', profile.uid, 'battlepass', 'state'), updated);
                    }}
                    onClose={() => setBattlePassOpen(false)}
                  />
                )}

              </motion.div>
            )}

            {/* 4. Queue Matchmaker Screen */}
            {currentScreen === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-grow flex flex-col justify-between bg-slate-950 text-white p-6 text-center select-none">
                <div />

                {/* Queue radar portals */}
                <div className="space-y-6">
                  <div className={`relative flex items-center justify-center w-36 h-36 mx-auto rounded-full border-4 border-dashed animate-pulse ${
                    currentQueueMode === 'classic' ? 'border-emerald-500/30' : 'border-orange-500/30'
                  }`}>
                    <div className={`absolute inset-2 rounded-full border border-dashed animate-spin ${
                      currentQueueMode === 'classic' ? 'border-emerald-500/30' : 'border-orange-500/30'
                    }`} />
                    <Swords className="w-12 h-12 text-slate-200" />
                  </div>

                  <div className="space-y-1">
                    <h3 className={`font-heading text-xl font-extrabold uppercase bg-clip-text text-transparent ${
                      currentQueueMode === 'classic' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-gradient-to-r from-orange-400 to-red-400'
                    }`}>
                      {currentQueueMode === 'classic' ? 'CLASSIC MATCHMAKING' : 'RANKED MATCHMAKING'}
                    </h3>
                    <p className="text-xs text-slate-400">{queueMessage} ({queueTimer}s / 30s)</p>
                    {/* Progress bar */}
                    <div className="w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden mx-auto mt-2">
                      <div className={`h-full rounded-full transition-all duration-1000 ${
                        currentQueueMode === 'classic' ? 'bg-emerald-500' : 'bg-orange-500'
                      }`} style={{ width: `${Math.min(100, (queueTimer / 30) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={cancelQueue}
                    id="btn_queue_cancel"
                    className="w-full h-11 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 active:bg-slate-800 text-slate-400 font-heading text-xs uppercase cursor-pointer transition-all"
                  >
                    {currentQueueMode === 'classic' ? '← CANCEL & RETURN' : '← CANCEL SEARCH'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. Custom barracks collection */}
            {currentScreen === 'heroes' && profile && (
              <motion.div key="heroes" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} className="h-full flex-grow">
                <HeroCollectionScreen 
                  profile={profile}
                  heroes={heroes}
                  onUpdateProfile={(up) => setProfile(prev => prev ? { ...prev, ...up } : null)}
                  onUpdateHero={(up) => setHeroes(prev => {
                    const idx = prev.findIndex(h => h.heroId === up.heroId);
                    if (idx >= 0) {
                      const cloned = [...prev];
                      cloned[idx] = up;
                      return cloned;
                    }
                    return [...prev, up];
                  })}
                  onBack={() => setCurrentScreen('home')}
                />
              </motion.div>
            )}

            {/* 6a. Hero Select Draft Lobby */}
            {currentScreen === 'hero_select' && profile && (
              <motion.div key="hero_select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex-grow">
                <HeroSelectScreen
                  profile={profile}
                  heroes={heroes}
                  isRanked={gameMode === 'ranked'}
                  onStartBattle={(heroId, skin) => {
                    setSelectedHeroId(heroId);
                    if (profile) {
                      const heroRef = doc(db, 'players', profile.uid, 'heroes', heroId);
                      getDoc(heroRef).then(snap => {
                        if (snap.exists()) {
                          const hData = snap.data() as UserHero;
                          setHeroes(prev => {
                            const idx = prev.findIndex(h => h.heroId === heroId);
                            if (idx >= 0) {
                              const c = [...prev];
                              c[idx] = { ...c[idx], selectedSkin: skin || c[idx].selectedSkin };
                              return c;
                            }
                            return prev;
                          });
                        }
                      });
                    }
                    setTimeout(() => startQueueSearch(gameMode), 100);
                  }}
                  onBack={() => setCurrentScreen('home')}
                />
              </motion.div>
            )}

            {/* 6. Elite Shop view */}
            {currentScreen === 'shop' && profile && (
              <motion.div key="shop" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} className="h-full flex-grow">
                <ShopScreen 
                  profile={profile}
                  heroes={heroes}
                  onUpdateProfile={(up) => setProfile(prev => prev ? { ...prev, ...up } : null)}
                  onUpdateHero={(up) => setHeroes(prev => {
                    const idx = prev.findIndex(h => h.heroId === up.heroId);
                    if (idx >= 0) {
                      const cloned = [...prev];
                      cloned[idx] = up;
                      return cloned;
                    }
                    return [...prev, up];
                  })}
                  onBack={() => setCurrentScreen('home')}
                />
              </motion.div>
            )}

            {/* 7. Global rankings view */}
            {currentScreen === 'leaderboard' && profile && (
              <motion.div key="leaderboard" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="h-full flex-grow">
                <LeaderboardScreen 
                  currentProfile={profile} 
                  onBack={() => setCurrentScreen('home')} 
                />
              </motion.div>
            )}

            {/* 8. Controls and Cheats View */}
            {currentScreen === 'settings' && profile && (
              <motion.div key="settings" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="h-full flex-grow">
                <SettingsScreen 
                  profile={profile}
                  onUpdateProfile={(up) => setProfile(prev => prev ? { ...prev, ...up } : null)}
                  onLogout={handleLogout}
                  onBack={() => setCurrentScreen('home')}
                />
              </motion.div>
            )}

            {/* 9. Live Battle Screen (Fully interactive) */}
            {currentScreen === 'battle' && profile && activeMatchId && (
              <motion.div key="battle" initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-full flex-grow">
                <BattleScreen 
                  profile={profile}
                  matchId={activeMatchId}
                  onFinishBattle={handleFinishBattle}
                />
              </motion.div>
            )}

            {/* 10. Spectator Mode */}
            {currentScreen === 'spectate' && profile && (
              <motion.div key="spectate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <SpectatorScreen onBack={() => setCurrentScreen('home')} />
              </motion.div>
            )}

            {/* 11. Custom Rooms */}
            {currentScreen === 'custom_rooms' && profile && (
              <motion.div key="custom_rooms" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <CustomRoomScreen
                  profile={profile}
                  heroes={heroes}
                  onBack={() => setCurrentScreen('home')}
                  onStartMatch={handleCustomRoomMatch}
                />
              </motion.div>
            )}

            {/* 12. Tournaments */}
            {currentScreen === 'tournaments' && profile && (
              <motion.div key="tournaments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <TournamentScreen
                  profile={profile}
                  onBack={() => setCurrentScreen('home')}
                />
              </motion.div>
            )}

            {/* 13. Duo Lobby */}
            {currentScreen === 'duo_lobby' && profile && (
              <motion.div key="duo_lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <DuoLobbyScreen
                  profile={profile}
                  heroes={heroes}
                  onBack={() => setCurrentScreen('home')}
                  onStartDuoMatch={handleDuoMatch}
                />
              </motion.div>
            )}

            {/* 14. Battle Royale Lobby */}
            {currentScreen === 'br_lobby' && profile && (
              <motion.div key="br_lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRLobby
                  profile={profile}
                  onBack={() => setCurrentScreen('home')}
                  onStartMatch={(mid) => { setBrMatchId(mid); setCurrentScreen('br_game'); }}
                />
              </motion.div>
            )}

            {/* 15. Battle Royale Game */}
            {currentScreen === 'br_game' && profile && brMatchId && (
              <motion.div key="br_game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex-grow">
                <BRGame
                  profile={profile}
                  matchId={brMatchId}
                  onBack={() => { setBrMatchId(null); setCurrentScreen('home'); }}
                />
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
