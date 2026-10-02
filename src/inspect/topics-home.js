// Inspector topics for the home page. Everything shown here is this site's
// own code, imported verbatim.

import fieldSrc from "../home/field.js?raw";
import structuresSrc from "../home/structures.js?raw";
import soundSrc from "../site/sound.js?raw";
import rainSrc from "../site/rain.js?raw";
import faviconSrc from "../home/favicon.js?raw";
import { dotLayout, PER } from "../home/structures.js";
import { clamp } from "../engine/math.js";
import { COLORS } from "../home/palette.js";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", accent: "#ffb48c" };
const IDS = ["houghton", "law", "uchealth", "chaos"];

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// ── Which structure gets the points ─────────────────────────
const racingTopic = {
  id: "racing",
  chip: "Racing to fill",
  kicker: "Whatever's in view",
  provenance: "site",
  vizHeight: 150,
  title: "Where the 400 points go",
  summary:
    "Every frame, whichever structure sits closest to the middle of the window gets all 400 points. When that changes they all head over, strings from their 2021 end and dots in a wave. The bars show how close each one is.",
  sources: [{ file: "src/home/field.js", src: fieldSrc, name: "chooseActive" }],
  viz(ctx, w, h, t, S) {
    const list = S.structures;
    const rows = list.length;
    const rh = (h - 8) / rows;
    list.forEach((s, k) => {
      const y = 4 + k * rh + rh / 2;
      const score = S.field.stats.scores[k];
      const on = s.id === S.field.stats.active;
      label(ctx, s.id, 8, y + 3, on ? C.hot : C.dim, 9);
      ctx.fillStyle = on ? C.hot : C.line;
      const len = score == null ? 0 : clamp(1 - Math.max(0, score) / 600) * (w - 110);
      ctx.fillRect(96, y - 3, Math.max(2, len), 6);
      if (score == null) label(ctx, "off screen", 100, y + 3, C.dim, 9);
    });
  },
  live(S) {
    return [`points at  ${S.field.stats.active}`, `moving     ${S.field.stats.travelling} / 400`];
  },
};

// ── Springs ─────────────────────────────────────────────────
const springsTopic = {
  id: "springs",
  chip: "Springs",
  kicker: "400 points, one rule",
  provenance: "site",
  vizHeight: 160,
  title: "Why the strings ripple",
  summary:
    "Every point is a spring pulled toward its spot. String points also pull on their two neighbors, and that tension is what turns a flick into a wave. The chart shows how far each point is from rest.",
  sources: [{ file: "src/home/field.js", src: fieldSrc, name: "step", marks: ["const T = 3000 * s;"] }],
  viz(ctx, w, h, t, S) {
    const rh = (h - 10) / 4;
    for (let s = 0; s < 4; s++) {
      const mid = 5 + rh * s + rh / 2;
      ctx.strokeStyle = C.line;
      ctx.beginPath();
      ctx.moveTo(10, mid);
      ctx.lineTo(w - 10, mid);
      ctx.stroke();
      ctx.strokeStyle = COLORS[IDS[s]];
      ctx.beginPath();
      for (let k = 0; k < PER; k++) {
        const p = S.field.pts[s * PER + k];
        const d = clamp(Math.hypot(p.x - p.tx, p.y - p.ty) * Math.sign(p.vy || 1), -30, 30);
        const x = 10 + (k / (PER - 1)) * (w - 20);
        k ? ctx.lineTo(x, mid - d * (rh / 70)) : ctx.moveTo(x, mid - d * (rh / 70));
      }
      ctx.stroke();
    }
  },
  live(S) {
    return [`energy ${S.field.stats.energy.toFixed(1)}   plucks ${S.field.stats.plucks}`];
  },
};

// ── Karplus-Strong ──────────────────────────────────────────
const pluckTopic = {
  id: "pluck",
  chip: "Plucked strings",
  kicker: "Sound from arithmetic",
  provenance: "site",
  vizHeight: 130,
  title: "Synthesizing a string",
  summary:
    "Karplus-Strong (1983). Fill a loop one period long with noise, then keep averaging neighboring samples. The hiss dies off and what's left sounds like a plucked string. Each section retunes the strings to its chord. The chart is the last note.",
  sources: [{ file: "src/site/sound.js", src: soundSrc, name: "pluckBuffer", marks: ["0.5 * (out[n - period] + out[n - period - 1])"] }],
  viz(ctx, w, h, t, S) {
    const buf = S.sound.last;
    if (!buf) return label(ctx, "turn sound on, then brush a string", w / 2, h / 2, C.dim, 10, "center");
    const data = buf.getChannelData(0);
    const step = Math.floor(data.length / w);
    ctx.strokeStyle = C.hot;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let peak = 0;
      for (let j = x * step; j < (x + 1) * step; j++) peak = Math.max(peak, Math.abs(data[j] || 0));
      ctx.moveTo(x, h / 2 - peak * (h / 2 - 8));
      ctx.lineTo(x, h / 2 + peak * (h / 2 - 8));
    }
    ctx.stroke();
  },
  live(S) {
    return [`chord ${S.sound.chord}   notes played ${S.sound.notes}`];
  },
};

// ── Ambience ────────────────────────────────────────────────
const ambienceTopic = {
  id: "ambience",
  chip: "Ambience",
  kicker: "A chord for every section",
  provenance: "site",
  vizHeight: 110,
  title: "The pad under everything",
  summary:
    "With sound on, a quiet pad plays under the page: four voices on the current section's chord, through a low-pass filter that slowly opens and closes. The hero is A, the timeline F♯ minor, the results D, and the strings at the bottom A again, up high. Every chord is in A major, so the plucks, the margin chimes, and the occasional music-box notes always agree with the pad. Each voice swells and fades on its own slow cycle, and the pad plays in phrases: after half a minute or so it fades almost to nothing and rests before returning. Scrolling to a new section cross-fades the chord and brings the pad back. Scrolling also stirs up a soft wind that dies away slowly once you stop.",
  sources: [
    { file: "src/site/sound.js", src: soundSrc, name: "setChord" },
    { file: "src/site/sound.js", src: soundSrc, name: "phrase" },
  ],
  viz(ctx, w, h, t, S) {
    const names = ["A", "Fsm", "D", "Ahigh"];
    const cw = (w - 50) / names.length;
    names.forEach((n, k) => {
      const on = S.sound.chord === n;
      const x = 10 + k * (cw + 10);
      ctx.strokeStyle = on ? C.hot : C.line;
      ctx.strokeRect(x, 10, cw, h - 36);
      if (on) {
        ctx.fillStyle = "rgba(159,227,255,.12)";
        ctx.fillRect(x, 10, cw, h - 36);
      }
      label(ctx, { A: "A add9", Fsm: "F♯m7", D: "Dmaj7", Ahigh: "A, high" }[n], x + cw / 2, h - 10, on ? C.text : C.dim, 9, "center");
      for (let v = 0; v < 4; v++) {
        const y = 22 + v * ((h - 56) / 3);
        ctx.fillStyle = on ? C.hot : C.dim;
        ctx.globalAlpha = on ? 0.5 + 0.5 * Math.sin(t * 1.4 + v) ** 2 : 0.4;
        ctx.fillRect(x + 8, y, cw - 16, 2);
        ctx.globalAlpha = 1;
      }
    });
  },
  live(S) {
    return [`chord ${S.sound.chord}   voices ${S.sound.voices}   pad ${S.sound.phrase}`];
  },
};

// ── Margin rain ─────────────────────────────────────────────
const rainTopic = {
  id: "rain",
  chip: "Margin rain",
  kicker: "Motes and beads",
  provenance: "site",
  vizHeight: 90,
  title: "What's falling down the sides",
  summary:
    "Beads are scattered at random with a minimum gap and stay fixed while the page scrolls. Motes bounce off them with a small random nudge, and each bead rings its own note from the A major pentatonic, louder the harder it's hit. Left leans left and right leans right, but never all the way, so one earbud still hears both.",
  sources: [{ file: "src/site/rain.js", src: rainSrc, name: "collide", marks: ["chime(peg.note"] }],
  viz(ctx, w, h, t, S) {
    const r = S.rain.stats;
    label(ctx, r.enabled ? `${r.motes} motes falling` : "no room beside the page for rain", 10, 22, C.text, 11);
    label(ctx, `${r.pegs} beads`, 10, 44, C.dim, 10);
    label(ctx, `${r.hits} bounces so far`, 10, 64, C.dim, 10);
    if (r.lastNote) label(ctx, `last note ${Math.round(r.lastNote)} Hz`, w - 10, 22, C.hot, 10, "right");
  },
  live(S) {
    return [`motes ${S.rain.stats.motes}   bounces ${S.rain.stats.hits}`];
  },
};

// ── 400 dots ────────────────────────────────────────────────
const dotsTopic = {
  id: "dots",
  chip: "400 dots",
  kicker: "Same points, new shape",
  provenance: "site",
  vizHeight: 140,
  title: "Four charts from four strings",
  summary:
    "The charts are the strings, frayed. <code>dotLayout</code> puts point <code>i</code> somewhere in each chart, one real unit per point. The faint circles are the same layout, empty.",
  sources: [{ file: "src/home/structures.js", src: structuresSrc, name: "dotLayout", marks: ["arrive"] }],
  viz(ctx, w, h, t, S) {
    const cw = (w - 50) / 4;
    for (let b = 0; b < 4; b++) {
      const box = { x: 10 + b * (cw + 10), y: 8, w: cw, h: h - 30 };
      const on = S.field.stats.active === `chart ${b + 1}`;
      ctx.strokeStyle = on ? C.hot : C.line;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = on ? C.hot : C.dim;
      for (let i = 0; i < 400; i++) {
        const d = dotLayout(b, i, box, 1);
        if (d.a < 0.05 || d.r < 0.2) continue;
        ctx.globalAlpha = d.a;
        ctx.fillRect(d.x - 0.8, d.y - 0.8, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      label(ctx, `chart ${b + 1}`, box.x + box.w / 2, h - 8, on ? C.text : C.dim, 9, "center");
    }
  },
  live(S) {
    return [`points at ${S.field.stats.active}`];
  },
};

// ── Live favicon ────────────────────────────────────────────
const faviconTopic = {
  id: "favicon",
  chip: "Live tab icon",
  kicker: "Look at your browser tab",
  provenance: "site",
  vizHeight: 150,
  title: "The page, 32 pixels wide",
  summary:
    "The tab icon is the page at 32 by 32 pixels, redrawn a few times a second. Pluck a string and it wobbles there too. Here it is bigger.",
  sources: [{ file: "src/home/favicon.js", src: faviconSrc, name: "drawFavicon" }],
  viz(ctx, w, h, t, S) {
    const size = h - 20;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(S.favicon.canvas, (w - size) / 2, 10, size, size);
    ctx.drawImage(S.favicon.canvas, 12, h - 42, 32, 32);
    label(ctx, "actual size", 12, h - 46, C.dim, 9);
  },
  live() {
    return ["redrawn every 220 ms"];
  },
};

export const homeTopics = [racingTopic, springsTopic, pluckTopic, ambienceTopic, rainTopic, dotsTopic, faviconTopic];
