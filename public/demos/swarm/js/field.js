// ---------------------------------------------------------------------------
// SwarmSim: lures and hawks
//
// Lures are invisible targets the flocks chase. Hawks are predators they flee.
// There are only a few of each, so they run on the CPU and are uploaded with
// the params every frame. A lure flies at a fixed speed with a limited turn
// rate, so it moves in arcs. Sometimes it switches to a far waypoint, and
// after a while it fades out while a new one fades in elsewhere.
// ---------------------------------------------------------------------------

const Field = (() => {

  const MAX_LURES = 8;   // slots; includes lures that are fading out
  const MAX_HAWKS = 4;
  const FADE = 3;        // seconds to fade a lure in or out

  const lureData = new Float32Array(MAX_LURES * 4);
  const hawkData = new Float32Array(MAX_HAWKS * 4);
  let lures = [];
  let hawks = [];

  const out = { lures: lureData, hawks: hawkData, lureCount: 0, hawkCount: 0 };

  const rand  = (a, b) => a + Math.random() * (b - a);
  const angle = (x, y) => Math.atan2(y, x);

  function pointNear(P, r) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return { x: P.centerX + Math.cos(a) * d, y: P.centerY + Math.sin(a) * d };
  }

  function makeLure(P, fadeIn) {
    const p = pointNear(P, P.roamRadius);
    const w = pointNear(P, P.roamRadius);
    return {
      x: p.x, y: p.y,
      heading: Math.random() * Math.PI * 2,
      wx: w.x, wy: w.y,
      // Each lure has its own temperament, so they never move in lockstep.
      speedMul: rand(0.75, 1.2),
      turnMul:  rand(0.7, 1.3),
      life:     rand(10, 28),
      weight:   fadeIn ? 0 : 1,
      dying:    false,
    };
  }

  function makeHawk(P) {
    const p = pointNear(P, P.roamRadius * 1.3);
    return { x: p.x, y: p.y, heading: Math.random() * Math.PI * 2,
             tx: P.centerX, ty: P.centerY, retarget: 0 };
  }

  // Turn toward a target at a capped rate, then fly forward.
  function steer(a, tx, ty, speed, turn, dt) {
    let d = angle(tx - a.x, ty - a.y) - a.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    a.heading += Math.max(-turn * dt, Math.min(turn * dt, d));
    a.x += Math.cos(a.heading) * speed * dt;
    a.y += Math.sin(a.heading) * speed * dt;
  }

  function reset(P) {
    lures = [];
    hawks = [];
    for (let i = 0; i < P.lureCount; i++) lures.push(makeLure(P, false));
    for (let i = 0; i < P.hawkCount; i++) hawks.push(makeHawk(P));
  }

  function step(P, dt) {
    const want = Math.min(P.lureCount | 0, MAX_LURES);

    // Keep the live (non-dying) count at the slider value.
    let live = lures.filter((l) => !l.dying);
    while (live.length > want) { live.pop().dying = true; live = lures.filter((l) => !l.dying); }
    while (live.length < want && lures.length < MAX_LURES) {
      const l = makeLure(P, true);
      lures.push(l);
      live.push(l);
    }

    for (const l of lures) {
      l.life -= dt;
      if (l.life <= 0 && !l.dying) {
        l.dying = true;
        // Replace it straight away so the territory is handed over gradually.
        if (lures.length < MAX_LURES) lures.push(makeLure(P, true));
      }
      l.weight = l.dying ? Math.max(0, l.weight - dt / FADE)
                         : Math.min(1, l.weight + dt / FADE);

      // Switch to a new waypoint when this one is reached, or at random.
      const near = Math.hypot(l.wx - l.x, l.wy - l.y) < 200;
      if (near || Math.random() < P.lureJink * dt) {
        const w = pointNear(P, P.roamRadius);
        l.wx = w.x; l.wy = w.y;
      }
      steer(l, l.wx, l.wy, P.lureSpeed * l.speedMul, P.lureTurn * l.turnMul, dt);
    }
    lures = lures.filter((l) => !(l.dying && l.weight <= 0));

    while (hawks.length > Math.min(P.hawkCount | 0, MAX_HAWKS)) hawks.pop();
    while (hawks.length < Math.min(P.hawkCount | 0, MAX_HAWKS)) hawks.push(makeHawk(P));

    // Hawks aim near a random lure, since that's where the birds are, with an
    // offset so they cut through the flock. They turn slowly, so each pass
    // overshoots and loops back.
    for (const h of hawks) {
      h.retarget -= dt;
      if (h.retarget <= 0 && lures.length) {
        const l = lures[(Math.random() * lures.length) | 0];
        const o = rand(0, P.lureOuter);
        const a = Math.random() * Math.PI * 2;
        h.tx = l.x + Math.cos(a) * o;
        h.ty = l.y + Math.sin(a) * o;
        h.retarget = rand(2.5, 6);
      }
      steer(h, h.tx, h.ty, P.hawkSpeed, 1.4, dt);
    }

    lureData.fill(0);
    lures.forEach((l, i) => {
      lureData[i * 4] = l.x; lureData[i * 4 + 1] = l.y; lureData[i * 4 + 2] = l.weight;
    });
    hawkData.fill(0);
    hawks.forEach((h, i) => { hawkData[i * 4] = h.x; hawkData[i * 4 + 1] = h.y; });
    out.lureCount = lures.length;
    out.hawkCount = hawks.length;
    return out;
  }

  // Where the action is: the weighted centre of the lures and how far they
  // spread from it. The auto camera frames this.
  function bounds() {
    let sw = 0, x = 0, y = 0;
    for (const l of lures) { sw += l.weight; x += l.x * l.weight; y += l.y * l.weight; }
    if (sw < 1e-3) return null;
    x /= sw; y /= sw;
    let radius = 0;
    for (const l of lures) {
      if (l.weight > 0.3) radius = Math.max(radius, Math.hypot(l.x - x, l.y - y));
    }
    return { x, y, radius };
  }

  // Overlay showing the unseen field. `toScreen` maps world to device pixels.
  function draw(g, P, toScreen, wpp, dpr = 1) {
    const dot = 4 * dpr;
    g.lineWidth = dpr;
    for (const l of lures) {
      const s = toScreen(l.x, l.y);
      const w = toScreen(l.wx, l.wy);
      g.globalAlpha = 0.25 + 0.75 * l.weight;
      g.strokeStyle = '#7fd4ff';
      g.setLineDash([4 * dpr, 6 * dpr]);
      g.beginPath(); g.arc(s.x, s.y, P.lureInner / wpp, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(w.x, w.y); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#7fd4ff';
      g.beginPath(); g.arc(s.x, s.y, dot, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    for (const h of hawks) {
      const s = toScreen(h.x, h.y);
      g.strokeStyle = '#ff6a5a';
      g.beginPath(); g.arc(s.x, s.y, P.hawkRadius / wpp, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ff6a5a';
      g.beginPath(); g.arc(s.x, s.y, dot, 0, Math.PI * 2); g.fill();
    }
  }

  return { reset, step, bounds, draw };
})();
