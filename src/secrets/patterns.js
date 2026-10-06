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
