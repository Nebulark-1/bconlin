// Inspector topics for the secrets page itself. Everything shown is this
// site's own code, imported verbatim.

import eggsSrc from "../site/eggs.js?raw";
import pageSrc from "../eggs/main.js?raw";
import { EGGS, isFound, usedHint, usedSpoiler, foundCount } from "../site/eggs.js";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", line: "rgba(120,210,255,.3)", hot: "#9fe3ff", gold: "#ffe2c4" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

// ── Saved in your browser ───────────────────────────────────
const storageTopic = {
  id: "storage",
  chip: "Your progress",
  kicker: "No server",
  provenance: "site",
  vizHeight: 90,
  title: "Kept in your browser, nowhere else",
  summary:
    "There's no account and no server: what you've found, which hints and spoilers you opened, and which secrets you switched off live in one small JSON object in this browser's localStorage. discover() only counts the first time. Another tab listens for the storage event, so finding a secret in one tab lights it in the others.",
  sources: [
    { file: "src/site/eggs.js", src: eggsSrc, name: "discover" },
    { file: "src/site/eggs.js", src: eggsSrc, name: "load" },
  ],
  viz(ctx, w, h) {
    const n = EGGS.length;
    const gap = (w - 40) / n;
    EGGS.forEach((e, k) => {
      const x = 20 + gap * (k + 0.5);
      ctx.beginPath();
      ctx.arc(x, 34, Math.min(7, gap / 3), 0, Math.PI * 2);
      if (isFound(e.id)) {
        ctx.fillStyle = usedSpoiler(e.id) ? C.dim : usedHint(e.id) ? C.hot : C.gold;
        ctx.fill();
      } else {
        ctx.strokeStyle = C.line;
        ctx.stroke();
      }
    });
    label(ctx, "gold: found yourself   blue: with a hint   grey: looked it up", 20, 70, C.dim, 9);
  },
  live() {
    let size = 0;
    try {
      size = (localStorage.getItem("bc-eggs") || "").length;
    } catch {
      // storage blocked
    }
    return [`found     ${foundCount()} of ${EGGS.length}`, `stored    ${size} characters, key "bc-eggs"`];
  },
};

// ── The sky ─────────────────────────────────────────────────
const skyTopic = {
  id: "sky",
  chip: "The sky",
  kicker: "Where the stars go",
  provenance: "site",
  vizHeight: 170,
  title: "A spiral by the golden angle",
  summary:
    "Each secret has a fixed star. Star k sits at angle k × 137.5° (the golden angle, 360° ÷ φ²) and at a distance growing with √k, the same rule sunflowers use to pack seeds: no two line up, and the spiral fills evenly however many there are. Found stars are joined in the order you found them, so everyone's constellation is different.",
  sources: [{ file: "src/eggs/main.js", src: pageSrc, name: "place" }],
  viz(ctx, w, h, t) {
    const n = EGGS.length;
    const shown = Math.min(n, Math.floor((t * 6) % (n + 8)));
    for (let k = 0; k < shown; k++) {
      const a = k * 2.399963 + 0.6;
      const r = 0.16 + 0.3 * Math.sqrt((k + 0.5) / n);
      const x = w / 2 + Math.cos(a) * r * h * 1.6;
      const y = h / 2 + Math.sin(a) * r * h * 0.86 * 1.6;
      ctx.fillStyle = isFound(EGGS[k].id) ? C.gold : C.hot;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (k === shown - 1) label(ctx, String(k), x + 6, y - 4, C.dim, 9);
    }
  },
  live: () => [`stars     ${EGGS.length}`, `golden angle  ${(360 / ((1 + Math.sqrt(5)) / 2) ** 2).toFixed(2)}°`],
};

export const secretsPageTopics = [storageTopic, skyTopic];
