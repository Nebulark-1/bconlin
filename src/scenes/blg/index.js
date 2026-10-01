import { clamp, range, easeOutCubic, easeInOutCubic } from "../../engine/math.js";
import { reducedMotion } from "../../engine/scroll.js";
import { createDeck } from "../../engine/deck.js";
import { createInspector } from "../../inspect/inspector.js";
import { blgTopics } from "../../inspect/topics-blg.js";
import { applyTokens } from "./tokens.js";
import { BEATS, BINS, BIN_LABELS, BAR_VALUES, makeSheets, makeAudit, matchLedger, sheetBetween, layout, createConductor } from "./choreo.js";

// Beats of the chapter, as fractions of its scroll track.
export const ENTER_END = 0.1;
export const EXIT_START = 0.9;

const HEADS = [
  ["§ 2.1 · The paperwork", "Paper."],
  ["§ 2.2 · The pipeline", "Sorted."],
  ["§ 2.3 · The audit", "Reconciled."],
  ["§ 2.4 · The numbers", "Measured."],
  ["§ 2.5 · The operating system", "Systematized."],
];
const TILES = [
  ["Time", "entries, approvals, realization"],
  ["PTO", "requests and balances"],
  ["Intake", "new matters, conflicts"],
  ["IT help", "tickets and devices"],
  ["Benefits", "enrollment and docs"],
  ["Ops manual", "every procedure, searchable"],
];
const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (day) => new Date(2019, 0, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function blgScene(root, chapter, blueprint) {
  const panel = root.querySelector(".panel");
  const visual = root.querySelector(".blg-visual");
  const heads = root.querySelector(".blg-heads");
  const folio = root.querySelector(".blg-folio__n");

  // ── Headlines: one per beat, letters masked so they can rise in ──
  heads.innerHTML = HEADS.map(
    ([kicker, word], b) =>
      `<div class="blg-head" data-beat="${b}"><p class="blg-head__kicker">${kicker}</p><h2 class="blg-head__word" aria-label="${word}">${[...word]
        .map((ch, i) => `<span style="--i:${i}" aria-hidden="true">${ch}</span>`)
        .join("")}</h2></div>`,
  ).join("");
  const headEls = [...heads.children];

  // ── Documents ──
  const sheets = makeSheets();
  const sheetEls = sheets.map((s) => {
    const el = document.createElement("div");
    el.className = "sheet";
    el.dataset.kind = s.kind;
    const tag = s.route.by === "rule" ? "RULE 1.00" : `${s.route.review ? "REVIEW" : "MODEL"} ${s.route.confidence.toFixed(2)}`;
    el.innerHTML = `<div class="sheet__paper"><b>${s.title}</b><i></i></div><div class="sheet__ink"></div><span class="sheet__tag${s.route.review ? " is-review" : ""}">${tag}</span>`;
    visual.appendChild(el);
    return el;
  });

  // ── Overlays for each beat ──
  const bins = BINS.map((kind) => {
    const el = document.createElement("div");
    el.className = "blg-bin";
    const n = sheets.filter((s) => s.kind === kind);
    el.innerHTML = `<b>${BIN_LABELS[kind]}</b><span>${n.length} routed · ${n.filter((s) => s.route.review).length} to review</span>`;
    visual.appendChild(el);
    return el;
  });
  const scan = document.createElement("div");
  scan.className = "blg-scan";
  visual.appendChild(scan);

  const audit = makeAudit();
  const match = matchLedger(audit.ledger, audit.receipts);
  const matchedRow = new Map(match.pairs.map((p) => [p.li, p.ri]));
  const ledger = document.createElement("div");
  ledger.className = "blg-ledger";
  ledger.innerHTML =
    `<div class="blg-ledger__head"><span>Posted</span><span>Payee</span><span>Amount</span><span></span></div>` +
    audit.ledger
      .map((row, li) => {
        const ok = matchedRow.has(li);
        return `<div class="blg-row${ok ? "" : " is-exception"}"><span>${date(row.day)}</span><span>${row.payee}</span><span>${money(row.amount)}</span><span>${ok ? "✓" : "no match"}</span></div>`;
      })
      .join("");
  visual.appendChild(ledger);
  const rows = [...ledger.querySelectorAll(".blg-row")];
  const slips = audit.receipts.map((rc) => {
    const el = document.createElement("div");
    el.className = "blg-slip";
    el.innerHTML = `<span>${rc.vendor}</span><b>${money(rc.amount)}</b>`;
    visual.appendChild(el);
    return el;
  });
  const NS = "http://www.w3.org/2000/svg";
  const links = document.createElementNS(NS, "svg");
  links.classList.add("blg-links");
  visual.appendChild(links);
  const linkEls = match.pairs.map(() => {
    const p = document.createElementNS(NS, "path");
    links.appendChild(p);
    return p;
  });
  const stat = document.createElement("div");
  stat.className = "blg-stat";
  stat.innerHTML = `<span class="blg-stat__label">attorney hours</span><b class="blg-stat__n">200</b><span class="blg-stat__was">projected 200+ · $80,000</span>`;
  visual.appendChild(stat);
  const statN = stat.querySelector(".blg-stat__n");

  const chart = document.createElement("div");
  chart.className = "blg-chart";
  chart.innerHTML =
    `<p class="blg-chart__cap">Margin by attorney <em>illustrative data</em></p><div class="blg-chart__base"></div>` +
    BAR_VALUES.map((_, i) => `<span class="blg-chart__lbl">${String.fromCharCode(65 + i)}</span>`).join("");
  visual.appendChild(chart);
  const chartLbls = [...chart.querySelectorAll(".blg-chart__lbl")];

  const app = document.createElement("div");
  app.className = "blg-app";
  app.innerHTML = `
    <div class="blg-app__bar"><i></i><i></i><i></i><span>intranet / home</span></div>
    <nav class="blg-app__nav"><b>Firm</b>${["Home", ...TILES.map((t) => t[0])].map((n, i) => `<span${i ? "" : ' class="is-on"'}>${n}</span>`).join("")}</nav>
    <div class="blg-app__hero"><span>hours saved / week</span><b>50+</b><em>200+ at full adoption</em></div>`;
  visual.appendChild(app);
  const tileLbls = TILES.map(([name, sub]) => {
    const el = document.createElement("div");
    el.className = "blg-tile";
    el.innerHTML = `<b>${name}</b><span>${sub}</span>`;
    visual.appendChild(el);
    return el;
  });

  // ── Résumé cards: same zoom-swap deck as Michigan Tech, new skin ──
  const deck = createDeck({
    panel,
    card: root.querySelector(".card"),
    cards: chapter.cards,
    render: (c) => `
      <p class="card__eyebrow">${c.eyebrow}</p>
      <h3 class="card__title">${c.title}</h3>
      <ol class="card__list">${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ol>`,
  });

  // ── Layout ──
  let R = { x: 0, y: 0, w: 1, h: 1 };
  let unit = 40;
  let tokens = null;
  function frame() {
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    if (!w || !h) return;
    tokens = applyTokens(root, w);
    const wide = w >= 760;
    root.classList.toggle("is-narrow", !wide);
    R = wide ? { x: w * 0.44, y: h * 0.14, w: w * 0.52, h: h * 0.74 } : { x: w * 0.06, y: h * 0.1, w: w * 0.88, h: h * 0.4 };
    unit = Math.min(R.w * 0.1, R.h * 0.11);
    visual.style.setProperty("--u", `${unit}px`);
    sheetEls.forEach((el) => {
      el.style.width = `${unit}px`;
      el.style.height = `${unit * 1.3}px`;
    });
    links.setAttribute("viewBox", `0 0 ${w} ${h}`);
    heads.dataset.spec = `Instrument Serif · t6 = ${tokens.scale[6]}px · 4:3 scale from ${tokens.scale[0]}px`;
    placeOverlays();
    deck.place();
  }

  const pos = (el, x, y, w, h) => {
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (w !== undefined) el.style.width = `${w.toFixed(1)}px`;
    if (h !== undefined) el.style.height = `${h.toFixed(1)}px`;
  };

  // Overlays are positioned from the same layout() maths the sheets use.
  function placeOverlays() {
    bins.forEach((el, b) => pos(el, R.x + R.w * (0.125 + b * 0.25) - R.w * 0.11, R.y + R.h * 0.8, R.w * 0.22));
    // rows share the receipts' vertical rhythm, so row li is centred on slot li
    const rowH = R.h * 0.066;
    ledger.style.setProperty("--row", `${rowH}px`);
    pos(ledger, R.x + R.w * 0.34, R.y + R.h * 0.09 - rowH * 1.5, R.w * 0.66);
    sheets
      .filter((s) => s.kind === "receipt")
      .forEach((s) => {
        const L = layout(2, s, R, unit);
        pos(slips[s.k], L.x - L.w / 2, L.y - L.h / 2, L.w, L.h);
      });
    pos(stat, R.x + R.w * 0.34, R.y + R.h * 0.885);
    BAR_VALUES.forEach((_, i) => pos(chartLbls[i], R.w * (0.1 + i * 0.115) - 10, R.h * 0.88, 20)); // relative to the chart
    pos(chart, R.x, R.y, R.w, R.h);
    pos(app, R.x, R.y + R.h * 0.02, R.w, R.h * 0.96);
    tileLbls.forEach((el, t) => {
      const L = layout(4, { i: t, k: 0, kind: "notice" }, R, unit);
      pos(el, L.x - L.w / 2, L.y - L.h / 2, L.w, L.h);
    });
  }

  // ── Behind the scenes ──
  const stats = { sheets, audit, match, role: "partner", query: "new client" };
  const inspector = createInspector(panel, blgTopics, { stats });
  blueprint?.subscribe((on) => {
    if (!on) inspector.close();
  });

  frame();
  window.addEventListener("resize", frame);
  if (document.fonts) document.fonts.ready.then(frame);

  // Scroll picks the beat; the conductor plays each change as a timed move.
  const conductor = createConductor(reducedMotion ? 0.001 : 1.1);
  let last = performance.now();
  let beat = -1;

  return {
    get card() {
      return deck.current;
    },

    update(p) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const enter = easeOutCubic(range(p, 0, ENTER_END));
      const exit = easeInOutCubic(range(p, EXIT_START, 1));
      const hold = range(p, ENTER_END, EXIT_START);

      // The page slides up into place like a sheet laid on a desk, then is
      // lifted away.
      panel.style.transform = `translateY(${((1 - enter) * 104 - exit * 106).toFixed(2)}%) rotate(${((1 - enter) * -3 + exit * 2.5).toFixed(2)}deg)`;

      // Which beat the scroll position asks for (-1: documents still above
      // the page). The conductor walks there in whole, timed moves.
      const target = enter < 0.55 ? -1 : Math.min(BEATS - 1, Math.floor(hold * BEATS));
      const c = conductor.tick(target, dt, now);

      for (let i = 0; i < sheets.length; i++) {
        const st = sheetBetween(sheets[i], c.from, c.to, c.t, R, unit);
        const el = sheetEls[i];
        el.style.transform = `translate(${(st.x - unit / 2).toFixed(1)}px, ${(st.y - unit * 0.65).toFixed(1)}px) rotate(${st.r.toFixed(2)}deg) scale(${(st.w / unit).toFixed(4)}, ${(st.h / (unit * 1.3)).toFixed(4)})`;
        el.style.opacity = st.o.toFixed(3);
        el.style.setProperty("--paper", st.paper.toFixed(3));
        el.style.setProperty("--ink", st.ink.toFixed(3));
      }

      // Overlays cross-fade with the move; flourishes play once a beat lands.
      const show = (el, k) => (el.style.opacity = c.presence(k).toFixed(3));
      root.style.setProperty("--tags", c.presence(1).toFixed(3));
      bins.forEach((el) => show(el, 1));
      const scanning = c.to === 1 && c.from === 0 && c.t < 1;
      scan.style.opacity = scanning ? (Math.sin(c.t * Math.PI) * 0.9).toFixed(3) : "0";
      scan.style.transform = `translate(${R.x.toFixed(1)}px, ${(R.y + R.h * (0.05 + 0.8 * c.t)).toFixed(1)}px)`;
      scan.style.width = `${R.w}px`;
      show(ledger, 2);
      slips.forEach((el) => show(el, 2));
      show(stat, 2);
      // the audit's links draw themselves once the receipts have landed
      const draw = conductor.arrival(2, now, 1.2);
      match.pairs.forEach((pair, k) => {
        const rc = sheets.find((s) => s.kind === "receipt" && s.k === pair.ri);
        const L = layout(2, rc, R, unit);
        const x0 = L.x + L.w / 2;
        const x1 = R.x + R.w * 0.34;
        const y1 = R.y + R.h * (0.09 + pair.li * 0.066);
        const path = linkEls[k];
        path.setAttribute("d", `M${x0} ${L.y} C${(x0 + x1) / 2} ${L.y} ${(x0 + x1) / 2} ${y1} ${x1} ${y1}`);
        const len = 400;
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${(len * (1 - clamp(draw * 1.6 - k * 0.05))).toFixed(1)}`;
        path.style.opacity = c.presence(2).toFixed(3);
      });
      rows.forEach((row, li) => row.classList.toggle("is-checked", draw > 0.15 + li * 0.05));
      const saved = easeInOutCubic(clamp((conductor.arrival(2, now, 2) - 0.4) / 0.6));
      statN.textContent = String(Math.round(200 - 150 * saved));
      show(chart, 3);
      show(app, 4);
      tileLbls.forEach((el) => show(el, 4));

      // Headline, folio and card announce a beat as soon as its move begins.
      const open = enter > 0.96 && exit < 0.03;
      const current = open ? Math.max(0, c.to) : -1;
      if (current !== beat) {
        beat = current;
        headEls.forEach((el, k) => el.classList.toggle("is-on", k === current));
        if (current >= 0) folio.textContent = `${String(current + 1).padStart(2, "0")} / ${String(BEATS).padStart(2, "0")}`;
      }
      deck.set(current);
      root.classList.toggle("is-open", open);

      if (blueprint?.on) inspector.frame(now / 1000);
    },
  };
}
