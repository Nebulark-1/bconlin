// Inspector topics for the projects page. Everything shown is this site's
// own code, imported verbatim.

import mainSrc from "../projects/main.js?raw";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", accent: "#ffb48c" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// ── The filter ──────────────────────────────────────────────
const filterTopic = {
  id: "filter",
  chip: "Skill filter",
  kicker: "The grid is the filter",
  provenance: "site",
  vizHeight: 150,
  title: "Filtering and ranking by skill",
  summary:
    "Pick skills in the grid (or a role, which picks a set) and every project that shows none of them drops out. The rest are ranked by how many of the picked skills they show, in featured order on a tie. With nothing picked they keep the featured order, and you can sort by newest instead. The bars below are the live ranking.",
  sources: [{ file: "src/projects/main.js", src: mainSrc, name: "ordered" }],
  viz(ctx, w, h, t, S) {
    const order = S.ordered();
    const picked = S.state.skills.size;
    const rh = Math.min(22, (h - 10) / Math.max(1, S.projects.length));
    S.projects.forEach((p, k) => {
      const y = 8 + k * rh;
      const rank = order.indexOf(p);
      const hits = [...S.state.skills].filter((s) => p.skills[s]).length;
      label(ctx, p.name.slice(0, 18), 10, y + rh * 0.65, rank < 0 ? C.dim : C.text, 10);
      const x0 = 150;
      const full = w - x0 - 40;
      ctx.fillStyle = rank < 0 ? "rgba(120,210,255,.08)" : C.accent;
      ctx.fillRect(x0, y + 3, picked ? (full * hits) / picked : full * 0.15, rh - 8);
      label(ctx, rank < 0 ? "out" : `#${rank + 1}`, w - 10, y + rh * 0.65, rank < 0 ? C.dim : C.hot, 10, "right");
    });
  },
  live(S) {
    return [`skills    ${S.state.skills.size ? [...S.state.skills].join(", ") : "none picked"}`, `sort      ${S.state.sort}`, `showing   ${S.ordered().length} of ${S.projects.length}`];
  },
};

// ── Evidence ────────────────────────────────────────────────
const evidenceTopic = {
  id: "evidence",
  chip: "Evidence",
  kicker: "Every dot is backed",
  provenance: "site",
  vizHeight: 120,
  title: "What proves a skill",
  summary:
    "A dot in the grid only exists if something backs it: a specific bullet in that project's write-up (a filled dot), or failing that, a tool in its tool list (a hollow one). Hover a dot to read the proof; click it to jump to the bullet. Nothing is tagged on reputation.",
  sources: [{ file: "src/projects/main.js", src: mainSrc, name: "evidence" }],
  viz(ctx, w, h, t, S) {
    let bullets = 0;
    let tools = 0;
    for (const p of S.projects) for (const sid of Object.keys(p.skills)) (p.skills[sid].length ? bullets++ : tools++);
    const total = bullets + tools || 1;
    const x0 = 20;
    const full = w - 40;
    ctx.fillStyle = C.accent;
    ctx.fillRect(x0, 40, (full * bullets) / total, 22);
    ctx.strokeStyle = C.accent;
    ctx.strokeRect(x0 + (full * bullets) / total, 40, (full * tools) / total, 22);
    label(ctx, `● ${bullets} backed by a bullet`, x0, 30, C.accent, 10);
    label(ctx, `○ ${tools} by a tool`, w - 20, 30, C.text, 10, "right");
    label(ctx, "every dot on the grid", x0, 84, C.dim, 9);
  },
  live(S) {
    const dots = S.projects.reduce((n, p) => n + Object.keys(p.skills).length, 0);
    return [`projects  ${S.projects.length}`, `dots      ${dots}`];
  },
};

// ── The URL ─────────────────────────────────────────────────
const urlTopic = {
  id: "url",
  chip: "Shareable",
  kicker: "State in the address bar",
  provenance: "site",
  vizHeight: 70,
  title: "A filtered view you can send",
  summary:
    "The page keeps its state (the picked skills and the sort) in the URL's query string, replacing the history entry rather than adding one so the back button still leaves the page. Open a link with ?skills=… and the page starts there. Defaults are left out, so the plain URL means the plain page.",
  sources: [
    { file: "src/projects/main.js", src: mainSrc, name: "readUrl" },
    { file: "src/projects/main.js", src: mainSrc, name: "writeUrl" },
  ],
  viz(ctx, w, h) {
    const q = location.search || "(no query: the default view)";
    label(ctx, `projects.html${q}`.slice(0, Math.floor((w - 20) / 6.4)), 10, h / 2 + 4, C.hot, 11);
  },
  live: () => [`query     ${location.search || "-"}`],
};

// ── The motion ──────────────────────────────────────────────
const flipTopic = {
  id: "flip",
  chip: "Card motion",
  kicker: "FLIP",
  provenance: "site",
  vizHeight: 120,
  title: "Sliding cards into their new order",
  summary:
    "Re-ordering the list is instant in the DOM, so the motion is faked with the FLIP technique: record where each card was (First), move it in the DOM (Last), work out how far it jumped (Invert), and animate it from there back to nothing (Play). Only transform and opacity animate, so the browser can hand it to the GPU.",
  sources: [{ file: "src/projects/main.js", src: mainSrc, name: "update" }],
  viz(ctx, w, h, t) {
    const u = (t % 2.4) / 2.4;
    const steps = ["First", "Last", "Invert", "Play"];
    steps.forEach((s, k) => {
      const x = 20 + k * ((w - 40) / 4);
      const on = Math.floor(u * 4) === k;
      label(ctx, s, x, 24, on ? C.accent : C.dim, 11);
    });
    // a card moving from slot 3 to slot 1
    const e = 1 - (1 - Math.min(1, Math.max(0, (u - 0.75) / 0.25))) ** 3;
    const from = 92;
    const to = 44;
    const y = u < 0.25 ? from : u < 0.5 ? to : u < 0.75 ? from : from + (to - from) * e;
    ctx.strokeStyle = C.line;
    for (const yy of [44, 68, 92]) ctx.strokeRect(20, yy - 9, w - 40, 18);
    ctx.fillStyle = C.accent;
    ctx.fillRect(22, y - 7, w - 44, 14);
  },
  live: () => [`motion    ${matchMedia("(prefers-reduced-motion: reduce)").matches ? "off (reduced motion)" : "on"}`],
};

export const projectsTopics = [filterTopic, evidenceTopic, urlTopic, flipTopic];
