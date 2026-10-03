// ---------------------------------------------------------------------------
// SwarmSim — camera, input, main loop
// ---------------------------------------------------------------------------

(() => {

  const params = { ...DEFAULTS };

  // The world has no bounds. The camera is just an offset plus a scale, and
  // boids are drawn at a pixel size independent of zoom, so you can fly from a
  // single boid out to the whole swarm without anything degenerating.
  const cam = { x: 0, y: 0, worldPerPixel: 1 };
  const ZOOM_MIN = 1e-4, ZOOM_MAX = 1e4;

  const state = {
    paused: false,
    capacity: 2097152,
    followCursor: false,
    dragging: false,
    lastX: 0, lastY: 0,
    dpr: 1,
    showField: false,
  };

  const canvas = document.getElementById('view');
  const hud    = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const og      = overlay.getContext('2d');

  // --- coordinate helpers --------------------------------------------------
  // Device pixels, origin at canvas centre, y pointing up — matching the
  // convention the vertex shader uses.

  function eventToDevice(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * state.dpr - canvas.width  / 2,
      y: canvas.height / 2 - (e.clientY - r.top) * state.dpr,
    };
  }

  function deviceToWorld(d) {
    return { x: cam.x + d.x * cam.worldPerPixel, y: cam.y + d.y * cam.worldPerPixel };
  }

  // --- input ---------------------------------------------------------------

  function bindInput() {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 0) {
        state.dragging = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
      } else if (e.button === 2) {
        // Right-drag reaches into the swarm: attract, or repel with Shift.
        params.mouseStrength = e.shiftKey ? -Math.abs(params.maxForce) * 2
                                          :  Math.abs(params.maxForce) * 2;
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const w = deviceToWorld(eventToDevice(e));
      params.mouseX = w.x;
      params.mouseY = w.y;
      if (state.followCursor) { params.centerX = w.x; params.centerY = w.y; }

      if (state.dragging) {
        cam.x -= (e.clientX - state.lastX) * state.dpr * cam.worldPerPixel;
        cam.y += (e.clientY - state.lastY) * state.dpr * cam.worldPerPixel;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
      }
    });

    const release = (e) => {
      if (e.button === 0) state.dragging = false;
      if (e.button === 2) params.mouseStrength = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', () => {
      state.dragging = false;
      params.mouseStrength = 0;
    });

    // Zoom about the cursor: the world point under the pointer stays put.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = eventToDevice(e);
      const before = deviceToWorld(d);

      const factor = Math.exp(e.deltaY * 0.0012);
      cam.worldPerPixel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.worldPerPixel * factor));

      const after = deviceToWorld(d);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); togglePause(); break;
        case 'r': resetSim(); break;
        case 'h': document.body.classList.toggle('hide-ui'); break;
        case 'c': recenter(); break;
        case 'l':
          state.showField = !state.showField;
          document.getElementById('showField').checked = state.showField;
          break;
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
      }
    });
  }

  function togglePause() {
    state.paused = !state.paused;
    document.getElementById('pause').textContent = state.paused ? 'Resume' : 'Pause';
  }

  function recenter() {
    cam.x = params.centerX;
    cam.y = params.centerY;
    const r = params.lureCount > 0 ? params.roamRadius + params.lureInner
                                   : params.spawnRadius;
    cam.worldPerPixel = (r * 2.6) / Math.max(Math.min(canvas.width, canvas.height * 1.6), 1);
  }

  function resetSim() {
    Engine.reset(params);
    Field.reset(params);
  }

  // --- sizing --------------------------------------------------------------

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth  * state.dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * state.dpr));
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w;
    canvas.height = h;
    overlay.width = w;
    overlay.height = h;
    Engine.resize(w, h);
  }

  // --- HUD -----------------------------------------------------------------

  const frameTimes = [];
  let lastT = performance.now();

  function updateHud() {
    const now = performance.now();
    const dtMs = now - lastT;
    lastT = now;
    frameTimes.push(dtMs);
    if (frameTimes.length > 45) frameTimes.shift();

    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1000 / avg;
    const ups = state.paused ? 0 : params.count * fps * params.substeps;

    const zoom = 1 / cam.worldPerPixel;
    hud.innerHTML =
      `<b>${fps.toFixed(0)}</b> fps` +
      `<span>${avg.toFixed(1)} ms</span>` +
      `<b>${(params.count / 1e3).toFixed(0)}k</b> boids` +
      `<span>${(ups / 1e6).toFixed(0)}M updates/s</span>` +
      `<span>zoom ${zoom < 1 ? zoom.toFixed(3) : zoom.toFixed(2)}&times;</span>`;
  }

  function drawOverlay() {
    og.clearRect(0, 0, overlay.width, overlay.height);
    if (!state.showField) return;
    const toScreen = (x, y) => ({
      x: overlay.width  / 2 + (x - cam.x) / cam.worldPerPixel,
      y: overlay.height / 2 - (y - cam.y) / cam.worldPerPixel,
    });
    Field.draw(og, params, toScreen, cam.worldPerPixel);
  }

  // --- loop ----------------------------------------------------------------

  function loop() {
    resize();

    const substeps = Math.max(1, params.substeps | 0);
    // Fixed timestep, not wall-clock: a hitch should slow the sim down rather
    // than blow it up. The clamp keeps integration stable at high time scales.
    const dt = Math.min(1 / 30, params.timeScale / 60) / substeps;

    const field = Field.step(params, state.paused ? 0 : dt * substeps);
    Engine.frame(params, cam, { paused: state.paused, dt, substeps, field });
    drawOverlay();
    updateHud();
    requestAnimationFrame(loop);
  }

  // --- boot ----------------------------------------------------------------

  function fail(msg) {
    document.getElementById('boot').innerHTML =
      `<div class="err"><h1>Can't start</h1><p>${msg}</p></div>`;
    document.getElementById('boot').classList.remove('gone');
  }

  async function main() {
    let info;
    try {
      info = await Engine.init(canvas);
    } catch (err) {
      console.error(err);
      fail(String(err.message || err));
      return;
    }
    Engine.onError = fail;

    Engine.allocate(state.capacity);
    Field.reset(params);
    resize();
    recenter();

    UI.build(document.getElementById('controls'), params, (key) => {
      if (key === 'spawnRadius' || key === '*') { /* affects next spawn only */ }
    });
    UI.setMax('count', state.capacity);

    // Colour mode is a select rather than a slider, so it needs syncing by hand
    // whenever something bulk-assigns params.
    const colorSel = document.getElementById('colorMode');
    colorSel.addEventListener('change', () => {
      params.colorMode = parseInt(colorSel.value, 10);
    });
    const syncColor = () => { colorSel.value = String(params.colorMode); };

    // Presets
    const sel = document.getElementById('preset');
    for (const name of Object.keys(UI.PRESETS)) {
      sel.insertAdjacentHTML('beforeend', `<option>${name}</option>`);
    }
    sel.addEventListener('change', () => {
      if (sel.value) { UI.applyPreset(sel.value); syncColor(); resetSim(); recenter(); }
    });

    // Capacity — reallocating the buffers is the only destructive control.
    const cap = document.getElementById('capacity');
    cap.value = String(state.capacity);
    cap.addEventListener('change', () => {
      state.capacity = parseInt(cap.value, 10);
      Engine.allocate(state.capacity);
      UI.setMax('count', state.capacity);
      Engine.reset(params);
    });

    document.getElementById('pause').addEventListener('click', togglePause);
    document.getElementById('reset').addEventListener('click', resetSim);
    document.getElementById('recenter').addEventListener('click', recenter);
    document.getElementById('defaults').addEventListener('click', () => {
      Object.assign(params, DEFAULTS);
      UI.sync();
      syncColor();
      resetSim();
      recenter();
    });

    const follow = document.getElementById('follow');
    follow.addEventListener('change', () => {
      state.followCursor = follow.checked;
      if (!follow.checked) { params.centerX = 0; params.centerY = 0; }
    });

    const showField = document.getElementById('showField');
    showField.addEventListener('change', () => { state.showField = showField.checked; });

    document.getElementById('gpu').textContent = info.adapter;
    document.getElementById('boot').classList.add('gone');

    bindInput();
    requestAnimationFrame(loop);
  }

  main();
})();
