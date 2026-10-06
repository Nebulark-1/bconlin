// Leading: the space between lines of type. The bio is plain paragraphs,
// and some phrases open a gap between the line they sit on and the next
// one, with more inside. Gaps can hold phrases that open gaps of their own.
//
// The trick that keeps the paragraph looking untouched: every word is its
// own inline element, so we can ask the browser where each one landed. The
// gap is a block, and a block dropped into a run of text ends the line it
// follows. Put it right before the first word of the next line and the
// text above wraps exactly as it did, the text below starts a fresh line
// in the same place, and the two lines simply move apart.

const TOKEN = /\[\[TODO:\s*([^\]]+)\]\]|\[([^\]]+)\]\(([^)\s]+)\)/g;
const calm = matchMedia("(prefers-reduced-motion: reduce)");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const words = (text) =>
  text
    .split(/(?<=\s)/)
    .filter(Boolean)
    .map((w) => `<span class="w">${esc(w)}</span>`)
    .join("");

/** One paragraph of copy, with each word wrapped so its line can be found. */
export function paragraph(text, dives) {
  const el = document.createElement("div");
  el.className = "para";
  let html = "";
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    html += words(text.slice(at, m.index));
    at = m.index + m[0].length;
    const [, todo, label, target] = m;
    if (todo) html += `<mark class="todo">TODO: ${esc(todo)}</mark>`;
    else if (dives[target])
      html += `<a class="opens" href="#${target}" role="button" aria-expanded="false" aria-controls="gap-${target}" data-dive="${target}">${esc(label)}</a>`;
    else {
      const away = /^https?:/.test(target) ? ' target="_blank" rel="noopener"' : "";
      html += `<a class="lnk" href="${esc(target)}"${away}>${esc(label)}</a>`;
    }
  }
  el.innerHTML = html + words(text.slice(at));
  return el;
}

/**
 * Where a gap under `trigger` goes: before the first piece of the
 * paragraph that starts below the line the trigger ends on, or null for
 * the end of the paragraph.
 */
export function splitPoint(trigger) {
  const pieces = [...trigger.parentElement.children].filter((el) => !el.classList.contains("gap"));
  const rects = trigger.getClientRects();
  const last = rects[rects.length - 1];
  const line = (last.top + last.bottom) / 2;
  for (let k = pieces.indexOf(trigger) + 1; k < pieces.length; k++) {
    const r = pieces[k].getClientRects()[0];
    if (r && r.top > line) return pieces[k];
  }
  return null;
}

/**
 * root:       the bio's container
 * dives:      id -> { scene, text: [...] }
 * makeScene:  (id, dive) -> { el, frame?(t, dt), stop?() }
 * onChange:   called with { id, depth, opened } after a gap opens or closes
 */
export function createLeading(root, { bio, dives, makeScene, onChange = () => {} }) {
  const open = new Map(); // trigger -> { gap, scene, id, depth }
  const stats = { open: 0, deepest: 0, added: 0, last: null, splits: 0 };
  const parentOf = {};
  for (const [id, d] of Object.entries(dives))
    for (const t of d.text) for (const m of t.matchAll(TOKEN)) if (dives[m[3]]) parentOf[m[3]] = id;

  bio.forEach((t) => root.appendChild(paragraph(t, dives)));

  const depthOf = (el) => {
    let d = 0;
    for (let g = el.closest(".gap"); g; g = g.parentElement.closest(".gap")) d++;
    return d;
  };

  function build(id, depth, trigger) {
    const dive = dives[id];
    const gap = document.createElement("div");
    gap.className = "gap";
    gap.id = `gap-${id}`;
    gap.setAttribute("role", "region");
    gap.setAttribute("aria-label", trigger.textContent);
    gap.style.setProperty("--depth", depth);
    const scene = makeScene(id, dive);
    gap.innerHTML = `<div class="gap__inner"><div class="gap__scene"></div><div class="gap__text"></div></div>`;
    gap.querySelector(".gap__scene").appendChild(scene.el);
    const text = gap.querySelector(".gap__text");
    dive.text.forEach((t) => text.appendChild(paragraph(t, dives)));
    const close = document.createElement("button");
    close.type = "button";
    close.className = "gap__close";
    close.setAttribute("aria-label", `Close ${trigger.textContent}`);
    close.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2 2 10"/></svg>';
    close.addEventListener("click", () => {
      shut(trigger);
      trigger.focus({ preventScroll: true });
    });
    gap.querySelector(".gap__inner").appendChild(close);
    return { gap, scene };
  }

  // the slit starts under the trigger and runs out to both margins
  const aim = (gap, trigger) => {
    const para = trigger.parentElement.getBoundingClientRect();
    const rects = trigger.getClientRects();
    const r = rects[rects.length - 1];
    gap.style.setProperty("--x", `${(((r.left + r.right) / 2 - para.left) / para.width) * 100}%`);
  };

  function place(trigger, gap) {
    gap.remove();
    const before = splitPoint(trigger);
    trigger.parentElement.insertBefore(gap, before);
    aim(gap, trigger);
    stats.splits++;
    stats.last = { word: trigger.textContent, before: before ? before.textContent.trim() : "(end)" };
  }

  function grow(gap, from, to, done) {
    if (calm.matches) return done?.();
    const a = gap.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 260 + Math.min(500, Math.abs(to - from) * 0.9),
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
    a.onfinish = () => done?.();
    return a;
  }

  function unfold(trigger, { quiet = false } = {}) {
    if (open.has(trigger)) return open.get(trigger);
    // one gap per paragraph: a new one replaces its neighbor
    for (const [t] of open) if (t.parentElement === trigger.parentElement) shut(t, { quiet: true });
    peekOff(trigger);
    const id = trigger.dataset.dive;
    const depth = depthOf(trigger) + 1;
    const { gap, scene } = build(id, depth, trigger);
    place(trigger, gap);
    const entry = { gap, scene, id, depth };
    open.set(trigger, entry);
    trigger.setAttribute("aria-expanded", "true");
    gap.classList.add("is-open");
    if (!quiet) grow(gap, 0, gap.scrollHeight);
    count();
    if (!quiet) onChange({ id, depth, opened: true });
    return entry;
  }

  function shut(trigger, { quiet = false } = {}) {
    const entry = open.get(trigger);
    if (!entry) return;
    // anything opened inside closes with it
    for (const [t] of open) if (entry.gap.contains(t)) shut(t, { quiet: true });
    open.delete(trigger);
    trigger.setAttribute("aria-expanded", "false");
    entry.gap.classList.remove("is-open");
    entry.gap.classList.add("is-closing");
    entry.scene.stop?.();
    const finish = () => {
      entry.gap.remove();
      count();
    };
    const a = grow(entry.gap, entry.gap.offsetHeight, 0, finish);
    if (!a) finish();
    if (!quiet) onChange({ id: entry.id, depth: entry.depth, opened: false });
  }

  function count() {
    stats.open = open.size;
    stats.deepest = Math.max(0, ...[...open.values()].map((e) => e.depth));
    stats.added = [...open.values()].filter((e) => e.depth === 1).reduce((s, e) => s + e.gap.offsetHeight, 0);
  }

  // a hint on hover: the lines part a few pixels
  const peeks = new Map();
  function peekOn(trigger) {
    if (open.has(trigger) || peeks.has(trigger) || calm.matches) return;
    const p = document.createElement("div");
    p.className = "gap gap--peek";
    p.setAttribute("aria-hidden", "true");
    const before = splitPoint(trigger);
    trigger.parentElement.insertBefore(p, before);
    aim(p, trigger);
    peeks.set(trigger, p);
    requestAnimationFrame(() => p.classList.add("is-on"));
  }
  function peekOff(trigger) {
    const p = peeks.get(trigger);
    if (!p) return;
    peeks.delete(trigger);
    if (open.has(trigger) || !p.isConnected) return p.remove();
    p.classList.remove("is-on");
    setTimeout(() => p.remove(), 220);
  }

  const toggle = (trigger) => (open.has(trigger) ? shut(trigger) : unfold(trigger));

  root.addEventListener("click", (e) => {
    const t = e.target.closest(".opens");
    if (!t || !root.contains(t)) return;
    e.preventDefault();
    toggle(t);
  });
  root.addEventListener("keydown", (e) => {
    const t = e.target.closest?.(".opens");
    if (t && e.key === " ") {
      e.preventDefault();
      toggle(t);
    }
    if (e.key === "Escape") {
      const gap = e.target.closest?.(".gap");
      const t2 = gap && [...open].find(([, v]) => v.gap === gap)?.[0];
      if (t2) {
        shut(t2);
        t2.focus({ preventScroll: true });
      }
    }
  });
  root.addEventListener("pointerover", (e) => {
    const t = e.target.closest(".opens");
    if (t && e.pointerType === "mouse") peekOn(t);
  });
  root.addEventListener("pointerout", (e) => {
    const t = e.target.closest(".opens");
    if (t && !t.contains(e.relatedTarget)) peekOff(t);
  });

  // When the column changes width the lines rewrap, so every open gap is
  // found a new place, outermost first.
  let width = root.clientWidth;
  new ResizeObserver(() => {
    if (root.clientWidth === width) return;
    width = root.clientWidth;
    const list = [...open].sort(([, a], [, b]) => a.depth - b.depth);
    for (const [t, { gap }] of list) place(t, gap);
  }).observe(root);

  /** Open a dive-in and every gap above it, e.g. from a link to #freedive. */
  function reveal(id) {
    const path = [];
    for (let at = id; at; at = parentOf[at]) path.unshift(at);
    let scope = root;
    for (const step of path) {
      const t = scope.querySelector(`.opens[data-dive="${step}"]`);
      if (!t) return null;
      scope = unfold(t, { quiet: true }).gap;
    }
    return scope;
  }

  return {
    stats,
    reveal,
    shut,
    get scenes() {
      return [...open.values()].map((e) => e.scene);
    },
    get gaps() {
      return [...open.values()];
    },
  };
}
