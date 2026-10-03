import { engine, setChord, pluck, chime, breeze, ambience, CHORDS, PENTATONIC } from "../site/sound.js";
import { PROPOSALS } from "../scenes/chaos/sample.js";

// The career page's sound. Each chapter has its own chord, its own
// atmosphere (how much of the home page's air, wind, and music-box notes
// come through, and how muffled everything is), a quiet room tone, and its
// own small sounds, all synthesized here and all in A major:
//   prologue        the home page's chord and air, nothing else
//   Michigan Tech   a snowy evening: everything muffled, footsteps crunching
//                   through snow, a few ice chimes, a little breeze
//   the law firm    an office: keyboards typed like real sentences, voices
//                   through a wall, and paper you can brush with the cursor
//   the hospital    soft clinical: the heart and pulse-ox following the
//                   monitor's own trace, a breath, the air handling, a
//                   distant call chime, and a tone for each floor event
//   Chaos Coaching  the coach's planned week, played as a melody
// Only the chapter on screen plays; moving on fades its world out.

const CHAPTERS = {
  intro: { chord: "A", amb: {} },
  houghton: { chord: "Acold", amb: { air: 0.5, wind: 0.35, sparkle: false, hush: 1500 }, bed: [380, 0.05] },
  law: { chord: "D", amb: { air: 0.35, wind: 0, sparkle: false, hush: 5200 }, bed: [620, 0.022] },
  uchealth: { chord: "Fsm", amb: { air: 0.3, wind: 0, sparkle: false, hush: 7000 }, bed: [240, 0.04] },
  chaos: { chord: "E", amb: { air: 0.45, wind: 0.3, sparkle: false, hush: 12000 } },
  outro: { chord: "Ahigh", amb: {} },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const later = (ms, fn) => setTimeout(() => {
  const e = engine();
  if (e) fn(e);
}, ms);

// ── Little instruments ──────────────────────────────────────

/** A buffer of `seconds` of sound from fn(t) per sample, cached by key. */
const buffers = new Map();
function makeBuffer(ctx, key, seconds, fn) {
  if (!buffers.has(key)) {
    const length = Math.round(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let n = 0; n < length; n++) d[n] = fn(n / ctx.sampleRate);
    buffers.set(key, buf);
  }
  return buffers.get(key);
}

function panner(e, pan) {
  const p = e.ctx.createStereoPanner();
  p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
  return p;
}

/** Play a buffer through a filter chain, panned, at a gain, at `when` (s from now). */
function play(e, buf, { gain = 0.05, pan = 0, filters = [], verb = 0, rate = 1, when = 0 } = {}) {
  const src = e.ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  let node = src;
  for (const [type, freq, q = 0.7] of filters) {
    const f = e.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    node = node.connect(f);
  }
  const g = e.ctx.createGain();
  g.gain.value = gain;
  node = node.connect(g).connect(panner(e, pan));
  node.connect(e.fx);
  if (verb) {
    const v = e.ctx.createGain();
    v.gain.value = verb;
    node.connect(v).connect(e.verb);
  }
  src.start(e.ctx.currentTime + when);
}

/** A sine "bell" with a few partials, each fading at its own rate. */
function bell(e, freq, { gain = 0.02, pan = 0, decay = 3, partials = [[1, 1]], verb = 0.6, attack = 0.004 } = {}) {
  const now = e.ctx.currentTime;
  const out = e.ctx.createGain();
  out.gain.value = gain;
  for (const [mul, level, life = 1] of partials) {
    const o = e.ctx.createOscillator();
    o.frequency.value = freq * mul;
    const env = e.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(level, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay * life);
    o.connect(env).connect(out);
    o.start(now);
    o.stop(now + decay * life + 0.05);
  }
  const tail = out.connect(panner(e, pan));
  tail.connect(e.fx);
  if (verb) {
    const v = e.ctx.createGain();
    v.gain.value = verb;
    tail.connect(v).connect(e.verb);
  }
}

/** A low thump with a falling pitch (a heart sound, a footfall). */
function thump(e, { from = 62, to = 38, gain = 0.1, length = 0.16, pan = 0 } = {}) {
  const now = e.ctx.currentTime;
  const o = e.ctx.createOscillator();
  o.frequency.setValueAtTime(from, now);
  o.frequency.exponentialRampToValueAtTime(to, now + length * 0.75);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, now + length);
  o.connect(g).connect(panner(e, pan)).connect(e.fx);
  o.start(now);
  o.stop(now + length + 0.05);
}

/**
 * A room tone: a soft bed of dark noise, looping, faded in and out with
 * its chapter. The snow's hush, an office, a hospital's air handling.
 */
function bed(e, [cutoff, gain]) {
  const buf = makeBuffer(e.ctx, "bed", 6, (() => {
    let b = 0;
    return () => (b = b * 0.985 + (Math.random() * 2 - 1) * 0.06);
  })());
  const src = e.ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = e.ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = e.ctx.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(gain, e.ctx.currentTime, 1.5);
  src.connect(f).connect(g).connect(e.fx);
  src.start();
  return () => {
    g.gain.setTargetAtTime(0, e.ctx.currentTime, 0.8);
    src.stop(e.ctx.currentTime + 4);
  };
}

// ── Michigan Tech: a snowy evening ──────────────────────────

/**
 * One footstep in snow: lots of tiny cracks (crystals breaking under the
 * shoe) bunched into a short burst, with a soft heel thud under it. Each
 * crack is a few hundredths of a second of noise; their density swells and
 * fades over the step. Eight versions, so steps never repeat exactly.
 */
function crunch(e, pan, loud) {
  const k = Math.floor(Math.random() * 8);
  const buf = makeBuffer(e.ctx, `crunch${k}`, 0.3, (() => {
    let grain = 0;
    let amp = 0;
    return (t) => {
      const swell = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 9);
      if (grain <= 0 && Math.random() < 0.012 * swell) {
        grain = 30 + Math.random() * 160; // samples
        amp = 0.3 + Math.random() * 0.7;
      }
      if (grain > 0) grain--;
      return (Math.random() * 2 - 1) * (grain > 0 ? amp : 0.04) * swell;
    };
  })());
  play(e, buf, { gain: 0.2 * loud, pan, filters: [["highpass", 600], ["peaking", 2600, 1]], rate: rand(0.92, 1.06) });
  thump(e, { from: 90, to: 50, gain: 0.03 * loud, length: 0.09, pan });
}

/** Ice chimes, far off: glassy, high, and quiet, deep in the reverb. */
const ICE = [880, 987.77, 1108.73, 1318.51, 1479.98, 1760];
const GLASS = [[1, 1, 1], [2.32, 0.35, 0.6], [4.25, 0.12, 0.35]];
function icicle(e, freq, pan) {
  bell(e, freq, { gain: rand(0.005, 0.009), pan, decay: rand(2.4, 3.4), partials: GLASS, verb: 1.3 });
}

// ── The law firm: an office ─────────────────────────────────

/**
 * A mechanical key, like a Cherry MX: a sharp click as it actuates, the
 * clack of the cap bottoming out a moment later, and a lighter tick as it
 * springs back up. The space bar is lower and rattles a little.
 */
const tick = (rate) => (t) => (Math.random() * 2 - 1) * Math.exp(-t * rate);
function key(e, pan, { space = false, near = 1 } = {}) {
  const click = makeBuffer(e.ctx, "mx-click", 0.02, tick(900));
  const clack = makeBuffer(e.ctx, "mx-clack", 0.05, tick(260));
  const up = makeBuffer(e.ctx, "mx-up", 0.02, tick(700));
  const room = [["lowpass", 3000 + 4000 * near]];
  const g = 0.06 * near;
  if (space) {
    play(e, clack, { gain: g * 1.3, pan, filters: [["bandpass", 820, 1.1], ...room] });
    play(e, clack, { gain: g * 0.5, pan, filters: [["bandpass", 1700, 2], ...room], when: 0.012 });
  } else {
    play(e, click, { gain: g * 0.55, pan, filters: [["bandpass", 5200, 2.5], ...room] });
    play(e, clack, { gain: g, pan, filters: [["bandpass", rand(1900, 2400), 1.4], ...room], when: rand(0.008, 0.014) });
  }
  play(e, up, { gain: g * 0.35, pan, filters: [["bandpass", space ? 1300 : 3300, 2], ...room], when: rand(0.07, 0.13) });
}

// How long English words are, roughly: [letters, how common]
const WORD_LENGTHS = [[1, 3], [2, 17], [3, 20], [4, 16], [5, 11], [6, 9], [7, 8], [8, 6], [9, 4], [10, 3], [11, 2], [12, 1]];
function wordLength() {
  let r = Math.random() * 100;
  for (const [n, w] of WORD_LENGTHS) if ((r -= w) <= 0) return n;
  return 4;
}
const keyGap = () => 125 * Math.exp((Math.random() - 0.5) * 0.7); // ms, a typist's rhythm

/**
 * One sentence, typed: words of realistic lengths, a space after each, a
 * hesitation before some words, the odd typo fixed with a few backspaces,
 * and a full stop. Returns how long it took (ms).
 */
function typeSentence(e, pan, near, isLive) {
  const words = Math.floor(rand(5, 15));
  let at = 0;
  const press = (space = false) => {
    later(at, (live) => isLive() && key(live, pan, { space, near }));
  };
  for (let w = 0; w < words; w++) {
    if (Math.random() < 0.18) at += rand(250, 700); // thinking of the next word
    const letters = wordLength();
    for (let l = 0; l < letters; l++) {
      press();
      at += keyGap();
    }
    if (Math.random() < 0.06) {
      // a typo: back up a couple of letters and fix them
      at += rand(150, 300);
      for (let b = 0; b < 2; b++) (press(), (at += 80));
      for (let b = 0; b < 2; b++) (press(), (at += keyGap()));
    }
    if (Math.random() < 0.1) (press(), (at += keyGap())); // a comma
    at += rand(20, 60);
    press(true);
    at += keyGap() * 1.3;
  }
  press(); // the full stop
  return at;
}

/**
 * Voices through a wall: a buzzing source shaped by two moving formants (the
 * vowels), cut into syllables, then heavily low-passed so no words survive.
 */
function utterance(e, pan, low) {
  const now = e.ctx.currentTime;
  const length = rand(1.4, 3.6);
  const o = e.ctx.createOscillator();
  o.type = "sawtooth";
  const base = low ? rand(105, 125) : rand(175, 210);
  o.frequency.setValueAtTime(base, now);
  const f1 = e.ctx.createBiquadFilter();
  f1.type = "bandpass";
  f1.Q.value = 6;
  const f2 = e.ctx.createBiquadFilter();
  f2.type = "bandpass";
  f2.Q.value = 8;
  const env = e.ctx.createGain();
  env.gain.setValueAtTime(0, now);
  for (let t = 0; t < length; t += rand(0.13, 0.26)) {
    o.frequency.linearRampToValueAtTime(base * rand(0.88, 1.15), now + t + 0.08);
    f1.frequency.setValueAtTime(rand(320, 760), now + t);
    f2.frequency.setValueAtTime(rand(950, 2100), now + t);
    env.gain.linearRampToValueAtTime(Math.random() < 0.18 ? 0 : rand(0.6, 1), now + t + 0.04);
    env.gain.linearRampToValueAtTime(0.15, now + t + 0.12);
  }
  env.gain.linearRampToValueAtTime(0, now + length + 0.1);
  const wall = e.ctx.createBiquadFilter();
  wall.type = "lowpass";
  wall.frequency.value = 520;
  const g = e.ctx.createGain();
  g.gain.value = 0.035;
  o.connect(f1).connect(env);
  o.connect(f2).connect(env);
  env.connect(wall).connect(g).connect(panner(e, pan)).connect(e.fx);
  o.start(now);
  o.stop(now + length + 0.2);
}

/** Paper: a quick, crinkly rush of bright noise. */
function paper(e, pan, loud = 1) {
  const k = Math.floor(Math.random() * 4);
  const buf = makeBuffer(e.ctx, `paper${k}`, 0.32, (t) => {
    const env = Math.sin(Math.min(1, t / 0.32) * Math.PI) ** 1.5;
    const crinkle = Math.random() < 0.35 ? Math.random() : Math.random() * 0.25;
    return (Math.random() * 2 - 1) * crinkle * env;
  });
  play(e, buf, { gain: 0.07 * loud, pan, filters: [["highpass", 1800], ["bandpass", 4200, 0.5]], rate: rand(0.85, 1.15) });
}

// ── The hospital: soft clinical ─────────────────────────────

/** The pulse-ox beep: its pitch rises and falls with the oxygen reading, like a real monitor. */
function pulseBeep(e, spo2) {
  const f = 660 + (Math.max(85, Math.min(100, spo2)) - 85) * 26; // 98% ≈ 1000 Hz
  bell(e, f, { gain: 0.03, decay: 0.16, partials: [[1, 1, 1], [3, 0.08, 0.5]], verb: 0.15, attack: 0.006 });
}

/** A slow breath: dark noise swelling in and out. */
function breath(e) {
  const buf = makeBuffer(e.ctx, "breath", 3.6, (t) => (Math.random() * 2 - 1) * Math.sin((t / 3.6) * Math.PI) ** 2);
  play(e, buf, { gain: 0.05, filters: [["lowpass", 650], ["highpass", 140]] });
}

/** A nurse call, far down the hall: two soft notes. */
function callChime(e) {
  const pan = rand(-0.6, 0.6);
  [659.25, 554.37].forEach((f, k) => later(k * 420, (live) => bell(live, f, { gain: 0.012, pan, decay: 1.8, partials: [[1, 1, 1], [2, 0.1, 0.4]], verb: 1 })));
}

// What happened on the floor plan, by the words in its log line.
const FLOOR = [
  [/admitted/, [554.37, 659.25]],
  [/case started/, [329.63]],
  [/to PACU/, [659.25, 554.37]],
  [/discharged/, [659.25, 880, 1108.73]],
  [/surge/, [440, 554.37, 659.25, 880]],
  [/closed|open/, [493.88]],
];
function floorEvent(e, line) {
  const match = FLOOR.find(([re]) => re.test(line));
  if (!match) return;
  const pan = rand(-0.4, 0.4);
  match[1].forEach((f, k) => later(k * 140, (live) => bell(live, f, { gain: 0.016, pan, decay: 1.4, partials: [[1, 1, 1], [3, 0.12, 0.4]], verb: 0.5 })));
}

// ── Chaos Coaching: the coach composes the week ─────────────

/**
 * The planned week, played as a melody: one beat a day, Monday to Sunday.
 * A run is a plucked string, higher for more miles, with a second note on
 * top for a hard session. Lifting is a low pluck, the bike a soft chime,
 * mobility a high one, and a rest day is silence.
 */
const RUN_NOTES = [164.81, 185, 207.65, 246.94, 277.18, 329.63, 369.99, 415.3, 493.88]; // E major pentatonic
function playWeek(plan, gentle) {
  plan.days.forEach((day, i) => {
    later(i * 520, () => {
      day.sessions.forEach((s, j) => {
        later(j * 110, () => {
          const pan = -0.6 + (i / 6) * 1.2;
          const soft = gentle ? 0.5 : 1;
          if (s.sport === "run") {
            const f = RUN_NOTES[Math.min(RUN_NOTES.length - 1, Math.round(s.miles / 1.3))] * (gentle ? 0.5 : 1);
            pluck(f, 0.7 * soft, pan, 4);
            if (s.hard) later(90, () => pluck(f * 1.5, 0.45 * soft, pan, 4));
          } else if (s.sport === "lift") pluck(82.41, 0.6 * soft, pan, 4);
          else if (s.sport === "bike") chime(246.94, 0.03 * soft, pan, 1.6);
          else chime(659.25, 0.02 * soft, pan, 1.2);
        });
      });
    });
  });
  return 7 * 520;
}

/** A soft tap, for the app changing screen. */
function tap(e, freq = 1320, gain = 0.02, pan = 0) {
  bell(e, freq, { gain, pan, decay: 0.12, partials: [[1, 1, 1]], verb: 0.1 });
}

/** The guardrails' verdict: a chime that passes, a softer warning, or a low hold. */
function verdict(e, kind) {
  const notes = kind === "ok" ? [659.25, 987.77] : kind === "warn" ? [493.88, 440] : [164.81];
  notes.forEach((f, k) =>
    later(k * 160, (live) => bell(live, f, { gain: kind === "block" ? 0.04 : 0.03, decay: kind === "block" ? 2.4 : 1.4, partials: [[1, 1, 1], [2, 0.2, 0.5]], verb: 0.6 })),
  );
}

// ── The conductor ───────────────────────────────────────────

/** root: the career page. Returns { setChapter, card, frame, stop, glide }. */
export function createSoundscape(root) {
  let chapter = null;
  let stopBed = null;
  const next = {}; // when each recurring sound is next due
  const due = (name, now, wait) => {
    if ((next[name] ?? 0) > now) return false;
    next[name] = now + wait;
    return true;
  };
  let step = 0;
  const here = (id) => () => chapter === id;

  // the hospital: the monitor's own trace says when each beat lands
  const uch = root.querySelector(".scene--uch");
  const spo2El = uch?.querySelector(".mon-num--spo2 b");
  uch?.addEventListener("beat", (ev) => {
    const e = engine();
    if (!e || chapter !== "uchealth") return;
    const wave = ev.detail.wave;
    if (wave === "R") thump(e, { from: 64, to: 40, gain: 0.13, length: 0.16 }); // lub
    else if (wave === "T") thump(e, { from: 74, to: 46, gain: 0.08, length: 0.12 }); // dub
    else pulseBeep(e, Number(spo2El?.textContent) || 98);
  });
  const logEl = uch?.querySelector(".mon-log");
  let lastLine = "";
  if (logEl) {
    new MutationObserver(() => {
      const line = logEl.textContent.split("\n")[0] || "";
      if (line && line !== lastLine && chapter === "uchealth") {
        const e = engine();
        if (e) floorEvent(e, line);
      }
      lastLine = line;
    }).observe(logEl, { childList: true, characterData: true, subtree: true });
  }

  // Chaos Coaching: a tap when the app changes tab, a chime for the verdict,
  // and the week being judged becomes the melody
  let week = PROPOSALS[0].plan;
  let held = false;
  root.querySelectorAll(".scene--chaos .cc-nav [data-tab]").forEach((tab) =>
    new MutationObserver(() => {
      const e = engine();
      if (e && chapter === "chaos" && tab.classList.contains("is-on")) tap(e);
    }).observe(tab, { attributes: true, attributeFilter: ["class"] }),
  );
  const verdictEl = root.querySelector(".scene--chaos .cc-check__verdict");
  const weekEl = root.querySelector(".scene--chaos .cc-check__week");
  if (verdictEl) {
    new MutationObserver(() => {
      const label = weekEl?.textContent || "";
      week = (PROPOSALS.find((p) => label.includes(p.label)) || PROPOSALS[0]).plan;
      held = verdictEl.classList.contains("is-block");
      const e = engine();
      if (!e || chapter !== "chaos") return;
      verdict(e, held ? "block" : verdictEl.classList.contains("is-warn") ? "warn" : "ok");
    }).observe(verdictEl, { attributes: true, attributeFilter: ["class"] });
  }

  // the law firm: brush the papers and they shuffle (and ripple)
  const blg = root.querySelector(".scene--blg");
  const visual = blg?.querySelector(".blg-visual");
  let lastPaper = 0;
  blg?.addEventListener("pointermove", (ev) => {
    const now = performance.now();
    if (chapter !== "law" || now - lastPaper < 110) return;
    // the sheets don't take the pointer, so find the one under it by position
    const sheets = [...(visual?.querySelectorAll(".sheet") || [])].reverse();
    const sheet = sheets.find((s) => {
      const r = s.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    });
    if (!sheet) return;
    lastPaper = now;
    sheet.classList.remove("is-rustle");
    void sheet.offsetWidth;
    sheet.classList.add("is-rustle");
    const e = engine();
    if (e) paper(e, (ev.clientX / window.innerWidth) * 2 - 1, Math.min(1, Math.hypot(ev.movementX, ev.movementY) / 25 + 0.35));
  });

  return {
    get chapter() {
      return chapter;
    },

    setChapter(id) {
      if (id === chapter || !CHAPTERS[id]) return;
      chapter = id;
      const c = CHAPTERS[id];
      setChord(c.chord);
      ambience(c.amb);
      breeze(id === "houghton" ? 0.1 : 0);
      stopBed?.();
      stopBed = null;
      const e = engine();
      if (e && c.bed) stopBed = bed(e, c.bed);
      for (const k of Object.keys(next)) next[k] = performance.now() + rand(300, 1500);
    },

    /** Sound turned on or off while on the page: start or stop the room tone. */
    refresh() {
      stopBed?.();
      stopBed = null;
      const e = engine();
      const c = CHAPTERS[chapter];
      if (e && c?.bed) stopBed = bed(e, c.bed);
      if (c) ambience(c.amb);
    },

    /** A new résumé card in chapter id: a small sound in that chapter's voice. */
    card(id) {
      const e = engine();
      if (!e) return;
      if (id === "houghton") [1318.51, 1760].forEach((f, k) => later(k * 120, (live) => icicle(live, f, k ? 0.3 : -0.3)));
      else if (id === "law") paper(e, rand(-0.3, 0.3), 1);
      else if (id === "uchealth") [880, 1108.73].forEach((f, k) => later(k * 110, (live) => bell(live, f, { gain: 0.016, decay: 0.6 })));
      else if (id === "chaos") [1318.51, 1760, 2217.46].forEach((f, k) => later(k * 70, (live) => tap(live, f, 0.02)));
    },

    frame(now) {
      const e = engine();
      if (!e || !chapter) return;

      if (chapter === "houghton") {
        // a runner's steady footsteps, alternating feet, never quite even
        if (due("step", now, rand(318, 352))) {
          step++;
          crunch(e, step % 2 ? -0.15 : 0.15, step % 2 ? 0.85 : 1);
        }
        if (due("ice", now, rand(3500, 8000))) icicle(e, pick(ICE), rand(-0.7, 0.7));
      } else if (chapter === "law") {
        // two people typing real-ish sentences, one close, one across the room
        for (const [who, pan, near] of [["typistA", -0.4, 1], ["typistB", 0.5, 0.55]]) {
          if ((next[who] ?? 0) > now) continue;
          const took = typeSentence(e, pan, near, here("law"));
          next[who] = now + took + rand(900, 4200); // a pause between sentences
        }
        if (due("talk", now, rand(2600, 7000))) utterance(e, rand(-0.6, 0.6), Math.random() < 0.5);
      } else if (chapter === "uchealth") {
        if (due("breath", now, 60000 / 14)) breath(e); // the monitor's respiratory rate
        if (due("call", now, rand(18000, 38000))) callChime(e);
      } else if (chapter === "chaos") {
        if (due("week", now, 0)) next.week = now + playWeek(week, held) + rand(2200, 3600);
      }
    },

    /** The rail: hovering a stop plucks its chapter's string, softly. */
    stop(index, sub) {
      if (!engine()) return;
      const strings = CHORDS.A.strings;
      if (sub) chime(PENTATONIC[(index + 2) % PENTATONIC.length], 0.006, -0.6, 1);
      else pluck(strings[index % strings.length] * (index > 3 ? 2 : 1), 0.1, -0.6);
    },

    /** The rail: jumping to a stop plays a soft rising run as the page glides. */
    glide() {
      if (!engine()) return;
      PENTATONIC.slice(0, 5).forEach((f, k) => setTimeout(() => chime(f, 0.009, -0.5 + k * 0.25, 1.2), k * 90));
    },
  };
}
