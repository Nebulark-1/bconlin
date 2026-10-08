// Home, after dark: a small campfire by the strings. Click it and it's a
// night on the mountain: the fire comes up, embers rise off it, and snow
// starts falling over the whole page. Click again to let it die down.
// (Mount Herman, where I built a shelter and slept through snowy nights.)

import { discover, isOn } from "../site/eggs.js";
import { chime, gust } from "../site/sound.js";
import { isNight } from "./patterns.js";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountCampfire() {
  if (!isNight(new Date())) return;
  const link = document.querySelector(".secrets-link");
  if (!link) return;
  const fire = document.createElement("button");
  fire.type = "button";
  fire.className = "campfire";
  fire.setAttribute("aria-label", "A campfire");
  fire.setAttribute("aria-pressed", "false");
  fire.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="campfire__flame" d="M12 3c2 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/><path class="campfire__logs" d="M4 21l16-3M4 18l16 3"/></svg>`;
  link.before(fire);
  let night = null;
  fire.addEventListener("click", () => {
    discover("herman");
    if (night) {
      night.stop();
      night = null;
    } else if (isOn("herman")) night = snowfall(fire);
    fire.setAttribute("aria-pressed", String(!!night));
    fire.classList.toggle("is-lit", !!night);
  });
}

/** Snow over the whole window, and embers off the fire. Returns { stop }. */
function snowfall(fire) {
  const canvas = document.createElement("canvas");
  canvas.className = "snowfall";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  const size = () => {
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  };
  size();
  addEventListener("resize", size);
  const flakes = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.6 + Math.random() * 1.8,
    v: 18 + Math.random() * 40,
    s: Math.random() * 6,
  }));
  const embers = [];
  let fade = 0; // eases in, and out when it's put out
  let goal = 1;
  let last = performance.now();
  let raf = 0;
  gust(0.5, 4);
  [0, 1].forEach((k) => setTimeout(() => chime(196 * (k + 1), 0.025, -0.3, 3), k * 260));

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    fade += (goal - fade) * (1 - Math.exp(-dt * 1.5));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#ece8ff";
    for (const f of flakes) {
      if (!calm()) {
        f.y += f.v * dt;
        f.x += Math.sin(t * 0.7 + f.s) * 12 * dt;
        if (f.y > h + 4) {
          f.y = -4;
          f.x = Math.random() * w;
        }
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // embers drift up off the fire, wherever it is on screen
    const r = fire.getBoundingClientRect();
    if (!calm() && goal && r.bottom > 0 && r.top < h && Math.random() < dt * 14) {
      embers.push({ x: r.left + r.width / 2 + (Math.random() - 0.5) * 8, y: r.top + r.height * 0.3, v: 30 + Math.random() * 40, life: 1, s: Math.random() * 6 });
    }
    for (let k = embers.length - 1; k >= 0; k--) {
      const e = embers[k];
      e.y -= e.v * dt;
      e.x += Math.sin(t * 3 + e.s) * 14 * dt;
      e.life -= dt * 0.45;
      if (e.life <= 0) {
        embers.splice(k, 1);
        continue;
      }
      ctx.globalAlpha = e.life * fade;
      ctx.fillStyle = e.life > 0.6 ? "#ffd2a0" : "#ff8a5a";
      ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
    }
    if (goal === 0 && fade < 0.02) {
      removeEventListener("resize", size);
      canvas.remove();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop() {
      goal = 0;
      if (calm()) {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    },
  };
}
