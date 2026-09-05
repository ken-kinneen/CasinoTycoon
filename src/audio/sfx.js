// Procedural NPC vocal sound effects — human-like grunts, groans, shouts.
// Uses formant synthesis (filtered noise + glottal buzz through resonant vowel
// filters) to approximate real vocal sounds without any audio files.
// Shared AudioContext, lazily created.

let ctx = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function jitter(base, range) { return base + (Math.random() - 0.5) * range; }

// Vowel formant frequencies (F1, F2, F3) — approximate adult male
const VOWELS = {
  ah: [730, 1090, 2440],   // open "aah"
  eh: [530, 1840, 2480],   // "eh" / "hey"
  oo: [300, 870, 2240],    // "ooh"
  uh: [640, 1190, 2390],   // "ugh"
  oh: [570, 840, 2410],    // "oh"
  ee: [270, 2290, 3010],   // "eee"
};

// Glottal pulse source — buzzy periodic waveform like vocal cords vibrating.
// Pitch determines perceived voice pitch (male ~100-160 Hz, female ~180-260 Hz).
function glottal(a, pitch, start, dur, vol, dest) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.015);
  g.gain.setValueAtTime(vol, start + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  g.connect(dest);
  // sawtooth approximates glottal pulse shape
  const o = a.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(pitch, start);
  o.connect(g);
  o.start(start); o.stop(start + dur);
  return o;
}

// Glottal with pitch ramp (for intonation — rising/falling voice)
function glottalRamp(a, p0, p1, start, dur, vol, dest) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.015);
  g.gain.setValueAtTime(vol, start + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  g.connect(dest);
  const o = a.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(p0, start);
  o.frequency.exponentialRampToValueAtTime(p1, start + dur * 0.8);
  o.connect(g);
  o.start(start); o.stop(start + dur);
  return o;
}

// Breathy noise component — aspirated consonants, breath
function breath(a, start, dur, vol, freq, dest) {
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq || 2000; bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(bp); bp.connect(g); g.connect(dest);
  src.start(start); src.stop(start + dur);
}

// Formant filter chain — shapes a source into a vowel sound.
// Returns a gain node to connect sources into.
function formant(a, vowel, vol, dest) {
  const freqs = VOWELS[vowel] || VOWELS.ah;
  const master = a.createGain();
  master.gain.value = vol;
  for (const f of freqs) {
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 8 + Math.random() * 4;
    master.connect(bp);
    bp.connect(dest);
  }
  return master;
}

// Voice: glottal pulse → formant filters → output. The core building block.
function voice(a, pitch, vowel, start, dur, vol, dest) {
  const fm = formant(a, vowel, vol, dest);
  glottal(a, pitch, start, dur, 0.7, fm);
  breath(a, start, dur * 0.5, 0.06, 3000, dest);
}

function voiceRamp(a, p0, p1, vowel, start, dur, vol, dest) {
  const fm = formant(a, vowel, vol, dest);
  glottalRamp(a, p0, p1, start, dur, 0.7, fm);
  breath(a, start, dur * 0.4, 0.05, 2800, dest);
}

// ============ SOUND DEFINITIONS ============

const SOUNDS = {

  // Pleased low grunt — short "heh" with rising pitch
  happy() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(125, 30);
    voiceRamp(a, p, p * 1.25, 'eh', now, 0.2, 0.5, d);
    breath(a, now + 0.16, 0.08, 0.04, 3500, d);
  },

  // Satisfied chuckle — two quick voiced "heh-heh"
  chuckle() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(120, 25);
    voiceRamp(a, p, p * 1.2, 'eh', now, 0.12, 0.45, d);
    voiceRamp(a, p * 1.05, p * 1.3, 'eh', now + 0.15, 0.12, 0.38, d);
    breath(a, now + 0.25, 0.06, 0.03, 3200, d);
  },

  // Disappointed groan — long low falling "uuugghh"
  groan() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(105, 20);
    voiceRamp(a, p, p * 0.7, 'uh', now, 0.5, 0.55, d);
    breath(a, now + 0.35, 0.2, 0.07, 1800, d);
  },

  // Angry shout — sharp loud "HEY" with cracking voice
  angry() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(150, 30);
    // hard attack "H" breath burst
    breath(a, now, 0.06, 0.18, 4000, d);
    // loud voiced "EH" rising in pitch (shouting)
    voiceRamp(a, p * 1.2, p * 1.8, 'eh', now + 0.04, 0.25, 0.7, d);
    // extra throat roughness
    const fm = formant(a, 'ah', 0.15, d);
    glottalRamp(a, p * 1.5, p * 1.1, now + 0.08, 0.2, 0.4, fm);
    breath(a, now + 0.2, 0.1, 0.06, 2500, d);
  },

  // Frustrated growl — "grrr" with buzz and falling pitch
  frustrate() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(95, 15);
    // low buzzy growl through "uh" formant
    voiceRamp(a, p * 1.1, p * 0.75, 'uh', now, 0.4, 0.55, d);
    // layered rough rasp
    const fm = formant(a, 'ah', 0.12, d);
    glottalRamp(a, p * 0.9, p * 0.6, now + 0.05, 0.35, 0.35, fm);
    breath(a, now, 0.15, 0.1, 2200, d);
  },

  // Annoyed huff — sharp nasal exhale + short "tch"
  huff() {
    const a = ac(), now = a.currentTime, d = a.destination;
    breath(a, now, 0.2, 0.2, 2800, d);
    const p = jitter(160, 30);
    voice(a, p, 'eh', now + 0.03, 0.08, 0.2, d);
    breath(a, now + 0.12, 0.12, 0.08, 5000, d);
  },

  // Surprised gasp — sharp inhale + voiced "oh!"
  gasp() {
    const a = ac(), now = a.currentTime, d = a.destination;
    breath(a, now, 0.1, 0.2, 3500, d);
    const p = jitter(170, 40);
    voiceRamp(a, p, p * 1.6, 'oh', now + 0.08, 0.2, 0.5, d);
  },

  // Triumphant — voiced "YEAH" rising with energy
  triumph() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(140, 25);
    breath(a, now, 0.04, 0.1, 3000, d);
    voiceRamp(a, p, p * 1.5, 'ee', now + 0.03, 0.15, 0.55, d);
    voiceRamp(a, p * 1.3, p * 1.1, 'ah', now + 0.18, 0.25, 0.6, d);
    breath(a, now + 0.35, 0.08, 0.04, 2800, d);
  },

  // Bullseye — triumphant vocal + bright harmonic ring
  bullseye() {
    const a = ac(), now = a.currentTime, d = a.destination;
    // the voice
    const p = jitter(145, 20);
    voiceRamp(a, p, p * 1.7, 'ah', now, 0.3, 0.55, d);
    // bright ring layered on top
    const rg = a.createGain();
    rg.gain.setValueAtTime(0.2, now);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    rg.connect(d);
    const o1 = a.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 880;
    o1.connect(rg); o1.start(now); o1.stop(now + 0.8);
    const rg2 = a.createGain();
    rg2.gain.setValueAtTime(0.1, now + 0.06);
    rg2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    rg2.connect(d);
    const o2 = a.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 1760;
    o2.connect(rg2); o2.start(now + 0.06); o2.stop(now + 0.6);
  },

  // Big loss "oof" — gut-punch grunt, low and short
  oof() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const p = jitter(100, 15);
    breath(a, now, 0.03, 0.15, 1500, d);
    voiceRamp(a, p * 1.1, p * 0.6, 'oo', now + 0.02, 0.22, 0.6, d);
    breath(a, now + 0.18, 0.1, 0.06, 2000, d);
  },

  // Cash register cha-ching (this one stays non-vocal, it's a prop sound)
  ching() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const g1 = a.createGain();
    g1.gain.setValueAtTime(0.2, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    g1.connect(d);
    const o1 = a.createOscillator();
    o1.type = 'sine'; o1.frequency.value = 1200;
    o1.connect(g1); o1.start(now); o1.stop(now + 0.15);
    const g2 = a.createGain();
    g2.gain.setValueAtTime(0.18, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    g2.connect(d);
    const o2 = a.createOscillator();
    o2.type = 'sine'; o2.frequency.value = 1600;
    o2.connect(g2); o2.start(now + 0.08); o2.stop(now + 0.22);
  },

  // Crowd murmur — overlapping indistinct voices
  murmur() {
    const a = ac(), now = a.currentTime, d = a.destination;
    const vowels = ['ah', 'uh', 'oh', 'eh'];
    for (let i = 0; i < 4; i++) {
      const p = jitter(110 + i * 25, 30);
      const v = vowels[Math.floor(Math.random() * vowels.length)];
      const t0 = now + Math.random() * 0.12;
      voiceRamp(a, p, p * (0.85 + Math.random() * 0.3), v, t0, 0.15 + Math.random() * 0.15, 0.12, d);
    }
  },
};

/**
 * Play a procedural NPC vocal sound.
 * @param {'happy'|'chuckle'|'groan'|'angry'|'frustrate'|'huff'|'gasp'|'triumph'|'bullseye'|'oof'|'ching'|'murmur'} name
 */
export function play(name) {
  try { SOUNDS[name]?.(); } catch {}
}

/** Play a random sound from a list of names. */
export function playRandom(...names) {
  play(names[Math.floor(Math.random() * names.length)]);
}

export const names = Object.keys(SOUNDS);
