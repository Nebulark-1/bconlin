const KEY = "bc-blueprint";

/**
 * The "Behind the scenes" switch. Flips <html data-blueprint="on|off"> for
 * CSS, remembers the choice for this visitor, and notifies subscribers
 * (scenes switch their canvases to debug drawing and explode their layers).
 */
export function createBlueprint(button) {
  let on = false;
  try {
    on = localStorage.getItem(KEY) === "on";
  } catch {
    // storage unavailable (private mode etc.) - just start off
  }
  const listeners = new Set();

  const apply = () => {
    document.documentElement.dataset.blueprint = on ? "on" : "off";
    button.setAttribute("aria-checked", String(on));
    listeners.forEach((fn) => fn(on));
  };

  button.addEventListener("click", () => {
    on = !on;
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      // not persisted; fine
    }
    // a one-shot scan line sweeps the scene as it switches
    document.documentElement.classList.remove("bp-scan");
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add("bp-scan");
    apply();
  });

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
