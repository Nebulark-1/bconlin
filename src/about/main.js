import { createBlueprint } from "../blueprint.js";
import { createInspector } from "../inspect/inspector.js";
import { aboutTopics } from "../inspect/topics-about.js";
import { secretsTopic, secretsChip } from "../inspect/topics-eggs.js";
import { mountFab } from "../site/fab.js";
import { onEggs, foundCount, EGGS } from "../site/eggs.js";
import { setChord, ambience, chime, PENTATONIC, setTone, audioState, soundStats } from "../site/sound.js";
import { nextChapter } from "../content.js";
import { BIO, DIVES } from "./content.js";
import { createLeading } from "./leading.js";
import { makeScene } from "./scenes.js";

// The About page: a plain bio, and between its lines, everything else.

const $ = (sel) => document.querySelector(sel);
const calm = matchMedia("(prefers-reduced-motion: reduce)");

const started = new Map(); // scene -> time it opened
const leading = createLeading($(".bio__text"), {
  bio: BIO,
  dives: DIVES,
  makeScene: (id, dive) => {
    const s = makeScene(id, dive);
    started.set(s, performance.now());
    return s;
  },
  onChange: ({ id, depth, opened }) => {
    // each gap a little lower than the one it opened from, and the room a
    // little more muffled the deeper you go
    if (opened) chime(PENTATONIC[Math.max(0, 5 - depth * 2)], 0.035, 0, 2.2);
    else chime(PENTATONIC[Math.max(0, 4 - depth * 2)] / 2, 0.02, 0, 1.4);
    const deepest = leading.stats.deepest;
    ambience({ hush: deepest ? Math.max(900, 6000 / deepest) : 18000 });
    history.replaceState(null, "", opened ? `#${id}` : location.pathname + location.search);
  },
});

// a link to #freedive opens everything above it
const fromHash = () => {
  const id = location.hash.slice(1);
  if (!DIVES[id]) return;
  const gap = leading.reveal(id);
  gap?.scrollIntoView({ block: "center", behavior: calm.matches ? "auto" : "smooth" });
};
fromHash();
window.addEventListener("hashchange", fromHash);

$("[data-email]").href = `mailto:${nextChapter.email}`;
$("[data-linkedin]").href = nextChapter.linkedin;
const secretsLink = $(".secrets-link span");
onEggs(() => (secretsLink.textContent = `${foundCount()} / ${EGGS.length} secrets`));

// ── Behind the scenes ──────────────────────────────────────
const fab = mountFab({ current: "about", blueprint: true });
const blueprint = createBlueprint(fab.blueprintButton);
const stats = { leading: leading.stats, get gaps() { return leading.gaps; } };
const inspector = createInspector($(".bp-host"), [...aboutTopics, secretsTopic(stats)], { stats });
blueprint.subscribe((on) => {
  if (!on) inspector.close();
  setTone(on);
});
onEggs(() => {
  const chip = document.querySelector('.bp-chips button[data-topic="secrets"]');
  if (chip) chip.textContent = secretsChip();
});
setChord("D");

// ── One loop for every open scene ──────────────────────────
const hud = $(".bp-hud");
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  for (const { scene } of leading.gaps) {
    if (!scene.frame) continue;
    const r = scene.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const t = (now - started.get(scene)) / 1000;
    if (calm.matches) {
      if (scene.drawn) continue;
      scene.drawn = true;
      scene.frame(scene.still ?? 4, 0);
    } else scene.frame(t, dt);
  }
  if (blueprint.on) {
    const s = leading.stats;
    const dive = leading.gaps.find((g) => g.scene.kind === "dive")?.scene.stats;
    hud.textContent = [
      `gaps open  ${s.open}   deepest ${s.deepest}`,
      `leading    +${Math.round(s.added)}px between the lines`,
      `last split ${s.last ? `after "${s.last.word}", before "${s.last.before}"` : "none yet"}`,
      `dive       ${dive ? `${Math.round(dive.depth)} ft · breath ${Math.round(dive.breath * 100)}% · rocks ${dive.rocks}` : "closed"}`,
      `sound      ${audioState()} · ${soundStats.chord}`,
    ].join("\n");
    inspector.frame(now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
