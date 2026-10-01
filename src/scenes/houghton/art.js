// Houghton, MI at winter twilight - looking up the Portage toward Lake
// Superior. Houghton & the Tech campus on the left bank, Hancock and the
// Quincy shaft house on the right, the Lift Bridge between them.
//
// Every layer is a 1600×900 SVG. `depth` (0 = sky, 1 = foreground) drives
// how far it moves on scroll and pointer parallax. Realism comes from a few
// cheap tricks applied everywhere: noise-textured snow, atmospheric haze
// between planes, snow resting on every upward surface, light that blooms,
// and a rippled reflection in the canal.

import { rng, ridge, interp, line, area, conifer, forest, windows, truss, note, plane } from "../../art/draw.js";

export const HORIZON = 436;
const HUSKY_X = 400;
const WATERLINE = 616; // where the bridge piers meet the canal
const C = {
  steel: "#17153c",
  rim: "#ffb48c",
  warm: "#ffcf86",
  pineFar: "#39317a",
  pineMid: "#262058",
  pineNear: "#110e30",
  building: "#231e56",
  snow: "#e9e5fb",
  snowShade: "#b9b1e3",
};

// Where each bank meets the water, as the canal widens toward us.
const leftBank = (y) => 748 - (y - 440) * 1.22;
const rightBank = (y) => 868 + (y - 440) * 1.2;
const canal = `M${leftBank(440)} 440 L${rightBank(440)} 440 L${rightBank(920)} 920 L${leftBank(920)} 920 Z`;

// Depth along the canal: the horizon moves like the far layer, the bottom
// of the plate nearly like the foreground.
export const GROUND = { top: HORIZON, bottom: 900, near: 0.16, far: 0.9 };
const groundDepth = (y) => GROUND.near + ((y - GROUND.top) / (GROUND.bottom - GROUND.top)) * (GROUND.far - GROUND.near);

// Every generator in the scene draws from a stream derived from SEED, so the
// whole town is deterministic - and a new seed rebuilds all of it.
let SEED = 0;

// What the last build produced, for the code inspector.
export const buildStats = { seed: 0, trees: 0, houses: 0, bytes: 0, ms: 0 };

// Hancock's ridge control points, shared with the inspector's ridge plot.
export const HANCOCK = [[860, 452], [980, 424], [1100, 372], [1210, 316], [1300, 276], [1400, 262], [1520, 274], [1680, 290]];

export function buildLayers({ seed = 0 } = {}) {
  SEED = seed;
  buildStats.seed = seed;
  buildStats.trees = 0;
  const t0 = performance.now();
  const layers = [
    { name: "sky", depth: 0.04, markup: sky() },
    { name: "aurora", depth: 0.07, canvas: "aurora" },
    { name: "far", depth: GROUND.near, markup: far() },
    { name: "hills", depth: 0.24, markup: hills() },
    // The canal is a ground plane: its far end moves with Lake Superior,
    // its near end with the foreground, so the two never drift apart.
    { name: "water", ground: GROUND, markup: water() },
    { name: "bridge", depth: groundDepth(WATERLINE), markup: bridge() },
    { name: "snow", depth: 0.7, canvas: "snow" },
    { name: "fore", depth: 1, markup: fore() },
  ];
  buildStats.ms = performance.now() - t0;
  buildStats.bytes = layers.reduce((sum, l) => sum + (l.markup?.length || 0), 0);
  return layers;
}

// Shared filters, defined once in the sky layer (ids are document-global).
const FILTERS = `
  <filter id="h-glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="2.4" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="h-bloom" x="-100%" y="-100%" width="300%" height="300%">
    <feGaussianBlur stdDeviation="6" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <!-- wind-packed snow: stretched fractal noise multiplied into the fill -->
  <filter id="h-snowtex" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.035" numOctaves="4" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0.1  0 0 0 -0.9 0.62" result="shade"/>
    <feComposite in="shade" in2="SourceGraphic" operator="in" result="s"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge>
  </filter>
  <filter id="h-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>`;

function sky() {
  const r = rng(11 + SEED);
  const tints = ["#ffffff", "#dfe6ff", "#fff1dc", "#cfd8ff"];
  let stars = "";
  for (let i = 0; i < 360; i++) {
    const y = 400 - r() ** 0.75 * 1200;
    const size = r() ** 4;
    const cls = r() < 0.08 ? ' class="twinkle"' : "";
    // twilight washes stars out toward the horizon
    const fade = Math.min(1, Math.max(0, (400 - y) / 260));
    stars += `<circle cx="${(r() * 1600).toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.35 + size * 1.5).toFixed(2)}" fill="${tints[i % 4]}" opacity="${((0.3 + r() * 0.7) * fade).toFixed(2)}"${cls}/>`;
  }

  // The Milky Way: a soft, uneven river of faint stars and glow arcing down
  // from the upper sky, dissolving into the twilight before the horizon.
  let milky = "";
  for (let i = 0; i < 900; i++) {
    const along = r() * 2400 - 1200;
    const across = (r() + r() + r() + r() - 2) * 60 * (1 + 0.4 * Math.sin(along / 260));
    milky += `<circle cx="${along.toFixed(0)}" cy="${across.toFixed(1)}" r="${(0.25 + r() ** 5 * 1).toFixed(2)}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`;
  }
  let glow = "";
  for (let i = 0; i < 14; i++) {
    const along = -1100 + i * 170 + r() * 80;
    glow += `<ellipse cx="${along.toFixed(0)}" cy="${((r() - 0.5) * 30).toFixed(0)}" rx="${(140 + r() * 120).toFixed(0)}" ry="${(40 + r() * 35).toFixed(0)}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
  }

  // A few thin, high cirrus streaks catching the last light near the horizon.
  let wisps = "";
  for (let i = 0; i < 6; i++) {
    const y = 350 + r() * 70;
    wisps += `<ellipse cx="${(r() * 1500 + 50).toFixed(0)}" cy="${y.toFixed(0)}" rx="${(220 + r() * 320).toFixed(0)}" ry="${(1.5 + r() * 3).toFixed(1)}" opacity="${(0.2 + r() * 0.3).toFixed(2)}"/>`;
  }

  const s = 0.3; // squash the sun glow into a wide ellipse on the horizon
  return `
    <defs>
      ${FILTERS}
      <linearGradient id="h-sky" x1="0" y1="-300" x2="0" y2="${HORIZON + 10}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#02040f"/>
        <stop offset=".42" stop-color="#0a1233"/>
        <stop offset=".66" stop-color="#1b2152"/>
        <stop offset=".8" stop-color="#3a2f68"/>
        <stop offset=".89" stop-color="#7a4a78"/>
        <stop offset=".95" stop-color="#d27a67"/>
        <stop offset="1" stop-color="#ffc08c"/>
      </linearGradient>
      <radialGradient id="h-sun" cx="808" cy="${HORIZON}" r="620" gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(1 0 0 ${s} 0 ${HORIZON * (1 - s)})">
        <stop offset="0" stop-color="#ffd2a0" stop-opacity=".8"/>
        <stop offset=".4" stop-color="#f08a70" stop-opacity=".22"/>
        <stop offset="1" stop-color="#f08a70" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="h-mw-fade" x1="0" y1="-600" x2="0" y2="360" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#fff"/>
        <stop offset=".55" stop-color="#fff"/>
        <stop offset="1" stop-color="#000"/>
      </linearGradient>
      <mask id="h-mw-mask" maskUnits="userSpaceOnUse" x="-200" y="-1500" width="2000" height="2000">
        <rect x="-200" y="-1500" width="2000" height="2000" fill="url(#h-mw-fade)"/>
      </mask>
      <filter id="h-mw-blur" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="28"/></filter>
      <linearGradient id="h-wisp" x1="0" y1="340" x2="0" y2="430" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#9a5e8e"/>
        <stop offset="1" stop-color="#f7a987"/>
      </linearGradient>
    </defs>
    <rect x="-100" y="-1400" width="1800" height="2400" fill="url(#h-sky)"/>
    <rect x="-100" y="-1400" width="1800" height="2400" fill="url(#h-sun)"/>
    <g mask="url(#h-mw-mask)">
      <g transform="translate(980 -40) rotate(-62)">
        <g fill="#b8b6ee" opacity=".16" filter="url(#h-mw-blur)">${glow}</g>
        <g fill="#fff">${milky}</g>
      </g>
    </g>
    <g class="stars">${stars}</g>
    <g fill="url(#h-wisp)" filter="url(#h-soft)">${wisps}</g>
    ${plane("sky", "SVG · depth 0.04 · gradients + 1,260 generated stars")}
    <g class="bp">
      ${note(1010, 60, "Milky Way: 900 stars, Σ4 uniforms ≈ gaussian spread", { dx: -60, dy: 40, topic: "rng" })}
      ${note(808, HORIZON - 10, "sun glow: radial gradient squashed by gradientTransform", { dx: 50, dy: -40 })}
    </g>`;
}

function far() {
  const left = ridge([[-80, 402], [180, 390], [430, 404], [640, 420], [750, 440]], { seed: 3 + SEED, amp: 7 });
  const right = ridge([[866, 440], [1000, 418], [1210, 398], [1420, 408], [1680, 394]], { seed: 5 + SEED, amp: 7 });
  const r = rng(21 + SEED);
  let glints = "";
  for (let i = 0; i < 18; i++) {
    const x = 750 + r() * 120;
    glints += `<path d="M${x.toFixed(0)} ${(HORIZON + 2 + r() * 8).toFixed(0)} h${(4 + r() * 14).toFixed(0)}"/>`;
  }
  const trees = [forest(left, { x0: -80, x1: 740, seed: 12 + SEED, density: 0.9, depth: 18, size: [4, 8], tiers: 2 }), forest(right, { x0: 870, x1: 1680, seed: 13 + SEED, density: 0.9, depth: 18, size: [4, 8], tiers: 2 })];
  buildStats.trees += trees[0].count + trees[1].count;
  return `
    <defs>
      <linearGradient id="h-superior" x1="0" x2="1">
        <stop offset="0" stop-color="#7e629e"/>
        <stop offset=".5" stop-color="#ffd4ab"/>
        <stop offset="1" stop-color="#7e629e"/>
      </linearGradient>
      <linearGradient id="h-farhaze" x1="0" y1="380" x2="0" y2="450" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#d49bb8" stop-opacity="0"/>
        <stop offset="1" stop-color="#d49bb8" stop-opacity=".55"/>
      </linearGradient>
    </defs>
    <rect x="-100" y="${HORIZON - 4}" width="1800" height="60" fill="url(#h-superior)"/>
    <g stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6">${glints}</g>
    <g fill="#6a5a9b"><path d="${area(left)}"/><path d="${area(right)}"/></g>
    <path d="${trees[0].body}${trees[1].body}" fill="#57498a"/>
    <path d="${area(left)} ${area(right)}" fill="url(#h-farhaze)"/>
    <g fill="none" stroke="#e7b9cf" stroke-width="1.2" opacity=".5"><path d="${line(left)}"/><path d="${line(right)}"/></g>
    ${plane("far", "SVG · depth 0.16 · Lake Superior + distant ridges")}
    <g class="bp">
      ${note(1210, 398, "ridge(): control points + 3 octaves of sine + jitter", { dx: 40, dy: -60, topic: "ridge" })}
    </g>`;
}

function hills() {
  const hancock = ridge(HANCOCK, { seed: 8 + SEED, amp: 5 });
  const houghton = ridge(
    [[-80, 290], [120, 282], [260, 300], [420, 336], [560, 388], [680, 432], [770, 456]],
    { seed: 9 + SEED, amp: 5 },
  );
  const r = rng(33 + SEED);

  // Hancock: gabled houses with snow-loaded roofs, tumbling toward the canal.
  let walls = "";
  let roofs = "";
  let roofShade = "";
  let houseLights = "";
  const houses = [];
  for (let i = 0; i < 40; i++) {
    const x = 930 + r() * 340;
    houses.push([x, interp(hancock, x) + 24 + r() * 84]);
  }
  houses.sort((a, b) => a[1] - b[1]); // paint back to front
  for (const [x, y] of houses) {
    const w = 12 + r() * 12;
    const h = 8 + r() * 6;
    const rh = h * 0.75;
    walls += `<rect x="${x.toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
    roofs += `<path d="M${(x - 1.5).toFixed(1)} ${(y - h + 1).toFixed(1)} L${(x + w / 2).toFixed(1)} ${(y - h - rh).toFixed(1)} L${(x + w + 1.5).toFixed(1)} ${(y - h + 1).toFixed(1)} Z"/>`;
    roofShade += `<path d="M${(x + w / 2).toFixed(1)} ${(y - h - rh).toFixed(1)} L${(x + w + 1.5).toFixed(1)} ${(y - h + 1).toFixed(1)} L${(x + w / 2).toFixed(1)} ${(y - h + 1).toFixed(1)} Z"/>`;
    if (r() < 0.75) houseLights += `<rect x="${(x + w * 0.25).toFixed(1)}" y="${(y - h * 0.72).toFixed(1)}" width="3" height="3.6" opacity="${(0.6 + r() * 0.4).toFixed(2)}"/>`;
    if (r() < 0.4) houseLights += `<rect x="${(x + w * 0.62).toFixed(1)}" y="${(y - h * 0.72).toFixed(1)}" width="3" height="3.6" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }

  // Tech campus + downtown Houghton on the left bank: flat roofs carry snow,
  // and each block gets a shaded side so it reads as a volume.
  let campus = "";
  let campusSide = "";
  let campusRoof = "";
  let campusLit = "";
  let campusDark = "";
  const spots = [
    [70, 70, 44], [150, 58, 52], [228, 64, 38], [470, 72, 46], [548, 60, 40], [610, 44, 30],
    [500, 40, 26], [585, 36, 22], [650, 30, 20],
  ];
  spots.forEach(([x, w, h], i) => {
    const base = interp(houghton, x + w / 2) + (i > 5 ? 70 : 34) + r() * 18;
    const top = base - h;
    campus += `<rect x="${x}" y="${top.toFixed(1)}" width="${w}" height="${h + 30}"/>`;
    campusSide += `<rect x="${x + w - w * 0.18}" y="${top.toFixed(1)}" width="${(w * 0.18).toFixed(1)}" height="${h + 30}"/>`;
    campusRoof += `<rect x="${x - 1}" y="${(top - 2.5).toFixed(1)}" width="${w + 2}" height="3.5" rx="1.5"/>`;
    const win = windows(x, top, w * 0.82, h, { rows: Math.round(h / 12), cols: Math.round((w * 0.82) / 10), r });
    campusLit += win.lit;
    campusDark += win.dark;
  });

  // MEEM: the tall concrete slab that owns the Houghton skyline.
  const meem = { x: 318, top: 250, w: 58, base: 452 };
  let meemBands = "";
  for (let y = meem.top + 12; y < meem.base - 10; y += 11) {
    for (let x = meem.x + 5; x < meem.x + meem.w - 6; x += 8) {
      if (r() < 0.62) meemBands += `<rect x="${x}" y="${y}" width="6" height="3.5" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
    }
  }

  const upper = [forest(hancock, { x0: 880, x1: 1680, seed: 41 + SEED, density: 0.85, depth: 60, size: [8, 16] }), forest(houghton, { x0: -80, x1: 720, seed: 42 + SEED, density: 0.85, depth: 60, size: [8, 16] })];
  buildStats.houses = houses.length;
  const lower = [forest(hancock, { x0: 1250, x1: 1680, seed: 43 + SEED, density: 0.6, depth: 170, size: [12, 22] }), forest(houghton, { x0: -80, x1: 300, seed: 44 + SEED, density: 0.6, depth: 170, size: [12, 22] })];
  buildStats.trees += upper[0].count + upper[1].count + lower[0].count + lower[1].count;

  return `
    <defs>
      <linearGradient id="h-hill" x1="0" y1="250" x2="0" y2="600" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#d4cbef"/>
        <stop offset=".35" stop-color="#8a7dc0"/>
        <stop offset="1" stop-color="#342d6b"/>
      </linearGradient>
      <linearGradient id="h-hillhaze" x1="0" y1="420" x2="0" y2="620" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#c79ac0" stop-opacity=".45"/>
        <stop offset="1" stop-color="#c79ac0" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="h-townglow">
        <stop offset="0" stop-color="${C.warm}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${C.warm}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g fill="url(#h-hill)" filter="url(#h-snowtex)"><path d="${area(hancock)}"/><path d="${area(houghton)}"/></g>
    <g fill="none" stroke="#f6f0ff" stroke-width="1.6" opacity=".6"><path d="${line(hancock)}"/><path d="${line(houghton)}"/></g>
    <path d="${upper[0].body}${upper[1].body}" fill="${C.pineFar}"/>
    <path d="${upper[0].snow}${upper[1].snow}" fill="#cfc7f0" opacity=".75"/>

    <ellipse cx="1100" cy="480" rx="220" ry="70" fill="url(#h-townglow)"/>
    <ellipse cx="360" cy="440" rx="320" ry="110" fill="url(#h-townglow)"/>

    <g fill="#2a2462">${walls}</g>
    <g fill="${C.snow}">${roofs}</g>
    <g fill="${C.snowShade}">${roofShade}</g>
    <g fill="${C.warm}" filter="url(#h-glow)">${houseLights}</g>

    <!-- Quincy Mine No. 2 shaft house, up on the Hancock ridge -->
    <g fill="${C.steel}">
      <path d="M1282 ${interp(hancock, 1300) + 6} L1282 222 L1304 176 L1318 176 L1318 196 L1350 ${interp(hancock, 1340) + 6} Z"/>
      <rect x="1350" y="250" width="34" height="${interp(hancock, 1370) - 244}"/>
    </g>
    <path d="M1304 176 L1318 176 L1318 196 L1350 ${interp(hancock, 1340) + 6}" fill="none" stroke="${C.snow}" stroke-width="2" opacity=".8"/>
    <path d="M1349 250 h36" stroke="${C.snow}" stroke-width="3" stroke-linecap="round"/>
    <rect x="1296" y="206" width="4" height="6" fill="${C.warm}" filter="url(#h-glow)"/>

    <path d="${lower[0].body}${lower[1].body}" fill="${C.pineMid}"/>
    <path d="${lower[0].snow}${lower[1].snow}" fill="#b8afe2" opacity=".8"/>

    <g fill="${C.building}">${campus}</g>
    <g fill="#171340" opacity=".55">${campusSide}</g>
    <g fill="#2e2966">${campusDark}</g>
    <g fill="${C.warm}" filter="url(#h-glow)">${campusLit}</g>
    <g fill="${C.snow}">${campusRoof}</g>

    <g fill="${C.building}">
      <rect x="${meem.x}" y="${meem.top}" width="${meem.w}" height="${meem.base - meem.top + 40}"/>
      <rect x="${meem.x + meem.w}" y="352" width="70" height="140"/>
      <rect x="${meem.x - 44}" y="326" width="44" height="160"/>
    </g>
    <rect x="${meem.x + meem.w - 12}" y="${meem.top}" width="12" height="${meem.base - meem.top + 40}" fill="#171340" opacity=".5"/>
    <path d="M${meem.x} ${meem.top} h${meem.w} v${meem.base - meem.top}" fill="none" stroke="${C.rim}" stroke-width="1.2" opacity=".5"/>
    <g fill="${C.warm}" filter="url(#h-glow)">${meemBands}</g>
    <g fill="${C.snow}">
      <rect x="${meem.x - 1}" y="${meem.top - 3}" width="${meem.w + 2}" height="4" rx="2"/>
      <rect x="${meem.x + meem.w}" y="349" width="71" height="4" rx="2"/>
      <rect x="${meem.x - 45}" y="323" width="45" height="4" rx="2"/>
    </g>

    <rect x="-100" y="420" width="1800" height="200" fill="url(#h-hillhaze)"/>
    ${plane("hills", "SVG · depth 0.24 · Houghton + Hancock")}
    <g class="bp">
      ${note(1150, 352, `forest() → ${upper[0].count + upper[1].count + lower[0].count + lower[1].count} × conifer()`, { dx: 50, dy: -70, topic: "spruce" })}
      ${note(meem.x + meem.w / 2, meem.top, "MEEM: 1 rect + seeded window bands", { dx: -40, dy: -50, topic: "rng" })}
      ${note(1100, 470, `${houses.length} gabled houses, painted back to front`, { dx: 60, dy: 40, topic: "rng" })}
    </g>`;
}

function water() {
  const r = rng(55 + SEED);
  const edge = (bank, dir) => {
    // an irregular shelf of snow-covered shore ice hugging each bank
    const out = [];
    const back = [];
    for (let y = 446; y <= 920; y += 12) {
      const x = bank(y);
      out.push([x - dir * 6, y]);
      back.unshift([x + dir * (3 + (y - 440) * 0.05 + r() * 10 * ((y - 440) / 480)), y]);
    }
    return line([...out, ...back]) + " Z";
  };

  // Loose pans of ice drifting in the channel, smaller with distance.
  let floes = "";
  let floeShade = "";
  for (let i = 0; i < 34; i++) {
    const y = 470 + r() ** 1.3 * 420;
    const k = (y - 430) / 470;
    const x = leftBank(y) + 20 + r() * (rightBank(y) - leftBank(y) - 40);
    const w = (8 + r() * 26) * k * 2.2;
    const h = w * (0.12 + r() * 0.06);
    const pts = Array.from({ length: 7 }, (_, j) => {
      const a = (j / 7) * Math.PI * 2;
      const rr = 0.7 + r() * 0.3;
      return [x + Math.cos(a) * w * rr, y + Math.sin(a) * h * rr];
    });
    floes += `<path d="${line(pts)} Z"/>`;
    floeShade += `<ellipse cx="${x.toFixed(1)}" cy="${(y + h * 0.9).toFixed(1)}" rx="${(w * 0.9).toFixed(1)}" ry="${(h * 0.5).toFixed(1)}"/>`;
  }

  let ripples = "";
  for (let i = 0; i < 70; i++) {
    const y = 470 + r() ** 1.4 * 430;
    const x = leftBank(y) + 30 + r() * (rightBank(y) - leftBank(y) - 60);
    ripples += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} h${(6 + ((y - 440) / 460) * 46 * r()).toFixed(0)}"/>`;
  }

  let streaks = "";
  [602, 700, 752, 808, 864, 916, 1010].forEach((x, i) => {
    streaks += `<rect class="shimmer" style="animation-delay:${-i * 0.7}s" x="${x - 2}" y="${WATERLINE - 50}" width="4" height="${(110 + r() * 160).toFixed(0)}" rx="2"/>`;
  });

  return `
    <defs>
      <linearGradient id="h-water" x1="0" y1="440" x2="0" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#f3b996"/>
        <stop offset=".1" stop-color="#8a5c92"/>
        <stop offset=".45" stop-color="#262159"/>
        <stop offset="1" stop-color="#0d0b2c"/>
      </linearGradient>
      <linearGradient id="h-fog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d7b2da" stop-opacity="0"/>
        <stop offset=".5" stop-color="#d7b2da" stop-opacity=".3"/>
        <stop offset="1" stop-color="#d7b2da" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="h-aurora-refl" x1="0" y1="440" x2="0" y2="760" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#58f5b8" stop-opacity="0"/>
        <stop offset=".25" stop-color="#58f5b8" stop-opacity=".2"/>
        <stop offset=".6" stop-color="#7b6cff" stop-opacity=".1"/>
        <stop offset="1" stop-color="#7b6cff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="h-streak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.warm}" stop-opacity=".75"/>
        <stop offset="1" stop-color="${C.warm}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="h-shelf" x1="0" y1="440" x2="0" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#b9a9d8"/>
        <stop offset="1" stop-color="#d9d3f6"/>
      </linearGradient>
      <clipPath id="h-canal"><path d="${canal}"/></clipPath>
      <!-- wind-ruffled water: stretch noise sideways, displace, then smear vertically -->
      <filter id="h-ripple" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.003 0.11" numOctaves="2" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/>
        <feGaussianBlur stdDeviation="0.8 1.8"/>
      </filter>
    </defs>
    <rect x="-100" y="400" width="1800" height="140" fill="url(#h-fog)"/>
    <path d="${canal}" fill="url(#h-water)"/>
    <path class="aurora-refl" d="${canal}" fill="url(#h-aurora-refl)"/>
    <g clip-path="url(#h-canal)">
      <g filter="url(#h-ripple)" opacity=".42">
        <g transform="translate(0 ${WATERLINE * 2}) scale(1 -1)">${bridgeStructure({ reflection: true })}</g>
      </g>
      <g fill="url(#h-streak)" filter="url(#h-ripple)">${streaks}</g>
    </g>
    <g stroke="#c9b6ef" stroke-width="1.2" stroke-linecap="round" opacity=".3">${ripples}</g>
    <g fill="#0c0a28" opacity=".35">${floeShade}</g>
    <g fill="#b3aadd" opacity=".75">${floes}</g>
    <g fill="url(#h-shelf)" filter="url(#h-snowtex)"><path d="${edge(leftBank, -1)}"/><path d="${edge(rightBank, 1)}"/></g>
    ${plane("water", "SVG · ground plane · affine shear per frame")}
    <g class="bp">
      ${note(808, 690, "bridge reflection: same SVG, scale(1,−1) + feDisplacementMap", { dx: 60, dy: 50 })}
      ${note(leftBank(520) + 20, 520, "far edge moves with the lake, near edge with the shore", { dx: -50, dy: -40, topic: "ground" })}
    </g>`;
}

// The Portage Lake Lift Bridge: two lattice towers with counterweights and
// sheaves, a Warren-truss lift span hung on cables between them, and
// Pratt approach spans. Shared by the bridge layer and its reflection.
const DECK = 552;
const TOWERS = [
  { x: 688, w: 34 },
  { x: 894, w: 34 },
];

function bridgeStructure({ reflection = false } = {}) {
  let legs = "";
  let lacing = "";
  let bracing = "";
  let tops = "";
  let weights = "";
  let cables = "";
  TOWERS.forEach(({ x, w }) => {
    for (const lx of [x, x + w - 7]) {
      legs += `<rect x="${lx}" y="358" width="1.8" height="${DECK - 350}"/><rect x="${lx + 5.2}" y="358" width="1.8" height="${DECK - 350}"/>`;
      for (let y = 360; y < DECK; y += 8) lacing += ` M${lx + 1} ${y} L${lx + 6} ${y + 8}`;
    }
    for (let y = 372; y < DECK - 20; y += 30) bracing += ` M${x + 7} ${y} L${x + w - 7} ${y + 30} M${x + w - 7} ${y} L${x + 7} ${y + 30} M${x + 7} ${y} L${x + w - 7} ${y}`;
    tops += `<rect x="${x - 7}" y="340" width="${w + 14}" height="20" rx="2"/><circle cx="${x + 4}" cy="338" r="7"/><circle cx="${x + w - 4}" cy="338" r="7"/>`;
    weights += `<rect x="${x + 9}" y="372" width="${w - 18}" height="40"/>`;
  });
  const span0 = TOWERS[0].x + TOWERS[0].w;
  const span1 = TOWERS[1].x;
  cables = `M${TOWERS[0].x + TOWERS[0].w - 4} 338 L${span0 + 2} 500 M${TOWERS[1].x + 4} 338 L${span1 - 2} 500`;

  let rail = "";
  for (let x = 534; x <= 1086; x += 9) rail += ` M${x} ${DECK} v-5`;

  return `
    <g fill="#221e50">
      <rect x="${TOWERS[0].x - 6}" y="${DECK + 6}" width="46" height="${WATERLINE - DECK - 6}"/>
      <rect x="${TOWERS[1].x - 6}" y="${DECK + 6}" width="46" height="${WATERLINE - DECK - 6}"/>
    </g>
    <g fill="none" stroke="${C.steel}" stroke-linejoin="round">
      <path stroke-width="2.6" d="${truss(548, TOWERS[0].x, 530, DECK, 7)}"/>
      <path stroke-width="2.6" d="${truss(TOWERS[1].x + TOWERS[1].w, 1072, 530, DECK, 7)}"/>
      <path stroke-width="3" d="${truss(span0, span1, 500, DECK - 4, 10)}"/>
      <path stroke-width="1.2" d="${lacing}"/>
      <path stroke-width="1.6" d="${bracing}"/>
      <path stroke-width="1.2" d="${cables}"/>
      <path stroke-width="1.2" d="${rail} M534 ${DECK - 5} H1086"/>
    </g>
    <g fill="${C.steel}">${legs}${weights}${tops}<rect x="530" y="${DECK}" width="560" height="8"/><rect x="${span0}" y="${DECK + 8}" width="${span1 - span0}" height="4"/></g>
    ${reflection ? "" : `<g fill="none" stroke="${C.rim}" stroke-width="1.2" opacity=".7">
      <path d="M548 530 H${TOWERS[0].x} M${span0} 500 H${span1} M${TOWERS[1].x + TOWERS[1].w} 530 H1072"/>
      <path d="M${TOWERS[0].x - 7} 340 h${TOWERS[0].w + 14} M${TOWERS[1].x - 7} 340 h${TOWERS[1].w + 14}"/>
    </g>
    <g fill="${C.snow}">
      <rect x="${TOWERS[0].x - 8}" y="337" width="${TOWERS[0].w + 16}" height="3.5" rx="1.5"/>
      <rect x="${TOWERS[1].x - 8}" y="337" width="${TOWERS[1].w + 16}" height="3.5" rx="1.5"/>
      <rect x="${TOWERS[0].x - 10}" y="${WATERLINE - 8}" width="54" height="8" rx="4"/>
      <rect x="${TOWERS[1].x - 10}" y="${WATERLINE - 8}" width="54" height="8" rx="4"/>
    </g>`}`;
}

function bridge() {
  let lamps = "";
  for (let x = 556; x <= 1068; x += 32) lamps += `<rect x="${x - 0.6}" y="${DECK - 16}" width="1.2" height="16" fill="${C.steel}"/>`;
  let lampHeads = "";
  for (let x = 556; x <= 1068; x += 32) lampHeads += `<circle cx="${x}" cy="${DECK - 17}" r="2.2"/>`;

  return `
    ${bridgeStructure()}
    ${lamps}
    <g fill="${C.warm}" filter="url(#h-bloom)">${lampHeads}
      <rect x="${TOWERS[0].x + 10}" y="347" width="5" height="6"/><rect x="${TOWERS[1].x + 18}" y="347" width="5" height="6"/>
    </g>
    <g fill="#ff4d5e" filter="url(#h-bloom)">
      <circle class="beacon" cx="${TOWERS[0].x + 17}" cy="328" r="2.8"/>
      <circle class="beacon" style="animation-delay:-.9s" cx="${TOWERS[1].x + 17}" cy="328" r="2.8"/>
    </g>
    <g filter="url(#h-glow)">
      <g class="car car--east"><circle r="2.2" cy="${DECK - 4}" fill="#fff6d6"/><circle r="2.2" cx="-7" cy="${DECK - 4}" fill="#fff6d6"/></g>
      <g class="car car--west"><circle r="2" cy="${DECK - 4}" fill="#ff5a5a"/><circle r="2" cx="7" cy="${DECK - 4}" fill="#ff5a5a"/></g>
    </g>
    ${plane("bridge", "SVG · depth " + groundDepth(WATERLINE).toFixed(2) + " · matched to the waterline")}
    <g class="bp">
      ${note(TOWERS[1].x + TOWERS[1].w, 380, "bridgeStructure(): drawn here and mirrored in the canal", { dx: 60, dy: -50 })}
      ${note(780, 520, "truss(): Warren lift span, Pratt approaches", { dx: -60, dy: -60 })}
    </g>`;
}

function fore() {
  const bank = ridge(
    [[-80, 772], [200, 752], [420, 776], [640, 798], [820, 810], [1000, 804], [1200, 786], [1420, 772], [1680, 780]],
    { seed: 71 + SEED, amp: 4, step: 12 },
  );
  const trail = ridge([[-80, 836], [260, 818], [560, 830], [860, 842], [1160, 826], [1680, 836]], { seed: 90 + SEED, amp: 3, step: 12 });
  const r = rng(77 + SEED);

  let lampPosts = "";
  let lampLights = "";
  let lampPools = "";
  for (const x of [470, 930, 1480]) {
    const y = interp(trail, x);
    lampPosts += `<rect x="${x - 2}" y="${y - 96}" width="4" height="84"/><path d="M${x - 9} ${y - 96} h18 l-4 -8 h-10 Z"/>`;
    lampLights += `<circle cx="${x}" cy="${y - 98}" r="4"/>`;
    lampPools += `<ellipse cx="${x + 4}" cy="${y + 2}" rx="95" ry="16"/>`;
  }

  // Footprints pressed into the trail, alternating left/right.
  let prints = "";
  for (let x = -60; x < 1680; x += 17 + r() * 6) {
    const side = Math.round(x / 17) % 2 ? -4 : 4;
    prints += `<ellipse cx="${x.toFixed(1)}" cy="${(interp(trail, x) + side).toFixed(1)}" rx="3.2" ry="1.6"/>`;
  }

  // Wind ripples (sastrugi) etched across the snowbank.
  let sastrugi = "";
  for (let i = 0; i < 40; i++) {
    const x = r() * 1700 - 60;
    const y = interp(bank, x) + 12 + r() * 90;
    sastrugi += `M${x.toFixed(0)} ${y.toFixed(0)} q${(20 + r() * 30).toFixed(0)} -4 ${(50 + r() * 60).toFixed(0)} 0 `;
  }

  // String lights over the carnival grounds, hung on a sagging curve.
  const [p0, p1] = [[1000, 612], [1460, 596]];
  let bulbs = "";
  const hues = [C.warm, "#7ff3ff", "#ff8fe1", C.warm];
  for (let i = 1; i < 22; i++) {
    const t = i / 22;
    const x = p0[0] + (p1[0] - p0[0]) * t;
    const y = p0[1] + (p1[1] - p0[1]) * t + Math.sin(t * Math.PI) * 58;
    bulbs += `<circle class="bulb" style="animation-delay:${(-r() * 3).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="3" fill="${hues[i % hues.length]}"/>`;
  }
  const cable = `M${p0[0]} ${p0[1]} Q${(p0[0] + p1[0]) / 2} ${(p0[1] + p1[1]) / 2 + 116} ${p1[0]} ${p1[1]}`;

  // Snow statue masonry: courses of packed-snow blocks.
  let courses = "";
  for (let y = 632; y < 760; y += 14) courses += ` M1236 ${y} H1332`;
  for (let y = 680; y < 760; y += 14) courses += ` M1164 ${y} H1208 M1360 ${y} H1404`;

  // The husky, sitting proud on its plinth and looking up the canal.
  const husky =
    "M-34 0 L-34 -7 L-26 -9 L-24 -60 L-34 -78 L-40 -96 L-58 -104 L-63 -110 L-45 -118 L-37 -122 L-35 -142 L-25 -127 " +
    "L-18 -143 L-12 -120 L-4 -100 L14 -72 L30 -42 L36 -16 L44 -22 L52 -40 L47 -53 L57 -48 L61 -30 L50 -9 L40 0 Z";
  const huskyFacets = "M-24 -60 L-34 -78 L-4 -100 L14 -72 Z M-12 -120 L-4 -100 L-34 -78 L-40 -96 Z M14 -72 L30 -42 L36 -16 L4 -30 Z";
  const huskySnow = "M-45 -119 L-37 -123 L-30 -122 L-38 -118 Z M-12 -121 L-4 -102 L6 -88 L1 -90 L-7 -103 Z M14 -73 L22 -60 L18 -60 Z";

  const trees = [
    conifer(56, 842, 330, r, 7),
    conifer(170, 818, 220, r, 6),
    conifer(1592, 836, 340, r, 7),
    conifer(1486, 806, 200, r, 6),
  ];
  buildStats.trees += trees.length;

  return `
    <defs>
      <linearGradient id="h-bank" x1="0" y1="740" x2="0" y2="900" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#ece7fe"/>
        <stop offset="1" stop-color="#8f86c9"/>
      </linearGradient>
      <linearGradient id="h-bronze" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#d9995f"/>
        <stop offset=".55" stop-color="#7c4c2e"/>
        <stop offset="1" stop-color="#32201a"/>
      </linearGradient>
      <linearGradient id="h-ice" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbf9ff"/>
        <stop offset="1" stop-color="#aea5e0"/>
      </linearGradient>
      <linearGradient id="h-beam-a" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#6fe7ff" stop-opacity=".5"/>
        <stop offset="1" stop-color="#6fe7ff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="h-beam-b" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#ff7ad9" stop-opacity=".45"/>
        <stop offset="1" stop-color="#ff7ad9" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="h-spot-a"><stop offset="0" stop-color="#6fe7ff" stop-opacity=".45"/><stop offset="1" stop-color="#6fe7ff" stop-opacity="0"/></radialGradient>
      <radialGradient id="h-spot-b"><stop offset="0" stop-color="#ff7ad9" stop-opacity=".4"/><stop offset="1" stop-color="#ff7ad9" stop-opacity="0"/></radialGradient>
      <radialGradient id="h-pool"><stop offset="0" stop-color="${C.warm}" stop-opacity=".4"/><stop offset="1" stop-color="${C.warm}" stop-opacity="0"/></radialGradient>
    </defs>

    <!-- Winter Carnival snow statue, washed by coloured floodlights -->
    <g transform="translate(-70 0)">
      <g class="beam" style="mix-blend-mode:screen">
        <path d="M1180 796 L1040 470 L1250 470 Z" fill="url(#h-beam-a)"/>
        <path d="M1390 796 L1300 460 L1520 460 Z" fill="url(#h-beam-b)"/>
      </g>
      <ellipse cx="1210" cy="690" rx="190" ry="150" fill="url(#h-spot-a)"/>
      <ellipse cx="1360" cy="700" rx="180" ry="140" fill="url(#h-spot-b)"/>
      <g fill="url(#h-ice)" filter="url(#h-snowtex)">
        <path d="M1128 800 L1148 758 L1430 758 L1452 800 Z"/>
        <rect x="1236" y="622" width="96" height="140"/>
        <rect x="1164" y="668" width="44" height="94"/><path d="M1158 670 L1186 606 L1214 670 Z"/>
        <rect x="1360" y="668" width="44" height="94"/><path d="M1354 670 L1382 606 L1410 670 Z"/>
        <rect x="1262" y="570" width="44" height="56"/><path d="M1256 572 L1284 506 L1312 572 Z"/>
        <path d="M1236 622 v-12 h14 v12 h12 v-12 h14 v12 h12 v-12 h14 v12 h12 v-12 h14 v12 Z"/>
        <path d="M1208 700 H1236 V762 H1208 Z M1332 700 H1360 V762 H1332 Z"/>
      </g>
      <path d="${courses}" fill="none" stroke="#9f97d6" stroke-width="1" opacity=".5"/>
      <g fill="#8d84c8" opacity=".6">
        <rect x="1306" y="622" width="26" height="140"/><rect x="1192" y="668" width="16" height="94"/>
        <rect x="1388" y="668" width="16" height="94"/><path d="M1186 606 L1214 670 L1194 670 Z M1382 606 L1410 670 L1390 670 Z M1284 506 L1312 572 L1292 572 Z"/>
      </g>
      <path d="M1266 762 V716 a18 18 0 0 1 36 0 V762 Z" fill="#3b3478"/>
      <path d="M1272 762 V718 a12 12 0 0 1 24 0 V762 Z" fill="${C.warm}" opacity=".45"/>
      <g fill="#1a163f"><rect x="1172" y="788" width="16" height="10" rx="2"/><rect x="1384" y="788" width="16" height="10" rx="2"/></g>
    </g>

    <path d="${cable}" fill="none" stroke="${C.pineNear}" stroke-width="1.5"/>
    <g fill="${C.pineNear}"><rect x="${p0[0] - 3}" y="${p0[1]}" width="6" height="${800 - p0[1]}"/><rect x="${p1[0] - 3}" y="${p1[1]}" width="6" height="${800 - p1[1]}"/></g>
    <g filter="url(#h-glow)">${bulbs}</g>

    <path d="${area(bank)}" fill="url(#h-bank)" filter="url(#h-snowtex)"/>
    <path d="${line(bank)}" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>
    <path d="${sastrugi}" fill="none" stroke="#a79fd8" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>

    <!-- groomed running trail, lamp-lit -->
    <g fill="${C.pineNear}">${lampPosts}</g>
    <path d="${line(trail)}" fill="none" stroke="#a49bd8" stroke-width="36" stroke-linecap="round"/>
    <path d="${line(trail)}" fill="none" stroke="#f7f5ff" stroke-width="29" stroke-linecap="round"/>
    <g fill="#cbc4ee">${prints}</g>
    <g fill="url(#h-pool)">${lampPools}</g>
    <g fill="${C.warm}" filter="url(#h-bloom)">${lampLights}</g>
    <g fill="${C.snow}">${[470, 930, 1480].map((x) => `<rect x="${x - 10}" y="${interp(trail, x) - 106}" width="20" height="3" rx="1.5"/>`).join("")}</g>

    <!-- Husky statue -->
    <g transform="translate(${HUSKY_X} 0)">
      <path d="M-58 ${interp(bank, HUSKY_X) + 14} L-58 700 L58 700 L58 ${interp(bank, HUSKY_X) + 14} Z" fill="#3a3370" filter="url(#h-snowtex)"/>
      <path d="M-58 700 L-46 690 L70 690 L58 700 Z" fill="#6a61a8"/>
      <path d="M58 700 L70 690 L70 ${interp(bank, HUSKY_X + 70) + 6} L58 ${interp(bank, HUSKY_X + 58) + 14} Z" fill="#241f52"/>
      <path d="M-60 700 q20 -12 40 -6 q28 -8 50 -2 q20 -6 42 -2 l-2 10 Z" fill="#f4f1ff"/>
      <g transform="translate(6 694) scale(-1.08 1.08)">
        <path d="${husky}" fill="url(#h-bronze)"/>
        <path d="${huskyFacets}" fill="#000" opacity=".18"/>
        <path d="M-63 -110 L-45 -118 L-37 -122 L-35 -142" fill="none" stroke="#ffd2a6" stroke-width="1.4" opacity=".7"/>
        <path d="${huskySnow}" fill="#f4f1ff"/>
      </g>
      <path d="M-58 ${interp(bank, HUSKY_X) + 14} q58 -18 128 -6 v20 h-128 Z" fill="#e9e4fc"/>
    </g>

    <path d="${trees.map((t) => t.body).join("")}" fill="${C.pineNear}"/>
    <path d="${trees.map((t) => t.snow).join("")}" fill="#d9d3f5"/>

    <path class="ridge" d="${line(trail)}" fill="none"/>
    <g class="runner-track">
      <g class="runner">
        <path d="M14 -78 L120 -100 L120 -46 Z" fill="${C.warm}" opacity=".14"/>
        <g fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
          ${runnerLimbs("b", "#2f2a66")}
          <path d="M0 -40 L8 -67" stroke="${C.pineNear}" stroke-width="7"/>
          <circle cx="11" cy="-77" r="7.5" fill="${C.pineNear}" stroke="none"/>
          ${runnerLimbs("a", C.pineNear)}
        </g>
        <circle cx="17" cy="-79" r="2.4" fill="${C.warm}" filter="url(#h-bloom)"/>
      </g>
    </g>
    ${plane("foreground", "SVG · depth 1.00 · fastest layer")}
    <g class="bp">
      ${note(56, 600, "conifer(): 7 jittered tiers, snow per branch", { dx: 50, dy: -50, topic: "spruce" })}
      ${note(HUSKY_X, 560, "Husky: one hand-placed path + facet shading", { dx: 50, dy: -40 })}
      ${note(760, interp(trail, 760) - 60, "runner: 6 jointed groups, CSS keyframes, 0.64s stride", { dx: 40, dy: -70, topic: "runner" })}
    </g>`;
}

// One side of the runner. Each joint is its own group so the CSS rotation
// pivots where it should: thigh at the hip, shin at the knee, arm at the shoulder.
function runnerLimbs(side, color) {
  return `
    <g stroke="${color}">
      <g transform="translate(0 -40)"><g class="thigh thigh--${side}"><path d="M0 0 V19"/>
        <g transform="translate(0 19)"><g class="shin shin--${side}"><path d="M0 0 V19 L6 20"/></g></g>
      </g></g>
      <g transform="translate(6 -62)"><g class="arm arm--${side}"><path d="M0 0 V14"/>
        <g transform="translate(0 14) rotate(-85)"><path d="M0 0 V12"/></g>
      </g></g>
    </g>`;
}
