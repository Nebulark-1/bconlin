// What some secrets draw over the page: plain lines in the site's colors,
// moving just enough to show the idea, then gone.

import { chime, PENTATONIC } from "../site/sound.js";
import { fibonacciSquares, PHI } from "./patterns.js";

const NS = "http://www.w3.org/2000/svg";
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#a99bff", "#ff8a7a", "#39ff88", "#ff4da6", "#5ec8ff", "#ffb48c"];
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** A full-window drawing layer that fades out and removes itself. */
function layer(seconds) {
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("secret-fx");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
  document.body.appendChild(svg);
  setTimeout(() => svg.classList.add("is-leaving"), seconds * 1000);
  setTimeout(() => svg.remove(), seconds * 1000 + 900);
  return svg;
}
const add = (parent, tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.appendChild(el);
  return el;
};

/** Run fn(u) for u from 0 to 1 over `ms`, then done(). */
function play(ms, fn, done) {
  if (calm()) {
    fn(1);
    return done?.();
  }
  const start = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - start) / ms);
    fn(u);
    if (u < 1) requestAnimationFrame(tick);
    else done?.();
  };
  requestAnimationFrame(tick);
}

// ── φ: the squares of a golden rectangle, and the spiral through them ─────────
function arcPath(squares, unit, ox, oy) {
  return squares
    .map(({ center, from, to, s }, k) => {
      const [cx, cy] = center;
      const a0 = Math.atan2(from[1] - cy, from[0] - cx);
      const a1 = Math.atan2(to[1] - cy, to[0] - cx);
      let d = a1 - a0;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      const P = ([px, py]) => `${(ox + px * unit).toFixed(1)} ${(oy + py * unit).toFixed(1)}`;
      return `${k ? "L" : "M"}${P(from)}A${s * unit} ${s * unit} 0 0 ${d > 0 ? 1 : 0} ${P(to)}`;
    })
    .join("");
}

function drawSquares(svg, squares, unit, ox, oy, { stepMs = 140, sound = true } = {}) {
  squares.forEach(({ x, y, s }, k) => {
    setTimeout(() => {
      add(svg, "rect", {
        class: "fx-square",
        x: ox + x * unit,
        y: oy + y * unit,
        width: s * unit,
        height: s * unit,
        style: `--c:${COLORS[k % COLORS.length]}`,
      });
      if (sound) chime(PENTATONIC[k % PENTATONIC.length], 0.03, 0, 1.6);
    }, calm() ? 0 : k * stepMs);
  });
  const spiral = add(svg, "path", { class: "fx-line fx-line--hot", d: arcPath(squares, unit, ox, oy), pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
  setTimeout(() => play(1400, (u) => spiral.setAttribute("stroke-dashoffset", (1 - ease(u)).toFixed(3))), calm() ? 0 : squares.length * stepMs);
}

/** The window is golden: show the squares it's made of. */
export function goldenWindow() {
  const squares = fibonacciSquares(10);
  const { box } = squares[squares.length - 1];
  const svg = layer(6);
  const wide = innerWidth >= innerHeight;
  // the spiral's box is golden too (89 by 55); turn it to match the window
  if (!wide) svg.innerHTML = `<g transform="translate(${innerWidth} 0) rotate(90)"></g>`;
  const host = wide ? svg : svg.firstChild;
  const [W, H] = wide ? [innerWidth, innerHeight] : [innerHeight, innerWidth];
  const unit = Math.min(W / (box.x1 - box.x0), H / (box.y1 - box.y0));
  drawSquares(host, squares, unit, -box.x0 * unit, -box.y0 * unit, { stepMs: 90 });
  add(svg, "text", { class: "fx-text", x: 20, y: innerHeight - 24 }).textContent = `${innerWidth} ÷ ${innerHeight} = ${(Math.max(innerWidth, innerHeight) / Math.min(innerWidth, innerHeight)).toFixed(3)} ≈ φ = ${PHI.toFixed(3)}`;
}

// ── ↑ ↑ ↓ ↓ ← → ← → B A ────────────────────────────────────
/** Eight-bit mode for a little while: chunky type, scanlines, a 1UP. */
export function eightBit(seconds = 12) {
  const html = document.documentElement;
  if (html.classList.contains("is-8bit")) return;
  html.classList.add("is-8bit");
  const scan = document.createElement("div");
  scan.className = "retro-scan";
  scan.setAttribute("aria-hidden", "true");
  scan.innerHTML = `<b class="retro-1up">1UP</b>`;
  document.body.appendChild(scan);
  // a little chiptune: up the scale and back, fast
  [0, 2, 4, 5, 7, 5, 4, 2, 0, 4, 7].forEach((n, k) =>
    setTimeout(() => chime(PENTATONIC[n % PENTATONIC.length] * (n > 6 ? 2 : 1), 0.035, 0, 0.25), k * 85),
  );
  setTimeout(() => {
    html.classList.remove("is-8bit");
    scan.remove();
  }, seconds * 1000);
}

// ── 11:11 ──────────────────────────────────────────────────
/** A shooting star across the top of the window. Make a wish. */
export function shootingStar() {
  const svg = layer(5);
  const y0 = 60 + Math.random() * innerHeight * 0.2;
  const star = add(svg, "path", { class: "fx-star" });
  const text = add(svg, "text", { class: "fx-text fx-wish", x: innerWidth / 2, y: innerHeight * 0.32, "text-anchor": "middle" });
  text.textContent = "11:11. Make a wish.";
  chime(PENTATONIC[7], 0.04, 0.6, 3);
  setTimeout(() => chime(PENTATONIC[5], 0.03, -0.4, 3), 400);
  play(1500, (u) => {
    const head = innerWidth * (1.05 - u * 1.2);
    const y = y0 + u * 120;
    star.setAttribute("d", `M${head} ${y}l${180} ${-18}`);
    star.setAttribute("opacity", Math.sin(u * Math.PI).toFixed(2));
  });
}
