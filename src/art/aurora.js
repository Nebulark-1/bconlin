import { valueNoise, smoothstep } from "./noise.js";

/**
 * Live aurora borealis on canvas.
 *
 * Each curtain is a wandering foot line with thousands of thin vertical rays
 * standing on it. Everything is driven by smooth 1-D value noise rather than
 * sines, so rays are irregular and the curtain folds instead of oscillating.
 * Where the curtain folds (steep foot slope) it brightens, like real aurora
 * seen edge-on. Rays share one gradient - a soft glowing lower hem, bright
 * green body, fading through violet to nothing - stretched per ray with
 * setTransform. Drawn into a low-res buffer, then composited with a light
 * blur so individual rays melt into a sheet.
 */
export function createAurora(canvas) {
  const ctx = canvas.getContext("2d");
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  const DOWNSCALE = 3;

  // debug: draw the machinery (foot lines + sampled rays) instead of the glow
  const state = { running: false, intensity: 1, horizon: 0, debug: false, rays: 0 };
  let w = 0;
  let h = 0;
  let raf = 0;
  let gradients = [];

  const { fbm } = valueNoise();
  const smooth = smoothstep;

  // y: foot height as a fraction of the sky (0 = top, 1 = horizon)
  const curtains = [
    { y: 0.5, amp: 0.2, freq: 1.3, drift: 0.035, phase: 0, height: 0.55, alpha: 1, palette: 0 },
    { y: 0.33, amp: 0.16, freq: 1.8, drift: -0.025, phase: 9, height: 0.4, alpha: 0.6, palette: 1 },
    { y: 0.66, amp: 0.1, freq: 0.9, drift: 0.02, phase: 23, height: 0.3, alpha: 0.5, palette: 0 },
  ];

  function makeGradients() {
    const palettes = [
      [[0, "rgba(120,255,190,0)"], [0.045, "rgba(185,255,215,1)"], [0.12, "rgba(90,245,170,.7)"], [0.32, "rgba(55,210,150,.26)"], [0.62, "rgba(140,90,210,.1)"], [1, "rgba(190,70,170,0)"]],
      [[0, "rgba(110,240,200,0)"], [0.06, "rgba(150,250,215,.9)"], [0.22, "rgba(75,205,190,.3)"], [0.6, "rgba(170,90,220,.12)"], [1, "rgba(230,80,170,0)"]],
    ];
    gradients = palettes.map((list) => {
      const g = bctx.createLinearGradient(0, 0, 0, 1);
      list.forEach(([o, c]) => g.addColorStop(o, c));
      return g;
    });
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buf.width = Math.ceil(w / DOWNSCALE);
    buf.height = Math.ceil(h / DOWNSCALE);
    makeGradients();
  }

  function draw(t) {
    const bw = buf.width;
    const sky = (state.horizon || h * 0.5) / DOWNSCALE;
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bw, buf.height);
    bctx.globalCompositeOperation = "lighter";
    let rays = 0;
    const feet = [];
    const sampled = [];

    for (const c of curtains) {
      bctx.fillStyle = gradients[c.palette];
      let prev = null;
      const foot0 = [];
      feet.push(foot0);
      for (let x = 0; x < bw; x += 0.75) {
        const n = x / bw;
        const foot = sky * c.y + (fbm(n * c.freq * 3 + t * c.drift + c.phase) - 0.5) * 2 * c.amp * sky;
        const fold = prev === null ? 0 : Math.min(1, Math.abs(foot - prev) * 1.6);
        prev = foot;
        if (state.debug && x % 6 < 0.75) foot0.push([x, foot]);

        // curtain only exists in stretches; rays are irregular and drift slowly
        const env = smooth(0.3, 0.55, fbm(n * 2.2 + t * 0.012 + c.phase));
        if (env < 0.01) continue;
        const ray = fbm(n * 110 + t * 0.18 + c.phase * 3) ** 1.6;
        const alpha = c.alpha * env * (0.2 + 0.8 * ray) * (0.75 + 0.7 * fold) * state.intensity;
        if (alpha < 0.008) continue;

        const height = sky * c.height * (0.5 + 0.5 * fbm(n * 14 + t * 0.05 + c.phase));
        const hem = height * 0.06; // soft glow hanging just below the foot
        rays++;
        if (state.debug) {
          if (x % 9 < 0.75) sampled.push([x, foot, height, alpha]);
          continue;
        }
        bctx.globalAlpha = Math.min(1, alpha);
        bctx.setTransform(1, 0, 0, -(height + hem), x, foot + hem);
        bctx.fillRect(0, 0, 0.9, 1);
      }
    }

    state.rays = rays;
    ctx.clearRect(0, 0, w, h);
    if (state.debug) return drawDebug(feet, sampled);
    ctx.filter = "blur(2.5px)";
    ctx.drawImage(buf, 0, 0, w, h);
    ctx.filter = "none";
  }

  // Blueprint view: each curtain's foot line, a sample of its rays as
  // hairlines (opacity = computed alpha), and a caption.
  function drawDebug(feet, sampled) {
    const k = DOWNSCALE;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(108, 240, 194, 0.55)";
    ctx.beginPath();
    for (const [x, foot, height, alpha] of sampled) {
      ctx.globalAlpha = Math.min(1, 0.15 + alpha);
      ctx.moveTo(x * k, foot * k);
      ctx.lineTo(x * k, (foot - height) * k);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#6cf0c2";
    ctx.lineWidth = 1.5;
    for (const pts of feet) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
      ctx.stroke();
    }
    ctx.fillStyle = "#6cf0c2";
    ctx.font = "500 11px 'JetBrains Mono', monospace";
    ctx.fillText("aurora · <canvas> · 3 curtains, rays on fbm noise", w * 0.07, (state.horizon || h / 2) * 0.12 + 14);
  }

  function tick(ms) {
    raf = 0;
    if (!state.running) return;
    draw(ms / 1000);
    raf = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  state.still = () => draw(12); // one static frame, for reduced motion
  state.curtains = curtains; // read by the code inspector
  state.fbm = fbm;

  return new Proxy(state, {
    set(target, key, value) {
      target[key] = value;
      if (key === "running" && value && !raf) {
        if (!buf.width) resize();
        raf = requestAnimationFrame(tick);
      }
      return true;
    },
  });
}
