// Inspector topics for the About page. Everything shown is this site's own
// code, imported verbatim.

import leadingSrc from "../about/leading.js?raw";
import foldSrc from "../about/fold.js?raw";
import schoolSrc from "../about/school.js?raw";
import scenesSrc from "../about/scenes.js?raw";
import { STEPS, resample, between } from "../about/fold.js";
import { RULES } from "../about/school.js";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", accent: "#ffb48c" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}
const gapOf = (S, kind) => S.gaps.find((g) => g.scene.kind === kind)?.scene.stats;

// ── Leading ─────────────────────────────────────────────────
const leadingTopic = {
  id: "leading",
  chip: "Leading",
  kicker: "Between the lines",
  provenance: "site",
  vizHeight: 150,
  title: "Splitting a paragraph without moving a word",
  summary:
    "Leading is the typesetter's word for the space between lines. Every word of the bio is its own element, so the page can ask the browser where each one landed. A gap goes in right before the first word on the next line. A block in the middle of text ends the line it follows, so the lines above wrap exactly as before and the rest starts a fresh line in the same place. Resize the window and every open gap finds its new spot.",
  sources: [
    { file: "src/about/leading.js", src: leadingSrc, name: "splitPoint" },
    { file: "src/about/leading.js", src: leadingSrc, name: "place" },
  ],
  viz(ctx, w, h, t, S) {
    // four lines of "text", parting after the second
    const open = (Math.sin(t * 1.4) + 1) / 2;
    const widths = [0.92, 0.86, 0.95, 0.6];
    let y = 22;
    widths.forEach((f, k) => {
      ctx.fillStyle = k === 1 ? C.hot : C.dim;
      for (let x = 14; x < 14 + (w - 28) * f; x += 34) ctx.fillRect(x, y, 28, 6);
      if (k === 1) {
        ctx.strokeStyle = C.accent;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(14 + (w - 28) * f - 6, y - 4, 1, 14);
        ctx.setLineDash([]);
        label(ctx, "split here", 14 + (w - 28) * f - 10, y - 6, C.accent, 9, "right");
        y += 18 + open * 50;
        ctx.strokeStyle = C.line;
        ctx.strokeRect(14, y - 14 - open * 50, w - 28, open * 50);
      } else y += 18;
    });
  },
  live(S) {
    const s = S.leading;
    return [
      `open gaps   ${s.open}  (deepest ${s.deepest})`,
      `added       ${Math.round(s.added)}px`,
      `splits      ${s.splits}`,
      `last        ${s.last ? `"${s.last.word}" | "${s.last.before}"` : "-"}`,
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
    return f ? [`step   ${STEPS[f.step].name}`, `folds  ${f.folds}`] : ["open “fold paper” to fold one"];
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
    return d ? [`depth   ${d.depth.toFixed(1)} ft`, `breath  ${Math.round(d.breath * 100)}%`, `rocks   ${d.rocks}`] : ["open “freediving” to dive"];
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
    return s ? [`fish     ${s.fish}`, `fleeing  ${s.fleeing}`] : ["open “a 75 gallon” to see it"];
  },
};

export const aboutTopics = [leadingTopic, foldTopic, diveTopic, schoolTopic];
