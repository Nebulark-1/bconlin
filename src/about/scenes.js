// The little scene at the top of each dive-in. Each one is a function that
// returns { el, frame(t, dt), stop?, stats? }: t is seconds since it
// opened. They are deliberately plain: a few shapes in high contrast,
// moving just enough to show the idea.

import { chime, pluck, PENTATONIC } from "../site/sound.js";
import { STEPS, CREASES, onPaper, resample, between, toPath } from "./fold.js";
import { makeSchool, swim } from "./school.js";

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
const mix = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const blend = (a, b, t) => `rgb(${hex(a).map((v, k) => Math.round(mix(v, hex(b)[k], clamp(t)))).join(",")})`;

function svg(kind, viewBox, inner, tag = "div") {
  const el = document.createElement(tag);
  el.className = `scene scene--${kind}`;
  el.innerHTML = `<svg viewBox="${viewBox}" aria-hidden="true">${inner}</svg>`;
  return el;
}
const $ = (el, sel) => el.querySelector(sel);
const attr = (node, a) => {
  for (const k in a) node.setAttribute(k, a[k]);
};
const mono = (x, y, text, { fill = C.dim, anchor = "start", size = 11, cls = "" } = {}) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" class="mono ${cls}">${text}</text>`;

// ── Where I've lived ───────────────────────────────────────
function map() {
  const at = ([lon, lat]) => [20 + ((lon + 124) / 38) * 280, 150 - ((lat - 37) / 12) * 130];
  const PLACES = [
    { name: "Kirkland", ll: [-122.2, 47.68], dx: 8, dy: 3 },
    { name: "Colorado Springs", ll: [-104.82, 38.83], dx: 8, dy: 10 },
    { name: "Provo", ll: [-111.66, 40.23], dx: -8, dy: 3, anchor: "end" },
    { name: "Houghton", ll: [-88.57, 47.12], dx: -8, dy: -6, anchor: "end" },
    { name: "Fort Collins", ll: [-105.08, 40.59], dx: 8, dy: -2 },
  ].map((p) => ({ ...p, xy: at(p.ll) }));
  const arc = (a, b, bow) => {
    const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return `M${a}Q${mx},${my - Math.hypot(b[0] - a[0], b[1] - a[1]) * bow} ${b}`;
  };
  const legs = PLACES.slice(1).map((p, k) => arc(PLACES[k].xy, p.xy, 0.22));
  const grid = [0, 1, 2, 3].map((k) => `<path d="M10 ${30 + k * 36}H310" />`).join("") + [0, 1, 2, 3, 4, 5].map((k) => `<path d="M${30 + k * 52} 14V156" />`).join("");
  const el = svg(
    "map",
    "0 0 320 170",
    `<g stroke="${C.faint}" stroke-width=".5" opacity=".6">${grid}</g>
     <path class="summer" d="${arc(PLACES[4].xy, PLACES[0].xy, 0.32)}" fill="none" stroke="${C.water}" stroke-width="1" stroke-dasharray="3 4" opacity="0"/>
     <circle class="summer-dot" r="3" fill="${C.water}" opacity="0"/>
     ${legs.map((d) => `<path class="leg" d="${d}" pathLength="1" fill="none" stroke="${C.accent}" stroke-width="1.6" stroke-dasharray="1" stroke-dashoffset="1"/>`).join("")}
     ${PLACES.map(
       (p) => `<g class="city" opacity="0"><circle cx="${p.xy[0]}" cy="${p.xy[1]}" r="${p.name === "Fort Collins" ? 5 : 3.5}" fill="${p.name === "Fort Collins" ? C.accent : C.ink}"/>
        ${mono(p.xy[0] + p.dx, p.xy[1] + p.dy, p.name, { fill: C.ink, anchor: p.anchor || "start" })}</g>`,
     ).join("")}
     ${mono(316, 166, "every summer", { fill: C.water, anchor: "end", cls: "summer-label" })}`,
  );
  const legEls = [...el.querySelectorAll(".leg")];
  const cities = [...el.querySelectorAll(".city")];
  const summer = $(el, ".summer");
  const dot = $(el, ".summer-dot");
  const label = $(el, ".summer-label");
  let len = 0;
  return {
    el,
    still: 9,
    frame(t) {
      cities[0].setAttribute("opacity", clamp(t * 4));
      legEls.forEach((l, k) => {
        const u = ease((t - 0.3 - k * 0.75) / 0.75);
        l.setAttribute("stroke-dashoffset", 1 - u);
        if (u > 0.95) cities[k + 1].setAttribute("opacity", 1);
      });
      const s = clamp((t - 3.6) * 2);
      summer.setAttribute("opacity", s * 0.8);
      label.setAttribute("opacity", s);
      if (s > 0) {
        len ||= summer.getTotalLength();
        const u = ((t - 3.6) / 3.2) % 1;
        const p = summer.getPointAtLength(len * u);
        attr(dot, { cx: p.x, cy: p.y, opacity: Math.sin(u * Math.PI) });
      }
    },
  };
}

// ── Second at state ────────────────────────────────────────
function race() {
  const el = svg(
    "race",
    "0 0 320 100",
    `<path d="M20 62H300" stroke="${C.faint}" stroke-width="1.5"/>
     <path d="M290 40V80" stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="2 3"/>
     ${mono(290, 34, "finish", { anchor: "middle" })}
     <g class="lead"><circle r="5" fill="${C.ink}"/>${mono(0, -11, "1st", { fill: C.ink, anchor: "middle", cls: "tag" })}</g>
     <g class="me"><circle r="5.5" fill="${C.accent}"/>${mono(0, 20, "2nd", { fill: C.accent, anchor: "middle", size: 10, cls: "tag" })}</g>`,
  );
  const lead = $(el, ".lead");
  const me = $(el, ".me");
  return {
    el,
    still: 4.5,
    frame(t) {
      const p = (t % 6.5) / 3.8;
      const a = Math.min(1, p * 1.05);
      const b = Math.min(1, p * 0.95 + 0.05 * p * p);
      lead.setAttribute("transform", `translate(${20 + a * 270} 56)`);
      me.setAttribute("transform", `translate(${20 + b * 270} 68)`);
      $(lead, ".tag").setAttribute("opacity", a >= 1 ? 1 : 0);
      $(me, ".tag").setAttribute("opacity", b >= 1 ? 1 : 0);
    },
  };
}

// ── Boulder 70.3: speed went up and down, fun didn't ───────
function tri() {
  const X0 = 50;
  const X1 = 304;
  const cut = [X0, mix(X0, X1, 1 / 3), mix(X0, X1, 2 / 3), X1];
  const dip = (u, at, w, d) => (Math.abs(u - at) < w ? d * (1 - Math.abs(u - at) / w) : 0);
  // made-up shape, true story: slow swim with a cramp, fast bike fighting cramps, slow run
  const speed = (u) =>
    u < 1 / 3
      ? 0.3 + 0.03 * Math.sin(u * 70) - dip(u, 0.07, 0.03, 0.22)
      : u < 2 / 3
        ? 0.9 + 0.04 * Math.sin(u * 40) - dip(u, 0.45, 0.02, 0.4) - dip(u, 0.58, 0.02, 0.35)
        : 0.3 - (u - 2 / 3) * 0.3 + 0.03 * Math.sin(u * 55);
  const y = (s) => 148 - s * 62;
  const el = svg(
    "tri",
    "0 0 320 160",
    `${["swim", "bike", "run"].map((n, k) => mono((cut[k] + cut[k + 1]) / 2, 16, n, { anchor: "middle", fill: C.ink })).join("")}
     <path d="M${X0} 36H${X1}" stroke="${C.faint}" stroke-width="1.5"/>
     ${cut.map((x) => `<path d="M${x} 30V42" stroke="${C.dim}"/>`).join("")}
     <path d="M${X0} 148H${X1}" stroke="${C.faint}"/>
     ${mono(4, 82, "fun", { fill: C.accent })}${mono(4, 140, "speed", { fill: C.ink })}
     <path class="fun" fill="none" stroke="${C.accent}" stroke-width="2"/>
     <path class="speed" fill="none" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/>
     <circle class="me" r="4.5" fill="${C.accent}"/>`,
  );
  const fun = $(el, ".fun");
  const line = $(el, ".speed");
  const me = $(el, ".me");
  let u = 0;
  let pts = [];
  let rest = 0;
  const draw = (t) => {
    const x = mix(X0, X1, u);
    const bob = u < 1 / 3 ? Math.sin(t * 8) * 2.5 : u > 2 / 3 ? Math.abs(Math.sin(t * 9)) * -2 : 0;
    attr(me, { cx: x, cy: 36 + bob });
    fun.setAttribute("d", `M${X0} 80H${x}`);
    line.setAttribute("d", pts.length ? `M${pts.join("L")}` : "");
  };
  return {
    el,
    still: null,
    frame(t, dt) {
      if (dt === 0) {
        // reduced motion: the finished picture
        pts = [];
        for (u = 0; u <= 1; u += 0.005) pts.push(`${mix(X0, X1, u).toFixed(1)} ${y(speed(u)).toFixed(1)}`);
        u = 1;
        return draw(0);
      }
      if (u >= 1) {
        rest += dt;
        if (rest > 3) {
          u = 0;
          pts = [];
          rest = 0;
        }
      } else {
        u = Math.min(1, u + dt * (0.05 + 0.16 * speed(u)));
        pts.push(`${mix(X0, X1, u).toFixed(1)} ${y(speed(u)).toFixed(1)}`);
      }
      draw(t);
    },
  };
}

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

// ── A photo ────────────────────────────────────────────────
function photo(dive) {
  const el = document.createElement("figure");
  el.className = "scene scene--photo";
  el.innerHTML = `<img src="${dive.photo.src}" alt="${dive.photo.alt}" loading="lazy" /><figcaption class="mono">${dive.photo.caption}</figcaption>`;
  return { el };
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

// ── Sunrise, sunset ────────────────────────────────────────
function horizon() {
  const el = svg(
    "horizon",
    "0 0 320 150",
    `<defs>
       <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop class="top" offset="0"/><stop class="low" offset="1"/></linearGradient>
       <clipPath id="above"><rect width="320" height="100"/></clipPath>
     </defs>
     <rect width="320" height="100" fill="url(#sky)"/>
     <circle class="sun" cx="214" r="15" fill="${C.accent}" clip-path="url(#above)"/>
     <rect y="100" width="320" height="50" fill="#06101f"/>
     <g class="glint" stroke="${C.accent}" stroke-width="1.5">${[0, 1, 2, 3, 4].map((k) => `<path d="M${206 - k * 2} ${106 + k * 8}h${16 + k * 4}"/>`).join("")}</g>
     <path d="M0 100H320" stroke="${C.ink}" stroke-width="1"/>
     <path d="M0 150V128Q50 132 112 150Z" fill="#1c1a2c"/>`,
  );
  const [top, low] = [$(el, ".top"), $(el, ".low")];
  const sun = $(el, ".sun");
  const glint = $(el, ".glint");
  return {
    el,
    still: 1.3,
    frame(t) {
      const h = Math.sin((t / 16) * Math.PI * 2 - 0.6);
      const glow = clamp(1 - Math.abs(h - 0.08) * 3);
      const day = clamp(h * 1.6);
      top.setAttribute("stop-color", blend("#070b22", "#2c568f", day));
      low.setAttribute("stop-color", blend(blend("#141436", "#5d8fc4", day), "#ff8a5a", glow));
      sun.setAttribute("cy", 100 - h * 58);
      glint.setAttribute("opacity", clamp(h * 3 + 0.4) * 0.8);
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
  label.className = "scene__label mono";
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

// ── The 75 gallon dream: a school ──────────────────────────
function school() {
  const el = document.createElement("div");
  el.className = "scene scene--school";
  el.innerHTML = `<canvas aria-hidden="true"></canvas><span class="mono">75 gal</span>`;
  const canvas = $(el, "canvas");
  const ctx = canvas.getContext("2d");
  let fish = null;
  let w = 0;
  let h = 0;
  let predator = null;
  const where = (e) => {
    const r = canvas.getBoundingClientRect();
    predator = { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointermove", where);
  canvas.addEventListener("pointerdown", where);
  canvas.addEventListener("pointerleave", () => (predator = null));
  const stats = { fish: 0, fleeing: 0 };
  return {
    el,
    stats,
    still: 3,
    frame(t, dt) {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (cw !== w || ch !== h) {
        w = cw;
        h = ch;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        fish ||= makeSchool(Math.round(clamp((w * h) / 520, 30, 90)), w, h);
      }
      // reduced motion gets one settled frame
      const steps = dt === 0 ? 120 : 1;
      for (let k = 0; k < steps; k++) swim(fish, dt || 1 / 60, w, h, predator);
      stats.fish = fish.length;
      stats.fleeing = predator ? fish.filter((f) => Math.hypot(f.x - predator.x, f.y - predator.y) < 70).length : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      fish.forEach((f, k) => {
        const a = Math.atan2(f.vy, f.vx);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(a);
        ctx.fillStyle = k % 9 === 0 ? C.ink : C.water;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -2.6);
        ctx.lineTo(-2.5, 0);
        ctx.lineTo(-4, 2.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
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
  steps.className = "scene__steps mono";
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
  el.className = "scene scene--thousand";
  el.innerHTML = `<canvas aria-hidden="true"></canvas><p class="scene__label mono">0</p>`;
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

// ── Hearing the edges ──────────────────────────────────────
function voices() {
  const pts = Array.from({ length: 52 }, (_, k) => {
    const a = k * 2.399963; // the golden angle, for an even scatter
    const r = 12 + Math.sqrt(k / 52) * 70;
    return { x: 110 + Math.cos(a) * r * 1.3, y: 85 + Math.sin(a) * r, r };
  });
  const edge = pts.filter((p) => p.r > 52);
  edge.sort(() => Math.random() - 0.5);
  const el = svg(
    "voices",
    "0 0 220 170",
    `<g class="links" stroke="${C.accent}" stroke-width=".8" fill="none"></g>
     ${pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6" fill="${C.ink}" opacity="${p.r > 52 ? 0.22 : 0.75}"/>`).join("")}
     <circle class="me" cx="110" cy="85" r="5.5" fill="${C.accent}"/>`,
  );
  const dots = [...el.querySelectorAll("circle:not(.me)")];
  const me = $(el, ".me");
  const links = $(el, ".links");
  edge.forEach((p) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "path");
    attr(l, { d: `M${p.x} ${p.y}L110 85`, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, opacity: 0.6 });
    links.appendChild(l);
    p.line = l;
    p.dot = dots[pts.indexOf(p)];
  });
  return {
    el,
    still: 30,
    frame(t) {
      const cycle = edge.length * 0.5 + 3;
      const c = t % cycle;
      let pulse = 0;
      edge.forEach((p, k) => {
        const u = clamp((c - k * 0.5) / 0.4);
        p.line.setAttribute("stroke-dashoffset", 1 - u);
        p.dot.setAttribute("opacity", 0.22 + u * 0.78);
        p.dot.setAttribute("fill", u > 0 ? C.accent : C.ink);
        if (u >= 1) pulse = Math.max(pulse, clamp(1 - (c - k * 0.5 - 0.4) * 2));
      });
      me.setAttribute("r", 5.5 + pulse * 2.5);
    },
  };
}

// ── Chaos into a plan ──────────────────────────────────────
function plan() {
  const LOAD = [0.45, 0.3, 0.7, 0.25, 0.55, 0.9, 0.15];
  const bars = LOAD.map((l, k) => ({
    x: 26 + k * 42,
    h: 14 + l * 90,
    sx: 20 + Math.random() * 270,
    sy: 10 + Math.random() * 70,
    rot: (Math.random() - 0.5) * 90,
  }));
  const el = svg(
    "plan",
    "0 0 320 140",
    `${bars.map((b, k) => `<rect class="bar" width="26" height="${b.h}" rx="3" fill="${C.pink}" opacity="${0.55 + LOAD[k] * 0.45}"/>`).join("")}
     <path d="M16 120H310" stroke="${C.faint}"/>
     ${"MTWTFSS".split("").map((d, k) => mono(39 + k * 42, 134, d, { anchor: "middle" })).join("")}`,
  );
  const rects = [...el.querySelectorAll(".bar")];
  return {
    el,
    still: 3,
    frame(t) {
      const c = t % 7;
      const u = c < 1 ? 0 : c < 2.2 ? ease((c - 1) / 1.2) : c < 5.8 ? 1 : 1 - ease((c - 5.8) / 1.2);
      bars.forEach((b, k) => {
        const jitter = (1 - u) * Math.sin(t * 5 + k) * 3;
        const x = mix(b.sx, b.x, u) + jitter;
        const y = mix(b.sy, 120 - b.h, u);
        rects[k].setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(b.rot * (1 - u)).toFixed(1)} 13 ${b.h / 2})`);
      });
    },
  };
}

// ── Travel by hot dog ──────────────────────────────────────
function stamps() {
  const CITIES = [
    { name: "CHICAGO", color: C.accent, icon: `<rect x="-11" y="-4" width="22" height="8" rx="4" fill="none" stroke="currentColor"/><path d="M-13 0h26" stroke="currentColor" stroke-width="2"/>` },
    { name: "PHILLY", color: C.coral, icon: `<rect x="-12" y="-4" width="24" height="8" rx="3" fill="none" stroke="currentColor"/><path d="M-9 0l3-2 3 2 3-2 3 2 3-2 3 2" fill="none" stroke="currentColor"/>` },
    { name: "NEW YORK", color: C.pink, icon: `<rect x="-11" y="-4" width="22" height="8" rx="4" fill="none" stroke="currentColor"/><path d="M-13 0h26" stroke="currentColor" stroke-width="2"/><path d="M-8 -1l3 2 3-2 3 2 3-2 3 2" fill="none" stroke="currentColor" stroke-width=".7"/>` },
  ];
  const el = svg(
    "stamps",
    "0 0 320 110",
    CITIES.map(
      (c, k) => `<g class="stamp" style="color:${c.color}" transform="translate(${60 + k * 100} 55)">
        <g class="ink"><circle r="36" fill="none" stroke="currentColor" stroke-width="2"/><circle r="30" fill="none" stroke="currentColor" stroke-width=".8"/>
        <g transform="translate(0 -10)">${c.icon}</g>${mono(0, 14, c.name, { fill: "currentColor", anchor: "middle", size: 9 })}</g></g>`,
    ).join(""),
  );
  const inks = [...el.querySelectorAll(".ink")];
  const tilt = [-9, 6, -4];
  return {
    el,
    still: 4,
    frame(t) {
      const c = t % 7;
      inks.forEach((g, k) => {
        const u = clamp((c - 0.4 - k * 0.7) / 0.18);
        const fade = clamp((6.6 - c) * 2);
        g.setAttribute("transform", `rotate(${tilt[k]}) scale(${(1.5 - 0.5 * u).toFixed(3)})`);
        g.setAttribute("opacity", (u * fade).toFixed(3));
      });
    },
  };
}

// ── On the record player ───────────────────────────────────
function record() {
  const grooves = [62, 56, 50, 44, 38, 32].map((r) => `<circle r="${r}" fill="none" stroke="#2a2740" stroke-width="1"/>`).join("");
  const el = svg(
    "record",
    "0 0 180 160",
    `<g class="disc" transform="translate(80 80)">
       <circle r="70" fill="#0d0c16" stroke="${C.ink}" stroke-width="1.2"/>${grooves}
       <path d="M-60 -20A64 64 0 0 1 -20 -60" stroke="${C.faint}" stroke-width="3" fill="none"/>
       <circle r="22" fill="${C.accent}"/><circle r="2" fill="#0d0c16"/>
       ${mono(0, -8, "GETTING", { fill: "#1a0d06", anchor: "middle", size: 6.5 })}${mono(0, 13, "OLD", { fill: "#1a0d06", anchor: "middle", size: 6.5 })}
     </g>
     <circle cx="160" cy="18" r="6" fill="none" stroke="${C.ink}"/>
     <path d="M160 18L148 92L136 102" stroke="${C.ink}" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
  );
  const disc = $(el, ".disc");
  return {
    el,
    still: 0,
    frame(t) {
      disc.setAttribute("transform", `translate(80 80) rotate(${((t * 200) % 360).toFixed(1)})`);
    },
  };
}

// ── Pages turning ──────────────────────────────────────────
function pages() {
  const text = (x) => [0, 1, 2, 3, 4, 5, 6].map((k) => `<path d="M${x + 10} ${36 + k * 10}h${k === 6 ? 40 : 66}"/>`).join("");
  const el = svg(
    "pages",
    "0 0 220 130",
    `<path d="M20 22H110V112H20ZM110 22H200V112H110Z" fill="#1a1828" stroke="${C.ink}" stroke-width="1.2"/>
     <g stroke="${C.dim}" stroke-width="2">${text(20)}${text(110)}</g>
     <g class="leaf"><rect width="90" height="90" fill="#262338" stroke="${C.ink}" stroke-width="1.2"/><g stroke="${C.dim}" stroke-width="2">${text(0).replace(/M(\d+) (\d+)/g, (_, x, y) => `M${x} ${y - 22}`)}</g></g>`,
  );
  const leaf = $(el, ".leaf");
  return {
    el,
    still: 0,
    frame(t) {
      const c = t % 3.2;
      const a = ease((c - 1.6) / 1.2) * Math.PI;
      const k = Math.cos(a);
      leaf.setAttribute("transform", `translate(110 22) scale(${Math.abs(k) < 0.02 ? 0.02 * Math.sign(k || 1) : k.toFixed(3)} 1)`);
      leaf.setAttribute("opacity", c < 1.6 ? 0 : 1);
    },
  };
}

const SCENES = { map, race, tri, long, photo, shelter, horizon, dive, tanks, school, jump, fold, thousand, voices, plan, stamps, record, pages };

/** point: from content.js. hooks: what the secrets listen for (see main.js). */
export function makeScene(point, hooks) {
  const make = SCENES[point.scene];
  const scene = make ? make(point, hooks) : { el: document.createElement("div") };
  scene.kind = point.scene;
  return scene;
}
