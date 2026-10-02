import { discover, isOn } from "../site/eggs.js";
import { pluck, breeze, CHORDS } from "../site/sound.js";
import { addCommands, soundNote } from "../site/console.js";

// The home page's secrets. Each is a small function, so the inspector can
// show exactly the code behind one once it's been found.

export const PHOTOS = [
  { src: "photos/headshot-studio.png", alt: "Ben Conlin" },
  { src: "photos/portrait-red-rocks.png", alt: "Ben at Red Rocks" },
  { src: "photos/portrait-summer-hat.png", alt: "Ben in a summer hat" },
  { src: "photos/portrait-keweenaw-hike.png", alt: "Ben on a hike in the Keweenaw", snow: true },
];

/**
 * Old photos: each click on the portrait fades to the next photo, spins
 * the rings like a dial and plucks a note. On the Keweenaw photo, it snows.
 */
export function cyclePhoto(s, img, rain) {
  if (!isOn("photos")) return;
  s.photo = (s.photo + 1) % PHOTOS.length;
  const next = PHOTOS[s.photo];
  img.classList.add("is-swapping");
  setTimeout(() => {
    img.src = next.src;
    img.alt = next.alt;
    img.onload = () => img.classList.remove("is-swapping");
  }, 180);
  s.spinVel += 7;
  pluck(CHORDS.A.strings[s.photo], 0.5, 0.3);
  discover("photos");
  const snow = !!next.snow && isOn("snow");
  rain.setSnow(snow);
  if (snow) discover("snow");
}

/**
 * Encore: a strum is all four strings plucked in one sweep (in order, one
 * way or the other) within half a second. Three strums inside five seconds
 * and the strings play a tune.
 */
export function detectStrum(s, string, now, encore) {
  if (!isOn("strum")) return;
  s.plucks = [...s.plucks.filter((p) => now - p.t < 500), { string, t: now }];
  const last = s.plucks.slice(-4).map((p) => p.string);
  const up = last.join() === "0,1,2,3";
  const down = last.join() === "3,2,1,0";
  if (!up && !down) return;
  s.plucks = [];
  s.strums = [...s.strums.filter((t) => now - t < 5000), now];
  if (s.strums.length >= 3) {
    s.strums = [];
    encore();
  }
}

// a short tune in A major: [when in ms, frequency, which string moves]
const TUNE = [
  [0, 220, 0], [170, 277.18, 1], [340, 329.63, 2], [510, 440, 3],
  [850, 493.88, 3], [1020, 440, 2], [1190, 329.63, 1],
  [1530, 369.99, 2], [1700, 329.63, 1], [1870, 277.18, 0],
  [2300, 110, 0], [2340, 164.81, 1], [2380, 220, 2], [2420, 277.18, 3],
];

/** The encore itself: the tune, each note shaking its string, and every bead lighting in turn. */
export function playEncore(field, rain) {
  for (const [at, freq, string] of TUNE) {
    setTimeout(() => {
      pluck(freq, 0.55, string / 1.5 - 1);
      field.pluckString(string, 0.5, false);
    }, at);
  }
  rain.flareAll();
  discover("strum");
}

/**
 * Humming: after 45 seconds with no input, the strings pluck themselves
 * softly every few seconds and a breeze rises. Any input stops it; coming
 * back to it humming finds the secret.
 */
export function hum(s, field, now) {
  const forced = now < (s.forceHumUntil || 0);
  const idle = (forced || (now - s.lastInput > 45000 && isOn("hum"))) && !document.hidden && field.isStrings();
  if (!idle) {
    if (s.humming) breeze(0);
    s.humming = false;
    return;
  }
  if (!s.humming) {
    s.humming = true;
    s.nextHum = now + 800;
    breeze(0.3);
  }
  if (now < s.nextHum) return;
  const string = Math.floor(Math.random() * 4);
  field.pluckString(string, 0.15 + Math.random() * 0.3);
  if (Math.random() < 0.3) setTimeout(() => field.pluckString((string + 2) % 4, 0.2), 320);
  s.hummed++;
  s.nextHum = now + 2200 + Math.random() * 4200;
}

/** Called on any input: stops the humming, and counts it if you heard some. */
export function wake(s, now) {
  if (s.humming && s.hummed > 0) discover("hum");
  s.lastInput = now;
}

/** Next chapter: the timeline's last era, past now. */
export const FUTURE = {
  when: "Next",
  text: "Your team?\nI'm looking for software engineering, data, and solutions roles.",
  ids: [],
  email: true,
};

/**
 * Backstage pass: the home page's own console commands, on top of the ones
 * every page has (see src/site/console.js).
 */
export function consoleApi({ field, rain, encore, secret }) {
  addCommands([
    ["pluck(n)", "pluck string n (0 to 3)", (n = 0) => {
      soundNote();
      const string = Math.max(0, Math.min(3, n | 0));
      field.pluckString(string, 0.6);
      return `string ${string}`;
    }],
    ["strum", "the encore", () => {
      soundNote();
      encore();
      return "♪";
    }],
    ["humming", "let the strings play themselves for a while", () => {
      soundNote();
      secret.forceHumUntil = performance.now() + 25000;
      return "humming for a bit";
    }],
    ["drop", "let go of the strings", () => {
      soundNote();
      for (const p of field.pts) p.vy += 1100 * (1 - p.dot) * (0.6 + Math.random() * 0.4);
      [0, 1, 2, 3].forEach((k) => setTimeout(() => field.pluckString(k, 0.4), k * 80));
      return "boing";
    }],
    ["snow(on)", "start or stop the snow", (on = true) => {
      rain.setSnow(on);
      return rain.stats.enabled ? (on ? "snowing" : "stopped") : "make the window wider to see it";
    }],
    ["rain", "a quick downpour in the margins", () => (rain.burst() ? "pitter patter" : "make the window wider to see it")],
  ]);
}
