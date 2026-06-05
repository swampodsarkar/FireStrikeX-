import { useState, useEffect, ReactNode } from 'react';
import { motion } from 'motion/react';
import { Swords, Flame, Snowflake, Skull } from 'lucide-react';
import { HEROES_DATABASE, UserHero, PlayerProfile, StaticHero } from '../types';
import ThreeHeroView from './ThreeHeroView';
import { gameAudio } from '../lib/gameAudio';

interface HeroSelectScreenProps {
  profile: PlayerProfile;
  heroes: UserHero[];
  onStartBattle: (selectedHeroId: string, selectedSkin: string) => void;
  onBack: () => void;
  isRanked: boolean;
}

export default function HeroSelectScreen({
  profile,
  heroes,
  onStartBattle,
  onBack,
  isRanked
}: HeroSelectScreenProps) {
  const [selectedHeroId, setSelectedHeroId] = useState(heroes[0]?.heroId || 'fire_warrior');
  const [countdown, setCountdown] = useState(10);
  const [confirmed, setConfirmed] = useState(false);

  const selectedHero = heroes.find(h => h.heroId === selectedHeroId);
  const selectedSkin = selectedHero?.selectedSkin || 'default';
  const staticHero: StaticHero = HEROES_DATABASE[selectedHeroId];

  // Countdown
  useEffect(() => {
    if (confirmed) return;
    if (countdown <= 0) {
      setConfirmed(true);
      setTimeout(() => onStartBattle(selectedHeroId, selectedSkin), 500);
      return;
    }
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
      if (countdown <= 4) gameAudio.countdownTick();
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, confirmed, selectedHeroId, selectedSkin, onStartBattle]);

  const handleConfirm = () => {
    if (confirmed) return;
    setConfirmed(true);
    gameAudio.buttonClick();
    setTimeout(() => onStartBattle(selectedHeroId, selectedSkin), 800);
  };

  const heroIcons: Record<string, ReactNode> = {
    fire_warrior: <Flame className="w-3 h-3" />,
    ice_mage: <Snowflake className="w-3 h-3" />,
    shadow_assassin: <Skull className="w-3 h-3" />,
  };

  const heroAccents: Record<string, string> = {
    fire_warrior: 'from-orange-500 to-red-600',
    ice_mage: 'from-cyan-400 to-blue-600',
    shadow_assassin: 'from-purple-500 to-fuchsia-700',
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0A0A0C] text-white select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 bg-black/90 border-b border-white/5 shrink-0 z-20">
        <button
          onClick={onBack}
          className="px-2.5 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/15 text-slate-400 font-heading text-[9px] uppercase cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase">Pick Your Champion</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-full ${
            isRanked
              ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
              : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
          }`}>
            {isRanked ? '🏆 RANKED' : '⚔️ CLASSIC'}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* LEFT: 3D Hero Preview */}
        <div className="flex-1 relative min-h-[300px] md:min-h-0 bg-gradient-to-b from-transparent via-black/30 to-black/60">
          <div className="absolute inset-0 flex items-center justify-center">
            <ThreeHeroView
              heroId={selectedHeroId}
              skin={selectedSkin}
              isAnimated={true}
              isLobby={true}
            />
          </div>

          {/* Hero name overlay */}
          <div className="absolute bottom-4 left-4 z-10">
            <h2 className={`text-lg font-heading font-black bg-gradient-to-r ${heroAccents[selectedHeroId]} bg-clip-text text-transparent drop-shadow-lg`}>
              {staticHero.name}
            </h2>
            <p className="text-[10px] font-mono text-slate-400">{staticHero.heroClass} • LV.{selectedHero?.level || 1}</p>
          </div>
        </div>

        {/* RIGHT: Hero Selection Panel */}
        <div className="w-full md:w-80 lg:w-96 bg-black/60 border-l border-white/5 flex flex-col overflow-hidden">
          {/* Hero list */}
          <div className="p-3 border-b border-white/5">
            <p className="text-[8px] font-heading font-black tracking-widest text-slate-500 uppercase mb-2">Choose Hero</p>
            <div className="grid grid-cols-3 gap-2">
              {heroes.filter(h => h.unlocked).map(h => {
                const s = HEROES_DATABASE[h.heroId];
                const isSelected = h.heroId === selectedHeroId;
                return (
                  <motion.button
                    key={h.heroId}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { if (!confirmed) { setSelectedHeroId(h.heroId); gameAudio.buttonClick(); } }}
                    className={`relative p-2 rounded-lg border transition-all cursor-pointer text-center ${
                      isSelected
                        ? `border-amber-500/60 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]`
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/10 hover:border-white/20'
                    } ${confirmed ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-center mb-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        isSelected ? 'bg-gradient-to-br from-amber-500/30 to-orange-600/30' : 'bg-slate-900'
                      }`}>
                        {heroIcons[h.heroId] || '⚔️'}
                      </div>
                    </div>
                    <p className={`text-[8px] font-heading font-black truncate ${isSelected ? 'text-amber-300' : 'text-slate-400'}`}>
                      {s.name.split(' ')[0]}
                    </p>
                    <p className={`text-[6px] font-mono ${isSelected ? 'text-amber-500/60' : 'text-slate-600'}`}>
                      {s.heroClass}
                    </p>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                        <span className="text-[6px]">✓</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Stats comparison */}
          <div className="p-3 border-b border-white/5 space-y-1.5 flex-grow">
            <p className="text-[8px] font-heading font-black tracking-widest text-slate-500 uppercase mb-2">Hero Stats</p>
            {([
              { label: 'HP', value: staticHero.baseHp, max: 150, color: 'bg-emerald-500' },
              { label: 'ATK', value: staticHero.baseAttack, max: 35, color: 'bg-rose-500' },
              { label: 'DEF', value: staticHero.baseDefense, max: 20, color: 'bg-cyan-500' },
              { label: 'SPD', value: staticHero.baseSpeed, max: 18, color: 'bg-amber-500' },
            ] as const).map(stat => (
              <div key={stat.label}>
                <div className="flex justify-between text-[9px] font-mono">
                  <span className="text-slate-400">{stat.label}</span>
                  <span className="font-bold text-white">{stat.value}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className={`h-full ${stat.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(stat.value / stat.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Skills preview */}
          <div className="p-3 border-b border-white/5 space-y-1">
            <p className="text-[8px] font-heading font-black tracking-widest text-slate-500 uppercase mb-1">Skills</p>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-orange-400" />
                <span className="text-[7px] font-mono font-bold text-slate-300">{staticHero.skills.skill1.name}</span>
                <span className="text-[6px] font-mono text-orange-400/60">{staticHero.skills.skill1.energyCost}E</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-violet-400" />
                <span className="text-[7px] font-mono font-bold text-slate-300">{staticHero.skills.skill2.name}</span>
                <span className="text-[6px] font-mono text-violet-400/60">{staticHero.skills.skill2.energyCost}E</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-yellow-400" />
                <span className="text-[7px] font-mono font-bold text-yellow-300">{staticHero.skills.ultimate.name}</span>
                <span className="text-[6px] font-mono text-yellow-400/60">ULT</span>
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <div className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <div className="text-[8px] font-mono text-slate-500 mb-0.5 text-center">
                  {confirmed ? 'LOCKED IN!' : `Auto-pick in ${countdown}s`}
                </div>
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full"
                    initial={{ width: '100%' }}
                    animate={{ width: confirmed ? '100%' : `${(countdown / 10) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirm}
                disabled={confirmed}
                className={`px-4 py-2 rounded-lg font-heading font-black text-[10px] uppercase tracking-wider cursor-pointer flex items-center gap-1 ${
                  confirmed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 hover:shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                }`}
              >
                <Swords className="w-3 h-3" />
                {confirmed ? 'READY!' : 'FIGHT!'}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
