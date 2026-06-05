import { PlayerProfile, HEROES_DATABASE } from '../types';
import ThreeHeroView from './ThreeHeroView';
import { ArrowLeft, Star, Lock } from 'lucide-react';

interface CharacterSelectScreenProps {
  profile: PlayerProfile;
  selectedChar: string;
  onSelect: (heroId: string) => void;
  onBack: () => void;
}

export default function CharacterSelectScreen({ profile, selectedChar, onSelect, onBack }: CharacterSelectScreenProps) {
  const characters = Object.entries(HEROES_DATABASE).map(([id, data]) => ({ id, ...data }));

  return (
    <div className="flex flex-col h-full w-full bg-[#050508] text-white select-none">
      <div className="flex items-center gap-3 p-3 bg-white/5 backdrop-blur-md border-b border-white/5">
        <button onClick={onBack} className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all"><ArrowLeft className="w-4 h-4" /></button>
        <span className="font-heading text-sm font-black tracking-widest">Characters</span>
      </div>

      <div className="flex-grow overflow-y-auto p-3 space-y-3">
        {characters.map((ch) => {
          const selected = selectedChar === ch.id;
          return (
            <button key={ch.id} onClick={() => onSelect(ch.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                selected ? 'bg-orange-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(255,100,0,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="scale-[2]">
                  <ThreeHeroView heroId={ch.id} skin="default" isAnimated={false} isLobby={false} />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-xs font-black">{ch.name}</span>
                  {selected && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                </div>
                <p className="text-[8px] font-mono text-slate-500 mt-0.5">{ch.heroClass}</p>
                <div className="flex gap-2 mt-1 text-[7px] font-mono text-slate-600">
                  <span>HP {ch.baseHp}</span>
                  <span>ATK {ch.baseAttack}</span>
                  <span>DEF {ch.baseDefense}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-mono text-slate-500">{ch.skills.skill1.name}</p>
                <p className="text-[7px] font-mono text-slate-600">{ch.skills.skill1.description.slice(0, 20)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
