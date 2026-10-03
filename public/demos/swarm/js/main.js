// ---------------------------------------------------------------------------
// SwarmSim: camera, input, main loop
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
    autoCam: true,
    showField: false,
    dpr: 1,
    pointers: new Map(),   // active pointers, for pan and pinch
    pinch: null,
  };

  const canvas  = document.getElementById('view');
  const hud     = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const og      = overlay.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const touchFirst = matchMedia('(pointer: coarse)').matches;

  // --- coordinate helpers --------------------------------------------------
  // Device pixels, origin at canvas centre, y pointing up, matching the
  // convention the vertex shader uses.

  function clientToDevice(cx, cy) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (cx - r.left) * state.dpr - canvas.width  / 2,
      y: canvas.height / 2 - (cy - r.top) * state.dpr,
    };
  }

  function deviceToWorld(d) {
    return { x: cam.x + d.x * cam.worldPerPixel, y: cam.y + d.y * cam.worldPerPixel };
  }

  // Zoom by `factor` keeping the world point under device point `d` fixed.
  function zoomAt(d, factor) {
    const before = deviceToWorld(d);
    cam.worldPerPixel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.worldPerPixel * factor));
    const after = deviceToWorld(d);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  }

  // --- camera --------------------------------------------------------------

  // The framing a preset wants: the lures' roaming area when they're on,
  // otherwise the spawn disc around the centre of gravity.
  function homeView() {
    const r = params.lureCount > 0 ? params.roamRadius * 0.75 + params.lureInner
                                   : params.spawnRadius * 1.45;
    const fit = Math.max(Math.min(canvas.width, canvas.height * 1.6), 1);
    return { x: params.centerX, y: params.centerY, worldPerPixel: (r * 2.4) / fit };
  }

  function recenter() {
    Object.assign(cam, homeView());
    setAutoCam(true);
  }

  function setAutoCam(on) {
    state.autoCam = on;
    $('autoCam').checked = on;
  }

  // Auto camera: ease toward the lures so the flocks stay in frame. The
  // easing takes a couple of seconds, so it follows without jerking.
  function updateAutoCam(dt) {
    if (!state.autoCam) return;
    let target = homeView();
    const b = Field.bounds();
    if (b && params.lureCount > 0) {
      // Flocks trail their lure by up to about the leash length, so frame the
      // lures plus a generous margin. Tuned headlessly: this keeps 96 to 100%
      // of the swarm in view on the lure presets.
      const r = b.radius + params.lureOuter * 1.6;
      const fit = Math.max(Math.min(canvas.width, canvas.height * 1.6), 1);
      target = { x: b.x, y: b.y, worldPerPixel: Math.max((r * 2.2) / fit, target.worldPerPixel * 0.7) };
    }
    const k = 1 - Math.exp(-dt / 1.8);
    cam.x += (target.x - cam.x) * k;
    cam.y += (target.y - cam.y) * k;
    cam.worldPerPixel *= Math.pow(target.worldPerPixel / cam.worldPerPixel, k);
  }

  // --- input ---------------------------------------------------------------

  function bindInput() {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 2) {
        // Right-drag reaches into the swarm: attract, or repel with Shift.
        params.mouseStrength = (e.shiftKey ? -1 : 1) * Math.abs(params.maxForce) * 2;
        return;
      }
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (state.pointers.size === 2) state.pinch = pinchState();
    });

    canvas.addEventListener('pointermove', (e) => {
      const w = deviceToWorld(clientToDevice(e.clientX, e.clientY));
      params.mouseX = w.x;
      params.mouseY = w.y;
      if (state.followCursor) { params.centerX = w.x; params.centerY = w.y; }

      const p = state.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;

      if (state.pointers.size === 1) {
        cam.x -= dx * state.dpr * cam.worldPerPixel;
        cam.y += dy * state.dpr * cam.worldPerPixel;
        if (dx || dy) setAutoCam(false);
      } else if (state.pointers.size === 2 && state.pinch) {
        const now = pinchState();
        const m = clientToDevice(now.mx, now.my);
        zoomAt(m, state.pinch.dist / Math.max(now.dist, 1));
        cam.x -= (now.mx - state.pinch.mx) * state.dpr * cam.worldPerPixel;
        cam.y += (now.my - state.pinch.my) * state.dpr * cam.worldPerPixel;
        state.pinch = now;
        setAutoCam(false);
      }
    });

    const release = (e) => {
      state.pointers.delete(e.pointerId);
      if (state.pointers.size < 2) state.pinch = null;
      if (e.button === 2 || e.type === 'pointercancel') params.mouseStrength = 0;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    // Zoom about the cursor: the world point under the pointer stays put.
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomAt(clientToDevice(e.clientX, e.clientY), Math.exp(e.deltaY * 0.0012));
      setAutoCam(false);
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      // Space on a focused button should press that button, not pause.
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); togglePause(); break;
        case 'r': resetSim(); break;
        case 'h': togglePanel(); break;
        case 'c': recenter(); break;
        case 'l': setShowField(!state.showField); break;
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen?.();
          break;
      }
    });
  }

  function pinchState() {
    const [a, b] = [...state.pointers.values()];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  }

  // --- actions -------------------------------------------------------------

  function togglePause() {
    state.paused = !state.paused;
    $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  }

  function togglePanel(force) {
    const hidden = force ?? !document.body.classList.contains('hide-ui');
    document.body.classList.toggle('hide-ui', hidden);
    $('panelToggle').setAttribute('aria-expanded', String(!hidden));
  }

  function setShowField(on) {
    state.showField = on;
    $('showField').checked = on;
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
  let hudAt = 0;

  function tick() {
    const now = performance.now();
    const dtMs = now - lastT;
    lastT = now;
    frameTimes.push(dtMs);
    if (frameTimes.length > 45) frameTimes.shift();
    return Math.min(dtMs / 1000, 0.1);
  }

  function updateHud() {
    const now = performance.now();
    if (now - hudAt < 250) return;   // a readable rate, and less layout work
    hudAt = now;
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const fps = 1000 / avg;
    const ups = state.paused ? 0 : params.count * fps * params.substeps;
    const n = params.count;
    const count = n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e3).toFixed(0) + 'k';
    hud.innerHTML =
      `<span><b>${fps.toFixed(0)}</b> fps</span>` +
      `<span><b>${count}</b> boids</span>` +
      `<span class="wide">${(ups / 1e6).toFixed(0)}M updates/s</span>` +
      (state.paused ? `<span class="paused">Paused</span>` : '');
  }

  function drawOverlay() {
    og.clearRect(0, 0, overlay.width, overlay.height);
    if (!state.showField) return;
    const toScreen = (x, y) => ({
      x: overlay.width  / 2 + (x - cam.x) / cam.worldPerPixel,
      y: overlay.height / 2 - (y - cam.y) / cam.worldPerPixel,
    });
    Field.draw(og, params, toScreen, cam.worldPerPixel, state.dpr);
  }

  // --- loop ----------------------------------------------------------------

  function loop() {
    resize();
    const wall = tick();

    const substeps = Math.max(1, params.substeps | 0);
    // Fixed timestep, not wall-clock: a hitch should slow the sim down rather
    // than blow it up. The clamp keeps integration stable at high time scales.
    const dt = Math.min(1 / 30, params.timeScale / 60) / substeps;

    const field = Field.step(params, state.paused ? 0 : dt * substeps);
    updateAutoCam(wall);
    Engine.frame(params, cam, { paused: state.paused, dt, substeps, field });
    drawOverlay();
    updateHud();
    requestAnimationFrame(loop);
  }

  // --- boot ----------------------------------------------------------------

  function fail(msg) {
    const boot = $('boot');
    boot.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'err';
    box.innerHTML = '<h1>SwarmSim can\'t start here</h1><p></p>';
    box.querySelector('p').textContent = msg;
    boot.appendChild(box);
    boot.classList.remove('gone');
  }

  // Some GPU drivers never answer the device request. Give up after a while
  // and say so, instead of spinning forever.
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(
        "The GPU didn't respond. Reload the page, close other heavy tabs, " +
        'or try another browser.')), ms)),
    ]);
  }

  function setHelp() {
    $('help').innerHTML = touchFirst
      ? '<b>drag</b> pan · <b>pinch</b> zoom'
      : '<b>drag</b> pan · <b>wheel</b> zoom · <b>right-drag</b> attract (<b>+shift</b> repel)<br>' +
        '<b>space</b> pause · <b>r</b> respawn · <b>c</b> recenter · <b>l</b> lures · ' +
        '<b>f</b> fullscreen · <b>h</b> hide panel';
  }

  async function main() {
    let info;
    try {
      info = await withTimeout(Engine.init(canvas), 12000);
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

    const preset = $('preset');
    const colorSel = $('colorMode');
    const syncColor = () => { colorSel.value = String(params.colorMode); };

    // The preset menu shows which preset is loaded until a slider moves, then
    // reads "Custom".
    preset.innerHTML = '<option value="" hidden>Custom</option>' +
      Object.keys(UI.PRESETS).map((n) => `<option>${n}</option>`).join('');
    preset.value = 'Murmuration';
    const markCustom = () => { preset.value = ''; };

    const RESPAWN_KEYS = new Set(['spawnRadius']);
    UI.build($('controls'), params, (key) => {
      if (key === '*') return;
      markCustom();
      if (RESPAWN_KEYS.has(key)) resetSim();
    });
    UI.setMax('count', state.capacity);

    preset.addEventListener('change', () => {
      if (!preset.value) return;
      UI.applyPreset(preset.value);
      syncColor();
      resetSim();
      recenter();
    });

    colorSel.addEventListener('change', () => {
      params.colorMode = parseInt(colorSel.value, 10);
      markCustom();
    });

    // Capacity: reallocating the buffers is the only destructive control.
    const cap = $('capacity');
    cap.value = String(state.capacity);
    cap.addEventListener('change', () => {
      state.capacity = parseInt(cap.value, 10);
      Engine.allocate(state.capacity);
      UI.setMax('count', state.capacity);
      resetSim();
    });

    $('pause').addEventListener('click', togglePause);
    $('reset').addEventListener('click', resetSim);
    $('recenter').addEventListener('click', recenter);
    $('panelToggle').addEventListener('click', () => togglePanel());

    $('autoCam').addEventListener('change', (e) => {
      state.autoCam = e.target.checked;
    });
    $('showField').addEventListener('change', (e) => setShowField(e.target.checked));
    $('follow').addEventListener('change', (e) => {
      state.followCursor = e.target.checked;
      if (!state.followCursor) { params.centerX = 0; params.centerY = 0; }
    });

    setHelp();
    // On a phone the panel would cover the swarm, so it starts closed.
    if (matchMedia('(max-width: 640px)').matches) togglePanel(true);

    $('gpu').textContent = info.adapter;
    $('boot').classList.add('gone');

    bindInput();
    requestAnimationFrame(loop);
  }

  main();
})();
