import { clamp, lerp } from "./math.js";

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let glide = 0;

/**
 * Scroll to `target` with an ease-in-out curve, so a jump plays *through*
 * the scenes in between rather than cutting to them. Longer trips take
 * longer, within limits. Any wheel/touch/key input hands control back.
 */
export function glideTo(target) {
  cancelAnimationFrame(glide);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const to = clamp(target, 0, max);
  const from = window.scrollY;
  const distance = Math.abs(to - from);
  if (reducedMotion || distance < 2) {
    window.scrollTo(0, to);
    return;
  }
  const duration = clamp(500 + Math.sqrt(distance) * 38, 700, 3200);
  const start = performance.now();
  const stop = () => {
    cancelAnimationFrame(glide);
    for (const type of ["wheel", "touchstart", "keydown"]) window.removeEventListener(type, stop);
  };
  for (const type of ["wheel", "touchstart", "keydown"]) window.addEventListener(type, stop, { passive: true });

  const step = (now) => {
    const t = clamp((now - start) / duration);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    window.scrollTo(0, from + (to - from) * eased);
    if (t < 1) glide = requestAnimationFrame(step);
    else stop();
  };
  glide = requestAnimationFrame(step);
}

/**
 * Tiny scroll-scene engine.
 *
 * Each registered scene gets `update(progress, ctx)` every frame while it is
 * near the viewport. `progress` runs 0 → 1 across the time the scene's sticky
 * stage is pinned, and is eased toward the real scroll position so motion
 * feels weighted rather than locked to the wheel.
 */
export function createDirector() {
  const scenes = [];
  const hooks = [];
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let lastScroll = window.scrollY;
  let velocity = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true },
  );

  function measure(scene) {
    const r = scene.el.getBoundingClientRect();
    const track = r.height - window.innerHeight;
    return {
      // a zero-height viewport (hidden tab, mid-resize) would give 0/0 and poison the smoothing
      progress: track > 0 ? clamp(-r.top / track) : 0,
      // near: roughly one screen before it pins until one screen after it releases
      near: r.top < window.innerHeight * 1.5 && r.bottom > -window.innerHeight * 0.5,
    };
  }

  function frame() {
    const y = window.scrollY;
    velocity = lerp(velocity, y - lastScroll, 0.2);
    lastScroll = y;

    const k = reducedMotion ? 1 : 0.1;
    pointer.sx = lerp(pointer.sx, reducedMotion ? 0 : pointer.x, 0.06);
    pointer.sy = lerp(pointer.sy, reducedMotion ? 0 : pointer.y, 0.06);

    for (const scene of scenes) {
      const { progress, near } = measure(scene);
      scene.smooth = lerp(scene.smooth, progress, k);
      if (!(Math.abs(scene.smooth - progress) >= 0.0005)) scene.smooth = progress;

      if (near !== scene.active) {
        scene.active = near;
        scene.onActive?.(near);
      }
      if (near) scene.update(scene.smooth, { pointer, velocity, raw: progress });
    }
    for (const hook of hooks) hook();
    requestAnimationFrame(frame);
  }

  return {
    add(el, { update, onActive }) {
      if (!el) return;
      scenes.push({ el, update, onActive, smooth: measure({ el }).progress, active: null });
    },
    /** Run fn once per frame, after scenes update. */
    onFrame(fn) {
      hooks.push(fn);
    },
    start() {
      requestAnimationFrame(frame);
    },
  };
}
