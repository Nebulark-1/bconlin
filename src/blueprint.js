const KEY = "bc-blueprint";

/**
 * The "Behind the scenes" switch. Flips <html data-blueprint="on|off"> for
 * CSS, remembers the choice for this visitor, and notifies subscribers
 * (scenes switch their canvases to debug drawing and explode their layers).
 * Any number of buttons can drive it (the rail's switch and the floating
 * one); they all stay in step.
 */
export function createBlueprint(...given) {
  const buttons = given.filter(Boolean);
  let on = false;
  try {
    on = localStorage.getItem(KEY) === "on";
  } catch {
    // storage unavailable (private mode etc.) - just start off
  }
  const listeners = new Set();

  const apply = () => {
    document.documentElement.dataset.blueprint = on ? "on" : "off";
    buttons.forEach((b) => b.setAttribute("aria-checked", String(on)));
    listeners.forEach((fn) => fn(on));
  };

  const flip = () => {
    on = !on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // not persisted; fine
    }
    wipe(on, apply);
  };
  buttons.forEach((b) => b.addEventListener("click", flip));

  apply();
  return {
    get on() {
      return on;
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(on);
    },
  };
}

/**
 * The switch itself: the page changes at once, and a glowing line sweeps
 * down the screen over it (up, when turning it off). The line is one small
 * element sliding, which the graphics card does on its own, so it costs
 * the page nothing.
 */
const WIPE_MS = 650;
let bar = null;
function wipe(turningOn, update) {
  update();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "bp-wipe";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
  }
  const h = window.innerHeight;
  bar.animate(
    {
      transform: turningOn ? ["translateY(0)", `translateY(${h}px)`] : [`translateY(${h}px)`, "translateY(0)"],
      opacity: [1, 1, 0],
    },
    { duration: WIPE_MS, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
  );
}
