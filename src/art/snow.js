import { clamp } from "../engine/math.js";

/**
 * Soft canvas snowfall. Depth (z) sets size, speed and blur, so near flakes
 * read as out-of-focus bokeh. Scroll velocity (`push`) shoves the field.
 */
export function createSnow(canvas) {
  const ctx = canvas.getContext("2d");
  const state = { running: false, intensity: 0, push: 0, debug: false, count: 0 };
  let flakes = [];
  let w = 0;
  let h = 0;
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(clamp((w * h) / 7000, 60, 260));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() ** 1.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function tick(t) {
    raf = 0;
    if (!state.running) return;
    ctx.clearRect(0, 0, w, h);

    state.count = flakes.length;
    for (const f of flakes) {
      const vy = 0.3 + f.z * 1.5 - state.push * f.z * 0.3;
      const vx = Math.sin(t * 0.0007 + f.phase) * 0.3 * (0.3 + f.z) + 0.12;
      f.y += vy;
      f.x += vx;
      if (f.y > h + 12) (f.y = -12), (f.x = Math.random() * w);
      if (f.y < -12) (f.y = h + 12), (f.x = Math.random() * w);
      if (f.x > w + 12) f.x = -12;

      if (state.debug) {
        // blueprint: a crosshair per flake and its velocity vector
        ctx.globalAlpha = state.intensity * (0.4 + f.z * 0.6);
        ctx.strokeStyle = "#bfe6ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.x - 2, f.y);
        ctx.lineTo(f.x + 2, f.y);
        ctx.moveTo(f.x, f.y - 2);
        ctx.lineTo(f.x, f.y + 2);
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x + vx * 8, f.y + vy * 8);
        ctx.stroke();
        continue;
      }
      const r = 0.8 + f.z * 3.4;
      ctx.globalAlpha = state.intensity * (f.z > 0.8 ? 0.35 : 0.5 + f.z * 0.4);
      ctx.fillStyle = "#f4f0ff";
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);

  return new Proxy(state, {
    set(target, key, value) {
      target[key] = value;
      if (key === "running" && value && !raf) {
        if (!flakes.length) resize();
        raf = requestAnimationFrame(tick);
      }
      return true;
    },
  });
}
