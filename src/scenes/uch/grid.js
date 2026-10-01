// The floor as a grid of cells. People step to any of their 8 neighbours,
// but never cut a corner past a wall. Distances to a goal come from a
// breadth-first flood out from the goal, cached per goal: that's the
// "hierarchical" half of hierarchical cooperative A* - a perfect estimate
// of the walk ahead, ignoring other people.

import { COLS, ROWS, buildWalkable } from "./layout.js";

const STEPS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function createGrid() {
  const walk = buildWalkable();
  const id = (x, y) => y * COLS + x;
  const ok = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && walk[id(x, y)] === 1;

  // neighbour lists, built once
  const neighbours = Array.from({ length: COLS * ROWS }, (_, c) => {
    const x = c % COLS;
    const y = (c / COLS) | 0;
    if (!walk[c]) return [];
    const out = [];
    for (const [dx, dy] of STEPS) {
      if (!ok(x + dx, y + dy)) continue;
      if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue; // no corner cutting
      out.push(id(x + dx, y + dy));
    }
    return out;
  });

  const fields = new Map();
  /** Steps from every cell to `goal` (Infinity where unreachable). */
  function distanceTo(goal) {
    let d = fields.get(goal);
    if (d) return d;
    d = new Float32Array(COLS * ROWS).fill(Infinity);
    d[goal] = 0;
    const queue = [goal];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const n of neighbours[c]) {
        if (d[n] !== Infinity) continue;
        d[n] = d[c] + 1;
        queue.push(n);
      }
    }
    fields.set(goal, d);
    return d;
  }

  return { walk, id, xy: (c) => ({ x: c % COLS, y: (c / COLS) | 0 }), ok, neighbours, distanceTo };
}
