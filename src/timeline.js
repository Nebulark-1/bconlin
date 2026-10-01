import { clamp, lerp, interpolateStops } from "./engine/math.js";
import { reducedMotion, glideTo } from "./engine/scroll.js";

/**
 * The left-hand career rail: a path that wanders down past each chapter.
 * A marker rides the path with scroll. Chapters are dotted stops; a chapter's
 * beats (its résumé cards) are quieter sub-stops along the leg that follows
 * it. Clicking either glides the page there, playing through the scenes.
 * Chapters without a scene yet render as "soon".
 *
 * stops:   [{ label, when, target?: () => scrollY, subs?: [{ label, target }] }]
 * anchors: (pos) => [[scrollY, position], ...] where pos(i, j?) gives the
 *          rail position of stop i (or its sub-stop j) - maps scroll → rail.
 * activeSub: () => ({ stop, sub }) | null - the beat actually on screen, so
 *          sub-stop highlighting matches the scene rather than the marker.
 */
export function createTimeline(nav, stops, anchors, activeSub = () => null) {
  const svg = nav.querySelector(".rail__svg");
  const base = svg.querySelector(".rail__path");
  const progress = svg.querySelector(".rail__progress");
  const marker = svg.querySelector(".rail__marker");
  const ticks = svg.querySelector(".rail__ticks");
  const list = nav.querySelector(".rail__stops");
  const scratch = document.createElementNS("http://www.w3.org/2000/svg", "path");
  scratch.setAttribute("fill", "none"); // measuring only, never drawn
  svg.appendChild(scratch);

  // Where each sub-stop sits along the leg after its chapter (a fraction of
  // that leg), filled in by layout() so the rows fall on an even rhythm.
  const subAt = stops.map((st) => (st.subs || []).map((_, j, all) => (j + 1) / (all.length + 1)));
  const subPos = (i, j) => i + subAt[i][j];
  const pos = (i, j) => (j === undefined ? i : subPos(i, j));

  const go = (target) => () => glideTo(target());
  const items = [];
  stops.forEach((stop, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "stop";
    btn.innerHTML = `<span class="stop__dot"></span><span class="stop__text"><span class="stop__label">${stop.label}</span><span class="stop__when">${stop.when}</span></span>`;
    if (stop.target) btn.addEventListener("click", go(stop.target));
    else {
      btn.disabled = true;
      btn.classList.add("is-soon");
    }
    li.appendChild(btn);
    list.appendChild(li);
    items.push({ li, btn, at: i });

    (stop.subs || []).forEach((sub, j) => {
      const sli = document.createElement("li");
      sli.className = "sub";
      const sbtn = document.createElement("button");
      sbtn.type = "button";
      sbtn.className = "stop stop--sub";
      sbtn.innerHTML = `<span class="stop__label">${sub.label}</span>`;
      sbtn.addEventListener("click", go(sub.target));
      sli.appendChild(sbtn);
      list.appendChild(sli);
      items.push({ li: sli, btn: sbtn, at: 0, stop: i, sub: j });
    });
  });

  let length = 0;
  let stopFracs = [];
  let map = [];
  let smooth = 0;

  // rail position (fractional stop index) → fraction of path length
  const fracOf = (p) => {
    const i = clamp(Math.floor(p), 0, stopFracs.length - 2);
    return lerp(stopFracs[i], stopFracs[i + 1], clamp(p - i));
  };

  // Rows run top to bottom: each chapter, then its beats. Gaps are in
  // units: a beat follows the one before it by 1, a chapter's first beat
  // sits a little further below its two-line label, and a new chapter gets
  // the most room above it. One unit is whatever the rail's height allows.
  const GAP = { beat: 1, afterChapter: 1.35, beforeChapter: 1.9 };

  function layout() {
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    if (!h) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const x = 28;
    const pad = 22;
    const bulge = w > 120 ? 18 : 10;

    const rows = [];
    stops.forEach((st, i) => {
      rows.push({ i });
      (st.subs || []).forEach((_, j) => rows.push({ i, j }));
    });
    // a last chapter with beats gets one more leg to hang them on
    const tail = (stops[stops.length - 1].subs || []).length > 0;
    let units = 0;
    rows.forEach((r, k) => {
      if (k === 0) return r.u = 0;
      const prev = rows[k - 1];
      units += r.j === undefined ? GAP.beforeChapter : prev.j === undefined ? GAP.afterChapter : GAP.beat;
      r.u = units;
    });
    const end = units + (tail ? GAP.beforeChapter : 0);
    const unit = (h - pad * 2) / Math.max(1, end);
    rows.forEach((r) => (r.y = pad + r.u * unit));
    nav.classList.toggle("rail--compact", unit < 14);

    // chapter heights, plus the tail's end
    const ys = stops.map((_, i) => rows.find((r) => r.i === i && r.j === undefined).y);
    if (tail) ys.push(pad + end * unit);

    // Each leg swings out and back, alternating sides, so the line wanders.
    const legs = [];
    for (let i = 0; i < ys.length - 1; i++) {
      const [y0, y1] = [ys[i], ys[i + 1]];
      const dy = y1 - y0;
      // a short leg gets a gentler swing, so it stays clear of the labels
      const b = Math.min(bulge, dy * 0.32) * (i % 2 ? -0.6 : 1);
      legs.push(
        `C${x + b} ${y0 + dy * 0.2} ${x + b * 1.2} ${y0 + dy * 0.42} ${x + b * 0.4} ${y0 + dy * 0.55} ` +
          `S${x - b * 0.5} ${y0 + dy * 0.85} ${x} ${y1}`,
      );
    }
    const d = `M${x} ${ys[0]} ` + legs.join(" ");
    base.setAttribute("d", d);
    progress.setAttribute("d", d);
    length = base.getTotalLength();

    stopFracs = ys.map((_, i) => {
      if (i === 0) return 0;
      scratch.setAttribute("d", `M${x} ${ys[0]} ` + legs.slice(0, i).join(" "));
      return scratch.getTotalLength() / length;
    });
    progress.style.strokeDasharray = `${length}`;

    // The path only ever moves downward, so the point at a given height can
    // be found by bisecting its length.
    const lengthAtY = (y) => {
      let lo = 0;
      let hi = length;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (base.getPointAtLength(mid).y < y) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };

    let tickD = "";
    for (const r of rows) {
      const item = items.find((it) => (r.j === undefined ? it.sub === undefined && it.at === r.i : it.stop === r.i && it.sub === r.j));
      item.li.style.top = `${r.y}px`;
      if (r.j === undefined) continue;
      // the beat's place along its leg, by length, so the marker lands on its tick
      const L = lengthAtY(r.y);
      const L0 = stopFracs[r.i] * length;
      const L1 = stopFracs[r.i + 1] * length;
      subAt[r.i][r.j] = (L - L0) / (L1 - L0);
      item.at = subPos(r.i, r.j);
      const pt = base.getPointAtLength(L);
      tickD += `M${(pt.x - 4).toFixed(1)} ${pt.y.toFixed(1)} h8 `;
    }
    ticks.setAttribute("d", tickD);
    map = anchors(pos);
  }

  function update() {
    if (!map.length) return;
    const target = interpolateStops(map, window.scrollY);
    smooth = reducedMotion ? target : lerp(smooth, target, 0.12);

    const frac = fracOf(smooth);
    const pt = base.getPointAtLength(frac * length);
    marker.setAttribute("cx", pt.x.toFixed(1));
    marker.setAttribute("cy", pt.y.toFixed(1));
    progress.style.strokeDashoffset = `${(length * (1 - frac)).toFixed(1)}`;

    // A chapter is current from the moment the marker reaches its dot until
    // it reaches the next one. A sub-stop is current exactly while its card
    // is the one on screen.
    const beat = activeSub();
    for (const item of items) {
      const { btn, at } = item;
      let current;
      let passed;
      if (item.sub === undefined) {
        current = smooth >= at - 0.03 && smooth < at + 0.97;
        passed = smooth >= at + 0.97;
      } else {
        current = !!beat && beat.stop === item.stop && beat.sub === item.sub;
        passed = !current && smooth > at;
      }
      btn.classList.toggle("is-current", current);
      btn.classList.toggle("is-passed", passed);
    }
    nav.style.setProperty("--rail-presence", clamp(0.45 + smooth * 1.2, 0, 1).toFixed(3));
  }

  layout();
  window.addEventListener("resize", layout);
  window.addEventListener("load", layout);
  return { update, layout };
}
