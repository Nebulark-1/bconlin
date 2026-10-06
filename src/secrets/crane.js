// The secrets page: a square of paper. Each click is one fold, from the
// crease pattern to a shaped crane, right where it sits. Then the crane
// flies off into your star chart, and a fresh sheet takes its place.
// Every crane is counted.

import { discover, isFound, isOn } from "../site/eggs.js";
import { chime, pluck, PENTATONIC } from "../site/sound.js";
import { STEPS, CREASES, onPaper, resample, between, toPath } from "./fold.js";
import { remember, keep } from "./store.js";

const N = 72;
const SHAPES = STEPS.map((s) => resample(s.outline, N));
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

const creases = CREASES.map(({ l, valley }) => {
  const [[x1, y1], [x2, y2]] = l.map(onPaper);
  return `<path d="M${x1} ${y1}L${x2} ${y2}" class="${valley ? "valley" : "mountain"}"/>`;
}).join("");

/** A crane's wings, lifted by `lift` (smaller is higher). */
const wings = (lift) => [`M70 122L96 ${lift}L128 120L100 140Z`, `M92 116L132 ${lift + 14}L146 112Z`];

function sheetSvg() {
  return `<svg viewBox="0 0 200 200" aria-hidden="true">
    <path class="crane__back"/>
    <path class="crane__paper"/>
    <path class="crane__wing"/>
    <g class="crane__creases">${creases}</g>
  </svg>`;
}

export function mountCrane() {
  const host = document.querySelector(".sky__text");
  if (!host) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "crane";
  button.innerHTML = sheetSvg();
  const tally = document.createElement("p");
  tally.className = "crane__tally";
  host.append(button, tally);
  const $ = (s) => button.querySelector(s);

  let step = 0;
  let shown = SHAPES[0];
  let from = SHAPES[0];
  let at = -1e9;
  let busy = false;
  const name = () => button.setAttribute("aria-label", step === 0 ? "A square of paper" : `A square of paper, folded ${step} of 3 times`);
  const count = () => {
    const n = isFound("cranes") && isOn("cranes") ? remember("bc-cranes") : 0;
    tally.textContent = n ? `${n.toLocaleString("en-US")} folded` : "";
  };
  name();
  count();

  const draw = (now) => {
    const u = calm() ? 1 : ease((now - at) / 450);
    shown = between(from, SHAPES[step], u);
    $(".crane__paper").setAttribute("d", toPath(shown));
    $(".crane__creases").style.opacity = step === 0 ? u : step === 1 ? 1 - u : 0;
    const w = step === 3 ? u : 0;
    const [front, back] = wings(12 + (1 - w) * 96 + Math.sin(now / 300) * 4 * w);
    $(".crane__wing").setAttribute("d", front);
    $(".crane__back").setAttribute("d", back);
    $(".crane__wing").style.opacity = w;
    $(".crane__back").style.opacity = w;
    if (u < 1 || step === 3) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  button.addEventListener("click", () => {
    if (busy) return;
    from = shown;
    step++;
    at = performance.now();
    name();
    pluck(220 * [1, 1.25, 1.5, 2][step], 0.5);
    requestAnimationFrame(draw);
    if (step < 3) return;
    // a crane: count it, then let it go
    busy = true;
    keep("bc-cranes", remember("bc-cranes") + 1);
    discover("cranes");
    setTimeout(() => {
      fly(button);
      count();
      // a fresh sheet
      step = 0;
      from = SHAPES[0];
      shown = SHAPES[0];
      at = performance.now();
      button.classList.add("is-new");
      requestAnimationFrame(draw);
      setTimeout(() => {
        button.classList.remove("is-new");
        busy = false;
        name();
      }, 600);
    }, calm() ? 200 : 900);
  });
}

/** A copy of the crane flaps off toward the star chart and becomes a star. */
function fly(button) {
  const start = button.getBoundingClientRect();
  const chart = document.querySelector(".sky__canvas")?.getBoundingClientRect();
  const crane = document.createElement("div");
  crane.className = "crane-flight";
  crane.innerHTML = button.innerHTML;
  crane.style.width = `${start.width}px`;
  crane.style.height = `${start.height}px`;
  document.body.appendChild(crane);
  const wing = crane.querySelector(".crane__wing");
  const back = crane.querySelector(".crane__back");
  const to = chart
    ? { x: chart.left + chart.width * (0.25 + Math.random() * 0.5), y: chart.top + chart.height * (0.2 + Math.random() * 0.5) }
    : { x: innerWidth * 0.75, y: innerHeight * 0.25 };
  const x0 = start.left + start.width / 2;
  const y0 = start.top + start.height / 2;
  [0, 2, 4].forEach((n, k) => setTimeout(() => chime(PENTATONIC[n + 3], 0.03, 0.4, 1.6), k * 140));
  const t0 = performance.now();
  const T = calm() ? 1 : 1800;
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / T);
    const e = ease(u);
    // up and over, in an arc
    const x = x0 + (to.x - x0) * e;
    const y = y0 + (to.y - y0) * e - Math.sin(u * Math.PI) * 120;
    crane.style.transform = `translate(${x - start.width / 2}px, ${y - start.height / 2}px) scale(${1 - e * 0.75})`;
    const [front, rear] = wings(12 + Math.abs(Math.sin(now / 90)) * 70);
    wing.setAttribute("d", front);
    back.setAttribute("d", rear);
    if (u < 1) return requestAnimationFrame(tick);
    // it lands as a star
    crane.classList.add("is-star");
    setTimeout(() => crane.remove(), 1200);
  };
  requestAnimationFrame(tick);
}
