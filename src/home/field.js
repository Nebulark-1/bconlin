import { clamp, lerp, easeInOutCubic } from "../engine/math.js";
import { reducedMotion } from "../engine/scroll.js";
import { COLORS } from "./palette.js";
import { N, PER, NOW, SPANS, uOf } from "./structures.js";

// 400 points over the whole page, on one fixed canvas. Each frame they ask
// which structure is nearest the middle of the window and race to fill it.
// Each point is a spring toward its place in that structure; while the
// points are strings, each is also pulled toward its neighbours, so a flick
// of the cursor travels along a string as a wave. Scrolling carries every
// point with the page, so a filled structure scrolls like the page does.

const IDS = ["houghton", "law", "uchealth", "chaos"]; // string order
const MONO = (size) => `500 ${size}px "JetBrains Mono", monospace`;
const TRAVEL = 750; // ms for a point to move between structures
const SETTLE = 900; // ms after arriving that a string stays held firm

/**
 * structures: [{ id, el, kind: "thread" | "dots", spans, slot(i, rect, t, now),
 *               guides?(ctx, rect, t, bp), overlay?(ctx, rect, field) }]
 * onPluck(string, strength, pan) / onScatter(strength, pan) / onActive(k)
 */
export function createField(canvas, structures, { onPluck, onScatter, onActive } = {}) {
  const ctx = canvas.getContext("2d");
  const pts = Array.from({ length: N }, (_, i) => ({
    i,
    string: Math.floor(i / PER),
    u: (i % PER) / (PER - 1),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    from: 0,
    to: 0,
    switchAt: 0,
    tvx: 0, // how fast the point's target is moving
    tvy: 0,
    hold: 0, // 1 while travelling and just after: a firmer, better-damped spring
    dot: 0, // 0 = part of a string, 1 = a free dot
    r: 0,
    a: 0,
    color: "#fff",
  }));
  const stats = { active: null, scores: [], fps: 60, energy: 0, plucks: 0, travelling: 0 };
  const glow = [0, 0, 0, 0];
  const lastPluck = [0, 0, 0, 0];
  const pointer = { x: 0, y: 0, t: 0, inside: false };
  let rects = [];
  let active = -1;
  let W = 0;
  let H = 0;
  let lastScroll = window.scrollY;
  let last = performance.now();
  const born = last;
  let placed = false;
  let lastScatter = 0;
  const field = { pts, stats, ctx, weights: [1, 1, 1, 1], get active() { return active; }, get size() { return [W, H]; } };

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  /**
   * Which structure gets the points: the one whose middle is nearest the
   * middle of the window, among those on screen. The current one gets a
   * head start, so the points don't flicker between two close candidates.
   */
  function chooseActive() {
    let best = active;
    let bestScore = Infinity;
    stats.scores = rects.map((r, k) => {
      if (r.bottom < 0 || r.top > H) return null;
      const score = Math.abs((r.top + r.bottom) / 2 - H * 0.5) - (k === active ? 80 : 0);
      if (score < bestScore) (bestScore = score), (best = k);
      return score;
    });
    return best;
  }

  // Send every point toward structure k. Strings set off from their 2021
  // end, so they uncoil; dots set off in a wave, first to last.
  function retarget(k, now) {
    const thread = structures[k].kind === "thread";
    for (const p of pts) {
      if (clamp((now - p.switchAt) / TRAVEL) >= 0.5) p.from = p.to;
      p.to = k;
      p.switchAt = now + (thread ? p.u * 450 : (p.i / N) * 550);
    }
    active = k;
    stats.active = structures[k].id;
    onActive?.(k);
  }

  function targets(now, t, dt) {
    const slotOf = (k, i) => structures[k].slot(i, rects[k], t, now);
    let travelling = 0;
    for (const p of pts) {
      const elapsed = now - p.switchAt;
      const b = easeInOutCubic(clamp(elapsed / TRAVEL));
      const B = slotOf(p.to, p.i);
      const [ox, oy] = [p.tx, p.ty];
      p.hold = 1 - clamp((elapsed - TRAVEL) / SETTLE);
      if (b >= 1) {
        Object.assign(p, { tx: B.x, ty: B.y, dot: B.dot, r: B.r, a: B.a * B.dot, color: B.color });
      } else {
        travelling++;
        const A = slotOf(p.from, p.i);
        const lift = Math.sin(b * Math.PI) * Math.min(90, Math.hypot(B.x - A.x, B.y - A.y) * 0.18);
        p.tx = lerp(A.x, B.x, b);
        p.ty = lerp(A.y, B.y, b) - lift;
        p.dot = lerp(A.dot, B.dot, b);
        p.r = lerp(A.r, B.r, b);
        p.a = lerp(A.a, B.a, b) * p.dot;
        p.color = b < 0.5 ? A.color : B.color;
      }
      // capped, so a target that jumps (scrolling back mid-move) can't kick
      p.tvx = dt ? clamp((p.tx - ox) / dt, -2500, 2500) : 0;
      p.tvy = dt ? clamp((p.ty - oy) / dt, -2500, 2500) : 0;
    }
    stats.travelling = travelling;
  }

  /**
   * One physics step. Each point is a spring toward its target. String
   * points are also pulled toward the average of their two neighbours
   * (tension), which is what turns a nudge into a travelling wave.
   *
   * At rest a string is loose and lightly damped, so a pluck rings along
   * it. While it's moving to a new structure, and for a moment after, it's
   * held firmer and damped harder, but only against moving differently
   * from its target: it keeps up with where it's going, still trails and
   * ripples like a string, then settles quickly instead of wobbling on.
   */
  function step(dt) {
    let energy = 0;
    for (const p of pts) {
      const s = 1 - p.dot;
      const hold = p.hold * s;
      const K = lerp(lerp(110, 55, s), 140, hold);
      const C = lerp(lerp(15, 3.2, s), 20, hold);
      const dx = p.x - p.tx;
      const dy = p.y - p.ty;
      let ax = -K * dx - C * (p.vx - p.tvx * hold);
      let ay = -K * dy - C * (p.vy - p.tvy * hold);
      const k = p.i % PER;
      if (s > 0.01 && k > 0 && k < PER - 1) {
        const a = pts[p.i - 1];
        const b = pts[p.i + 1];
        const T = 3000 * s;
        ax += T * (a.x - a.tx + (b.x - b.tx) - 2 * dx);
        ay += T * (a.y - a.ty + (b.y - b.ty) - 2 * dy);
      }
      p.vx += ax * dt;
      p.vy += ay * dt;
      energy += p.vx * p.vx + p.vy * p.vy;
    }
    for (const p of pts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    stats.energy = energy / N;
  }

  // ── The cursor plucks strings and scatters dots ──
  function touch(x, y, now) {
    const dt = Math.max(1, now - pointer.t) / 1000;
    const x0 = pointer.inside ? pointer.x : x;
    const y0 = pointer.inside ? pointer.y : y;
    const vx = (x - x0) / dt;
    const vy = (y - y0) / dt;
    Object.assign(pointer, { x, y, t: now, inside: true });
    const speed = Math.hypot(vx, vy);
    if (reducedMotion || speed < 60) return;
    const hit = [0, 0, 0, 0];
    let scattered = 0;
    const lx = x - x0;
    const ly = y - y0;
    const len2 = lx * lx + ly * ly || 1;
    for (const p of pts) {
      // distance from the point to the cursor's path this frame
      const s = clamp(((p.x - x0) * lx + (p.y - y0) * ly) / len2);
      const qx = x0 + lx * s - p.x;
      const qy = y0 + ly * s - p.y;
      const d = Math.hypot(qx, qy);
      if (p.dot < 0.5) {
        if (d < 14) {
          // a nudge in the cursor's direction, capped so the string flexes
          // rather than being dragged along
          const k = (1 - d / 14) * 0.25;
          p.vx += clamp(vx, -2500, 2500) * k;
          p.vy += clamp(vy, -2500, 2500) * k;
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > 1600) (p.vx *= 1600 / sp), (p.vy *= 1600 / sp);
          hit[p.string] = Math.max(hit[p.string], 1 - d / 14);
        }
      } else if (d < 60 && d > 0.01 && p.a > 0.05) {
        const push = (60 - d) * 0.7;
        p.vx -= (qx / d) * push;
        p.vy -= (qy / d) * push;
        scattered++;
      }
    }
    const pan = (x / W) * 2 - 1;
    hit.forEach((h, i) => {
      if (!h || now - lastPluck[i] < 90) return;
      lastPluck[i] = now;
      glow[i] = 1;
      stats.plucks++;
      onPluck?.(i, clamp(speed / 2200) * h, pan);
    });
    if (scattered > 3 && now - lastScatter > 140) {
      lastScatter = now;
      onScatter?.(clamp(scattered / 40), pan);
    }
  }
  window.addEventListener("pointermove", (e) => touch(e.clientX, e.clientY, performance.now()), { passive: true });
  window.addEventListener("touchmove", (e) => touch(e.touches[0].clientX, e.touches[0].clientY, performance.now()), { passive: true });
  document.addEventListener("pointerleave", () => (pointer.inside = false));

  // ── Drawing ──
  function at(s, f) {
    const k = clamp(f, 0, PER - 1);
    const a = pts[s * PER + Math.floor(k)];
    const b = pts[s * PER + Math.min(PER - 1, Math.floor(k) + 1)];
    const t = k - Math.floor(k);
    return [lerp(a.x, b.x, t), lerp(a.y, b.y, t)];
  }

  // a smooth path along string s between fractional indices
  function stroke(s, fa, fb) {
    const list = [at(s, fa)];
    for (let k = Math.ceil(fa + 1e-6); k < fb; k++) list.push([pts[s * PER + k].x, pts[s * PER + k].y]);
    list.push(at(s, fb));
    ctx.beginPath();
    ctx.moveTo(list[0][0], list[0][1]);
    for (let n = 1; n < list.length - 1; n++) {
      const [x, y] = list[n];
      const [nx, ny] = list[n + 1];
      ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    ctx.lineTo(...list[list.length - 1]);
    ctx.stroke();
  }
  field.at = at;

  /** Are the points strings right now (rather than chart dots)? */
  field.isStrings = () => active !== -1 && structures[active].kind === "thread";

  /**
   * Pluck string s from code (humming, the console): a push across the
   * string at a random spot, which then travels along it like a real pluck.
   * It plays its note too, unless `play` is false (the encore plays its
   * own tune).
   */
  field.pluckString = (s, strength = 0.4, play = true) => {
    if (reducedMotion) return;
    const k = 12 + Math.floor(Math.random() * (PER - 24));
    for (let j = -6; j <= 6; j++) {
      const p = pts[s * PER + k + j];
      const a = pts[s * PER + k + j - 1];
      const b = pts[s * PER + k + j + 1];
      // push along the string's normal, strongest at the centre
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      const f = (1 - Math.abs(j) / 7) * strength * 700;
      p.vx += (-ty / len) * f;
      p.vy += (tx / len) * f;
    }
    glow[s] = Math.max(glow[s], 0.6 + 0.4 * strength);
    if (play) onPluck?.(s, strength, (pts[s * PER + k].x / W) * 2 - 1, true);
  };

  const idx = (year) => uOf(year) * (PER - 1);
  const onScreen = (r) => r.bottom > -60 && r.top < H + 60;

  function draw(now, t, reveal, bp) {
    ctx.clearRect(0, 0, W, H);
    const wire = "#9fe3ff";

    // the structures' empty shapes, whether or not the points are there
    structures.forEach((s, k) => onScreen(rects[k]) && s.guides?.(ctx, rects[k], t, bp, field));

    // strings
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const end = reveal * (PER - 1);
    const nowIdx = idx(NOW);
    IDS.forEach((id, s) => {
      let dots = 0;
      for (let k = 0; k < PER; k++) dots += pts[s * PER + k].dot;
      const lineA = 1 - dots / PER;
      if (lineA < 0.01 || end <= 0) return;
      const mid = pts[s * PER + 50];
      const home = structures[clamp((now - mid.switchAt) / TRAVEL) < 0.5 ? mid.from : mid.to];
      const col = COLORS[id];
      const w = Math.max(glow[s], field.weights[s]);
      if (home.spans) {
        ctx.globalAlpha = lineA * (bp ? 0.6 : 0.18 + 0.25 * w);
        ctx.strokeStyle = bp ? wire : col;
        ctx.lineWidth = 1.2;
        stroke(s, 0, Math.min(end, nowIdx));
        if (end > nowIdx) {
          ctx.setLineDash([2, 5]);
          stroke(s, nowIdx, end);
          ctx.setLineDash([]);
        }
      }
      ctx.strokeStyle = col;
      ctx.globalAlpha = lineA * (bp ? 0.9 : home.spans ? 0.25 + 0.75 * w : 0.55 + 0.45 * glow[s]);
      ctx.lineWidth = bp ? 1 : (home.spans ? 2.3 : 1.6) + 1.6 * glow[s];
      ctx.shadowColor = col;
      ctx.shadowBlur = bp ? 0 : 5 + 12 * w;
      if (home.spans) {
        for (const [a, b] of SPANS[id]) {
          const fb = Math.min(idx(b), end);
          if (fb > idx(a)) stroke(s, idx(a), fb);
        }
      } else {
        stroke(s, 0, end);
      }
      ctx.shadowBlur = 0;
    });

    // dots
    for (const p of pts) {
      if (p.a < 0.01 || p.r < 0.2 || p.y < -20 || p.y > H + 20) continue;
      ctx.globalAlpha = p.a;
      if (bp) {
        ctx.strokeStyle = wire;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    structures.forEach((s, k) => onScreen(rects[k]) && s.overlay?.(ctx, rects[k], field, now));
    if (bp) drawGuides();
  }

  // Blueprint: each point's target and velocity.
  function drawGuides() {
    ctx.save();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "#ffd23f";
    ctx.beginPath();
    for (let i = 0; i < N; i += 3) {
      const p = pts[i];
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.05, p.y + p.vy * 0.05);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(159,227,255,.8)";
    ctx.beginPath();
    for (let i = 0; i < N; i += 5) {
      const p = pts[i];
      ctx.moveTo(p.tx - 2.5, p.ty);
      ctx.lineTo(p.tx + 2.5, p.ty);
      ctx.moveTo(p.tx, p.ty - 2.5);
      ctx.lineTo(p.tx, p.ty + 2.5);
    }
    ctx.stroke();
    // which structure has the points, and how near each one is
    ctx.font = MONO(10);
    ctx.fillStyle = "#d4f1ff";
    structures.forEach((s, k) => {
      const r = rects[k];
      if (!onScreen(r)) return;
      ctx.strokeStyle = k === active ? "#9fe3ff" : "rgba(159,227,255,.35)";
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(r.left - 6, r.top - 6, r.width + 12, r.height + 12);
      ctx.setLineDash([]);
      ctx.fillText(`${s.id}${k === active ? "  ← points here" : ""}`, r.left - 4, r.top - 12);
    });
    ctx.restore();
  }

  field.frame = (now, bp) => {
    // back from a pause (a background tab): don't fling the points across
    // the gap, just put them where they belong
    const paused = now - last > 250;
    const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
    stats.fps = lerp(stats.fps, 1 / Math.max(dt, 1 / 240), 0.05);
    last = now;
    const t = reducedMotion ? 0 : (now - born) / 1000;
    const reveal = reducedMotion ? 1 : easeInOutCubic(clamp((now - born - 200) / 1900));

    // the points ride along with the page
    const dy = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    if (dy) for (const p of pts) (p.y -= dy), (p.ty -= dy);

    rects = structures.map((s) => s.el.getBoundingClientRect());
    const next = chooseActive();
    if (next !== -1 && next !== active) {
      if (active === -1) {
        active = next;
        for (const p of pts) (p.from = p.to = next), (p.switchAt = -1e9);
        stats.active = structures[next].id;
        onActive?.(next);
      } else retarget(next, now);
    }
    if (active === -1) return;
    targets(now, t, dt);
    if (!placed || paused) {
      for (const p of pts) (p.x = p.tx), (p.y = p.ty), (p.vx = p.vy = 0);
      placed = true;
    }
    if (reducedMotion) {
      for (const p of pts) (p.x = p.tx), (p.y = p.ty), (p.vx = p.vy = 0);
    } else {
      for (let k = 0; k < 4; k++) step(dt / 4);
    }
    for (let i = 0; i < 4; i++) glow[i] *= 0.94;
    draw(now, t, reveal, bp);
  };

  return field;
}
