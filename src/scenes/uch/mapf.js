// Windowed hierarchical cooperative A* (Silver, 2005) - how everyone in the
// unit moves at once without touching.
//
// Time runs in ticks; each tick a person stays put or steps to a neighbour.
// Every few ticks, everyone re-plans the next WINDOW ticks in priority order
// against a shared reservation table: a cell can be held by one person per
// tick, and two people can't swap cells through each other. A higher-
// priority plan is made first; lower ones route (or wait) around it. Each
// search is A* through space *and* time, guided by the exact walking
// distance to the goal (the "hierarchical" part, from grid.js).
//
// An escort is planned as one unit: the patient follows a step behind the
// nurse, and the search reserves both of them.

import { COLS, ROWS } from "./layout.js";
import { createHeap } from "./heap.js";

export const WINDOW = 12; // ticks planned ahead
export const REPLAN = 4; // ticks executed before planning again
const N = COLS * ROWS;
const BUDGET = 1200; // nodes a single search may expand

export function createPlanner(grid) {
  const stats = { searches: 0, expanded: 0, failed: 0 };

  /**
   * Plan for everyone. agents: [{ id, cell, goal, priority, follower? }]
   * (followers themselves are skipped - they're planned with their leader).
   * Writes agent.plan = [cell at t=0, t=1, …] and follower.plan likewise.
   */
  function planAll(agents) {
    const res = new Map(); // t·N + cell → agent id
    const moves = new Set(); // "from>to@t"
    const reserve = (cell, t, id) => res.set(t * N + cell, id);
    // free for this person - or for their escort party (a patient may step
    // into the cell their own nurse is just leaving)
    const free = (cell, t, id, party = id) => {
      const o = res.get(t * N + cell);
      return o === undefined || o === id || o === party;
    };
    const reservePath = (path, id) => {
      for (let t = 0; t <= WINDOW; t++) reserve(path[Math.min(t, path.length - 1)], t, id);
      for (let t = 0; t + 1 < path.length; t++) if (path[t] !== path[t + 1]) moves.add(`${path[t]}>${path[t + 1]}@${t}`);
    };

    // Everyone's present position is theirs for the next instant, so nobody
    // plans to walk into a cell that's occupied right now.
    for (const a of agents) {
      reserve(a.cell, 0, a.id);
      reserve(a.cell, 1, a.id);
    }

    const order = agents.filter((a) => !a.leader).sort((a, b) => b.priority - a.priority || a.id - b.id);
    // People standing where they want to be hold their cell for the whole window.
    const parked = (a) => !a.follower && (a.goal === undefined || a.goal === a.cell);
    for (const a of order) if (parked(a)) reservePath((a.plan = [a.cell]), a.id);

    for (const a of order) {
      if (parked(a)) continue;
      const f = a.follower;
      const found = search(a, f, free, moves);
      a.plan = found.leader;
      reservePath(a.plan, a.id);
      if (f) {
        f.plan = found.follower;
        reservePath(f.plan, f.id);
      }
    }
  }

  // Space-time A*. A state is (cell, follower cell, t).
  function search(a, f, free, moves) {
    stats.searches++;
    const dist = grid.distanceTo(a.goal);
    const start = { cell: a.cell, fc: f ? f.cell : -1, t: 0, g: 0, prev: null };
    const h = (c) => dist[c];
    if (h(a.cell) === Infinity) return stay(a, f);
    const open = createHeap((x, y) => x.f < y.f || (x.f === y.f && x.hh < y.hh));
    start.f = h(a.cell);
    start.hh = start.f;
    open.push(start);
    const seen = new Set(); // numeric keys: (t·N + cell)·(N + 1) + follower cell
    let best = null;
    let partial = start; // the most promising node seen, if the budget runs out
    let expanded = 0;

    while (open.size && expanded < BUDGET) {
      const s = open.pop();
      const key = (s.t * N + s.cell) * (N + 1) + (s.fc + 1);
      if (seen.has(key)) continue;
      seen.add(key);
      expanded++;
      if (s.t > 0 && (s.hh < partial.hh || (s.hh === partial.hh && s.t > partial.t))) partial = s;
      // reached the goal and can stay there for the rest of the window: done
      if (s.cell === a.goal && canStay(s, a, f, free)) {
        best = s;
        break;
      }
      if (s.t === WINDOW) {
        if (!best || s.f < best.f) best = s;
        continue;
      }
      const t1 = s.t + 1;
      for (const next of [s.cell, ...grid.neighbours[s.cell]]) {
        if (!free(next, t1, a.id, f ? f.id : a.id)) continue;
        if (next !== s.cell && moves.has(`${next}>${s.cell}@${s.t}`)) continue; // a head-on swap
        let fc = -1;
        if (f) {
          if (next === s.fc) continue; // can't step onto your own patient
          fc = next === s.cell ? s.fc : s.cell; // they follow one step behind
          if (!free(fc, t1, f.id, a.id)) continue;
          if (fc !== s.fc && moves.has(`${fc}>${s.fc}@${s.t}`)) continue;
        }
        const g = s.g + (next === a.goal && s.cell === a.goal ? 0 : 1);
        const hh = h(next);
        open.push({ cell: next, fc, t: t1, g, f: g + hh, hh, prev: s });
      }
    }
    stats.expanded += expanded;
    if (!best) {
      stats.failed++;
      if (partial === start) return stay(a, f);
      best = partial; // closer than standing still; the executor guards the rest
    }
    const leader = [];
    const follower = [];
    for (let s = best; s; s = s.prev) {
      leader.unshift(s.cell);
      follower.unshift(s.fc);
    }
    return { leader, follower: f ? follower : null };
  }

  function canStay(s, a, f, free) {
    for (let t = s.t + 1; t <= WINDOW; t++) {
      if (!free(s.cell, t, a.id, f ? f.id : a.id)) return false;
      if (f && !free(s.fc, t, f.id, a.id)) return false;
    }
    return true;
  }

  const stay = (a, f) => ({ leader: [a.cell], follower: f ? [f.cell] : null });

  return { planAll, stats };
}
