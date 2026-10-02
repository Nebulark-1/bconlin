import { PROFILE, LENSES, SUMMARY, ENTRIES, SKILLS, LANGUAGES_SPOKEN } from "./bank.js";
import { mountFab } from "../site/fab.js";
import { showHireDraft } from "./hire.js";

mountFab({ current: "resume" });
// ben.hire() from the console comes here with ?hire
if (new URLSearchParams(location.search).has("hire")) showHireDraft();

// The résumé generator. Pick a focus and the page re-ranks the bank:
// the strongest lines for that kind of role rise, weaker ones drop out, and
// the swap plays out on the page. It only chooses and orders lines; every
// line was written by me.

const ONE_PAGE_LINES = 16; // bullets that fit on one page with the rest
const SECTIONS = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
];

const params = new URLSearchParams(location.search);
const state = {
  lens: LENSES.some((l) => l.id === params.get("focus")) ? params.get("focus") : "best",
  full: params.get("length") === "full",
  healthcare: params.get("healthcare") !== "off",
};

/** Choose and order lines for the current settings. */
export function compose({ lens, full, healthcare }) {
  const score = (b) => b.score[lens];
  let entries = ENTRIES.filter((e) => !(e.optional === "healthcare" && !healthcare)).map((e) => {
    const ranked = [...e.bullets].sort((a, b) => score(b) - score(a));
    return { ...e, top: score(ranked[0]), bullets: full ? ranked : ranked.slice(0, e.max) };
  });
  // a project earns its place on one page only if it speaks to this focus
  if (!full) entries = entries.filter((e) => e.section !== "projects" || e.top >= 6);

  if (!full) {
    // Trim the weakest lines across the page until it fits, keeping at
    // least one line per entry.
    const lines = () => entries.reduce((n, e) => n + e.bullets.length, 0);
    while (lines() > ONE_PAGE_LINES) {
      let worst = null;
      for (const e of entries) {
        if (e.bullets.length <= 1) continue;
        const last = e.bullets[e.bullets.length - 1];
        if (!worst || score(last) < score(worst.b)) worst = { e, b: last };
      }
      if (!worst) break;
      worst.e.bullets = worst.e.bullets.slice(0, -1);
    }
  }
  // projects in order of how well they fit
  const projects = entries.filter((e) => e.section === "projects").sort((a, b) => b.top - a.top);
  entries = [...entries.filter((e) => e.section === "experience"), ...projects, ...entries.filter((e) => e.section === "education")];

  const skills = SKILLS.map(({ row, items }) => ({
    row,
    items: [...items].sort((a, b) => b[1][lens] - a[1][lens]).slice(0, full ? items.length : 5).map(([name]) => name),
  }));
  const shown = entries.reduce((n, e) => n + e.bullets.length, 0);
  const total = ENTRIES.reduce((n, e) => n + e.bullets.length, 0);
  return { summary: SUMMARY[lens], entries, skills, shown, total };
}

// ── Rendering ────────────────────────────────────────────────
const paper = document.querySelector(".paper");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function render(model) {
  const block = (e) => `
    <div class="r-entry" style="view-transition-name: e-${e.id}">
      <div class="r-entry__head">
        <p><b>${esc(e.org)}</b>${e.where ? `<span class="r-where">${esc(e.where)}</span>` : ""}</p>
        <p class="r-when">${esc(e.when)}</p>
      </div>
      <p class="r-role">${esc(e.role)}</p>
      <ul>${e.bullets.map((b) => `<li data-id="${e.id}-${b.id}" style="view-transition-name: b-${e.id}-${b.id}">${esc(b.text)}</li>`).join("")}</ul>
    </div>`;
  paper.innerHTML = `
    <header class="r-head">
      <h1>${PROFILE.name}</h1>
      <p>${PROFILE.location} · <a href="mailto:${PROFILE.email}">${PROFILE.email}</a> · <a href="https://www.${PROFILE.linkedin}">${PROFILE.linkedin}</a> · <a href="https://${PROFILE.site}">${PROFILE.site}</a></p>
    </header>
    <p class="r-summary" style="view-transition-name: summary">${esc(model.summary)}</p>
    ${SECTIONS.map(([key, title]) => {
      const list = model.entries.filter((e) => e.section === key);
      return list.length ? `<section class="r-section" style="view-transition-name: s-${key}"><h2>${title}</h2>${list.map(block).join("")}</section>` : "";
    }).join("")}
    <section class="r-section" style="view-transition-name: s-skills">
      <h2>Skills</h2>
      ${model.skills.map((r) => `<p class="r-skill"><b>${r.row}:</b> <span data-skill="${r.row}">${esc(r.items.join(", "))}</span></p>`).join("")}
      <p class="r-skill"><b>Spoken:</b> ${LANGUAGES_SPOKEN}</p>
    </section>`;
}

// Text that changed resolves out of a scramble, left to right.
const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789";
function scramble(el, text, ms = 700) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    const done = Math.floor(text.length * k);
    let out = text.slice(0, done);
    for (let i = done; i < Math.min(text.length, done + 14); i++) out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = text;
  };
  requestAnimationFrame(step);
}

let current = null;
function update(animate = true) {
  const next = compose(state);
  const before = new Set(paper.querySelectorAll("li[data-id]").length ? [...paper.querySelectorAll("li[data-id]")].map((li) => li.dataset.id) : []);
  const prevSummary = current?.summary;
  const prevSkills = current ? Object.fromEntries(current.skills.map((r) => [r.row, r.items.join(", ")])) : {};

  const swap = () => {
    render(next);
    if (!animate) return;
    for (const li of paper.querySelectorAll("li[data-id]")) if (!before.has(li.dataset.id)) scramble(li, li.textContent, 520 + Math.random() * 260);
    if (prevSummary && prevSummary !== next.summary) scramble(paper.querySelector(".r-summary"), next.summary, 900);
    for (const span of paper.querySelectorAll("[data-skill]")) if (prevSkills[span.dataset.skill] && prevSkills[span.dataset.skill] !== span.textContent) scramble(span, span.textContent, 600);
  };
  if (animate && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(swap);
  else swap();
  current = next;

  // controls reflect the state; the URL does too, so a tailored version can be shared
  document.querySelectorAll("[data-lens]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lens === state.lens)));
  document.querySelectorAll("[data-length]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.length === "full") === state.full)));
  document.querySelector("[data-healthcare]").setAttribute("aria-checked", String(state.healthcare));
  document.querySelector(".tailor__count").textContent = `${next.shown} of ${next.total} lines`;
  const q = new URLSearchParams();
  if (state.lens !== "best") q.set("focus", state.lens);
  if (state.full) q.set("length", "full");
  if (!state.healthcare) q.set("healthcare", "off");
  history.replaceState(null, "", q.toString() ? `?${q}` : location.pathname);
}

// ── Controls ─────────────────────────────────────────────────
document.querySelector(".tailor__lenses").innerHTML = LENSES.map(
  (l) => `<button type="button" data-lens="${l.id}" aria-pressed="false"><b>${l.label}</b><small>${l.blurb}</small></button>`,
).join("");
document.querySelectorAll("[data-lens]").forEach((b) =>
  b.addEventListener("click", () => {
    state.lens = b.dataset.lens;
    update();
  }),
);
document.querySelectorAll("[data-length]").forEach((b) =>
  b.addEventListener("click", () => {
    state.full = b.dataset.length === "full";
    update();
  }),
);
document.querySelector("[data-healthcare]").addEventListener("click", () => {
  state.healthcare = !state.healthcare;
  update();
});
document.querySelector("[data-print]").addEventListener("click", () => window.print());

update(false);
