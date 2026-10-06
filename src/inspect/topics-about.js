// Inspector topics for the About page. Everything shown is this site's own
// code, imported verbatim.

import threadsSrc from "../about/threads.js?raw";
import foldSrc from "../about/fold.js?raw";
import schoolSrc from "../about/school.js?raw";
import scenesSrc from "../about/scenes.js?raw";
import { STEPS, resample, between } from "../about/fold.js";
import { RULES } from "../about/school.js";
import { layout } from "../about/threads.js";
import { POINTS } from "../about/content.js";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", accent: "#ffb48c" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}
const gapOf = (S, kind) => (S.scene?.kind === kind ? S.scene.stats : null);

// ── Threads ─────────────────────────────────────────────
const threadsTopic = {
  id: "threads",
  chip: "Threads",
  kicker: "The map",
  provenance: "site",
  vizHeight: 150,
  title: "Pulling one thread out of the tangle",
  summary:
    "Every point has a home spot, and every thread is a smooth curve through its points in order from top to bottom. Pick a thread and its points get new spots spread evenly down a gentle S, in that same order, so no two cross on the way. Everything else moves out to the nearer edge. Each point springs a little closer to its spot every frame, and the curve is redrawn through wherever the points are, so the thread straightens as they travel.",
  sources: [
    { file: "src/about/threads.js", src: threadsSrc, name: "layout" },
    { file: "src/about/threads.js", src: threadsSrc, name: "smooth" },
  ],
  viz(ctx, w, h, t, S) {
    // the picked thread's points: where they sit now, and where they're going
    const { state, nodes } = S.map;
    const goal = layout(POINTS, state.thread);
    const sx = (x) => 10 + (x / 1000) * (w - 20);
    const sy = (y) => 8 + (y / 700) * (h - 16);
    nodes.forEach((n, k) => {
      const on = !state.thread || n.p.threads.includes(state.thread);
      ctx.strokeStyle = on ? C.line : "rgba(120,210,255,.08)";
      ctx.beginPath();
      ctx.moveTo(sx(n.x), sy(n.y));
      ctx.lineTo(sx(goal[k].x), sy(goal[k].y));
      ctx.stroke();
      ctx.fillStyle = on ? C.hot : C.dim;
      ctx.beginPath();
      ctx.arc(sx(n.x), sy(n.y), on ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = on ? C.accent : "transparent";
      ctx.strokeRect(sx(goal[k].x) - 2.5, sy(goal[k].y) - 2.5, 5, 5);
    });
  },
  live(S) {
    const s = S.map.state;
    return [
      `thread   ${s.thread || "none"}`,
      `point    ${s.point || "-"}`,
      `moving   ${s.moving} / ${POINTS.length}`,
      `layout   ${s.portrait ? "on its side" : "across"}`,
    ];
  },
};

// ── The fold ────────────────────────────────────────────────
const foldTopic = {
  id: "fold",
  chip: "The fold",
  kicker: "Origami",
  provenance: "site",
  vizHeight: 170,
  title: "Morphing a square into a crane",
  summary:
    "Each step of the crane is an outline. To slide one into the next, both are redrawn with the same number of points, spread evenly around the edge and starting from the top. Then every point travels straight to its partner. The dots below are those points.",
  sources: [{ file: "src/about/fold.js", src: foldSrc, name: "resample" }],
  viz(ctx, w, h, t, S) {
    const n = 36;
    const k = Math.floor(t / 2) % STEPS.length;
    const u = Math.min(1, (t % 2) / 1.2);
    const pts = between(resample(STEPS[k].outline, n), resample(STEPS[(k + 1) % STEPS.length].outline, n), u * u * (3 - 2 * u));
    const s = (h - 20) / 200;
    const ox = w / 2 - 100 * s;
    pts.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? C.accent : C.hot;
      ctx.beginPath();
      ctx.arc(ox + x * s, 10 + y * s, i === 0 ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    });
    label(ctx, `${STEPS[k].name} → ${STEPS[(k + 1) % STEPS.length].name}`, 10, h - 8, C.dim, 9);
  },
  live(S) {
    const f = gapOf(S, "fold");
    return f ? [`step   ${STEPS[f.step].name}`, `folds  ${f.folds}`] : ["open Origami to fold one"];
  },
};

// ── The dive ────────────────────────────────────────────────
const diveTopic = {
  id: "dive",
  chip: "The dive",
  kicker: "Freediving",
  provenance: "site",
  vizHeight: 110,
  title: "Holding your breath",
  summary:
    "While you hold, the diver sinks 22 feet a second; let go and they rise at 30. Breath only drains below the surface and refills on top. Run out and you come up whether you're holding or not. Reach 80 feet and the rock comes with you.",
  sources: [{ file: "src/about/scenes.js", src: scenesSrc, name: "dive" }],
  viz(ctx, w, h, t, S) {
    const d = gapOf(S, "dive") || { depth: 0, breath: 1 };
    ctx.fillStyle = C.line;
    ctx.fillRect(14, 20, w - 28, 10);
    ctx.fillStyle = C.hot;
    ctx.fillRect(14, 20, (w - 28) * d.breath, 10);
    label(ctx, "breath", 14, 14, C.dim, 9);
    ctx.fillStyle = C.line;
    ctx.fillRect(14, 64, w - 28, 10);
    ctx.fillStyle = C.accent;
    ctx.fillRect(14, 64, ((w - 28) * d.depth) / 80, 10);
    label(ctx, "depth (80 ft)", 14, 58, C.dim, 9);
  },
  live(S) {
    const d = gapOf(S, "dive");
    return d ? [`depth   ${d.depth.toFixed(1)} ft`, `breath  ${Math.round(d.breath * 100)}%`, `rocks   ${d.rocks}`] : ["open Freediving to dive"];
  },
};

// ── The school ──────────────────────────────────────────────
const schoolTopic = {
  id: "school",
  chip: "The school",
  kicker: "Boids",
  provenance: "site",
  vizHeight: 120,
  title: "Three rules, no leader",
  summary: `Each fish looks only at neighbors within ${RULES.see}px. It steers away from any closer than ${RULES.space}px, matches the others' heading, and drifts toward their middle. Your pointer is a predator: fish within ${RULES.flee}px flee, and the school bends around it.`,
  sources: [{ file: "src/about/school.js", src: schoolSrc, name: "swim" }],
  viz(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    [
      [RULES.flee, "flee"],
      [RULES.see, "see"],
      [RULES.space, "space"],
    ].forEach(([r, name], k) => {
      ctx.strokeStyle = k === 0 ? C.accent : C.line;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      label(ctx, name, cx + r * 0.75 + 4, cy - 4 + k * 12, k === 0 ? C.accent : C.dim, 9);
    });
    ctx.fillStyle = C.hot;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  },
  live(S) {
    const s = gapOf(S, "school");
    return s ? [`fish     ${s.fish}`, `fleeing  ${s.fleeing}`] : ["open the 75 gallon to see it"];
  },
};

export const aboutTopics = [threadsTopic, foldTopic, diveTopic, schoolTopic];
