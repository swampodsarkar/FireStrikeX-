import { motion } from 'motion/react';
import { Coins, Flame, Gem, ShoppingCart } from 'lucide-react';
import { PlayerProfile, SHOP_ITEMS, UserHero } from '../types';
import { db, doc, updateDoc, getDoc, setDoc } from '../lib/firebase';
import { useState } from 'react';

interface ShopScreenProps {
  profile: PlayerProfile;
  heroes: UserHero[];
  onUpdateProfile: (updated: Partial<PlayerProfile>) => void;
  onUpdateHero: (updated: UserHero) => void;
  onBack: () => void;
}

export default function ShopScreen({ profile, heroes, onUpdateProfile, onUpdateHero, onBack }: ShopScreenProps) {
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const displaySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const displayError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 3000);
  };

  const buyCoinsPack = async (packId: string, gemCost: number, coinsAmt: number) => {
    if (profile.gems < gemCost) {
      displayError('Insufficient Gems! Fight more battle arenas to earn crystals.');
      return;
    }

    try {
      const playerRef = doc(db, 'players', profile.uid);
      const newCoins = profile.coins + coinsAmt;
      const newGems = profile.gems - gemCost;

      await updateDoc(playerRef, {
        coins: newCoins,
        gems: newGems
      });

      onUpdateProfile({ coins: newCoins, gems: newGems });
      displaySuccess(`Purchased 🪙 ${coinsAmt} Coins successfully!`);
    } catch (err) {
      console.error(err);
      displayError('Purchase transaction failed.');
    }
  };

  const buySkin = async (skinId: string, heroId: string, gemCost: number, skinName: string) => {
    if (profile.gems < gemCost) {
      displayError('Insufficient Gems!');
      return;
    }

    const matchedHero = heroes.find(h => h.heroId === heroId);
    if (matchedHero?.unlockedSkins.includes(skinId)) {
      displayError('Skin already owned!');
      return;
    }

    try {
      // 1. Update gems
      const playerRef = doc(db, 'players', profile.uid);
      const newGems = profile.gems - gemCost;
      await updateDoc(playerRef, { gems: newGems });
      onUpdateProfile({ gems: newGems });

      // 2. Add skin to hero subcollection
      const heroRef = doc(db, 'players', profile.uid, 'heroes', heroId);
      const currentSkins = matchedHero ? matchedHero.unlockedSkins : ['default'];
      const updatedSkins = [...currentSkins, skinId];

      const updatedHero: UserHero = matchedHero 
        ? { ...matchedHero, unlockedSkins: updatedSkins }
        : { heroId, level: 1, unlocked: true, selectedSkin: skinId, unlockedSkins: ['default', skinId] };

      await setDoc(heroRef, updatedHero, { merge: true });
      onUpdateHero(updatedHero);

      displaySuccess(`Unlocked [${skinName}] Skin for ${heroId}!`);
    } catch (err) {
      console.error(err);
      displayError('Failed to purchase hero skin.');
    }
  };

  const buyChest = async (chestId: string, costCoins: number, rewardType: string) => {
    if (profile.coins < costCoins) {
      displayError('Insufficient Coins! Claim daily rewards or finish matches to earn gold.');
      return;
    }

    try {
      const playerRef = doc(db, 'players', profile.uid);
      let newCoins = profile.coins - costCoins;
      let newGems = profile.gems;
      let rewardText = '';

      if (rewardType === 'gems_pack') {
        const addedGems = Math.floor(Math.random() * 50) + 50; // 50-100 Gems
        newGems += addedGems;
        rewardText = `Found 💎 ${addedGems} Rare Crystals inside the chest!`;
        
        await updateDoc(playerRef, { coins: newCoins, gems: newGems });
        onUpdateProfile({ coins: newCoins, gems: newGems });
      } 
      else if (rewardType === 'hero_unlock') {
        // Unlock a hero or yield massive level token (coins back / gems pack)
        const possibleGems = Math.floor(Math.random() * 40) + 30; // 30-70 Gems
        newGems += possibleGems;
        rewardText = `Elite Hero Chest summoned! Obtained 💎 ${possibleGems} Gems + Level Up multipliers!`;
        
        await updateDoc(playerRef, { coins: newCoins, gems: newGems });
        onUpdateProfile({ coins: newCoins, gems: newGems });
      }

      displaySuccess(rewardText);
    } catch (err) {
      console.error(err);
      displayError('Failed to claim chest contents.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none relative z-10 overflow-hidden">
      {/* Top Navigation Headers */}
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
        <button
          onClick={onBack}
          id="btn_shop_back"
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 font-heading text-xs uppercase cursor-pointer transition-colors"
        >
          Back
        </button>
        <div className="flex items-center space-x-1">
          <ShoppingCart className="w-4 h-4 text-amber-400" />
          <span className="font-heading font-black text-xs uppercase tracking-widest text-[#f59e0b]">Elite Shop</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            <Coins className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="font-mono text-[10px] font-bold">{profile.coins}</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
            <Gem className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
            <span className="font-mono text-[10px] font-bold">{profile.gems}</span>
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-6 pb-20">
        
        {/* Banner/Status Alerts */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-800 text-emerald-200 text-xs rounded-xl text-center font-bold">
            🎉 {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-950/30 border border-red-800 text-red-200 text-xs rounded-xl text-center font-bold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 1. Summon Elite Chests */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <h3 className="font-heading text-xs font-black tracking-widest uppercase text-amber-500">
              Elite Chests
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SHOP_ITEMS.chests.map((chest) => (
              <div
                key={chest.id}
                className="flex flex-col justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all space-y-3 shadow-lg"
              >
                <div>
                  <span className="text-3xl">🎁</span>
                  <h4 className="font-heading text-xs font-bold text-slate-100 mt-1">{chest.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-tight mt-1">{chest.description}</p>
                </div>
                <button
                  onClick={() => buyChest(chest.id, chest.price, chest.rewardType)}
                  id={`btn_shop_chest_${chest.id}`}
                  className="w-full h-8 flex items-center justify-center space-x-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 cursor-pointer font-heading font-black text-[9px] tracking-wider text-white shadow-md active:scale-98 transition-all"
                >
                  <Coins className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                  <span>{chest.price} GOLD</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Skin Shop */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5">
            <ShoppingCart className="w-4 h-4 text-violet-400" />
            <h3 className="font-heading text-xs font-black tracking-widest uppercase text-violet-400">
              Legend Skins Selection
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHOP_ITEMS.skins.map((skin) => {
              const matchedHero = heroes.find(h => h.heroId === skin.heroId);
              const isOwned = matchedHero?.unlockedSkins.includes(skin.id);

              return (
                <div
                  key={skin.id}
                  className="relative flex flex-col justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all space-y-2 text-center"
                >
                  <div>
                    <span className="text-3xl inline-block p-1 bg-black/40 rounded-xl border border-white/5">{skin.image}</span>
                    <h4 className="font-heading text-[10px] font-bold text-slate-150 truncate mt-1">{skin.name}</h4>
                    <p className="text-[8px] text-violet-400 font-mono tracking-tighter uppercase mt-0.5">{skin.heroId.replace('_', ' ')}</p>
                  </div>
                  {isOwned ? (
                    <div className="w-full h-7 rounded-lg bg-black/30 border border-white/5 flex items-center justify-center font-heading text-[9px] font-bold text-slate-500 uppercase">
                      OWNED
                    </div>
                  ) : (
                    <button
                      onClick={() => buySkin(skin.id, skin.heroId, skin.price, skin.name)}
                      id={`btn_shop_skin_${skin.id}`}
                      className="w-full h-7 flex items-center justify-center space-x-0.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-500 text-white font-heading font-black text-[9px] tracking-wider cursor-pointer active:scale-98 transition-all"
                    >
                      <Gem className="w-2.5 h-2.5 fill-cyan-400 text-cyan-400" />
                      <span>{skin.price} GEMS</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Gold Crystals Exchange */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5">
            <Gem className="w-4 h-4 text-cyan-400" />
            <h3 className="font-heading text-xs font-black tracking-widest uppercase text-cyan-400">
              Gold Crystals Exchange
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {SHOP_ITEMS.coins.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all shadow-md"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{pack.image}</span>
                  <div>
                    <h4 className="font-heading text-[11px] font-bold text-slate-150 leading-none">{pack.name}</h4>
                    <p className="text-[9px] text-emerald-400 font-mono font-bold mt-1 leading-none">+🪙 {pack.amt}</p>
                  </div>
                </div>
                <button
                  onClick={() => buyCoinsPack(pack.id, pack.price, pack.amt)}
                  id={`btn_shop_pack_${pack.id}`}
                  className="px-2 py-1.5 flex items-center space-x-0.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-100 font-heading font-black text-[9px] uppercase tracking-wider cursor-pointer active:scale-98 transition-all"
                >
                  <Gem className="w-2.5 h-2.5 fill-cyan-400 text-cyan-400" />
                  <span>{pack.price}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
