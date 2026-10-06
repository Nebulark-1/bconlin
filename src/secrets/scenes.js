// The little scene at the top of each secret's card. Each one is a function that
// returns { el, frame(t, dt), stop?, stats? }: t is seconds since it
// opened. They are deliberately plain: a few shapes in high contrast,
// moving just enough to show the idea.

import { chime, pluck, PENTATONIC } from "../site/sound.js";
import { STEPS, CREASES, onPaper, resample, between, toPath } from "./fold.js";

const C = {
  ink: "#ece8ff",
  dim: "#8d88ad",
  faint: "rgba(236,232,255,.16)",
  accent: "#ffb48c",
  water: "#5ec8ff",
  pink: "#ff4da6",
  green: "#39ff88",
  violet: "#a99bff",
  coral: "#ff8a7a",
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - clamp(t)) ** 3;

function svg(kind, viewBox, inner, tag = "div") {
  const el = document.createElement(tag);
  el.className = `tale-art tale-art--${kind}`;
  el.innerHTML = `<svg viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;
  return el;
}
const $ = (el, sel) => el.querySelector(sel);
const attr = (node, a) => {
  for (const k in a) node.setAttribute(k, a[k]);
};
const mono = (x, y, text, { fill = C.dim, anchor = "start", size = 11, cls = "" } = {}) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" class="mono ${cls}">${text}</text>`;

// ── Something long ─────────────────────────────────────────
function long() {
  const el = svg(
    "long",
    "0 0 320 90",
    `<circle class="sun" r="6" fill="${C.accent}"/>
     <path d="M0 72H320" stroke="${C.faint}" stroke-width="1.5"/>
     <g class="posts" stroke="${C.dim}">${Array.from({ length: 7 }, () => `<path d="M0 66V72"/>`).join("")}</g>
     <circle class="me" cx="110" r="4.5" fill="${C.accent}"/>
     ${mono(312, 18, "", { fill: C.ink, anchor: "end", size: 10, cls: "miles" })}`,
  );
  const posts = [...el.querySelectorAll(".posts path")];
  const sun = $(el, ".sun");
  const me = $(el, ".me");
  const miles = $(el, ".miles");
  return {
    el,
    still: 20,
    frame(t) {
      posts.forEach((p, k) => p.setAttribute("transform", `translate(${((k * 56 - t * 42) % 392 + 392) % 392 - 20} 0)`));
      me.setAttribute("cy", 67 - Math.abs(Math.sin(t * 7)) * 3);
      const day = (t / 14) % 1;
      attr(sun, { cx: 20 + day * 280, cy: 64 - Math.sin(day * Math.PI) * 48, opacity: Math.sin(day * Math.PI) });
      miles.textContent = `mile ${(1 + t * 0.6).toFixed(1)}`;
    },
  };
}

// ── Mount Herman, in the snow ──────────────────────────────
function shelter() {
  const stars = Array.from({ length: 22 }, () => `<circle cx="${(Math.random() * 320).toFixed(0)}" cy="${(Math.random() * 70).toFixed(0)}" r=".8" fill="${C.ink}" opacity="${(0.3 + Math.random() * 0.5).toFixed(2)}"/>`).join("");
  const el = svg(
    "shelter",
    "0 0 320 160",
    `${stars}
     <circle cx="268" cy="30" r="11" fill="${C.ink}"/><circle cx="274" cy="26" r="10" style="fill:var(--gap-bg)"/>
     <path d="M0 160L70 96L110 110L170 40L215 82L250 72L320 122V160Z" fill="#11162c" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/>
     <path d="M156 53L170 40L184 53L176 50L170 56L163 50Z" fill="${C.ink}"/>
     <path d="M188 76L201 56L214 76Z" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"/>
     <path class="fire" d="M197 76L201 68L205 76Z" fill="${C.accent}"/>
     <g class="snow" fill="${C.ink}"></g>`,
  );
  const snow = $(el, ".snow");
  const flakes = Array.from({ length: 46 }, () => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", (0.7 + Math.random()).toFixed(1));
    snow.appendChild(c);
    return { c, x: Math.random() * 320, y: Math.random() * 160, v: 10 + Math.random() * 14, s: Math.random() * 6 };
  });
  const fire = $(el, ".fire");
  return {
    el,
    still: 1,
    frame(t, dt) {
      for (const f of flakes) {
        f.y += f.v * dt;
        if (f.y > 162) f.y = -2;
        attr(f.c, { cx: (f.x + Math.sin(t * 0.8 + f.s) * 6).toFixed(1), cy: f.y.toFixed(1) });
      }
      fire.setAttribute("opacity", 0.7 + 0.3 * Math.sin(t * 13) * Math.sin(t * 7.3));
    },
  };
}

// ── Freediving: hold to go down ────────────────────────────
function dive(point, hooks = {}) {
  const ft = (d) => 28 + d * 2.875;
  const el = svg(
    "dive",
    "0 0 200 280",
    `<defs><linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d5f8c"/><stop offset="1" stop-color="#020a16"/></linearGradient></defs>
     <rect y="28" width="200" height="252" fill="url(#lake)"/>
     <path class="surface" fill="none" stroke="${C.ink}" stroke-width="1.2"/>
     ${[0, 20, 40, 60, 80].map((d) => `<path d="M182 ${ft(d)}h10" stroke="${C.dim}"/>${mono(178, ft(d) + 3, d === 80 ? "80 ft" : d, { anchor: "end" })}`).join("")}
     <path class="rock" d="M88 270l6-9 13-2 9 5 2 6z" fill="${C.dim}"/>
     <g class="bubbles" fill="none" stroke="${C.ink}" stroke-width=".7"></g>
     <g class="diver">
       <circle class="breath" r="10" fill="none" stroke="${C.water}" stroke-width="1.6" pathLength="1" stroke-dasharray="1" transform="rotate(-90)"/>
       <circle r="5" fill="${C.accent}"/>
       <path class="carry" d="M-7 8l3-5 7-1 5 3 1 3z" fill="${C.dim}" opacity="0"/>
     </g>`,
    "button",
  );
  el.type = "button";
  el.setAttribute("aria-label", "Hold to dive");
  const label = document.createElement("p");
  label.className = "tale-art__label mono";
  label.textContent = "Hold to dive";
  el.appendChild(label);
  const diver = $(el, ".diver");
  const breathRing = $(el, ".breath");
  const carry = $(el, ".carry");
  const rock = $(el, ".rock");
  const surface = $(el, ".surface");
  const bubbleG = $(el, ".bubbles");
  const s = { depth: 0, breath: 1, holding: false, carrying: false, rockThere: true, rocks: 0, gasp: false, said: 0, under: 0 };
  const bubbles = [];

  const hold = (on) => {
    s.holding = on;
    if (on) s.gasp = false;
  };
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    hold(true);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, () => hold(false));
  el.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      hold(true);
    }
  });
  el.addEventListener("keyup", (e) => (e.key === " " || e.key === "Enter") && hold(false));
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  return {
    el,
    stats: s,
    still: 0,
    stop: () => hold(false),
    frame(t, dt) {
      const down = s.holding && !s.gasp;
      const was = s.depth;
      s.depth = clamp(s.depth + (down ? 22 : -30) * dt, 0, 80);
      if (s.depth > 0) s.under += dt;
      // back up: a hold that ends with almost no air left, but some, is the
      // longest you can safely go
      if (was > 0 && s.depth === 0) {
        if (!s.gasp && s.breath < 0.1) hooks.breath?.(s.under);
        s.under = 0;
      }
      if (s.depth > 0) s.breath = Math.max(0, s.breath - dt / 11);
      else s.breath = Math.min(1, s.breath + dt * 0.6);
      if (s.breath === 0) s.gasp = true;
      if (s.depth === 0 && s.breath > 0.3) s.gasp = false;
      if (s.depth >= 80 && s.rockThere && !s.carrying) {
        s.carrying = true;
        s.rockThere = false;
        pluck(110, 0.8);
      }
      if (s.carrying && s.depth === 0) {
        s.carrying = false;
        s.rocks++;
        s.said = t;
        chime(PENTATONIC[5], 0.04);
        setTimeout(() => (s.rockThere = true), 1800);
      }
      const y = ft(s.depth) - (s.depth === 0 ? 6 : 0);
      diver.setAttribute("transform", `translate(100 ${y.toFixed(1)})`);
      breathRing.setAttribute("stroke-dashoffset", (1 - s.breath).toFixed(3));
      breathRing.setAttribute("stroke", s.breath < 0.25 ? C.coral : C.water);
      carry.setAttribute("opacity", s.carrying ? 1 : 0);
      rock.setAttribute("opacity", s.rockThere ? 1 : 0);
      surface.setAttribute("d", `M0 28${Array.from({ length: 11 }, (_, k) => `L${k * 20} ${(28 + Math.sin(t * 2 + k) * 1.2).toFixed(1)}`).join("")}`);
      // bubbles on the way up
      if (!down && s.depth > 2 && Math.random() < dt * 9) {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bubbleG.appendChild(c);
        bubbles.push({ c, x: 100 + (Math.random() - 0.5) * 6, y: y - 6, r: 1 + Math.random() * 1.6 });
      }
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k];
        b.y -= 50 * dt;
        b.x += Math.sin(t * 6 + k) * 0.3;
        if (b.y < 30) {
          b.c.remove();
          bubbles.splice(k, 1);
        } else attr(b.c, { cx: b.x.toFixed(1), cy: b.y.toFixed(1), r: b.r });
      }
      label.textContent =
        t - s.said < 2.2 && s.rocks ? "Just a rock." : s.depth > 0.5 ? `${Math.round(s.depth)} ft${s.gasp ? ", out of air" : ""}` : hooks.best?.() ? `Hold to dive · longest breath ${hooks.best().toFixed(1)} s` : "Hold to dive";
    },
  };
}

// ── The tanks ──────────────────────────────────────────────
// [[TODO: confirm with Ben which tank the betta and the pea puffer live in]]
const TANKS = [
  { label: "10 gal", x: 12, y: 40, w: 136, h: 76, life: [["cherry", 9], ["betta", 1]] },
  { label: "5 gal", x: 162, y: 56, w: 86, h: 60, life: [["puffer", 1]] },
  { label: "fairy garden", x: 262, y: 48, w: 48, h: 68, life: [["blue", 7]], jar: true },
];
const LOOKS = {
  cherry: `<ellipse rx="2.8" ry="1.3" fill="#ff4d5e"/>`,
  blue: `<ellipse rx="2.8" ry="1.3" fill="#4d8bff"/>`,
  betta: `<ellipse rx="5" ry="3" fill="${C.violet}"/><path d="M-4 0L-12 -6Q-10 0 -12 6Z" fill="${C.violet}" opacity=".8"/>`,
  puffer: `<circle r="3.4" fill="#d9e86a"/><circle cx="1.6" cy="-1" r=".8" fill="#04040c"/>`,
};
function tanks() {
  const plants = (t) =>
    [0.2, 0.45, 0.8].map((f) => `<path class="weed" data-x="${t.x + t.w * f}" data-y="${t.y + t.h - 6}" data-h="${t.h * 0.55}" fill="none" stroke="${C.green}" stroke-width="1.3" opacity=".7"/>`).join("");
  const el = svg(
    "tanks",
    "0 0 320 140",
    TANKS.map(
      (t) => `<rect x="${t.x}" y="${t.y + 6}" width="${t.w}" height="${t.h - 6}" fill="rgba(94,200,255,.08)" ${t.jar ? 'rx="12"' : ""}/>
      <rect x="${t.x}" y="${t.y + t.h - 6}" width="${t.w}" height="6" fill="#2a2638"/>
      ${plants(t)}
      <rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" fill="none" stroke="${C.ink}" stroke-width="1.3" ${t.jar ? 'rx="12"' : ""}/>
      ${mono(t.x + t.w / 2, 134, t.label, { anchor: "middle" })}`,
    ).join("") + `<g class="life"></g>`,
  );
  const life = $(el, ".life");
  const weeds = [...el.querySelectorAll(".weed")];
  const pick = (t, kind) => ({
    x: t.x + 8 + Math.random() * (t.w - 16),
    // shrimp keep low, fish swim mid-water
    y: kind === "cherry" || kind === "blue" ? t.y + t.h - 9 - Math.random() * t.h * 0.4 : t.y + 14 + Math.random() * (t.h - 30),
  });
  const critters = TANKS.flatMap((t) =>
    t.life.flatMap(([kind, n]) =>
      Array.from({ length: n }, () => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.innerHTML = LOOKS[kind];
        life.appendChild(g);
        const p = pick(t, kind);
        return { g, t, kind, ...p, to: pick(t, kind), wait: Math.random() * 2, face: 1 };
      }),
    ),
  );
  return {
    el,
    still: 0,
    frame(t, dt) {
      weeds.forEach((w, k) => {
        const [x, y, h] = ["x", "y", "h"].map((a) => +w.dataset[a]);
        const sway = Math.sin(t * 1.3 + k) * 4;
        w.setAttribute("d", `M${x} ${y}Q${x + sway} ${y - h / 2} ${x + sway * 1.6} ${y - h}`);
      });
      for (const c of critters) {
        const shrimp = c.kind === "cherry" || c.kind === "blue";
        if ((c.wait -= dt) <= 0) {
          c.to = pick(c.t, c.kind);
          c.wait = shrimp ? 1 + Math.random() * 3 : 2 + Math.random() * 2;
        }
        const k = 1 - Math.exp(-dt * (shrimp ? 4 : 0.9));
        const dx = (c.to.x - c.x) * k;
        if (Math.abs(dx) > 0.05) c.face = dx > 0 ? 1 : -1;
        c.x += dx;
        c.y += (c.to.y - c.y) * k;
        c.g.setAttribute("transform", `translate(${c.x.toFixed(1)} ${(c.y + (shrimp ? 0 : Math.sin(t * 2 + c.x) * 1)).toFixed(1)}) scale(${c.face} 1)`);
      }
    },
  };
}

// ── Static line, alone ─────────────────────────────────────
function jump() {
  const el = svg(
    "jump",
    "0 0 220 200",
    `<path d="M0 188H220" stroke="${C.ink}" stroke-width="1.2"/>
     <path class="plane" d="M-14 0h22l6-3h4l-4 5h-28z M-4 0l-6-7h4l8 7z" fill="${C.ink}"/>
     <path class="tether" stroke="${C.dim}" stroke-width=".8" fill="none"/>
     <g class="me">
       <g class="canopy"><path d="M-18 -22Q0 -38 18 -22Q0 -27 -18 -22Z" fill="${C.accent}"/><path d="M-17 -22L0 -3M17 -22L0 -3M0 -26V-3" stroke="${C.accent}" stroke-width=".6" opacity=".7"/></g>
       <circle r="3" fill="${C.ink}"/><path d="M0 2v6" stroke="${C.ink}" stroke-width="2"/>
     </g>`,
  );
  const plane = $(el, ".plane");
  const me = $(el, ".me");
  const canopy = $(el, ".canopy");
  const tether = $(el, ".tether");
  const EXIT = 0.9;
  return {
    el,
    still: 3.4,
    frame(t) {
      const c = t % 10;
      const px = -30 + c * 140;
      plane.setAttribute("transform", `translate(${px} 30)`);
      let x = -30 + EXIT * 140;
      let y = 34;
      let open = 0;
      let show = 1;
      if (c > EXIT) {
        const e = c - EXIT;
        const fall = Math.min(e, 0.8);
        x += Math.min(e, 1.2) * 24;
        y += 70 * fall * fall;
        open = ease((e - 0.8) / 0.4);
        if (e > 0.8) y += (e - 0.8) * 26;
        x += Math.sin(e * 1.7) * 3 * open;
        if (y > 184) {
          y = 184;
          show = clamp(1 - (e - 6.4) * 1.5);
          open *= show;
        }
        // the line stays clipped to the plane until it pulls the canopy out
        tether.setAttribute("d", e < 0.85 ? `M${px - 4} 32L${x} ${y}` : "");
      } else tether.setAttribute("d", "");
      me.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      me.setAttribute("opacity", c > EXIT ? 1 : 0);
      canopy.setAttribute("transform", `scale(${open.toFixed(3)} ${Math.max(0.01, open).toFixed(3)})`);
    },
  };
}

// ── Folding a crane ────────────────────────────────────────
const N = 72;
const SHAPES = STEPS.map((s) => resample(s.outline, N));
function fold(point, hooks = {}) {
  const lines = CREASES.map(({ l, valley }) => {
    const [[x1, y1], [x2, y2]] = l.map(onPaper);
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${valley ? "#7a2f12" : "#2a1408"}" stroke-width="${valley ? 1.1 : 1.3}" ${valley ? 'stroke-dasharray="4 3"' : ""}/>`;
  }).join("");
  const el = svg(
    "fold",
    "0 0 200 200",
    `<path class="wing-back" fill="#e0875c" stroke="#2a1408" stroke-width="1" stroke-linejoin="round" opacity="0"/>
     <path class="paper" fill="${C.accent}" stroke="#2a1408" stroke-width="1" stroke-linejoin="round"/>
     <path class="wing" fill="#ffd9c2" stroke="#2a1408" stroke-width="1" stroke-linejoin="round" opacity="0"/>
     <g class="creases">${lines}</g>`,
    "button",
  );
  el.type = "button";
  const steps = document.createElement("ol");
  steps.className = "tale-art__steps mono";
  steps.innerHTML = STEPS.map((s) => `<li>${s.name}</li>`).join("");
  el.appendChild(steps);
  const paper = $(el, ".paper");
  const creases = $(el, ".creases");
  const wing = $(el, ".wing");
  const back = $(el, ".wing-back");
  const s = { step: 0, prev: 0, from: SHAPES[0], at: -1e9, folds: 0 };
  let shown = SHAPES[0];
  const name = () => el.setAttribute("aria-label", `Fold the crane: ${STEPS[s.step].name}. Next: ${STEPS[(s.step + 1) % 4].name}`);
  const mark = () => [...steps.children].forEach((li, k) => li.classList.toggle("is-on", k === s.step));
  // once the secret's found, the cranes you've folded are counted here
  const tally = () => {
    const n = hooks.mine?.() || 0;
    steps.dataset.tally = n ? `${n.toLocaleString("en-US")} folded` : "";
  };
  name();
  mark();
  tally();
  el.addEventListener("click", () => {
    s.from = shown;
    s.prev = s.step;
    s.step = (s.step + 1) % STEPS.length;
    s.at = null; // starts on the next frame
    s.folds++;
    name();
    mark();
    // a papery pluck, higher with each fold
    pluck(220 * [1, 1.25, 1.5, 2][s.step], 0.5);
    if (s.step === 3) {
      hooks.folded?.();
      tally();
    }
  });
  return {
    el,
    stats: s,
    still: 0,
    frame(t, dt) {
      if (s.at === null) s.at = t;
      const u = dt === 0 ? 1 : ease((t - s.at) / 0.8);
      shown = between(s.from, SHAPES[s.step], u);
      paper.setAttribute("d", toPath(shown));
      creases.setAttribute("opacity", s.step === 0 ? u : s.step === 1 ? 1 - u : 0);
      // the wings come up as it's shaped (and fold away as it unfolds),
      // then breathe a little
      const w = s.step === 3 ? u : s.prev === 3 ? 1 - u : 0;
      wing.setAttribute("opacity", w);
      back.setAttribute("opacity", w);
      const lift = 12 + (1 - w) * 96 + Math.sin(t * 2.2) * 5 * w;
      wing.setAttribute("d", `M70 122L${96} ${lift}L128 120L100 140Z`);
      back.setAttribute("d", `M92 116L${132} ${lift + 14}L146 112Z`);
    },
  };
}

// ── A thousand cranes ──────────────────────────────────────
function thousand(point, hooks = {}) {
  const el = document.createElement("div");
  el.className = "tale-art tale-art--thousand";
  el.innerHTML = `<canvas aria-hidden="true"></canvas><p class="tale-art__label mono">0</p>`;
  const canvas = $(el, "canvas");
  const label = $(el, "p");
  const ctx = canvas.getContext("2d");
  const COLORS = [C.accent, C.coral, C.pink, C.violet, C.water, C.green, C.ink];
  return {
    el,
    still: 99,
    frame(t) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const n = Math.min(1000, Math.floor(t * t * 60 + t * 40));
      const mine = Math.min(1000, hooks.mine?.() || 0);
      label.textContent = n.toLocaleString("en-US") + (mine ? ` · ${mine.toLocaleString("en-US")} of them yours` : "");
      const strands = 25;
      const gap = (w - 20) / strands;
      const step = (h - 14) / 40;
      ctx.fillStyle = C.dim;
      ctx.fillRect(6, 4, w - 12, 1.5);
      for (let k = 0; k < n; k++) {
        const s = k % strands;
        const d = Math.floor(k / strands);
        const x = 10 + gap * (s + 0.5) + Math.sin(t * 0.9 + s) * d * 0.05;
        const y = 10 + d * step;
        ctx.fillStyle = k < mine ? "#ffe2c4" : COLORS[(s + d) % COLORS.length];
        ctx.beginPath();
        ctx.moveTo(x - 2.6, y);
        ctx.lineTo(x, y - 1.6);
        ctx.lineTo(x + 2.6, y);
        ctx.lineTo(x, y + 1.6);
        ctx.fill();
      }
    },
  };
}


const SCENES = { long, shelter, dive, tanks, jump, fold, thousand };

/** what: { scene } names one. hooks: what the secrets listen for (see secrets/index.js). */
export function makeScene(what, hooks) {
  const make = SCENES[what.scene];
  const scene = make ? make(what, hooks) : { el: document.createElement("div") };
  scene.kind = what.scene;
  return scene;
}
