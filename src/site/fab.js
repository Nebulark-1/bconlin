import { nextChapter } from "../content.js";
import { toggleSound, onSound, isSoundPlaying, soundWanted, chime, PENTATONIC, LAYERS, getMix, setMix, resetMix, level, bend } from "./sound.js";
import { isOn, discover } from "./eggs.js";
import { installConsole } from "./console.js";

// Three circles that follow you round the site, bottom right:
//   - the big one is the site menu; hover (or tap) and the pages fan out
//   - "Behind the scenes" switches every page to its blueprint
//   - sound on or off
// Each page mounts it with mountFab() and hands the blueprint button to its
// own createBlueprint().

const ICONS = {
  home: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>',
  career: '<path d="M6 3c5 3-3 5 2 8s-4 4 0 6"/><circle cx="6" cy="3" r="1.6"/><circle cx="8" cy="11" r="1.6"/><circle cx="8" cy="17" r="1.6"/>',
  resume: '<path d="M5 2.5h7l3 3V17a.5.5 0 0 1-.5.5h-9.5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z M8 8h5 M8 11h5 M8 14h3"/>',
  pdf: '<path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 16h12"/>',
  about: '<circle cx="10" cy="7" r="3.2"/><path d="M4 17c.6-3.6 3-5.4 6-5.4s5.4 1.8 6 5.4"/>',
  projects: '<rect x="3" y="3" width="14" height="14" rx="1.5"/><rect x="5" y="7.5" width="7" height="7" rx="1"/><rect x="6" y="10" width="3" height="3"/>',
  email: '<rect x="3" y="5" width="14" height="10" rx="1.5"/><path d="m3.5 6 6.5 5 6.5-5"/>',
  code: '<path d="M7 6 3 10l4 4M13 6l4 4-4 4"/>',
  sound: '<path d="M3 8v4h3l4 3.5v-11L6 8z"/><path class="fab__waves" d="M13 7.5a3.5 3.5 0 0 1 0 5M15.2 5.3a6.6 6.6 0 0 1 0 9.4"/><path class="fab__mute" d="M13 8l4 4M17 8l-4 4"/>',
};
const svg = (name) => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICONS[name]}</svg>`;

/**
 * current:   "home" | "career" | "resume" | "projects" | "about" - marks this page in the menu
 * blueprint: whether this page has a behind-the-scenes view
 * Returns { blueprintButton } for the page's createBlueprint().
 */
export function mountFab({ current, blueprint = false }) {
  const links = [
    { id: "home", label: current === "home" ? "Back to the top" : "Home", href: current === "home" ? "#top" : "./", icon: "home" },
    { id: "career", label: "Career", href: "career.html", icon: "career" },
    { id: "resume", label: "Résumé", href: "resume.html", icon: "resume" },
    { id: "projects", label: "Projects", href: "projects.html", icon: "projects" },
    { id: "about", label: "About", href: "about.html", icon: "about" },
    { id: "pdf", label: "Download my résumé", href: "resume/Ben-Conlin-Resume.pdf", icon: "pdf", download: true },
    { id: "email", label: "Email me", href: `mailto:${nextChapter.email}`, icon: "email" },
  ];

  const root = document.createElement("div");
  root.className = "fab";
  root.innerHTML = `
    <ul class="fab__links" id="fab-links">
      ${links
        .map(
          (l, k) => `
        <li style="--k:${k};--n:${links.length}">
          <a href="${l.href}"${l.download ? " download" : ""}${l.id === current ? ' aria-current="page"' : ""} tabindex="-1">
            ${svg(l.icon)}<span class="fab__tip">${l.label}</span>
          </a>
        </li>`,
        )
        .join("")}
    </ul>
    <button type="button" class="fab__main" aria-expanded="false" aria-controls="fab-links" aria-label="Site menu">
      <span class="fab__ring" aria-hidden="true"></span>
      <span class="fab__mark">BC</span>
    </button>
    <button type="button" class="fab__btn fab__btn--bp" role="switch" aria-checked="false"${blueprint ? "" : ' aria-disabled="true"'}>
      ${svg("code")}<span class="fab__tip">${blueprint ? "Behind the scenes" : "Behind the scenes (coming soon here)"}</span>
    </button>
    <button type="button" class="fab__btn fab__btn--sound" data-sound-toggle aria-pressed="false">
      ${svg("sound")}<span class="fab__tip">Sound</span>
    </button>`;
  document.body.appendChild(root);
  installConsole();

  // ── The menu ──
  const main = root.querySelector(".fab__main");
  const anchors = [...root.querySelectorAll(".fab__links a")];
  let closeTimer = 0;
  const setOpen = (open) => {
    clearTimeout(closeTimer);
    if (open === (root.dataset.open === "true")) return;
    root.dataset.open = String(open);
    main.setAttribute("aria-expanded", String(open));
    anchors.forEach((a) => (a.tabIndex = open ? 0 : -1));
    // a little rising arpeggio as the circles fan out
    if (open) anchors.forEach((_, k) => setTimeout(() => chime(PENTATONIC[k + 1], 0.02, 0.4, 1.4), k * 45));
  };
  const linksBox = root.querySelector(".fab__links");
  for (const el of [main, linksBox]) {
    el.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && setOpen(true));
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") closeTimer = setTimeout(() => setOpen(false), 280);
    });
  }
  main.addEventListener("click", () => {
    if (scratched) return (scratched = false);
    setOpen(root.dataset.open !== "true");
  });
  root.addEventListener("focusout", (e) => !root.contains(e.relatedTarget) && setOpen(false));
  document.addEventListener("pointerdown", (e) => !root.contains(e.target) && setOpen(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
  anchors.forEach((a) =>
    a.addEventListener("click", (e) => {
      if (a.getAttribute("href") === "#top") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setOpen(false);
    }),
  );
  setOpen(false);

  // ── Secret: scratch the ring like a record ──
  let scratched = false;
  scratch(main, () => (scratched = true));

  // ── Sound (hold it for the studio) ──
  const soundBtn = root.querySelector(".fab__btn--sound");
  let held = false;
  const studio = createStudio(root);
  let holdTimer = 0;
  soundBtn.addEventListener("pointerdown", () => {
    if (!isOn("studio")) return;
    holdTimer = setTimeout(() => {
      held = true;
      studio.open();
    }, 600);
  });
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) soundBtn.addEventListener(t, () => clearTimeout(holdTimer));
  // on is on, off is off
  soundBtn.addEventListener("click", () => {
    if (held) return (held = false);
    toggleSound();
  });
  inviteToSound(root, soundBtn);
  onSound((on, wanted) => {
    soundBtn.setAttribute("aria-pressed", String(wanted));
    soundBtn.classList.toggle("is-playing", on);
    soundBtn.querySelector(".fab__tip").textContent = wanted ? "Sound on" : "Sound off";
  });

  const blueprintButton = root.querySelector(".fab__btn--bp");
  if (!blueprint) blueprintButton.addEventListener("click", (e) => e.stopImmediatePropagation());
  return { blueprintButton: blueprint ? blueprintButton : null };
}

/**
 * Scratch: drag around the menu circle and the ring turns under your
 * cursor like a record, bending the pad's pitch with how fast you spin it.
 * One full turn finds the secret. A drag never counts as a click.
 */
function scratch(main, onDragged) {
  const ring = main.querySelector(".fab__ring");
  let drag = null;
  const angleAt = (e) => {
    const r = main.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  main.addEventListener("pointerdown", (e) => {
    if (!isOn("scratch")) return;
    drag = { x: e.clientX, y: e.clientY, a: angleAt(e), t: performance.now(), turned: 0, spin: 0, live: false, id: e.pointerId };
  });
  main.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.live) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.live = true;
      main.setPointerCapture(e.pointerId);
      main.classList.add("is-scratching");
    }
    const a = angleAt(e);
    let d = a - drag.a;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const now = performance.now();
    const speed = d / Math.max(0.008, (now - drag.t) / 1000); // degrees a second
    drag.a = a;
    drag.t = now;
    drag.spin += d;
    drag.turned += Math.abs(d);
    ring.style.rotate = `${drag.spin}deg`;
    bend(Math.max(-700, Math.min(700, speed * 0.9)));
    if (drag.turned >= 360) discover("scratch");
  });
  const end = () => {
    if (!drag) return;
    if (drag.live) {
      onDragged();
      bend(0);
      main.classList.remove("is-scratching");
    }
    drag = null;
  };
  main.addEventListener("pointerup", end);
  main.addEventListener("pointercancel", end);
}

/**
 * Studio mode: a fader for each layer of the site's sound and a live level
 * meter. Settings are kept between visits.
 */
function createStudio(root) {
  const panel = document.createElement("div");
  panel.className = "studio";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Studio");
  panel.innerHTML = `
    <header class="studio__head">
      <p><b>Studio</b></p>
      <button type="button" class="studio__close" aria-label="Close the studio">×</button>
    </header>
    <canvas class="studio__meter" width="240" height="18" aria-hidden="true"></canvas>
    <div class="studio__faders">
      ${LAYERS.map(
        (l) => `
        <label class="studio__fader">
          <span>${l.label}</span>
          <input type="range" min="0" max="150" step="1" data-layer="${l.id}" />
          <output></output>
        </label>`,
      ).join("")}
    </div>
    <button type="button" class="studio__reset">Reset</button>`;
  root.appendChild(panel);
  const meter = panel.querySelector(".studio__meter");
  const mctx = meter.getContext("2d");
  const inputs = [...panel.querySelectorAll("input[data-layer]")];
  const sync = () =>
    inputs.forEach((i) => {
      i.value = Math.round(getMix(i.dataset.layer) * 100);
      i.nextElementSibling.textContent = `${i.value}%`;
    });
  inputs.forEach((i) =>
    i.addEventListener("input", () => {
      setMix(i.dataset.layer, i.value / 100);
      i.nextElementSibling.textContent = `${i.value}%`;
    }),
  );
  panel.querySelector(".studio__reset").addEventListener("click", () => {
    resetMix();
    sync();
  });
  let raf = 0;
  let peak = 0;
  const draw = () => {
    const v = level();
    peak = Math.max(v, peak * 0.97);
    const w = meter.width;
    mctx.clearRect(0, 0, w, meter.height);
    const bars = 40;
    for (let k = 0; k < bars; k++) {
      const on = k / bars < v;
      const hue = k < bars * 0.6 ? "#39ff88" : k < bars * 0.85 ? "#ffd23f" : "#ff8a7a";
      mctx.fillStyle = on ? hue : "rgba(255,255,255,.08)";
      mctx.fillRect(k * (w / bars) + 1, 3, w / bars - 2, 12);
    }
    mctx.fillStyle = "#fff";
    mctx.fillRect(Math.min(w - 2, peak * w), 1, 2, 16);
    raf = requestAnimationFrame(draw);
  };
  const close = () => {
    root.classList.remove("studio-open");
    cancelAnimationFrame(raf);
  };
  panel.querySelector(".studio__close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  document.addEventListener("pointerdown", (e) => !root.contains(e.target) && close());
  return {
    open() {
      if (!isSoundPlaying()) toggleSound(true);
      sync();
      root.classList.add("studio-open");
      cancelAnimationFrame(raf);
      draw();
      discover("studio");
    },
  };
}

/**
 * First visit only: a small card beside the sound button saying the site
 * has sound, with a way to turn it on. Closing it, turning sound on, or
 * using the sound button directly means it never shows again.
 */
const INVITE_KEY = "bc-sound-invite";
function inviteToSound(root, soundBtn) {
  let seen = true;
  try {
    seen = !!localStorage.getItem(INVITE_KEY);
  } catch {
    // can't remember it, so don't nag
  }
  if (seen || soundWanted()) return;

  const card = document.createElement("div");
  card.className = "sound-invite";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "This site has sound");
  card.innerHTML = `
    <span class="sound-invite__bow" aria-hidden="true"></span>
    <div class="sound-invite__text">
      <p><b>This site has sound</b></p>
      <p>Soft strings, a little wind when you scroll. Nothing loud.</p>
      <button type="button" class="sound-invite__on">Turn it on</button>
    </div>
    <button type="button" class="sound-invite__close" aria-label="No thanks">×</button>`;
  root.appendChild(card);

  let gone = false;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    try {
      localStorage.setItem(INVITE_KEY, "1");
    } catch {
      // fine
    }
    card.classList.remove("is-on");
    setTimeout(() => card.remove(), 500);
  };
  setTimeout(() => !gone && card.classList.add("is-on"), 2200);
  card.querySelector(".sound-invite__on").addEventListener("click", () => {
    toggleSound(true);
    dismiss();
  });
  card.querySelector(".sound-invite__close").addEventListener("click", dismiss);
  soundBtn.addEventListener("click", dismiss);
}
