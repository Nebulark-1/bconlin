import { clamp, lerp, easeInOutCubic } from "../engine/math.js";

// The home page's structures: static shapes laid out in the page (the rings
// round my portrait, the timeline's lanes, four charts, a set of strings at
// the bottom). Each one says where its 400 points belong, in viewport
// coordinates, given where the element is on screen right now. The points
// themselves live in field.js and race to whichever structure is in view.

export const N = 400;
export const PER = 100; // points per string
const TAU = Math.PI * 2;

export const YEARS = [2021, 2027];
export const NOW = 2026.75; // October 2026

// When each chapter was under way, in fractional years. The law firm was
// summers through college, then year-round from 2025.
export const SPANS = {
  houghton: [[2022.62, 2025.38]],
  law: [
    [2021.4, 2021.65],
    [2022.4, 2022.62],
    [2023.4, 2023.65],
    [2024.4, 2024.65],
    [2025.38, 2026.33],
  ],
  uchealth: [[2026.35, NOW]],
  chaos: [[2026.0, NOW]],
};

export const uOf = (year) => (year - YEARS[0]) / (YEARS[1] - YEARS[0]);
export const yearOf = (u) => YEARS[0] + u * (YEARS[1] - YEARS[0]);
export const inSpan = (id, year) => SPANS[id].some(([a, b]) => year >= a && year <= b);

// The timeline's vertical rhythm, shared with its HTML (see main.js).
export const LANE = { top: 34, gap: 58, axis: 46 };

const point = (x, y) => ({ x, y, r: 0, a: 0, lit: false, dot: 0 });

/**
 * Rings: each string loops once round the portrait at its own radius,
 * turning slowly, with a gentle wobble. u is the position along the string;
 * `extra` turns the rings further (neighbours in opposite directions).
 */
export function ringSlot(i, u, rect, t, extra = 0) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const R = rect.width / 2 / 1.34;
  const spin = [0.4, 2.1, 3.9, 5.2][i];
  const a = spin + u * TAU + (t * (0.07 + i * 0.025) + extra * (1 + i * 0.15)) * (i % 2 ? -1 : 1);
  const r = R * (1.08 + i * 0.075) + Math.sin(u * TAU * 3 + t * 0.8 + i * 1.7) * R * 0.025;
  return point(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
}

/** Lanes: u runs left to right through the years; one lane per string. */
export function laneSlot(i, u, rect, t) {
  const y = rect.top + LANE.top + i * LANE.gap + Math.sin(u * 46 - t * 1.6 + i * 2) * 0.8;
  return point(lerp(rect.left, rect.right, u), y);
}

/** Harp: four straight strings across the bottom of the page. */
export function harpSlot(i, u, rect) {
  const gap = rect.height / 4;
  return point(lerp(rect.left, rect.right, u), rect.top + gap * (i + 0.5));
}

/**
 * Where point i sits in result chart `beat`, inside `box`. Each point
 * stands for a unit (20 students, $1 an hour, an attorney hour, a test).
 * `arrive` runs 0 → 1 once the points have landed, for the second half of
 * a story: the outsourced bill dimming, projected hours falling away,
 * tests counting in. Points a chart doesn't need shrink into its centre.
 */
export function dotLayout(beat, i, box, arrive) {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const spare = { x: cx, y: cy, r: 0, a: 0, lit: false };

  if (beat === 0) {
    // 400 × 20 students, packed as a sunflower
    const R = Math.min(w, h) * 0.46;
    const r = R * Math.sqrt((i + 0.5) / N);
    const a = i * 2.399963;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: R * 0.034, a: 0.95, lit: true };
  }

  if (beat === 1) {
    // $135 an hour outsourced against $25 in-house, $1 a point
    const cols = 9;
    const d = Math.min(h / 18, w / 24);
    const base = cy + d * 7.5;
    const gap = d * 3;
    const bar = (j, left) => ({ x: left + (j % cols) * d + d / 2, y: base - Math.floor(j / cols) * d });
    if (i < 135) return { ...bar(i, cx - gap / 2 - cols * d), r: d * 0.32, a: lerp(0.95, 0.3, arrive), lit: false };
    if (i < 160) return { ...bar(i - 135, cx + gap / 2), r: d * 0.32, a: 0.95, lit: true };
    return { ...spare, y: base };
  }

  if (beat === 2) {
    // 200 projected hours; 150 fall away, about 50 remain
    const cols = 20;
    const d = Math.min(w / 22, h / 13);
    if (i >= 200) return spare;
    const px = cx - (cols * d) / 2 + d / 2 + (i % cols) * d;
    const py = cy - d * 4.5 + Math.floor(i / cols) * d;
    if (i < 50) return { x: px, y: py, r: d * 0.32, a: 0.95, lit: true };
    const fall = easeInOutCubic(clamp(arrive * 1.6 - (((i * 37) % 150) / 150) * 0.6));
    return { x: px, y: py + fall * d * 1.5, r: d * 0.32 * (1 - fall * 0.4), a: lerp(0.9, 0.12, fall), lit: false };
  }

  // 298 automated tests, counted in one by one
  const cols = 25;
  const d = Math.min(w / 27, h / 15);
  if (i >= 298) return spare;
  const on = i / 298 < arrive;
  return {
    x: cx - (cols * d) / 2 + d / 2 + (i % cols) * d,
    y: cy - d * 5.5 + Math.floor(i / cols) * d,
    r: d * (on ? 0.34 : 0.26),
    a: on ? 0.95 : 0.3,
    lit: on,
  };
}

/** Captions under each chart. */
export function chartLabels(beat, box) {
  const { x, y, w, h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (beat === 1) {
    const d = Math.min(h / 18, w / 24);
    return [
      ["$135/hr outsourced", cx - d * 1.5 - 4.5 * d, cy + d * 9.5],
      ["$25/hr in-house", cx + d * 1.5 + 4.5 * d, cy + d * 9.5],
    ];
  }
  if (beat === 2) {
    const d = Math.min(w / 22, h / 13);
    return [
      ["about 50 hours actual", cx - d * 4, cy - d * 5.6],
      ["150 hours saved", cx + d * 5, cy + d * 6.8],
    ];
  }
  if (beat === 3) {
    const d = Math.min(w / 27, h / 15);
    return [["298 automated tests", cx, cy + d * 7.5]];
  }
  return [];
}

export const chartBox = (rect) => ({ x: rect.left + 12, y: rect.top + 12, w: rect.width - 24, h: rect.height - 24 });
