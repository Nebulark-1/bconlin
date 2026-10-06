// One inspector topic per secret. A topic only appears (in "Behind the
// scenes" and on the secrets page) once its secret has been found.

import secretsSrc from "../home/secrets.js?raw";
import rainSrc from "../site/rain.js?raw";
import soundSrc from "../site/sound.js?raw";
import fabSrc from "../site/fab.js?raw";
import consoleSrc from "../site/console.js?raw";
import scenesSrc from "../secrets/scenes.js?raw";
import secretsIndexSrc from "../secrets/index.js?raw";
import patternsSrc from "../secrets/patterns.js?raw";
import effectsSrc from "../secrets/effects.js?raw";
import { egg, EGGS, isFound, foundCount } from "../site/eggs.js";

const C = { text: "#bfe6ff", dim: "rgba(160,200,240,.45)", gold: "#ffe2c4" };

const SOURCES = {
  photos: [{ file: "src/home/secrets.js", src: secretsSrc, name: "cyclePhoto" }],
  snow: [{ file: "src/site/rain.js", src: rainSrc, name: "collide", marks: ["m.flake"] }],
  future: [{ file: "src/home/secrets.js", src: secretsSrc, name: "FUTURE" }],
  strum: [
    { file: "src/home/secrets.js", src: secretsSrc, name: "detectStrum" },
    { file: "src/home/secrets.js", src: secretsSrc, name: "playEncore" },
  ],
  hum: [
    { file: "src/home/secrets.js", src: secretsSrc, name: "hum" },
    { file: "src/home/secrets.js", src: secretsSrc, name: "wake" },
  ],
  constellations: [{ file: "src/site/rain.js", src: rainSrc, name: "constellate" }],
  studio: [
    { file: "src/site/sound.js", src: soundSrc, name: "setMix" },
    { file: "src/site/sound.js", src: soundSrc, name: "level" },
  ],
  scratch: [
    { file: "src/site/fab.js", src: fabSrc, name: "scratch" },
    { file: "src/site/sound.js", src: soundSrc, name: "bend" },
  ],
  console: [
    { file: "src/site/console.js", src: consoleSrc, name: "addCommands" },
    { file: "src/site/console.js", src: consoleSrc, name: "barrelRoll" },
  ],
  door: [
    { file: "src/site/fab.js", src: fabSrc, name: "secretsInNav" },
  ],
  dive: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "listenLake" },
    { file: "src/secrets/scenes.js", src: scenesSrc, name: "dive" },
  ],
  breath: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "HOOKS" },
    { file: "src/secrets/scenes.js", src: scenesSrc, name: "dive" },
  ],
  cranes: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "HOOKS" },
    { file: "src/secrets/scenes.js", src: scenesSrc, name: "thousand" },
  ],
  herman: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "campfire" },
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "isNight" },
  ],
  tanks: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "listenIdle" },
    { file: "src/secrets/scenes.js", src: scenesSrc, name: "tanks" },
  ],
  jump: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "listenJump" },
    { file: "src/secrets/scenes.js", src: scenesSrc, name: "jump" },
  ],
  redbull: [
    { file: "src/secrets/index.js", src: secretsIndexSrc, name: "redbull" },
  ],
  konami: [
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "konami" },
    { file: "src/secrets/effects.js", src: effectsSrc, name: "eightBit" },
  ],
  pi: [
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "circleFrom" },
    { file: "src/secrets/effects.js", src: effectsSrc, name: "unrollPi" },
  ],
  fibonacci: [
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "fibonacciRhythm" },
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "fibonacciSquares" },
  ],
  golden: [
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "isGolden" },
    { file: "src/secrets/effects.js", src: effectsSrc, name: "goldenWindow" },
  ],
  wish: [
    { file: "src/secrets/patterns.js", src: patternsSrc, name: "isElevenEleven" },
    { file: "src/secrets/effects.js", src: effectsSrc, name: "shootingStar" },
  ],
};

// the card art for every secret: a four-point star and when you found it
function viz(ctx, w, h, t, S, id) {
  const cx = w / 2;
  const cy = h / 2 - 8;
  const r = 22 + Math.sin(t * 2) * 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 0.8) * 0.2);
  ctx.fillStyle = C.gold;
  ctx.shadowColor = "#ffd2a0";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const rr = k % 2 ? r * 0.28 : r;
    const a = (k * Math.PI) / 4 - Math.PI / 2;
    k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.dim;
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`secret ${EGGS.findIndex((e) => e.id === id) + 1} of ${EGGS.length}`, cx, h - 10);
  ctx.textAlign = "left";
}

export const eggTopics = EGGS.map((e) => ({
  id: e.id,
  chip: `✦ ${e.name}`,
  kicker: "A secret you found",
  provenance: "site",
  vizHeight: 100,
  title: e.name,
  summary: `${e.what} <br><br><b>How it's found:</b> ${e.how}`,
  sources: SOURCES[e.id],
  viz: (ctx, w, h, t, S) => viz(ctx, w, h, t, S, e.id),
  live: () => [isFound(e.id) ? "found" : "not found yet"],
}));

export const topicFor = (id) => eggTopics.find((t) => t.id === id) || null;

/**
 * One inspector chip for every secret: pick any you've found to see how it
 * was found, what it does, and the code behind it. The list is read fresh
 * each time the panel draws, so a secret found mid-visit appears at once.
 */
export const secretsChip = () => `✦ Secrets ${foundCount()}/${EGGS.length}`;

export function secretsTopic(stats) {
  stats.secret = EGGS.find((e) => isFound(e.id))?.id || null;
  const pick = (S) => (S.secret ? egg(S.secret) : null);
  return {
    id: "secrets",
    chip: secretsChip(),
    kicker: "Secrets you've found",
    provenance: "site",
    vizHeight: 100,
    title: (S) => pick(S)?.name || "Secrets",
    summary: (S) => {
      const e = pick(S);
      if (!e) return `None found yet. <a href="eggs.html">Want a hint?</a>`;
      return `<b>How it's found:</b> ${e.how}<br><br><b>What it does:</b> ${e.what}`;
    },
    sources: (S) => (S.secret ? SOURCES[S.secret] : []),
    key: (S) => S.secret || "",
    get actions() {
      return EGGS.filter((e) => isFound(e.id)).map((e) => ({
        label: e.name,
        run: (scene) => (scene.stats.secret = e.id),
        isOn: (S) => S.secret === e.id,
        reopen: true,
      }));
    },
    viz: (ctx, w, h, t, S) => (S.secret ? viz(ctx, w, h, t, S, S.secret) : null),
    live: () => [`${foundCount()} of ${EGGS.length} found`],
  };
}
export { egg };
