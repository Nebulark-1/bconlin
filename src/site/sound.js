// The site's sound. Everything is synthesized in the browser; there are no
// audio files. Three layers:
//   - plucked strings (Karplus-Strong), for things you touch
//   - soft chimes, for small events like a mote bouncing in the margin
//   - an ambient bed: a slow pad on the current section's chord, a little
//     air, and now and then a few music-box notes
// All of it sits in A major, so any two sounds agree with each other.
// Sound is off until the visitor turns it on, and the choice is remembered.

const KEY = "bc-sound";

// Chords for each part of the site (Hz), all diatonic to A major.
export const CHORDS = {
  A: { pad: [110, 164.81, 246.94, 277.18], strings: [110, 164.81, 220, 277.18] }, // A add9
  Fsm: { pad: [92.5, 138.59, 164.81, 220], strings: [92.5, 138.59, 220, 277.18] }, // F#m7
  D: { pad: [73.42, 146.83, 220, 277.18], strings: [146.83, 220, 293.66, 369.99] }, // Dmaj7
  Ahigh: { pad: [110, 220, 329.63, 493.88], strings: [220, 277.18, 329.63, 493.88] }, // A add9, open
};
// A major pentatonic, for chimes and music-box notes.
export const PENTATONIC = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77, 1108.73];

let ctx = null;
let master;
let meter;
let dry;
const mix = {};
let reverbIn;
let padBus;
let padFilter;
let on = false;
let wanted = false;
let chord = "A";
let voices = [];
let sparkleTimer = 0;
const buffers = new Map();
const listeners = new Set();
export const soundStats = { chord: "A", voices: 0, notes: 0, last: null, phrase: "off" };

/**
 * A plucked-string note at `freq` Hz (Karplus-Strong). A loop one period
 * long starts full of noise; each sample out is the average of the two
 * before it a period ago, times a little loss. That averaging is a gentle
 * low-pass filter, so the hiss dies first and a clean decaying tone is left.
 */
export function pluckBuffer(audio, freq, seconds = 2.4, loss = 0.996) {
  const rate = audio.sampleRate;
  const period = Math.round(rate / freq);
  const length = Math.round(rate * seconds);
  const buffer = audio.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  for (let n = 0; n < period; n++) out[n] = Math.random() * 2 - 1; // the pluck
  out[period] = out[0];
  for (let n = period + 1; n < length; n++) {
    out[n] = loss * 0.5 * (out[n - period] + out[n - period - 1]);
  }
  return buffer;
}

// A room to put everything in: three seconds of decaying stereo noise,
// used as the impulse response of a convolution reverb.
function roomImpulse(audio, seconds = 3.2) {
  const length = Math.round(audio.sampleRate * seconds);
  const ir = audio.createBuffer(2, length, audio.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let n = 0; n < length; n++) d[n] = (Math.random() * 2 - 1) * (1 - n / length) ** 3.2;
  }
  return ir;
}

function build() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = 0;
  // the studio's master fader, then a meter, then the speakers
  mix.master = ctx.createGain();
  meter = ctx.createAnalyser();
  meter.fftSize = 512;
  master.connect(mix.master).connect(meter).connect(ctx.destination);
  for (const layer of ["pad", "strings", "chimes", "wind", "air"]) mix[layer] = ctx.createGain();
  applyMix();

  dry = ctx.createGain();
  dry.connect(master);
  const reverb = ctx.createConvolver();
  reverb.buffer = roomImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverbIn = ctx.createGain();
  reverbIn.connect(reverb).connect(wet).connect(master);

  // the pad runs through a slowly breathing low-pass
  padFilter = ctx.createBiquadFilter();
  padFilter.type = "lowpass";
  padFilter.frequency.value = 560;
  padFilter.Q.value = 0.4;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoDepth.gain.value = 200;
  lfo.connect(lfoDepth).connect(padFilter.frequency);
  lfo.start();
  padBus = ctx.createGain();
  padBus.connect(padFilter);
  padFilter.connect(mix.pad);
  mix.pad.connect(master);
  mix.pad.connect(reverbIn);
  mix.strings.connect(dry);
  const stringSend = ctx.createGain();
  stringSend.gain.value = 0.3;
  mix.strings.connect(stringSend).connect(reverbIn);
  const chimeDry = ctx.createGain();
  chimeDry.gain.value = 0.5;
  mix.chimes.connect(chimeDry).connect(dry);
  mix.chimes.connect(reverbIn);
  mix.wind.connect(master);
  mix.wind.connect(reverbIn);
  mix.air.connect(master);

  air();
  wind();
  // keep the button honest: it only shows playing while sound is reaching the speakers
  ctx.onstatechange = notify;
  // a new output device (headphones in, speakers picked): follow the default
  navigator.mediaDevices?.addEventListener?.("devicechange", () => {
    if (ctx?.setSinkId) ctx.setSinkId("").catch(() => {});
  });
  return true;
}

/** Tell the buttons whether sound is actually playing, and whether it's wanted. */
function notify() {
  listeners.forEach((fn) => fn(on && ctx?.state === "running", wanted));
}

// If the browser paused the audio (a device change, a long time in the
// background), the next click or key press wakes it back up.
for (const t of ["pointerdown", "keydown"]) {
  window.addEventListener(
    t,
    () => {
      if (wanted && on && ctx && ctx.state !== "running" && ctx.state !== "closed") ctx.resume().then(notify, () => {});
    },
    true,
  );
}

// a breath of filtered noise under everything, rising and falling slowly
function air() {
  const length = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b = 0;
    for (let n = 0; n < length; n++) d[n] = b = b * 0.97 + (Math.random() * 2 - 1) * 0.03; // brown-ish
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = 0.035;
  const swell = ctx.createOscillator();
  const swellDepth = ctx.createGain();
  swell.frequency.value = 0.045;
  swellDepth.gain.value = 0.025;
  swell.connect(swellDepth).connect(g.gain);
  swell.start();
  src.connect(band).connect(g).connect(mix.air);
  src.start();
}

/**
 * Wind that rises while you scroll and dies away slowly after. It follows
 * how much you've been scrolling lately, not each movement: scroll energy
 * is smoothed over a second or two, gusts wander on their own, and the
 * level rises over about a second and falls over three. Two noise layers,
 * one leaning each way, whistle through slowly wandering filters.
 */
let windGain = null;
const wind = () => {
  const length = ctx.sampleRate * 6;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  windGain.connect(mix.wind);
  [-0.5, 0.5].forEach((pan, k) => {
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let n = 0; n < length; n++) d[n] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = k ? 520 : 380;
    band.Q.value = 1.1;
    // the whistle drifts up and down on its own slow cycle
    const drift = ctx.createOscillator();
    drift.frequency.value = k ? 0.071 : 0.053;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = k ? 180 : 140;
    drift.connect(driftDepth).connect(band.frequency);
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 1800;
    src.connect(band).connect(low);
    panned(low, pan).connect(windGain);
    src.start();
    drift.start();
  });
};

let breezeLevel = 0;
let gustLevel = 0;
let gustTimer = 0;
/** A floor under the wind, for when the page is idle and humming. */
export function breeze(level) {
  breezeLevel = level;
}

/** A gust of wind for a few seconds, whatever the scrolling. */
export function gust(level = 0.9, seconds = 4) {
  gustLevel = level;
  clearTimeout(gustTimer);
  gustTimer = setTimeout(() => (gustLevel = 0), seconds * 1000);
}

let scrolled = 0;
let lastY = window.scrollY;
let energy = 0;
let gustiness = 1;
export const windStats = { level: 0 };
window.addEventListener(
  "scroll",
  () => {
    scrolled += Math.abs(window.scrollY - lastY);
    lastY = window.scrollY;
  },
  { passive: true },
);
setInterval(() => {
  // px scrolled in the last tenth of a second, as a share of a brisk scroll
  const pace = Math.min(1, scrolled / 260);
  scrolled = 0;
  energy = energy * 0.9 + pace * 0.1;
  gustiness += (0.7 + Math.random() * 0.6 - gustiness) * 0.05;
  windStats.level = energy;
  if (!on || !windGain) return;
  const target = Math.min(0.22, Math.max(energy ** 0.8, breezeLevel, gustLevel) * gustiness * 0.26);
  const rising = target > windGain.gain.value;
  windGain.gain.setTargetAtTime(target, ctx.currentTime, rising ? 0.9 : 2.6);
}, 100);

function panned(node, pan) {
  if (!ctx.createStereoPanner) return node;
  const p = ctx.createStereoPanner();
  // never hard left or right: single-earbud listeners still hear it
  p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  node.connect(p);
  return p;
}

/**
 * The pad: four quiet voices on the chord, each a sine with a softer
 * triangle a few cents away. Each voice swells and fades on its own slow
 * cycle (15 to 50 seconds), so the chord keeps changing colour instead of
 * holding one tone. A new chord fades in over three seconds while the old
 * one fades out, so sections blend rather than cut.
 */
export function setChord(name) {
  const changed = name !== chord;
  chord = name;
  soundStats.chord = name;
  if (!on) return;
  const now = ctx.currentTime;
  for (const v of voices) {
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(v.env.gain.value, now);
    v.env.gain.linearRampToValueAtTime(0, now + 3.5);
    v.oscs.forEach((o) => o.stop(now + 3.6));
  }
  voices = CHORDS[name].pad.map((f, k) => {
    const env = ctx.createGain();
    env.gain.value = 0;
    env.gain.linearRampToValueAtTime(k === 0 ? 0.022 : 0.015, now + 3);
    // each voice breathes on its own: between a fifth and all of its level
    const breath = ctx.createGain();
    breath.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.02 + Math.random() * 0.045;
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(breath.gain);
    const a = ctx.createOscillator();
    a.type = "sine";
    a.frequency.value = f;
    const b = ctx.createOscillator();
    b.type = "triangle";
    b.frequency.value = f;
    b.detune.value = k % 2 ? 3 : -3;
    b.base = b.detune.value;
    a.base = 0;
    a.detune.value = bent;
    b.detune.value += bent;
    const bg = ctx.createGain();
    bg.gain.value = 0.22;
    a.connect(env);
    b.connect(bg).connect(env);
    env.connect(breath);
    panned(breath, k % 2 ? 0.3 : -0.3).connect(padBus);
    for (const o of [a, b, lfo]) o.start(now);
    return { env, oscs: [a, b, lfo], pitched: [a, b] };
  });
  soundStats.voices = voices.length;
  if (changed || !phraseTimer) phrase();
}

/**
 * The pad comes and goes in phrases. After a chord arrives it plays for
 * half a minute or so, then fades almost to nothing and rests for a while
 * before returning. Scrolling to a new section brings it straight back.
 */
let phraseTimer = 0;
function phrase() {
  const swell = (to, seconds) => {
    const now = ctx.currentTime;
    padBus.gain.cancelScheduledValues(now);
    padBus.gain.setValueAtTime(padBus.gain.value, now);
    padBus.gain.linearRampToValueAtTime(to, now + seconds);
  };
  const rest = () => {
    swell(0.1, 9);
    soundStats.phrase = "resting";
    phraseTimer = setTimeout(back, 9000 + 15000 + Math.random() * 20000);
  };
  const back = () => {
    swell(1, 10);
    soundStats.phrase = "playing";
    phraseTimer = setTimeout(rest, 30000 + Math.random() * 25000);
  };
  clearTimeout(phraseTimer);
  swell(1, 2.5);
  soundStats.phrase = "playing";
  phraseTimer = setTimeout(rest, 25000 + Math.random() * 20000);
}

/** A plucked string. Returns its buffer (the inspector draws it). */
export function pluck(freq, strength = 0.5, pan = 0) {
  if (!on) return null;
  const key = `s${freq}`;
  if (!buffers.has(key)) buffers.set(key, pluckBuffer(ctx, freq));
  const src = ctx.createBufferSource();
  src.buffer = buffers.get(key);
  const gain = ctx.createGain();
  gain.gain.value = 0.12 + 0.6 * Math.min(1, strength);
  src.connect(gain);
  panned(gain, pan).connect(mix.strings);
  src.start();
  soundStats.notes++;
  soundStats.last = buffers.get(key);
  return soundStats.last;
}

/**
 * A soft chime: a sine with a whisper of its octave and twelfth, a 5 ms
 * attack and a long fade, mostly sent to the reverb. Used for small things.
 */
export function chime(freq, gain = 0.05, pan = 0, decay = 2.6) {
  if (!on) return;
  const now = ctx.currentTime;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  [
    [1, 1],
    [2, 0.12],
    [3.01, 0.04],
  ].forEach(([mul, level]) => {
    const o = ctx.createOscillator();
    o.frequency.value = freq * mul;
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(env);
    o.start(now);
    o.stop(now + decay + 0.1);
  });
  panned(env, pan).connect(mix.chimes);
  soundStats.notes++;
}

// Every so often, a few music-box notes from the pentatonic scale.
function sparkle() {
  clearTimeout(sparkleTimer);
  sparkleTimer = setTimeout(sparkle, 5000 + Math.random() * 7000);
  if (!on || document.hidden) return;
  const count = 1 + Math.floor(Math.random() * 3);
  let at = 0;
  for (let k = 0; k < count; k++) {
    const f = PENTATONIC[2 + Math.floor(Math.random() * (PENTATONIC.length - 2))];
    const pan = Math.random() * 1.2 - 0.6;
    setTimeout(() => chime(f, 0.028, pan, 3.4), at);
    at += 260 + Math.random() * 260;
  }
}

function setOn(next) {
  on = next;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(on ? 0.6 : 0, now + (on ? 1.2 : 0.4));
  if (on) {
    if (ctx.state === "suspended") ctx.resume();
    setChord(chord);
    sparkle();
    // two quick notes, so turning it on is heard straight away
    setTimeout(() => chime(659.25, 0.05, 0, 1.4), 200);
    setTimeout(() => chime(880, 0.045, 0, 1.6), 320);
  } else {
    clearTimeout(sparkleTimer);
    clearTimeout(phraseTimer);
    phraseTimer = 0;
    soundStats.phrase = "off";
  }
  notify();
}

// ── The studio: a fader for each layer, kept between visits ──
const MIX_KEY = "bc-mix";
export const LAYERS = [
  { id: "pad", label: "Pad" },
  { id: "strings", label: "Strings" },
  { id: "chimes", label: "Chimes" },
  { id: "wind", label: "Wind" },
  { id: "air", label: "Air" },
  { id: "master", label: "Master" },
];
let levels = { pad: 1, strings: 1, chimes: 1, wind: 1, air: 1, master: 1 };
try {
  levels = { ...levels, ...JSON.parse(localStorage.getItem(MIX_KEY) || "{}") };
} catch {
  // defaults
}

function applyMix() {
  if (!ctx) return;
  for (const [id, node] of Object.entries(mix)) node.gain.setTargetAtTime(levels[id] ?? 1, ctx.currentTime, 0.05);
}

export const getMix = (id) => levels[id] ?? 1;

/** Set one layer's level, 0 (silent) to 1.5 (louder than standard). */
export function setMix(id, value) {
  levels[id] = value;
  applyMix();
  try {
    localStorage.setItem(MIX_KEY, JSON.stringify(levels));
  } catch {
    // not remembered
  }
}

export function resetMix() {
  for (const k of Object.keys(levels)) setMix(k, 1);
}

/** How loud the site is right now, 0 to about 1 (for the studio's meter). */
export function level() {
  if (!meter || ctx.state !== "running") return 0;
  const data = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.min(1, Math.sqrt(sum / data.length) * 6);
}

/**
 * Bend the pad's pitch by `cents` (100 cents = one semitone), as if the
 * record were being dragged. Eases back when called again with 0.
 */
let bent = 0;
export function bend(cents) {
  bent = cents;
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const v of voices) {
    for (const o of v.pitched) o.detune.setTargetAtTime(o.base + cents, now, cents ? 0.03 : 0.25);
  }
}

/** Turn sound on or off. Must be called from a click or key press. */
export function toggleSound(force) {
  wanted = force ?? !wanted;
  try {
    localStorage.setItem(KEY, wanted ? "on" : "off");
  } catch {
    // not remembered; fine
  }
  if (wanted && !ctx && !build()) return false;
  if (ctx) setOn(wanted);
  else notify();
  return wanted;
}

export const isSoundOn = () => on;
/** On, and actually reaching the speakers. */
export const isSoundPlaying = () => on && ctx?.state === "running";
/** What the browser's audio engine is doing: none, suspended, running or closed. */
export const audioState = () => ctx?.state || "none";
export const soundWanted = () => wanted;

/** fn(on, wanted) whenever sound starts or stops. `wanted` is true while
 *  sound is switched on but waiting for the first click to start. */
export function onSound(fn) {
  listeners.add(fn);
  fn(on, wanted);
}

// If the visitor turned sound on last time, start it with their first
// click or key press here (browsers won't play audio before one).
try {
  wanted = localStorage.getItem(KEY) === "on";
} catch {
  wanted = false;
}
if (wanted) {
  const start = (e) => {
    // the sound button itself decides on its own click
    if (e.target.closest?.("[data-sound-toggle]")) return;
    if (!on && wanted) toggleSound(true);
    for (const t of ["pointerdown", "keydown"]) window.removeEventListener(t, start, true);
  };
  for (const t of ["pointerdown", "keydown"]) window.addEventListener(t, start, true);
}
