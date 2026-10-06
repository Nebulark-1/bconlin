// The career page, Michigan Tech: press and hold on the canal and you go
// under. A diver follows your pointer left and right, steady in the middle
// of the picture. Hold and they sink, head first;
// let go and they rise. A descent line with a tag every 10 feet, bits of
// drifting silt and a few lake trout slide past to show how deep and how
// fast. At 80 feet the bottom comes up, scattered with stones: steer onto
// one to pick it up. One stone on each dive is a Yooperlite: it looks
// like every other rock until you hold it, and then it glows.

import { discover, isFound, isOn } from "../site/eggs.js";
import { chime, pluck, ambience, PENTATONIC } from "../site/sound.js";
import { remember, keep } from "./store.js";

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const BOTTOM = 80; // feet
const BREATH = 11; // seconds of air
// Michigan Tech's own atmosphere, to come back up to (src/career/soundscape.js)
const SHORE = { air: 0.5, wind: 0.35, sparkle: false, hush: 1500 };
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * One frame of the dive. Holding sinks you 22 ft a second; letting go
 * floats you up at 30. Air only runs out below the surface. Run out and
 * you come up whether you're holding or not.
 * Returns "surfaced" on the frame you reach the top, or "".
 */
export function diveStep(s, dt) {
  const down = s.holding && !s.gasp;
  const was = s.depth;
  s.depth = Math.min(BOTTOM, Math.max(0, s.depth + (down ? 22 : -30) * dt));
  if (s.depth > 0) {
    s.under += dt;
    s.breath = Math.max(0, s.breath - dt / BREATH);
  }
  if (s.breath === 0) s.gasp = true;
  return was > 0 && s.depth === 0 ? "surfaced" : "";
}

export function mountLake() {
  const scene = document.querySelector('[data-scene="houghton"]');
  const panel = scene?.querySelector(".panel");
  if (!panel) return;
  // inside the picture's visible frame, and on the canal's water
  const onWater = (e) => {
    const frame = panel.getBoundingClientRect();
    if (e.clientX < frame.left || e.clientX > frame.right || e.clientY < frame.top || e.clientY > frame.bottom) return false;
    if (e.target.closest?.("a, button, .card__box")) return false;
    const water = panel.querySelector('path[fill="url(#h-water)"]');
    const m = water?.getScreenCTM();
    return !!m && water.isPointInFill(new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()));
  };
  let diving = false;
  scene.addEventListener("pointerdown", (e) => {
    if (diving || e.button !== 0 || !onWater(e)) return;
    diving = true;
    start(panel, e, () => (diving = false));
  });
}

/** The bottom, new each dive: stones (one of them a Yooperlite), pebbles, a log, weeds. */
function lakebed(width) {
  const rand = (a, b) => a + Math.random() * (b - a);
  const stone = (x, yooper = false) => {
    const r = rand(10, 17);
    const pts = Array.from({ length: 7 }, (_, k) => {
      const a = (k / 7) * Math.PI * 2;
      return [Math.cos(a) * r * rand(0.8, 1.15), Math.sin(a) * r * 0.62 * rand(0.8, 1.1)];
    });
    // a few darker flecks on every stone, so the Yooperlite doesn't stand out
    const flecks = Array.from({ length: 6 }, () => [rand(-r * 0.6, r * 0.6), rand(-r * 0.3, r * 0.3)]);
    return { x, r, pts, flecks, yooper, shade: Math.round(rand(110, 150)), held: false };
  };
  const n = Math.max(6, Math.round(width / 110));
  const stones = Array.from({ length: n }, (_, k) => stone(((k + 0.5) / n) * width + rand(-25, 25)));
  stones[Math.floor(Math.random() * n)].yooper = true;
  return {
    stones,
    pebbles: Array.from({ length: Math.round(width / 14) }, () => ({ x: rand(0, width), y: rand(2, 30), r: rand(1.5, 4) })),
    weeds: Array.from({ length: Math.round(width / 70) }, () => ({ x: rand(0, width), h: rand(25, 70), s: rand(0, 6) })),
    log: { x: rand(width * 0.15, width * 0.7), w: rand(90, 150), a: rand(-0.12, 0.12) },
    ridge: Array.from({ length: 24 }, () => rand(-6, 6)),
  };
}

function start(panel, e, done) {
  const box = panel.getBoundingClientRect();
  const W = box.width;
  const H = box.height;
  const lake = document.createElement("div");
  lake.className = "lake";
  lake.setAttribute("aria-hidden", "true");
  lake.innerHTML = `<canvas></canvas><p class="lake__note"></p>`;
  panel.appendChild(lake);
  const canvas = lake.querySelector("canvas");
  const note = lake.querySelector(".lake__note");
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  const FT = H / 55; // pixels per foot: 80 ft is about a panel and a half

  const bed = lakebed(W);
  // silt drifting in the water, and a few lake trout, all at real depths
  const silt = Array.from({ length: 90 }, () => ({ x: Math.random() * W, d: Math.random() * 85, r: 0.6 + Math.random() * 1.4 }));
  const trout = [18, 34, 52, 66].map((d, k) => ({ d, x: Math.random() * W, v: (k % 2 ? -1 : 1) * (14 + Math.random() * 12), size: 0.8 + Math.random() * 0.5 }));
  const bubbles = [];
  const touch = e.pointerType !== "mouse";

  const s = { depth: 0, breath: 1, holding: true, gasp: false, under: 0, held: null };
  // the diver stays at the middle height; only left and right follow you
  const aim = { x: e.clientX - box.left, y: H * 0.45 };
  const diver = { x: aim.x, y: e.clientY - box.top, angle: Math.PI / 2, kick: 0 };
  let started = performance.now();
  let last = started;
  let under = false;
  let leaving = 0; // fades the water out after surfacing
  let raf = 0;

  const move = (ev) => {
    aim.x = Math.max(20, Math.min(W - 20, ev.clientX - box.left));
  };
  const up = () => (s.holding = false);
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);

  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    // a tap just ripples; only a real hold goes under
    if (!under) {
      if (!s.holding) return finish(false);
      if (now - started > 350) {
        under = true;
        discover("dive");
        if (!isOn("dive")) return finish(false);
        ambience({ air: 0.2, wind: 0, sparkle: false, hush: 700 }); // muffled, under water
      }
    }
    if (under && !leaving && diveStep(s, dt) === "surfaced") surface();
    if (leaving) leaving = Math.min(1, leaving + dt * 1.2);

    // the diver follows the pointer, and turns to the way they're going
    const vx = aim.x - diver.x;
    diver.x = lerp(diver.x, aim.x, 1 - Math.exp(-dt * 6));
    diver.y = lerp(diver.y, aim.y, 1 - Math.exp(-dt * 6));
    const sinking = s.holding && !s.gasp && s.depth < BOTTOM;
    const rising = !sinking && s.depth > 0;
    const goal = s.depth >= BOTTOM - 0.5 && s.holding ? (vx < -2 ? Math.PI : vx > 2 ? 0 : diver.angle) : sinking ? Math.PI / 2 : rising ? -Math.PI / 2 : Math.atan2(0, vx || 1);
    let turn = goal - diver.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    diver.angle += turn * (1 - Math.exp(-dt * 5));
    diver.kick += dt * (sinking || rising || Math.abs(vx) > 3 ? 9 : 3);

    // at the bottom: pick up the stone you're over (on a phone, the nearest)
    if (s.depth >= BOTTOM - 0.5 && !s.held) {
      const near = bed.stones.filter((st) => !st.held).sort((a, b) => Math.abs(a.x - diver.x) - Math.abs(b.x - diver.x))[0];
      if (near && (touch || Math.abs(near.x - diver.x) < near.r + 14)) {
        near.held = true;
        s.held = near;
        pluck(110, 0.8);
        if (near.yooper) {
          discover("yooper");
          [3, 5, 7].forEach((n, k) => setTimeout(() => chime(PENTATONIC[n], 0.04, 0, 2.5), k * 120));
        }
      }
    }
    // bubbles on the way up, and now and then on the way down
    if (s.depth > 1 && Math.random() < dt * (rising ? 10 : 1.5)) bubbles.push({ x: diver.x, d: s.depth, r: 1 + Math.random() * 2.5 });
    for (const b of bubbles) b.d -= 28 * dt;
    while (bubbles.length && bubbles[0].d < 0) bubbles.shift();
    for (const f of trout) f.x = (f.x + f.v * dt + W + 80) % (W + 80);

    draw(t);
    if (leaving >= 1) return finish(true);
    raf = requestAnimationFrame(tick);
  };

  function surface() {
    // nearly out of air, but not out: the longest you can safely go
    if (!s.gasp && s.breath < 0.1) {
      if (s.under > remember("bc-breath")) keep("bc-breath", s.under.toFixed(1));
      discover("breath");
    }
    const best = isFound("breath") && isOn("breath") ? remember("bc-breath") : 0;
    note.textContent = s.held ? (s.held.yooper && isOn("yooper") ? "You found a Yooperlite!" : "You found a rock!") : best ? `Longest breath: ${best.toFixed(1)} s` : "";
    note.style.left = `${diver.x}px`;
    note.style.top = `${diver.y}px`;
    note.classList.toggle("is-yooper", !!s.held?.yooper);
    chime(PENTATONIC[s.held ? 5 : 2], 0.04);
    leaving = 0.001;
  }

  // ── drawing ─────────────────────────────────────────────
  // world depth (ft) to screen y, with the camera on the diver
  const Y = (d) => diver.y + (d - s.depth) * FT;
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = under ? 1 - leaving : 1;
    const ys = Y(0);
    if (under) {
      // the water: lighter near the top, near black at the bottom
      const g = ctx.createLinearGradient(0, ys, 0, Y(BOTTOM));
      g.addColorStop(0, "rgba(29, 95, 140, 0.97)");
      g.addColorStop(0.5, "rgba(9, 40, 72, 0.985)");
      g.addColorStop(1, "rgba(2, 10, 22, 0.99)");
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.max(0, ys), W, H);
      // light coming down from the surface, fading with depth
      ctx.fillStyle = "rgba(159, 227, 255, 0.05)";
      for (let k = 0; k < 4; k++) {
        const x = ((k + 0.5) / 4) * W + Math.sin(t * 0.4 + k) * 30;
        ctx.beginPath();
        ctx.moveTo(x - 20, ys);
        ctx.lineTo(x + 20, ys);
        ctx.lineTo(x + 90, Y(40));
        ctx.lineTo(x + 20, Y(40));
        ctx.fill();
      }
      // the surface, from below
      if (ys > -10) {
        ctx.strokeStyle = "rgba(159, 227, 255, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) ctx.lineTo(x, ys + Math.sin(t * 2 + x * 0.05) * 2);
        ctx.stroke();
      }
      // the descent line, tagged every 10 ft
      const rx = W * 0.82;
      ctx.strokeStyle = "rgba(236, 232, 255, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, Math.max(0, ys));
      ctx.lineTo(rx, Y(BOTTOM));
      ctx.stroke();
      ctx.font = "500 11px 'JetBrains Mono', monospace";
      for (let d = 10; d <= BOTTOM; d += 10) {
        const y = Y(d);
        if (y < -20 || y > H + 20) continue;
        ctx.fillStyle = d === BOTTOM ? "#ffb48c" : "#ece8ff";
        ctx.fillRect(rx - 6, y - 1.5, 12, 3);
        ctx.fillText(`${d} ft`, rx + 12, y + 4);
      }
      // silt: still in the water, so it streams past as you sink
      ctx.fillStyle = "rgba(236, 232, 255, 0.35)";
      for (const p of silt) {
        const y = Y(p.d + Math.sin(t * 0.5 + p.x) * 0.3);
        if (y > ys && y > -4 && y < H + 4) ctx.fillRect(p.x, y, p.r, p.r);
      }
      // lake trout
      for (const f of trout) {
        const y = Y(f.d);
        if (y < -20 || y > H + 20 || y < ys) continue;
        ctx.save();
        ctx.translate(f.x - 40, y);
        ctx.scale(Math.sign(f.v) * f.size, f.size);
        ctx.fillStyle = "rgba(169, 155, 255, 0.45)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
        ctx.moveTo(-20, 0);
        ctx.lineTo(-32, -7);
        ctx.lineTo(-32, 7);
        ctx.fill();
        ctx.restore();
      }
      drawBed(t);
      // bubbles
      ctx.strokeStyle = "rgba(236, 232, 255, 0.7)";
      ctx.lineWidth = 1;
      for (const b of bubbles) {
        const y = Y(b.d) - 14;
        ctx.beginPath();
        ctx.arc(b.x + Math.sin(t * 6 + b.r * 9) * 3, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawDiver(t);
      // depth, top right
      ctx.fillStyle = "#ece8ff";
      ctx.font = "500 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(s.depth)} ft`, W - 18, 26);
      ctx.textAlign = "left";
    } else {
      // pressing, not yet under: a ripple
      const u = Math.min(1, (performance.now() - started) / 350);
      ctx.strokeStyle = `rgba(159, 227, 255, ${1 - u})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(diver.x, diver.y, 6 + u * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBed(t) {
    const yf = Y(BOTTOM);
    if (yf > H + 60) return;
    // the bottom, with a rough top edge
    ctx.fillStyle = "#14121f";
    ctx.beginPath();
    ctx.moveTo(0, H + 10);
    bed.ridge.forEach((r, k) => ctx.lineTo((k / (bed.ridge.length - 1)) * W, yf + 14 + r));
    ctx.lineTo(W, H + 10);
    ctx.fill();
    // weeds
    ctx.strokeStyle = "rgba(57, 255, 136, 0.5)";
    ctx.lineWidth = 2;
    for (const w of bed.weeds) {
      const sway = Math.sin(t * 1.2 + w.s) * 8;
      ctx.beginPath();
      ctx.moveTo(w.x, yf + 16);
      ctx.quadraticCurveTo(w.x + sway, yf + 16 - w.h / 2, w.x + sway * 1.5, yf + 16 - w.h);
      ctx.stroke();
    }
    // a sunken log
    ctx.save();
    ctx.translate(bed.log.x, yf + 12);
    ctx.rotate(bed.log.a);
    ctx.fillStyle = "#2a2232";
    ctx.fillRect(0, -6, bed.log.w, 12);
    ctx.strokeStyle = "#3d3347";
    ctx.strokeRect(0, -6, bed.log.w, 12);
    ctx.restore();
    // pebbles
    ctx.fillStyle = "#2c2a3a";
    for (const p of bed.pebbles) {
      ctx.beginPath();
      ctx.arc(p.x, yf + 14 + p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // the stones you can pick up
    for (const st of bed.stones) if (!st.held) drawStone(st, st.x, yf + 14, false);
  }

  function drawStone(st, x, y, held) {
    ctx.save();
    ctx.translate(x, y);
    if (held) ctx.scale(0.7, 0.7);
    const glow = held && st.yooper && isOn("yooper");
    ctx.fillStyle = `rgb(${st.shade}, ${st.shade - 4}, ${st.shade + 14})`;
    ctx.beginPath();
    st.pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
    // flecks: dull on every stone, until a Yooperlite is in your hand
    for (const [fx, fy] of st.flecks) {
      if (glow) {
        ctx.shadowColor = "#ff9a3c";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffb14a";
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(40, 36, 52, 0.7)";
      }
      ctx.beginPath();
      ctx.arc(fx, fy, glow ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // A freediver, drawn pointing along +x: head, body, long fins.
  function drawDiver(t) {
    ctx.save();
    ctx.translate(diver.x, diver.y);
    // breath, as a ring around them
    ctx.strokeStyle = s.breath < 0.25 ? "rgba(255, 138, 122, 0.9)" : "rgba(94, 200, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.breath);
    ctx.stroke();
    ctx.rotate(diver.angle);
    const kick = Math.sin(diver.kick) * 0.28;
    // fins
    ctx.fillStyle = "#9fe3ff";
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-12, side * 2.5);
      ctx.rotate(Math.PI + kick * side);
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(22, -4);
      ctx.lineTo(24, 3);
      ctx.lineTo(0, 2);
      ctx.fill();
      ctx.restore();
    }
    // legs and body
    ctx.strokeStyle = "#ffb48c";
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, side * 1.5);
      ctx.lineTo(-12, side * 2.5 + kick * side * 4);
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    // head
    ctx.fillStyle = "#ece8ff";
    ctx.beginPath();
    ctx.arc(17, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // the stone in hand
    if (s.held) {
      const hx = diver.x + Math.cos(diver.angle + 0.5) * 14;
      const hy = diver.y + Math.sin(diver.angle + 0.5) * 14;
      drawStone(s.held, hx, hy, true);
    }
  }

  function finish(dove) {
    cancelAnimationFrame(raf);
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
    if (dove) ambience(SHORE);
    // let the note linger a moment above the surface
    lake.classList.add("is-gone");
    setTimeout(() => lake.remove(), dove && note.textContent ? 2200 : 300);
    done();
  }
  raf = requestAnimationFrame(tick);
}
