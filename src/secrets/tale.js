// The card a story secret opens: a small scene, a title, and the story,
// bottom left (the menu circles are bottom right). One at a time.

import { STORIES } from "./stories.js";
import { makeScene } from "./scenes.js";
import { chime, PENTATONIC } from "../site/sound.js";

const calm = matchMedia("(prefers-reduced-motion: reduce)");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** Copy to HTML: links, and TODO placeholders that stand out until filled in. */
const rich = (text) =>
  esc(text)
    .replace(/\[\[TODO:\s*([^\]]+)\]\]/g, '<mark class="todo">TODO: $1</mark>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`);

let open = null; // { card, scene, raf }

export function closeTale() {
  if (!open) return;
  const { card, scene, raf } = open;
  open = null;
  cancelAnimationFrame(raf);
  scene.stop?.();
  card.classList.remove("is-on");
  setTimeout(() => card.remove(), 400);
}

/**
 * Open story `id`. hooks go to its scene (what the scene's own secrets
 * listen for). Returns { swap(sceneName) } to change the art in place.
 */
export function openTale(id, hooks = {}) {
  const story = STORIES[id];
  if (!story) return null;
  closeTale();
  const card = document.createElement("aside");
  card.className = "tale";
  card.setAttribute("aria-label", story.title);
  card.innerHTML = `
    <button type="button" class="tale__close" aria-label="Close"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2 2 10"/></svg></button>
    <p class="tale__kicker">A secret</p>
    <h2 class="tale__title">${esc(story.title)}</h2>
    <div class="tale__art"></div>
    <div class="tale__text">${story.text.map((t) => `<p>${rich(t)}</p>`).join("")}</div>`;
  document.body.appendChild(card);
  card.querySelector(".tale__close").addEventListener("click", closeTale);
  card.addEventListener("keydown", (e) => e.key === "Escape" && closeTale());
  requestAnimationFrame(() => card.classList.add("is-on"));
  chime(PENTATONIC[3], 0.03, -0.5, 2);

  const state = { card, scene: null, raf: 0, start: 0 };
  const show = (name) => {
    state.scene?.stop?.();
    state.scene = makeScene({ scene: name }, hooks);
    state.start = performance.now();
    state.drawn = false;
    const art = card.querySelector(".tale__art");
    art.replaceChildren(state.scene.el);
  };
  show(story.scene);

  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const s = state.scene;
    if (s.frame) {
      if (!calm.matches) s.frame((now - state.start) / 1000, dt);
      else if (!state.drawn) {
        state.drawn = true;
        s.frame(s.still ?? 4, 0);
      }
    }
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
  open = state;
  return { swap: show, card };
}
