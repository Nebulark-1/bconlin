// The secrets page: a square of paper. Click it and it folds itself into
// a crane, one crease at a time (see fold.js): square base, bird base,
// narrowed legs, neck and tail, head. Finished, it flaps and flies off the
// screen the way it's facing, rising a little on each down-stroke. A
// fresh sheet takes its place, and every crane is counted.

import { discover, isFound, isOn } from "../site/eggs.js";
import { chime, pluck, PENTATONIC } from "../site/sound.js";
import { FOLDS, STEPS, WINGS, SHEET, CREASES, fold, folded } from "./fold.js";
import { remember, keep } from "./store.js";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const FOLD_MS = 380;
const FRONT = "#ffb48c"; // the colored side
const BACK = "#fff1e4"; // the white side
const INK = "#2a1408";

const lerp = (a, b, t) => a + (b - a) * t;
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `rgb(${c.join(",")})`;
};
const box = (pieces) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { pts } of pieces) for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) };
};

/** Paper pieces as SVG paths, centered in a 200 × 200 box at the given framing. */
function paths(pieces, frame) {
  return pieces
    .map(({ pts, back, turn = 1 }) => {
      const d = pts.map(([x, y]) => `${(100 + (x - frame.cx) * frame.k).toFixed(1)} ${(100 + (y - frame.cy) * frame.k).toFixed(1)}`).join("L");
      return `<path d="M${d}Z" fill="${shade(back ? BACK : FRONT, 0.72 + 0.28 * turn)}"/>`;
    })
    .join("");
}
const creaseLines = (frame) =>
  CREASES.map(({ l, valley }) => {
    const [[x1, y1], [x2, y2]] = l.map(([x, y]) => [100 + (x - frame.cx) * frame.k, 100 + (y - frame.cy) * frame.k]);
    return `<path class="${valley ? "valley" : "mountain"}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join("");

// fit the paper in the box, a little smaller when it's still a big sheet
const fit = (pieces) => {
  const b = box(pieces);
  return { cx: b.cx, cy: b.cy, k: Math.min(64, 172 / b.size) };
};

/** A finished crane with its wings `down` of the way through a flap (0..0.7). */
const flapping = (crane, down) => fold(crane, WINGS, down);

export function mountCrane() {
  const host = document.querySelector(".sky__text");
  if (!host) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "crane";
  button.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true"><g class="crane__paper"></g><g class="crane__creases"></g></svg>`;
  const tally = document.createElement("p");
  tally.className = "crane__tally";
  host.append(button, tally);
  const paper = button.querySelector(".crane__paper");
  const creases = button.querySelector(".crane__creases");

  // where we are: `done` folds made; the fold in motion, if any
  let done = 0;
  let queue = []; // folds still to make for this click
  let foldStart = 0;
  let frame = fit(SHEET);
  let busy = false;
  const name = () => {
    const last = [...STEPS].reverse().find((st) => st.folds[st.folds.length - 1] < done);
    button.setAttribute("aria-label", !last ? "A square of paper" : done === FOLDS.length ? "A paper crane" : `A square of paper, folded into a ${last.name}`);
  };
  const count = () => {
    const n = isFound("cranes") && isOn("cranes") ? remember("bc-cranes") : 0;
    tally.textContent = n ? `${n.toLocaleString("en-US")} folded` : "";
  };
  name();
  count();

  const draw = (now) => {
    let pieces = folded(done);
    if (queue.length) {
      const t = calm() ? 1 : Math.min(1, (now - foldStart) / FOLD_MS);
      pieces = fold(pieces, FOLDS[queue[0]], t);
      if (t >= 1) {
        done = queue.shift() + 1;
        foldStart = now;
        pluck(220 * [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5, 3, 3.333, 4][done - 1], 0.45);
        pieces = folded(done);
      }
    }
    // ease the framing toward this stage's
    const goal = fit(pieces);
    const e = calm() ? 1 : 0.18;
    frame = { cx: lerp(frame.cx, goal.cx, e), cy: lerp(frame.cy, goal.cy, e), k: lerp(frame.k, goal.k, e) };
    paper.innerHTML = paths(pieces, frame);
    creases.innerHTML = done === 0 && !queue.length ? creaseLines(frame) : "";
    if (queue.length || Math.abs(frame.k - goal.k) > 0.05 || Math.abs(frame.cx - goal.cx) > 0.002) requestAnimationFrame(draw);
    // finished: a moment to see it, then off it goes
    else if (done === FOLDS.length && busy && !flying) {
      flying = true;
      setTimeout(launch, calm() ? 0 : 500);
    }
  };
  requestAnimationFrame(draw);

  let flying = false;
  const launch = () => {
    keep("bc-cranes", remember("bc-cranes") + 1);
    discover("cranes");
    fly(button, folded(FOLDS.length), frame, () => {
      count();
      // a fresh sheet
      done = 0;
      frame = fit(SHEET);
      flying = false;
      busy = false;
      button.classList.add("is-new");
      requestAnimationFrame(draw);
      setTimeout(() => button.classList.remove("is-new"), 50);
      name();
    });
    paper.innerHTML = "";
  };

  // one click, one whole crane
  button.addEventListener("click", () => {
    if (busy || done) return;
    busy = true;
    queue = FOLDS.map((_, k) => k);
    foldStart = performance.now();
    requestAnimationFrame(draw);
  });
}

/**
 * The crane flies off the way it faces (its head is on the right): the
 * wings fold down and up at the shoulders, and the body rises a little
 * on every down-stroke, the way a bird's does.
 */
function fly(button, crane, frame, done) {
  const start = button.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "crane-flight";
  el.style.width = `${start.width}px`;
  el.style.height = `${start.height}px`;
  el.innerHTML = `<svg viewBox="0 0 200 200" aria-hidden="true"><g class="crane__paper"></g></svg>`;
  document.body.appendChild(el);
  const g = el.querySelector("g");
  [0, 2, 4].forEach((n, k) => setTimeout(() => chime(PENTATONIC[n + 3], 0.03, 0.5, 1.6), k * 160));
  const t0 = performance.now();
  const distance = innerWidth - start.left + start.width;
  const tick = (now) => {
    const s = (now - t0) / 1000;
    // a flap a little faster than once a second
    const phase = s * Math.PI * 2 * 1.4;
    const down = 0.35 - 0.35 * Math.cos(phase); // 0 (up) .. 0.7 (down)
    const lift = Math.sin(phase); // positive while the wings are on their way down
    const warm = Math.min(1, s / 0.6); // a moment to start flapping before it goes
    const x = start.left + Math.max(0, s - 0.5) ** 1.4 * 260;
    const y = start.top - lift * 6 * warm - Math.max(0, s - 0.5) * 40;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    g.innerHTML = paths(flapping(crane, calm() ? 0 : down * warm), frame);
    if (x - start.left < distance && !calm()) return requestAnimationFrame(tick);
    el.remove();
    done();
  };
  requestAnimationFrame(tick);
}
