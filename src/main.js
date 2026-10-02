import { createDirector, glideTo } from "./engine/scroll.js";
import { range, easeOutCubic } from "./engine/math.js";
import * as houghtonMod from "./scenes/houghton/index.js";
import * as blgMod from "./scenes/blg/index.js";
import * as uchMod from "./scenes/uch/index.js";
import * as chaosMod from "./scenes/chaos/index.js";
import { createTimeline } from "./timeline.js";
import { chapters, nextChapter } from "./content.js";
import { createBlueprint } from "./blueprint.js";
import { mountFab } from "./site/fab.js";

const director = createDirector();
const fab = mountFab({ current: "career", blueprint: true });
const blueprint = createBlueprint(document.querySelector(".bts"), fab.blueprintButton);
const $ = (sel) => document.querySelector(sel);

// Prologue: the quote (or behind the scenes, the thesis) drifts up and
// dissolves into the dark.
const intro = $('[data-scene="intro"]');
director.add(intro, {
  update(p) {
    const t = range(p, 0.2, 0.9);
    intro.style.setProperty("--intro-opacity", 1 - t);
    intro.style.setProperty("--intro-shift", `${-t * 50}px`);
    intro.style.setProperty("--intro-blur", `${t * 6}px`);
  },
});

// Chapters with a scene: which element, which module, which content.
const scenes = [
  { id: "houghton", mod: houghtonMod, create: houghtonMod.houghtonScene },
  { id: "law", mod: blgMod, create: blgMod.blgScene },
  { id: "uchealth", mod: uchMod, create: uchMod.uchScene },
  { id: "chaos", mod: chaosMod, create: chaosMod.chaosScene },
].map((s) => {
  const el = $(`[data-scene="${s.id}"]`);
  const chapter = chapters.find((c) => c.id === s.id);
  const ctl = s.create(el, chapter, blueprint);
  director.add(el, ctl);
  return { ...s, el, chapter, ctl, stop: chapters.indexOf(chapter) + 1 };
});

// The last stop: what I'm looking for, and how to reach me.
const outro = $('[data-scene="outro"]');
outro.querySelector(".next__kicker").textContent = nextChapter.label;
outro.querySelector(".next__pitch").textContent = nextChapter.pitch;
outro.querySelector(".next__looking").textContent = nextChapter.looking;
outro.querySelector("[data-email]").href = `mailto:${nextChapter.email}`;
outro.querySelector("[data-linkedin]").href = nextChapter.linkedin;
director.add(outro, {
  update(p) {
    const t = easeOutCubic(range(p, 0.05, 0.5));
    outro.style.setProperty("--next-opacity", t);
    outro.style.setProperty("--next-shift", `${(1 - t) * 24}px`);
  },
});

// ── Timeline rail ────────────────────────────────────────────
const pageY = (el) => el.getBoundingClientRect().top + window.scrollY;
const track = (el) => el.offsetHeight - window.innerHeight;
// scroll position at fraction h of a scene's hold (0 = its first card)
const holdAt = (s, h) => pageY(s.el) + track(s.el) * (s.mod.ENTER_END + (s.mod.EXIT_START - s.mod.ENTER_END) * h);
const sceneFor = (id) => scenes.find((s) => s.id === id);

const stops = [
  { label: "Prologue", when: "start", target: () => 0 },
  ...chapters.map((c) => {
    const s = sceneFor(c.id);
    if (!s) return { label: c.label, when: c.when };
    const n = c.cards.length;
    return {
      label: c.label,
      when: c.when,
      target: () => holdAt(s, 0.01),
      // one sub-stop per card, landing a little into its beat
      subs: c.cards.map((card, j) => ({ label: card.title, target: () => holdAt(s, (j + 0.3) / n) })),
    };
  }),
  { label: nextChapter.label, when: nextChapter.when, target: () => pageY(outro) + track(outro) * 0.6 },
];

// Scroll → rail position: each chapter dot as its scene opens, each sub-stop
// exactly as its card arrives. After the last built chapter the marker eases
// on but stops short of chapters that don't exist yet.
const timeline = createTimeline(
  $(".rail"),
  stops,
  (pos) => {
    const map = [[0, pos(0)]];
    for (const s of scenes) {
      const n = s.chapter.cards.length;
      map.push([pageY(s.el), s.stop - 0.12]);
      map.push([pageY(s.el) + track(s.el) * s.mod.ENTER_END * 0.6, s.stop]);
      s.chapter.cards.forEach((_, j) => map.push([holdAt(s, j / n), pos(s.stop, j)]));
      map.push([holdAt(s, 1), pos(s.stop, n - 1) + 0.06]);
    }
    // then on to the last stop as the closing section settles in
    const last = stops.length - 1;
    map.push([pageY(outro) + track(outro) * 0.6, last]);
    map.push([document.documentElement.scrollHeight - window.innerHeight, last]);
    return map;
  },
  () => {
    // only a scene that's on screen right now (a scene keeps its last card
    // after you scroll past it)
    const y = window.scrollY;
    for (const s of scenes) {
      const top = pageY(s.el);
      if (y >= top && y < top + track(s.el) && s.ctl.card >= 0) return { stop: s.stop, sub: s.ctl.card };
    }
    return null;
  },
);
director.onFrame(timeline.update);

director.start();

// Deep links from the home page (career.html#law): open on that chapter's
// first card once layout has settled. The browser mustn't restore an old
// scroll position over it.
const linked = () => sceneFor(location.hash.slice(1));
if (linked()) history.scrollRestoration = "manual";
window.addEventListener("load", () => {
  const s = linked();
  if (s) window.scrollTo(0, holdAt(s, 0.01));
});
window.addEventListener("hashchange", () => {
  const s = linked();
  if (s) glideTo(holdAt(s, 0.01));
});
