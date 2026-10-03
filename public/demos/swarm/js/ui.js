// ---------------------------------------------------------------------------
// SwarmSim — control panel
//
// Every tunable lives in CONTROLS. Add an entry here and it shows up in the
// panel, participates in presets, and is live-bound to the simulation — there
// is no other wiring to touch.
// ---------------------------------------------------------------------------

const CONTROLS = [
  { group: 'Flocking', items: [
    { key: 'sepWeight',    label: 'Separation',       min: 0,    max: 5,    step: 0.01 },
    { key: 'aliWeight',    label: 'Alignment',        min: 0,    max: 5,    step: 0.01 },
    { key: 'cohWeight',    label: 'Cohesion',         min: 0,    max: 5,    step: 0.01 },
    { key: 'percepRadius', label: 'Vision radius',    min: 2,    max: 200,  step: 0.5 },
    { key: 'sepRadius',    label: 'Personal space',   min: 1,    max: 120,  step: 0.5 },
    { key: 'maxSpeed',     label: 'Max speed',        min: 5,    max: 600,  step: 1 },
    { key: 'minSpeed',     label: 'Min speed',        min: 0,    max: 1,    step: 0.01,
      hint: 'Fraction of max speed. Birds cannot hover, so they swing wide instead of piling up' },
    { key: 'maxForce',     label: 'Turn force',       min: 5,    max: 2000, step: 5 },
    { key: 'drag',         label: 'Drag',             min: 0,    max: 3,    step: 0.005 },
  ]},

  { group: 'Lures', items: [
    { key: 'lureCount',  label: 'Lures',          min: 0,   max: 6,    step: 1, int: true,
      hint: 'Unseen targets. Each boid chases the nearest one, so moving lures tear the swarm apart and stitch it back' },
    { key: 'lurePull',   label: 'Pull',           min: 0,   max: 4,    step: 0.01 },
    { key: 'lureInner',  label: 'Comfort radius', min: 0,   max: 1500, step: 10,
      hint: 'No pull inside this distance, so the flock moves freely near its lure' },
    { key: 'lureOuter',  label: 'Leash',          min: 50,  max: 3000, step: 10,
      hint: 'Distance at which the pull reaches full strength' },
    { key: 'lureSpeed',  label: 'Lure speed',     min: 0,   max: 600,  step: 1 },
    { key: 'lureTurn',   label: 'Lure turn rate', min: 0.1, max: 4,    step: 0.01 },
    { key: 'lureJink',   label: 'Jink rate',      min: 0,   max: 1,    step: 0.01,
      hint: 'Chance per second a lure suddenly heads somewhere new' },
    { key: 'roamRadius', label: 'Roam radius',    min: 200, max: 8000, step: 10 },
  ]},

  { group: 'Hawks', items: [
    { key: 'hawkCount',  label: 'Hawks',          min: 0,   max: 4,    step: 1, int: true },
    { key: 'hawkFear',   label: 'Fear',           min: 0,   max: 8,    step: 0.01 },
    { key: 'hawkRadius', label: 'Fear radius',    min: 20,  max: 800,  step: 1 },
    { key: 'hawkSpeed',  label: 'Hawk speed',     min: 0,   max: 1200, step: 1 },
  ]},

  { group: 'Gravity', items: [
    { key: 'gStrength', label: 'Pull strength',   min: -200, max: 400,  step: 1 },
    { key: 'gExponent', label: 'Distance falloff', min: -2,  max: 2,    step: 0.01,
      hint: '+1 = pull grows with distance (nothing escapes) · 0 = constant · −2 = Newtonian' },
    { key: 'gRefScale', label: 'Reference radius', min: 50,  max: 4000, step: 10 },
    { key: 'swirl',     label: 'Swirl',            min: -300, max: 300, step: 1,
      hint: 'Tangential force — turns collapse into orbit' },
  ]},

  { group: 'Swarm', items: [
    { key: 'count',       label: 'Boids',        min: 1024, max: 2097152, step: 1, log: true, int: true },
    { key: 'maxPerCell',  label: 'Neighbour cap', min: 4,   max: 128, step: 1, int: true,
      hint: 'Samples per cell. Lower = faster in dense clumps' },
    { key: 'timeScale',   label: 'Time scale',   min: 0,    max: 3,   step: 0.01 },
    { key: 'substeps',    label: 'Substeps',     min: 1,    max: 4,   step: 1, int: true },
    { key: 'spawnRadius', label: 'Spawn radius', min: 50,   max: 5000, step: 10 },
  ]},

  { group: 'Render', items: [
    { key: 'boidPx',    label: 'Boid size',  min: 0.4, max: 8,   step: 0.05 },
    { key: 'stretch',   label: 'Stretch',    min: 0,   max: 4,   step: 0.05 },
    { key: 'intensity', label: 'Brightness', min: 0.02, max: 3,  step: 0.01 },
    { key: 'exposure',  label: 'Exposure',   min: 0.05, max: 6,  step: 0.01 },
    { key: 'fade',      label: 'Trails',     min: 0,   max: 0.98, step: 0.005,
      hint: 'How much of the previous frame survives' },
  ]},
];

// Default is the murmuration: no central gravity at all. The swarm is held
// together only by lures wandering inside the roam radius.
const DEFAULTS = {
  count: 70000,
  sepWeight: 2.0, aliWeight: 2.4, cohWeight: 0.5,
  percepRadius: 40, sepRadius: 12,
  maxSpeed: 260, minSpeed: 0.55, maxForce: 560, drag: 0.03,
  lureCount: 3, lurePull: 0.7, lureInner: 400, lureOuter: 1400,
  lureSpeed: 210, lureTurn: 1.1, lureJink: 0.08, roamRadius: 2200,
  hawkCount: 1, hawkFear: 3.5, hawkRadius: 220, hawkSpeed: 420,
  gStrength: 0, gExponent: 1.0, gRefScale: 600, swirl: 0,
  maxPerCell: 24, timeScale: 1.0, substeps: 1, spawnRadius: 1600,
  boidPx: 1.5, stretch: 0.9, intensity: 0.08, exposure: 1.1, fade: 0.5,
  colorMode: 0,
  // Not slider-bound; driven by camera / input.
  centerX: 0, centerY: 0, mouseX: 0, mouseY: 0,
  mouseStrength: 0, mouseRadius: 400,
};

// Presets only carry simulation and look keys, never camera / input state.
const { centerX, centerY, mouseX, mouseY, mouseStrength, mouseRadius,
        ...DEFAULTS_SIM } = DEFAULTS;

const PRESETS = {
  'Murmuration': { ...DEFAULTS_SIM },
  'Starling storm': {
    ...DEFAULTS_SIM,
    count: 120000, lureCount: 5, lureSpeed: 260, lureJink: 0.2, lureInner: 250,
    hawkCount: 2, hawkFear: 4.5, maxSpeed: 300, roamRadius: 2600,
  },
  'Drift': {
    ...DEFAULTS_SIM,
    count: 80000, lureCount: 2, lureSpeed: 120, lureTurn: 0.6, lureJink: 0.03,
    lureInner: 500, lureOuter: 1600, hawkCount: 0, maxSpeed: 170, aliWeight: 2.0,
    fade: 0.8, intensity: 0.06,
  },
  'Galaxy': {
    lureCount: 0, hawkCount: 0, minSpeed: 0, count: 400000, spawnRadius: 900,
    sepWeight: 0.25, aliWeight: 0.5, cohWeight: 0.35, percepRadius: 34, sepRadius: 9,
    maxSpeed: 190, maxForce: 150, drag: 0.02,
    gStrength: 55, gExponent: 1, gRefScale: 900, swirl: 46,
    fade: 0.88, boidPx: 1.1, stretch: 1.6, intensity: 0.42, exposure: 1.5, colorMode: 0,
  },
  'Vortex': {
    lureCount: 0, hawkCount: 0, minSpeed: 0, count: 400000, spawnRadius: 900,
    sepWeight: 2.4, aliWeight: 1.8, cohWeight: 0.5, percepRadius: 30, sepRadius: 16,
    maxSpeed: 260, maxForce: 700, drag: 0.22,
    gStrength: 70, gExponent: 0.6, swirl: 130,
    fade: 0.8, boidPx: 1.2, stretch: 2.2, intensity: 0.55, exposure: 1.2, colorMode: 1,
  },
  'Nebula': {
    lureCount: 0, hawkCount: 0, minSpeed: 0, count: 400000, spawnRadius: 900,
    sepWeight: 0.6, aliWeight: 0.35, cohWeight: 1.5, percepRadius: 70, sepRadius: 24,
    maxSpeed: 60, maxForce: 90, drag: 0.5,
    gStrength: 8, gExponent: 1.2, gRefScale: 1200, swirl: 12,
    fade: 0.92, boidPx: 2.4, stretch: 0.2, intensity: 0.28, exposure: 1.8, colorMode: 0,
  },
  'Lattice': {
    lureCount: 0, hawkCount: 0, minSpeed: 0, count: 400000, spawnRadius: 900,
    sepWeight: 4.2, aliWeight: 0.5, cohWeight: 0.6, percepRadius: 22, sepRadius: 19,
    maxSpeed: 45, maxForce: 900, drag: 1.4,
    gStrength: 26, gExponent: 1, swirl: 0,
    fade: 0.0, boidPx: 1.8, stretch: 0.0, intensity: 0.75, exposure: 1.0, colorMode: 2,
  },
  'Shoal': {
    lureCount: 0, hawkCount: 0, minSpeed: 0, count: 400000, spawnRadius: 900,
    sepWeight: 2.0, aliWeight: 2.6, cohWeight: 1.1, percepRadius: 44, sepRadius: 13,
    maxSpeed: 150, maxForce: 260, drag: 0.05,
    gStrength: 6, gExponent: 1.4, gRefScale: 1400, swirl: -18,
    fade: 0.7, boidPx: 1.3, stretch: 1.1, intensity: 0.6, exposure: 1.3, colorMode: 1,
  },
};

const UI = (() => {
  const rows = new Map();
  let params = null, onChange = null;

  // Sliders are linear in position; log-scaled keys map through exp/log so the
  // low end of the boid count stays as controllable as the high end.
  const toSlider   = (c, v) => c.log ? Math.log(v) : v;
  const fromSlider = (c, v) => c.log ? Math.exp(v) : v;

  function fmt(c, v) {
    if (c.key === 'count') {
      return v >= 1e6 ? (v / 1e6).toFixed(2) + 'M'
           : v >= 1e3 ? (v / 1e3).toFixed(0) + 'k' : String(v);
    }
    if (c.int) return String(Math.round(v));
    return Math.abs(v) >= 100 ? v.toFixed(0)
         : Math.abs(v) >= 10  ? v.toFixed(1) : v.toFixed(2);
  }

  function build(root, p, changeCb) {
    params = p;
    onChange = changeCb;

    for (const section of CONTROLS) {
      const sec = document.createElement('section');
      sec.className = 'group';
      sec.innerHTML = `<h2>${section.group}</h2>`;

      for (const c of section.items) {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `
          <label title="${c.hint || ''}">
            <span>${c.label}${c.hint ? '<i class="q">?</i>' : ''}</span>
            <output></output>
          </label>
          <input type="range">`;

        const input  = row.querySelector('input');
        const output = row.querySelector('output');

        input.min   = toSlider(c, c.min);
        input.max   = toSlider(c, c.max);
        input.step  = c.log ? (toSlider(c, c.max) - toSlider(c, c.min)) / 1000 : c.step;
        input.value = toSlider(c, params[c.key]);
        output.textContent = fmt(c, params[c.key]);

        input.addEventListener('input', () => {
          let v = fromSlider(c, parseFloat(input.value));
          if (c.int) v = Math.round(v);
          else v = Math.round(v / c.step) * c.step;
          v = Math.min(c.max, Math.max(c.min, v));
          params[c.key] = v;
          output.textContent = fmt(c, v);
          onChange?.(c.key, v);
        });

        rows.set(c.key, { c, input, output });
        sec.appendChild(row);
      }
      root.appendChild(sec);
    }
  }

  // Push current params back into the widgets (after a preset or reset).
  function sync() {
    for (const [key, { c, input, output }] of rows) {
      input.value = toSlider(c, params[key]);
      output.textContent = fmt(c, params[key]);
    }
  }

  // Used when the allocated capacity changes — the boid slider can never ask
  // for more boids than there is buffer space for.
  function setMax(key, max) {
    const row = rows.get(key);
    if (!row) return;
    row.c.max = max;
    row.input.max = toSlider(row.c, max);
    if (params[key] > max) {
      params[key] = max;
      onChange?.(key, max);
    }
    row.input.value = toSlider(row.c, params[key]);
    row.output.textContent = fmt(row.c, params[key]);
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    Object.assign(params, p);
    sync();
    onChange?.('*', null);
  }

  return { build, sync, setMax, applyPreset, PRESETS };
})();
