export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Maps v from [a, b] to [0, 1], clamped. */
export const range = (v, a, b) => clamp((v - a) / (b - a));

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInCubic = (t) => t ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Piecewise-linear lookup through sorted [input, output] pairs, clamped at the ends. */
export function interpolateStops(pairs, v) {
  if (v <= pairs[0][0]) return pairs[0][1];
  for (let i = 1; i < pairs.length; i++) {
    const [a, av] = pairs[i - 1];
    const [b, bv] = pairs[i];
    if (v <= b) return b === a ? bv : lerp(av, bv, (v - a) / (b - a));
  }
  return pairs[pairs.length - 1][1];
}

/**
 * The affine map that makes a flat layer behave like a ground plane. Rows at
 * yTop should move by `near` = [x, y], rows at yBot by `far`, and every row
 * between by linear interpolation. Solving x' = x + a·y + e, y' = d·y + f for
 * those constraints gives a shear (a), a vertical stretch (d) and an offset.
 * Returns the six CSS matrix() values [1, 0, a, d, e, f].
 */
export function planeMatrix([tx, ty], [fx, fy], yTop, yBot) {
  const skew = (fx - tx) / (yBot - yTop);
  const stretch = (fy - ty) / (yBot - yTop);
  return [1, 0, skew, 1 + stretch, tx - skew * yTop, ty - stretch * yTop];
}
