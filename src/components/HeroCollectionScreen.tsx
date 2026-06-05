import { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Swords, Sparkles, Footprints, Zap, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { PlayerProfile, UserHero, HEROES_DATABASE, StaticHero } from '../types';
import { db, doc, setDoc, updateDoc } from '../lib/firebase';

interface HeroCollectionScreenProps {
  profile: PlayerProfile;
  heroes: UserHero[];
  onUpdateProfile: (updated: Partial<PlayerProfile>) => void;
  onUpdateHero: (updated: UserHero) => void;
  onBack: () => void;
}

export default function HeroCollectionScreen({ profile, heroes, onUpdateProfile, onUpdateHero, onBack }: HeroCollectionScreenProps) {
  const [selectedHeroId, setSelectedHeroId] = useState<string>('fire_warrior');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const displaySuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  const displayError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 2500);
  };

  const currentStatic: StaticHero = HEROES_DATABASE[selectedHeroId];
  const userHero: UserHero = heroes.find(h => h.heroId === selectedHeroId) || {
    heroId: selectedHeroId,
    level: 1,
    unlocked: true,
    selectedSkin: 'default',
    unlockedSkins: ['default']
  };

  const upgradeCost = userHero.level * 200;

  // Calculstats with levels: +10% per level up
  const levelMult = 1 + (userHero.level - 1) * 0.1;
  const hp = Math.round(currentStatic.baseHp * levelMult);
  const attack = Math.round(currentStatic.baseAttack * levelMult);
  const defense = Math.round(currentStatic.baseDefense * levelMult);
  const speed = currentStatic.baseSpeed; // Speed static

  const handleUpgrade = async () => {
    if (profile.coins < upgradeCost) {
      displayError('Insufficient Coins to train this hero archetype!');
      return;
    }

    try {
      const nextLevel = userHero.level + 1;
      const newCoins = profile.coins - upgradeCost;

      // 1. Update coins
      const playerRef = doc(db, 'players', profile.uid);
      await updateDoc(playerRef, { coins: newCoins });
      onUpdateProfile({ coins: newCoins });

      // 2. Update hero level
      const heroRef = doc(db, 'players', profile.uid, 'heroes', selectedHeroId);
      const updatedHero: UserHero = {
        ...userHero,
        level: nextLevel
      };
      await setDoc(heroRef, updatedHero, { merge: true });
      onUpdateHero(updatedHero);

      displaySuccess(`${currentStatic.name} upgraded to Level ${nextLevel}!`);
    } catch (err) {
      console.error(err);
      displayError('Failed to record level upgrade.');
    }
  };

  const handleEquipSkin = async (skinId: string) => {
    try {
      const heroRef = doc(db, 'players', profile.uid, 'heroes', selectedHeroId);
      const updatedHero: UserHero = {
        ...userHero,
        selectedSkin: skinId
      };
      await setDoc(heroRef, updatedHero, { merge: true });
      onUpdateHero(updatedHero);
      displaySuccess(`Equipped ${skinId === 'default' ? 'Default' : skinId.replace('skin_', '').replace('_', ' ')} skin!`);
    } catch (err) {
      console.error(err);
      displayError('Failed to equip selected skin.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative z-10 overflow-hidden">
      {/* Upper bar */}
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/5 shadow-md">
        <button
          onClick={onBack}
          id="btn_hero_col_back"
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors"
        >
          Back
        </button>
        <span className="font-heading font-black text-xs uppercase tracking-widest text-slate-100">Hero Chamber</span>
        <div className="px-3 py-1 bg-black/30 rounded-full border border-white/10 flex items-center space-x-1 font-mono text-[10px] text-yellow-500 font-bold">
          <span>🪙 {profile.coins}</span>
        </div>
      </div>

      {/* Main Grid split */}
      <div className="flex-grow flex flex-col md:flex-row p-4 gap-4 overflow-y-auto pb-20">
        
        {/* Left Side: Archetypes selection & stats */}
        <div className="w-full md:w-1/3 flex flex-col gap-3">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Select Hero</label>
          <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
            {Object.keys(HEROES_DATABASE).map((hId) => {
              const staticData = HEROES_DATABASE[hId];
              const isActive = selectedHeroId === hId;
              const lvl = heroes.find(h => h.heroId === hId)?.level || 1;

              return (
                <button
                  key={hId}
                  id={`btn_roster_select_${hId}`}
                  onClick={() => setSelectedHeroId(hId)}
                  className={`relative flex flex-col items-start justify-between p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                    isActive ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20' : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <h4 className={`font-heading text-xs font-bold leading-none ${staticData.textColor}`}>{staticData.name}</h4>
                    <span className="text-[9px] text-slate-400 font-mono">CLASS: {staticData.heroClass}</span>
                  </div>
                  <div className="mt-2 text-[8px] px-1.5 py-0.5 rounded-md bg-black/40 border border-white/10 font-mono text-slate-350">
                    Lvl {lvl}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active stats display panel */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
            <h4 className="font-heading text-[10px] font-black uppercase text-slate-200 tracking-wider">Combat Attributes</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 h-7 w-7 flex items-center justify-center bg-red-950/20 text-red-400 rounded-lg border border-red-900/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] text-slate-400 font-bold leading-none uppercase">HEALTH</p>
                  <p className="font-mono text-xs font-extrabold text-[#fca5a5] mt-1 leading-none">{hp}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="p-1.5 h-7 w-7 flex items-center justify-center bg-orange-950/20 text-orange-400 rounded-lg border border-orange-900/30">
                  <Swords className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] text-slate-400 font-bold leading-none uppercase">ATTACK</p>
                  <p className="font-mono text-xs font-extrabold text-[#fdba74] mt-1 leading-none">{attack}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="p-1.5 h-7 w-7 flex items-center justify-center bg-zinc-900/40 text-[#a1a1aa] rounded-lg border border-zinc-800">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] text-slate-400 font-bold leading-none uppercase">DEFENSE</p>
                  <p className="font-mono text-xs font-extrabold text-slate-200 mt-1 leading-none">{defense}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="p-1.5 h-7 w-7 flex items-center justify-center bg-sky-950/20 text-sky-400 rounded-lg border border-sky-900/30">
                  <Footprints className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] text-slate-400 font-bold leading-none uppercase">SPEED</p>
                  <p className="font-mono text-xs font-extrabold text-[#7dd3fc] mt-1 leading-none">{speed}</p>
                </div>
              </div>
            </div>

            {/* Level up trigger */}
            <div className="border-t border-white/5 pt-3 flex flex-col space-y-2">
              <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
                <span>TRAINING COST:</span>
                <span className="text-yellow-400 font-bold">🪙 {upgradeCost}</span>
              </div>
              <button
                onClick={handleUpgrade}
                id="btn_collection_upgrade"
                className="w-full h-9 flex items-center justify-center space-x-1 rounded-lg bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 hover:from-amber-400 hover:to-orange-500 cursor-pointer font-heading font-black italic tracking-widest text-[10px] text-white active:scale-98 transition-all"
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>TRAIN ARCHETYPE</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Skills details & selection of skins */}
        <div className="flex-grow flex flex-col gap-4">
          {success && (
            <div className="p-2 bg-emerald-950/30 border border-emerald-800 text-emerald-200 text-xs rounded-xl font-bold uppercase text-center shrink-0">
              {success}
            </div>
          )}
          {error && (
            <div className="p-2 bg-red-950/30 border border-red-800 text-red-150 text-xs rounded-xl font-bold uppercase text-center shrink-0">
              {error}
            </div>
          )}

          {/* Description banner */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
            <span className={`text-[9px] font-mono tracking-widest uppercase font-bold leading-none ${currentStatic.textColor}`}>{currentStatic.heroClass} Archetype</span>
            <h3 className="font-heading text-lg font-black italic leading-none uppercase mt-1">{currentStatic.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed pt-1.5">{currentStatic.description}</p>
          </div>

          {/* Skills specification */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3 flex-grow">
            <h4 className="font-heading text-[10px] font-black uppercase text-slate-200 tracking-wider">Tactical Skills Map</h4>
            <div className="space-y-2.5">
              <div className="p-2.5 bg-black/30 border border-white/5 rounded-xl flex items-start gap-2.5">
                <span className="text-sm p-1 rounded-lg shrink-0 border border-white/5 bg-black/40">⚔️</span>
                <div className="space-y-0.5">
                  <h5 className="font-heading text-xs font-bold text-slate-100 leading-none">{currentStatic.skills.skill1.name}</h5>
                  <p className="text-[10px] text-slate-400">{currentStatic.skills.skill1.description}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-orange-950/20 text-[8px] font-mono font-bold text-orange-400 whitespace-nowrap">COST: {currentStatic.skills.skill1.energyCost} NRGY • MULT: x{currentStatic.skills.skill1.damageMultiplier}</span>
                </div>
              </div>
              <div className="p-2.5 bg-black/30 border border-white/5 rounded-xl flex items-start gap-2.5">
                <span className="text-sm p-1 rounded-lg shrink-0 border border-white/5 bg-black/40">🛡️</span>
                <div className="space-y-0.5">
                  <h5 className="font-heading text-xs font-bold text-slate-100 leading-none">{currentStatic.skills.skill2.name}</h5>
                  <p className="text-[10px] text-slate-400">{currentStatic.skills.skill2.description}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-sky-950/20 text-[8px] font-mono font-bold text-sky-400 whitespace-nowrap">COST: {currentStatic.skills.skill2.energyCost} NRGY • {currentStatic.skills.skill2.effectName?.toUpperCase() || 'BUFF'}</span>
                </div>
              </div>
              <div className="p-2.5 bg-black/30 border border-indigo-950/40 border bg-gradient-to-r from-transparent to-indigo-950/20 rounded-xl flex items-start gap-2.5">
                <span className="text-sm p-1 rounded-lg shrink-0 border border-indigo-800/45 bg-indigo-950/40">🔥</span>
                <div className="space-y-0.5">
                  <h5 className="font-heading text-xs font-extrabold text-indigo-300 leading-none flex items-center">{currentStatic.skills.ultimate.name} <span className="text-[7.5px] font-mono bg-indigo-600 text-white rounded-md px-1 py-0.5 uppercase ml-1.5 tracking-wider">ultimate</span></h5>
                  <p className="text-[10px] text-slate-400">{currentStatic.skills.ultimate.description}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md bg-indigo-950/50 text-[8px] font-mono font-bold text-indigo-400 whitespace-nowrap">COST: {currentStatic.skills.ultimate.energyCost} NRGY • MULT: x{currentStatic.skills.ultimate.damageMultiplier}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Skins equip locker */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <h4 className="font-heading text-[10px] font-black uppercase text-slate-200 tracking-wider">Skins Locker</h4>
            <div className="flex gap-2">
              {/* Default Skin */}
              <button
                id="btn_equip_skin_default"
                onClick={() => handleEquipSkin('default')}
                className={`px-3 py-2 flex flex-col items-center justify-center rounded-xl border text-center transition-all cursor-pointer ${
                  userHero.selectedSkin === 'default' ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-white/5 bg-white/5 text-slate-400 hover:border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="text-xl">👕</span>
                <span className="text-[9px] font-mono mt-1 font-bold">DEFAULT SKIN</span>
              </button>

              {/* Special Purchased Skins */}
              {userHero.unlockedSkins.filter(s => s !== 'default').map((skinId) => {
                const isSelected = userHero.selectedSkin === skinId;
                return (
                  <button
                    key={skinId}
                    id={`btn_equip_skin_${skinId}`}
                    onClick={() => handleEquipSkin(skinId)}
                    className={`px-3 py-2 flex flex-col items-center justify-center rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-white/5 bg-white/5 text-slate-400 hover:border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl">🤖</span>
                    <span className="text-[9px] font-mono mt-1 font-bold">EQUIP SKIN</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
