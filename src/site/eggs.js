import { chime, PENTATONIC } from "./sound.js";

// The site's secrets. Every one is listed here: where it lives, how hard it
// is to find, a hint, and the spoiler. This visitor's progress (what they've
// found, which hints and spoilers they opened, and which secrets they've
// switched off) is kept in their browser.
//
// difficulty: 1 = stumble on it, 2 = a little curiosity, 3 = you'd have to
// know where to look.

export const EGGS = [
  {
    id: "photos",
    name: "Old photos",
    page: "Home",
    difficulty: 1,
    hint: "Have you tried clicking the portrait?",
    how: "Click my portrait on the home page.",
    what: "A few more photos of me, and the rings spin with each one.",
  },
  {
    id: "snow",
    name: "Lake-effect",
    page: "Home",
    difficulty: 2,
    hint: "One of those photos was taken somewhere that gets 200+ inches of snow a year.",
    how: "Click the portrait until the Keweenaw hike photo shows.",
    what: "It snows in the margins. The snow piles up on the beads until you scroll it off.",
  },
  {
    id: "future",
    name: "Next chapter",
    page: "Home",
    difficulty: 1,
    hint: "The timeline stops at now. Does it have to?",
    how: "On the home timeline, point past the \"now\" line.",
    what: "The timeline keeps going, and asks if your team is next.",
  },
  {
    id: "strum",
    name: "Encore",
    page: "Home",
    difficulty: 2,
    hint: "Four strings. Play them like a guitar, more than once.",
    how: "Strum all four strings in one sweep, three times in a few seconds.",
    what: "The strings play you a short tune and the margins light up.",
  },
  {
    id: "hum",
    name: "Humming",
    page: "Home",
    difficulty: 1,
    hint: "Leave the home page alone for a while.",
    how: "Leave the home page untouched for about 45 seconds.",
    what: "The strings start playing themselves. They stop as soon as you're back.",
  },
  {
    id: "constellations",
    name: "Constellations",
    page: "Margins",
    difficulty: 2,
    hint: "Watch the beads in the margins for a bit.",
    how: "On a wide screen, wait for two beads on the same side to ring at almost the same time. Twice.",
    what: "Beads that ring together get joined by a line. Stay a while and you get constellations.",
  },
  {
    id: "studio",
    name: "Studio mode",
    page: "Everywhere",
    difficulty: 2,
    hint: "The sound button does more than on and off.",
    how: "Press and hold the sound button, bottom right.",
    what: "A mixer for every sound on the site.",
  },
  {
    id: "scratch",
    name: "Scratch",
    page: "Everywhere",
    difficulty: 2,
    hint: "The ring around the menu button looks a bit like a record.",
    how: "Grab the BC button, bottom right, and drag around it in a full circle.",
    what: "Scratch it like a record and the music bends.",
  },
  {
    id: "console",
    name: "Backstage pass",
    page: "Everywhere",
    difficulty: 3,
    hint: "Open your browser's developer tools (F12, or right-click and Inspect).",
    how: "Open the console in your developer tools and type ben.help().",
    what: "A little console API full of toys. Try ben.doabarrelroll().",
  },
];

const KEY = "bc-eggs";
const blank = () => ({ found: {}, hint: {}, spoiler: {}, off: {} });
let state = load();
const listeners = new Set();

function load() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not remembered; fine
  }
  listeners.forEach((fn) => fn(state));
}

// another tab found one: keep in step
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  state = load();
  listeners.forEach((fn) => fn(state));
});

export const egg = (id) => EGGS.find((e) => e.id === id);
export const isFound = (id) => !!state.found[id];
/** When the secret was found (ms since 1970), or 0. */
export const foundAt = (id) => state.found[id] || 0;
/** A secret works unless the visitor has switched it off. */
export const isOn = (id) => !state.off[id];
export const foundCount = () => EGGS.filter((e) => state.found[e.id]).length;
export const usedHint = (id) => !!state.hint[id];
export const usedSpoiler = (id) => !!state.spoiler[id];

export function setOn(id, on) {
  if (on) delete state.off[id];
  else state.off[id] = true;
  save();
}

export function markHint(id) {
  if (state.hint[id]) return;
  state.hint[id] = true;
  save();
}

export function markSpoiler(id) {
  if (state.spoiler[id]) return;
  state.spoiler[id] = true;
  save();
}

export function resetEggs() {
  state = blank();
  save();
}

/** fn(state) now and whenever progress changes. */
export function onEggs(fn) {
  listeners.add(fn);
  fn(state);
}

/** The visitor found a secret. Only the first time counts. */
export function discover(id) {
  if (state.found[id] || !egg(id)) return false;
  state.found[id] = Date.now();
  save();
  announce(egg(id));
  return true;
}

// A small note near the circles, and a rising chime.
let toast = null;
let toastTimer = 0;
function announce(e) {
  if (!toast) {
    toast = document.createElement("a");
    toast.className = "egg-toast";
    toast.href = "eggs.html";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <span class="egg-toast__spark" aria-hidden="true"></span>
    <span class="egg-toast__text">
      <small>Secret found · ${foundCount()} of ${EGGS.length}</small>
      <b>${e.name}</b>
    </span>`;
  toast.classList.remove("is-on");
  void toast.offsetWidth;
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-on"), 5200);
  [0, 2, 4, 5].forEach((n, k) => setTimeout(() => chime(PENTATONIC[n], 0.03, 0.3, 2.4), k * 110));
}
