import { clamp, lerp, range, easeInOutCubic } from "../../engine/math.js";
import { reducedMotion } from "../../engine/scroll.js";
import { createConductor } from "../../engine/conductor.js";
import { createDeck } from "../../engine/deck.js";
import { createInspector } from "../../inspect/inspector.js";
import { uchTopics } from "../../inspect/topics-uch.js";
import { createHospital, TICK } from "./hospital.js";
import { ecg, pleth, advance } from "./ecg.js";
import { CELL, COLS, PREOP, PACU, ORS } from "./layout.js";
import { planMarkup, WIDE, RESTRICTED, shotForBay, shotForRoom, frame as framed, ROLE_COLORS, roleOf } from "./plan.js";

// Beats of the chapter, as fractions of its scroll track.
export const ENTER_END = 0.1;
export const EXIT_START = 0.9;

const BEATS = [
  { kicker: "3.1 · The unit", word: "Flow", color: "#39ff88", hr: 74, spo2: 98 },
  { kicker: "3.2 · Pre- and post-anesthesia", word: "Bedside", color: "#3fe0ff", hr: 92, spo2: 97 },
  { kicker: "3.3 · Shadowing", word: "In the room", color: "#ffd23f", hr: 58, spo2: 99 },
  { kicker: "3.4 · What carries over", word: "The system", color: "#e8f0ee", hr: 72, spo2: 98 },
];
const WARMUP = 150; // simulated seconds run in the background before anyone scrolls here
const NS = "http://www.w3.org/2000/svg";
const LEGEND = [
  ["nurse", "Pre-op / PACU nurse"],
  ["ornurse", "OR nurse"],
  ["surgeon", "Surgeon"],
  ["anesthesia", "Anesthesia"],
  ["you", "Me"],
];

const cellXY = (c) => ({ x: (c % COLS) * CELL + CELL / 2, y: Math.floor(c / COLS) * CELL + CELL / 2 });

export function uchScene(root, chapter, blueprint) {
  const panel = root.querySelector(".panel");
  const plan = root.querySelector(".mon-plan");
  const stage = root.querySelector(".mon-stage");
  const census = root.querySelector(".mon-census");
  const logEl = root.querySelector(".mon-log");
  const clock = root.querySelector(".mon-clock");
  const hrEl = root.querySelector(".mon-num--hr b");
  const spo2El = root.querySelector(".mon-num--spo2 b");
  const heads = root.querySelector(".mon-heads");

  plan.innerHTML = planMarkup();
  const peopleLayer = plan.querySelector(".people");
  const pathLayer = plan.querySelector(".paths");
  const orEls = [...plan.querySelectorAll(".room")];
  const preEls = [...plan.querySelectorAll(".bay--pre")];
  const pacuEls = [...plan.querySelectorAll(".bay--pacu")];

  const legend = document.createElement("div");
  legend.className = "mon-legend";
  legend.innerHTML = `<span><i class="is-dot" style="--c:#e8f0ee"></i>Patient · colour = stage</span>` + LEGEND.map(([k, name]) => `<span><i style="--c:${ROLE_COLORS[k]}"></i>${name}</span>`).join("");
  stage.appendChild(legend);

  heads.innerHTML = BEATS.map(
    (b, k) => `<div class="mon-headline" data-beat="${k}" style="--beat:${b.color}"><p>${b.kicker}</p><h2>${b.word}</h2></div>`,
  ).join("");
  const headEls = [...heads.children];

  // ── The department ──
  // hospital.js decides who goes where and plans every step on a shared
  // grid; this file only draws it, easing each person between cells.
  const hospital = createHospital();
  let acc = 0;
  function step(dt) {
    acc += dt;
    for (let k = 0; acc >= TICK && k < 2; k++) {
      acc -= TICK;
      hospital.tick();
    }
    acc = Math.min(acc, TICK);
  }
  // fill the unit up off-screen, in small slices so scrolling stays smooth
  (function warm() {
    const until = performance.now() + 6;
    while (hospital.clock < WARMUP && performance.now() < until) hospital.tick();
    if (hospital.clock < WARMUP) setTimeout(warm, 30);
  })();

  // ── People: patients are dots coloured by stage, staff are rings ──
  const sprites = new Map(); // person id → { el, x, y }
  function sprite(p) {
    const el = document.createElementNS(NS, "circle");
    const role = roleOf(p);
    el.setAttribute("r", role === "patient" ? 4.6 : role === "you" ? 4.4 : 3.6);
    el.style.setProperty("--c", ROLE_COLORS[role]);
    peopleLayer.appendChild(el);
    const at = cellXY(p.cell);
    return { el, role, x: at.x, y: at.y, cls: "" };
  }

  // someone in bed or on the table is drawn on it
  function lying(p) {
    if (p.onTable) return { x: (ORS[p.room].tableSpot.x + 0.5) * CELL, y: 50 * CELL };
    const b = p.stage === "pacu" || p.stage === "discharge" ? PACU[p.pacuBay] : PREOP[p.bay];
    return { x: (b.bed[0].x + 1.5) * CELL, y: b.top ? 21 * CELL : 35 * CELL };
  }

  function drawPeople(dt) {
    const alpha = clamp(acc / TICK);
    const ease = Math.min(1, dt * 16);
    for (const p of hospital.people.values()) {
      let s = sprites.get(p.id);
      if (!s) sprites.set(p.id, (s = sprite(p)));
      let tx;
      let ty;
      if (!p.leader && (p.inBed || p.onTable)) ({ x: tx, y: ty } = lying(p));
      else {
        const a = cellXY(p.prev);
        const b = cellXY(p.cell);
        tx = lerp(a.x, b.x, alpha);
        ty = lerp(a.y, b.y, alpha);
      }
      s.x += (tx - s.x) * ease;
      s.y += (ty - s.y) * ease;
      s.el.setAttribute("cx", s.x.toFixed(1));
      s.el.setAttribute("cy", s.y.toFixed(1));
      const cls = s.role === "patient" ? `who pt pt--${p.stage}` : `who staff staff--${s.role}`;
      if (cls !== s.cls) s.el.setAttribute("class", (s.cls = cls));
    }
    for (const [id, s] of sprites) {
      if (hospital.people.has(id)) continue;
      s.el.remove();
      sprites.delete(id);
    }
  }

  // ── Lighting, kept to a hint ──
  // Pre-op bays warm up when occupied (calm, not clinical); ORs light up
  // while a case is on; PACU starts dim for someone waking up and comes up
  // as they near discharge.
  const lit = new Map();
  const setLit = (el, v) => {
    const s = v.toFixed(2);
    if (lit.get(el) === s) return;
    lit.set(el, s);
    el.style.setProperty("--lit", s);
  };
  function drawLighting() {
    hospital.rooms.forEach((rm, k) => {
      setLit(orEls[k], rm.state === "case" ? 1 : rm.state === "open" || rm.state === "turnover" ? 0 : 0.5);
      orEls[k].classList.toggle("is-closed", k >= 12 - hospital.closed);
    });
    hospital.pacu.forEach((id, k) => {
      const p = id && hospital.people.get(id);
      let v = 0;
      if (p && p.stage === "pacu" && p.recoverStart !== undefined) v = 0.15 + 0.85 * clamp((hospital.clock - p.recoverStart) / p.recoverLength);
      else if (p && p.stage === "discharge") v = 1;
      setLit(pacuEls[k], v);
    });
    hospital.preop.forEach((id, k) => setLit(preEls[k], id ? 1 : 0));
  }

  // ── Behind the scenes: everyone's planned window ──
  const pathEls = Object.fromEntries(
    Object.keys(ROLE_COLORS).map((role) => {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("class", `plan plan--${role}`);
      el.style.setProperty("--c", ROLE_COLORS[role]);
      pathLayer.appendChild(el);
      return [role, el];
    }),
  );
  const goalEl = document.createElementNS(NS, "path");
  goalEl.setAttribute("class", "goals");
  pathLayer.appendChild(goalEl);
  function drawPlans() {
    const d = Object.fromEntries(Object.keys(ROLE_COLORS).map((r) => [r, ""]));
    let goals = "";
    for (const p of hospital.people.values()) {
      const s = sprites.get(p.id);
      if (!s || p.plan.length < 2 || p.step >= p.plan.length - 1) continue;
      let seg = `M${s.x.toFixed(0)} ${s.y.toFixed(0)}`;
      for (let k = p.step + 1; k < p.plan.length; k++) {
        const c = cellXY(p.plan[k]);
        seg += `L${c.x} ${c.y}`;
      }
      d[roleOf(p)] += seg;
      if (p.goal !== undefined && !p.leader) {
        const g = cellXY(p.goal);
        goals += `M${g.x - 4} ${g.y - 4}l8 8m0 -8l-8 8`;
      }
    }
    for (const role in pathEls) pathEls[role].setAttribute("d", d[role]);
    goalEl.setAttribute("d", goals);
  }

  // ── Monitor strips: sweep-style, like a real bedside monitor ──
  const strips = [...root.querySelectorAll(".mon-strip canvas")].map((canvas, k) => ({
    canvas,
    ctx: canvas.getContext("2d"),
    wave: k === 0 ? ecg : pleth,
    color: k === 0 ? "#39ff88" : "#3fe0ff",
    x: 0,
    last: null,
  }));
  function sizeStrips() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const s of strips) {
      const w = s.canvas.clientWidth;
      const h = s.canvas.clientHeight;
      if (!w || !h) continue;
      s.canvas.width = w * dpr;
      s.canvas.height = h * dpr;
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.w = w;
      s.h = h;
      s.x = 0;
      s.last = null;
    }
  }

  let phase = 0;
  let time = 0;
  // where in a beat (0 → 1) the sound marks fall: R wave, end of T, pulse peak
  const BEAT_MARKS = [
    [0.4, "R"],
    [0.72, "T"],
    [0.83, "pulse"],
  ];
  function sweep(dt, hr) {
    const pxPerSec = 130;
    const cols = Math.max(1, Math.round(pxPerSec * dt));
    for (let c = 0; c < cols; c++) {
      time += 1 / pxPerSec;
      const before = phase;
      phase = advance(phase, 1 / pxPerSec, hr, time);
      // tell anyone listening (the sound) when the trace passes a beat's
      // landmarks: the R wave (first heart sound), the end of the T wave
      // (second heart sound), and the pulse reaching the finger (the beep)
      const wrapped = phase < before;
      for (const [at, wave] of BEAT_MARKS) {
        const crossed = wrapped ? at > before || at <= phase : before < at && at <= phase;
        if (crossed) root.dispatchEvent(new CustomEvent("beat", { detail: { wave } }));
      }
      for (const s of strips) {
        if (!s.w) continue;
        const y = s.h * (s.wave === ecg ? 0.62 : 0.75) - s.wave(phase) * s.h * (s.wave === ecg ? 0.5 : 0.55);
        s.ctx.clearRect(s.x, 0, 14, s.h); // the erase bar running ahead of the trace
        if (s.last !== null && s.x > 0) {
          s.ctx.strokeStyle = s.color;
          s.ctx.lineWidth = 1.6;
          s.ctx.beginPath();
          s.ctx.moveTo(s.x - 1, s.last);
          s.ctx.lineTo(s.x, y);
          s.ctx.stroke();
        }
        s.last = y;
        s.x = (s.x + 1) % s.w;
        if (s.x === 0) s.last = null;
      }
    }
  }

  // ── Camera ──
  // Each beat has a shot; the bedside and OR shots pick a live bay / room
  // at the moment the camera heads there, and send "me" along.
  const shots = [WIDE, shotForBay(4), shotForRoom(4), RESTRICTED];
  function pickBay() {
    let best = 4;
    let left = -1;
    hospital.pacu.forEach((id, k) => {
      const p = id && hospital.people.get(id);
      if (!p || p.stage !== "pacu" || p.recoverStart === undefined) return;
      const rem = p.recoverLength - (hospital.clock - p.recoverStart);
      if (rem > left) [best, left] = [k, rem];
    });
    return best;
  }
  function pickRoom() {
    let best = 4;
    let left = -Infinity;
    hospital.rooms.forEach((rm, k) => {
      const rem = rm.state === "case" ? rm.caseLength - (hospital.clock - rm.caseStart) : rm.state === "fetching" ? 0 : -Infinity;
      if (rem > left) [best, left] = [k, rem];
    });
    return best;
  }
  let aimed = -2;
  function aim(to) {
    if (to === aimed) return;
    aimed = to;
    if (to === 1) {
      const bay = pickBay();
      shots[1] = shotForBay(bay);
      hospital.you.mode = { kind: "bay", bay };
    } else if (to === 2) {
      const room = pickRoom();
      shots[2] = shotForRoom(room);
      hospital.you.mode = { kind: "or", room };
    } else hospital.you.mode = { kind: "roam" };
  }

  // ── Résumé cards ──
  const deck = createDeck({
    panel,
    card: root.querySelector(".card"),
    cards: chapter.cards,
    render: (c) => `
      <p class="card__eyebrow">${c.eyebrow}</p>
      <h3 class="card__title">${c.title}</h3>
      ${c.meta ? `<p class="card__meta">${c.meta}</p>` : ""}
      <ul class="card__list">${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`,
  });

  // ── Behind the scenes ──
  const stats = { hospital, history: [], hr: 74, phase: 0, hrOverride: null, skill: 0, rate: { searches: 0, expanded: 0 } };
  const inspector = createInspector(panel, uchTopics, { stats });
  blueprint?.subscribe((on) => {
    if (!on) inspector.close();
  });

  function frame() {
    sizeStrips();
    deck.place();
  }
  frame();
  window.addEventListener("resize", frame);

  const conductor = createConductor(reducedMotion ? 0.001 : 1.3);
  let last = performance.now();
  let beat = -1;
  let hr = 74;
  let spo2 = 98;
  let sampleT = 0;
  let rateT = 0;
  let rateFrom = { ...hospital.planner.stats };
  let frameNo = 0;

  return {
    get card() {
      return deck.current;
    },

    update(p) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const enter = range(p, 0, ENTER_END);
      const exit = range(p, EXIT_START, 1);
      const hold = range(p, ENTER_END, EXIT_START);

      // Power on like a monitor: a bright line that opens into the screen;
      // power off the same way, back down to a line and out.
      const on = easeInOutCubic(enter);
      const off = easeInOutCubic(exit);
      const sx = Math.min(clamp(on * 2), 1 - clamp(off * 2 - 1));
      const sy = Math.min(0.006 + 0.994 * clamp(on * 2 - 1), 1 - 0.994 * clamp(off * 2));
      panel.style.transform = `scale(${Math.max(0.002, sx).toFixed(4)}, ${Math.max(0.004, sy).toFixed(4)})`;
      root.style.setProperty("--flash", (1 - Math.min(sx, sy)).toFixed(3));

      // Camera: timed moves between shots, picked by scroll position.
      const target = enter < 0.6 ? -1 : Math.min(BEATS.length - 1, Math.floor(hold * BEATS.length));
      const c = conductor.tick(target, dt, now);
      aim(c.to);
      const aspect = plan.clientWidth / Math.max(1, plan.clientHeight) || 1.6;
      const A = framed(shots[Math.max(0, c.from)], aspect);
      const B = framed(shots[Math.max(0, c.to)], aspect);
      const k = easeInOutCubic(c.t);
      const shot = { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k), w: lerp(A.w, B.w, k), h: lerp(A.h, B.h, k) };
      plan.setAttribute("viewBox", `${shot.x.toFixed(1)} ${shot.y.toFixed(1)} ${shot.w.toFixed(1)} ${shot.h.toFixed(1)}`);
      root.classList.toggle("is-system", c.to === 3 && c.t > 0.5);

      // Simulation + monitor run whenever the screen is on.
      if (sx > 0.5) {
        step(dt);
        drawPeople(dt);
        if (frameNo % 6 === 0) drawLighting();
        if (blueprint?.on && frameNo % 3 === 0) drawPlans();
        const wantHr = stats.hrOverride ?? BEATS[Math.max(0, c.to)].hr;
        hr = lerp(hr, wantHr, Math.min(1, dt * 1.5));
        spo2 = lerp(spo2, BEATS[Math.max(0, c.to)].spo2, Math.min(1, dt));
        sweep(dt, hr);
        stats.hr = hr;
        stats.phase = phase;
        const busy = (a) => a.filter((x) => x !== null && x !== "turnover").length;
        sampleT += dt;
        if (sampleT > 0.25) {
          sampleT = 0;
          stats.history.push({ preop: busy(hospital.preop), or: busy(hospital.or), pacu: busy(hospital.pacu), waiting: hospital.waiting.length });
          if (stats.history.length > 160) stats.history.shift();
        }
        rateT += dt;
        if (rateT >= 1) {
          const ps = hospital.planner.stats;
          stats.rate = { searches: (ps.searches - rateFrom.searches) / rateT, expanded: (ps.expanded - rateFrom.expanded) / rateT };
          rateFrom = { ...ps };
          rateT = 0;
        }
        if (frameNo % 10 === 0) {
          hrEl.textContent = Math.round(hr);
          spo2El.textContent = Math.round(spo2);
          census.innerHTML = `<span><i style="--c:#39ff88"></i>Pre-op <b>${busy(hospital.preop)}/10</b></span><span><i style="--c:#ffd23f"></i>OR <b>${busy(hospital.or)}/${12 - hospital.closed}</b></span><span><i style="--c:#3fe0ff"></i>PACU <b>${busy(hospital.pacu)}/12</b></span><span><i style="--c:#e8f0ee"></i>Waiting <b>${hospital.waiting.length}</b></span>`;
          logEl.textContent = hospital.log.join("\n");
          const d = new Date();
          clock.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        }
        frameNo++;
      }

      // Headline + card announce the beat as soon as its move begins.
      const open = enter > 0.96 && exit < 0.03;
      const current = open ? Math.max(0, c.to) : -1;
      if (current !== beat) {
        beat = current;
        headEls.forEach((el, i) => el.classList.toggle("is-on", i === current));
        if (current >= 0) root.style.setProperty("--beat", BEATS[current].color);
      }
      deck.set(current);
      root.classList.toggle("is-open", open);

      if (blueprint?.on) inspector.frame(now / 1000);
    },
  };
}
