export interface PlayerProfile {
  uid: string;
  username: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  wins: number;
  losses: number;
  rankPoints: number;
  league: string;
  lastClaimedRewardDate?: string;
  dailyStreak: number;
}

export interface DailyMission {
  id: string;
  description: string;
  requirement: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardType: 'coins' | 'gems' | 'xp';
  rewardAmount: number;
  icon: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxProgress: number;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string;
  rewardType?: 'coins' | 'gems' | 'xp';
  rewardAmount?: number;
}

export interface BattlePassLevel {
  level: number;
  xpRequired: number;
  freeReward: { type: 'coins' | 'gems' | 'xp' | 'skin' | 'hero'; amount?: number; id?: string; name: string };
  premiumReward: { type: 'coins' | 'gems' | 'xp' | 'skin' | 'hero'; amount?: number; id?: string; name: string };
}

export interface BattlePassState {
  level: number;
  xp: number;
  hasPremium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
}

export interface Emote {
  id: string;
  emoji: string;
  name: string;
  isPremium: boolean;
  price?: number;
}

export interface UserHero {
  heroId: string;
  level: number;
  unlocked: boolean;
  selectedSkin: string;
  unlockedSkins: string[];
}

export interface HeroSkill {
  name: string;
  description: string;
  type: 'attack' | 'shield' | 'debuff' | 'ultimate';
  energyCost: number;
  damageMultiplier: number;
  effectName?: 'freeze' | 'stealth' | 'shield' | 'none';
  effectDuration?: number;
}

export interface StaticHero {
  heroId: string;
  name: string;
  heroClass: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  skills: {
    skill1: HeroSkill;
    skill2: HeroSkill;
    ultimate: HeroSkill;
  };
  description: string;
  textColor: string;
  bgColor: string;
  accentColor: string;
}

export interface QueueEntry {
  uid: string;
  username: string;
  avatar: string;
  rankPoints: number;
  league: string;
  joinedAt: string; // ISO String
  selectedHeroId: string;
  selectedSkin: string;
}

export interface BattleParticipant {
  uid: string;
  username: string;
  avatar: string;
  heroId: string;
  skin: string;
  level: number;
  hp: number;
  maxHp: number;
  defense: number;
  attack: number;
  speed: number;
  energy: number;
  maxEnergy: number;
  // Status effects active on the player
  isFrozen: boolean; // skip current turn
  isStealth: boolean; // cannot be targeted/takes halved damage
  shieldHp: number; // shield blocking damage
  effectTurns: {
    frozen?: number;
    stealth?: number;
    shield?: number;
  };
}

export interface BattleLogEntry {
  id: string;
  timestamp: string;
  playerId: string;
  playerName: string;
  actionText: string;
  damageDealt?: number;
  isUltimate?: boolean;
}

export interface MatchState {
  matchId: string;
  status: 'waiting' | 'active' | 'finished';
  currentTurn: string; // UID of active player
  turnNumber: number;
  arena?: 'winter' | 'volcano' | 'grass'; // Selected fight environment
  turnDeadline?: number; // timestamp
  playerA: BattleParticipant;
  playerB: BattleParticipant;
  battleLogs: BattleLogEntry[];
  winnerId?: string;
  loserId?: string;
  lastActionTime?: string;
  isBotMatch?: boolean;
}

// Global Static Data
export const LEAGUES = [
  { name: 'Bronze', minPoints: 0, maxPoints: 499, color: 'text-amber-700', bg: 'bg-amber-950/40', border: 'border-amber-900/60' },
  { name: 'Silver', minPoints: 500, maxPoints: 999, color: 'text-slate-400', bg: 'bg-slate-900/40', border: 'border-slate-800' },
  { name: 'Gold', minPoints: 1000, maxPoints: 1499, color: 'text-yellow-500', bg: 'bg-yellow-950/40', border: 'border-yellow-600/50' },
  { name: 'Platinum', minPoints: 1500, maxPoints: 1999, color: 'text-cyan-400', bg: 'bg-cyan-950/40', border: 'border-cyan-600/50' },
  { name: 'Diamond', minPoints: 2000, maxPoints: 2499, color: 'text-blue-400', bg: 'bg-blue-950/40', border: 'border-blue-600/50' },
  { name: 'Master', minPoints: 2500, maxPoints: 2999, color: 'text-indigo-400', bg: 'bg-indigo-950/40', border: 'border-indigo-600/50' },
  { name: 'Legend', minPoints: 3000, maxPoints: Infinity, color: 'text-rose-500', bg: 'bg-rose-950/40', border: 'border-rose-600/50' },
];

export const HEROES_DATABASE: Record<string, StaticHero> = {
  fire_warrior: {
    heroId: 'fire_warrior',
    name: 'Fire Warrior',
    heroClass: 'Knight',
    baseHp: 120,
    baseAttack: 22,
    baseDefense: 15,
    baseSpeed: 10,
    description: 'A frontline gladiator skilled in melee combat and defensive flame barriers.',
    textColor: 'text-orange-500',
    bgColor: 'from-orange-950/50 to-red-950/40',
    accentColor: '#f97316',
    skills: {
      skill1: {
        name: 'Fire Slash',
        description: 'Slash with an engulfed blade dealing high physical fire damage.',
        type: 'attack',
        energyCost: 10,
        damageMultiplier: 1.25,
      },
      skill2: {
        name: 'Flame Shield',
        description: 'Summons a blazing shield blocking 30 flat damage for 2 turns.',
        type: 'shield',
        energyCost: 15,
        damageMultiplier: 0,
        effectName: 'shield',
        effectDuration: 2,
      },
      ultimate: {
        name: 'Inferno Ultimate',
        description: 'Calls down a meteor storm. Deals massive double damage to the opponent.',
        type: 'ultimate',
        energyCost: 100,
        damageMultiplier: 2.2,
      },
    }
  },
  ice_mage: {
    heroId: 'ice_mage',
    name: 'Ice Mage',
    heroClass: 'Sorcerer',
    baseHp: 100,
    baseAttack: 25,
    baseDefense: 8,
    baseSpeed: 12,
    description: 'A master of cryomancy capable of freezing opponents and summoning blizzards.',
    textColor: 'text-sky-400',
    bgColor: 'from-sky-950/50 to-blue-950/40',
    accentColor: '#38bdf8',
    skills: {
      skill1: {
        name: 'Ice Bolt',
        description: 'Shoot sharp icicles at the opponent dealing elemental ice damage.',
        type: 'attack',
        energyCost: 10,
        damageMultiplier: 1.15,
      },
      skill2: {
        name: 'Freeze Enemy',
        description: 'Congeal the opponent, freezing them for 1 turn (skips their turn) and dealing slight damage.',
        type: 'debuff',
        energyCost: 20,
        damageMultiplier: 0.5,
        effectName: 'freeze',
        effectDuration: 1,
      },
      ultimate: {
        name: 'Blizzard Ultimate',
        description: 'Summons an absolute zero blizzard that completely devastates the foe.',
        type: 'ultimate',
        energyCost: 100,
        damageMultiplier: 2.5,
      },
    }
  },
  shadow_assassin: {
    heroId: 'shadow_assassin',
    name: 'Shadow Assassin',
    heroClass: 'Rogue',
    baseHp: 90,
    baseAttack: 30,
    baseDefense: 6,
    baseSpeed: 16,
    description: 'An agile killer relying on absolute speed, stealth, and lethal strikes.',
    textColor: 'text-purple-400',
    bgColor: 'from-purple-950/50 to-fuchsia-950/40',
    accentColor: '#c084fc',
    skills: {
      skill1: {
        name: 'Critical Strike',
        description: 'A precise thrust to vital organs dealing heavy armor-ignoring damage.',
        type: 'attack',
        energyCost: 10,
        damageMultiplier: 1.4,
      },
      skill2: {
        name: 'Stealth Mode',
        description: 'Vanish into shadows for 1 turn. Cannot be frozen, with damage taken halved and speed doubled.',
        type: 'shield',
        energyCost: 15,
        damageMultiplier: 0,
        effectName: 'stealth',
        effectDuration: 1,
      },
      ultimate: {
        name: 'Shadow Strike Ultimate',
        description: 'Strikes 10 times from the shadows dealing astronomical crushing damage.',
        type: 'ultimate',
        energyCost: 100,
        damageMultiplier: 2.8,
      },
    }
  },
  paladin: {
    heroId: 'paladin',
    name: 'Paladin',
    heroClass: 'Guardian',
    baseHp: 140,
    baseAttack: 18,
    baseDefense: 18,
    baseSpeed: 8,
    description: 'An unbreakable holy warrior who protects allies and smites foes with righteous fury.',
    textColor: 'text-amber-400',
    bgColor: 'from-amber-950/50 to-yellow-950/40',
    accentColor: '#fbbf24',
    skills: {
      skill1: {
        name: 'Holy Strike',
        description: 'Smite the opponent with a blessed hammer dealing righteous damage.',
        type: 'attack',
        energyCost: 10,
        damageMultiplier: 1.2,
      },
      skill2: {
        name: 'Divine Ward',
        description: 'Summons a holy barrier absorbing 40 damage and heals 15 HP.',
        type: 'shield',
        energyCost: 15,
        damageMultiplier: 0,
        effectName: 'shield',
        effectDuration: 2,
      },
      ultimate: {
        name: 'Judgment Day',
        description: 'Calls down a heavenly judgment dealing massive armor-ignoring damage.',
        type: 'ultimate',
        energyCost: 100,
        damageMultiplier: 2.0,
      },
    }
  },
  storm_archer: {
    heroId: 'storm_archer',
    name: 'Storm Archer',
    heroClass: 'Marksman',
    baseHp: 85,
    baseAttack: 28,
    baseDefense: 6,
    baseSpeed: 14,
    description: 'A swift wind-infused archer who rains death from afar with precision volleys.',
    textColor: 'text-cyan-400',
    bgColor: 'from-cyan-950/50 to-teal-950/40',
    accentColor: '#22d3ee',
    skills: {
      skill1: {
        name: 'Arrow Volley',
        description: 'Unleash a rapid volley of wind-infused arrows dealing heavy damage.',
        type: 'attack',
        energyCost: 10,
        damageMultiplier: 1.3,
      },
      skill2: {
        name: 'Wind Dodge',
        description: 'Become one with the wind, evading all attacks for 1 turn.',
        type: 'shield',
        energyCost: 20,
        damageMultiplier: 0,
        effectName: 'stealth',
        effectDuration: 1,
      },
      ultimate: {
        name: 'Tempest Barrage',
        description: 'Summons a devastating storm of arrows that pierces all defenses.',
        type: 'ultimate',
        energyCost: 100,
        damageMultiplier: 2.6,
      },
    }
  }
};

export const SHOP_ITEMS = {
  chests: [
    { id: 'chest_hero_rare', name: 'Elite Hero Chest', price: 500, currency: 'coins', rewardType: 'hero_unlock', description: 'Unlocks a high upgrade token or rare hero skins.' },
    { id: 'chest_gold_super', name: 'Super Gem Chest', price: 1200, currency: 'coins', rewardType: 'gems_pack', description: 'Contains 50-100 rare crystals.' },
  ],
  skins: [
    { id: 'skin_fire_mecha', heroId: 'fire_warrior', name: 'Mecha Knight Skin', price: 150, currency: 'gems', image: '🤖' },
    { id: 'skin_ice_empress', heroId: 'ice_mage', name: 'Frost Empress Skin', price: 180, currency: 'gems', image: '👑' },
    { id: 'skin_shadow_cyberpunk', heroId: 'shadow_assassin', name: 'Cyber Rogue Skin', price: 200, currency: 'gems', image: '🕶️' },
    { id: 'skin_paladin_dark', heroId: 'paladin', name: 'Dark Paladin Skin', price: 220, currency: 'gems', image: '🌑' },
    { id: 'skin_archer_phoenix', heroId: 'storm_archer', name: 'Phoenix Archer Skin', price: 190, currency: 'gems', image: '🔥' },
    { id: 'skin_fire_phoenix', heroId: 'fire_warrior', name: 'Phoenix Knight Skin', price: 250, currency: 'gems', image: '🐦‍🔥' },
    { id: 'skin_ice_warlock', heroId: 'ice_mage', name: 'Frost Warlock Skin', price: 240, currency: 'gems', image: '🧙' },
    { id: 'skin_shadow_reaper', heroId: 'shadow_assassin', name: 'Shadow Reaper Skin', price: 260, currency: 'gems', image: '💀' },
  ],
  coins: [
    { id: 'coins_pouch', name: 'Pouch of Gold', price: 10, currency: 'gems', amt: 300, image: '💰' },
    { id: 'coins_vault', name: 'Vault of Gold', price: 30, currency: 'gems', amt: 1200, image: '🏛️' }
  ]
};

export function getLeagueForPoints(points: number): string {
  for (const lg of LEAGUES) {
    if (points >= lg.minPoints && points <= lg.maxPoints) {
      return lg.name;
    }
  }
  return 'Bronze';
}

export const DAILY_MISSIONS: Omit<DailyMission, 'progress' | 'completed' | 'claimed'>[] = [
  { id: 'daily_win_ranked', description: 'Win a Ranked match', requirement: 1, rewardType: 'coins', rewardAmount: 100, icon: '🏆' },
  { id: 'daily_play_classic', description: 'Play Classic matches', requirement: 3, rewardType: 'gems', rewardAmount: 50, icon: '⚔️' },
  { id: 'daily_deal_damage', description: 'Deal damage in battles', requirement: 500, rewardType: 'xp', rewardAmount: 200, icon: '💥' },
];

export const ACHIEVEMENTS: Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'>[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Win your first match', icon: '🏅', maxProgress: 1, rewardType: 'coins', rewardAmount: 200 },
  { id: 'win_5_streak', name: 'Unstoppable', description: 'Win 5 matches in a row', icon: '🔥', maxProgress: 5, rewardType: 'gems', rewardAmount: 100 },
  { id: 'collector', name: 'Collector', description: 'Unlock all heroes', icon: '📦', maxProgress: 5, rewardType: 'gems', rewardAmount: 150 },
  { id: 'fashionista', name: 'Fashionista', description: 'Own 5 skins', icon: '👗', maxProgress: 5, rewardType: 'gems', rewardAmount: 120 },
  { id: 'dealer', name: 'Big Spender', description: 'Deal 5000 total damage', icon: '💪', maxProgress: 5000, rewardType: 'coins', rewardAmount: 500 },
  { id: 'rank_warrior', name: 'Rank Warrior', description: 'Reach Gold league', icon: '🌟', maxProgress: 1, rewardType: 'gems', rewardAmount: 200 },
];

export const BATTLE_PASS_LEVELS: BattlePassLevel[] = Array.from({ length: 20 }, (_, i) => {
  const lvl = i + 1;
  return {
    level: lvl,
    xpRequired: lvl * 100,
    freeReward: lvl % 3 === 0
      ? { type: 'gems', amount: 20, name: `${20} Gems` }
      : lvl % 5 === 0
      ? { type: 'skin', id: lvl === 5 ? 'skin_archer_phoenix' : 'skin_paladin_dark', name: 'Skin' }
      : { type: 'coins', amount: lvl * 50, name: `${lvl * 50} Coins` },
    premiumReward: lvl % 4 === 0
      ? { type: 'gems', amount: lvl * 10, name: `${lvl * 10} Gems` }
      : lvl % 7 === 0
      ? { type: 'skin', id: 'skin_fire_phoenix', name: 'Phoenix Knight' }
      : { type: 'coins', amount: lvl * 100, name: `${lvl * 100} Coins` },
  };
});

export const FREE_EMOTES: Emote[] = [
  { id: 'emote_wave', emoji: '👋', name: 'Wave', isPremium: false },
  { id: 'emote_devil', emoji: '😈', name: 'Devil', isPremium: false },
  { id: 'emote_salute', emoji: '🫡', name: 'Salute', isPremium: false },
  { id: 'emote_clap', emoji: '👏', name: 'Clap', isPremium: false },
];

export const PREMIUM_EMOTES: Emote[] = [
  { id: 'emote_skull', emoji: '💀', name: 'Skull', isPremium: true, price: 80 },
  { id: 'emote_trophy', emoji: '🏆', name: 'Champion', isPremium: true, price: 100 },
  { id: 'emote_fire', emoji: '😤', name: 'Fired Up', isPremium: true, price: 60 },
  { id: 'emote_heart', emoji: '❤️', name: 'Heart', isPremium: true, price: 50 },
  { id: 'emote_crown', emoji: '👑', name: 'Royal', isPremium: true, price: 120 },
];

// ─── E-SPORTS / TOURNAMENT / CUSTOM ROOMS / ADMIN TYPES ───────────────────

export interface CustomRoom {
  roomId: string;
  name: string;
  code: string;
  hostUid: string;
  mode: 'classic' | 'ranked';
  maxPlayers: number;
  players: { uid: string; username: string; heroId: string; ready: boolean }[];
  status: 'lobby' | 'in_progress' | 'finished';
  matchId?: string;
  createdAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  prizePool: { coins: number; gems: number };
  status: 'open' | 'in_progress' | 'finished';
  bracket: TournamentBracketEntry[];
  participants: TournamentParticipant[];
  createdAt: string;
  startedAt?: string;
}

export interface TournamentParticipant {
  uid: string;
  username: string;
  seed: number;
  eliminated: boolean;
}

export interface TournamentBracketEntry {
  round: number;
  matchIndex: number;
  playerAUid?: string;
  playerBUid?: string;
  winnerUid?: string;
  matchId?: string;
}

export interface TournamentMatch {
  matchId: string;
  tournamentId: string;
  round: number;
  matchIndex: number;
  playerAUid: string;
  playerBUid: string;
  winnerUid?: string;
  status: 'pending' | 'active' | 'finished';
}

export interface AdminAction {
  id: string;
  timestamp: string;
  adminUid: string;
  action: string;
  target: string;
  details?: string;
}

export interface ServerSettings {
  maintenanceMode: boolean;
  matchmakingEnabled: boolean;
  tournamentCreationEnabled: boolean;
  announcement?: string;
  minLevelForRanked: number;
  botMatchEnabled: boolean;
}

// ─── DUO / 2V2 TYPES ─────────────────────────────────────────────────────

export interface DuoTeam {
  teamId: string;
  hostUid: string;
  members: DuoTeamMember[];
  code: string;
  status: 'lobby' | 'queueing' | 'in_match';
  matchId?: string;
  createdAt: string;
}

export interface DuoTeamMember {
  uid: string;
  username: string;
  heroId: string;
  skin: string;
  ready: boolean;
}

export interface DuoQueueEntry {
  teamId: string;
  memberUids: string[];
  avgRankPoints: number;
  joinedAt: string;
}

// ─── BATTLE ROYALE TYPES ────────────────────────────────────────────────

export interface BrPlayerState {
  uid: string;
  username: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  hp: number;
  maxHp: number;
  armor: number;
  alive: boolean;
  kills: number;
  weapon: string;
  teamId: number;
}

export interface BrLootItem {
  id: string;
  x: number;
  z: number;
  type: string;
  taken: boolean;
}

export interface BrZoneState {
  centerX: number;
  centerZ: number;
  radius: number;
  nextRadius: number;
  phase: number;
  timer: number;
}

export interface BrMatchState {
  matchId: string;
  status: 'lobby' | 'active' | 'finished';
  players: BrPlayerState[];
  zone: BrZoneState;
  loot: BrLootItem[];
  winnerId?: string;
  startTime: number;
  mode: BrMode;
  teams: BrTeam[];
}

export const BR_WEAPONS: Record<string, { name: string; damage: number; range: number; fireRate: number }> = {
  pistol: { name: 'Pistol', damage: 15, range: 30, fireRate: 400 },
  ar: { name: 'Assault Rifle', damage: 12, range: 50, fireRate: 150 },
  shotgun: { name: 'Shotgun', damage: 30, range: 15, fireRate: 800 },
  sniper: { name: 'Sniper', damage: 50, range: 80, fireRate: 1200 },
};

export const BR_MAP_SIZE = 100;
export const BR_MIN_PLAYERS = 2;
export const BR_MAX_PLAYERS = 10;
export const BR_ZONE_PHASES = [
  { radius: 50, wait: 30, shrinkTo: 30 },  // Phase 1
  { radius: 30, wait: 25, shrinkTo: 15 },  // Phase 2
  { radius: 15, wait: 20, shrinkTo: 5 },   // Phase 3
];

export interface BrTeam {
  id: number;
  members: string[];  // up to 2 UIDs
  alive: boolean;
}

export type BrMode = 'solo' | 'duo';

export const BR_MODE_CONFIG = {
  solo: { teamSize: 1, maxPlayers: 10, maxTeams: 10, label: 'Solo', icon: '1' },
  duo:  { teamSize: 2, maxPlayers: 10, maxTeams: 5,  label: 'Duo',  icon: '2' },
};

