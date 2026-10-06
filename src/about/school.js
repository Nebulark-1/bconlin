// A school of fish from three local rules (Craig Reynolds' boids): don't
// crowd your neighbors, swim the way they swim, and drift toward the middle
// of the group. Nobody leads. The pointer is a predator, and fish near it
// flee, which is when a school looks most like one animal.

export function makeSchool(n, w, h) {
  return Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    return { x: w * (0.3 + Math.random() * 0.4), y: h * (0.3 + Math.random() * 0.4), vx: Math.cos(a) * 40, vy: Math.sin(a) * 20 };
  });
}

export const RULES = { see: 34, space: 11, align: 1.6, cohere: 0.9, separate: 26, flee: 70, speed: [38, 95] };

export function swim(fish, dt, w, h, predator) {
  const { see, space, align, cohere, separate, flee, speed } = RULES;
  for (const f of fish) {
    let n = 0, ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0;
    for (const o of fish) {
      if (o === f) continue;
      const dx = o.x - f.x;
      const dy = o.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d > see) continue;
      n++;
      ax += o.vx;
      ay += o.vy;
      cx += dx;
      cy += dy;
      if (d < space) {
        sx -= dx / (d || 1);
        sy -= dy / (d || 1);
      }
    }
    if (n) {
      f.vx += ((ax / n - f.vx) * align + cx / n * cohere) * dt;
      f.vy += ((ay / n - f.vy) * align + cy / n * cohere) * dt;
    }
    f.vx += sx * separate * dt;
    f.vy += sy * separate * dt;
    if (predator) {
      const dx = f.x - predator.x;
      const dy = f.y - predator.y;
      const d = Math.hypot(dx, dy);
      if (d < flee) {
        const push = ((flee - d) / flee) * 900 * dt;
        f.vx += (dx / (d || 1)) * push;
        f.vy += (dy / (d || 1)) * push;
      }
    }
    // the glass: turn away before reaching it
    const m = 18;
    if (f.x < m) f.vx += (m - f.x) * 14 * dt;
    if (f.x > w - m) f.vx -= (f.x - (w - m)) * 14 * dt;
    if (f.y < m) f.vy += (m - f.y) * 14 * dt;
    if (f.y > h - m) f.vy -= (f.y - (h - m)) * 14 * dt;
    const s = Math.hypot(f.vx, f.vy) || 1;
    const k = Math.min(speed[1], Math.max(speed[0], s)) / s;
    f.vx *= k;
    f.vy *= k;
  }
  for (const f of fish) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }
}
