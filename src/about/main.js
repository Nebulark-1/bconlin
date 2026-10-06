import { createBlueprint } from "../blueprint.js";
import { createInspector } from "../inspect/inspector.js";
import { aboutTopics } from "../inspect/topics-about.js";
import { secretsTopic, secretsChip } from "../inspect/topics-eggs.js";
import { mountFab } from "../site/fab.js";
import { onEggs, foundCount, EGGS, discover, isFound, isOn } from "../site/eggs.js";
import { setChord, chime, pluck, PENTATONIC, setTone, audioState, soundStats } from "../site/sound.js";
import { nextChapter } from "../content.js";
import { BIO, THREADS, POINTS } from "./content.js";
import { createMap } from "./threads.js";
import { makeScene } from "./scenes.js";

// The About page: a short bio, then a map of the things I love, tied
// together by threads.

const $ = (sel, root = document) => root.querySelector(sel);
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const THREAD = Object.fromEntries(THREADS.map((t) => [t.id, t]));
const POINT = Object.fromEntries(POINTS.map((p) => [p.id, p]));

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** Copy to HTML: links, and TODO placeholders that stand out until filled in. */
const rich = (text) =>
  esc(text)
    .replace(/\[\[TODO:\s*([^\]]+)\]\]/g, '<mark class="todo">TODO: $1</mark>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
      `<a class="lnk" href="${href}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`,
    );

$(".bio__text").innerHTML = BIO.map((p) => `<p>${rich(p)}</p>`).join("");
$("[data-email]").href = `mailto:${nextChapter.email}`;
$("[data-linkedin]").href = nextChapter.linkedin;
const secretsLink = $(".secrets-link span");
onEggs(() => (secretsLink.textContent = `${foundCount()} / ${EGGS.length} secrets`));

// ── Secrets on this page ───────────────────────────────────
// Both keep their numbers in this visitor's browser.
const remember = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const keep = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not remembered; fine
  }
};
const HOOKS = {
  // every crane folded to the last step counts; the first finds the secret
  folded() {
    keep("bc-cranes", remember("bc-cranes") + 1);
    discover("cranes");
  },
  mine: () => (isFound("cranes") && isOn("cranes") ? remember("bc-cranes") : 0),
  // surfacing with almost no air left, but some
  breath(seconds) {
    if (seconds > remember("bc-breath")) keep("bc-breath", seconds.toFixed(1));
    discover("breath");
  },
  best: () => (isFound("breath") && isOn("breath") ? remember("bc-breath") : 0),
};

// ── The threads and the story panel ────────────────────────
const chips = $(".weave__threads");
chips.innerHTML = THREADS.map(
  (t) => `<button type="button" class="chip" data-thread="${t.id}" aria-pressed="false" style="--c:${t.color}"><i aria-hidden="true"></i>${t.name}</button>`,
).join("");
const story = $(".story");
let scene = null;
let sceneAt = 0;

const map = createMap($(".weave__map"), {
  threads: THREADS,
  points: POINTS,
  onThread: (id) => pickThread(map.state.thread === id && !map.state.point ? null : id),
  onPoint: (id) => pickPoint(map.state.point === id ? null : id),
  // each point on a thread rings out in turn, low to high
  pluck: (k, n) => pluck(PENTATONIC[k % PENTATONIC.length] / 2, 0.55, (k / Math.max(1, n - 1)) * 1.4 - 0.7),
});

function show(html) {
  scene?.stop?.();
  scene = null;
  story.innerHTML = html;
  story.classList.remove("is-new");
  void story.offsetWidth;
  story.classList.add("is-new");
}

function pickThread(id, { quiet = false } = {}) {
  map.setThread(id);
  map.setPoint(null);
  chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.thread === id)));
  if (!id) {
    show(`<p class="story__lede">${POINTS.length} things, ${THREADS.length} threads.</p>`);
  } else {
    const t = THREAD[id];
    const members = POINTS.filter((p) => p.threads.includes(id));
    show(`
      <h2 class="story__title" style="--c:${t.color}">${t.name}</h2>
      <p>${rich(t.text)}</p>
      <ul class="story__members">${members.map((p) => `<li><button type="button" class="chip chip--point" data-point="${p.id}" style="--c:${t.color}">${p.name}</button></li>`).join("")}</ul>`);
  }
  if (!quiet) history.replaceState(null, "", id ? `#${id}` : location.pathname + location.search);
}

function pickPoint(id, { quiet = false } = {}) {
  if (!id) return pickThread(map.state.thread);
  const p = POINT[id];
  map.setPoint(id);
  show(`
    <div class="story__scene"></div>
    <h3 class="story__name">${p.name}</h3>
    ${p.text.map((t) => `<p>${rich(t)}</p>`).join("")}
    <p class="story__threads">${p.threads.map((t) => `<button type="button" class="chip" data-thread="${t}" style="--c:${THREAD[t].color}"><i aria-hidden="true"></i>${THREAD[t].name}</button>`).join("")}</p>`);
  scene = makeScene(p, HOOKS);
  sceneAt = performance.now();
  $(".story__scene", story).appendChild(scene.el);
  chime(PENTATONIC[4], 0.03, 0, 1.8);
  if (!quiet) {
    history.replaceState(null, "", `#${id}`);
    // on a phone the story is under the map: bring it up
    const r = story.getBoundingClientRect();
    if (r.top > innerHeight * 0.75) story.scrollIntoView({ block: "start", behavior: calm.matches ? "auto" : "smooth" });
  }
}

chips.addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) pickThread(map.state.thread === c.dataset.thread && !map.state.point ? null : c.dataset.thread);
});
story.addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (!c) return;
  if (c.dataset.point) pickPoint(c.dataset.point);
  else pickThread(c.dataset.thread);
});

// a link to #freedive or #water opens it; otherwise start on one thread
const fromHash = () => {
  const id = location.hash.slice(1);
  if (THREAD[id]) pickThread(id, { quiet: true });
  else if (POINT[id]) {
    pickThread(map.state.thread || POINT[id].threads[0], { quiet: true });
    pickPoint(id, { quiet: true });
  } else pickThread("limits", { quiet: true });
};
fromHash();
window.addEventListener("hashchange", fromHash);

// ── Behind the scenes ──────────────────────────────────────
const fab = mountFab({ current: "about", blueprint: true });
const blueprint = createBlueprint(fab.blueprintButton);
const stats = {
  map,
  get scene() {
    return scene;
  },
};
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

// ── One loop for the map and the open scene ────────────────
const hud = $(".bp-hud");
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  map.frame(now / 1000, dt);
  if (scene?.frame) {
    const r = scene.el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      if (!calm.matches) scene.frame((now - sceneAt) / 1000, dt);
      else if (!scene.drawn) {
        scene.drawn = true;
        scene.frame(scene.still ?? 4, 0);
      }
    }
  }
  if (blueprint.on) {
    const s = map.state;
    const members = s.thread ? POINTS.filter((p) => p.threads.includes(s.thread)).length : 0;
    hud.textContent = [
      `thread     ${s.thread ? `${s.thread} (${members} points)` : "none: the tangle"}`,
      `point      ${s.point || "-"}`,
      `moving     ${s.moving} / ${POINTS.length}`,
      `layout     ${s.portrait ? "on its side (narrow)" : "across"}`,
      `scene      ${scene ? scene.kind : "-"}${scene?.stats?.depth != null ? ` · ${Math.round(scene.stats.depth)} ft` : ""}`,
      `sound      ${audioState()} · ${soundStats.chord}`,
    ].join("\n");
    inspector.frame(now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
