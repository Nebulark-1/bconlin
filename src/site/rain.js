import { clamp } from "../engine/math.js";
import { reducedMotion } from "../engine/scroll.js";
import { chime, PENTATONIC, windStats } from "./sound.js";
import { EGGS, onEggs, foundCount, isOn, discover } from "./eggs.js";

// Motes that drift down strips at the screen's outer edges. Small round
// beads are scattered down both strips, fixed to the screen like the pins
// of a pinball table: the page scrolls behind them. A mote that lands on a
// bead bounces off and the bead rings its own note, panned to its side,
// louder the harder it was hit. Slow and small on purpose.
//
// The beads double as the visitor's trophy case: each secret they've found
// lights one for good. Two secrets live here too: snow, and constellations.
//
// Only runs where there's room beside the page's content.

const COLORS = ["#a99bff", "#ff8a7a", "#39ff88", "#ff4da6"];
const STRIP = 160; // widest a strip gets, px
const GAP = 30; // closest two beads may sit, px
const RAIN = { max: 14, every: [450, 900], gravity: 34, terminal: 62, sway: 7 };
const SNOW = { max: 40, every: [110, 220], gravity: 14, terminal: 24, sway: 18 };
const LINK_WINDOW = 600; // ms: two beads ringing this close together join up
// where flakes settle on a bead, as [dx, row]
const PILE = [[0, 0], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]];

// a small seeded random, so the beads land in the same places every visit
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** column: the width of the page's content column, in px. */
export function createRain({ column = 1180 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "rain";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const stats = { motes: 0, hits: 0, pegs: 0, enabled: false, lastNote: null, links: 0, snow: false };
  let W = 0;
  let H = 0;
  let strips = [];
  let pegs = [];
  let motes = [];
  let links = [];
  let recent = [];
  let trophies = 0;
  let snowing = false;
  let nextSpawn = performance.now() + 1500;
  let last = performance.now();

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const room = (W - Math.min(W, column)) / 2 - 20;
    const width = Math.min(STRIP, room);
    stats.enabled = width >= 40 && !reducedMotion;
    strips = stats.enabled
      ? [
          { side: -1, x0: 10, x1: 10 + width },
          { side: 1, x0: W - 10 - width, x1: W - 10 },
        ]
      : [];
    // Beads scattered down each strip by dart throwing: try random spots
    // and keep one only if it isn't too near another. Random but even,
    // with no clean lanes straight down.
    const rand = seeded(7);
    pegs = [];
    strips.forEach((st, strip) => {
      const placed = [];
      const want = Math.floor(((st.x1 - st.x0) * H) / 7200);
      for (let tries = 0; tries < want * 30 && placed.length < want; tries++) {
        const x = st.x0 + 8 + rand() * (st.x1 - st.x0 - 16);
        const y = 70 + rand() * (H - 110);
        const gap = GAP + rand() * 18;
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < gap)) continue;
        placed.push({
          x,
          y,
          strip,
          r: 2.2 + rand() * 2.4,
          note: PENTATONIC[Math.floor(rand() * PENTATONIC.length)],
          color: COLORS[Math.floor(rand() * 4)],
          glow: 0,
          hitAt: 0,
          pile: 0,
          trophy: false,
        });
      }
      pegs.push(...placed);
    });
    // trophies light from the top of the screen down, both sides together
    pegs.sort((a, b) => a.y - b.y);
    pegs.forEach((p, k) => (p.order = k));
    links = [];
    stats.pegs = pegs.length;
    setTrophies(trophies);
  }

  /** Light one bead for good per secret found. */
  function setTrophies(n) {
    trophies = n;
    // spread the lit beads evenly down the screen rather than bunching them
    const step = pegs.length / Math.max(1, EGGS.length);
    const lit = new Set(Array.from({ length: Math.min(n, pegs.length) }, (_, k) => Math.floor(k * step)));
    pegs.forEach((p) => (p.trophy = lit.has(p.order)));
  }

  layout();
  window.addEventListener("resize", layout);
  onEggs(() => setTrophies(foundCount()));

  function spawn(now) {
    const kind = snowing ? SNOW : RAIN;
    const pouring = now < pourUntil;
    nextSpawn = now + (pouring ? 25 + Math.random() * 40 : kind.every[0] + Math.random() * kind.every[1]);
    if (!strips.length || motes.length >= (pouring ? 90 : kind.max)) return;
    const s = strips[Math.floor(Math.random() * strips.length)];
    motes.push({
      x: s.x0 + 6 + Math.random() * (s.x1 - s.x0 - 12),
      y: -8,
      vx: 0,
      vy: snowing ? 8 : 14,
      s,
      flake: snowing,
      r: snowing ? 1.1 + Math.random() * 1.3 : 1.8,
      seed: Math.random() * 10,
      color: snowing ? "#eef2ff" : COLORS[Math.floor(Math.random() * 4)],
      trail: [],
      lastPeg: null,
      born: now,
    });
  }

  /**
   * Bounce a mote off a bead. If the mote is touching the bead and moving
   * into it, reflect its velocity about the line from the bead's centre,
   * losing some speed, plus a small random nudge so no two falls trace the
   * same path. The bead rings: quiet for a graze, fuller for a hard hit.
   * A snowflake that lands on top settles there instead, with a muffled tap.
   */
  function collide(m, peg, now) {
    let nx = m.x - peg.x;
    let ny = m.y - peg.y;
    const d = Math.hypot(nx, ny);
    const reach = peg.r + m.r;
    if (d > reach || d === 0) return;
    nx /= d;
    ny /= d;
    const vn = m.vx * nx + m.vy * ny;
    if (vn >= 0) return;
    const pan = clamp((m.x / W) * 2 - 1, -0.75, 0.75);
    if (m.flake && ny < -0.3 && peg.pile < PILE.length) {
      peg.pile = Math.floor(peg.pile) + 1;
      m.dead = true;
      chime(peg.note / 2, 0.006, pan, 0.45);
      return;
    }
    m.vx -= 1.55 * vn * nx;
    m.vy -= 1.55 * vn * ny;
    const kick = (Math.random() - 0.5) * 14;
    m.vx += -ny * kick;
    m.vy += nx * kick;
    m.x = peg.x + nx * reach;
    m.y = peg.y + ny * reach;
    if (!m.flake && (m.lastPeg !== peg || now - peg.hitAt > 400)) {
      const hard = clamp(-vn / RAIN.terminal);
      peg.glow = 0.35 + 0.65 * hard;
      peg.hitAt = now;
      stats.hits++;
      stats.lastNote = peg.note;
      chime(peg.note, 0.004 + 0.05 * hard ** 1.5, pan, 1.2 + 1.4 * hard);
      constellate(peg, now);
    }
    m.lastPeg = peg;
  }

  /**
   * Constellations: when two beads on the same side ring within about half
   * a second of each other, a faint line joins them for the rest of the
   * visit. Two lines and the secret's found.
   */
  function constellate(peg, now) {
    if (!isOn("constellations")) return;
    recent = recent.filter((r) => now - r.t < LINK_WINDOW);
    for (const r of recent) {
      const other = r.peg;
      if (other === peg || other.strip !== peg.strip || Math.hypot(other.x - peg.x, other.y - peg.y) > 240) continue;
      if (links.some((l) => (l.a === peg && l.b === other) || (l.a === other && l.b === peg))) continue;
      links.push({ a: other, b: peg, born: now });
      if (links.length > 60) links.shift();
      stats.links = links.length;
      if (links.length >= 2) discover("constellations");
      break;
    }
    recent.push({ peg, t: now });
  }

  /** A downpour: for a few seconds, motes come thick and fast. */
  let pourUntil = 0;
  function burst(seconds = 8) {
    if (!strips.length) return false;
    pourUntil = performance.now() + seconds * 1000;
    nextSpawn = 0;
    return true;
  }

  /** Every bead lights in turn, top to bottom. */
  function flareAll() {
    pegs.forEach((p, k) => setTimeout(() => (p.glow = 1), k * 45));
  }

  function setSnow(on) {
    snowing = on && stats.enabled;
    stats.snow = snowing;
  }

  function frame(now, bp = false) {
    const dt = Math.min(0.05, Math.max(0, now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, W, H);
    if (!stats.enabled) return;
    if (now > nextSpawn) spawn(now);

    // small steps, so a mote can't pass straight through a bead
    const steps = 2;
    const h = dt / steps;
    for (const m of motes) {
      const kind = m.flake ? SNOW : RAIN;
      for (let k = 0; k < steps && !m.dead; k++) {
        m.vy = Math.min(m.vy + kind.gravity * h, kind.terminal);
        m.vx += Math.sin(now / 1100 + m.seed) * kind.sway * h;
        m.vx *= 0.995;
        m.x += m.vx * h;
        m.y += m.vy * h;
        if (m.x < m.s.x0) (m.x = m.s.x0), (m.vx = Math.abs(m.vx) * 0.4);
        if (m.x > m.s.x1) (m.x = m.s.x1), (m.vx = -Math.abs(m.vx) * 0.4);
        for (const peg of pegs) if (Math.abs(peg.y - m.y) < 10) collide(m, peg, now);
      }
      m.trail.push([m.x, m.y]);
      if (m.trail.length > 8) m.trail.shift();
    }
    motes = motes.filter((m) => !m.dead && m.y < H + 12);
    stats.motes = motes.length;

    // snow on the beads melts once it stops, and a gust blows it off
    for (const p of pegs) {
      if (p.pile <= 0) continue;
      if (!snowing) p.pile = Math.max(0, p.pile - dt * 0.12);
      if (windStats.level > 0.3 && p.pile >= 1) {
        for (let k = 0; k < Math.floor(p.pile); k++) {
          motes.push({ x: p.x, y: p.y - p.r - 2, vx: (Math.random() - 0.3) * 30, vy: -6, s: strips[p.strip], flake: true, r: 1.2, seed: Math.random() * 10, color: "#eef2ff", trail: [], lastPeg: p, born: now - 800 });
        }
        p.pile = 0;
      }
    }

    // constellation lines
    for (const l of links) {
      const fresh = clamp((now - l.born) / 1500);
      ctx.globalAlpha = bp ? 0.6 : 0.09 + 0.5 * (1 - fresh);
      const g = ctx.createLinearGradient(l.a.x, l.a.y, l.b.x, l.b.y);
      g.addColorStop(0, bp ? "#9fe3ff" : l.a.color);
      g.addColorStop(1, bp ? "#9fe3ff" : l.b.color);
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(l.a.x, l.a.y);
      ctx.lineTo(l.b.x, l.b.y);
      ctx.stroke();
    }

    // beads: soft glowing points that flare when hit
    for (const p of pegs) {
      p.glow *= 0.95;
      if (bp) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = p.trophy ? "#ffd23f" : "#9fe3ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#d4f1ff";
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.fillText(`${Math.round(p.note)}`, p.x + p.r + 3, p.y + 3);
        continue;
      }
      const lit = Math.max(p.glow, p.trophy ? 0.45 + 0.12 * Math.sin(now / 900 + p.order) : 0);
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (2.6 + 3 * lit));
      halo.addColorStop(0, p.color);
      halo.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.1 + 0.45 * lit;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (2.6 + 3 * lit), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.28 + 0.6 * lit;
      ctx.fillStyle = p.trophy ? "#fff6e6" : p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // a found secret: a fine ring round the bead
      if (p.trophy) {
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = "#ffe2c4";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 1.9, 0, Math.PI * 2);
        ctx.stroke();
      }
      // settled snow
      const pile = Math.ceil(p.pile);
      if (pile > 0) {
        ctx.globalAlpha = 0.9 * clamp(p.pile);
        ctx.fillStyle = "#f2f5ff";
        for (let k = 0; k < pile; k++) {
          const [dx, row] = PILE[k];
          ctx.beginPath();
          ctx.arc(p.x + dx, p.y - p.r - 0.8 - row * 1.5, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // motes, each with a short fading tail; flakes have no tail
    for (const m of motes) {
      const fade = clamp((now - m.born) / 800);
      if (!m.flake) {
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.2;
        for (let k = 1; k < m.trail.length; k++) {
          ctx.globalAlpha = fade * (k / m.trail.length) * 0.3;
          ctx.beginPath();
          ctx.moveTo(...m.trail[k - 1]);
          ctx.lineTo(...m.trail[k]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = fade * (m.flake ? 0.75 : 0.9);
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = m.flake ? 4 : 8;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (bp) {
        ctx.strokeStyle = "#ffd23f";
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x + m.vx * 0.3, m.y + m.vy * 0.3);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  return { frame, stats, layout, setSnow, flareAll, burst };
}
