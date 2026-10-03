// ---------------------------------------------------------------------------
// SwarmSim: WGSL shader sources
//
// Everything the simulation does lives here. The CPU never sees a boid; it only
// writes a 336-byte parameter block each frame and issues dispatches.
//
// Per-frame pipeline (single compute pass, 6 dispatches):
//   clearCells -> countCells -> scanBlocks -> scanSums -> scanAdd -> scatter -> flock
//
// That is a counting sort by spatial-hash bucket. O(N), no comparison sort.
// ---------------------------------------------------------------------------

const SHADERS = {};

// Shared by every compute kernel. One module, one bind group, six entry points.
SHADERS.compute = /* wgsl */ `

struct Params {
  count        : u32,   // active boids
  tableSize    : u32,   // hash buckets (power of two)
  maxPerCell   : u32,   // neighbour sampling cap, per cell
  flags        : u32,

  cellSize     : f32,
  percepRadius : f32,
  sepRadius    : f32,
  sepWeight    : f32,

  aliWeight    : f32,
  cohWeight    : f32,
  maxSpeed     : f32,
  maxForce     : f32,

  gStrength    : f32,
  gExponent    : f32,
  gRefScale    : f32,
  swirl        : f32,

  drag         : f32,
  dt           : f32,
  mouseStrength: f32,
  mouseRadius  : f32,

  center       : vec2f,
  mousePos     : vec2f,

  seed         : u32,
  spawnStart   : u32,
  spawnEnd     : u32,
  spawnRadius  : f32,

  lureCount    : u32,   // unseen targets the flock chases
  hawkCount    : u32,   // predators it flees
  minSpeed     : f32,   // fraction of maxSpeed; birds cannot hover
  lurePull     : f32,

  lureInner    : f32,   // no pull inside this radius: free flocking
  lureOuter    : f32,   // full pull beyond this one
  hawkFear     : f32,
  hawkRadius   : f32,

  lures        : array<vec4f, 8>,   // xy = position, z = weight (fades 0..1)
  hawks        : array<vec4f, 4>,   // xy = position
};

@group(0) @binding(0) var<uniform>             P          : Params;
@group(0) @binding(1) var<storage, read_write> pos        : array<vec2f>;
@group(0) @binding(2) var<storage, read_write> vel        : array<vec2f>;
@group(0) @binding(3) var<storage, read_write> sortedPos  : array<vec2f>;
@group(0) @binding(4) var<storage, read_write> sortedVel  : array<vec2f>;
@group(0) @binding(5) var<storage, read_write> cellCount  : array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> cellStart  : array<u32>;
@group(0) @binding(7) var<storage, read_write> blockSums  : array<u32>;
@group(0) @binding(8) var<storage, read_write> cellCursor : array<atomic<u32>>;

const WG : u32 = 256u;

// --- helpers ---------------------------------------------------------------

fn cellOf(p: vec2f) -> vec2i {
  return vec2i(floor(p / P.cellSize));
}

// Spatial hash. Buckets collide, but a colliding boid sits far away in world
// space and fails the radius test below, so a collision costs a few wasted
// reads and never changes the result.
fn hashCell(c: vec2i) -> u32 {
  var h = (u32(c.x) * 73856093u) ^ (u32(c.y) * 19349663u);
  h ^= h >> 15u;
  h *= 2246822519u;
  h ^= h >> 13u;
  return h & (P.tableSize - 1u);
}

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

fn rnd(s: u32) -> f32 {
  return f32(pcg(s)) * (1.0 / 4294967296.0);
}

fn limit(v: vec2f, m: f32) -> vec2f {
  let l = length(v);
  if (l > m && l > 1e-9) { return v * (m / l); }
  return v;
}

// --- seeding ---------------------------------------------------------------
// Seeds [spawnStart, spawnEnd) only, so raising the boid-count slider injects
// new boids without disturbing the ones already flying.

@compute @workgroup_size(256)
fn init(@builtin(global_invocation_id) gid: vec3u) {
  let i = P.spawnStart + gid.x;
  if (i >= P.spawnEnd) { return; }

  let s = i * 3u + P.seed;
  let a = rnd(s) * 6.28318530718;
  // sqrt of a uniform gives a uniform *area* distribution over the disc.
  let r = sqrt(rnd(s + 1u)) * P.spawnRadius;
  let dir = vec2f(cos(a), sin(a));

  let p = P.center + dir * r;
  pos[i] = p;
  // Launch along a smooth flow field, so neighbours start roughly aligned
  // but the swarm as a whole doesn't rotate.
  let h = sin(p.x * 0.0021 + 1.3) * 2.1 + cos(p.y * 0.0017 - 0.4) * 2.3
        + (rnd(s + 2u) - 0.5) * 0.6;
  vel[i] = vec2f(cos(h), sin(h)) * (0.6 + 0.4 * rnd(s + 2u)) * P.maxSpeed;
}

// --- spatial hash: count ---------------------------------------------------

@compute @workgroup_size(256)
fn clearCells(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= P.tableSize) { return; }
  atomicStore(&cellCount[gid.x], 0u);
}

@compute @workgroup_size(256)
fn countCells(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.count) { return; }
  atomicAdd(&cellCount[hashCell(cellOf(pos[i]))], 1u);
}

// --- spatial hash: exclusive prefix scan over the bucket counts ------------
// Two-level Hillis-Steele. Level 1 scans each 256-wide block, level 2 scans the
// block totals, level 3 folds the block offsets back in.

var<workgroup> sdata : array<u32, 256>;

@compute @workgroup_size(256)
fn scanBlocks(@builtin(global_invocation_id) gid: vec3u,
              @builtin(local_invocation_id)  lid: vec3u,
              @builtin(workgroup_id)         wid: vec3u) {
  let t = lid.x;
  let g = gid.x;

  var val = 0u;
  if (g < P.tableSize) { val = atomicLoad(&cellCount[g]); }
  sdata[t] = val;
  workgroupBarrier();

  for (var off = 1u; off < WG; off = off << 1u) {
    var add = 0u;
    if (t >= off) { add = sdata[t - off]; }
    workgroupBarrier();
    sdata[t] = sdata[t] + add;
    workgroupBarrier();
  }

  let incl = sdata[t];
  if (g < P.tableSize) { cellStart[g] = incl - val; }   // inclusive -> exclusive
  if (t == WG - 1u)    { blockSums[wid.x] = incl; }
}

var<workgroup> sdata2 : array<u32, 256>;

@compute @workgroup_size(256)
fn scanSums(@builtin(local_invocation_id) lid: vec3u) {
  let t   = lid.x;
  let nb  = P.tableSize / WG;              // number of blocks
  let per = (nb + WG - 1u) / WG;           // blocks handled per thread (<= 8)

  // Serial scan of this thread's slice, keeping the running prefix.
  var vals : array<u32, 8>;
  var run = 0u;
  for (var k = 0u; k < per; k = k + 1u) {
    let idx = t * per + k;
    var x = 0u;
    if (idx < nb) { x = blockSums[idx]; }
    vals[k] = run;
    run = run + x;
  }

  sdata2[t] = run;
  workgroupBarrier();
  for (var off = 1u; off < WG; off = off << 1u) {
    var add = 0u;
    if (t >= off) { add = sdata2[t - off]; }
    workgroupBarrier();
    sdata2[t] = sdata2[t] + add;
    workgroupBarrier();
  }
  let base = sdata2[t] - run;

  for (var k = 0u; k < per; k = k + 1u) {
    let idx = t * per + k;
    if (idx < nb) { blockSums[idx] = base + vals[k]; }
  }
}

@compute @workgroup_size(256)
fn scanAdd(@builtin(global_invocation_id) gid: vec3u,
           @builtin(workgroup_id)         wid: vec3u) {
  let g = gid.x;
  if (g >= P.tableSize) { return; }
  let v = cellStart[g] + blockSums[wid.x];
  cellStart[g] = v;
  // Seed the scatter cursor here too. A copyBufferToBuffer would split the
  // compute work across two passes.
  atomicStore(&cellCursor[g], v);
}

// --- spatial hash: scatter -------------------------------------------------
// Reorders boids so that everything in a bucket is contiguous in memory. This
// is the single biggest win in the whole simulation: the flocking kernel's
// inner loop becomes a linear walk instead of random access.

@compute @workgroup_size(256)
fn scatter(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.count) { return; }
  let p = pos[i];
  let d = atomicAdd(&cellCursor[hashCell(cellOf(p))], 1u);
  if (d < P.count) {
    sortedPos[d] = p;
    sortedVel[d] = vel[i];
  }
}

// --- flocking --------------------------------------------------------------
// Reads sorted*, writes pos/vel. Both arrays share indexing, so next frame's
// countCells reads them directly, with no ping-pong buffers.

@compute @workgroup_size(256)
fn flock(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.count) { return; }

  let p = sortedPos[i];
  let v = sortedVel[i];
  let ci = cellOf(p);

  var sepF = vec2f(0.0);
  var aliF = vec2f(0.0);
  var cohF = vec2f(0.0);
  var n    = 0.0;

  let pr2 = P.percepRadius * P.percepRadius;
  let sr2 = P.sepRadius * P.sepRadius;

  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let h = hashCell(ci + vec2i(dx, dy));
      let s = cellStart[h];
      // Buckets are laid out in increasing hash order, so the next bucket's
      // start is this one's end. The last bucket ends at the boid count.
      var e = P.count;
      if (h + 1u < P.tableSize) { e = cellStart[h + 1u]; }
      if (e <= s) { continue; }

      // Gravity makes boids clump, and an unbounded inner loop over a dense
      // cell would stall the whole warp. Instead of truncating (which biases
      // toward whoever sorted first) we stride-sample and rescale, giving an
      // unbiased estimate of the true neighbour sum at a fixed cost.
      let cnt = e - s;
      var stride = 1u;
      if (cnt > P.maxPerCell) { stride = (cnt + P.maxPerCell - 1u) / P.maxPerCell; }
      let w = f32(stride);

      var j = s + (i % stride);
      loop {
        if (j >= e) { break; }
        if (j != i) {
          let q  = sortedPos[j];
          let d  = q - p;
          let d2 = dot(d, d);
          if (d2 < pr2 && d2 > 1e-8) {
            cohF += q * w;
            aliF += sortedVel[j] * w;
            n    += w;
            if (d2 < sr2) {
              // Linear falloff, bounded per neighbour. With 1/d^2 the single
              // nearest sample dominated, which made the push noisy when a
              // cell is stride-sampled.
              let dl = sqrt(d2);
              sepF -= d * (w * (1.0 - dl / P.sepRadius) / dl);
            }
          }
        }
        j = j + stride;
      }
    }
  }

  // Reynolds steering: desired velocity at full speed, minus current velocity,
  // clamped to a maximum steering force.
  var acc = vec2f(0.0);
  let ms  = P.maxSpeed;

  if (n > 0.0) {
    // Cohesion scales with how far the boid is from its neighbours' centre.
    // A full-strength pull, even when already centred, packed flocks into
    // tight balls.
    let des = (cohF / n) - p;
    acc += limit(des * (2.0 * P.maxForce / P.percepRadius), P.maxForce) * P.cohWeight;

    let av = aliF / n;
    let l  = length(av);
    if (l > 1e-6) { acc += limit(av * (ms / l) - v, P.maxForce) * P.aliWeight; }
  }

  // Separation works like pressure. The push grows with crowding, up to a
  // cap. In an even crowd the pushes cancel; at a packed edge they add up and
  // the flock spreads back out.
  acc += limit(sepF * P.maxForce, P.maxForce * 4.0) * P.sepWeight;

  // Central gravity. The exponent is the interesting knob:
  //   +1  spring-like: pull grows with distance, nothing escapes
  //    0  constant pull regardless of distance
  //   -2  Newtonian: weak far away, singular up close
  let rel = P.center - p;
  let r   = max(length(rel), 1e-3);
  let dir = rel / r;
  let mag = P.gStrength * pow(r / P.gRefScale, P.gExponent);
  acc += dir * mag;
  // Tangential component; shares the radial falloff so orbits stay coherent.
  acc += vec2f(-dir.y, dir.x) * P.swirl * pow(r / P.gRefScale, P.gExponent);

  // Lures: each boid steers toward its nearest lure. As the lures move, the
  // borders between their territories cross the swarm and split it into
  // flocks. Distance is divided by weight, so a fading lure's territory
  // shrinks gradually. The pull is a capped steering force and is off inside
  // the comfort radius, so it can't overpower the flocking rules.
  if (P.lureCount > 0u) {
    var best = 1e30;
    var tgt  = p;
    var wgt  = 0.0;
    for (var k = 0u; k < P.lureCount; k = k + 1u) {
      let L = P.lures[k];
      if (L.z <= 0.001) { continue; }
      let d = distance(L.xy, p) / L.z;
      if (d < best) { best = d; tgt = L.xy; wgt = L.z; }
    }
    let rel = tgt - p;
    let r   = length(rel);
    let pull = smoothstep(P.lureInner, P.lureOuter, r) * wgt;
    if (pull > 0.0 && r > 1e-3) {
      acc += limit(rel * (ms / r) - v, P.maxForce) * P.lurePull * pull;
    }
  }

  // Hawks: flee at full speed, hardest up close. Only nearby boids react, and
  // alignment passes the turn on to their neighbors.
  for (var k = 0u; k < P.hawkCount; k = k + 1u) {
    let rel = p - P.hawks[k].xy;
    let d   = length(rel);
    if (d < P.hawkRadius && d > 1e-3) {
      let f = 1.0 - d / P.hawkRadius;
      acc += limit(rel * (ms / d) - v, P.maxForce) * P.hawkFear * f * f;
    }
  }

  if (P.mouseStrength != 0.0) {
    let m  = P.mousePos - p;
    let md = max(length(m), 1.0);
    if (md < P.mouseRadius) {
      acc += (m / md) * P.mouseStrength * (1.0 - md / P.mouseRadius);
    }
  }

  // Semi-implicit Euler.
  var nv = v + acc * P.dt;
  nv *= max(0.0, 1.0 - P.drag * P.dt);
  let spd = length(nv);
  let lo  = ms * clamp(P.minSpeed, 0.0, 1.0);
  if (spd > ms)   { nv *= ms / spd; }
  else if (spd < 1e-6) { nv = vec2f(max(lo, ms * 0.01), 0.0); }
  else if (spd < lo)   { nv *= lo / spd; }

  var np = p + nv * P.dt;

  // Safety net: a negative gravity exponent lets boids escape, and f32 loses
  // meaningful precision past ~1e6. Fold escapees back in rather than letting
  // them become NaN and poison the hash.
  let rl = length(np);
  if (!(rl < 1.0e6)) {                     // also catches NaN
    np = P.center + vec2f(1.0, 0.0) * P.spawnRadius;
    nv = vec2f(0.0, 0.0);
  }

  pos[i] = np;
  vel[i] = nv;
}
`;

// ---------------------------------------------------------------------------
// Rendering: instanced triangles, additively blended into an HDR target, then
// tonemapped. Additive blend is what makes density read as brightness.
// ---------------------------------------------------------------------------

// Shared uniform layout for both render modules (64 bytes).
const VIEW_STRUCT = /* wgsl */ `
struct View {
  camCenter     : vec2f,
  worldPerPixel : f32,
  boidPx        : f32,
  viewport      : vec2f,
  intensity     : f32,
  maxSpeed      : f32,
  colorMode     : u32,
  stretch       : f32,
  exposure      : f32,
  fade          : f32,
  minSpeed      : f32,   // fraction of maxSpeed; the speed ramp starts here
  _pad0         : f32,
  _pad1         : f32,
  _pad2         : f32,
};
`;

// --- boid pass -------------------------------------------------------------

SHADERS.boid = VIEW_STRUCT + /* wgsl */ `

@group(0) @binding(0) var<uniform>            V   : View;
@group(0) @binding(1) var<storage, read>      pos : array<vec2f>;
@group(0) @binding(2) var<storage, read>      vel : array<vec2f>;

struct VSOut {
  @builtin(position) clip  : vec4f,
  @location(0)       color : vec3f,
};

fn ramp(t: f32) -> vec3f {
  let x = clamp(t, 0.0, 1.0);
  let c0 = vec3f(0.03, 0.05, 0.22);
  let c1 = vec3f(0.10, 0.32, 0.78);
  let c2 = vec3f(0.20, 0.78, 0.86);
  let c3 = vec3f(0.98, 0.72, 0.32);
  let c4 = vec3f(1.00, 0.97, 0.92);
  if (x < 0.25) { return mix(c0, c1,  x          / 0.25); }
  if (x < 0.50) { return mix(c1, c2, (x - 0.25)  / 0.25); }
  if (x < 0.75) { return mix(c2, c3, (x - 0.50)  / 0.25); }
  return              mix(c3, c4, (x - 0.75)  / 0.25);
}

fn hue(h: f32) -> vec3f {
  let k = fract(vec3f(h) + vec3f(0.0, 0.66666, 0.33333)) * 6.0;
  return clamp(abs(k - 3.0) - 1.0, vec3f(0.0), vec3f(1.0));
}

@vertex
fn vsBoid(@builtin(vertex_index) vi: u32,
          @builtin(instance_index) ii: u32) -> VSOut {
  let p  = pos[ii];
  let v  = vel[ii];
  let sp = length(v);

  var dir = vec2f(1.0, 0.0);
  if (sp > 1e-6) { dir = v / sp; }
  let perp = vec2f(-dir.y, dir.x);

  // The dart is built in pixel space, not world space, so boids stay visible
  // at any zoom level.
  let L = V.boidPx * (1.0 + V.stretch);
  let W = V.boidPx * 0.55;
  var off = dir * L;
  if      (vi == 1u) { off = -dir * L * 0.6 + perp * W; }
  else if (vi == 2u) { off = -dir * L * 0.6 - perp * W; }

  let screen = (p - V.camCenter) / V.worldPerPixel + off;

  var out : VSOut;
  out.clip = vec4f(screen.x / (V.viewport.x * 0.5),
                   screen.y / (V.viewport.y * 0.5), 0.0, 1.0);

  var c = vec3f(0.55, 0.80, 1.0);
  if (V.colorMode == 0u) {
    // Spread the ramp over the speeds birds actually fly at (min to max).
    let lo = clamp(V.minSpeed, 0.0, 0.95);
    c = ramp((sp / max(V.maxSpeed, 1e-4) - lo) / (1.0 - lo));
  } else if (V.colorMode == 1u) {
    c = hue(atan2(dir.y, dir.x) * 0.15915494 + 0.5);
  }
  out.color = c * V.intensity;
  return out;
}

@fragment
fn fsBoid(in: VSOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}

`;

// --- fullscreen post passes ------------------------------------------------

SHADERS.post = VIEW_STRUCT + /* wgsl */ `

@group(0) @binding(0) var<uniform>  Vp  : View;
@group(0) @binding(1) var           src : texture_2d<f32>;

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[vi], 0.0, 1.0);
}

// Motion trails: instead of clearing the HDR target we re-draw the previous
// frame scaled down, then blend this frame's boids on top.
@fragment
fn fsFade(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let c = textureLoad(src, vec2i(fc.xy), 0);
  return vec4f(c.rgb * Vp.fade, 1.0);
}

// Log tonemap. With additive blending, brightness counts boids per pixel,
// from 1 at a flock's edge to thousands in its core. A log curve keeps both
// readable; a filmic curve turned anything past a few boids white. The
// brightest channel is mapped and the others scaled with it to keep the hue.
@fragment
fn fsTone(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let x = textureLoad(src, vec2i(fc.xy), 0).rgb * Vp.exposure;
  let m = max(max(x.r, x.g), x.b);
  if (m < 1e-5) { return vec4f(0.0, 0.0, 0.0, 1.0); }
  let K = 8.0;      // knee: how quickly a lone boid becomes visible
  let R = 150.0;    // density that maps to full white
  let y = clamp(log(1.0 + m * K) / log(1.0 + R * K), 0.0, 1.0);
  let hue = pow(x / m, vec3f(1.0 / 2.2));
  let c = mix(hue * y, vec3f(y), smoothstep(0.75, 1.0, y) * 0.6);
  return vec4f(c, 1.0);
}
`;
