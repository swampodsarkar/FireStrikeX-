let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.2;
    musicGain.connect(masterGain);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = sr * duration;
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.3) {
  if (muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(sfxGain!);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, vol = 0.2) {
  if (muted) return;
  const ctx = getCtx();
  const buf = noiseBuffer(ctx, duration);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(gain);
  gain.connect(sfxGain!);
  src.start();
}

export const gameAudio = {
  toggleMute() {
    muted = !muted;
    return muted;
  },
  get muted() { return muted; },

  hit() {
    playNoise(0.15, 0.4);
    playTone(120, 0.1, 'sawtooth', 0.3);
  },

  attackSwing() {
    const ctx = getCtx();
    if (muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  },

  skill1() {
    playTone(400, 0.2, 'square', 0.3);
    playTone(600, 0.15, 'square', 0.2);
    playNoise(0.2, 0.3);
  },

  skill2() {
    const ctx = getCtx();
    if (muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  },

  ultimate() {
    const ctx = getCtx();
    if (muted) return;
    const notes = [200, 300, 500, 800];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(sfxGain!);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    playNoise(0.5, 0.5);
  },

  shieldBlock() {
    playTone(800, 0.08, 'sine', 0.2);
    playTone(1200, 0.06, 'sine', 0.15);
  },

  shieldShatter() {
    playNoise(0.2, 0.4);
    playTone(100, 0.15, 'sawtooth', 0.3);
  },

  death() {
    const ctx = getCtx();
    if (muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
    playNoise(0.6, 0.5);
  },

  victory() {
    const ctx = getCtx();
    if (muted) return;
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(gain);
      gain.connect(sfxGain!);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  },

  defeat() {
    const ctx = getCtx();
    if (muted) return;
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(sfxGain!);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  },

  matchStart() {
    const ctx = getCtx();
    if (muted) return;
    [400, 500, 600, 800].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(sfxGain!);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  },

  countdownTick() {
    playTone(1000, 0.05, 'sine', 0.15);
  },

  buttonClick() {
    playTone(600, 0.03, 'sine', 0.1);
  },

  bossMusic() {
    const ctx = getCtx();
    if (muted || !musicGain) return;
    const bpm = 140;
    const beatDuration = 60 / bpm;
    const loopLen = beatDuration * 8;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      const t = now + i * beatDuration;
      const freqs = [110, 110, 146.83, 110, 130.81, 110, 164.81, 110];
      osc.frequency.setValueAtTime(freqs[i], t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.setValueAtTime(0.01, t + beatDuration * 0.5);
    }
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start();
    osc.stop(now + loopLen);
  },

  voiceLine(heroId: string, type: 'start' | 'skill1' | 'skill2' | 'ultimate' | 'death' | 'victory') {
    if (muted) return;
    const ctx = getCtx();
    const lines: Record<string, Record<string, { freq: number; dur: number }[]>> = {
      fire_warrior: {
        start: [{ freq: 400, dur: 0.15 }, { freq: 500, dur: 0.1 }, { freq: 600, dur: 0.2 }],
        ultimate: [{ freq: 600, dur: 0.1 }, { freq: 800, dur: 0.1 }, { freq: 1000, dur: 0.15 }, { freq: 1200, dur: 0.2 }],
        death: [{ freq: 400, dur: 0.2 }, { freq: 250, dur: 0.3 }, { freq: 150, dur: 0.4 }],
        victory: [{ freq: 523, dur: 0.15 }, { freq: 659, dur: 0.15 }, { freq: 784, dur: 0.2 }],
      },
      ice_mage: {
        start: [{ freq: 600, dur: 0.1 }, { freq: 500, dur: 0.15 }, { freq: 700, dur: 0.2 }],
        ultimate: [{ freq: 800, dur: 0.1 }, { freq: 1000, dur: 0.15 }, { freq: 1200, dur: 0.15 }, { freq: 1500, dur: 0.2 }],
        death: [{ freq: 500, dur: 0.2 }, { freq: 300, dur: 0.3 }, { freq: 200, dur: 0.4 }],
        victory: [{ freq: 659, dur: 0.15 }, { freq: 784, dur: 0.15 }, { freq: 1047, dur: 0.2 }],
      },
      shadow_assassin: {
        start: [{ freq: 200, dur: 0.1 }, { freq: 350, dur: 0.15 }, { freq: 500, dur: 0.2 }],
        ultimate: [{ freq: 300, dur: 0.08 }, { freq: 500, dur: 0.08 }, { freq: 700, dur: 0.08 }, { freq: 900, dur: 0.2 }],
        death: [{ freq: 300, dur: 0.2 }, { freq: 180, dur: 0.3 }, { freq: 100, dur: 0.5 }],
        victory: [{ freq: 440, dur: 0.15 }, { freq: 554, dur: 0.15 }, { freq: 659, dur: 0.2 }],
      },
      paladin: {
        start: [{ freq: 350, dur: 0.12 }, { freq: 450, dur: 0.12 }, { freq: 550, dur: 0.2 }],
        ultimate: [{ freq: 500, dur: 0.1 }, { freq: 700, dur: 0.1 }, { freq: 900, dur: 0.1 }, { freq: 1100, dur: 0.2 }],
        death: [{ freq: 350, dur: 0.2 }, { freq: 220, dur: 0.3 }, { freq: 130, dur: 0.4 }],
        victory: [{ freq: 494, dur: 0.15 }, { freq: 622, dur: 0.15 }, { freq: 740, dur: 0.2 }],
      },
      storm_archer: {
        start: [{ freq: 500, dur: 0.1 }, { freq: 600, dur: 0.1 }, { freq: 750, dur: 0.2 }],
        ultimate: [{ freq: 700, dur: 0.08 }, { freq: 900, dur: 0.08 }, { freq: 1100, dur: 0.08 }, { freq: 1300, dur: 0.2 }],
        death: [{ freq: 450, dur: 0.2 }, { freq: 280, dur: 0.3 }, { freq: 160, dur: 0.4 }],
        victory: [{ freq: 587, dur: 0.15 }, { freq: 740, dur: 0.15 }, { freq: 880, dur: 0.2 }],
      },
    };
    const heroLines = lines[heroId]?.[type];
    if (!heroLines) return;
    heroLines.forEach((note, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note.freq;
      const start = ctx.currentTime + i * note.dur * 0.7;
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.dur);
      osc.connect(gain);
      gain.connect(sfxGain!);
      osc.start(start);
      osc.stop(start + note.dur);
    });
  }
};
