// Small procedural-SVG toolkit. Everything returns markup strings so scenes
// can compose layers declaratively and stay deterministic via seeded RNG.

/** Park–Miller PRNG: same seed, same skyline, every visit. */
export function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const f = (n) => +n.toFixed(1);

/**
 * A natural-looking ridgeline through control points: linear backbone plus
 * a few layered sines (seeded phases) and a touch of jitter.
 */
export function ridge(ctrl, { seed = 1, step = 14, amp = 6, parts = null } = {}) {
  const r = rng(seed);
  const phases = [r() * 6.28, r() * 6.28, r() * 6.28];
  const x0 = ctrl[0][0];
  const x1 = ctrl[ctrl.length - 1][0];
  const pts = [];
  for (let x = x0; x <= x1 + 0.01; x += step) {
    const base = interp(ctrl, x);
    const o1 = Math.sin(x * 0.011 + phases[0]) * amp;
    const o2 = Math.sin(x * 0.029 + phases[1]) * amp * 0.5;
    const o3 = Math.sin(x * 0.071 + phases[2]) * amp * 0.25;
    const jitter = (r() - 0.5) * amp * 0.4;
    // pin the ends to the control points so pieces meet cleanly
    const edge = Math.max(0, Math.min(1, (x - x0) / 60, (x1 - x) / 60));
    pts.push([x, base + (o1 + o2 + o3 + jitter) * edge]);
    parts?.push({ x, base, o1: o1 * edge, o2: o2 * edge, o3: o3 * edge, jitter: jitter * edge });
  }
  return pts;
}

/** Linear interpolation of y along a sorted [x, y] list. */
export function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return pts[pts.length - 1][1];
}

export const line = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L");

/** Closed shape from a ridgeline down to `floor`. */
export const area = (pts, floor = 960) =>
  `${line(pts)} L${f(pts[pts.length - 1][0])} ${floor} L${f(pts[0][0])} ${floor} Z`;

/**
 * A snow-laden spruce, base-centred at (x, y). Branch tiers are jittered so
 * no two trees match, and every tier carries a sliver of snow on its upper
 * edge. Returns { body, snow } path data so a forest can be drawn in two fills.
 */
export function conifer(x, y, h, r, tiers = 5) {
  const w = h * 0.34;
  const top = y - h;
  const crown = h * 0.9; // the last tenth is trunk
  const right = [[x, top]];
  const left = [];
  let snow = "";
  let innerR = [x, top];
  let innerL = [x, top];
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers;
    const yb = top + crown * t;
    const drop = (crown / tiers) * 0.18;
    const wr = w * (0.2 + 0.8 * t) * (0.82 + r() * 0.36);
    const wl = w * (0.2 + 0.8 * t) * (0.82 + r() * 0.36);
    const tipR = [x + wr, yb + r() * drop];
    const tipL = [x - wl, yb + r() * drop];
    const notchR = [x + wr * 0.38, yb - drop];
    const notchL = [x - wl * 0.38, yb - drop];
    right.push(tipR, notchR);
    left.unshift(notchL, tipL);
    // snow rests along the upper edge of each branch, thicker toward the trunk
    const th = 1 + (crown / tiers) * 0.14 * (0.6 + r() * 0.8);
    snow += `M${f(innerR[0])} ${f(innerR[1] + 1)} L${f(tipR[0] - 1)} ${f(tipR[1] - 1)} L${f(tipR[0] - wr * 0.3)} ${f(tipR[1] - 1 - th)} L${f(innerR[0])} ${f(innerR[1] + 1 + th * 0.6)} Z `;
    snow += `M${f(innerL[0])} ${f(innerL[1] + 1)} L${f(tipL[0] + 1)} ${f(tipL[1] - 1)} L${f(tipL[0] + wl * 0.3)} ${f(tipL[1] - 1 - th)} L${f(innerL[0])} ${f(innerL[1] + 1 + th * 0.6)} Z `;
    innerR = notchR;
    innerL = notchL;
  }
  const trunk = Math.max(1, w * 0.07);
  const pts = [...right.slice(0, -1), [x + trunk, top + crown], [x + trunk, y], [x - trunk, y], [x - trunk, top + crown], ...left.slice(1)];
  const body = `${line(pts)} Z `;
  return { body, snow };
}

/** Scatter spruce on a slope, denser near the ridge, fading as they descend. */
export function forest(ridgePts, { x0, x1, seed, density = 0.7, depth = 110, size = [9, 22], tiers = 3 }) {
  const r = rng(seed);
  let body = "";
  let snow = "";
  let count = 0;
  for (let x = x0; x < x1; x += 3 + r() * 5) {
    if (r() > density) continue;
    count++;
    const drop = r() ** 1.8 * depth;
    const h = (size[0] + r() * (size[1] - size[0])) * (1 - drop / (depth * 2.2));
    const tree = conifer(x, interp(ridgePts, x) + 6 + drop, h, r, tiers);
    body += tree.body;
    snow += tree.snow;
  }
  return { body, snow, count };
}

/**
 * A grid of windows inside a box. Lit ones are warm and flicker via CSS;
 * returns { lit, dark } markup so lit windows can live under a glow filter.
 */
export function windows(x, y, w, h, { rows, cols, r, litChance = 0.55, pad = 4 }) {
  let lit = "";
  let dark = "";
  const cw = (w - pad * 2) / cols;
  const ch = (h - pad * 2) / rows;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const rect = `<rect x="${f(x + pad + j * cw + cw * 0.2)}" y="${f(y + pad + i * ch + ch * 0.25)}" width="${f(cw * 0.6)}" height="${f(ch * 0.5)}"`;
      if (r() < litChance) lit += `${rect} opacity="${f(0.55 + r() * 0.45)}"${r() < 0.08 ? ' class="flicker"' : ""}/>`;
      else dark += `${rect}/>`;
    }
  }
  return { lit, dark };
}

/** A Pratt-style truss outline between x0..x1. */
export function truss(x0, x1, top, bottom, bays) {
  const w = (x1 - x0) / bays;
  let d = `M${x0} ${top} L${x1} ${top} M${x0} ${bottom} L${x1} ${bottom} M${x0} ${bottom} L${x0} ${top} M${x1} ${bottom} L${x1} ${top}`;
  for (let i = 1; i < bays; i++) d += ` M${f(x0 + i * w)} ${top} L${f(x0 + i * w)} ${bottom}`;
  for (let i = 0; i < bays; i++) {
    const a = x0 + i * w;
    d += i < bays / 2 ? ` M${f(a)} ${top} L${f(a + w)} ${bottom}` : ` M${f(a)} ${bottom} L${f(a + w)} ${top}`;
  }
  return d;
}

/**
 * A "behind the scenes" annotation: a pin, a leader line and a mono label.
 * Lives in a .bp group, which is only displayed in blueprint mode.
 */
export function note(x, y, text, { dx = 40, dy = -50, topic = "" } = {}) {
  const end = x + dx;
  const tx = dx >= 0 ? end + 6 : end - 6;
  return `<g class="bp-note"${topic ? ` data-topic="${topic}" role="button" tabindex="0"` : ""}><circle cx="${x}" cy="${y}" r="3"/><path d="M${x} ${y} L${x + dx * 0.6} ${y + dy} H${end}"/><text x="${tx}" y="${y + dy}" dy="0.35em" text-anchor="${dx >= 0 ? "start" : "end"}">${text}</text></g>`;
}

/** A plane's outline + name tag, positioned at runtime to the visible area. */
export const plane = (name, detail) =>
  `<g class="bp bp-plane"><rect class="bp-frame"/><text class="bp-name">${name}</text><text class="bp-detail">${detail}</text></g>`;
