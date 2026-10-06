// The crane, in four steps: the crease pattern on a square, the collapse
// into a bird base, the narrowed flat crane, and the shaped one. Each step
// is an outline; between steps every point slides to its partner. For that
// to look like folding, both outlines need the same number of points,
// spread evenly around them and starting from the same place (the top).

// The square, turned to a diamond, in a 200 x 200 box.
export const STEPS = [
  { name: "crease pattern", outline: [[100, 12], [188, 100], [100, 188], [12, 100]] },
  { name: "collapse", outline: [[100, 12], [126, 96], [100, 188], [74, 96]] },
  { name: "narrow", outline: [[34, 34], [100, 104], [166, 34], [116, 128], [100, 166], [84, 128]] },
  { name: "shape", outline: [[40, 30], [100, 104], [166, 34], [116, 128], [100, 160], [84, 128], [36, 48], [22, 52]] },
];

// The crease pattern, in square coordinates (-1..1), with a = tan(22.5°):
// valleys fold toward you, mountains away.
const a = Math.tan(Math.PI / 8);
const b = 1 - a;
export const CREASES = [
  ...[[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]].map((l) => ({ l, valley: true })), // diagonals
  ...[[[-1, 0], [1, 0]], [[0, -1], [0, 1]]].map((l) => ({ l, valley: false })), // book folds
  // from each corner, the two folds that split it into 22.5° flaps
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy]) => [
    { l: [[sx, sy], [0, sy * b]], valley: true },
    { l: [[sx, sy], [sx * b, 0]], valley: true },
  ]),
  // the small square in the middle
  ...[[[0, -b], [b, 0]], [[b, 0], [0, b]], [[0, b], [-b, 0]], [[-b, 0], [0, -b]]].map((l) => ({ l, valley: false })),
];
/** Square coordinates to the diamond in the box. */
export const onPaper = ([u, v]) => [100 + 44 * (u - v), 100 + 44 * (u + v)];

/**
 * `n` points spaced evenly around a closed outline, starting at its
 * topmost corner (leftmost on a tie) and going clockwise.
 */
export function resample(outline, n) {
  let start = 0;
  outline.forEach(([x, y], k) => {
    const [sx, sy] = outline[start];
    if (y < sy || (y === sy && x < sx)) start = k;
  });
  const pts = [...outline.slice(start), ...outline.slice(0, start)];
  const edges = pts.map((p, k) => {
    const q = pts[(k + 1) % pts.length];
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = edges.reduce((s, e) => s + e.len, 0);
  const out = [];
  let e = 0;
  let walked = 0;
  for (let k = 0; k < n; k++) {
    const at = (k / n) * total;
    while (walked + edges[e].len < at) walked += edges[e++].len;
    const t = (at - walked) / edges[e].len;
    out.push([edges[e].p[0] + (edges[e].q[0] - edges[e].p[0]) * t, edges[e].p[1] + (edges[e].q[1] - edges[e].p[1]) * t]);
  }
  return out;
}

/** The outline partway (t = 0..1) from one step to the next. */
export function between(from, to, t) {
  return from.map(([x, y], k) => [x + (to[k][0] - x) * t, y + (to[k][1] - y) * t]);
}

export const toPath = (pts) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
