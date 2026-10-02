import { discover, EGGS, isFound, foundCount } from "./eggs.js";
import { setChord, CHORDS, chime, PENTATONIC, gust, setMix, getMix, isSoundOn } from "./sound.js";

// window.ben: a small console API for whoever opens the developer tools.
// Every page gets the commands below; pages add their own with
// addCommands() (the home page's strings, the margins' rain and snow).

let commands = new Map(); // name → { call, help, fn }

/** Add commands: [[name, help, fn], ...]. A name can show its inputs, like "pluck(n)". */
export function addCommands(list, first = false) {
  const added = new Map(
    list.map(([name, help, fn]) => {
      const key = name.split("(")[0];
      return [key, { call: `ben.${name.includes("(") ? name : `${name}()`}`, help, fn }];
    }),
  );
  commands = first ? new Map([...added, ...commands]) : new Map([...commands, ...added]);
  window.ben = Object.fromEntries(
    [...commands].map(([name, { fn }]) => [
      name,
      (...args) => {
        discover("console");
        return fn(...args);
      },
    ]),
  );
}

export const soundNote = () => !isSoundOn() && console.info("(sound's off, so this one's silent. Turn it on bottom right.)");

const FACTS = [
  "I finished an Ironman in 2026.",
  "I ran Division I cross country and track at BYU, then Division II at Michigan Tech.",
  "Houghton gets 200+ inches of snow a year. I loved every inch.",
  "I've freedived to 80 feet to chase a rock I thought was cool.",
  "I coached 50+ high school cross country runners as a volunteer. Every one of them set a personal best.",
  "I can watch my fish for hours.",
  "I've taken ice baths in Lake Superior.",
  "I drafted Michigan Tech's AI policy as the only student on its AI Working Group.",
  "I was Michigan Tech's Student Body President.",
];

/** A wash of northern lights over the whole page, for a little while. */
function aurora() {
  if (document.querySelector(".aurora-veil")) return "already glowing";
  const veil = document.createElement("div");
  veil.className = "aurora-veil";
  veil.setAttribute("aria-hidden", "true");
  veil.innerHTML = "<i></i><i></i><i></i>";
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("is-on"));
  [2, 4, 5, 7].forEach((n, k) => setTimeout(() => chime(PENTATONIC[n] / 2, 0.03, k % 2 ? 0.5 : -0.5, 4), k * 600));
  setTimeout(() => veil.classList.remove("is-on"), 16000);
  setTimeout(() => veil.remove(), 19000);
  return "look up";
}

/** The whole page does a barrel roll. */
function barrelRoll() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return "your system asks for less motion, so no barrel roll. Sorry.";
  document.documentElement.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], {
    duration: 1300,
    easing: "cubic-bezier(0.6, 0, 0.3, 1)",
  });
  PENTATONIC.forEach((f, k) => setTimeout(() => chime(f, 0.03, (k / 3.5) - 1, 1.2), k * 90));
  return "wheee";
}

const BASE = [
  ["help", "everything you can do here", () => {
    // printed as a message, so the lines break (a returned string shows "\n")
    const rows = [...commands.values()].map(({ call, help }) => [call, help]);
    const width = Math.max(...rows.map(([c]) => c.length)) + 3;
    console.log(rows.map(([c, h]) => c.padEnd(width) + h).join("\n"));
  }],
  ["doabarrelroll", "you know what this does", barrelRoll],
  ["aurora", "northern lights, briefly", aurora],
  ["gust", "a gust of wind", () => {
    soundNote();
    gust(0.95, 4);
    return "whoosh";
  }],
  ["chord(name)", `change the background chord: ${Object.keys(CHORDS).join(", ")}`, (name = "A") => {
    if (!CHORDS[name]) return `try one of: ${Object.keys(CHORDS).join(", ")}`;
    soundNote();
    setChord(name);
    return `now on ${name}`;
  }],
  ["volume(n)", "set the volume, 0 to 1.5 (1 is normal)", (v) => {
    if (v === undefined) return getMix("master");
    setMix("master", Math.max(0, Math.min(1.5, Number(v) || 0)));
    return getMix("master");
  }],
  ["fact", "something true about me", () => FACTS[Math.floor(Math.random() * FACTS.length)]],
  ["secrets", "what you've found so far", () => {
    const lines = EGGS.map((e) => `${isFound(e.id) ? "✦" : "·"} ${isFound(e.id) ? e.name : "???"}  (${e.page})`);
    console.log([`${foundCount()} of ${EGGS.length} found`, ...lines].join("\n"));
  }],
  ["hire", "write me an email (I've started it for you)", () => {
    window.location.href = "resume.html?hire";
    return "one moment";
  }],
];

let installed = false;
/** Set up window.ben with the everyday commands, once per page. */
export function installConsole() {
  if (installed) return;
  installed = true;
  // the everyday commands lead the list, whatever the page added already
  addCommands(BASE, true);
  const c = ["#a99bff", "#ff8a7a", "#39ff88", "#ff4da6"];
  console.log(
    `%c─────────────\n%c─────────────\n%c─────────────\n%c─────────────\n%cHey, you found the console. Try ben.help()`,
    ...c.map((col) => `color:${col};font-weight:bold`),
    "color:#ece8ff;font:500 12px monospace;padding-top:6px",
  );
}
