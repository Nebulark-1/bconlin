// Inspector topics for the résumé page. Everything shown is this site's own
// code, imported verbatim.

import paperSrc from "../resume/paper.js?raw";
import wordingsSrc from "../resume/wordings.js?raw";
import linefitSrc from "../resume/linefit.js?raw";
import mainSrc from "../resume/main.js?raw";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", accent: "#ffb48c", coral: "#ff8a7a" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// every public line in the bank, with whether it's on the page right now
function lines(S) {
  const shown = new Set(S.model.entries.flatMap((e) => e.bullets.map((b) => `${e.id}-${b.id}`)));
  return S.bank.entries.flatMap((e) =>
    e.bullets.filter((b) => !b.draft).map((b) => ({ score: b.score[S.state.lens], on: shown.has(`${e.id}-${b.id}`) })),
  );
}

// ── Focus ───────────────────────────────────────────────────
const focusTopic = {
  id: "focus",
  chip: "Focus",
  kicker: "Choosing lines",
  provenance: "site",
  vizHeight: 150,
  title: "Ranking the bank for a role",
  summary:
    "Every line in the bank has a score from 0 to 10 for each focus. compose() sorts each job's lines by the chosen focus, drops jobs and projects that don't speak to it, then removes the weakest line left on the page, again and again, until sixteen bullets fit on one page. Each dot below is one line, placed by its score; the filled ones made the page.",
  sources: [{ file: "src/resume/paper.js", src: paperSrc, name: "compose" }],
  viz(ctx, w, h, t, S) {
    const all = lines(S);
    const x = (score) => 24 + (score / 10) * (w - 48);
    const stacks = new Map();
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(20, h - 22);
    ctx.lineTo(w - 20, h - 22);
    ctx.stroke();
    for (let s = 0; s <= 10; s += 2) label(ctx, String(s), x(s), h - 8, C.dim, 9, "center");
    for (const l of all.sort((a, b) => b.on - a.on)) {
      const k = stacks.get(l.score) || 0;
      stacks.set(l.score, k + 1);
      const cy = h - 32 - k * 9;
      ctx.beginPath();
      ctx.arc(x(l.score), cy, 3.2, 0, Math.PI * 2);
      if (l.on) {
        ctx.fillStyle = C.accent;
        ctx.fill();
      } else {
        ctx.strokeStyle = C.dim;
        ctx.stroke();
      }
    }
  },
  live(S) {
    const all = lines(S);
    const on = all.filter((l) => l.on);
    return [
      `focus     ${S.state.lens}`,
      `on page   ${on.length} of ${all.length} lines${S.state.full ? " (everything)" : ` · room for 16`}`,
      `lowest    ${on.length ? Math.min(...on.map((l) => l.score)) : "-"} / 10 made it`,
    ];
  },
};

// ── Line fit ────────────────────────────────────────────────
const fitTopic = {
  id: "fit",
  chip: "Line fit",
  kicker: "Measuring the page",
  provenance: "site",
  vizHeight: 140,
  title: "Does each bullet end well?",
  summary:
    "The page is drawn at exactly 8.5 inches, the width it prints at, so the browser's own layout is the truth. measure() asks it where every word of a bullet landed, line by line; grade() calls the bullet full if its last line is at least 70% full, and a spill if one to three words (or under a quarter of a line) hang on a line of their own. Spills are most of the work of editing a résumé.",
  sources: [
    { file: "src/resume/linefit.js", src: linefitSrc, name: "grade" },
    { file: "src/resume/linefit.js", src: linefitSrc, name: "measure" },
  ],
  viz(ctx, w, h, t, S) {
    const fits = S.fits();
    const bw = Math.max(3, Math.min(18, (w - 40) / Math.max(1, fits.length) - 3));
    const base = h - 18;
    const top = 16;
    ctx.strokeStyle = C.line;
    ctx.setLineDash([3, 3]);
    const y70 = base - (base - top) * 0.7;
    ctx.beginPath();
    ctx.moveTo(14, y70);
    ctx.lineTo(w - 14, y70);
    ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, "70%", w - 14, y70 - 4, C.dim, 9, "right");
    fits.forEach((f, k) => {
      const x = 20 + k * (bw + 3);
      const fh = (base - top) * f.fill;
      ctx.fillStyle = f.grade === "spill" ? C.coral : f.grade === "full" ? C.hot : C.dim;
      ctx.fillRect(x, base - fh, bw, fh);
    });
    label(ctx, "each bar: how full a bullet's last line is", 14, h - 4, C.dim, 9);
  },
  live(S) {
    const fits = S.fits();
    const n = (g) => fits.filter((f) => f.grade === g).length;
    return [`full      ${n("full")}`, `short     ${n("short")}`, `spill     ${n("spill")}`];
  },
};

// ── Wordings ────────────────────────────────────────────────
const wordingsTopic = {
  id: "wordings",
  chip: "Wordings",
  kicker: "One fact, many ways to say it",
  provenance: "site",
  vizHeight: 110,
  title: "Picking the wording for the page",
  summary:
    "A bullet is one fact with any number of wordings. The fact decides whether it belongs; the wording is chosen for the page: first the one with the most keywords the job asks for (applicant tracking systems match words literally), then the one that fills its lines best, then the one I've sent most. A wording another beats on every count is covered and never chosen. My private editor uses this against real job descriptions.",
  sources: [
    { file: "src/resume/wordings.js", src: wordingsSrc, name: "rankWordings" },
    { file: "src/resume/wordings.js", src: wordingsSrc, name: "hasTerm" },
  ],
  viz(ctx, w, h) {
    const keys = ["keywords found", "line fit", "times sent"];
    const bw = (w - 60) / 3;
    keys.forEach((k, i) => {
      const x = 20 + i * (bw + 10);
      ctx.strokeStyle = i === 0 ? C.accent : C.line;
      ctx.strokeRect(x, 30, bw, 36);
      label(ctx, `${i + 1}. ${k}`, x + bw / 2, 52, i === 0 ? C.accent : C.text, 10, "center");
      if (i < 2) label(ctx, "then", x + bw + 5, 52, C.dim, 9, "center");
    });
    label(ctx, "ties go to the next rule", w / 2, 92, C.dim, 9, "center");
  },
  live(S) {
    const facts = S.bank.entries.flatMap((e) => e.bullets.filter((b) => !b.draft));
    const many = facts.filter((b) => (b.wordings || []).length > 1).length;
    return [`facts     ${facts.length}`, `with more than one wording  ${many}`];
  },
};

// ── The swap ────────────────────────────────────────────────
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789";
const swapTopic = {
  id: "swap",
  chip: "The swap",
  kicker: "Changing focus",
  provenance: "site",
  vizHeight: 90,
  title: "Re-ranking without a jump",
  summary:
    "Changing focus redraws the whole page, but every bullet has its own view-transition name, so the browser slides each line from where it was to where it lands (the View Transitions API). Lines that are new to the page resolve out of a scramble, left to right. The URL updates too, so a tailored version can be shared.",
  sources: [
    { file: "src/resume/main.js", src: mainSrc, name: "update" },
    { file: "src/resume/main.js", src: mainSrc, name: "scramble" },
  ],
  viz(ctx, w, h, t) {
    const text = "Rebuilt a 40,000-row billing ledger";
    const k = (t % 3) / 2;
    const done = Math.floor(text.length * Math.min(1, k));
    let out = text.slice(0, done);
    for (let i = done; i < Math.min(text.length, done + 14); i++) out += text[i] === " " ? " " : GLYPHS[(Math.floor(t * 30) + i * 7) % GLYPHS.length];
    label(ctx, out, 16, h / 2 + 4, C.hot, 12);
  },
  live() {
    return [`view transitions  ${document.startViewTransition ? "supported here" : "not in this browser (it just swaps)"}`, `this version      ${location.search || "(the default)"}`];
  },
};

export const resumeTopics = [focusTopic, fitTopic, wordingsTopic, swapTopic];
