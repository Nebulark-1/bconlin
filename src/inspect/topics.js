// What the "Behind the scenes" inspector can explain. Each topic names the
// real functions behind a piece of the scene (pulled verbatim from source),
// draws a live visualization of the algorithm, and prints live values.

import drawSrc from "../art/draw.js?raw";
import noiseSrc from "../art/noise.js?raw";
import auroraSrc from "../art/aurora.js?raw";
import mathSrc from "../engine/math.js?raw";
import scrollSrc from "../engine/scroll.js?raw";
import artSrc from "../scenes/houghton/art.js?raw";
import cssSrc from "../styles/houghton.css?raw";
import { rng, ridge, conifer } from "../art/draw.js";
import { valueNoise, smoothstep } from "../art/noise.js";
import { HANCOCK } from "../scenes/houghton/art.js";

const C = { cyan: "#5ec8ff", green: "#6cf0c2", warm: "#ffb48c", violet: "#8f86ff", dim: "rgba(160,200,240,.25)", text: "#bfe6ff" };
const f2 = (v) => (v >= 0 ? " " : "") + v.toFixed(2);

function axes(ctx, w, h) {
  ctx.strokeStyle = "rgba(120,180,240,.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += w / 8) ctx.moveTo(x + 0.5, 0), ctx.lineTo(x + 0.5, h);
  for (let y = 0; y <= h; y += h / 4) ctx.moveTo(0, y + 0.5), ctx.lineTo(w, y + 0.5);
  ctx.stroke();
}

function label(ctx, text, x, y, color = C.text) {
  ctx.fillStyle = color;
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.fillText(text, x, y);
}

function plot(ctx, pts, color, width = 1.5, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── 1. Seeded world ──────────────────────────────────────────
const rngTopic = {
  id: "rng",
  chip: "Seeded world",
  kicker: "Deterministic PRNG",
  title: "One integer generates the whole town",
  summary:
    "Park–Miller “minimal standard” generator: s ← 16807·s mod (2³¹ − 1). Every star, spruce, window and house draws from a stream derived from one global seed, so the scene is byte-identical on every visit, and changing that integer regenerates all of it. The plot shows consecutive outputs (xₙ, xₙ₊₁); a good generator fills the square with no visible lattice.",
  sources: [{ file: "src/art/draw.js", src: drawSrc, name: "rng", marks: ["16807"] }],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const r = rng(33 + S.build.seed); // the stream the hills draw from
    const n = 1400;
    const shown = Math.floor(((t * 500) % (n + 400)));
    let prev = r();
    const size = Math.min(w, h) - 16;
    const ox = (w - size) / 2;
    ctx.fillStyle = C.cyan;
    for (let i = 0; i < Math.min(n, shown); i++) {
      const v = r();
      ctx.globalAlpha = i > shown - 40 ? 1 : 0.55;
      ctx.fillRect(ox + prev * size, 8 + (1 - v) * size, 1.6, 1.6);
      prev = v;
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(94,200,255,.4)";
    ctx.strokeRect(ox + 0.5, 8.5, size, size);
    label(ctx, "xₙ →", ox + size - 30, h - 2);
    label(ctx, "xₙ₊₁", ox - 34, 18);
  },
  live(S) {
    const r = rng(33 + S.build.seed);
    const b = S.build;
    return [
      `seed       ${b.seed}`,
      `hills rng  ${Array.from({ length: 4 }, () => r().toFixed(4)).join("  ")} …`,
      `generated  ${b.trees} spruce · ${b.houses} houses · ${(b.bytes / 1024).toFixed(0)} KB of SVG`,
      `build time ${b.ms.toFixed(1)} ms`,
    ];
  },
  actions: [
    { label: "Reseed the world", run: (scene) => scene.reseed(1 + Math.floor(Math.random() * 99999)) },
    { label: "Reset", run: (scene) => scene.reseed(0) },
  ],
};

// ── 2. Ridgelines ────────────────────────────────────────────
const ridgeTopic = {
  id: "ridge",
  chip: "Ridgelines",
  kicker: "Procedural terrain",
  title: "Control points + octaves of sine",
  summary:
    "Each ridge is a piecewise-linear backbone through hand-placed control points, plus three octaves of sine (frequency ×2.6, amplitude ×½ each step) with seeded phases and a pinch of jitter. The ends are ramped to zero over 60 units so neighboring pieces meet exactly. Below: Hancock’s ridge with the octaves accumulating (wobble amplified ×6).",
  sources: [{ file: "src/art/draw.js", src: drawSrc, name: "ridge", marks: ["Math.sin", "edge"] }],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const parts = [];
    ridge(HANCOCK, { seed: 8 + S.build.seed, amp: 5, parts });
    const x0 = parts[0].x;
    const x1 = parts[parts.length - 1].x;
    const ys = parts.map((p) => p.base);
    const [lo, hi] = [Math.min(...ys) - 40, Math.max(...ys) + 40];
    const X = (x) => 8 + ((x - x0) / (x1 - x0)) * (w - 16);
    const Y = (y) => 8 + ((y - lo) / (hi - lo)) * (h - 16);
    const amp = 6;
    plot(ctx, parts.map((p) => [X(p.x), Y(p.base)]), C.dim, 1, [4, 4]);
    plot(ctx, parts.map((p) => [X(p.x), Y(p.base + p.o1 * amp)]), C.violet, 1);
    plot(ctx, parts.map((p) => [X(p.x), Y(p.base + (p.o1 + p.o2) * amp)]), C.cyan, 1);
    plot(ctx, parts.map((p) => [X(p.x), Y(p.base + (p.o1 + p.o2 + p.o3 + p.jitter) * amp)]), "#fff", 2);
    const k = Math.floor((t * 12) % parts.length);
    const p = parts[k];
    ctx.strokeStyle = C.warm;
    ctx.beginPath();
    ctx.moveTo(X(p.x), 0);
    ctx.lineTo(X(p.x), h);
    ctx.stroke();
    S.ridgeCursor = p;
    label(ctx, "backbone", 10, h - 6, C.dim);
    label(ctx, "+o₁", 80, h - 6, C.violet);
    label(ctx, "+o₂", 112, h - 6, C.cyan);
    label(ctx, "+o₃ + jitter", 144, h - 6, "#fff");
  },
  live(S) {
    const p = S.ridgeCursor;
    if (!p) return [];
    const y = p.base + p.o1 + p.o2 + p.o3 + p.jitter;
    return [
      `x = ${p.x.toFixed(0)}`,
      `y = backbone ${p.base.toFixed(1)}`,
      `  + o₁ ${f2(p.o1)}  + o₂ ${f2(p.o2)}  + o₃ ${f2(p.o3)}  + jitter ${f2(p.jitter)}`,
      `  = ${y.toFixed(2)}`,
    ];
  },
};

// ── 3. Spruce ────────────────────────────────────────────────
const spruceTopic = {
  id: "spruce",
  chip: "Spruce",
  kicker: "Procedural geometry",
  title: "Hundreds of trees, two fills",
  summary:
    "A spruce is built tier by tier: jittered branch tips and notches are pushed down each side, then the outline closes around the trunk. Every tier also emits a snow sliver along its upper edge. forest() concatenates every tree into just two path strings (body and snow), so hundreds of trees cost two DOM nodes instead of thousands.",
  sources: [
    { file: "src/art/draw.js", src: drawSrc, name: "conifer", marks: ["snow +=", "right.push", "left.unshift"] },
    { file: "src/art/draw.js", src: drawSrc, name: "forest", marks: ["body +=", "snow +="] },
  ],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const cycle = 3.2;
    const k = (t % cycle) / cycle;
    const seed = Math.floor(t / cycle);
    const tree = conifer(0, 0, 100, rng(seed * 7 + 3 + S.build.seed), 7);
    const scale = (h - 16) / 100;
    ctx.save();
    ctx.translate(w * 0.3, h - 8);
    ctx.scale(scale, scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-60, -100, 120, 100 * Math.min(1, k * 1.4));
    ctx.clip();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = C.green;
    ctx.fillStyle = "rgba(108,240,194,.08)";
    const body = new Path2D(tree.body);
    ctx.fill(body);
    ctx.stroke(body);
    ctx.fillStyle = "#fff";
    ctx.fill(new Path2D(tree.snow));
    ctx.restore();
    ctx.restore();
    label(ctx, `seed ${seed * 7 + 3}`, w * 0.3 - 30, 14, C.dim);
    // a row of the forest as it gets concatenated
    const r = rng(11 + S.build.seed);
    ctx.save();
    ctx.translate(w * 0.56, h - 14);
    let all = "";
    for (let i = 0; i < 9; i++) all += conifer(i * 22, 0, 26 + r() * 30, r, 4).body;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1;
    ctx.stroke(new Path2D(all));
    ctx.restore();
    label(ctx, "forest(): one <path> per fill", w * 0.56, 14, C.cyan);
  },
  live(S) {
    const b = S.build;
    return [
      `trees in scene      ${b.trees}`,
      `DOM nodes for them  ~12 (two per forest)`,
      `total SVG generated ${(b.bytes / 1024).toFixed(0)} KB in ${b.ms.toFixed(1)} ms`,
    ];
  },
};

// ── 4. Aurora noise ──────────────────────────────────────────
const { noise } = valueNoise();
const auroraTopic = {
  id: "aurora",
  chip: "Aurora noise",
  kicker: "Fractal Brownian motion",
  title: "Value noise, three octaves deep",
  summary:
    "Curtains are driven by 1-D value noise: seeded lattice values blended with a smoothstep curve, then summed over three octaves (fBm). One evaluation positions each curtain’s foot, another sets ray brightness ~110 times across the sky, and a slow one gates where curtains exist at all (shaded). Where the foot line folds steeply, the curtain brightens, as real aurora does seen edge-on.",
  sources: [
    { file: "src/art/noise.js", src: noiseSrc, name: "valueNoise", marks: ["f * f * (3 - 2 * f)", "const fbm"] },
    { file: "src/art/aurora.js", src: auroraSrc, name: "draw", marks: ["fold", "const env", "setTransform(1, 0, 0, -("] },
  ],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const c = S.aurora.curtains?.[0];
    if (!c) return;
    const N = 220;
    const o = [[], [], [], []];
    for (let i = 0; i <= N; i++) {
      const n = i / N;
      const u = n * c.freq * 3 + t * c.drift + c.phase;
      const a = noise(u) * 0.55;
      const b = noise(u * 2.07 + 17) * 0.3;
      const d = noise(u * 4.3 + 41) * 0.15;
      const x = (i / N) * w;
      o[0].push([x, h * 0.95 - a * h * 0.9]);
      o[1].push([x, h * 0.95 - b * h * 0.9]);
      o[2].push([x, h * 0.95 - d * h * 0.9]);
      o[3].push([x, h * 0.95 - (a + b + d) * h * 0.9]);
      const env = smoothstep(0.3, 0.55, S.aurora.fbm(n * 2.2 + t * 0.012 + c.phase));
      if (env > 0.01) {
        ctx.fillStyle = `rgba(108,240,194,${(env * 0.12).toFixed(3)})`;
        ctx.fillRect(x, 0, w / N + 1, h);
      }
    }
    plot(ctx, o[0], C.violet, 1);
    plot(ctx, o[1], C.cyan, 1);
    plot(ctx, o[2], "rgba(255,255,255,.5)", 1);
    plot(ctx, o[3], C.green, 2);
    label(ctx, "0.55·n(u)", 8, 12, C.violet);
    label(ctx, "0.3·n(2.07u)", 76, 12, C.cyan);
    label(ctx, "0.15·n(4.3u)", 162, 12, "rgba(255,255,255,.7)");
    label(ctx, "= fbm(u)", 250, 12, C.green);
  },
  live(S) {
    const a = S.aurora;
    return [
      `rays drawn this frame  ${a.rays ?? 0}`,
      `curtains               ${a.curtains?.length ?? 0} (foot, height, rays, gate: 4 fbm calls per ray)`,
      `shaded band            smoothstep(0.30, 0.55, fbm(2.2x + 0.012t)) > 0`,
    ];
  },
};

// ── 5. Ground plane ──────────────────────────────────────────
const groundTopic = {
  id: "ground",
  chip: "Ground plane",
  kicker: "Affine transforms",
  title: "Making a flat layer lie down",
  summary:
    "The canal touches Lake Superior at the horizon and the shore at the bottom: two layers moving at different parallax speeds. Solving x′ = x + a·y + e and y′ = d·y + f so the top row moves with the lake and the bottom row with the shore yields a shear (a) and a stretch (d). One CSS matrix() per frame turns a flat SVG into a ground plane. Grid below: the live matrix, exaggerated ×8.",
  sources: [{ file: "src/engine/math.js", src: mathSrc, name: "planeMatrix", marks: ["const skew", "const stretch"] }],
  viz(ctx, w, h, t, S) {
    const g = S.ground;
    if (!g) return;
    const E = 8;
    const [, , a, d, e, f] = g.m;
    // map layer pixels to the plot: the canal band [yTop, yBot]
    const top = 18;
    const bot = h - 14;
    const L = w * 0.18;
    const R = w * 0.82;
    const toY = (y) => top + ((y - g.yTop) / (g.yBot - g.yTop)) * (bot - top);
    const warp = (x, y) => {
      const ly = g.yTop + ((y - top) / (bot - top)) * (g.yBot - g.yTop);
      const dx = (a * ly + e) * E;
      const dy = ((d - 1) * ly + f) * E * ((bot - top) / (g.yBot - g.yTop));
      return [x + dx, y + dy];
    };
    ctx.lineWidth = 1;
    for (const [color, fn] of [
      [C.dim, (x, y) => [x, y]],
      [C.cyan, warp],
    ]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const x = L + ((R - L) * i) / 8;
        for (let j = 0; j <= 12; j++) {
          const [px, py] = fn(x, top + ((bot - top) * j) / 12);
          j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
      }
      for (let j = 0; j <= 6; j++) {
        const y = top + ((bot - top) * j) / 6;
        const [ax, ay] = fn(L, y);
        const [bx, by] = fn(R, y);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
    }
    label(ctx, "top row ← lake (depth 0.16)", 8, 12, C.green);
    label(ctx, "bottom row ← shore (depth 0.90)", 8, h - 2, C.warm);
    void toY;
  },
  live(S) {
    const g = S.ground;
    if (!g) return [];
    const [tx, ty] = g.near;
    const [fx, fy] = g.far;
    const span = g.yBot - g.yTop;
    const [, , a, d, e, f] = g.m;
    return [
      `near (lake)  = (${tx.toFixed(1)}, ${ty.toFixed(1)})   far (shore) = (${fx.toFixed(1)}, ${fy.toFixed(1)})`,
      `a = (fx − tx) / (yBot − yTop) = ${(fx - tx).toFixed(1)} / ${span.toFixed(0)} = ${a.toFixed(5)}`,
      `d = 1 + (fy − ty) / ${span.toFixed(0)}           = ${d.toFixed(5)}`,
      `matrix(1, 0, ${a.toFixed(4)}, ${d.toFixed(4)}, ${e.toFixed(1)}, ${f.toFixed(1)})`,
      ...(Math.abs(a) < 1e-4 && Math.abs(d - 1) < 1e-4 ? ["(at rest: move the pointer or scroll to bend the plane)"] : []),
    ];
  },
};

// ── 6. Runner rig ────────────────────────────────────────────
const runnerTopic = {
  id: "runner",
  chip: "Runner rig",
  kicker: "Forward kinematics",
  title: "A two-bone chain per limb",
  summary:
    "Each limb is a chain: thigh → shin, upper arm → forearm. Every joint is its own SVG group pre-translated to its pivot, so a CSS rotate keyframe turns it about the joint, and children inherit the parent’s rotation. The far side runs half a stride out of phase. The figure below is rebuilt live from the browser’s computed joint angles (forward kinematics), with each thigh’s angle traced over time.",
  sources: [
    { file: "src/scenes/houghton/art.js", src: artSrc, name: "runnerLimbs", marks: ['class="thigh', 'class="shin', 'class="arm'] },
    { file: "src/styles/houghton.css", src: cssSrc, name: "@keyframes shin", marks: ["110deg"] },
  ],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const J = S.jointAngles;
    if (!J) return;
    const k = (h - 20) / 80;
    const ox = w * 0.22;
    const oy = h - 10;
    const P = (x, y) => [ox + x * k, oy + y * k];
    const rot = ([x, y], deg) => {
      const r = (deg * Math.PI) / 180;
      return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
    };
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const limb = (side, color) => {
      const hip = [0, -40];
      const knee = add(hip, rot([0, 19], J[`thigh${side}`]));
      const foot = add(knee, rot([0, 19], J[`thigh${side}`] + J[`shin${side}`]));
      const sh = [6, -62];
      const elbow = add(sh, rot([0, 14], J[`arm${side}`]));
      const hand = add(elbow, rot([0, 12], J[`arm${side}`] - 85));
      plot(ctx, [hip, knee, foot].map((p) => P(...p)), color, 3);
      plot(ctx, [sh, elbow, hand].map((p) => P(...p)), color, 3);
      ctx.fillStyle = "#fff";
      for (const p of [hip, knee, sh, elbow]) ctx.fillRect(P(...p)[0] - 2, P(...p)[1] - 2, 4, 4);
    };
    limb("B", "rgba(94,200,255,.5)");
    plot(ctx, [P(0, -40), P(8, -67)], C.cyan, 3);
    ctx.strokeStyle = C.cyan;
    ctx.beginPath();
    ctx.arc(...P(11, -77), 7.5 * k, 0, Math.PI * 2);
    ctx.stroke();
    limb("A", C.cyan);
    // angle traces
    const hist = S.jointHistory;
    const gx = w * 0.45;
    const gw = w * 0.52;
    const mid = h / 2;
    const toPts = (key) => hist.map((s, i) => [gx + (i / 120) * gw, mid - s[key] * (h / 200)]);
    plot(ctx, toPts("thighA"), C.cyan, 1.5);
    plot(ctx, toPts("thighB"), "rgba(94,200,255,.4)", 1.5);
    plot(ctx, toPts("shinA"), C.warm, 1);
    label(ctx, "thigh° (near, far)", gx, 12, C.cyan);
    label(ctx, "shin°", gx + 130, 12, C.warm);
  },
  live(S) {
    const J = S.jointAngles;
    if (!J) return [];
    const d = (v) => `${v.toFixed(0).padStart(4)}°`;
    return [
      `near  thigh ${d(J.thighA)}  shin ${d(J.shinA)}  arm ${d(J.armA)}`,
      `far   thigh ${d(J.thighB)}  shin ${d(J.shinB)}  arm ${d(J.armB)}`,
      `trail x ${S.runnerX.toFixed(0)} → y by lookup into 241 samples`,
    ];
  },
};

// ── 7. Scroll engine ─────────────────────────────────────────
const scrollTopic = {
  id: "scroll",
  chip: "Scroll engine",
  kicker: "Exponential smoothing",
  title: "Motion with weight",
  summary:
    "Scenes don’t follow the scrollbar directly. Every frame, each scene’s progress closes 10% of the remaining gap to the real scroll position (an exponential moving average), so motion has inertia and settles smoothly. Timeline clicks use glideTo(): a time-based cubic ease-in-out whose duration grows with √distance, cancelled the moment you touch the wheel. Plot: raw scroll (dashed) vs what the scene renders.",
  sources: [
    { file: "src/engine/scroll.js", src: scrollSrc, name: "frame", marks: ["lerp(scene.smooth, progress, k)"] },
    { file: "src/engine/scroll.js", src: scrollSrc, name: "glideTo", marks: ["const eased", "Math.sqrt(distance)"] },
  ],
  viz(ctx, w, h, t, S) {
    axes(ctx, w, h);
    const hist = S.history;
    if (!hist.length) return;
    const lo = Math.min(...hist.map((s) => Math.min(s[0], s[1])));
    const hi = Math.max(...hist.map((s) => Math.max(s[0], s[1])));
    const pad = Math.max(0.002, (hi - lo) * 0.15);
    const Y = (v) => h - 8 - ((v - lo + pad) / (hi - lo + pad * 2)) * (h - 16);
    const X = (i) => (i / 239) * w;
    plot(ctx, hist.map((s, i) => [X(i), Y(s[0])]), C.warm, 1.5, [5, 4]);
    plot(ctx, hist.map((s, i) => [X(i), Y(s[1])]), C.cyan, 2);
    label(ctx, "raw", 8, 12, C.warm);
    label(ctx, "smoothed", 40, 12, C.cyan);
    label(ctx, "← last 4 s", w - 70, 12, C.dim);
  },
  live(S) {
    const gap = S.raw - S.p;
    return [
      `raw ${S.raw.toFixed(4)}   rendered ${S.p.toFixed(4)}   gap ${gap.toFixed(4)}`,
      `next = rendered + 0.1 × gap = ${(S.p + 0.1 * gap).toFixed(4)}`,
      `phase  enter ${S.enter.toFixed(2)}  hold ${S.hold.toFixed(2)}  exit ${S.exit.toFixed(2)}`,
    ];
  },
};

export const topics = [rngTopic, ridgeTopic, spruceTopic, auroraTopic, groundTopic, runnerTopic, scrollTopic];
