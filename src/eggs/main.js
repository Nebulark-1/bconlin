import { EGGS, onEggs, isFound, foundAt, isOn, setOn, foundCount, usedHint, usedSpoiler, markHint, markSpoiler, resetEggs } from "../site/eggs.js";
import { eggTopics } from "../inspect/topics-eggs.js";
import { extract, highlight, langOf } from "../inspect/source.js";
import { mountFab } from "../site/fab.js";
import { mountBehind } from "../inspect/behind.js";
import { secretsPageTopics } from "../inspect/topics-secrets.js";
import { addCommands } from "../site/console.js";
import { createRain } from "../site/rain.js";
import { chime, PENTATONIC } from "../site/sound.js";
import { reducedMotion } from "../engine/scroll.js";

// The secrets page: a sky with one star per secret, the ones you've found
// (each with an on/off switch and the code behind it), and a spoiler list.

const $ = (sel) => document.querySelector(sel);
const fab = mountFab({ current: "eggs", blueprint: true });
const rain = createRain({ column: 1180 });
addCommands([
  ["snow(on)", "start or stop the snow", (on = true) => (rain.setSnow(on), rain.stats.enabled ? (on ? "snowing" : "stopped") : "make the window wider to see it")],
  ["rain", "a quick downpour in the margins", () => (rain.burst() ? "pitter patter" : "make the window wider to see it")],
]);
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const total = EGGS.length;
$("[data-lede]").textContent = `There are ${(WORDS[total] || String(total)).toLowerCase()} hidden around the site. Poke around. (One of them is in your browser's dev tools.)`;

const dots = (n) => "●".repeat(n) + "○".repeat(3 - n);
const when = (id) => new Date(foundAt(id)).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// ── The code behind a secret, as the inspector shows it ─────
function codeFor(id) {
  const topic = eggTopics.find((t) => t.id === id);
  if (!topic) return "";
  return topic.sources
    .map(({ file, src, name, marks }) => {
      const found = extract(src, name);
      if (!found) return "";
      const code = highlight(found.code, { firstLine: found.line, marks, lang: langOf(file) });
      return `<figure class="src"><figcaption>${file}<span>:${found.line}</span></figcaption><pre><code>${code}</code></pre></figure>`;
    })
    .join("");
}

// ── What you've found ───────────────────────────────────────
function renderFinds() {
  const list = $(".finds__list");
  const found = EGGS.filter((e) => isFound(e.id));
  if (!found.length) {
    list.innerHTML = `<p class="finds__empty">Nothing yet. Go poke around the home page.</p>`;
    return;
  }
  const open = new Set([...list.querySelectorAll("details[open]")].map((d) => d.dataset.id));
  list.innerHTML = found
    .map(
      (e) => `
    <article class="find${isOn(e.id) ? "" : " is-off"}">
      <header class="find__head">
        <span class="find__star" aria-hidden="true"></span>
        <div>
          <h3>${e.name}</h3>
          <p class="find__meta">${e.page} · found ${when(e.id)}${usedSpoiler(e.id) ? ' · <em class="tag tag--spoiler">looked it up</em>' : usedHint(e.id) ? ' · <em class="tag tag--hint">used a hint</em>' : ' · <em class="tag tag--own">found it yourself</em>'}</p>
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${isOn(e.id)}" data-toggle="${e.id}" aria-label="${e.name} on or off">
          <span aria-hidden="true"></span>
        </button>
      </header>
      <p class="find__what">${e.what}</p>
      <details class="find__code" data-id="${e.id}"${open.has(e.id) ? " open" : ""}>
        <summary>See the code</summary>
        <div class="find__src">${codeFor(e.id)}</div>
      </details>
    </article>`,
    )
    .join("");
}

$(".finds__list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-toggle]");
  if (!b) return;
  setOn(b.dataset.toggle, !isOn(b.dataset.toggle));
});

// ── The spoiler list ────────────────────────────────────────
const stuck = $(".stuck__list");
stuck.innerHTML = EGGS.map(
  (e, k) => `
  <li class="spoil" data-id="${e.id}">
    <div class="spoil__row">
      <span class="spoil__n">${String(k + 1).padStart(2, "0")}</span>
      <span class="spoil__name"></span>
      <span class="spoil__page">${e.page}</span>
      <span class="spoil__level" title="Difficulty">${dots(e.difficulty)}</span>
      <span class="spoil__state"></span>
    </div>
    <details class="spoil__hint" data-kind="hint">
      <summary>Hint</summary>
      <p>${e.hint}</p>
    </details>
    <details class="spoil__spoiler" data-kind="spoiler">
      <summary>Just tell me</summary>
      <p><b>${e.name}.</b> ${e.how}</p>
      <p>${e.what}</p>
    </details>
  </li>`,
).join("");

function renderStuck() {
  for (const li of stuck.children) {
    const id = li.dataset.id;
    const e = EGGS.find((x) => x.id === id);
    const known = isFound(id) || usedSpoiler(id);
    li.querySelector(".spoil__name").textContent = known ? e.name : "???";
    const state = li.querySelector(".spoil__state");
    state.textContent = isFound(id) ? "found" : "not yet";
    state.className = `spoil__state${isFound(id) ? " is-found" : ""}`;
    li.classList.toggle("is-found", isFound(id));
  }
}

stuck.addEventListener(
  "toggle",
  (e) => {
    const d = e.target;
    if (!d.open) return;
    const id = d.closest(".spoil").dataset.id;
    if (d.dataset.kind === "hint") markHint(id);
    else markSpoiler(id);
  },
  true,
);

$(".stuck__show").addEventListener("click", (e) => {
  const open = stuck.hidden;
  stuck.hidden = !open;
  e.currentTarget.setAttribute("aria-expanded", String(open));
  e.currentTarget.textContent = open ? "Hide the list" : "Show the list";
});

$(".stuck__reset").addEventListener("click", () => {
  if (window.confirm("Reset? This clears everything you've found.")) resetEggs();
});

// ── The sky: one star per secret ────────────────────────────
const canvas = $(".sky__canvas");
const ctx = canvas.getContext("2d");
// where each star sits, as fractions of the chart (a loose spiral)
const place = EGGS.map((_, k) => {
  const a = k * 2.399963 + 0.6;
  const r = 0.16 + 0.3 * Math.sqrt((k + 0.5) / EGGS.length);
  return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r * 0.86];
});
let order = [];
const lit = new Map(); // id → when it lit on this page, for the flare

function sizeSky() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeSky();
window.addEventListener("resize", sizeSky);

function drawSky(now) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  const xy = (k) => [place[k][0] * w, place[k][1] * h];
  // lines, in the order you found them
  ctx.lineWidth = 1;
  for (let n = 1; n < order.length; n++) {
    const [ax, ay] = xy(EGGS.findIndex((e) => e.id === order[n - 1]));
    const [bx, by] = xy(EGGS.findIndex((e) => e.id === order[n]));
    ctx.strokeStyle = "rgba(255,226,196,.35)";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
  EGGS.forEach((e, k) => {
    const [x, y] = xy(k);
    const found = isFound(e.id);
    const flare = lit.has(e.id) ? Math.max(0, 1 - (now - lit.get(e.id)) / 1400) : 0;
    const twinkle = reducedMotion ? 0 : Math.sin(now / 700 + k * 1.7) * 0.15;
    if (found) {
      const r = 9 + 10 * flare;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      halo.addColorStop(0, "rgba(255,226,196,.55)");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff6e6";
      ctx.beginPath();
      for (let p = 0; p < 8; p++) {
        const rr = (p % 2 ? 0.28 : 1) * (r * (0.85 + twinkle));
        const a = (p * Math.PI) / 4 - Math.PI / 2;
        p ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(236,232,255,${0.18 + twinkle * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  requestAnimationFrame(drawSky);
}

// ── Keep everything in step with progress ───────────────────
let seen = null;
onEggs((state) => {
  const found = foundCount();
  $("[data-found]").textContent = `${found} of ${total}`;
  $("[data-left]").textContent = found === total ? "· you found them all" : found ? `· ${total - found} to go` : "";
  order = EGGS.filter((e) => state.found[e.id])
    .sort((a, b) => state.found[a.id] - state.found[b.id])
    .map((e) => e.id);
  // a star found since the page loaded flares as it lights
  if (seen) {
    for (const id of order.filter((x) => !seen.has(x))) {
      lit.set(id, performance.now());
      chime(PENTATONIC[(order.indexOf(id) + 2) % PENTATONIC.length], 0.03, 0, 2.2);
    }
  }
  seen = new Set(order);
  renderFinds();
  renderStuck();
});

function loop(now) {
  rain.frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
requestAnimationFrame(drawSky);

// ── Behind the scenes ───────────────────────────────────────
mountBehind(fab, secretsPageTopics, {}, () => [`found     ${foundCount()} of ${EGGS.length}`, `stars lit ${order.length}`]);
