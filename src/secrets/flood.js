// Sit still on any page but home and the bottom of the screen slowly fills
// with water, like my tanks: cherry shrimp and blue dreams picking along
// the bottom and climbing the glass, a betta, a pea puffer, plants, and
// bubbles. Move and it drains.

import { discover, isOn } from "../site/eggs.js";
import { chime, PENTATONIC } from "../site/sound.js";

const NS = "http://www.w3.org/2000/svg";
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOOKS = {
  cherry: `<ellipse rx="4.2" ry="2" fill="#ff4d5e"/><path d="M4 0l4-2M4 0l4 1" stroke="#ff4d5e" stroke-width=".8"/>`,
  blue: `<ellipse rx="4.2" ry="2" fill="#4d8bff"/><path d="M4 0l4-2M4 0l4 1" stroke="#4d8bff" stroke-width=".8"/>`,
  betta: `<ellipse rx="9" ry="5" fill="#a99bff"/><path d="M-7 0L-22 -11Q-17 0 -22 11Z" fill="#a99bff" opacity=".8"/><circle cx="5" cy="-1.5" r="1.2" fill="#04040c"/>`,
  puffer: `<circle r="6" fill="#d9e86a"/><circle cx="3" cy="-2" r="1.3" fill="#04040c"/><path d="M-6 0l-4-3v6z" fill="#d9e86a"/>`,
};
const CAST = [...Array(8).fill("cherry"), ...Array(6).fill("blue"), "betta", "puffer"];
const IDLE_MS = 60000;

export function mountFlood() {
  let timer = 0;
  let flood = null;
  const wake = () => {
    clearTimeout(timer);
    flood?.drain();
    timer = setTimeout(() => {
      discover("tanks");
      if (isOn("tanks")) flood = fill(() => (flood = null));
    }, IDLE_MS);
  };
  for (const t of ["pointermove", "pointerdown", "keydown", "scroll", "wheel", "touchstart"]) addEventListener(t, wake, { passive: true });
  wake();
}

/** The water, rising. Returns { drain }. */
function fill(done) {
  const W = innerWidth;
  const H = innerHeight;
  const DEPTH = Math.min(320, H * 0.36);
  const svg = document.createElementNS(NS, "svg");
  svg.classList.add("flood");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <path class="flood__water"/>
    <path class="flood__surface"/>
    <rect class="flood__gravel" x="0" y="${H - 10}" width="${W}" height="10"/>
    <g class="flood__plants"></g><g class="flood__life"></g><g class="flood__bubbles"></g>`;
  document.body.appendChild(svg);
  const $ = (s) => svg.querySelector(s);
  const plants = Array.from({ length: Math.round(W / 110) }, (_, k) => {
    const p = document.createElementNS(NS, "path");
    $(".flood__plants").appendChild(p);
    return { p, x: (k + 0.5) * (W / Math.round(W / 110)) + (Math.random() - 0.5) * 40, h: 0.35 + Math.random() * 0.45, s: Math.random() * 6 };
  });
  const life = CAST.map((kind) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = LOOKS[kind];
    $(".flood__life").appendChild(g);
    const shrimp = kind === "cherry" || kind === "blue";
    return { g, kind, shrimp, x: Math.random() * W, y: H - 14, tx: Math.random() * W, ty: H - 14, wait: Math.random() * 2, face: 1 };
  });
  const bubbles = [];

  let level = 0; // how full, 0..1
  let goal = 1;
  let last = performance.now();
  let raf = 0;
  const pick = (c, surface) => {
    if (!c.shrimp) return [20 + Math.random() * (W - 40), surface + 24 + Math.random() * Math.max(10, H - 30 - surface - 24)];
    // shrimp pick along the bottom, and now and then climb the glass
    if (Math.random() < 0.18) {
      const side = Math.random() < 0.5 ? 6 : W - 6;
      return [side, surface + 16 + Math.random() * (H - surface - 30)];
    }
    return [Math.random() * W, H - 13];
  };

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    level += (goal - level) * (calm() ? 1 : 1 - Math.exp(-dt * (goal ? 0.45 : 3)));
    const surface = H - DEPTH * level;
    const wave = Array.from({ length: 25 }, (_, k) => {
      const x = (k / 24) * W;
      return `${x.toFixed(0)} ${(surface + Math.sin(t * 1.6 + k * 0.7) * 3 * level).toFixed(1)}`;
    });
    $(".flood__water").setAttribute("d", `M${wave.join("L")}L${W} ${H}L0 ${H}Z`);
    $(".flood__surface").setAttribute("d", `M${wave.join("L")}`);
    svg.style.opacity = Math.min(1, level * 3).toFixed(2);
    plants.forEach(({ p, x, h, s }) => {
      const top = Math.max(surface + 10, H - DEPTH * h * level);
      const sway = Math.sin(t * 1.2 + s) * 8 * level;
      p.setAttribute("d", `M${x} ${H - 8}Q${x + sway} ${(H + top) / 2} ${x + sway * 1.5} ${top}`);
    });
    for (const c of life) {
      if ((c.wait -= dt) <= 0) {
        [c.tx, c.ty] = pick(c, surface);
        c.wait = c.shrimp ? 1 + Math.random() * 3 : 2 + Math.random() * 3;
      }
      const k = 1 - Math.exp(-dt * (c.shrimp ? 2.5 : 0.7));
      const dx = (c.tx - c.x) * k;
      if (Math.abs(dx) > 0.05) c.face = dx > 0 ? 1 : -1;
      c.x += dx;
      // nobody swims above the water
      c.y += (Math.max(surface + 14, c.ty) - c.y) * k;
      const onGlass = c.shrimp && (c.x < 10 || c.x > W - 10);
      c.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${(c.y + (c.shrimp ? 0 : Math.sin(t * 2 + c.x) * 2)).toFixed(1)}) rotate(${onGlass ? (c.x < 10 ? -90 : 90) : 0}) scale(${c.face} 1)`);
      c.g.style.opacity = c.y > surface + 4 ? 1 : 0;
    }
    if (!calm() && level > 0.3 && Math.random() < dt * 3) {
      const b = document.createElementNS(NS, "circle");
      $(".flood__bubbles").appendChild(b);
      const from = plants[Math.floor(Math.random() * plants.length)];
      bubbles.push({ b, x: from.x, y: H - 12, r: 1.5 + Math.random() * 2.5 });
    }
    for (let k = bubbles.length - 1; k >= 0; k--) {
      const b = bubbles[k];
      b.y -= 40 * dt;
      b.x += Math.sin(t * 5 + k) * 0.4;
      if (b.y < surface) {
        b.b.remove();
        bubbles.splice(k, 1);
        if (Math.random() < 0.15) chime(PENTATONIC[6 + (k % 2)], 0.008, (b.x / W) * 2 - 1, 0.5);
      } else {
        b.b.setAttribute("cx", b.x.toFixed(1));
        b.b.setAttribute("cy", b.y.toFixed(1));
        b.b.setAttribute("r", b.r);
      }
    }
    if (goal === 0 && level < 0.01) {
      svg.remove();
      done();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    drain() {
      goal = 0;
      if (calm()) {
        cancelAnimationFrame(raf);
        svg.remove();
        done();
      }
    },
  };
}
