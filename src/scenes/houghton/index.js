import { clamp, lerp, planeMatrix, range, easeOutCubic, easeInCubic, easeInOutCubic } from "../../engine/math.js";
import { reducedMotion } from "../../engine/scroll.js";
import { createDeck } from "../../engine/deck.js";
import { createSnow } from "../../art/snow.js";
import { createAurora } from "../../art/aurora.js";
import { buildLayers, buildStats, HORIZON } from "./art.js";
import { createInspector } from "../../inspect/inspector.js";
import { topics } from "../../inspect/topics.js";

// Beats of the scene, as fractions of its scroll track.
export const ENTER_END = 0.18; // scene has fully opened
export const EXIT_START = 0.82; // scene starts sweeping away

const NS = "http://www.w3.org/2000/svg";

// Where the résumé box sits for each beat, as fractions of the free space in
// the panel. It hops between them while zoomed out, so it reads as a cut.
const SPOTS = [
  [0, 0],
  [1, 0.05],
  [0.06, 0.1],
  [0.94, 0],
];

export function houghtonScene(root, chapter, blueprint) {
  const panel = root.querySelector(".panel");
  const art = root.querySelector(".art");

  // ── Build the layered artwork ─────────────────────────────
  const layers = buildLayers({ seed: 0 }).map(({ name, depth, ground, markup, canvas }) => {
    let el;
    if (canvas) {
      el = document.createElement("canvas");
    } else {
      el = document.createElementNS(NS, "svg");
      el.setAttribute("preserveAspectRatio", "xMidYMid slice");
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = markup;
    }
    el.classList.add("layer", `layer--${name}`);
    art.appendChild(el);
    return { el, name, depth, ground, canvas };
  });
  // Blueprint mode: each plane gets its own wire colour, back (violet) to front (white).
  const WIRES = ["#8f86ff", "#6cf0c2", "#a3b4ff", "#7fd2ff", "#5ec8ff", "#ffcf86", "#bfe6ff", "#ffffff"];
  layers.forEach((l, i) => {
    l.el.style.setProperty("--wire", WIRES[i % WIRES.length]);
    l.z = l.ground ? 0.55 : l.depth; // where the plane sits in the exploded stack
  });
  const svgs = layers.filter((l) => !l.canvas);

  const snow = createSnow(layers.find((l) => l.canvas === "snow").el);
  const aurora = createAurora(layers.find((l) => l.canvas === "aurora").el);

  // ── Framing ───────────────────────────────────────────────
  // Wide panels crop the 1600×900 plate top and bottom as usual. Narrower
  // panels widen the view (up to 40% taller than the plate) and reveal more
  // sky instead of slicing the landmarks off the sides.
  // `plate` maps plate y → layer pixels: px = oy + y * k.
  // `left`/`right` are the plate x-coordinates at the panel's visible edges.
  const plate = { k: 1, oy: 0, left: 0, right: 1600 };
  function frame() {
    const { clientWidth: w, clientHeight: h } = svgs[0].el;
    if (!w || !h) return;
    const aspect = w / h;
    let box = "0 0 1600 900";
    let [x0, vw] = [0, 1600];
    if (aspect >= 1600 / 900) {
      plate.k = w / 1600;
      plate.oy = (h - 900 * plate.k) / 2;
    } else {
      vw = Math.max(900 * aspect, Math.min(1600, 900 * aspect * 1.4));
      x0 = 800 - vw / 2;
      const vh = vw / aspect;
      box = `${x0.toFixed(1)} ${(900 - vh).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
      plate.k = h / vh;
      plate.oy = -(900 - vh) * plate.k;
    }
    // layers overhang the panel by 5% of its width on each side (110% wide)
    plate.left = x0 + vw * (0.05 / 1.1);
    plate.right = x0 + vw * (1.05 / 1.1);
    svgs.forEach(({ el }) => el.setAttribute("viewBox", box));
    aurora.horizon = plate.oy + HORIZON * plate.k;

    // Blueprint plane outlines hug each layer's full extent; text is sized
    // in screen pixels whatever the plate scale.
    const top = -plate.oy / plate.k;
    const bottom = (h - plate.oy) / plate.k;
    art.style.setProperty("--k", (plate.k * 0.75).toFixed(4));
    svgs.forEach(({ el }, i) => {
      const g = el.querySelector(".bp-plane");
      if (!g) return;
      const inset = 4 / plate.k;
      const fr = g.querySelector(".bp-frame");
      fr.setAttribute("x", x0 + inset);
      fr.setAttribute("y", top + inset);
      fr.setAttribute("width", vw - inset * 2);
      fr.setAttribute("height", bottom - top - inset * 2);
      // each plane's tag sits one row lower than the plane behind it, so
      // the tags stay legible when the stack is exploded
      const pad = 18 / plate.k;
      const row = top + pad * 1.6 + (i * 52) / plate.k;
      g.querySelector(".bp-name").setAttribute("x", x0 + pad + vw * 0.045);
      g.querySelector(".bp-name").setAttribute("y", row);
      g.querySelector(".bp-detail").setAttribute("x", x0 + pad + vw * 0.045);
      g.querySelector(".bp-detail").setAttribute("y", row + 15 / plate.k);
    });
    deck.place();
  }

  // ── Runner ────────────────────────────────────────────────
  // The trail is sampled once (and again after a reseed) so the runner can
  // be placed by x-position with a cheap lookup.
  let runner;
  let trail;
  let joints;
  function bindRunner() {
    const trailEl = root.querySelector(".ridge");
    const length = trailEl.getTotalLength();
    runner = root.querySelector(".runner-track");
    trail = Array.from({ length: 241 }, (_, i) => trailEl.getPointAtLength((length * i) / 240));
    joints = Object.fromEntries(
      ["thigh", "shin", "arm"].flatMap((j) => ["a", "b"].map((s) => [`${j}${s.toUpperCase()}`, runner.querySelector(`.${j}--${s}`)])),
    );
  }
  bindRunner();
  const trailAt = (x) => {
    const i = trail.findIndex((pt) => pt.x >= x);
    if (i === -1) return trail[trail.length - 1];
    if (i === 0) return trail[0];
    const [a, b] = [trail[i - 1], trail[i]];
    return { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) };
  };
  let facing = 1;

  // ── Résumé box ────────────────────────────────────────────
  // One box that zooms out, hops to the next spot, and zooms back in.
  const deck = createDeck({
    panel,
    card: root.querySelector(".card"),
    cards: chapter.cards,
    pips: root.querySelector(".pips"),
    spots: (i, narrow) => (narrow ? [0, i % 2 ? 0.02 : 0] : SPOTS[i % SPOTS.length]),
    render: (c, i) => `
      <p class="card__eyebrow"><span>${String(i + 1).padStart(2, "0")}</span>${c.eyebrow}</p>
      <h2 class="card__title">${c.title}</h2>
      ${c.meta ? `<p class="card__meta">${c.meta}</p>` : ""}
      <ul class="card__list">${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`,
  });

  // ── Behind the scenes ─────────────────────────────────────
  // Live state the inspector's visualizations read.
  const stats = {
    p: 0, raw: 0, enter: 0, hold: 0, exit: 0,
    history: [], // [raw, rendered] progress, last ~4 s
    ground: null,
    runnerX: 0,
    jointAngles: null,
    jointHistory: [],
    aurora,
    build: buildStats,
  };

  // Regenerate every SVG layer from a new seed, in place.
  function reseed(seed) {
    for (const { name, markup } of buildLayers({ seed })) {
      const layer = layers.find((l) => l.name === name);
      if (markup && layer) layer.el.innerHTML = markup;
    }
    bindRunner();
    frame();
  }

  const inspector = createInspector(panel, topics, { stats, reseed });
  let introduced = false;

  const hud = root.querySelector(".bp-hud");
  let bpTarget = 0;
  let bp = 0; // 0 → 1, eased, so the stack tilts apart smoothly
  let fps = 60;
  let updateMs = 0;
  let lastFrame = performance.now();
  let hudTick = 0;
  let groundMatrix = "";
  blueprint?.subscribe((on) => {
    bpTarget = on ? 1 : 0;
    aurora.debug = on;
    snow.debug = on;
    // the first time someone flips the switch, open on the most fun topic
    if (on && !introduced && blueprint.on && document.readyState !== "loading") {
      introduced = true;
      inspector.open("rng");
    } else if (!on) inspector.close();
  });

  frame();
  window.addEventListener("resize", frame);
  if (document.fonts) document.fonts.ready.then(frame);

  return {
    /** Index of the résumé card the scroll position is on (-1 when closed). */
    get card() {
      return deck.current;
    },

    onActive(active) {
      snow.running = active && !reducedMotion;
      aurora.running = active && !reducedMotion;
      if (active && reducedMotion) aurora.still();
    },

    update(p, { pointer, velocity, raw = p }) {
      const t0 = performance.now();
      const enter = easeOutCubic(range(p, 0, ENTER_END));
      const exit = easeInOutCubic(range(p, EXIT_START, 1));
      const hold = range(p, ENTER_END, EXIT_START);
      const vh = panel.clientHeight / 100;

      // The panel opens from a slit of light, then wipes up and away.
      const top = (1 - enter) * 44;
      const side = (1 - enter) * 10;
      const bottom = (1 - enter) * 44 + exit * 100;
      panel.style.setProperty("--clip", `inset(${top.toFixed(2)}% ${side.toFixed(2)}% ${bottom.toFixed(2)}% ${side.toFixed(2)}% round ${(18 + (1 - enter) * 40).toFixed(1)}px)`);
      // Blueprint: the art stack tilts and explodes into its planes.
      bp = reducedMotion ? bpTarget : lerp(bp, bpTarget, 0.07);
      if (Math.abs(bp - bpTarget) < 0.001) bp = bpTarget;
      root.classList.toggle("is-exploded", bp > 0);
      const baseScale = 1 + (1 - enter) * 0.08 + exit * 0.03;
      art.style.transform =
        `scale(${(baseScale * (1 - 0.34 * bp)).toFixed(4)})` +
        (bp ? ` translateX(${(-(inspector.isOpen && panel.clientWidth > 900 ? 22 : 4) * bp).toFixed(2)}%) rotateX(${(14 * bp).toFixed(2)}deg) rotateY(${(-22 * bp).toFixed(2)}deg)` : "");
      const spread = Math.min(panel.clientWidth, 1000) * 0.8 * bp;
      const lift = (z) => (bp ? ` translateZ(${((z - 0.65) * spread).toFixed(1)}px)` : "");

      // Every layer's offset is linear in its depth d: offset = A + B·d.
      // Keeping it linear is what lets a ground plane interpolate cleanly.
      const ax = 0;
      const bx = pointer.sx * -26;
      const ay = (1 - enter) * 6 * vh - exit * 8 * vh;
      const by = (1 - enter) * 38 * vh + (hold - 0.5) * -70 + pointer.sy * -12 - exit * 70 * vh;
      const at = (d) => [ax + bx * d, ay + by * d];

      for (const { el, depth, ground, z } of layers) {
        if (!ground) {
          const [x, y] = at(depth);
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` + lift(z);
          continue;
        }
        // Ground plane: the horizon edge moves at depth `near`, the bottom
        // edge at `far`, and every row between is interpolated - an affine
        // shear + stretch, so the canal stays glued to Lake Superior.
        const yTop = plate.oy + ground.top * plate.k;
        const yBot = plate.oy + ground.bottom * plate.k;
        const near = at(ground.near);
        const far = at(ground.far);
        const m = planeMatrix(near, far, yTop, yBot);
        stats.ground = { near, far, yTop, yBot, m };
        groundMatrix = `matrix(${m.map((v, i) => v.toFixed(i < 4 ? 5 : 2)).join(", ")})`;
        el.style.transform = groundMatrix + lift(z);
      }

      // Runner: sprints in from off-screen as the chapter starts, jogs the
      // trail through the middle, and runs off the far edge at the end.
      // Turns around if you scroll back.
      if (velocity > 0.6) facing = 1;
      else if (velocity < -0.6) facing = -1;
      const span = plate.right - plate.left;
      const [offL, a, b, offR] = [plate.left - 70, plate.left + span * 0.22, plate.left + span * 0.78, plate.right + 70];
      let rx;
      if (hold < 0.1) rx = offL + (a - offL) * easeOutCubic(hold / 0.1);
      else if (hold > 0.9) rx = b + (offR - b) * easeInCubic((hold - 0.9) / 0.1);
      else rx = a + ((b - a) * (hold - 0.1)) / 0.8;
      const pt = trailAt(rx);
      runner.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${(pt.y + 4).toFixed(1)}) scale(${facing} 1)`);

      // Résumé box: one beat per card, only while the scene is fully open.
      const open = enter > 0.96 && exit < 0.03;
      deck.set(open ? Math.min(deck.count - 1, Math.floor(hold * deck.count * 1.0001)) : -1);
      root.classList.toggle("is-open", open);
      root.style.setProperty("--cards-x", `${(pointer.sx * -6).toFixed(1)}px`);
      root.style.setProperty("--cards-y", `${(pointer.sy * -4).toFixed(1)}px`);

      snow.intensity = clamp(enter * (1 - exit * 1.4));
      snow.push = velocity;
      aurora.intensity = clamp(enter * (1 - exit * 1.2));

      // Feed the inspector.
      Object.assign(stats, { p, raw, enter, hold, exit, runnerX: rx });
      stats.history.push([raw, p]);
      if (stats.history.length > 240) stats.history.shift();
      if (bp > 0.5 && inspector.topic === "runner") {
        const angle = (el) => parseFloat(getComputedStyle(el).rotate) || 0;
        stats.jointAngles = Object.fromEntries(Object.entries(joints).map(([k, el]) => [k, angle(el)]));
        stats.jointHistory.push(stats.jointAngles);
        if (stats.jointHistory.length > 120) stats.jointHistory.shift();
      }
      if (bp > 0.5) inspector.frame(performance.now() / 1000);

      // Live readout of the machinery, refreshed a few times a second.
      const now = performance.now();
      fps = lerp(fps, 1000 / Math.max(1, now - lastFrame), 0.1);
      updateMs = lerp(updateMs, now - t0, 0.1);
      lastFrame = now;
      if (bp > 0.01 && ++hudTick % 6 === 0) {
        const f = (v) => v.toFixed(2);
        hud.textContent = [
          `scroll   p ${f(p)}   enter ${f(enter)}   hold ${f(hold)}   exit ${f(exit)}`,
          `card     ${deck.current + 1 || "–"} / ${deck.count}${" ".repeat(10)}fps ${Math.round(fps)}`,
          `parallax offset = A + B·d   A ${ay.toFixed(1)}px   B ${by.toFixed(1)}px`,
          `canal    ${groundMatrix}`,
          `aurora   ${aurora.rays ?? 0} rays this frame · fbm value noise`,
          `snow     ${snow.count ?? 0} flakes · push ${velocity.toFixed(1)}`,
          `runner   x ${rx.toFixed(0)} on a 241-point trail lookup`,
          `build    seed ${buildStats.seed} · ${buildStats.trees} trees · ${(buildStats.bytes / 1024).toFixed(0)} KB SVG in ${buildStats.ms.toFixed(1)} ms`,
          `frame    scene update ${updateMs.toFixed(2)} ms`,
        ].join("\n");
      }
    },
  };
}
