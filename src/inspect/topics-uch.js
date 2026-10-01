// Inspector topics for the UCHealth chapter: the simulation that drives the
// floor plan, the math behind the heartbeat, and the skills the job builds.

import hospitalSrc from "../scenes/uch/hospital.js?raw";
import ecgSrc from "../scenes/uch/ecg.js?raw";
import mapfSrc from "../scenes/uch/mapf.js?raw";
import { COLS, ROWS } from "../scenes/uch/layout.js";
import { ROLE_COLORS, roleOf } from "../scenes/uch/plan.js";
import { WAVES, ecg } from "../scenes/uch/ecg.js";
import { SKILLS } from "../scenes/uch/skills.js";

const C = { green: "#39ff88", cyan: "#3fe0ff", yellow: "#ffd23f", red: "#ff6b6b", dim: "rgba(160,200,240,.35)", text: "#bfe6ff" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function line(ctx, pts, color, width = 1.5) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

// ── Patient flow ────────────────────────────────────────────
const flowTopic = {
  id: "flow",
  chip: "Patient flow",
  kicker: "Agent-based simulation · coroutines",
  provenance: "site",
  vizHeight: 190,
  title: "Everyone in the department is a coroutine",
  summary:
    "Each patient, nurse, surgeon and anesthesiologist, and each OR, runs as a JavaScript generator that <code>yield</code>s a “wait until …” condition; the engine resumes it when the condition holds. That keeps the workflow readable, step by step: a pre-op nurse (three patients at most) walks a patient from waiting to a bay and preps them, then leaves them to rest; their surgeon and anesthesiologist each come by for consent; the OR’s own nurse fetches them; anesthesia covers two rooms and attends induction and emergence; a PACU nurse wheels them to recovery, where the lights come up as they get closer to going home. Every stage is a finite pool, so a full PACU backs up the ORs, which back up pre-op. The live numbers check Little’s Law: average census L should match arrival rate λ × average stay W. Try a surge, or close two ORs.<br><br>Workflow simplified and timings compressed (seconds, not hours). Not hospital data.",
  sources: [
    { file: "src/scenes/uch/hospital.js", src: hospitalSrc, name: "orLife", marks: ["yield () => k < 12 - closed", "yield* attend(k, 3)", "become(p, recover(p, nurse))"] },
    { file: "src/scenes/uch/hospital.js", src: hospitalSrc, name: "escort", marks: ["link(nurse, pt)"] },
  ],
  actions: [
    { label: "Surge: 8 arrivals", run: (scene) => scene.stats.hospital.surge(8) },
    { label: "Close 2 ORs", run: (scene) => (scene.stats.hospital.closed = 2), isOn: (S) => S.hospital.closed === 2 },
    { label: "All ORs open", run: (scene) => (scene.stats.hospital.closed = 0), isOn: (S) => S.hospital.closed === 0 },
  ],
  viz(ctx, w, h, t, S) {
    const hist = S.history;
    const max = 24;
    const X = (i) => 8 + (i / Math.max(1, hist.length - 1)) * (w - 16);
    const Y = (v) => h - 14 - (v / max) * (h - 34);
    ctx.strokeStyle = "rgba(120,180,240,.15)";
    for (let v = 0; v <= max; v += 6) {
      ctx.beginPath();
      ctx.moveTo(8, Y(v));
      ctx.lineTo(w - 8, Y(v));
      ctx.stroke();
    }
    line(ctx, hist.map((s, i) => [X(i), Y(s.preop)]), C.green);
    line(ctx, hist.map((s, i) => [X(i), Y(s.or)]), C.yellow);
    line(ctx, hist.map((s, i) => [X(i), Y(s.pacu)]), C.cyan);
    line(ctx, hist.map((s, i) => [X(i), Y(Math.min(max, s.waiting))]), C.red, 2);
    label(ctx, "pre-op", 10, 12, C.green);
    label(ctx, "in OR", 70, 12, C.yellow);
    label(ctx, "PACU", 122, 12, C.cyan);
    label(ctx, "waiting", 168, 12, C.red);
  },
  live(S) {
    const u = S.hospital;
    const busy = (a) => a.filter((x) => x !== null && x !== "turnover").length;
    const l = u.little;
    return [
      `pre-op ${busy(u.preop)}/10   OR ${busy(u.or)}/${12 - u.closed} open   PACU ${busy(u.pacu)}/12   waiting ${u.waiting.length}`,
      `Little's Law   L = ${l.L.toFixed(1)}   λ·W = ${(l.λ * 60).toFixed(2)}/min × ${(l.W / 60).toFixed(2)} min = ${l.λW.toFixed(1)}`,
      ...u.log.slice(0, 3),
    ];
  },
};

// ── Multi-agent pathfinding ─────────────────────────────────
const routingTopic = {
  id: "routing",
  chip: "Hallway routing",
  kicker: "Cooperative A* · reservation table",
  provenance: "site",
  vizHeight: 200,
  title: "Sixty-odd people, one floor, no collisions",
  summary:
    "Everyone walks a grid of 12-unit cells. Every half-second, the planner (windowed hierarchical cooperative A*, Silver 2005) plans each person’s next twelve steps in priority order against a shared reservation table: one person per cell per step, and nobody swaps places through someone else. Each plan is an A* search through space <em>and</em> time, so waiting a step is a move like any other, guided by the exact walking distance to the goal (a cached breadth-first flood). Surgeons and anesthesia plan first; a nurse escorting a patient plans for both of them, the patient a step behind; anyone kept waiting gets pushed up the order so nobody starves. Halls are four cells wide, so people pass instead of queueing. Below: every planned window, live. In blueprint view they’re drawn on the floor.",
  sources: [
    { file: "src/scenes/uch/mapf.js", src: mapfSrc, name: "search", marks: ["moves.has(`${next}>${s.cell}@${s.t}`)", "fc = next === s.cell ? s.fc : s.cell"] },
    { file: "src/scenes/uch/mapf.js", src: mapfSrc, name: "planAll", marks: ["b.priority - a.priority", "reservePath(f.plan, f.id)"] },
  ],
  viz(ctx, w, h, t, S) {
    const H = S.hospital;
    const k = Math.min((w - 16) / COLS, (h - 30) / ROWS);
    const ox = (w - COLS * k) / 2;
    const oy = 22;
    // the walkable floor, cached
    if (!routingTopic.floor || routingTopic.floor.k !== k) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(COLS * k);
      c.height = Math.ceil(ROWS * k);
      const g = c.getContext("2d");
      g.fillStyle = "rgba(94,200,255,.13)";
      for (let i = 0; i < H.grid.walk.length; i++) if (H.grid.walk[i]) g.fillRect((i % COLS) * k, Math.floor(i / COLS) * k, k + 0.3, k + 0.3);
      routingTopic.floor = { c, k };
    }
    ctx.drawImage(routingTopic.floor.c, ox, oy);
    const P = (c) => [ox + ((c % COLS) + 0.5) * k, oy + (Math.floor(c / COLS) + 0.5) * k];
    for (const p of H.people.values()) {
      const col = ROLE_COLORS[roleOf(p)];
      if (p.plan.length > 1) {
        // the reserved window, fading out into the future
        for (let i = Math.max(1, p.step + 1); i < p.plan.length; i++) {
          ctx.globalAlpha = 0.9 * (1 - (i - p.step) / (p.plan.length - p.step + 1));
          line(ctx, [P(p.plan[i - 1]), P(p.plan[i])], col, 1.2);
        }
        ctx.globalAlpha = 1;
      }
      const [x, y] = P(p.cell);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, p.blocked > 0.5 ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, "planned windows · next 12 steps each", 10, 12, C.text, 9);
  },
  live(S) {
    const H = S.hospital;
    const ps = H.planner.stats;
    const all = [...H.people.values()];
    const moving = all.filter((p) => p.cell !== p.prev).length;
    const held = all.filter((p) => p.blocked > 0).length;
    const longest = Math.max(0, ...all.map((p) => p.blocked));
    return [
      `${all.length} people   ${moving} stepping now   ${held} giving way   longest wait ${longest.toFixed(1)} s`,
      `${S.rate.searches.toFixed(0)} searches/s · ${(S.rate.expanded / Math.max(1, S.rate.searches)).toFixed(0)} nodes each · ${ps.failed} of ${ps.searches} hit the budget`,
      `two people in one cell, ever: ${H.stats.conflicts}`,
    ];
  },
};

// ── ECG synthesis ───────────────────────────────────────────
const RATES = { "Asleep · 58": 58, "Resting · 74": 74, "Frightened · 112": 112 };
const ecgTopic = {
  id: "ecg",
  chip: "ECG synthesis",
  kicker: "Sum of Gaussians",
  provenance: "site",
  vizHeight: 170,
  title: "A heartbeat from five bell curves",
  summary:
    "The monitor’s trace isn’t a recording. Each beat is five Gaussian bumps (the P, Q, R, S and T waves) summed at a phase that runs from 0 to 1 once per beat (the idea behind the McSharry ECG model). Heart rate only changes how fast the phase advances; a small breathing term speeds it up on each breath in, the way a real heart does. Below: the five components and their sum. Change the rate and the monitor follows.",
  sources: [{ file: "src/scenes/uch/ecg.js", src: ecgSrc, name: null, marks: ["Math.exp", "const breath"] }],
  actions: Object.entries(RATES).map(([name, hr]) => ({
    label: name,
    run: (scene) => (scene.stats.hrOverride = hr),
    isOn: (S) => S.hrOverride === hr,
  })),
  viz(ctx, w, h, t, S) {
    const Y = (v) => h * 0.68 - v * h * 0.5;
    const X = (θ) => 10 + θ * (w - 20);
    const colors = [C.cyan, C.dim, C.green, C.dim, C.yellow];
    WAVES.forEach((wave, k) => {
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const θ = i / 200;
        pts.push([X(θ), Y(wave.a * Math.exp(-((θ - wave.at) ** 2) / (2 * wave.w * wave.w)))]);
      }
      line(ctx, pts, colors[k], 1);
      label(ctx, wave.name, X(wave.at), Y(wave.a) + (wave.a > 0 ? -6 : 14), colors[k], 10, "center");
    });
    const sum = [];
    for (let i = 0; i <= 300; i++) sum.push([X(i / 300), Y(ecg(i / 300))]);
    line(ctx, sum, "#fff", 2);
    // playhead at the monitor's current phase
    ctx.strokeStyle = "rgba(255,255,255,.4)";
    ctx.beginPath();
    ctx.moveTo(X(S.phase), 10);
    ctx.lineTo(X(S.phase), h - 10);
    ctx.stroke();
  },
  live(S) {
    return [`heart rate ${Math.round(S.hr)} bpm  →  phase advances ${(S.hr / 60).toFixed(2)} beats/s`, `ecg(θ) = Σ aᵢ · exp(−(θ − θᵢ)² / 2bᵢ²)   over P, Q, R, S, T`];
  },
};

// ── Transferable skills ─────────────────────────────────────
const skillsTopic = {
  id: "skills",
  chip: "Transferable skills",
  kicker: "Not technical, still essential",
  title: "What the hospital teaches",
  summary:
    "This job isn’t software, and that’s the point. It puts me in rooms a developer never sees, and the habits it builds map directly onto engineering work. Pick one to see the connection.",
  sources: [],
  actions: SKILLS.map((s, k) => ({ label: s.hospital, run: (scene) => (scene.stats.skill = k), isOn: (S) => S.skill === k })),
  vizHeight: 230,
  viz(ctx, w, h, t, S) {
    const n = SKILLS.length;
    const y = (k) => 14 + (k * (h - 24)) / (n - 1);
    const xl = w * 0.42;
    const xr = w * 0.58;
    SKILLS.forEach((s, k) => {
      const on = S.skill === k;
      ctx.strokeStyle = on ? C.green : "rgba(120,180,240,.18)";
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(xl, y(k));
      ctx.lineTo(xr, y(k));
      ctx.stroke();
      label(ctx, s.hospital, xl - 8, y(k) + 3, on ? "#fff" : C.text, 9, "right");
      label(ctx, s.software, xr + 8, y(k) + 3, on ? C.green : C.dim, 9);
    });
    label(ctx, "in the hospital", 10, h - 2, C.dim, 9);
    label(ctx, "in engineering", w - 10, h - 2, C.dim, 9, "right");
  },
  live(S) {
    const s = SKILLS[S.skill];
    // wrap the explanation for the monospace readout
    const words = s.why.split(" ");
    const lines = [`${s.hospital} → ${s.software}`, ""];
    let cur = "";
    for (const word of words) {
      if ((cur + " " + word).length > 64) lines.push(cur), (cur = word);
      else cur = cur ? `${cur} ${word}` : word;
    }
    lines.push(cur);
    return lines;
  },
};

export const uchTopics = [flowTopic, routingTopic, ecgTopic, skillsTopic];
