import { useState } from 'react';
import { motion } from 'motion/react';
import { PlayerProfile } from '../types';
import { ArrowLeft, Coins, Gem, ShoppingBag, Swords, Shield, Heart, Zap } from 'lucide-react';

interface ShopScreenProps {
  profile: PlayerProfile;
  onUpdateProfile: (up: Partial<PlayerProfile>) => void;
  onBack: () => void;
}

const SHOP_ITEMS = [
  { id: 'ak_skin', name: 'AK Inferno Skin', type: 'weapon_skin', price: 200, currency: 'gems', icon: '🔥', desc: 'Fiery AK-47 skin' },
  { id: 'awm_skin', name: 'AWM Dragon Skin', type: 'weapon_skin', price: 350, currency: 'gems', icon: '🐉', desc: 'Legendary sniper skin' },
  { id: 'char_alok', name: 'Alok Character', type: 'character', price: 500, currency: 'gems', icon: '🎵', desc: 'Healing aura ability' },
  { id: 'char_kelly', name: 'Kelly Character', type: 'character', price: 400, currency: 'gems', icon: '⚡', desc: 'Sprint speed boost' },
  { id: 'crate_basic', name: 'Basic Weapon Crate', type: 'crate', price: 100, currency: 'coins', icon: '📦', desc: 'Random weapon skin' },
  { id: 'crate_premium', name: 'Premium Character Crate', type: 'crate', price: 250, currency: 'gems', icon: '🎁', desc: 'Random character unlock' },
  { id: 'armor_vest', name: 'Armor Vest Lv.3', type: 'armor', price: 150, currency: 'coins', icon: '🛡️', desc: 'Reduce damage by 25%' },
  { id: 'medkit_box', name: 'Medkit Pack (x5)', type: 'consumable', price: 80, currency: 'coins', icon: '💊', desc: '5 large medkits' },
];

const CATEGORIES = ['All', 'Weapon Skins', 'Characters', 'Crates', 'Armor', 'Consumables'];

export default function ShopScreen({ profile, onUpdateProfile, onBack }: ShopScreenProps) {
  const [cat, setCat] = useState('All');
  const [msg, setMsg] = useState('');

  const filtered = cat === 'All' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => {
    if (cat === 'Weapon Skins') return i.type === 'weapon_skin';
    if (cat === 'Characters') return i.type === 'character';
    if (cat === 'Crates') return i.type === 'crate';
    if (cat === 'Armor') return i.type === 'armor';
    if (cat === 'Consumables') return i.type === 'consumable';
    return true;
  });

  const buy = (item: typeof SHOP_ITEMS[number]) => {
    const cost = item.price;
    if (item.currency === 'gems' && profile.gems < cost) { setMsg('Not enough Gems!'); return; }
    if (item.currency === 'coins' && profile.coins < cost) { setMsg('Not enough Coins!'); return; }
    if (item.currency === 'gems') onUpdateProfile({ gems: profile.gems - cost });
    else onUpdateProfile({ coins: profile.coins - cost });
    setMsg(`Purchased ${item.name}!`);
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none">
      <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-heading text-sm font-black tracking-widest">Shop</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <Coins className="w-3 h-3 text-yellow-500" /><span className="text-[9px] font-mono font-bold">{profile.coins}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Gem className="w-3 h-3 text-cyan-400" /><span className="text-[9px] font-mono font-bold">{profile.gems}</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1.5 p-2 overflow-x-auto border-b border-white/5">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-lg font-heading text-[8px] font-black uppercase tracking-widest whitespace-nowrap cursor-pointer transition-all ${
              cat === c ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300' : 'bg-white/5 border border-white/10 text-slate-500 hover:text-slate-300'
            }`}>{c}</button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-3 py-1.5 text-[10px] font-mono text-emerald-300 text-center">{msg}</div>
      )}

      <div className="flex-grow overflow-y-auto p-3 space-y-2">
        {filtered.map((item) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-lg">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-[10px] font-black truncate">{item.name}</p>
              <p className="text-[7px] font-mono text-slate-500 truncate">{item.desc}</p>
            </div>
            <button onClick={() => buy(item)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 font-heading text-[8px] font-black uppercase cursor-pointer transition-all whitespace-nowrap">
              {item.currency === 'gems' ? <Gem className="w-2.5 h-2.5" /> : <Coins className="w-2.5 h-2.5" />}
              {item.price}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
