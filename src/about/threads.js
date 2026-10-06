// The map of things I love. Every thing is a point at its own spot, and a
// thread runs through every point that shares a reason. At rest the
// threads are a faint tangle. Pick one and its points pull out of the
// tangle into a line, so you can read the reason straight across. The
// rest step aside.
//
// Points are buttons laid over an SVG that only draws the threads, so the
// labels stay crisp and readable at any size. A picked thread stands up
// straight, one point to a row, so every name has room on any screen.

const W = 1000;
const H = 700;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const NS = "http://www.w3.org/2000/svg";

/** A smooth curve through points in order (Catmull-Rom, as cubic Béziers). */
export function smooth(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let k = 0; k < pts.length - 1; k++) {
    const [p0, p1, p2, p3] = [pts[k - 1] || pts[k], pts[k], pts[k + 1], pts[k + 2] || pts[k + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1.map((v) => v.toFixed(1))} ${c2.map((v) => v.toFixed(1))} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// a thread's points, in the order they sit from top to bottom at home
export const along = (points, thread) => points.filter((p) => p.threads.includes(thread)).sort((a, b) => a.at[1] - b.at[1]);

/**
 * Where everything should be. With no thread picked, every point sits at
 * home. With one picked, its points spread evenly down a gentle S near the
 * middle, in the order they sit at home (so nobody crosses anybody on the
 * way), and the others move out to the side they're already nearest.
 */
export function layout(points, thread) {
  if (!thread) return points.map((p) => ({ x: p.at[0], y: p.at[1], lit: 1 }));
  const members = along(points, thread);
  const n = members.length;
  return points.map((p) => {
    const k = members.indexOf(p);
    if (k < 0) {
      const left = p.at[0] < W / 2;
      return { x: left ? 20 + p.at[0] * 0.1 : W - 20 - (W - p.at[0]) * 0.1, y: p.at[1], lit: 0.3 };
    }
    const u = n === 1 ? 0.5 : k / (n - 1);
    return { x: 380 + Math.sin(u * Math.PI * 2) * 30, y: 50 + u * (H - 100), lit: 1 };
  });
}

export function createMap(host, { threads, points, onPoint, onThread, pluck }) {
  host.classList.add("map");
  host.innerHTML = `<svg class="map__lines" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  const svg = host.querySelector("svg");
  const byThread = Object.fromEntries(threads.map((t) => [t.id, t]));

  // one visible line and one wide invisible one to click, per thread
  const lines = threads.map((t) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = `<path class="map__hit" /><path class="map__line" style="--c:${t.color}" pathLength="1" />`;
    g.dataset.thread = t.id;
    svg.appendChild(g);
    g.addEventListener("click", () => onThread(t.id));
    return { t, g, hit: g.firstChild, line: g.lastChild, reveal: 0 };
  });

  const nodes = points.map((p) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pt";
    b.dataset.id = p.id;
    b.style.setProperty("--c", byThread[p.threads[0]].color);
    b.innerHTML = `<i aria-hidden="true">${p.threads.map((id) => `<b style="--c:${byThread[id].color}"></b>`).join("")}</i><span>${p.name}</span>`;
    b.addEventListener("click", () => onPoint(p.id));
    host.appendChild(b);
    return { p, b, x: p.at[0], y: p.at[1], lit: 1, seed: Math.random() * 6.28 };
  });

  const state = { thread: null, point: null, portrait: false, moving: 0 };
  let goal = layout(points, null);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // a phone gets a taller map: same spots, more room between the rows
  new ResizeObserver(() => {
    state.portrait = host.clientWidth < 480;
    host.classList.toggle("is-portrait", state.portrait);
  }).observe(host);

  function setThread(id) {
    state.thread = id;
    goal = layout(points, id);
    for (const l of lines) {
      const on = l.t.id === id;
      l.g.classList.toggle("is-on", on);
      if (on) l.reveal = 0;
    }
    host.classList.toggle("has-thread", !!id);
    nodes.forEach((n) => n.b.classList.toggle("is-member", !!id && n.p.threads.includes(id)));
    // the points along the thread ring out in order, like a strummed string
    if (id && pluck) {
      const members = nodes.filter((n) => n.p.threads.includes(id)).sort((a, b) => a.p.at[1] - b.p.at[1]);
      members.forEach((n, k) => setTimeout(() => pluck(k, members.length), 120 + k * 70));
    }
  }

  function setPoint(id) {
    state.point = id;
    nodes.forEach((n) => {
      n.b.classList.toggle("is-picked", n.p.id === id);
      n.b.setAttribute("aria-pressed", String(n.p.id === id));
    });
  }

  function frame(t, dt) {
    const k = calm.matches ? 1 : 1 - Math.exp(-dt * 5);
    let moving = 0;
    nodes.forEach((n, i) => {
      const g = goal[i];
      // a slow drift, so the map is never quite still
      const drift = calm.matches ? 0 : 1;
      const gx = g.x + Math.sin(t * 0.35 + n.seed) * 7 * drift;
      const gy = g.y + Math.cos(t * 0.29 + n.seed * 1.7) * 6 * drift;
      moving += Math.abs(gx - n.x) + Math.abs(gy - n.y) > 4 ? 1 : 0;
      n.x += (gx - n.x) * k;
      n.y += (gy - n.y) * k;
      n.lit += (g.lit - n.lit) * k;
      n.b.style.left = `${(n.x / W) * 100}%`;
      n.b.style.top = `${(n.y / H) * 100}%`;
      n.b.style.opacity = n.lit.toFixed(3);
      // labels sit on the side with more room
      n.b.classList.toggle("is-flip", n.x / W > 0.72);
    });
    state.moving = moving;
    for (const l of lines) {
      const members = nodes.filter((n) => n.p.threads.includes(l.t.id)).sort((a, b) => a.p.at[1] - b.p.at[1]);
      const d = smooth(members.map((n) => [n.x, n.y]));
      l.line.setAttribute("d", d);
      l.hit.setAttribute("d", d);
      if (l.t.id === state.thread) {
        l.reveal = calm.matches ? 1 : Math.min(1, l.reveal + dt * 1.4);
        l.line.style.strokeDashoffset = (1 - l.reveal).toFixed(3);
      } else l.line.style.strokeDashoffset = "0";
    }
  }

  return { state, frame, setThread, setPoint, nodes };
}
