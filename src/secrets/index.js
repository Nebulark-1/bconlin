import "../styles/secrets.css";
import { discover, isFound, isOn } from "../site/eggs.js";
import { addCommands } from "../site/console.js";
import { konami, circleFrom, fibonacciRhythm, isGolden, isElevenEleven, isNight } from "./patterns.js";
import { unrollPi, fibonacciSpiral, goldenWindow, eightBit, shootingStar } from "./effects.js";
import { openTale } from "./tale.js";

// The secrets that live everywhere, plus a few that belong to one page.
// Every page mounts these through mountFab(). No secret here is typed:
// they're clicks, gestures, holds, idling, the time of day, the window's
// shape, the console, and one famous button combo.

// Numbers some secrets keep, in this visitor's browser.
const remember = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const keep = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not remembered; fine
  }
};

/** Found it: count it, and (unless it's switched off) do its thing. */
const found = (id, effect) => {
  discover(id);
  if (isOn(id)) effect?.();
};

// What the dive and the crane listen for.
const HOOKS = {
  // every crane folded to the last step counts; the first finds the secret
  folded() {
    keep("bc-cranes", remember("bc-cranes") + 1);
    discover("cranes");
  },
  mine: () => (isFound("cranes") && isOn("cranes") ? remember("bc-cranes") : 0),
  // surfacing with almost no air left, but some
  breath(seconds) {
    if (seconds > remember("bc-breath")) keep("bc-breath", seconds.toFixed(1));
    discover("breath");
  },
  best: () => (isFound("breath") && isOn("breath") ? remember("bc-breath") : 0),
};

// Clicks and strokes only count on empty page, not on anything you can use.
const busy = (el) => el.closest?.("a, button, input, textarea, select, label, summary, [role=button], [contenteditable], .fab, .tale, .inspector, .bp-chips, .lanes, .harp, .card");

// ── ↑ ↑ ↓ ↓ ← → ← → B A ────────────────────────────────────
function listenKonami() {
  const feed = konami();
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (feed(e.key)) found("konami", () => eightBit());
  });
}

// ── π: draw a circle ───────────────────────────────────────
function listenCircle() {
  let stroke = null;
  addEventListener("pointerdown", (e) => {
    stroke = e.button === 0 && !busy(e.target) ? [{ x: e.clientX, y: e.clientY }] : null;
  });
  addEventListener("pointermove", (e) => {
    if (!stroke) return;
    const last = stroke[stroke.length - 1];
    if (Math.hypot(e.clientX - last.x, e.clientY - last.y) > 4) stroke.push({ x: e.clientX, y: e.clientY });
  });
  addEventListener("pointercancel", () => (stroke = null));
  addEventListener("pointerup", () => {
    const circle = stroke && circleFrom(stroke);
    stroke = null;
    if (circle) {
      getSelection()?.removeAllRanges();
      found("pi", () => unrollPi(circle));
    }
  });
}

// ── 1, 1, 2, 3, 5: click empty space in that rhythm ────────
function listenFibonacci() {
  const rhythm = fibonacciRhythm();
  let at = null;
  let timer = 0;
  addEventListener("click", (e) => {
    if (busy(e.target)) return;
    rhythm.click(performance.now());
    at = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (rhythm.pause(performance.now())) found("fibonacci", () => fibonacciSpiral(at.x, at.y));
    }, 500);
  });
}

// ── φ: a golden window ─────────────────────────────────────
function listenGolden() {
  let timer = 0;
  let was = isGolden(innerWidth, innerHeight);
  addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const now = isGolden(innerWidth, innerHeight);
      // only when you resize into it, not every page that happens to load golden
      if (now && !was) found("golden", goldenWindow);
      was = now;
    }, 250);
  });
}

// ── 11:11 ──────────────────────────────────────────────────
function listenClock() {
  let wished = false;
  const check = () => {
    const now = isElevenEleven(new Date());
    if (now && !wished) found("wish", shootingStar);
    wished = now;
  };
  check();
  setInterval(check, 10000);
}

// ── Already at the top? Keep going up ──────────────────────
function listenJump() {
  let pulls = [];
  const pull = (amount) => {
    const now = performance.now();
    pulls = [...pulls.filter((p) => now - p.t < 1500), { t: now, amount }];
    if (pulls.reduce((s, p) => s + p.amount, 0) > 1400) {
      pulls = [];
      found("jump", () => openTale("jump"));
    }
  };
  addEventListener("wheel", (e) => scrollY <= 0 && e.deltaY < 0 && pull(Math.min(200, -e.deltaY)), { passive: true });
  let y0 = null;
  addEventListener("touchstart", (e) => (y0 = scrollY <= 0 ? e.touches[0].clientY : null), { passive: true });
  addEventListener("touchmove", (e) => {
    if (y0 == null || scrollY > 0) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) pull(dy * 1.5), (y0 = e.touches[0].clientY);
  }, { passive: true });
}

// ── Sit still for a minute (anywhere but home, which hums) ─
function listenIdle(page) {
  if (page === "home") return;
  let timer = 0;
  let shown = false;
  const wake = () => {
    clearTimeout(timer);
    if (!shown) timer = setTimeout(() => ((shown = true), found("tanks", () => openTale("tanks"))), 60000);
  };
  for (const t of ["pointermove", "pointerdown", "keydown", "scroll", "wheel", "touchstart"]) addEventListener(t, wake, { passive: true });
  wake();
}

// ── Page by page ───────────────────────────────────────────
// Career: hold on the water in the Michigan Tech chapter, and dive.
function listenLake() {
  const scene = document.querySelector('[data-scene="houghton"]');
  if (!scene) return;
  let hold = 0;
  let ring = null;
  // inside the picture's visible frame, and on the canal's water
  const inWater = (e) => {
    const frame = scene.querySelector(".panel")?.getBoundingClientRect();
    if (!frame || e.clientX < frame.left || e.clientX > frame.right || e.clientY < frame.top || e.clientY > frame.bottom) return false;
    const water = scene.querySelector('path[fill="url(#h-water)"]');
    const m = water?.getScreenCTM();
    if (!m) return false;
    return water.isPointInFill(new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()));
  };
  const stop = () => {
    clearTimeout(hold);
    ring?.remove();
    ring = null;
  };
  scene.addEventListener("pointerdown", (e) => {
    if (busy(e.target) || !inWater(e)) return;
    // a ripple grows where you're holding
    ring = document.createElement("i");
    ring.className = "lake-ripple";
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    document.body.appendChild(ring);
    hold = setTimeout(() => {
      stop();
      found("dive", () => openTale("dive", HOOKS));
    }, 1100);
  });
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) scene.addEventListener(t, stop);
  addEventListener("scroll", stop, { passive: true });
}

// Home, after dark: a campfire by the strings.
function campfire() {
  if (!isNight(new Date())) return;
  const link = document.querySelector(".secrets-link");
  if (!link) return;
  const fire = document.createElement("button");
  fire.type = "button";
  fire.className = "campfire";
  fire.setAttribute("aria-label", "A campfire");
  fire.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="campfire__flame" d="M12 3c2 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/><path class="campfire__logs" d="M4 21l16-3M4 18l16 3"/></svg>`;
  fire.addEventListener("click", () => found("herman", () => openTale("herman")));
  link.before(fire);
}

// Secrets page: a square of paper to fold.
function paper() {
  const host = document.querySelector(".sky__text");
  if (!host) return;
  const sheet = document.createElement("button");
  sheet.type = "button";
  sheet.className = "paper-square";
  sheet.setAttribute("aria-label", "A square of paper");
  sheet.addEventListener("click", () => {
    let tale = null;
    tale = openTale("cranes", {
      ...HOOKS,
      // once it's a crane, it joins the thousand
      folded() {
        HOOKS.folded();
        setTimeout(() => tale?.swap("thousand"), 1600);
      },
    });
  });
  host.appendChild(sheet);
}

// The console: a command that isn't in ben.help().
function redbull() {
  addCommands([
    ["redbull", "", () => {
      found("redbull", () => openTale("redbull"));
      return "Red Bull, call me. (Ultra-endurance, not anything scary.)";
    }, { hidden: true }],
  ]);
}

let mounted = false;
/** page: the same name mountFab() gets ("home", "career", "eggs"...). */
export function mountSecrets(page) {
  if (mounted) return;
  mounted = true;
  listenKonami();
  listenCircle();
  listenFibonacci();
  listenGolden();
  listenClock();
  listenJump();
  listenIdle(page);
  redbull();
  // page elements may still be building; wait a beat
  queueMicrotask(() => {
    if (page === "career") listenLake();
    if (page === "home") campfire();
    if (page === "eggs") paper();
  });
}
