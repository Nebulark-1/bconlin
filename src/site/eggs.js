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
  {
    id: "door",
    name: "The door",
    page: "Secrets",
    difficulty: 1,
    hint: "There's a small link at the very bottom of the home page.",
    how: "Open the secrets page.",
    what: "Secrets gets its own spot in the top bar on every page.",
  },
  {
    id: "dive",
    name: "Eighty feet",
    page: "Career",
    difficulty: 2,
    hint: "Michigan Tech sits on a canal that runs out to Lake Superior. Have you tried getting in the water?",
    how: "In the Michigan Tech chapter, press and hold on the canal's water.",
    what: "You go under. A diver follows your pointer and sinks as long as you hold, past the line's 10-foot tags, down to a bottom scattered with stones at 80 feet. Steer onto one to pick it up. I really did chase a rock to 80 feet in Lake Superior. It was just a rock.",
  },
  {
    id: "yooper",
    name: "Yooperlite",
    page: "Career",
    difficulty: 3,
    hint: "Found the dive? Some rocks on the bottom of Lake Superior glow. Keep picking them up.",
    how: "In the dive, bring up the one stone that glows once it's in your hand. It's a different stone every dive, and it looks like all the others until you hold it.",
    what: "A Yooperlite: a Lake Superior rock that glows orange under UV light. Unlit, it looks like any other rock.",
  },
  {
    id: "breath",
    name: "One breath",
    page: "Career",
    difficulty: 2,
    hint: "Found the dive? Stay down until you're nearly out of air, but not out.",
    how: "In the dive, come back up with less than a tenth of your breath left, without running out.",
    what: "Your longest breath hold is timed, and shown each time you surface.",
  },
  {
    id: "cranes",
    name: "A thousand cranes",
    page: "Secrets",
    difficulty: 1,
    hint: "There's a square of paper on the secrets page. What could it be?",
    how: "Click the square of paper on the secrets page, one fold per click, until it's a crane.",
    what: "It folds into a crane right where it sits, then flies off into your stars. Every crane is counted. I once folded a thousand.",
  },
  {
    id: "herman",
    name: "Mount Herman",
    page: "Home",
    difficulty: 2,
    hint: "Come back to the home page after dark.",
    how: "Between 9 pm and 5 am your time, click the campfire at the bottom of the home page.",
    what: "The fire comes up, embers rise, and snow falls over the whole page: a night like the ones I spent in the shelter I built on Mount Herman.",
  },
  {
    id: "tanks",
    name: "Fish tank",
    page: "Everywhere but home",
    difficulty: 1,
    hint: "I can watch my fish for hours. Can you sit still for one minute?",
    how: "Leave any page other than home untouched for a minute.",
    what: "Water fills the bottom of the screen, with my cherry shrimp, blue dreams, pea puffer and betta. Move and it drains.",
  },
  {
    id: "space",
    name: "Escape velocity",
    page: "Home",
    difficulty: 2,
    hint: "Already at the top of the home page? Keep going up. Then keep going.",
    how: "At the very top of the home page, keep scrolling up (on a phone, keep pulling down) until the sky opens.",
    what: "There's a sky above the home page: my one skydive, Pikes Peak, the edge of space, the space station, and the Moon.",
  },
  {
    id: "konami",
    name: "Up, up, down, down",
    page: "Everywhere",
    difficulty: 2,
    hint: "↑ ↑ ↓ ↓ ← → ← → B A",
    how: "Press the Konami code on any page.",
    what: "Eight-bit mode, for a little while.",
  },
  {
    id: "golden",
    name: "Golden window",
    page: "Everywhere",
    difficulty: 3,
    hint: "Resize your browser window. Some shapes are more golden than others.",
    how: "Resize the window until its width divided by its height (or the other way) is within 1% of 1.618.",
    what: "The window shows the golden squares it's made of.",
  },
  {
    id: "wish",
    name: "11:11",
    page: "Everywhere",
    difficulty: 2,
    hint: "Be here at a lucky minute.",
    how: "Have any page open at 11:11, morning or night.",
    what: "A shooting star. Make a wish.",
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
