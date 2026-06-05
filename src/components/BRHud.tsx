import { BR_WEAPONS, BrMode } from '../types';

interface BRHudProps {
  hp: number; maxHp: number; armor: number; weapon: string; kills: number;
  aliveCount: number; totalPlayers: number; zoneRadius: number;
  killFeed: { killer: string; victim: string }[];
  posX: number; posZ: number;
  mode: BrMode;
  teammates: { uid: string; username: string; alive: boolean; hp: number; x: number; z: number; downed: boolean }[];
  myTeamId: number;
  reviveTarget: string | null;
  reviveProgress: number;
  otherPlayers: { uid: string; x: number; z: number; alive: boolean; teamId: number }[];
  onBack: () => void;
}

export default function BRHud({ hp, maxHp, armor, weapon, kills, aliveCount, totalPlayers, zoneRadius, killFeed, posX, posZ, mode, teammates, myTeamId, reviveTarget, reviveProgress, otherPlayers, onBack }: BRHudProps) {
  const wpn = BR_WEAPONS[weapon] || BR_WEAPONS.pistol;
  const hpPct = (hp / maxHp) * 100;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-2 flex items-center justify-between pointer-events-auto">
        <button onClick={onBack} className="text-[9px] font-mono px-2 py-1 rounded bg-black/60 border border-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors">
          Leave
        </button>
        <div className="flex items-center gap-3 bg-black/60 px-3 py-1.5 rounded-full border border-white/10">
          <span className="text-[10px] font-mono text-slate-400">
            <span className={mode === 'duo' ? 'text-emerald-400' : 'text-emerald-400'}>Alive</span>: <span className="font-bold text-emerald-300">{aliveCount}</span>
            <span className="text-slate-600">/{totalPlayers}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            <span className="text-red-400">Kills</span>: <span className="font-bold text-red-300">{kills}</span>
          </span>
        </div>
        <div className="bg-black/60 px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-mono text-blue-400">
          Zone: {zoneRadius.toFixed(0)}m
        </div>
      </div>

      {/* Teammate info (Duo mode) */}
      {mode === 'duo' && teammates.length > 0 && (
        <div className="absolute top-12 left-2 space-y-1.5 pointer-events-auto w-36">
          {teammates.map((tm) => (
            <div key={tm.uid} className="bg-black/70 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-green-500/20">
              <div className="flex items-center justify-between">
                <span className={`text-[9px] font-mono font-bold ${tm.alive ? 'text-green-400' : 'text-red-400'}`}>
                  {tm.alive ? '🟢' : '🔴'} {tm.username}
                </span>
                <span className={`text-[8px] font-mono ${tm.alive ? 'text-green-300' : 'text-red-300'}`}>{Math.ceil(tm.hp)}HP</span>
              </div>
              {tm.alive && (
                <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden mt-0.5">
                  <div className="h-full bg-gradient-to-r from-green-700 to-green-400 transition-all" style={{ width: `${(tm.hp / 100) * 100}%` }} />
                </div>
              )}
              {!tm.alive && (
                <p className="text-[8px] font-mono text-slate-500 mt-0.5">Downed — revive nearby</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Revive prompt */}
      {reviveTarget && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-8 pointer-events-auto">
          <div className="bg-green-900/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-green-500/40 text-center">
            <p className="text-[10px] font-mono text-green-300">Hold <span className="font-black text-white">E</span> to revive</p>
            <div className="w-24 h-1.5 bg-black/60 rounded-full overflow-hidden mt-1 mx-auto">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${reviveProgress * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Bottom-left: HP/Armor/Weapon */}
      <div className="absolute bottom-0 left-0 p-3 space-y-1.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-36 h-3 bg-black/80 rounded-full overflow-hidden border border-white/10">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-red-300 font-bold w-10">{Math.ceil(hp)}</span>
        </div>
        {armor > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-36 h-2 bg-black/80 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all" style={{ width: `${armor}%` }} />
            </div>
            <span className="text-[9px] font-mono text-blue-300">{armor}</span>
          </div>
        )}
        <div className="bg-black/80 px-2 py-1 rounded border border-white/10">
          <span className="text-[9px] font-mono text-slate-400">{wpn.name}</span>
          <span className="text-[8px] font-mono text-slate-600 ml-2">DMG {wpn.damage} • RNG {wpn.range}</span>
        </div>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-0 right-0 m-3 w-28 h-28 bg-black/80 rounded-lg border border-white/10 overflow-hidden pointer-events-auto">
        <div className="relative w-full h-full" style={{ transform: 'scaleX(-1)' }}>
          <div className="absolute rounded-full border-2 border-blue-500/30 bg-blue-500/5" style={{
            width: `${(zoneRadius / 50) * 100}%`, height: `${(zoneRadius / 50) * 100}%`,
            left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          }} />
          {otherPlayers.map((p) => {
            const isTeammate = mode === 'duo' && p.teamId === myTeamId;
            return (
              <div key={p.uid} className={`absolute w-1.5 h-1.5 rounded-full ${isTeammate ? 'bg-green-400' : p.alive ? 'bg-red-400' : 'bg-slate-700'}`} style={{
                left: `${50 + (p.x - posX)}%`, top: `${50 + (p.z - posZ)}%`,
                transform: 'translate(-50%, -50%)',
              }} />
            );
          })}
          <div className="absolute w-2 h-2 bg-green-400 rounded-full shadow-sm" style={{
            left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          }} />
        </div>
      </div>

      {/* Kill feed */}
      <div className="absolute top-20 right-2 space-y-0.5 pointer-events-auto w-44">
        {killFeed.slice(-5).reverse().map((k, i) => (
          <div key={i} className="bg-black/70 text-[9px] font-mono px-2 py-1 rounded border border-white/5 text-slate-300 truncate backdrop-blur-sm">
            <span className="text-red-400">{k.killer}</span>
            <span className="text-slate-600 mx-1">✕</span>
            <span className="text-slate-400">{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-0.5 h-3 bg-white/30 rounded-full absolute left-1/2 -translate-x-1/2 -top-1.5" />
        <div className="w-0.5 h-3 bg-white/30 rounded-full absolute left-1/2 -translate-x-1/2 top-0.5" />
        <div className="h-0.5 w-3 bg-white/30 rounded-full absolute top-1/2 -translate-y-1/2 -left-1.5" />
        <div className="h-0.5 w-3 bg-white/30 rounded-full absolute top-1/2 -translate-y-1/2 left-0.5" />
      </div>

      {/* Mode indicator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 p-2 pointer-events-auto">
        <div className="bg-black/60 px-2 py-0.5 rounded-full border border-white/10 text-[8px] font-mono text-slate-500 uppercase tracking-wider">
          {mode === 'duo' ? 'Duo Mode' : 'Solo Mode'}
        </div>
      </div>
    </div>
  );
}
