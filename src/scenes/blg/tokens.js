// The Business Law Group chapter's design system, as code. A modular type
// scale and a 12-column grid are computed from the panel's size and written
// to CSS custom properties, so every size on the page derives from two
// numbers: a base size and a ratio.

export const RATIO = 4 / 3; // a perfect fourth
export const STEPS = [-2, -1, 0, 1, 2, 3, 4, 5, 6];

/**
 * Modular type scale: size(n) = base · ratioⁿ. The base itself is fluid -
 * clamped between 13 and 17px and tracking the panel width - so the whole
 * scale breathes with the layout instead of jumping at breakpoints.
 */
export function typeScale(panelWidth, ratio = RATIO) {
  const base = Math.min(17, Math.max(13, panelWidth / 64));
  return Object.fromEntries(STEPS.map((n) => [n, +(base * ratio ** n).toFixed(2)]));
}

/** A 12-column grid with a gutter proportional to the base size. */
export function grid(panelWidth, base) {
  const margin = Math.max(20, panelWidth * 0.045);
  const gutter = Math.round(base * 1.25);
  const col = (panelWidth - margin * 2 - gutter * 11) / 12;
  return { margin, gutter, col, span: (n) => col * n + gutter * (n - 1), x: (n) => margin + n * (col + gutter) };
}

/** Write the scale and grid to custom properties on the chapter root. */
export function applyTokens(el, panelWidth) {
  const scale = typeScale(panelWidth);
  for (const [n, px] of Object.entries(scale)) el.style.setProperty(`--t${n}`, `${px}px`);
  const g = grid(panelWidth, scale[0]);
  el.style.setProperty("--margin", `${g.margin}px`);
  el.style.setProperty("--gutter", `${g.gutter}px`);
  el.style.setProperty("--col", `${g.col}px`);
  return { scale, grid: g };
}
