import bank, { LENSES } from "./bank.js";
import { compose, renderPaper } from "./paper.js";
import { mountFab } from "../site/fab.js";
import { showHireDraft } from "./hire.js";

mountFab({ current: "resume" });
// ben.hire() from the console comes here with ?hire
if (new URLSearchParams(location.search).has("hire")) showHireDraft();

// The résumé generator. Pick a focus and the page re-ranks the bank:
// the strongest lines for that kind of role rise, weaker ones drop out, and
// the swap plays out on the page. It only chooses and orders lines; every
// line was written by me.

const params = new URLSearchParams(location.search);
const state = {
  lens: LENSES.some((l) => l.id === params.get("focus")) ? params.get("focus") : "best",
  full: params.get("length") === "full",
  healthcare: params.get("healthcare") !== "off",
};

// ── Rendering ────────────────────────────────────────────────
const paper = document.querySelector(".paper");
const render = (model) => renderPaper(paper, bank, model);

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
  const next = compose(bank, state);
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
