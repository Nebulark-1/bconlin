// The career page, Michigan Tech: press and hold on the canal and you go
// under. The water closes over the picture, and you sink as long as you
// hold, with your breath as a ring around your finger. The light fades,
// the bottom comes up at 80 feet, and there's a rock. Let go and you
// float back up.

import { discover, isFound, isOn } from "../site/eggs.js";
import { chime, pluck, ambience, PENTATONIC } from "../site/sound.js";
import { remember, keep } from "./store.js";

const NS = "http://www.w3.org/2000/svg";
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const BOTTOM = 80; // feet
const BREATH = 11; // seconds of air
// Michigan Tech's own atmosphere, to come back up to (src/career/soundscape.js)
const SHORE = { air: 0.5, wind: 0.35, sparkle: false, hush: 1500 };

/**
 * One frame of the dive. Holding sinks you 22 ft a second; letting go
 * floats you up at 30. Air only runs out below the surface, and refills
 * on top. Run out and you come up whether you're holding or not.
 * Returns what happened this frame: "rock" (picked it up), "surfaced", or "".
 */
export function diveStep(s, dt) {
  const down = s.holding && !s.gasp;
  const was = s.depth;
  s.depth = Math.min(BOTTOM, Math.max(0, s.depth + (down ? 22 : -30) * dt));
  if (s.depth > 0) {
    s.under += dt;
    s.breath = Math.max(0, s.breath - dt / BREATH);
  }
  if (s.breath === 0) s.gasp = true;
  if (s.depth >= BOTTOM && !s.carrying) {
    s.carrying = true;
    return "rock";
  }
  if (was > 0 && s.depth === 0) return "surfaced";
  return "";
}

export function mountLake() {
  const scene = document.querySelector('[data-scene="houghton"]');
  const panel = scene?.querySelector(".panel");
  if (!panel) return;
  // inside the picture's visible frame, and on the canal's water
  const onWater = (e) => {
    const frame = panel.getBoundingClientRect();
    if (e.clientX < frame.left || e.clientX > frame.right || e.clientY < frame.top || e.clientY > frame.bottom) return false;
    if (e.target.closest?.("a, button, .card__box")) return false;
    const water = panel.querySelector('path[fill="url(#h-water)"]');
    const m = water?.getScreenCTM();
    return !!m && water.isPointInFill(new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()));
  };
  let dive = null;
  scene.addEventListener("pointerdown", (e) => {
    if (dive || e.button !== 0 || !onWater(e)) return;
    dive = start(panel, e, () => (dive = null));
  });
}

function start(panel, e, done) {
  const box = panel.getBoundingClientRect();
  const lake = document.createElement("div");
  lake.className = "lake";
  lake.setAttribute("aria-hidden", "true");
  lake.innerHTML = `
    <div class="lake__water"></div>
    <div class="lake__floor"><i class="lake__rock"></i></div>
    <svg class="lake__gauge" viewBox="0 0 60 300" preserveAspectRatio="xMidYMid meet">
      ${[0, 20, 40, 60, 80].map((d) => `<path d="M34 ${20 + d * 3.3}h14"/><text x="30" y="${24 + d * 3.3}">${d === 80 ? "80 ft" : d}</text>`).join("")}
      <path class="lake__mark" d="M50 0l8 -5v10z"/>
    </svg>
    <svg class="lake__ring" viewBox="-30 -30 60 60"><circle class="lake__air" r="22" pathLength="1"/><path class="lake__carry" d="M-7 4l4-6 8-1 5 4 1 4z"/></svg>
    <p class="lake__note"></p>
    <i class="lake__ripple"></i>`;
  panel.appendChild(lake);
  const $ = (s) => lake.querySelector(s);
  const ring = $(".lake__ring");
  const place = (x, y) => {
    lake.style.setProperty("--x", `${x - box.left}px`);
    lake.style.setProperty("--y", `${y - box.top}px`);
  };
  place(e.clientX, e.clientY);

  const s = { depth: 0, breath: 1, holding: true, carrying: false, gasp: false, under: 0 };
  let level = 0; // how much of the picture the water covers, 0..1
  let started = performance.now();
  let last = started;
  let leaving = false;
  let bubbleAt = 0;

  // only sink after a real hold (a tap just ripples)
  const SETTLE = 350;
  const move = (ev) => place(ev.clientX, ev.clientY);
  const up = () => (s.holding = false);
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const held = now - started;
    if (held < SETTLE) {
      if (!s.holding) return finish(false);
      return (raf = requestAnimationFrame(tick));
    }
    if (!lake.classList.contains("is-under")) {
      lake.classList.add("is-under");
      discover("dive");
      if (!isOn("dive")) return finish(false);
      ambience({ air: 0.2, wind: 0, sparkle: false, hush: 700 }); // muffled, under water
    }
    // the water closes over the picture, then opens again on the way out
    level += ((leaving ? 0 : 1) - level) * (calm() ? 1 : 1 - Math.exp(-dt * 5));
    const what = leaving ? "" : diveStep(s, dt);
    if (what === "rock") pluck(110, 0.8);
    if (what === "surfaced") {
      // nearly out of air, but not out: the longest you can safely go
      if (!s.gasp && s.breath < 0.1) {
        if (s.under > remember("bc-breath")) keep("bc-breath", s.under.toFixed(1));
        discover("breath");
      }
      const best = isFound("breath") && isOn("breath") ? remember("bc-breath") : 0;
      $(".lake__note").textContent = s.carrying ? "Just a rock." : best ? `Longest breath: ${best.toFixed(1)} s` : "";
      chime(PENTATONIC[s.carrying ? 5 : 2], 0.04);
      leaving = true;
    }
    const d = s.depth / BOTTOM;
    lake.style.setProperty("--level", level.toFixed(3));
    lake.style.setProperty("--depth", d.toFixed(3));
    lake.style.setProperty("--air", s.breath.toFixed(3));
    lake.classList.toggle("is-low", s.breath < 0.25);
    lake.classList.toggle("is-carrying", s.carrying);
    $(".lake__mark").setAttribute("transform", `translate(0 ${20 + s.depth * 3.3})`);
    // bubbles on the way up
    if (!s.holding && s.depth > 1 && now - bubbleAt > 140) {
      bubbleAt = now;
      const b = document.createElement("i");
      b.className = "lake__bubble";
      b.style.left = `calc(var(--x) + ${(Math.random() - 0.5) * 20}px)`;
      b.style.top = "var(--y)";
      lake.appendChild(b);
      setTimeout(() => b.remove(), 1400);
    }
    if (leaving && level < 0.02) return finish(true);
    raf = requestAnimationFrame(tick);
  };
  let raf = requestAnimationFrame(tick);

  function finish(dove) {
    cancelAnimationFrame(raf);
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    if (dove) ambience(SHORE);
    // let the note linger a moment above the surface
    setTimeout(() => lake.remove(), dove && lake.querySelector(".lake__note").textContent ? 1800 : 300);
    lake.classList.add("is-gone");
    done();
  }
  return {};
}
