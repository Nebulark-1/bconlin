import "../styles/secrets.css";
import { discover, isOn } from "../site/eggs.js";
import { konami, isGolden, isElevenEleven } from "./patterns.js";
import { goldenWindow, eightBit, shootingStar } from "./effects.js";
import { mountSpace } from "./space.js";
import { mountLake } from "./lake.js";
import { mountFlood } from "./flood.js";
import { mountCrane } from "./crane.js";
import { mountCampfire } from "./campfire.js";

// The secrets that live everywhere, plus a few that belong to one page.
// Every page mounts these through mountFab(). No secret here is typed:
// they're clicks, holds, scrolling, idling, the time of day, the window's
// shape, and one famous button combo.

/** Found it: count it, and (unless it's switched off) do its thing. */
const found = (id, effect) => {
  discover(id);
  if (isOn(id)) effect?.();
};

// ── ↑ ↑ ↓ ↓ ← → ← → B A ────────────────────────────────────
function listenKonami() {
  const feed = konami();
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    if (feed(e.key)) found("konami", () => eightBit());
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

let mounted = false;
/** page: the same name mountFab() gets ("home", "career", "eggs"...). */
export function mountSecrets(page) {
  if (mounted) return;
  mounted = true;
  listenKonami();
  listenGolden();
  listenClock();
  // sit still anywhere but home (which hums) and the water rises
  if (page !== "home") mountFlood();
  // page elements may still be building; wait a beat
  queueMicrotask(() => {
    if (page === "career") mountLake();
    if (page === "home") {
      mountCampfire();
      mountSpace();
    }
    if (page === "eggs") mountCrane();
  });
}
