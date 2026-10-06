import { createBlueprint } from "../blueprint.js";
import { createInspector } from "../inspect/inspector.js";
import { homeTopics } from "../inspect/topics-home.js";
import { secretsTopic, secretsChip } from "../inspect/topics-eggs.js";
import { chapters, nextChapter, eras, results } from "../content.js";
import { clamp, lerp, easeOutCubic } from "../engine/math.js";
import { reducedMotion } from "../engine/scroll.js";
import { mountFab } from "../site/fab.js";
import { createRain } from "../site/rain.js";
import { isOn, discover, onEggs, foundCount, EGGS } from "../site/eggs.js";
import { CHORDS, setChord, pluck, chime, soundStats, windStats, audioState } from "../site/sound.js";
import { createField } from "./field.js";
import { createFavicon } from "./favicon.js";
import { COLORS } from "./palette.js";
import { PHOTOS, cyclePhoto, detectStrum, playEncore, hum, wake, FUTURE, consoleApi } from "./secrets.js";
import { PER, NOW, YEARS, LANE, SPANS, uOf, yearOf, inSpan, ringSlot, laneSlot, harpSlot, dotLayout, chartLabels, chartBox } from "./structures.js";

// The home page: a normal scrolling page with a few static structures in
// it (rings, a timeline, four charts, a set of strings). 400 points race to
// fill whichever structure is in view. See field.js.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const IDS = chapters.map((c) => c.id);
const MUTED = "#8d88ad";
const coarse = window.matchMedia("(pointer: coarse)").matches;

// ── Shared copy, from content.js ────────────────────────────
$$("[data-pitch]").forEach((el) => (el.textContent = nextChapter.pitch));
$$("[data-looking]").forEach((el) => (el.textContent = nextChapter.looking));
$$("[data-status]").forEach((el) => (el.textContent = `${nextChapter.when} · Fort Collins, Colorado`));
$$("[data-email]").forEach((el) => (el.href = `mailto:${nextChapter.email}`));
$$("[data-linkedin]").forEach((el) => (el.href = nextChapter.linkedin));

// ── The timeline's static structure ─────────────────────────
const lanes = $(".lanes");
lanes.style.setProperty("--lane-top", `${LANE.top}px`);
lanes.style.setProperty("--lane-gap", `${LANE.gap}px`);
lanes.style.setProperty("--lane-axis", `${LANE.axis}px`);
const pct = (year) => `${(uOf(year) * 100).toFixed(3)}%`;
lanes.innerHTML =
  chapters
    .map(
      (c, i) => `
    <div class="lane" style="--i:${i};--c:${COLORS[c.id]}">
      <span class="lane__label">${c.label}</span>
      ${SPANS[c.id].map(([a, b]) => `<span class="lane__span" style="left:${pct(a)};width:calc(${pct(b)} - ${pct(a)})"></span>`).join("")}
    </div>`,
    )
    .join("") +
  `<div class="axis">
    ${Array.from({ length: YEARS[1] - YEARS[0] }, (_, k) => `<span class="axis__tick" style="left:${pct(YEARS[0] + k)}">${YEARS[0] + k}</span>`).join("")}
    <span class="axis__now" style="left:${pct(NOW)}">now</span>
  </div>`;

// ── Results, each with its chart frame ──────────────────────
const FORMAT = [
  (n) => `${Math.round(n).toLocaleString("en-US")}+`,
  (n) => `${Math.round(n)}%`,
  (n) => `200 → ${Math.round(n)}`,
  (n) => String(Math.round(n)),
];
$(".results__list").innerHTML = results
  .map(
    (r, k) => `
  <article class="result" style="--c:${COLORS[r.id]}">
    <div class="result__text">
      <p class="result__tag">${r.tag}</p>
      <p class="result__figure" aria-label="${r.show}">${FORMAT[k](r.from)}</p>
      <p class="result__caption">${r.caption}</p>
      <p class="result__unit"><i></i> = ${r.unit}</p>
    </div>
    <div class="chart" data-structure="chart" data-k="${k}"></div>
  </article>`,
  )
  .join("");
const figures = [...$$(".result__figure")];
const counted = new Map(); // result → when its count began
const countObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      const k = [...$$(".result")].indexOf(e.target);
      if (e.isIntersecting && !counted.has(k)) counted.set(k, performance.now());
    }),
  { threshold: 0.55 },
);
$$(".result").forEach((el) => countObserver.observe(el));

// ── Structures: where the points can go ─────────────────────
// a string structure: point i is string ⌊i/100⌋, u along it
const strings = (fn) => (i, rect, t) => {
  const s = Math.floor(i / PER);
  const p = fn(s, (i % PER) / (PER - 1), rect, t);
  p.color = COLORS[IDS[s]];
  return p;
};
const faint = "rgba(236,232,255,.1)";
let activeSince = 0;
// state the secrets share (photo, spin, strums, humming)
const secret = { photo: 0, spin: 0, spinVel: 0, plucks: [], strums: [], lastInput: performance.now(), humming: false, hummed: 0, nextHum: 0 };
let play = NOW;
let playGoal = NOW;

const structures = [
  {
    id: "rings",
    el: $(".hero__rings"),
    kind: "thread",
    spans: true,
    chord: "A",
    slot: strings((i, u, rect, t) => ringSlot(i, u, rect, t, secret.spin)),
    guides(ctx, r, t, bp) {
      const R = r.width / 2 / 1.34;
      ctx.save();
      ctx.strokeStyle = bp ? "rgba(159,227,255,.5)" : faint;
      ctx.setLineDash([2, 7]);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(r.left + r.width / 2, r.top + r.height / 2, R * (1.08 + i * 0.075), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: "lanes",
    el: lanes,
    kind: "thread",
    spans: true,
    chord: "Fsm",
    slot: strings(laneSlot),
    overlay(ctx, r, field) {
      // the playhead, and a bead where it crosses a chapter under way
      const x = lerp(r.left, r.right, uOf(play));
      const top = r.top + LANE.top - 26;
      const axis = r.top + LANE.top + 3 * LANE.gap + LANE.axis;
      ctx.save();
      ctx.strokeStyle = "rgba(255,180,140,.75)";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, axis);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffb48c";
      ctx.beginPath();
      ctx.moveTo(x - 5, axis + 1);
      ctx.lineTo(x + 5, axis + 1);
      ctx.lineTo(x, axis - 6);
      ctx.fill();
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText(play > NOW + 0.04 ? "next?" : play >= NOW - 0.02 ? "now" : monthOf(play), x, top - 8);
      if (structures[field.active] === this && field.stats.travelling < 20) {
        IDS.forEach((id, s) => {
          if (!inSpan(id, play)) return;
          const [bx, by] = field.at(s, uOf(play) * (PER - 1));
          ctx.fillStyle = "#fff";
          ctx.shadowColor = COLORS[id];
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    },
  },
  ...results.map((res, k) => ({
    id: `chart ${k + 1}`,
    el: $(`.chart[data-k="${k}"]`),
    kind: "dots",
    spans: false,
    chord: "D",
    slot(i, r, t, now) {
      const arrive = structures[field.active] === this ? clamp((now - activeSince - 900) / 1800) : 1;
      const d = dotLayout(k, i, chartBox(r), reducedMotion ? 1 : arrive);
      return { ...d, dot: 1, color: d.lit ? COLORS[res.id] : MUTED };
    },
    guides(ctx, r, t, bp) {
      // empty sockets for every dot the chart holds
      const box = chartBox(r);
      ctx.save();
      ctx.strokeStyle = bp ? "rgba(159,227,255,.35)" : "rgba(236,232,255,.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 400; i++) {
        const d = dotLayout(k, i, box, 1);
        if (d.r < 0.5) continue;
        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(236,232,255,.55)";
      for (const [text, x, y] of chartLabels(k, box)) ctx.fillText(text, x, y);
      ctx.restore();
    },
  })),
  {
    id: "harp",
    el: $(".harp"),
    kind: "thread",
    spans: false,
    chord: "Ahigh",
    slot: strings(harpSlot),
    guides(ctx, r, t, bp) {
      ctx.save();
      ctx.strokeStyle = bp ? "rgba(159,227,255,.5)" : faint;
      ctx.setLineDash([2, 7]);
      for (let i = 0; i < 4; i++) {
        const y = r.top + (r.height / 4) * (i + 0.5);
        ctx.beginPath();
        ctx.moveTo(r.left, y);
        ctx.lineTo(r.right, y);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (year) => `${MONTHS[Math.min(11, Math.floor((year % 1) * 12))]} ${Math.floor(year)}`;

// ── Sound: each structure has its chord; strings play its notes ──
const chordOf = () => structures[field.active]?.chord || "A";
const field = createField($(".field"), structures, {
  onActive(k) {
    activeSince = performance.now();
    setChord(structures[k].chord);
  },
  onPluck(s, strength, pan, auto = false) {
    pluck(CHORDS[chordOf()].strings[s], strength, pan);
    // only a person's strums count toward the encore
    if (!auto) detectStrum(secret, s, performance.now(), encore);
  },
  onScatter(strength, pan) {
    const notes = CHORDS[chordOf()].strings;
    chime(notes[Math.floor(Math.random() * notes.length)] * 2, 0.02 + 0.03 * strength, pan, 1.6);
  },
});
const rain = createRain({ column: 1180 });

// ── Secrets (see secrets.js and the secrets page) ───────────
const encore = () => playEncore(field, rain);
const photo = $(".hero__photo");
$(".hero__rings").addEventListener("click", () => cyclePhoto(secret, photo, rain));
// fetch the other portraits once someone shows interest in this one
$(".hero__rings").addEventListener("pointerenter", () => PHOTOS.slice(1).forEach((p) => (new Image().src = p.src)), { once: true });
for (const t of ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"]) {
  window.addEventListener(t, () => wake(secret, performance.now()), { passive: true });
}
consoleApi({ field, rain, encore, secret });
// the playhead can run on past now, once that secret is allowed
const lastYear = () => (isOn("future") ? YEARS[1] - 0.02 : NOW);

// ── Timeline: what was happening at the playhead ────────────
window.addEventListener(
  "pointermove",
  (e) => {
    const r = lanes.getBoundingClientRect();
    if (e.clientY > r.top - 30 && e.clientY < r.bottom + 10 && e.clientX >= r.left - 20 && e.clientX <= r.right + 20) {
      playGoal = clamp(yearOf(clamp((e.clientX - r.left) / r.width)), YEARS[0], lastYear());
    }
  },
  { passive: true },
);
lanes.addEventListener("keydown", (e) => {
  const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!dir) return;
  e.preventDefault();
  playGoal = clamp(playGoal + dir * 0.25, YEARS[0], lastYear());
});
let shownEra = null;
function showEra() {
  const future = play > NOW + 0.04;
  if (future) discover("future");
  const era = future ? FUTURE : eras.find((e) => play >= e.from && play < e.to) || eras[eras.length - 1];
  if (era === shownEra) return;
  shownEra = era;
  $(".era__when").textContent = era.when;
  $(".era__text").textContent = era.text;
  $(".era__links").innerHTML = era.ids
    .map((id) => `<a href="career.html#${id}" style="--c:${COLORS[id]}">${chapters.find((c) => c.id === id).label} <span aria-hidden="true">→</span></a>`)
    .join("") + (era.email ? `<a href="mailto:${nextChapter.email}" style="--c:#ffb48c">Email me <span aria-hidden="true">→</span></a>` : "");
  const box = $(".era");
  box.classList.remove("is-new");
  void box.offsetWidth;
  box.classList.add("is-new");
}

// ── The floating circles and behind the scenes ──────────────
const fab = mountFab({ current: "home", blueprint: true });
const blueprint = createBlueprint(fab.blueprintButton);
const favicon = createFavicon();
const stats = { field, rain, sound: soundStats, favicon, structures };
// one chip for every secret found so far
const inspector = createInspector($(".bp-host"), [...homeTopics, secretsTopic(stats)], { stats });
blueprint.subscribe((on) => !on && inspector.close());

// A secret found mid-visit: update the chip's count, and if the Secrets
// panel is open, redraw it showing the one just found.
let known = null; // what was found when we last looked (null before the first look)
onEggs((state) => {
  const found = Object.keys(state.found);
  const fresh = known ? found.filter((id) => !known.has(id)) : [];
  known = new Set(found);
  const chip = document.querySelector('.bp-chips button[data-topic="secrets"]');
  if (chip) chip.textContent = secretsChip();
  if (!fresh.length) return;
  stats.secret = fresh[fresh.length - 1];
  if (inspector.topic === "secrets") inspector.open("secrets", true);
});
const hud = $(".bp-hud");
const stringColors = IDS.map((id) => COLORS[id]);

// ── Frame loop ──────────────────────────────────────────────
let lastFrame = performance.now();
function frame(now) {
  const bp = blueprint.on;
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  play = lerp(play, playGoal, reducedMotion ? 1 : 0.18);
  // the rings' extra spin from a photo change, winding down
  secret.spin += secret.spinVel * dt;
  secret.spinVel *= 0.94;
  hum(secret, field, now);
  showEra();
  // in the timeline, chapters under way at the playhead stand out
  const onLanes = structures[field.active]?.id === "lanes";
  field.weights = IDS.map((id) => (onLanes ? (inSpan(id, play) ? 1 : 0.3) : 1));

  rain.frame(now, bp);
  field.frame(now, bp);
  let dots = 0;
  for (const p of field.pts) dots += p.dot;
  favicon.update(now, field.pts, stringColors, dots / field.pts.length < 0.5);

  // each figure counts up once, the first time its row comes into view
  counted.forEach((start, k) => {
    const r = results[k];
    const t = reducedMotion ? 1 : easeOutCubic(clamp((now - start - 300) / 1800));
    figures[k].textContent = FORMAT[k](lerp(r.from, r.to, t));
  });
  document.body.style.setProperty("--scrolled", clamp(window.scrollY / 200).toFixed(3));

  if (bp) {
    const s = field.stats;
    hud.textContent = [
      `points    400 → ${s.active}`,
      `moving    ${s.travelling}   energy ${s.energy.toFixed(0)}`,
      `plucks    ${s.plucks}   fps ${Math.round(s.fps)}${secret.humming ? "   humming" : ""}`,
      `margins   ${rain.stats.enabled ? `${rain.stats.motes} motes, ${rain.stats.hits} bounces` : "no room for rain"}`,
      `sound     ${audioState()} · ${soundStats.chord} · pad ${soundStats.phrase} · ${soundStats.notes} notes`,
      `wind      ${"▮".repeat(Math.round(windStats.level * 10)).padEnd(10, "·")}`,
      `secrets   ${foundCount()} / ${EGGS.length}${rain.stats.links ? ` · ${rain.stats.links} constellation lines` : ""}`,
    ].join("\n");
    inspector.frame(now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
