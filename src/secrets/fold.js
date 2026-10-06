// Folding a paper crane, for real. The paper is a set of flat pieces
// (facets). A fold is a crease line: every piece on one side of it is
// reflected across the line. Seen from straight on, a flap folding over
// keeps its distance along the crease and its distance from the crease
// shrinks by cos(πt): at t = ½ it stands edge-on, at t = 1 it lies flat
// on the other side, showing the back of the paper.
//
// Units: the sheet is a square of side 2, turned to a diamond, centered
// on (0, 0), with y pointing down. The creases are the traditional
// crane's: the square base, the bird base's 22.5° kite folds and petal
// fold (its hinge sits at √2 − 1), the legs narrowed again to 11.25°, then
// the neck, tail and head reverse-folded up.

const R = Math.SQRT2; // center to corner
const H = Math.SQRT2 - 1; // the bird base's hinge: where the side corners land
const X = Math.tan(Math.PI / 16); // half-width of a narrowed leg at the hinge
const deg = (d) => (d * Math.PI) / 180;

/** Which side of the line (through p, at angle a) q is on. */
const side = ({ p, a }, q) => -Math.sin(a) * (q[0] - p[0]) + Math.cos(a) * (q[1] - p[1]);

/** The part of a convex polygon on one side (sign) of a line. */
export function clip(poly, line, sign) {
  const out = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const sa = side(line, a) * sign;
    const sb = side(line, b) * sign;
    if (sa >= 0) out.push(a);
    if (sa * sb < 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  // a sliver with no area (a piece lying along the crease) is nothing
  const area = out.reduce((sum, [x, y], k) => sum + x * out[(k + 1) % out.length][1] - out[(k + 1) % out.length][0] * y, 0);
  return out.length >= 3 && Math.abs(area) > 1e-7 ? out : null;
}

/** Fold q across the line, t of the way (0 = not at all, 1 = flat on the other side). */
export function foldPoint(q, { p, a }, t) {
  const d = [Math.cos(a), Math.sin(a)];
  const along = (q[0] - p[0]) * d[0] + (q[1] - p[1]) * d[1];
  const f = [p[0] + d[0] * along, p[1] + d[1] * along];
  const k = Math.cos(Math.PI * t);
  return [f[0] + (q[0] - f[0]) * k, f[1] + (q[1] - f[1]) * k];
}

const through = (p, q) => ({ p, a: Math.atan2(q[1] - p[1], q[0] - p[0]) });
const at = (p, degrees) => ({ p, a: deg(degrees) });

/**
 * One fold: the crease, which side moves (the side holding `moves`),
 * optionally only inside a region, only some pieces (by tag), and keep
 * (the moved part also stays behind: inner layers we don't track one by
 * one, like the legs under a petal fold).
 */
export const FOLDS = [
  // 1. the square base: in half, then both side corners down to the bottom
  { line: at([0, 0], 0), moves: [0, -1] },
  { line: through([0, 0], [-R / 2, R / 2]), moves: [-R, 0] },
  { line: through([0, 0], [R / 2, R / 2]), moves: [R, 0] },
  // 2. the bird base: kite folds to the center line, then the petal fold
  { line: through([0, R], [H, H]), moves: [R / 2, R / 2] },
  { line: through([0, R], [-H, H]), moves: [-R / 2, R / 2] },
  { line: at([0, H], 0), moves: [0, 1], keep: true },
  // 3. narrow the legs
  { line: through([0, R], [X, H]), moves: [H, 0.9], region: [at([0, H], 0), 1] },
  { line: through([0, R], [-X, H]), moves: [-H, 0.9], region: [at([0, H], 0), 1] },
  // 4. reverse-fold the neck (right) and tail (left) up between the wings
  { line: at([0.04, 0.48], 12), moves: [0.05, 1.3], region: [at([0, 0], 90), -1], tag: "leg" },
  { line: at([-0.04, 0.48], 168), moves: [-0.05, 1.3], region: [at([0, 0], 90), 1], tag: "leg" },
  // 5. the head: the last fifth of the neck, turned down and forward
  { line: at([0.307, -0.217], -20.5), moves: [0.383, -0.39], region: [at([0, 0], 90), -1], only: "leg", tag: "leg" },
];
// clicks → folds: square base, bird base, narrow, neck and tail, head
export const STEPS = [
  { name: "square base", folds: [0, 1, 2] },
  { name: "bird base", folds: [3, 4, 5] },
  { name: "narrow", folds: [6, 7] },
  { name: "neck and tail", folds: [8, 9] },
  { name: "head", folds: [10] },
];
// the wings, folding down at the shoulders: how a finished crane flaps
export const WINGS = { line: at([0, H], 0), moves: [0, -1], except: "leg" };

export const SHEET = [{ pts: [[0, -R], [R, 0], [0, R], [-R, 0]], back: false, tag: "" }];

/** Apply one fold, t of the way, to every piece it touches. */
export function fold(pieces, f, t = 1) {
  const sign = Math.sign(side(f.line, f.moves));
  const stay = [];
  const moved = [];
  for (const piece of pieces) {
    const skip = (f.only && piece.tag !== f.only) || (f.except && piece.tag === f.except);
    if (skip) {
      stay.push(piece);
      continue;
    }
    let move = clip(piece.pts, f.line, sign);
    if (move && f.region) move = clip(move, f.region[0], f.region[1]);
    if (!move) {
      stay.push(piece);
      continue;
    }
    if (f.keep) stay.push(piece);
    else {
      // what's left: the far side of the crease, and anything outside the region
      const rest = clip(piece.pts, f.line, -sign);
      if (rest) stay.push({ ...piece, pts: rest });
      if (f.region) {
        const near = clip(piece.pts, f.line, sign);
        const outside = near && clip(near, f.region[0], -f.region[1]);
        if (outside) stay.push({ ...piece, pts: outside });
      }
    }
    moved.push({
      pts: move.map((q) => foldPoint(q, f.line, t)),
      back: Math.cos(Math.PI * t) < 0 ? !piece.back : piece.back,
      tag: f.tag || piece.tag,
      // how square-on it is to us, for shading while it turns
      turn: Math.abs(Math.cos(Math.PI * t)),
    });
  }
  return [...stay, ...moved];
}

/** The paper after the first n folds. */
export function folded(n) {
  let pieces = SHEET;
  for (let k = 0; k < n; k++) pieces = fold(pieces, FOLDS[k]);
  return pieces;
}

// The crease pattern on the open sheet: diagonals and book folds, the
// 22.5° folds from each corner, and the small square in the middle.
const t = Math.tan(Math.PI / 8);
const b = 1 - t;
const rot = ([u, v]) => [(u - v) / Math.SQRT2, (u + v) / Math.SQRT2];
export const CREASES = [
  ...[[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]].map((l) => ({ l, valley: true })),
  ...[[[-1, 0], [1, 0]], [[0, -1], [0, 1]]].map((l) => ({ l, valley: false })),
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy]) => [
    { l: [[sx, sy], [0, sy * b]], valley: true },
    { l: [[sx, sy], [sx * b, 0]], valley: true },
  ]),
  ...[[[0, -b], [b, 0]], [[b, 0], [0, b]], [[0, b], [-b, 0]], [[-b, 0], [0, -b]]].map((l) => ({ l, valley: false })),
].map(({ l, valley }) => ({ l: l.map(rot), valley }));
