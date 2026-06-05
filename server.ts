import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Bot decision engine — fully self-contained, hero-specific tactics
  app.post('/api/bot-decide', (req, res) => {
    try {
      const { matchState, botPlayerId } = req.body;
      if (!matchState || !botPlayerId) {
        return res.status(400).json({ error: 'Missing matchState or botPlayerId' });
      }

      const isA = botPlayerId === 'playerA';
      const bot = isA ? matchState.playerA : matchState.playerB;
      const opp = isA ? matchState.playerB : matchState.playerA;

      const action = decideBotAction(bot, opp);
      const commentary = generateCommentary(bot, opp, action);

      return res.json({ action, commentary });
    } catch (err) {
      console.error('Bot decision error:', err);
      return res.status(500).json({ error: 'Bot decision failed', action: 'attack', commentary: 'Bot struggles to decide!' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve admin.html explicitly before catch-all
    app.get('/admin.html', (req, res) => {
      res.sendFile(path.join(distPath, 'admin.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYS] Server online on 0.0.0.0:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

/* ─── Bot AI Logic ─── */

type BotAction = 'attack' | 'skill1' | 'skill2' | 'ultimate';

function decideBotAction(bot: any, opp: any): BotAction {
  const hpPct = bot.hp / bot.maxHp;
  const oppHpPct = opp.hp / opp.maxHp;
  const hasShield = bot.shieldHp > 0;
  const oppHasShield = opp.shieldHp > 0;
  const isFrozen = bot.isFrozen;
  const oppFrozen = opp.isFrozen;

  // Ultimate at 100 energy (always use it if available)
  if (bot.energy >= 100) return 'ultimate';

  // Hero-specific tactical logic
  switch (bot.heroId) {
    case 'fire_warrior': {
      // Tank: shield when low HP, otherwise skill1
      if (hpPct < 0.35 && !hasShield && !isFrozen) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.3) return 'skill1';
      return 'attack';
    }

    case 'ice_mage': {
      // Control: freeze if opponent not frozen and we have energy
      if (!oppFrozen && bot.energy >= 20 && !isFrozen) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.25) return 'skill1';
      return 'attack';
    }

    case 'shadow_assassin': {
      // Rogue: stealth when low HP, otherwise big damage
      if (hpPct < 0.3 && !bot.isStealth && !isFrozen) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.2) return 'skill1';
      return 'attack';
    }

    case 'paladin': {
      // Guardian: shield + heal when damaged, judgement otherwise
      if (hpPct < 0.5 && !hasShield && !isFrozen) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.35) return 'skill1';
      return 'attack';
    }

    case 'storm_archer': {
      // Marksman: dodge when threatened, otherwise volley
      if (hpPct < 0.25 && !bot.isStealth && !isFrozen) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.2) return 'skill1';
      return 'attack';
    }

    default: {
      // Generic fallback
      if (hpPct < 0.3 && !hasShield && !isFrozen && bot.energy >= 15) return 'skill2';
      if (bot.energy >= 10 && Math.random() > 0.4) return 'skill1';
      return 'attack';
    }
  }
}

/* ─── Commentary System (hero-specific) ─── */

const COMMENTARIES: Record<string, Record<BotAction, string[]>> = {
  fire_warrior: {
    attack: ['swings a heavy blow!', 'crushes forward with raw strength!'],
    skill1: ['unleashes a blazing Fire Slash!', 'slices with molten fury!'],
    skill2: ['raises the Flame Shield!', 'summons a barrier of fire!'],
    ultimate: ['CALLS DOWN INFERNO! METEOR STRIKE INCOMING!', 'UNLEASHES THE BLAZING ULTIMATE!'],
  },
  ice_mage: {
    attack: ['hurls a shard of ice!', 'strikes with frost energy!'],
    skill1: ['fires an Ice Bolt!', 'chills the air with frozen magic!'],
    skill2: ['FREEZES the opponent solid!', 'encases the enemy in ice!'],
    ultimate: ['SUMMONS BLIZZARD! ABSOLUTE ZERO ENGULFS THE ARENA!', 'UNLEASHES THE GREAT FREEZE!'],
  },
  shadow_assassin: {
    attack: ['strikes from the darkness!', 'lands a quick, precise hit!'],
    skill1: ['performs a Critical Strike!', 'finds the weak point!'],
    skill2: ['vanishes into Stealth!', 'melts into the shadows!'],
    ultimate: ['EXECUTES SHADOW STRIKE! TEN BLOWS IN AN INSTANT!', 'UNLEASHES DARKNESS ULTIMATE!'],
  },
  paladin: {
    attack: ['strikes with a holy mace!', 'delivers a righteous blow!'],
    skill1: ['smites with Holy Strike!', 'calls divine light upon the foe!'],
    skill2: ['raises Divine Ward! shield and heal activated!', 'blesses with a holy barrier!'],
    ultimate: ['JUDGMENT DAY HAS COME! HEAVENLY WRATH DESCENDS!', 'UNLEASHES DIVINE JUDGMENT!'],
  },
  storm_archer: {
    attack: ['fires a quick arrow!', 'looses a precise shot!'],
    skill1: ['unleashes Arrow Volley!', 'rains arrows from above!'],
    skill2: ['uses Wind Dodge! evasive maneuvers!', 'becomes one with the wind!'],
    ultimate: ['TEMPEST BARRAGE INCOMING! A STORM OF ARROWS!', 'UNLEASHES THE WIND ULTIMATE!'],
  },
};

function generateCommentary(bot: any, opp: any, action: BotAction): string {
  const lines = COMMENTARIES[bot.heroId]?.[action];
  if (!lines || lines.length === 0) {
    const fallbacks: Record<BotAction, string> = {
      attack: 'attacks with ferocity!',
      skill1: 'uses a skilled ability!',
      skill2: 'activates a tactical maneuver!',
      ultimate: 'UNLEASHES THE ULTIMATE POWER!',
    };
    return `${bot.username} ${fallbacks[action]}`;
  }
  const line = lines[Math.floor(Math.random() * lines.length)];
  return `${bot.username} ${line}`;
}

startServer();
