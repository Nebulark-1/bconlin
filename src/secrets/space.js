// Above the home page. At the very top, keep scrolling up and the page
// gives a little; keep going and the sky opens. The climb is on a log
// scale, from Fort Collins to the Moon, so each band of the sky gets room:
// my one skydive, Pikes Peak, the clouds, the edge of space, the space
// station, the GPS satellites, and the Moon. An altimeter keeps count.

import { discover, isFound, isOn } from "../site/eggs.js";
import { chime, gust, PENTATONIC } from "../site/sound.js";

const GROUND = 1525; // Fort Collins, 5,003 ft, in meters
const MOON = 3.844e8;
const L0 = Math.log10(GROUND);
const L1 = Math.log10(MOON) + 0.45; // a little sky past the Moon, so it isn't cut off at the top
/** 0 (Fort Collins) to 1 (the top, just past the Moon), on a log scale, and back. */
export const placeOf = (meters) => (Math.log10(meters) - L0) / (L1 - L0);
export const heightAt = (u) => 10 ** (L0 + u * (L1 - L0));

export function altitude(meters) {
  return meters < 1e5 ? `${Math.round(meters * 3.28084).toLocaleString("en-US")} ft` : `${Math.round(meters / 1000).toLocaleString("en-US")} km`;
}

// Real heights, all of them.
const MARKS = [
  { id: "peak", m: 4302, label: "Pikes Peak · 14,115 ft" },
  { id: "clouds", m: 11000, label: "Cirrus clouds · about 36,000 ft" },
  { id: "karman", m: 1e5, label: "The Kármán line · 100 km · space starts here" },
  { id: "iss", m: 4.08e5, label: "International Space Station · about 400 km" },
  { id: "gps", m: 2.02e7, label: "GPS satellites · 20,200 km" },
  { id: "moon", m: MOON, label: "The Moon · 384,400 km" },
];
const JUMP = 3000; // where the plane flies by
const SKY_VH = 420; // how tall the sky is, in screen heights
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const top = (m) => `${((1 - placeOf(m)) * 100).toFixed(2)}%`;

function build() {
  const sky = document.createElement("section");
  sky.className = "space";
  sky.setAttribute("aria-label", "Above the home page");
  sky.style.height = `${SKY_VH}vh`;
  const mark = (id) => MARKS.find((k) => k.id === id);
  sky.innerHTML = `
    <canvas class="space__stars" aria-hidden="true"></canvas>
    <div class="space__band space__band--karman" style="top:${top(1e5)}"><span>${mark("karman").label}</span></div>
    <div class="space__thing space__moon" style="top:${top(MOON)}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56"/><circle class="crater" cx="40" cy="44" r="10"/><circle class="crater" cx="74" cy="70" r="14"/><circle class="crater" cx="70" cy="32" r="6"/><circle class="crater" cx="38" cy="82" r="5"/></svg>
      <span>${mark("moon").label}</span>
    </div>
    <div class="space__thing space__gps" style="top:${top(2.02e7)}">
      ${[0, 1, 2].map((k) => `<svg viewBox="0 0 40 20" style="--k:${k}" aria-hidden="true"><rect x="16" y="6" width="8" height="8"/><path d="M2 10h12M26 10h12"/><rect x="0" y="7" width="12" height="6" class="panel"/><rect x="28" y="7" width="12" height="6" class="panel"/></svg>`).join("")}
      <span>${mark("gps").label}</span>
    </div>
    <div class="space__thing space__iss" style="top:${top(4.08e5)}">
      <svg viewBox="0 0 120 50" aria-hidden="true"><rect x="50" y="20" width="20" height="10" rx="2"/><path d="M60 8v34M20 25h80"/>${[14, 28, 82, 96].map((x) => `<rect class="panel" x="${x - 6}" y="6" width="12" height="38"/>`).join("")}</svg>
      <span>${mark("iss").label}</span>
    </div>
    <div class="space__clouds" style="top:${top(11000)}" aria-hidden="true"><i></i><i></i><i></i></div>
    <span class="space__label space__label--clouds" style="top:${top(11000)}">${mark("clouds").label}</span>
    <svg class="space__range" viewBox="0 0 1000 100" preserveAspectRatio="none" style="height:${(placeOf(4302) * 100).toFixed(2)}%" aria-hidden="true">
      <path d="M0 100V70L80 52 150 64 230 38 300 56 380 30 450 50 560 0 640 40 720 26 800 48 880 34 1000 58V100Z"/>
    </svg>
    <span class="space__label space__label--peak" style="top:${top(4302)}">${mark("peak").label}</span>
    <div class="space__jump" style="top:${top(JUMP)}">
      <svg class="space__flight" aria-hidden="true">
        <path class="plane" d="M-26 0h40l10-6h7l-7 9h-50z M-8 0l-11-12h7l14 12z"/>
        <path class="tether"/>
        <g class="jumper">
          <g class="canopy"><path d="M-30 -40Q0 -66 30 -40Q0 -48 -30 -40Z"/><path class="lines" d="M-28 -40L0 -6M28 -40L0 -6M0 -46V-6"/></g>
          <circle r="4.5"/><path class="body" d="M0 4v10"/>
        </g>
      </svg>
      <p>My one skydive: a static line jump south of Colorado Springs. Letting go of the plane was awe and sheer terror at once.</p>
    </div>
    <p class="space__alt" aria-hidden="true"><small>Altitude</small><b></b></p>`;
  return sky;
}

// More stars the higher you go, a few in the site's colors.
function drawStars(canvas, sky) {
  const w = Math.min(1600, sky.clientWidth);
  const h = Math.min(6000, sky.clientHeight);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const COLORS = ["#ece8ff", "#ece8ff", "#ece8ff", "#a99bff", "#5ec8ff", "#ffb48c"];
  const n = Math.round((w * h) / 900);
  for (let k = 0; k < n; k++) {
    const y = Math.random() * h;
    const u = 1 - y / h;
    // thin near the ground, thick above the edge of space
    if (Math.random() > Math.min(1, 0.08 + Math.max(0, u - 0.2) * 2.2)) continue;
    ctx.globalAlpha = 0.35 + Math.random() * 0.65;
    ctx.fillStyle = COLORS[k % COLORS.length];
    ctx.beginPath();
    ctx.arc(Math.random() * w, y, Math.random() < 0.06 ? 1.6 : 0.5 + Math.random() * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The flight: a plane crosses the whole sky; partway over, someone lets go.
 * The static line pulls the canopy open, and they drift down behind the
 * mountains. Then again.
 */
function flight(svg) {
  const plane = svg.querySelector(".plane");
  const tether = svg.querySelector(".tether");
  const jumper = svg.querySelector(".jumper");
  const canopy = svg.querySelector(".canopy");
  const H = 260;
  const PLANE_Y = 50;
  return (t) => {
    const w = svg.clientWidth || 1000;
    svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
    const c = t % 14;
    const speed = (w + 160) / 7; // across in seven seconds
    const px = -80 + c * speed;
    plane.setAttribute("transform", `translate(${px.toFixed(1)} ${PLANE_Y}) scale(-1 1)`); // drawn nose-left; it flies right
    const exitAt = (w * 0.32 + 80) / speed;
    if (c < exitAt) {
      jumper.setAttribute("opacity", 0);
      tether.setAttribute("d", "");
      return;
    }
    const e = c - exitAt;
    const fall = Math.min(e, 0.9);
    let x = w * 0.32 + Math.min(e, 1.4) * speed * 0.18;
    let y = PLANE_Y + 6 + 90 * fall * fall;
    const open = Math.min(1, Math.max(0, (e - 0.9) / 0.45));
    if (e > 0.9) y += (e - 0.9) * 16;
    x += Math.sin(e * 1.3) * 6 * open;
    jumper.setAttribute("opacity", Math.max(0, Math.min(1, (H - y) / 30)).toFixed(2));
    jumper.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    canopy.setAttribute("transform", `scale(${open.toFixed(3)} ${Math.max(0.01, open).toFixed(3)})`);
    // the line stays tied to the plane until it pulls the canopy out
    tether.setAttribute("d", e < 0.95 ? `M${(px - 20).toFixed(1)} ${PLANE_Y + 2}L${x.toFixed(1)} ${y.toFixed(1)}` : "");
  };
}

/** How hard you've pulled at the top so far, as a strip of sky peeking in. */
function makePeek() {
  const peek = document.createElement("div");
  peek.className = "space-peek";
  peek.setAttribute("aria-hidden", "true");
  document.body.appendChild(peek);
  return (amount) => peek.style.setProperty("--pull", amount.toFixed(3));
}

export function mountSpace() {
  const main = document.querySelector("main");
  if (!main) return;
  // the first time takes some doing; after that, a firm pull opens it
  const NEED = isFound("space") ? 900 : 2600;
  const peek = makePeek();
  let pulled = 0;
  let lastPull = 0;
  let sky = null;

  const pull = (amount) => {
    if (sky || scrollY > 0) return;
    pulled += amount;
    lastPull = performance.now();
    peek(Math.min(1, pulled / NEED));
    if (pulled >= NEED) {
      pulled = 0;
      peek(0);
      discover("space");
      if (isOn("space")) open();
    }
  };
  addEventListener("wheel", (e) => e.deltaY < 0 && pull(Math.min(120, -e.deltaY)), { passive: true });
  let y0 = null;
  addEventListener("touchstart", (e) => (y0 = scrollY <= 0 ? e.touches[0].clientY : null), { passive: true });
  addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const y = e.touches[0].clientY;
    if (y > y0) pull((y - y0) * 2.5);
    y0 = y;
  }, { passive: true });
  // let go and the pull fades
  const relax = (now) => {
    if (!sky && pulled > 0 && now - lastPull > 350) {
      pulled = Math.max(0, pulled - NEED * 0.04);
      peek(Math.min(1, pulled / NEED));
    }
    if (!sky) requestAnimationFrame(relax);
  };
  requestAnimationFrame(relax);

  function open() {
    sky = build();
    main.prepend(sky);
    document.body.classList.add("has-space");
    drawStars(sky.querySelector(".space__stars"), sky);
    // keep the hero exactly where it was, then rise into the sky
    const H = sky.offsetHeight;
    scrollTo({ top: H, behavior: "instant" });
    requestAnimationFrame(() => scrollTo({ top: H - innerHeight * 0.95, behavior: calm() ? "instant" : "smooth" }));
    gust(0.85, 5);
    climb();
  }

  function climb() {
    const alt = sky.querySelector(".space__alt");
    const value = alt.querySelector("b");
    const flightSvg = sky.querySelector(".space__flight");
    const fly = flight(flightSvg);
    const started = performance.now();
    let high = 0; // the highest place reached, for the chimes
    const rings = [placeOf(1e5), placeOf(4.08e5), placeOf(2.02e7), placeOf(MOON)];
    const tick = (now) => {
      const r = sky.getBoundingClientRect();
      const inView = r.bottom > innerHeight * 0.5;
      alt.classList.toggle("is-on", inView);
      if (inView) {
        // the middle of the window, as a height
        const u = Math.min(1, Math.max(0, (r.bottom - innerHeight / 2) / r.height));
        value.textContent = altitude(heightAt(u));
        // a note each time you pass something new on the way up
        rings.forEach((ring, k) => {
          if (u >= ring && high < ring) chime(PENTATONIC[3 + k], 0.04, 0, 3);
        });
        high = Math.max(high, u);
        const fr = flightSvg.getBoundingClientRect();
        if (fr.bottom > 0 && fr.top < innerHeight) fly(calm() ? 3.6 : (now - started) / 1000);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
