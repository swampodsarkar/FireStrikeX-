import { motion } from 'motion/react';
import { ArrowLeft, Gift, Swords, Zap, Star, Trophy, Calendar, Clock } from 'lucide-react';

interface EventsScreenProps {
  onBack: () => void;
}

const EVENTS = [
  { id: 'e1', name: 'Weekend Warrior', desc: 'Earn 2x XP on all matches', icon: '⚡', color: '#ffd700', ends: '2d 14h' },
  { id: 'e2', name: 'Headshot Challenge', desc: '50 headshots → exclusive skin', icon: '🎯', color: '#ff4444', ends: '5d 6h' },
  { id: 'e3', name: 'Duo Tournament', desc: 'Win 5 duo matches for rewards', icon: '🏆', color: '#44aaff', ends: '8d 2h' },
  { id: 'e4', name: 'Login Streak Bonus', desc: '7 days login → free character', icon: '📅', color: '#44ff44', ends: '12d 0h' },
  { id: 'e5', name: 'Top Fragger', desc: 'Most kills in a day wins gems', icon: '💀', color: '#ff44ff', ends: '1d 0h' },
  { id: 'e6', name: 'New Season Pass', desc: 'Battle Pass Season 2 available', icon: '🎫', color: '#ff8844', ends: '30d 0h' },
];

export default function EventsScreen({ onBack }: EventsScreenProps) {
  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none">
      <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-heading text-sm font-black tracking-widest">Events</span>
      </div>

      {/* Banner */}
      <div className="mx-3 mt-3 p-4 rounded-xl bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-xs font-black text-purple-300">Season 2: Firestorm</p>
            <p className="text-[8px] font-mono text-slate-500 mt-0.5">New weapons, new map, new rewards!</p>
          </div>
          <Trophy className="w-8 h-8 text-yellow-500" />
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full" style={{ width: '65%' }} />
        </div>
        <p className="text-[7px] font-mono text-slate-600 mt-1">Season ends in 28 days</p>
      </div>

      <p className="px-3 pt-4 pb-2 font-heading text-[10px] font-black tracking-widest text-slate-400 uppercase">Active Events</p>

      <div className="flex-grow overflow-y-auto px-3 space-y-2">
        {EVENTS.map((ev) => (
          <motion.div key={ev.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center text-lg" style={{ borderColor: ev.color + '30', borderWidth: 1 }}>
              {ev.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-[10px] font-black">{ev.name}</span>
                <span className="text-[7px] font-mono text-slate-600 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{ev.ends}</span>
              </div>
              <p className="text-[8px] font-mono text-slate-500">{ev.desc}</p>
            </div>
            <button className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 font-heading text-[7px] font-black uppercase tracking-wider cursor-pointer transition-all">Claim</button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
