// The patterns some secrets listen for. Each is a small, pure check so it
// can be read on its own (and shown in Behind the scenes).

export const PHI = (1 + Math.sqrt(5)) / 2;

/** ↑ ↑ ↓ ↓ ← → ← → B A */
export const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Feed it keys one at a time; it says when the last ten were the code. */
export function konami() {
  let at = 0;
  return (key) => {
    const k = key.length === 1 ? key.toLowerCase() : key;
    // a wrong key starts over, but an extra ↑ still counts as ↑ ↑
    if (k === KONAMI[at]) at++;
    else at = k === "ArrowUp" ? (at >= 2 ? 2 : 1) : 0;
    if (at === KONAMI.length) {
      at = 0;
      return true;
    }
    return false;
  };
}

/**
 * Was this stroke a circle? Find its middle, then ask three things: does
 * it stay about the same distance from the middle the whole way round, does
 * it go all the way round, and does it end near where it started?
 * Returns the circle ({ x, y, r }) or null.
 */
export function circleFrom(points) {
  if (points.length < 16) return null;
  const x = points.reduce((s, p) => s + p.x, 0) / points.length;
  const y = points.reduce((s, p) => s + p.y, 0) / points.length;
  const radii = points.map((p) => Math.hypot(p.x - x, p.y - y));
  const r = radii.reduce((s, v) => s + v, 0) / radii.length;
  if (r < 36) return null;
  const spread = Math.sqrt(radii.reduce((s, v) => s + (v - r) ** 2, 0) / radii.length) / r;
  if (spread > 0.2) return null;
  let turned = 0;
  for (let k = 1; k < points.length; k++) {
    let d = Math.atan2(points[k].y - y, points[k].x - x) - Math.atan2(points[k - 1].y - y, points[k - 1].x - x);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    turned += d;
  }
  if (Math.abs(turned) < Math.PI * 1.75) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(last.x - first.x, last.y - first.y) > r * 0.8) return null;
  return { x, y, r };
}

/**
 * Clicks in groups: clicks less than `gap` ms apart are one group. Feed it
 * click times; it says when the groups so far end in 1, 1, 2, 3, 5.
 * (The 5 is only known to be done when the next pause starts, so it also
 * takes a `now` with no click, from a timer.)
 */
export const FIB = [1, 1, 2, 3, 5];
export function fibonacciRhythm(gap = 450) {
  let groups = [];
  let last = -Infinity;
  const check = () => FIB.every((n, k) => groups[groups.length - FIB.length + k] === n);
  return {
    click(t) {
      if (t - last < gap) groups[groups.length - 1]++;
      else groups.push(1);
      last = t;
      groups = groups.slice(-8);
    },
    /** Call after a pause: true if that pause just closed 1, 1, 2, 3, 5. */
    pause(t) {
      if (t - last < gap || !groups.length) return false;
      const hit = check();
      if (hit) groups = [];
      return hit;
    },
  };
}

/** The squares of a Fibonacci spiral: sizes 1, 1, 2, 3, 5..., each laid on
 *  the next side of everything so far (right, up, left, down), with the
 *  quarter circle through each that makes the spiral. Units, not pixels. */
export function fibonacciSquares(count = 9) {
  const sizes = [1, 1];
  while (sizes.length < count) sizes.push(sizes[sizes.length - 1] + sizes[sizes.length - 2]);
  const box = { x0: 0, y0: 0, x1: 1, y1: 1 };
  return sizes.map((s, k) => {
    let x = 0;
    let y = 0;
    const dir = ["down", "right", "up", "left"][k % 4];
    if (k > 0) {
      if (dir === "right") [x, y] = [box.x1, box.y0];
      if (dir === "up") [x, y] = [box.x0, box.y0 - s];
      if (dir === "left") [x, y] = [box.x0 - s, box.y0];
      if (dir === "down") [x, y] = [box.x0, box.y1];
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x + s);
      box.y1 = Math.max(box.y1, y + s);
    }
    // the arc's center is one corner; it runs between the two next to it
    const corners = {
      right: [[x, y], [x, y + s], [x + s, y]],
      up: [[x, y + s], [x + s, y + s], [x, y]],
      left: [[x + s, y + s], [x + s, y], [x, y + s]],
      down: [[x + s, y], [x, y], [x + s, y + s]],
    }[dir];
    return { x, y, s, center: corners[0], from: corners[1], to: corners[2], box: { ...box } };
  });
}

/** Is this window golden: width ÷ height (either way round) within 1% of φ? */
export const isGolden = (w, h) => Math.abs(Math.max(w, h) / Math.min(w, h) / PHI - 1) < 0.01;

/** Is it 11:11, morning or night? */
export const isElevenEleven = (d) => d.getHours() % 12 === 11 && d.getMinutes() === 11;

/** After dark here: 9 pm to 5 am. */
export const isNight = (d) => d.getHours() >= 21 || d.getHours() < 5;
