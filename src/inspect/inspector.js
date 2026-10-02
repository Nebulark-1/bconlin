import { extract, highlight, langOf } from "./source.js";

/**
 * The code inspector shown in blueprint mode: a row of topic chips across
 * the top of the scene, and a panel with the live visualization, live
 * values, any actions, and the real source of the functions involved.
 *
 * host:   element to mount into (the scene panel)
 * topics: from topics.js
 * scene:  { stats, reseed } - what visualizations read and actions call
 */
// Where a topic's code comes from, said plainly.
const BADGES = {
  site: {
    label: "this page's code",
    title: "The code that draws this part of the page: a simplified version of the approach, written for this site.",
  },
  sketch: {
    label: "illustrative sketch",
    title: "Written for this site to show how a system like this works. It is not the firm's code, schema or data, which stay with the firm.",
  },
  productSketch: {
    label: "illustrative sketch",
    title: "Written for this page to show the idea, with simplified rules and placeholder numbers. It is not Chaos Coaching's code, which stays private. Sample data, not real athletes.",
  },
};

export function createInspector(host, topics, scene) {
  const chips = document.createElement("nav");
  chips.className = "bp-chips";
  chips.setAttribute("aria-label", "Inspect the code behind the scene");
  chips.innerHTML =
    `<span class="bp-chips__lead">Inspect the code</span>` +
    topics.map((t) => `<button type="button" data-topic="${t.id}">${t.chip}</button>`).join("");

  const panel = document.createElement("aside");
  panel.className = "inspector";
  panel.setAttribute("aria-label", "Code inspector");
  panel.innerHTML = `
    <header class="inspector__head">
      <div>
        <p class="inspector__kicker"></p>
        <h3 class="inspector__title"></h3>
      </div>
      <button type="button" class="inspector__close" aria-label="Close inspector">×</button>
    </header>
    <div class="inspector__body">
      <p class="inspector__summary"></p>
      <div class="inspector__actions"></div>
      <canvas class="inspector__viz"></canvas>
      <pre class="inspector__live"></pre>
      <div class="inspector__code"></div>
    </div>`;
  host.append(chips, panel);

  const $ = (sel) => panel.querySelector(sel);
  const canvas = $(".inspector__viz");
  const ctx = canvas.getContext("2d");
  const live = $(".inspector__live");
  let current = null;
  let tick = 0;

  // A topic's title, summary and sources can be fixed, or functions of the
  // scene's stats (for a topic that shows one of several things).
  const read = (v) => (typeof v === "function" ? v(scene.stats) : v);

  // Source is extracted and highlighted once per topic (or per variant of
  // one, when the topic has a key), on first open.
  const codeCache = new Map();
  const codeFor = (topic) => {
    const key = `${topic.id}:${topic.key ? topic.key(scene.stats) : ""}`;
    if (!codeCache.has(key)) {
      codeCache.set(
        key,
        read(topic.sources)
          .map(({ file, src, name, marks }) => {
            // a named function / block, or the whole file when no name is given
            const found = name ? extract(src, name) : { code: src.trimEnd(), line: 1 };
            if (!found) return "";
            const code = highlight(found.code, { firstLine: found.line, marks, lang: langOf(file) });
            return `<figure class="src"><figcaption>${file}<span>:${found.line}</span></figcaption><pre><code>${code}</code></pre></figure>`;
          })
          .join(""),
      );
    }
    return codeCache.get(key);
  };

  // Actions come in three kinds: commands (do something once), toggles (pick
  // one state; the selected one stays lit), and a search box.
  function renderActions(topic) {
    const actions = $(".inspector__actions");
    actions.innerHTML = "";
    const refresh = () => {
      live.textContent = topic.live(scene.stats).join("\n");
      actions.querySelectorAll("button[data-k]").forEach((b) => {
        const a = topic.actions[b.dataset.k];
        if (a.isOn) b.classList.toggle("is-on", a.isOn(scene.stats));
      });
    };
    (topic.actions || []).forEach((a, k) => {
      if (a.type === "search") {
        const input = document.createElement("input");
        input.type = "search";
        input.placeholder = a.placeholder;
        input.setAttribute("aria-label", a.placeholder);
        input.value = a.value(scene.stats);
        input.addEventListener("input", () => {
          a.run(scene, input.value);
          refresh();
        });
        actions.appendChild(input);
        return;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.k = k;
      b.textContent = a.label;
      b.classList.toggle("is-primary", !a.isOn);
      b.addEventListener("click", () => {
        a.run(scene);
        // picking a variant redraws the whole panel for it
        if (a.reopen) return open(topic.id, true);
        const input = actions.querySelector("input");
        if (input && a.fills) input.value = a.fills;
        refresh();
      });
      actions.appendChild(b);
    });
    refresh();
  }

  function open(id, keepScroll = false) {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return;
    current = topic;
    const badge = BADGES[topic.provenance];
    $(".inspector__kicker").innerHTML = topic.kicker + (badge ? ` <span class="inspector__badge" title="${badge.title}">${badge.label}</span>` : "");
    $(".inspector__title").textContent = read(topic.title);
    $(".inspector__summary").innerHTML = read(topic.summary);
    $(".inspector__code").innerHTML = codeFor(topic);
    renderActions(topic);
    canvas.style.height = `${topic.vizHeight || 170}px`;
    chips.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.topic === id));
    host.classList.add("inspector-open");
    if (!keepScroll) $(".inspector__body").scrollTop = 0;
    live.textContent = topic.live(scene.stats).join("\n");
    tick = 1;
  }

  function close() {
    current = null;
    host.classList.remove("inspector-open");
    chips.querySelectorAll("button").forEach((b) => b.classList.remove("is-on"));
  }

  chips.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-topic]");
    if (b) b.classList.contains("is-on") ? close() : open(b.dataset.topic);
  });
  $(".inspector__close").addEventListener("click", close);

  // Notes drawn in the wireframe link straight to their topic.
  const fromNote = (e) => {
    const note = e.target.closest?.("[data-topic]");
    if (note && !chips.contains(note)) open(note.dataset.topic);
  };
  host.addEventListener("click", fromNote);
  host.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest?.(".bp-note[data-topic]")) {
      e.preventDefault();
      fromNote(e);
    }
  });

  /** Called every frame by the scene while blueprint mode is on. */
  function frame(t) {
    if (!current) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    current.viz(ctx, w, h, t, scene.stats);
    if (tick++ % 5 === 0) live.textContent = current.live(scene.stats).join("\n");
  }

  return {
    open,
    close,
    frame,
    get isOpen() {
      return !!current;
    },
    get topic() {
      return current?.id;
    },
  };
}
