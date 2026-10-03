// ---------------------------------------------------------------------------
// SwarmSim — the unseen field
//
// Lures are invisible targets the flock chases; hawks are predators it flees.
// Both live on the CPU (a handful of points) and are uploaded with the params
// each frame. Lures fly like birds themselves: a fixed speed and a limited
// turn rate toward a waypoint, so they trace arcs and loops rather than lines.
// Now and then one jinks to a new waypoint far away, and each one eventually
// fades out while a replacement fades in somewhere else. Those three things
// are what keep the swarm turning, folding and splitting.
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

      // A sudden change of mind: the whole flock behind it has to fold back.
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

    // Hawks make passes at a lure — where the birds are likely to be — aiming
    // a little off so they cut through the flock rather than sit in it. They
    // turn slowly, so each pass overshoots and swings around for another.
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

  // Debug overlay. `toScreen` maps world to CSS pixels.
  function draw(g, P, toScreen, wpp) {
    g.lineWidth = 1;
    for (const l of lures) {
      const s = toScreen(l.x, l.y);
      const w = toScreen(l.wx, l.wy);
      g.globalAlpha = 0.25 + 0.75 * l.weight;
      g.strokeStyle = '#7fd4ff';
      g.setLineDash([4, 6]);
      g.beginPath(); g.arc(s.x, s.y, P.lureInner / wpp, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(w.x, w.y); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#7fd4ff';
      g.beginPath(); g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    for (const h of hawks) {
      const s = toScreen(h.x, h.y);
      g.strokeStyle = '#ff6a5a';
      g.beginPath(); g.arc(s.x, s.y, P.hawkRadius / wpp, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#ff6a5a';
      g.beginPath(); g.arc(s.x, s.y, 5, 0, Math.PI * 2); g.fill();
    }
  }

  return { reset, step, draw };
})();
