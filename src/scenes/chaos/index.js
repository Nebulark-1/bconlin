import { range, easeInOutCubic, easeOutCubic } from "../../engine/math.js";
import { reducedMotion } from "../../engine/scroll.js";
import { createConductor } from "../../engine/conductor.js";
import { createDeck } from "../../engine/deck.js";
import { createInspector } from "../../inspect/inspector.js";
import { chaosTopics } from "../../inspect/topics-chaos.js";
import { checkWeek, painSaysHold } from "./guardrails.js";
import { HISTORY, PAIN, PROPOSALS, total } from "./sample.js";

// Chapter 4 is drawn in Chaos Coaching's own look (its dark theme), so
// following the link to chaoscoaching.co lands somewhere that looks like
// what you just saw. The screens are rebuilt here with sample data, and the
// guardrails are a simplified sketch written for this page, not the app's
// code.

export const ENTER_END = 0.12;
export const EXIT_START = 0.92;

const BEATS = [
  { kicker: "4.1 · The idea", word: "A log with a coach in it", tab: "training" },
  { kicker: "4.2 · Say how it went", word: "Feedback it can use", tab: "log" },
  { kicker: "4.3 · Next week", word: "A plan with reasons", tab: "plan" },
  { kicker: "4.4 · Guardrails", word: "Rules it can't break", tab: "plan" },
];

const SPORT = { run: "var(--run)", bike: "var(--bike)", lift: "var(--lift)", mobility: "var(--e-mobility)" };

function trainingMarkup() {
  const score = (n, label, sub, color, pct) => `
    <div class="cc-score"><p><b>${n}</b>${label}</p><span class="cc-meter"><i style="--c:${color};--w:${pct}%"></i></span><small>${sub}</small></div>`;
  const tot = (n, of, label, pct) => `<div class="cc-tot"><p><b>${n}</b> / ${of}</p><span class="cc-meter"><i style="--c:var(--ink);--w:${pct}%"></i></span><small>${label}</small></div>`;
  return `
    <div class="cc-view" data-component="Training">
      <div class="cc-page-head">
        <div><p class="cc-kick">Training</p><h4>This week</h4><p class="cc-sub">Build week 3 · sample athlete</p></div>
        <div class="cc-weeknav"><span>‹</span><b>2026-W41</b><span>›</span></div>
      </div>
      <div class="cc-panel cc-scores">
        ${score(62, "Endurance", "chronic load 41 vs your peak 48", "var(--bike)", 62)}
        ${score(57, "Speed", "11% of time above easy", "var(--run)", 57)}
        ${score(48, "Goal confidence", "moderate evidence", "var(--swim)", 48)}
      </div>
      <div class="cc-panel cc-coach">
        <p class="cc-coach__head"><i></i>Coach <span class="cc-pill cc-pill--warn">hold</span></p>
        <p class="cc-coach__note">Thirty-one miles again rather than thirty-four. The right shin has come up three times in a fortnight, and that's the one thing in the log worth respecting this week. Tempo moves to Wednesday so Tuesday's lift isn't the day before it, and the long run stays at ten.</p>
        <p class="cc-coach__foot">Sample note. In the app, the coach writes this from your log.</p>
      </div>
      <div class="cc-panel cc-tots">
        ${tot("19.0 mi", "31.0 mi", "Run", 61)}
        ${tot("45m", "45m", "Bike", 100)}
        ${tot("1×", "2×", "Lift", 50)}
        ${tot("1×", "1×", "Mobility", 100)}
      </div>
    </div>`;
}

function bodyMap() {
  // a simple front-view figure; the dot sits on the right shin (viewer's left)
  return `
    <svg class="cc-figure" viewBox="0 0 120 230" aria-hidden="true">
      <g class="cc-figure__fig">
        <circle cx="60" cy="20" r="13"/>
        <rect x="40" y="38" width="40" height="62" rx="14"/>
        <rect x="24" y="42" width="13" height="58" rx="6.5" transform="rotate(8 30 42)"/>
        <rect x="83" y="42" width="13" height="58" rx="6.5" transform="rotate(-8 90 42)"/>
        <rect x="42" y="96" width="17" height="64" rx="8"/>
        <rect x="61" y="96" width="17" height="64" rx="8"/>
        <rect x="43" y="158" width="15" height="60" rx="7"/>
        <rect x="62" y="158" width="15" height="60" rx="7"/>
      </g>
      <circle class="cc-figure__ring" cx="51" cy="182" r="10"/>
      <circle class="cc-figure__dot" cx="51" cy="182" r="4.5"/>
    </svg>`;
}

function logMarkup() {
  const hold = painSaysHold(PAIN.recurring);
  const splits = [8.15, 8.07, 8.02, 8.09, 7.98, 7.92];
  return `
    <div class="cc-view" data-component="Session log">
      <div class="cc-page-head"><div><p class="cc-kick">Log</p><h4>Thu · 6 mi easy</h4><p class="cc-sub">from Strava · sample session</p></div></div>
      <div class="cc-log">
        <div class="cc-panel cc-session">
          <div class="cc-stats">
            <p><b>6.1</b><small>mi</small></p><p><b>49:12</b><small>time</small></p><p><b>8:04</b><small>/mi</small></p><p><b>148</b><small>bpm</small></p>
          </div>
          <div class="cc-splits">${splits.map((m, k) => `<span style="--h:${Math.round((8.3 - m) * 220 + 20)}%;--i:${k}"><i></i><small>${k + 1}</small></span>`).join("")}</div>
          <p class="cc-q">How did it feel?</p>
          <div class="cc-seg">${["Awful", "Rough", "OK", "Good", "Great"].map((x) => `<span${x === "OK" ? ' class="is-on"' : ""}>${x}</span>`).join("")}</div>
          <p class="cc-q">How hard?</p>
          <div class="cc-rpe">${Array.from({ length: 10 }, (_, k) => `<span${k === 3 ? ' class="is-on"' : ""}>${k + 1}</span>`).join("")}</div>
          <p class="cc-notefield">Shin again on the downhill. Settled by the end.</p>
        </div>
        <div class="cc-panel cc-pain">
          ${bodyMap()}
          <p class="cc-pain__site">Right shin, front<small>4/10</small></p>
          <div class="cc-flags"><span>Changed how I moved</span><span>Got worse as I went</span></div>
          <p class="cc-pattern"><b>Pattern</b>${hold}. The same spot again and again is treated as a pattern, so the load holds next week.</p>
        </div>
      </div>
    </div>`;
}

function planMarkup() {
  const plan = PROPOSALS[0].plan;
  return `
    <div class="cc-view" data-component="Plan">
      <div class="cc-page-head">
        <div><p class="cc-kick">Plan</p><h4>Next week</h4><p class="cc-sub">2026-W42 · proposed · ${total(plan)} mi run</p></div>
        <span class="cc-pill cc-pill--warn">hold</span>
      </div>
      <div class="cc-panel cc-days">
        ${plan.days
          .map(
            (d, k) => `
          <div class="cc-dayrow" style="--i:${k}"><b>${d.dow}</b><span>${d.sessions.map((s) => `<em style="--c:${SPORT[s.sport]}">${s.title}</em>`).join("") || '<em class="is-rest">Rest</em>'}</span></div>`,
          )
          .join("")}
      </div>
      <div class="cc-panel cc-changed">
        <p class="cc-kick">What changed</p>
        <ul><li>Volume held at 31 mi, for the shin</li><li>Tempo moved Tue → Wed, away from the lift</li><li>Strides kept short, on flat ground</li></ul>
      </div>
      <div class="cc-actions"><span class="cc-btn">Accept plan</span><span class="cc-btn cc-btn--ghost">Edit a day</span><small>Nothing changes until you accept it.</small></div>
    </div>`;
}

function guardMarkup() {
  return `
    <div class="cc-view cc-view--guard" data-component="Guardrails">
      <div class="cc-page-head">
        <div><p class="cc-kick">Guardrails</p><h4>Checked in code, every time</h4><p class="cc-sub">sample weeks · simplified rules</p></div>
      </div>
      <div class="cc-try">${PROPOSALS.map((p) => `<span data-key="${p.key}">${p.label}</span>`).join("")}</div>
      <div class="cc-panel cc-check">
        <p class="cc-check__week"></p>
        <ul class="cc-check__lines"></ul>
        <p class="cc-check__verdict"></p>
      </div>
    </div>`;
}

export function chaosScene(root, chapter, blueprint) {
  const panel = root.querySelector(".panel");
  const views = root.querySelector(".cc-views");
  const heads = root.querySelector(".cc-heads");
  const tabs = [...root.querySelectorAll(".cc-nav [data-tab]")];

  views.innerHTML = trainingMarkup() + logMarkup() + planMarkup() + guardMarkup();
  const viewEls = [...views.children];
  heads.innerHTML = BEATS.map((b, k) => `<div class="cc-headline" data-beat="${k}"><p>${b.kicker}</p><h2>${b.word}${/[?!]$/.test(b.word) ? "" : "<span>.</span>"}</h2></div>`).join("");
  const headEls = [...heads.children];

  // ── The guardrails screen runs the sketch checker live ──
  const stats = { proposal: 0, pain: "recurring", auto: true, results: null };
  const guard = viewEls[3];
  function check() {
    const p = PROPOSALS[stats.proposal];
    const pain = PAIN[stats.pain];
    const r = checkWeek(p.plan, HISTORY.previous, pain);
    stats.results = { proposal: p, ...r };
    guard.querySelectorAll(".cc-try span").forEach((el, k) => el.classList.toggle("is-on", k === stats.proposal));
    guard.querySelector(".cc-check__week").innerHTML =
      `<b>${p.label}</b> · ${r.miles} mi run, after ${HISTORY.previous} last week · ` +
      (pain.length ? `pain logged: ${pain[0].site.toLowerCase()}${pain.length > 1 ? ` ×${pain.length}` : ""}${pain[0].moved ? ", changed movement" : ""}` : "no pain logged");
    guard.querySelector(".cc-check__lines").innerHTML = r.findings.length
      ? r.findings.map((f, k) => `<li style="--i:${k}"><em class="sev--${f.level}">${f.level}</em><span>${f.text}</span></li>`).join("")
      : `<li><em class="sev--pass">pass</em><span>Every rule passes.</span></li>`;
    const verdict = guard.querySelector(".cc-check__verdict");
    verdict.className = `cc-check__verdict ${!r.saved ? "is-block" : r.findings.length ? "is-warn" : "is-ok"}`;
    verdict.textContent = !r.saved ? "Not saved: the week goes back for changes." : r.findings.length ? "Saved, with the notes shown to the athlete." : "Saved.";
  }
  check();

  // ── Résumé cards ──
  const deck = createDeck({
    panel,
    card: root.querySelector(".card"),
    cards: chapter.cards,
    render: (c) => `
      <p class="card__eyebrow">${c.eyebrow}</p>
      <h3 class="card__title">${c.title}</h3>
      ${c.meta ? `<p class="card__meta">${c.meta}</p>` : ""}
      <ul class="card__list">${c.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`,
  });

  // ── Behind the scenes ──
  const inspector = createInspector(panel, chaosTopics, {
    stats,
    propose: (k) => {
      stats.auto = false;
      stats.proposal = k;
      check();
    },
    setPain: (key) => {
      stats.auto = false;
      stats.pain = key;
      check();
    },
  });
  blueprint?.subscribe((on) => {
    if (!on) inspector.close();
  });
  window.addEventListener("resize", () => deck.place());

  const conductor = createConductor(reducedMotion ? 0.001 : 1.0);
  let last = performance.now();
  let beat = -1;
  let shownView = -1;
  let cycleAt = performance.now();

  return {
    get card() {
      return deck.current;
    },

    update(p) {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const enter = range(p, 0, ENTER_END);
      const exit = range(p, EXIT_START, 1);
      const hold = range(p, ENTER_END, EXIT_START);

      // The app window rises into place, a pink rule sweeping across its
      // top; on the way out it settles back and fades.
      const rise = easeOutCubic(range(enter, 0, 0.8));
      panel.style.transform = `translateY(${((1 - rise) * 70).toFixed(2)}%) scale(${(0.94 + 0.06 * rise - 0.03 * exit).toFixed(4)})`;
      panel.style.opacity = (1 - easeInOutCubic(exit)).toFixed(3);
      root.style.setProperty("--sweep", easeInOutCubic(range(enter, 0.5, 1)).toFixed(3));

      const target = enter < 0.7 ? -1 : Math.min(BEATS.length - 1, Math.floor(hold * BEATS.length));
      const c = conductor.tick(target, dt, now);
      const view = c.to >= 0 && c.t > 0.45 ? c.to : c.from >= 0 && c.t <= 0.45 ? c.from : -1;
      if (view !== shownView) {
        shownView = view;
        viewEls.forEach((el, k) => el.classList.toggle("is-on", k === view));
        const tab = view >= 0 ? BEATS[view].tab : null;
        tabs.forEach((el) => el.classList.toggle("is-on", el.dataset.tab === tab));
        cycleAt = now;
      }

      // on the guardrails screen, step through the sample weeks
      // (timed by the clock, not by frames, so a throttled tab keeps pace)
      if (view === 3 && stats.auto && now - cycleAt > 3400) {
        cycleAt = now;
        stats.proposal = (stats.proposal + 1) % PROPOSALS.length;
        check();
      }

      const open = enter > 0.96 && exit < 0.05;
      const current = open ? Math.max(0, c.to) : -1;
      if (current !== beat) {
        beat = current;
        headEls.forEach((el, i) => el.classList.toggle("is-on", i === current));
      }
      deck.set(current);
      root.classList.toggle("is-open", open);

      if (blueprint?.on) inspector.frame(now / 1000);
    },
  };
}
