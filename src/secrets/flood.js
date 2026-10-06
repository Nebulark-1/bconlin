// Sit still on any page but home and the bottom of the screen slowly fills
// with water, like my tanks: cherry shrimp and blue dreams picking along
// the bottom and climbing the glass, a betta, a pea puffer, a school of
// ember tetras, plants, driftwood, a moss ball, and bubbles. Move and it
// drains.

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
// how fast each one goes, px a second: shrimp amble, the puffer potters, the betta glides
const SPEED = { cherry: 9, blue: 9, puffer: 16, betta: 24 };
const IDLE_MS = 60000;
const TETRA = `<ellipse rx="4.5" ry="1.9" fill="#ff5a2a"/><path d="M-4 0l-4-2.5v5z" fill="#ff5a2a" opacity=".85"/><path d="M-1 -1.6l2 -2.4 1.5 2.2z" fill="#ff8a5a" opacity=".7"/>`;

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

/** What's set into the gravel: driftwood, a pile of stones, a moss ball. */
function decor(W, H) {
  const x1 = W * (0.15 + Math.random() * 0.2);
  const x2 = W * (0.55 + Math.random() * 0.25);
  const x3 = W * (0.4 + Math.random() * 0.1);
  return `
    <g class="flood__wood" transform="translate(${x1.toFixed(0)} ${H - 10})">
      <path d="M-70 0C-40 -6 -10 -22 20 -48M-20 -12C-6 -30 0 -52 -8 -70M8 -30C24 -38 40 -40 56 -36"/>
    </g>
    <g class="flood__stones" transform="translate(${x2.toFixed(0)} ${H - 10})">
      <ellipse cx="-16" cy="-8" rx="20" ry="11"/><ellipse cx="12" cy="-6" rx="15" ry="9"/><ellipse cx="-2" cy="-20" rx="12" ry="8"/>
    </g>
    <g class="flood__moss" transform="translate(${x3.toFixed(0)} ${H - 20})">
      <circle r="11"/><circle cx="-4" cy="-3" r="2" class="tuft"/><circle cx="4" cy="2" r="2.2" class="tuft"/><circle cx="1" cy="-6" r="1.6" class="tuft"/>
    </g>`;
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
    <g class="flood__decor">${decor(W, H)}</g>
    <g class="flood__plants"></g><g class="flood__life"></g><g class="flood__school"></g><g class="flood__bubbles"></g>`;
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
    // fish start out in open water, not on the gravel
    const y = shrimp ? H - 14 : H - 30 - Math.random() * DEPTH * 0.6;
    return { g, kind, shrimp, x: Math.random() * W, y, tx: Math.random() * W, ty: y, wait: shrimp ? Math.random() * 2 : 0, face: 1, phase: Math.random() * 6.28 };
  });
  // the tetras: each keeps its own place in a loose school around a leader
  // that wanders the open water
  const lead = { x: W * 0.5, y: H - DEPTH * 0.5, tx: W * 0.3, ty: H - DEPTH * 0.5, face: 1 };
  const school = Array.from({ length: 11 }, (_, k) => {
    const g = document.createElementNS(NS, "g");
    g.innerHTML = TETRA;
    $(".flood__school").appendChild(g);
    const spot = { dx: (Math.random() - 0.5) * 70, dy: (Math.random() - 0.5) * 34 };
    return { g, ...spot, x: lead.x + spot.dx, y: lead.y + spot.dy, face: 1, phase: Math.random() * 6.28, drift: Math.random() * 6.28 };
  });
  const bubbles = [];

  let level = 0; // how full, 0..1
  let goal = 1;
  let last = performance.now();
  let raf = 0;
  const pick = (c, surface) => {
    // fish pick anywhere in the full depth (the water's rise catches them up)
    if (!c.shrimp) return [20 + Math.random() * (W - 40), H - 26 - Math.random() * (DEPTH - 50)];
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
      // nobody swims above the water
      const ty = Math.max(surface + 14, c.ty);
      const dx = c.tx - c.x;
      const dy = ty - c.y;
      const far = Math.hypot(dx, dy);
      if (far < 1) {
        // there: pause a while, then pick somewhere new
        if ((c.wait -= dt) <= 0) {
          [c.tx, c.ty] = pick(c, surface);
          c.wait = c.shrimp ? 2 + Math.random() * 4 : 1 + Math.random() * 3;
        }
      } else {
        // a steady pace toward it, easing off at the end
        const step = Math.min(far, SPEED[c.kind] * (calm() ? 0 : dt) * Math.min(1, far / 12 + 0.3));
        c.x += (dx / far) * step;
        c.y += (dy / far) * step;
        if (Math.abs(dx) > 2) c.face = dx > 0 ? 1 : -1;
      }
      const onGlass = c.shrimp && (c.x < 10 || c.x > W - 10);
      // fish drift up and down a little, each on its own slow beat
      const bob = c.shrimp ? 0 : Math.sin(t * 1.3 + c.phase) * 2;
      c.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${(c.y + bob).toFixed(1)}) rotate(${onGlass ? (c.x < 10 ? -90 : 90) : 0}) scale(${c.face} 1)`);
      c.g.style.opacity = c.y > surface + 4 ? 1 : 0;
    }
    // the school: the leader cruises between spots; each tetra steers for its place
    {
      const dx = lead.tx - lead.x;
      const dy = lead.ty - lead.y;
      const far = Math.hypot(dx, dy);
      if (far < 8) [lead.tx, lead.ty] = [40 + Math.random() * (W - 80), H - 40 - Math.random() * (DEPTH - 70)];
      else {
        lead.x += (dx / far) * 34 * dt;
        lead.y += (dy / far) * 34 * dt;
        lead.face = dx > 0 ? 1 : -1;
      }
      for (const f of school) {
        // the formation turns with the school, with a little wobble of its own
        const gx = lead.x + f.dx * lead.face + Math.sin(t * 0.8 + f.drift) * 6;
        const gy = Math.max(surface + 12, lead.y + f.dy + Math.cos(t * 0.7 + f.drift) * 4);
        const ex = gx - f.x;
        const ey = gy - f.y;
        const d = Math.hypot(ex, ey);
        if (d > 0.5 && !calm()) {
          const step = Math.min(d, 50 * dt * Math.min(1, d / 20 + 0.2));
          f.x += (ex / d) * step;
          f.y += (ey / d) * step;
        }
        if (Math.abs(ex) > 1.5) f.face = ex > 0 ? 1 : -1;
        else f.face = lead.face;
        f.g.setAttribute("transform", `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.face} 1)`);
        f.g.style.opacity = f.y > surface + 4 ? 1 : 0;
      }
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
