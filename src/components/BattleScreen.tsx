import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Swords, Zap, RefreshCw, LogOut, Loader2, Sparkles, Trophy, Mic, MicOff, Users } from 'lucide-react';
import { MatchState, PlayerProfile, HEROES_DATABASE, StaticHero, Emote, FREE_EMOTES } from '../types';
import { db, doc, updateDoc, setDoc, getDoc } from '../lib/firebase';
import ThreeHeroView from './ThreeHeroView';
import { gameAudio } from '../lib/gameAudio';
import EmoteSelector from './EmoteSelector';
import { joinVoiceChannel, leaveVoiceChannel, toggleVoiceMute, isVoiceMuted, isAgoraAvailable } from '../lib/agoraVoice';

interface BattleScreenProps {
  profile: PlayerProfile;
  matchId: string;
  onFinishBattle: (outcome: 'win' | 'loss' | 'surrender', totalDamageDealt?: number) => void;
}

export default function BattleScreen({ profile, matchId, onFinishBattle }: BattleScreenProps) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [damagePop, setDamagePop] = useState<{ amount: number; isUlt?: boolean; target: 'A' | 'B' } | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  
  const [playerAVisualState, setPlayerAVisualState] = useState<'idle' | 'attack' | 'ultimate' | 'damaged'>('idle');
  const [playerBVisualState, setPlayerBVisualState] = useState<'idle' | 'attack' | 'ultimate' | 'damaged'>('idle');
  const [hitFlash, setHitFlash] = useState<'A' | 'B' | null>(null);
  const [shieldFlash, setShieldFlash] = useState(false);
  const [sparkHitA, setSparkHitA] = useState(false);
  const [sparkHitB, setSparkHitB] = useState(false);
  const [deathExplosionA, setDeathExplosionA] = useState(false);
  const [deathExplosionB, setDeathExplosionB] = useState(false);
  const [muted, setMuted] = useState(false);
  const [emotePickerOpen, setEmotePickerOpen] = useState(false);
  const [currentEmote, setCurrentEmote] = useState<{ emoji: string; side: 'A' | 'B' } | null>(null);
  const [totalDamageDealt, setTotalDamageDealt] = useState(0);
  const [totalDamageTaken, setTotalDamageTaken] = useState(0);
  const [killFeed, setKillFeed] = useState<{ text: string; id: number }[]>([]);
  const killFeedIdRef = useRef(0);
  const [voiceOn, setVoiceOn] = useState(false);
  const [isDuo, setIsDuo] = useState(false);

  const decisionRef = useRef<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const matchStartedRef = useRef(false);

  // Match start sound + voice
  useEffect(() => {
    if (match && match.status === 'active' && !matchStartedRef.current) {
      matchStartedRef.current = true;
      gameAudio.matchStart();
      gameAudio.voiceLine(me.heroId, 'start');
      // Detect duo mode
      if ((match as any).isDuo) {
        setIsDuo(true);
        // Auto-join voice for duo match if available
        if (isAgoraAvailable() && !voiceOn) {
          const duoTeamId = (match as any).teamA?.find((m: any) => m.uid === profile.uid) ? matchId.split('_vs_')[0].replace('duo_match_', '') : '';
          if (duoTeamId) { joinVoiceChannel(`duo_${duoTeamId}`, profile.uid).then(setVoiceOn); }
        }
      }
    }
  }, [match?.status]);

  // Sync scroll on logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [match?.battleLogs]);

  // Trigger reactive 3D animations and visual effects based on damage popups
  useEffect(() => {
    if (!damagePop) return;
    
    const target = damagePop.target;

    // 3D character animation
    if (target === 'A') {
      setPlayerAVisualState('damaged');
      setPlayerBVisualState(damagePop.isUlt ? 'ultimate' : 'attack');
    } else {
      setPlayerBVisualState('damaged');
      setPlayerAVisualState(damagePop.isUlt ? 'ultimate' : 'attack');
    }

    // Screen hit flash
    setHitFlash(target);
    setTimeout(() => setHitFlash(null), 300);

    // Elemental hit sparks
    if (damagePop.amount > 0) {
      if (target === 'A') {
        setSparkHitA(true);
        setTimeout(() => setSparkHitA(false), 100);
      } else {
        setSparkHitB(true);
        setTimeout(() => setSparkHitB(false), 100);
      }
    }

    // Screen shake on any hit (not just ult)
    if (damagePop.amount > 0) {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 400);
    }

    const timer = setTimeout(() => {
      setPlayerAVisualState('idle');
      setPlayerBVisualState('idle');
    }, 1200);

    return () => clearTimeout(timer);
  }, [damagePop]);

  // Subscribe to real-time multiplayer session
  useEffect(() => {
    const matchRef = doc(db, 'matches', matchId);
    let unsubscribed = false;

    // Listen
    const handleSync = async () => {
      const snap = await getDoc(matchRef);
      if (snap.exists() && !unsubscribed) {
        setMatch(snap.data() as MatchState);
      }
    };

    handleSync();
    
    // Set periodic polling/sync to lock database synchronization
    const timer = setInterval(() => {
      handleSync();
    }, 1500);

    return () => {
      unsubscribed = true;
      clearInterval(timer);
    };
  }, [matchId]);

  // Check and run AI bot move if current turn is the bot!
  useEffect(() => {
    if (!match || match.status !== 'active' || !match.isBotMatch) return;

    const isBotTurn = match.currentTurn === 'bot_opponent';
    if (!isBotTurn || decisionRef.current) return;

    decisionRef.current = true;
    
    const triggerBotDecision = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Dramatic tactical pause
        
        const response = await fetch('/api/bot-decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchState: match, botPlayerId: 'playerB' })
        });
        
        if (!response.ok) throw new Error('AI decision route failed');
        const decisionData = await response.json();
        
        await executeCombatMove('bot_opponent', decisionData.action, decisionData.commentary);
      } catch (err) {
        console.error('Trigger bot decision failed:', err);
        // Failback
        await executeCombatMove('bot_opponent', 'attack', 'CPU charges ahead with straightforward strike!');
      } finally {
        decisionRef.current = false;
      }
    };

    triggerBotDecision();
  }, [match?.currentTurn, match?.status]);

  const isPlayerAOuter = match ? profile.uid === match.playerA.uid : false;
  const meOuter = match ? (isPlayerAOuter ? match.playerA : match.playerB) : null;

  // Turn tracking timer countdown
  useEffect(() => {
    if (!match || match.status !== 'active') return;

    // Reset countdown back to 5
    setTimeLeft(5);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [match?.currentTurn, match?.turnNumber, match?.status]);

  // Desktop keyboard shortcuts (A/X/Y/B + ESC/S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!match || match.status !== 'active' || !meOuter) return;
      const activePlayerId = match.currentTurn;
      const isMyTurn = activePlayerId === meOuter.uid && match.status === 'active';
      if (!isMyTurn || meOuter.isFrozen || actionLoading) {
        if (e.key.toLowerCase() === 's' || e.key === 'Escape') {
          surrenderMatch();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
        case '1':
          e.preventDefault();
          executeCombatMove(meOuter.uid, 'attack');
          break;
        case 'x':
        case '2':
          e.preventDefault();
          if (meOuter.energy >= HEROES_DATABASE[meOuter.heroId].skills.skill1.energyCost)
            executeCombatMove(meOuter.uid, 'skill1');
          break;
        case 'y':
        case '3':
          e.preventDefault();
          if (meOuter.energy >= HEROES_DATABASE[meOuter.heroId].skills.skill2.energyCost)
            executeCombatMove(meOuter.uid, 'skill2');
          break;
        case 'b':
        case '4':
          e.preventDefault();
          if (meOuter.energy >= 100)
            executeCombatMove(meOuter.uid, 'ultimate');
          break;
        case 's':
        case 'escape':
          e.preventDefault();
          surrenderMatch();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match, meOuter, actionLoading]);

  // Turn time-limit expired auto trigger handler
  useEffect(() => {
    if (!match || match.status !== 'active' || timeLeft !== 0 || !meOuter) return;

    const activePlayerId = match.currentTurn;
    const isMainBot = match.isBotMatch && activePlayerId === 'bot_opponent';

    // The bot's decision loop takes care of itself and is independent of timer triggers
    if (isMainBot) return;

    const performAutoAction = async () => {
      const activeIsMe = activePlayerId === meOuter.uid;
      const shouldIExecute = activeIsMe || isPlayerAOuter;

      if (shouldIExecute) {
        const actorObj = activePlayerId === match.playerA.uid ? match.playerA : match.playerB;
        if (actorObj.isFrozen) {
          await executeCombatMove(activePlayerId, 'attack', 'Turn limit expired! Skips frozen turn.');
        } else {
          await executeCombatMove(activePlayerId, 'attack', 'Turn limit expired! Automatic combat strike.');
        }
      }
    };

    performAutoAction();
  }, [timeLeft, match?.currentTurn, match?.status, meOuter, isPlayerAOuter]);

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#0A0A0C] text-white p-6 space-y-4">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">Synchronizing Arena States...</p>
      </div>
    );
  }

  const isPlayerA = profile.uid === match.playerA.uid;
  const me = isPlayerA ? match.playerA : match.playerB;
  const opponent = isPlayerA ? match.playerB : match.playerA;

  const isMyTurn = match.currentTurn === me.uid && match.status === 'active';
  const myHeroStatic: StaticHero = HEROES_DATABASE[me.heroId];

  // Core Combat Action execution
  const executeCombatMove = async (
    actorId: string, 
    actionType: 'attack' | 'skill1' | 'skill2' | 'ultimate',
    aiCommentary = ''
  ) => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      const matchRef = doc(db, 'matches', matchId);
      const host = await getDoc(matchRef);
      if (!host.exists()) return;

      const latestState = host.data() as MatchState;
      const actor = actorId === latestState.playerA.uid ? { ...latestState.playerA } : { ...latestState.playerB };
      const target = actorId === latestState.playerA.uid ? { ...latestState.playerB } : { ...latestState.playerA };

      // Frozen evaluation
      if (actor.isFrozen) {
        actor.isFrozen = false;
        latestState.currentTurn = target.uid;
        latestState.turnNumber += 1;
        latestState.battleLogs.push({
          id: 'sk_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          playerId: actor.uid,
          playerName: actor.username,
          actionText: `❄️ ${actor.username} is frozen solid and skips their turn!`
        });

        // Save
        if (actorId === latestState.playerA.uid) {
          latestState.playerA = actor;
        } else {
          latestState.playerB = actor;
        }

        await setDoc(matchRef, latestState);
        setActionLoading(false);
        return;
      }

      // De-stealth tick from previous turn (turns count)
      if (actor.isStealth) {
        actor.isStealth = false;
      }

      // Execute based on combat type
      let damage = 0;
      let logText = '';
      let isUlt = false;

      // Reset shield or decrement turns if any
      if (actor.shieldHp > 0) {
        actor.shieldHp = Math.max(0, actor.shieldHp - 10);
      }

      const mult = 1 + (actor.level - 1) * 0.1;
      const baseAttackPower = Math.round(actor.attack * mult);
      const actorHeroStatic = HEROES_DATABASE[actor.heroId];

      if (actionType === 'attack') {
        damage = baseAttackPower;
        actor.energy = Math.min(100, actor.energy + 20);
        logText = `🗡️ ${actor.username} strikes utilizing physical damage!`;
        gameAudio.attackSwing();
      } 
      else if (actionType === 'skill1') {
        const skill = actorHeroStatic.skills.skill1;
        damage = Math.round(baseAttackPower * skill.damageMultiplier);
        actor.energy = Math.max(0, actor.energy - skill.energyCost);
        logText = `💥 ${actor.username} executes ${skill.name}!`;
        gameAudio.skill1();
      } 
      else if (actionType === 'skill2') {
        const skill = actorHeroStatic.skills.skill2;
        actor.energy = Math.max(0, actor.energy - skill.energyCost);
        logText = `🛡️ ${actor.username} triggers ${skill.name}!`;
        gameAudio.skill2();
        
        if (skill.effectName === 'shield') {
          actor.shieldHp = 40;
        } else if (skill.effectName === 'freeze') {
          target.isFrozen = true;
          damage = Math.round(baseAttackPower * skill.damageMultiplier);
        } else if (skill.effectName === 'stealth') {
          actor.isStealth = true;
        }
      } 
      else if (actionType === 'ultimate') {
        const skill = actorHeroStatic.skills.ultimate;
        damage = Math.round(baseAttackPower * skill.damageMultiplier);
        actor.energy = 0;
        isUlt = true;
        logText = `⚡ ${actor.username} UNLEASHES ULTIMATE: ${skill.name.toUpperCase()}!`;
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 800);
        gameAudio.ultimate();
        gameAudio.voiceLine(actor.heroId, 'ultimate');
      }

      // Resolve damage, shields & defense parameters
      let finalDamage = 0;
      const targetSide = actorId === latestState.playerA.uid ? 'B' : 'A';

      if (damage > 0) {
        let modifiedDmg = target.isStealth ? Math.round(damage / 2) : damage;

        // Apply opponent defense absorption
        modifiedDmg = Math.max(8, modifiedDmg - Math.round(target.defense / 2));

        // Shields absorption
        if (target.shieldHp > 0) {
          if (target.shieldHp >= modifiedDmg) {
            target.shieldHp -= modifiedDmg;
            modifiedDmg = 0;
            logText += ` 🛡️ Shield blocked entire impact!`;
            setShieldFlash(true);
            setTimeout(() => setShieldFlash(false), 600);
            gameAudio.shieldBlock();
          } else {
            modifiedDmg -= target.shieldHp;
            target.shieldHp = 0;
            logText += ` 💥 Shield shattered!`;
            setShieldFlash(true);
            setTimeout(() => setShieldFlash(false), 400);
            gameAudio.shieldShatter();
          }
        }

        target.hp = Math.max(0, target.hp - modifiedDmg);
        finalDamage = modifiedDmg;

        if (modifiedDmg > 0) {
          gameAudio.hit();
        }

        // Track total damage
        const isMeAttacking = actor.uid === me.uid;
        if (isMeAttacking) {
          setTotalDamageDealt(prev => prev + finalDamage);
        } else {
          setTotalDamageTaken(prev => prev + finalDamage);
        }

        // Kill feed
        if (finalDamage > 0) {
          const id = ++killFeedIdRef.current;
          setKillFeed(prev => [...prev.slice(-4), { text: `${actor.username} ⚔️ ${finalDamage} DMG`, id }]);
          setTimeout(() => setKillFeed(prev => prev.filter(f => f.id !== id)), 3000);
        }
      }

      // Always trigger visual feedback (even for 0-damage actions like shield/stealth)
      setDamagePop({
        amount: finalDamage,
        isUlt,
        target: targetSide
      });
      setTimeout(() => setDamagePop(null), 1200);

      // Append Combat logs
      latestState.battleLogs.push({
        id: 'lg_' + Math.random().toString(36).substring(2, 6),
        timestamp: new Date().toISOString(),
        playerId: actor.uid,
        playerName: actor.username,
        actionText: logText + (finalDamage > 0 ? ` Dealt ${finalDamage} HP structural damage.` : ''),
        damageDealt: finalDamage,
        isUltimate: isUlt
      });

      // Append AI taunt caster line
      if (aiCommentary) {
        latestState.battleLogs.push({
          id: 'ai_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          playerId: 'system',
          playerName: 'Caster',
          actionText: `🎤 Commentary: "${aiCommentary}"`
        });
      }

      // Check end states
      if (target.hp <= 0) {
        latestState.status = 'finished';
        latestState.winnerId = actor.uid;
        latestState.loserId = target.uid;
        latestState.battleLogs.push({
          id: 'en_' + Math.random().toString(36).substring(2, 6),
          timestamp: new Date().toISOString(),
          playerId: 'system',
          playerName: 'OVERLORD',
          actionText: `👑 Match ends! ${actor.username} claims total combat victory!`
        });
        // Trigger death explosion on the loser
        gameAudio.death();
        gameAudio.voiceLine(target.heroId, 'death');
        setTimeout(() => {
          const isWinner = actor.uid === me.uid;
          if (isWinner) { gameAudio.victory(); gameAudio.voiceLine(actor.heroId, 'victory'); }
          else { gameAudio.defeat(); }
        }, 1000);
        if (targetSide === 'A') {
          setDeathExplosionA(true);
          setTimeout(() => setDeathExplosionA(false), 2000);
        } else {
          setDeathExplosionB(true);
          setTimeout(() => setDeathExplosionB(false), 2000);
        }
      } else {
        // Cycle active Turn
        latestState.currentTurn = target.uid;
        latestState.turnNumber += 1;
      }

      // Commit update back
      if (actorId === latestState.playerA.uid) {
        latestState.playerA = actor;
        latestState.playerB = target;
      } else {
        latestState.playerB = actor;
        latestState.playerA = target;
      }

      await setDoc(matchRef, latestState);
      setMatch(latestState);
    } catch (err) {
      console.error('Combat execution transaction failed:', err);
    } finally {
      setActionLoading(false);
    }
  };



  const surrenderMatch = async () => {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const opponentUid = isPlayerA ? match.playerB.uid : match.playerA.uid;
      
      await updateDoc(matchRef, {
        status: 'finished',
        winnerId: opponentUid,
        loserId: me.uid
      });

      onFinishBattle('surrender', totalDamageDealt);
    } catch (err) {
      onFinishBattle('surrender', totalDamageDealt);
    }
  };

  const handleFinishRewardClaim = async () => {
    const isWinner = match.winnerId === me.uid;
    onFinishBattle(isWinner ? 'win' : 'loss', totalDamageDealt);
  };

  const activeArena = match?.arena || 'grass';

  // Choose colors / styles depending on active arena
  let arenaLabel = "GRASS MATRIX ARENA";
  let arenaDesc = "Synthetic grass element fields boosting elemental energy rates.";
  let arenaBg = "bg-gradient-to-b from-[#041a12] via-[#080d0c] to-[#010806]";
  let pedStyleA = "border-emerald-500/20 text-emerald-400";
  let pedStyleB = "border-emerald-500/20 text-emerald-400";
  let arenaIcon = "🌿";

  if (activeArena === 'winter') {
    arenaLabel = "WINTER BLIZZARD COLD ARENA";
    arenaDesc = "Sub-zero ice fortress. Ambient frost particles float around cybernetic gladiators.";
    arenaBg = "bg-gradient-to-b from-[#0a1e2d] via-[#070f1a] to-[#03070f]";
    pedStyleA = "border-sky-400/25 text-sky-450";
    pedStyleB = "border-sky-400/25 text-sky-450";
    arenaIcon = "❄️";
  } else if (activeArena === 'volcano') {
    arenaLabel = "VOLCANO MAGMA ARENA";
    arenaDesc = "Core of Volcano. Inferno broadsword strikes vaporize targets.";
    arenaBg = "bg-gradient-to-b from-[#2c0909] via-[#0d0707] to-[#050101]";
    pedStyleA = "border-amber-500/25 text-amber-550";
    pedStyleB = "border-red-500/25 text-red-450";
    arenaIcon = "🌋";
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0A0A0C] text-white select-none overflow-hidden relative z-10">
      {/* Active Battle Heads Up Top display */}
      <div className="flex items-center justify-between p-2 bg-black/90 border-b border-white/5 shrink-0 z-20">
        <div className="flex items-center space-x-1.5">
          <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
          <span className="font-mono text-[11px] text-slate-400">TURN {match.turnNumber} • 1V1</span>
        </div>
        
        {/* Floating Arena Name Badge with glass glow breathing */}
        <motion.div 
          animate={{ 
            boxShadow: [
              '0 0 4px rgba(249,115,22,0.15), inset 0 0 4px rgba(255,255,255,0.05)',
              '0 0 14px rgba(249,115,22,0.35), inset 0 0 8px rgba(249,115,22,0.1)',
              '0 0 4px rgba(249,115,22,0.15), inset 0 0 4px rgba(255,255,255,0.05)'
            ],
            y: [0, -1, 0]
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="flex items-center space-x-1.5 bg-white/5 border border-white/10 px-3 py-0.5 rounded-full backdrop-blur-md"
        >
          <span className="text-sm">{arenaIcon}</span>
          <span className="text-[10px] uppercase font-heading font-black tracking-widest text-orange-200">{arenaLabel}</span>
        </motion.div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMuted(gameAudio.toggleMute())}
            className="px-3 py-1 rounded border border-white/10 bg-white/5 active:bg-white/20 text-white/60 font-heading text-[11px] uppercase cursor-pointer active:scale-[0.95] transition-all"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={surrenderMatch}
            id="btn_surrender"
            className="px-3 py-1 rounded border border-red-500/30 bg-red-500/5 active:bg-red-500/20 text-red-400 font-heading text-[11px] uppercase cursor-pointer active:scale-[0.95] transition-all"
          >
            Surrender
          </button>
        </div>
      </div>

      {/* Main split-row structure */}
      <div className="flex-grow flex flex-row overflow-hidden relative">
        
        {/* LEFT AREA: Interactive 3D Arena Viewport & Logs (SHAKES ON ULTIMATE INSTEAD OF WHOLE SCREEN) */}
        <div className={`flex-grow relative ${arenaBg} flex flex-col justify-between p-2 transition-all duration-500 overflow-hidden ${screenShake ? 'animate-shake' : ''}`}>
          
          {/* Dual HP Esports Broadcaster Header with glass glow */}
          <div className="grid grid-cols-11 gap-2 items-center px-3 py-1.5 bg-black/55 backdrop-blur-md border border-white/5 rounded-xl z-25 relative shrink-0 overflow-hidden shadow-2xl">
            {/* Fluid neon laser stream running on the top border limit */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent overflow-hidden rounded-t-xl z-30">
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
                className="w-1/3 h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              />
            </div>

            {/* My HUD details */}
            <div className="col-span-5 flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-emerald-500/30 flex items-center justify-center text-base shadow-inner shrink-0 relative">
                {me.avatar === 'avatar_1' ? '🔥' : me.avatar === 'avatar_2' ? '❄️' : me.avatar === 'avatar_3' ? '👤' : me.avatar === 'avatar_4' ? '⚡' : me.avatar === 'avatar_5' ? '🐉' : '🔮'}
                {me.isFrozen && <span className="absolute -bottom-1 -right-1 text-[10px] bg-[#38bdf8] text-white px-0.5 rounded">❄️</span>}
              </div>
              <div className="flex-grow min-w-0 space-y-0.5">
                <div className="flex justify-between items-center text-[11px] font-mono leading-tight">
                  <span className="text-emerald-450 font-bold truncate flex items-center gap-1">
                    {me.username} (YOU)
                    {me.isFrozen && <span className="text-[#38bdf8] text-sm">❄️</span>}
                    {me.isStealth && <span className="text-purple-400 text-sm">👻</span>}
                    {me.shieldHp > 0 && <span className="text-cyan-400 text-sm">🛡️</span>}
                  </span>
                  <span className="text-slate-300 font-semibold">{me.hp}/{me.maxHp} HP</span>
                </div>
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 relative overflow-hidden" style={{ width: `${(me.hp / me.maxHp) * 100}%` }}>
                    <motion.div 
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ repeat: Infinity, duration: 4.2, ease: "linear" }}
                      className="absolute inset-y-0 w-7 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </div>
                  {me.shieldHp > 0 && (
                    <div className="absolute right-0 top-0 bottom-0 bg-sky-450 opacity-60 animate-pulse" style={{ width: `${Math.min(100, (me.shieldHp / me.maxHp) * 100)}%` }} />
                  )}
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${me.energy}%` }} />
                </div>
              </div>
            </div>

            {/* VS divider spacer */}
            <div className="col-span-1 text-center font-heading text-sm font-black italic text-amber-500 select-none">
              VS
            </div>

            {/* Opponent HUD details */}
            <div className="col-span-5 flex items-center space-x-2 flex-row-reverse space-x-reverse text-right">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-red-500/30 flex items-center justify-center text-base shadow-inner shrink-0 relative">
                {opponent.avatar === 'avatar_1' ? '🔥' : opponent.avatar === 'avatar_2' ? '❄️' : opponent.avatar === 'avatar_3' ? '👤' : opponent.avatar === 'avatar_4' ? '⚡' : opponent.avatar === 'avatar_5' ? '🐉' : '🔮'}
                {opponent.isFrozen && <span className="absolute -bottom-1 -right-1 text-[10px] bg-[#38bdf8] text-white px-0.5 rounded">❄️</span>}
              </div>
              <div className="flex-grow min-w-0 space-y-0.5">
                <div className="flex justify-between flex-row-reverse items-center text-[11px] font-mono leading-tight">
                  <span className="text-red-400 font-bold truncate flex items-center gap-1">
                    {opponent.isFrozen && <span className="text-[#38bdf8] text-sm">❄️</span>}
                    {opponent.isStealth && <span className="text-purple-400 text-sm">👻</span>}
                    {opponent.shieldHp > 0 && <span className="text-cyan-400 text-sm">🛡️</span>}
                    {opponent.username}
                  </span>
                  <span className="text-slate-300 font-semibold">{opponent.hp}/{opponent.maxHp} HP</span>
                </div>
                <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                  <div className="h-full bg-gradient-to-r from-red-550 to-orange-500 transition-all duration-300 relative overflow-hidden" style={{ width: `${(opponent.hp / opponent.maxHp) * 100}%` }}>
                    <motion.div 
                      animate={{ x: ['-100%', '300%'] }}
                      transition={{ repeat: Infinity, duration: 4.2, ease: "linear", delay: 1.0 }}
                      className="absolute inset-y-0 w-7 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  </div>
                  {opponent.shieldHp > 0 && (
                    <div className="absolute right-0 top-0 bottom-0 bg-sky-450 opacity-60 animate-pulse" style={{ width: `${Math.min(100, (opponent.shieldHp / opponent.maxHp) * 100)}%` }} />
                  )}
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${opponent.energy}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Weather Spark elements */}
          {activeArena === 'winter' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              <div className="absolute inset-0 flex flex-wrap justify-around opacity-40">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-white rounded-full blur-[1px]"
                    animate={{
                      y: ['-5vh', '60vh'],
                      x: [0, Math.sin(i) * 20],
                      opacity: [0, 0.8, 0]
                    }}
                    transition={{
                      duration: 5 + (i % 3),
                      repeat: Infinity,
                      delay: i * 0.4,
                      ease: "linear"
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeArena === 'volcano' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              <div className="absolute inset-0 flex flex-wrap justify-around items-end opacity-60">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1.5 bg-gradient-to-t from-yellow-450 to-orange-500 rounded-full blur-[0.5px]"
                    animate={{
                      y: ['10vh', '-55vh'],
                      x: [0, Math.cos(i) * 18],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 4 + (i % 3),
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: "easeOut"
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {activeArena === 'grass' && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
              <div className="absolute inset-0 flex flex-wrap justify-around items-end opacity-40">
                {[...Array(10)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1 bg-emerald-450 rounded-full blur-[0.8px]"
                    animate={{
                      y: ['10vh', '-50vh'],
                      x: [0, Math.sin(i) * 20],
                      opacity: [0, 0.7, 0]
                    }}
                    transition={{
                      duration: 6 + (i % 3),
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "linear"
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Elemental hit flash overlay */}
          {hitFlash && (
            <div className={`absolute inset-0 z-15 pointer-events-none transition-opacity duration-300 ${
              hitFlash === 'A' 
                ? (opponent.heroId === 'fire_warrior' ? 'bg-orange-500/20' : opponent.heroId === 'ice_mage' ? 'bg-cyan-400/20' : 'bg-purple-500/20')
                : (me.heroId === 'fire_warrior' ? 'bg-orange-500/20' : me.heroId === 'ice_mage' ? 'bg-cyan-400/20' : 'bg-purple-500/20')
            }`} />
          )}

          {/* Death explosion overlay */}
          {(deathExplosionA || deathExplosionB) && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 rounded-full border-4 border-white/30 animate-ping absolute" />
              <div className="w-32 h-32 rounded-full border-2 border-yellow-400/40 animate-ping animation-delay-150 absolute" />
              {Array.from({length: 12}).map((_, i) => (
                <div key={i} className="absolute w-1 h-1 bg-white rounded-full animate-ping" 
                  style={{ left: `${50 + (Math.cos(i * 0.5) * 40)}%`, top: `${50 + (Math.sin(i * 0.5) * 40)}%`, animationDelay: `${i * 0.08}s`, opacity: 0.6 }}
                />
              ))}
            </div>
          )}

          {/* Shield flash overlay */}
          {shieldFlash && (
            <div className="absolute inset-0 z-15 pointer-events-none bg-cyan-400/15 animate-pulse" />
          )}

          {/* 3D HERO VIEWPORTS SHOWDOWN BACKDROP */}
          <div className="absolute inset-0 z-0 h-full w-full pointer-events-none flex items-center justify-between px-0 overflow-hidden">
            {/* Player A (Me) 3D Viewport - FACING RIGHT, BIGGER */}
            <div className="w-[55%] h-[120%] relative -ml-4">
              <div className="absolute inset-0 flex items-center justify-center scale-110">
                <ThreeHeroView 
                  heroId={me.heroId} 
                  skin={me.skin || 'default'} 
                  isAnimated={true} 
                  actionState={playerAVisualState} 
                  facing="right"
                  sparkHit={sparkHitA}
                  deathExplosion={deathExplosionA}
                />
              </div>
              {/* Shield visual ring */}
              {me.shieldHp > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-cyan-400/40 animate-pulse pointer-events-none z-10" />
              )}
              {/* Pedestal indicator */}
              <div className={`absolute bottom-[24%] left-1/2 -translate-x-1/2 bg-black/60 border ${pedStyleA} px-2 py-0.5 rounded-full text-[8px] font-mono font-bold z-10 flex items-center gap-1`}>
                {me.shieldHp > 0 && <span className="text-cyan-400 text-[10px]">🛡️</span>}
                {me.username.toUpperCase()}
              </div>
            </div>

            {/* Subtle central split divider layout element */}
            <div className="w-[1px] h-14 bg-gradient-to-b from-transparent via-white/5 to-transparent relative z-20">
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-black italic bg-[#0A0A0C] border border-white/5 px-1 rounded text-orange-400 shadow-xl">1V1</span>
            </div>

            {/* Player B (Opponent) 3D Viewport - FACING LEFT, BIGGER */}
            <div className="w-[55%] h-[120%] relative -mr-4">
              <div className="absolute inset-0 flex items-center justify-center scale-110">
                <ThreeHeroView 
                  heroId={opponent.heroId} 
                  skin={opponent.skin || 'default'} 
                  isAnimated={true} 
                  actionState={playerBVisualState} 
                  facing="left"
                  sparkHit={sparkHitB}
                  deathExplosion={deathExplosionB}
                />
              </div>
              {/* Shield visual ring */}
              {opponent.shieldHp > 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-cyan-400/40 animate-pulse pointer-events-none z-10" />
              )}
              {/* Pedestal indicator */}
              <div className={`absolute bottom-[24%] left-1/2 -translate-x-1/2 bg-black/60 border ${pedStyleB} px-2 py-0.5 rounded-full text-[8px] font-mono font-bold z-10 flex items-center gap-1`}>
                {opponent.shieldHp > 0 && <span className="text-cyan-400 text-[10px]">🛡️</span>}
                {opponent.username.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Floating damage numbers projection overlay */}
          <AnimatePresence>
            {damagePop && (
              <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 z-30 font-heading font-black text-3xl animate-float-damage pointer-events-none ${
                damagePop.amount === 0 ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]' : damagePop.isUlt ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.7)]' : 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
              }`}>
                {damagePop.amount > 0 ? `-${damagePop.amount}` : '🛡️ BLOCKED!'}
              </div>
            )}
          </AnimatePresence>

          {/* Kill feed */}
          <div className="absolute top-2 right-2 z-30 space-y-0.5 pointer-events-none">
            {killFeed.map(f => (
              <div key={f.id} className="text-[9px] font-mono text-red-400 bg-black/60 px-2 py-0.5 rounded-lg border border-white/5 animate-fade-in">
                {f.text}
              </div>
            ))}
          </div>

          {/* Floating emote display */}
          <AnimatePresence>
            {currentEmote && (
              <motion.div
                key={currentEmote.side + String(Math.random())}
                initial={{ scale: 0, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`absolute top-1/3 z-30 pointer-events-none text-4xl ${
                  currentEmote.side === 'A' ? 'left-[20%]' : 'right-[20%]'
                }`}
              >
                {currentEmote.emoji}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Turn status indicator floating bar with premium esports-ready visual 5s countdown */}
          <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center space-y-1 bg-black/40 backdrop-blur-md px-5 py-1.5 rounded-2xl border border-white/5 shadow-2xl">
            {match.status === 'finished' ? (
              <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-[11px] font-heading font-black text-yellow-300 tracking-widest uppercase">MATCH CONCLUDED</span>
            ) : isMyTurn ? (
              <div className="flex flex-col items-center space-y-1">
                <motion.div 
                  initial={{ scale: 0.95 }}
                  animate={timeLeft <= 2 ? { scale: [0.95, 1.15, 0.95], color: ['#fff', '#ef4444', '#fff'] } : { scale: [0.95, 1.05, 0.95] }}
                  transition={{ repeat: Infinity, duration: timeLeft <= 2 ? 0.6 : 1.8 }}
                  className={`px-3 py-0.5 rounded-full text-[11px] font-heading font-black tracking-widest uppercase shadow-lg ${
                    timeLeft <= 2 
                      ? 'bg-red-650/95 border border-red-500 text-white shadow-red-600/30' 
                      : 'bg-orange-600/95 border border-orange-400 text-white shadow-orange-600/20'
                  }`}
                >
                  🔥 YOUR TURN: {timeLeft}s LEFT
                </motion.div>
                {/* Fluid neon countdown energy strip */}
                <div className="w-28 h-1 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
                  <div 
                    style={{ width: `${(timeLeft / 5) * 100}%` }}
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                      timeLeft <= 2 
                        ? 'bg-gradient-to-r from-red-605 to-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)] animate-pulse' 
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.5)]'
                    }`}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-1">
                <span className="px-3 py-0.5 bg-black/60 border border-white/10 rounded-full text-[10px] font-mono text-cyan-300 tracking-wider">
                  ⏱️ OPPONENT: {timeLeft}s
                </span>
                {/* Fluid countdown strip for opponent */}
                <div className="w-28 h-1 bg-black/60 rounded-full overflow-hidden border border-white/5 relative">
                  <div 
                    style={{ width: `${(timeLeft / 5) * 100}%` }}
                    className="h-full transition-all duration-1000 ease-linear rounded-full bg-gradient-to-r from-cyan-600/60 to-blue-500/80"
                  />
                </div>
              </div>
            )}
          </div>

          {/* LEFT BOTTOM OVERLAY: Compact combat logs feed */}
          <div className="h-10 bg-black/70 backdrop-blur-md border border-white/5 rounded-lg p-1 overflow-y-auto relative z-20 shrink-0">
            <div className="space-y-0.5">
              {match.battleLogs.slice(-4).map((log) => {
                const isCaster = log.playerName === 'Caster';
                return (
                  <div key={log.id} className="text-[10px] font-mono leading-tight">
                    {isCaster ? (
                      <span className="text-yellow-400 font-bold truncate block">{log.actionText}</span>
                    ) : (
                      <span className="text-slate-350 truncate block">
                        <span className="text-slate-300 font-bold">{log.playerName}</span>: {log.actionText}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

        {/* RIGHT AREA: Cyber Controller Action Deck console */}
        <div className="w-60 sm:w-72 border-l border-white/10 bg-[#050508] p-2.5 flex flex-col justify-between shrink-0 relative z-20 select-none">
          
          <div className="space-y-1">
            <div className="flex items-center justify-between border-b border-white/5 pb-1">
              <span className="text-[11px] font-black tracking-widest font-heading text-slate-400 uppercase">COMBAT</span>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/10 animate-pulse">READY</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono leading-tight">Select weapon system</p>
          </div>

          {/* Gamepad action command matrix triggers */}
          <div className="flex flex-col space-y-2 my-auto z-10">
            {/* Action 1: Normal Attack */}
            <button
              onClick={() => executeCombatMove(me.uid, 'attack')}
              disabled={!isMyTurn || me.isFrozen || actionLoading}
              id="btn_arcade_attack"
              className="group relative flex items-center justify-between px-4 h-12 rounded-xl border border-white/10 bg-white/[0.04] active:bg-white/20 active:scale-[0.97] disabled:opacity-20 text-slate-100 cursor-pointer transition-all"
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-lg bg-black/40 w-8 h-8 rounded-lg flex items-center justify-center">🗡️</span>
                <div className="text-left">
                  <span className="text-[11px] font-heading font-black block uppercase text-white">Normal Attack</span>
                  <span className="text-[9px] text-slate-400 font-mono">Cost: 0 Energy</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-500 border border-white/10 bg-black/50 px-1.5 py-0.5 rounded group-active:text-white">A</span>
            </button>

            {/* Action 2: Skill 1 (Offensive Focus) */}
            <button
              onClick={() => executeCombatMove(me.uid, 'skill1')}
              disabled={!isMyTurn || me.isFrozen || me.energy < myHeroStatic.skills.skill1.energyCost || actionLoading}
              id="btn_arcade_skill1"
              className="group relative flex items-center justify-between px-4 h-12 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] active:bg-orange-500/20 active:scale-[0.97] disabled:opacity-20 text-slate-100 cursor-pointer transition-all"
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-lg bg-[#ea580c]/10 w-8 h-8 rounded-lg flex items-center justify-center text-orange-400">⚔️</span>
                <div className="text-left">
                  <span className="text-[11px] font-heading font-bold block uppercase text-orange-300 truncate max-w-[130px]">{myHeroStatic.skills.skill1.name}</span>
                  <span className="text-[9px] text-orange-400 font-mono">Cost: {myHeroStatic.skills.skill1.energyCost} Energy</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-orange-400 border border-orange-500/10 bg-black/50 px-1.5 py-0.5 rounded">X</span>
            </button>

            {/* Action 3: Skill 2 (Defensive Field) */}
            <button
              onClick={() => executeCombatMove(me.uid, 'skill2')}
              disabled={!isMyTurn || me.isFrozen || me.energy < myHeroStatic.skills.skill2.energyCost || actionLoading}
              id="btn_arcade_skill2"
              className="group relative flex items-center justify-between px-4 h-12 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] active:bg-sky-500/20 active:scale-[0.97] disabled:opacity-20 text-slate-100 cursor-pointer transition-all"
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-lg bg-sky-600/15 w-8 h-8 rounded-lg flex items-center justify-center text-sky-400">🛡️</span>
                <div className="text-left">
                  <span className="text-[11px] font-heading font-bold block uppercase text-sky-300 truncate max-w-[130px]">{myHeroStatic.skills.skill2.name}</span>
                  <span className="text-[9px] text-sky-400 font-mono">Cost: {myHeroStatic.skills.skill2.energyCost} Energy</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-sky-400 border border-sky-400/10 bg-black/50 px-1.5 py-0.5 rounded">Y</span>
            </button>

            {/* Action 4: Ultimate Ultimate Ability */}
            <button
              onClick={() => executeCombatMove(me.uid, 'ultimate')}
              disabled={!isMyTurn || me.isFrozen || me.energy < 100 || actionLoading}
              id="btn_arcade_ultimate"
              className="group relative flex items-center justify-between px-4 h-14 rounded-xl border border-violet-500/40 bg-violet-500/10 active:bg-violet-500/25 active:scale-[0.97] disabled:opacity-20 text-violet-200 cursor-pointer overflow-hidden transition-all"
            >
              {isMyTurn && me.energy >= 100 && (
                <span className="absolute inset-0 bg-gradient-to-r from-red-500/15 via-yellow-500/10 to-indigo-500/15 animate-pulse" />
              )}
              <div className="flex items-center space-x-2.5 z-10">
                <span className="text-lg bg-violet-600/20 w-8 h-8 rounded-lg flex items-center justify-center text-yellow-300 animate-bounce">🔥</span>
                <div className="text-left">
                  <span className="text-[11px] font-heading font-black block tracking-wider uppercase text-yellow-300">ULTIMATE POWER</span>
                  <span className="text-[9px] text-violet-350 font-mono">Cost: 100 Energy (Ready)</span>
                </div>
              </div>
              <span className="text-[11px] font-mono text-violet-300 border border-violet-500/20 bg-black/50 px-1.5 py-0.5 rounded z-10">B</span>
            </button>
          </div>

          <div className="border-t border-white/5 pt-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isDuo && (
                <button onClick={async () => {
                  if (voiceOn) { await leaveVoiceChannel(); setVoiceOn(false); }
                  else { const ok = await joinVoiceChannel(`duo_${matchId.split('_vs_')[0].replace('duo_match_', '')}`, profile.uid); if (ok) setVoiceOn(true); }
                }} className={`p-1.5 rounded-lg cursor-pointer active:scale-90 transition-all ${voiceOn ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 border border-white/10 text-slate-500'}`}>
                  {voiceOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                </button>
              )}
              <button
                onClick={() => setEmotePickerOpen(true)}
                className="text-sm bg-white/5 border border-white/10 px-2 py-1 rounded-lg cursor-pointer active:scale-90 transition-all"
              >
                😄
              </button>
              <span className="text-[8px] font-mono text-slate-500">DMG: <span className="text-red-400">{totalDamageDealt}</span> / <span className="text-slate-400">{totalDamageTaken}</span></span>
            </div>
            {isDuo && <span className="text-[8px] font-mono text-emerald-500 block mb-1"><Users className="w-2.5 h-2.5 inline mr-1" />DUO MATCH</span>}
            {me.isFrozen ? (
              <span className="text-[10px] text-sky-400 font-mono block animate-pulse uppercase">🛡️ SYSTEMS FROZEN</span>
            ) : isMyTurn ? (
              <span className="text-[10px] text-emerald-400 font-mono block uppercase">● NET LINK SECURE ({timeLeft}s)</span>
            ) : (
              <span className="text-[10px] text-slate-500 font-mono block uppercase">⏱️ INBOUND... ({timeLeft}s)</span>
            )}
          </div>

        </div>

      </div>

      {/* MATCH EXECUTED OVERLAY DIALOG */}
      {match.status === 'finished' && (
        <div className="fixed inset-0 h-full w-full flex items-center justify-center bg-black/80 z-50 p-4 select-none backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-slate-950 border border-white/10 rounded-2xl p-6 text-center space-y-4 max-w-sm w-full shadow-2xl relative"
          >
            <div className="absolute top-[-5%] left-[-5%] w-[110%] h-[110%] bg-amber-500/5 rounded-full blur-[40px] pointer-events-none z-0"></div>
            
            <div className="relative z-10 space-y-3">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto animate-bounce drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
              
              <h4 className="font-heading text-lg font-black tracking-widest uppercase text-yellow-450 border-b border-white/5 pb-1">
                COMBAT RESOLVED
              </h4>
              
              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                {match.winnerId === me.uid ? (
                  (() => {
                    const rpGain = 25 + Math.max(0, Math.floor((1500 - profile.rankPoints) / 100));
                    return <span className="text-emerald-400 block font-black text-sm">🏆 VICTORY GAINED (+{rpGain} RP)</span>;
                  })()
                ) : match.loserId === me.uid ? (
                  (() => {
                    const rpLoss = Math.max(10, Math.floor(15 - (profile.rankPoints / 500)));
                    return <span className="text-red-500 block font-black text-sm">💀 DEFEATED (-{rpLoss} RP)</span>;
                  })()
                ) : (
                  (() => {
                    const rpLoss = Math.max(20, Math.floor(25 - (profile.rankPoints / 400)));
                    return <span className="text-red-500 block font-black text-sm">🏳️ SURRENDERED (-{rpLoss} RP)</span>;
                  })()
                )}
              </p>
              <p className="text-[9px] font-mono text-slate-500">
                League: <span className="font-bold text-amber-400">{profile.league}</span> • RP: <span className="font-bold">{profile.rankPoints}</span>
              </p>

              <p className="text-[10px] text-slate-400 leading-tight">
                Cyber arena matrices stabilized successfully. Return to the castle gate to upgrade your bots or challenge more foes.
              </p>

              <button
                onClick={handleFinishRewardClaim}
                id="btn_battle_reward_claim"
                className="w-full h-9 flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 cursor-pointer font-heading font-black text-[10px] tracking-widest text-white active:scale-98 transition-all shadow-xl"
              >
                RETURN TO CASTLE LOBBY
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Emote picker */}
      {emotePickerOpen && (
        <EmoteSelector
          ownedPremiumEmoteIds={[]}
          onSelect={(emote) => {
            setCurrentEmote({ emoji: emote.emoji, side: 'A' });
            setTimeout(() => setCurrentEmote(null), 2000);
          }}
          onClose={() => setEmotePickerOpen(false)}
        />
      )}

    </div>
  );
}
