import { PROJECTS, ROLES, SKILL_GROUPS, STATUS } from "./data.js";
import { mountFab } from "../site/fab.js";

// The projects page. The skills grid at the top is the filter: each dot is a
// skill a project shows, backed by a specific bullet or tool. Picking skills
// filters and ranks the projects and marks the bullets that prove them. The
// state lives in the URL, so a filtered view can be shared.

mountFab({ current: "projects" });
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (t) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const host = (p) => (p.url ? p.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : p.id);
const calm = matchMedia("(prefers-reduced-motion: reduce)");

const SKILLS = SKILL_GROUPS.flatMap((g) => g.skills);
const SKILL = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

// ── Evidence ────────────────────────────────────────────────
// What proves skill `sid` in project `p`: its bullets, or failing that, the
// matching entries in its tool list.
function evidence(p, sid) {
  const idx = p.skills[sid];
  if (!idx) return null;
  if (idx.length) return { bullets: idx, text: p.how[idx[0]] };
  const tools = p.tools.filter((t) => SKILL[sid].tools.includes(t));
  return { bullets: [], text: `Built with ${tools.join(", ")}.` };
}

// "2026–present" sorts after "2026", which sorts after "2025".
function recency(p) {
  const years = p.when.match(/\d{4}/g).map(Number);
  const end = /present/i.test(p.when) ? 9999 : Math.max(...years);
  return end * 10000 + Math.min(...years);
}

// ── State, mirrored in the URL ──────────────────────────────
const state = { skills: new Set(), sort: "featured" };
const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "match", label: "Best match" },
];

function readUrl() {
  const q = new URLSearchParams(location.search);
  for (const id of (q.get("skills") || "").split(",")) if (SKILL[id]) state.skills.add(id);
  const sort = q.get("sort");
  if (SORTS.some((s) => s.id === sort)) state.sort = sort;
  else if (state.skills.size) state.sort = "match";
  if (state.sort === "match" && !state.skills.size) state.sort = "featured";
}

function writeUrl() {
  const q = new URLSearchParams();
  if (state.skills.size) q.set("skills", [...state.skills].join(","));
  // "Best match" is implied by skills, and "Featured" by none.
  const implied = state.skills.size ? "match" : "featured";
  if (state.sort !== implied) q.set("sort", state.sort);
  const s = q.toString();
  history.replaceState(null, "", s ? `?${s}${location.hash}` : location.pathname + location.hash);
}

const score = (p) => [...state.skills].filter((s) => p.skills[s]).length;

function ordered() {
  const featured = (p) => PROJECTS.indexOf(p);
  const list = PROJECTS.filter((p) => !state.skills.size || score(p) > 0);
  const by = {
    featured: (a, b) => featured(a) - featured(b),
    newest: (a, b) => recency(b) - recency(a) || featured(a) - featured(b),
    match: (a, b) => score(b) - score(a) || featured(a) - featured(b),
  }[state.sort];
  return list.sort(by);
}

// ── The skills grid ─────────────────────────────────────────
function renderGrid() {
  const head = PROJECTS.map(
    (p) => `
      <th scope="col" data-col="${p.id}">
        <a href="#${p.id}"><span class="mx__dotkey status--${p.status}"></span>${esc(p.short)}</a>
      </th>`,
  ).join("");

  const body = SKILL_GROUPS.map((g) => {
    const rows = g.skills
      .map((s) => {
        const n = PROJECTS.filter((p) => p.skills[s.id]).length;
        const cells = PROJECTS.map((p) => {
          const ev = evidence(p, s.id);
          if (!ev) return `<td data-col="${p.id}"></td>`;
          const strong = ev.bullets.length ? " mx__dot--proof" : "";
          return `
            <td data-col="${p.id}">
              <button class="mx__dot${strong}" data-p="${p.id}" data-s="${s.id}"
                aria-label="${esc(s.label)} in ${esc(p.name)}: ${esc(ev.text)}"></button>
            </td>`;
        }).join("");
        return `
          <tr data-skill="${s.id}">
            <th scope="row">
              <button class="mx__skill" data-s="${s.id}" aria-pressed="false">
                <span class="mx__check" aria-hidden="true"></span>${esc(s.label)}<em>${n}</em>
              </button>
            </th>
            ${cells}
          </tr>`;
      })
      .join("");
    return `<tbody><tr class="mx__group"><th colspan="${PROJECTS.length + 1}">${esc(g.label)}</th></tr>${rows}</tbody>`;
  }).join("");

  $(".mx").innerHTML = `<thead><tr><th class="mx__corner">Skill</th>${head}</tr></thead>${body}`;
}

// Hovering a dot shows the line that proves it.
const tip = document.createElement("div");
tip.className = "mx__tip";
tip.setAttribute("role", "tooltip");
tip.hidden = true;
document.body.append(tip);

function showTip(dot) {
  const p = BY_ID[dot.dataset.p];
  const s = SKILL[dot.dataset.s];
  const ev = evidence(p, s.id);
  tip.innerHTML = `<b>${esc(s.label)}</b> · ${esc(p.name)}<p>${esc(ev.text)}</p>`;
  tip.hidden = false;
  const r = dot.getBoundingClientRect();
  const w = tip.offsetWidth;
  const x = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), innerWidth - w - 12);
  const above = r.top - tip.offsetHeight - 10;
  tip.style.left = `${x}px`;
  tip.style.top = `${above > 70 ? above : r.bottom + 10}px`;
}
const hideTip = () => (tip.hidden = true);

function bindGrid() {
  const grid = $(".mx");
  grid.addEventListener("click", (e) => {
    const skill = e.target.closest(".mx__skill");
    if (skill) return toggleSkill(skill.dataset.s);
    const dot = e.target.closest(".mx__dot");
    if (dot) jumpTo(dot.dataset.p, dot.dataset.s);
  });
  grid.addEventListener("pointerover", (e) => {
    const dot = e.target.closest(".mx__dot");
    if (dot) showTip(dot);
    const cell = e.target.closest("[data-col]");
    hoverCol(grid, cell ? cell.dataset.col : null);
  });
  grid.addEventListener("pointerleave", () => {
    hideTip();
    hoverCol(grid, null);
  });
  grid.addEventListener("focusin", (e) => e.target.matches(".mx__dot") && showTip(e.target));
  grid.addEventListener("focusout", hideTip);
  addEventListener("scroll", hideTip, { passive: true });
}

function hoverCol(grid, col) {
  if (grid.dataset.col === (col ?? "")) return;
  grid.dataset.col = col ?? "";
  for (const c of $$("[data-col]", grid)) c.classList.toggle("is-col", c.dataset.col === col);
}

// Clicking a dot selects its skill and scrolls to the bullet that proves it.
function jumpTo(pid, sid) {
  hideTip();
  if (!state.skills.has(sid)) toggleSkill(sid);
  const card = document.getElementById(pid);
  const target = $(`.pj__how li.is-hit`, card) || $(`.pj__tools li.is-hit`, card) || card;
  target.scrollIntoView({ behavior: calm.matches ? "auto" : "smooth", block: "center" });
  target.classList.remove("is-flash");
  void target.offsetWidth;
  target.classList.add("is-flash");
}

// ── Cards ───────────────────────────────────────────────────
function media(p) {
  const chrome = `<div class="frame__bar"><i></i><i></i><i></i><span>${esc(host(p))}</span></div>`;
  const pic = p.shot.src
    ? `<img src="${p.shot.src}" alt="${esc(p.shot.alt)}" loading="lazy" />`
    : `<div class="frame__empty"><span>${esc(p.name)}</span><p>Screenshot on the way</p></div>`;
  if (p.demo) {
    return `
      <a class="frame frame--live" href="${p.demo}" target="_blank" rel="noopener" aria-label="Run the ${esc(p.name)} demo">
        ${chrome}<div class="frame__pic">${pic}<span class="frame__play"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z"/></svg>Run it live</span></div>
      </a>`;
  }
  return `<figure class="frame">${chrome}<div class="frame__pic">${pic}</div></figure>`;
}

function card(p) {
  const links = [
    p.demo && `<a class="pj__link pj__link--live" href="${p.demo}" target="_blank" rel="noopener">Run the live demo</a>`,
    p.url.startsWith("http") && !p.demo && `<a class="pj__link" href="${p.url}" target="_blank" rel="noopener">Visit ${esc(host(p))}</a>`,
  ].filter(Boolean);
  const bulletSkills = (i) =>
    Object.entries(p.skills).filter(([, idx]) => idx.includes(i)).map(([s]) => s).join(" ");
  return `
    <article class="pj" id="${p.id}" data-id="${p.id}">
      <div class="pj__media">${media(p)}</div>
      <div class="pj__body">
        <p class="pj__meta">
          <span>${esc(p.when)}</span>
          <span class="status status--${p.status}">${STATUS[p.status].label}</span>
          <span class="pj__match" aria-live="polite"></span>
        </p>
        <h2>${esc(p.name)}</h2>
        <p class="pj__tagline">${esc(p.tagline)}</p>
        <p class="pj__what">${esc(p.what)}</p>
        ${p.why ? `<p class="pj__why">${esc(p.why)}</p>` : ""}
        <ul class="pj__how">
          ${p.how.map((h, i) => `<li data-skills="${bulletSkills(i)}"><span>${esc(h)}</span><span class="pj__proves"></span></li>`).join("")}
        </ul>
        <dl class="pj__stats">
          ${p.stats.map(([n, label]) => `<div><dt>${esc(n)}</dt><dd>${esc(label)}</dd></div>`).join("")}
        </dl>
        <div class="pj__foot">
          <ul class="pj__tools" aria-label="Tools">${p.tools.map((t) => `<li data-tool="${esc(t)}">${esc(t)}</li>`).join("")}</ul>
          ${links.length ? `<div class="pj__links">${links.join("")}</div>` : ""}
        </div>
      </div>
    </article>`;
}

// ── The bar: active skills and sort ─────────────────────────
function renderBar() {
  const shown = ordered().length;
  const chips = [...state.skills]
    .map(
      (s) => `<button class="bar__chip" data-s="${s}" aria-label="Remove ${esc(SKILL[s].label)}">
        ${esc(SKILL[s].label)}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg></button>`,
    )
    .join("");
  $(".bar__filters").innerHTML = state.skills.size
    ? `<span class="bar__count">${shown} of ${PROJECTS.length}</span>${chips}<button class="bar__clear">Clear</button>`
    : `<span class="bar__count">${PROJECTS.length} projects</span>`;

  $(".bar__sort").innerHTML = SORTS.map(
    (s) => `<button data-sort="${s.id}" aria-pressed="${state.sort === s.id}"
      ${s.id === "match" && !state.skills.size ? "disabled" : ""}>${s.label}</button>`,
  ).join("");
}

function bindBar() {
  $(".bar").addEventListener("click", (e) => {
    const chip = e.target.closest(".bar__chip");
    if (chip) return toggleSkill(chip.dataset.s);
    if (e.target.closest(".bar__clear")) return clearSkills();
    const sort = e.target.closest("[data-sort]");
    if (sort && !sort.disabled) {
      state.sort = sort.dataset.sort;
      update();
    }
  });
}

function toggleSkill(sid) {
  const had = state.skills.size;
  state.skills.has(sid) ? state.skills.delete(sid) : state.skills.add(sid);
  // Picking the first skill switches to "Best match"; clearing the last one
  // switches back, unless someone chose a sort on purpose.
  if (!had && state.skills.size && state.sort === "featured") state.sort = "match";
  if (!state.skills.size && state.sort === "match") state.sort = "featured";
  update();
}

function clearSkills() {
  state.skills.clear();
  if (state.sort === "match") state.sort = "featured";
  update();
}

// ── Role shortcuts: pick a whole set of skills at once ───────
function renderRoles() {
  $(".roles__list").innerHTML = ROLES.map(
    (r, i) => `<button class="roles__btn" data-role="${i}" aria-pressed="false">${esc(r.label)}</button>`,
  ).join("");
  $(".roles__list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-role]");
    if (!b) return;
    const role = ROLES[b.dataset.role];
    const on = b.getAttribute("aria-pressed") === "true";
    state.skills = new Set(on ? [] : role.skills);
    if (!on && state.sort === "featured") state.sort = "match";
    if (on && state.sort === "match") state.sort = "featured";
    update();
  });
}

const sameSet = (a, b) => a.size === b.length && b.every((x) => a.has(x));

// ── Update: filter, highlight, and slide cards into place ────
function update() {
  const list = $(".pj-list");
  const cards = $$(".pj", list);
  const before = new Map(cards.map((c) => [c, c.hidden ? null : c.getBoundingClientRect()]));

  const order = ordered();
  const visible = new Set(order.map((p) => p.id));
  for (const p of order) list.append(document.getElementById(p.id));
  for (const c of cards) if (!visible.has(c.id)) list.append(c);

  for (const c of cards) {
    const p = BY_ID[c.id];
    c.hidden = !visible.has(c.id);
    const hits = [...state.skills].filter((s) => p.skills[s]);
    $(".pj__match", c).textContent = state.skills.size
      ? `Shows ${hits.length} of ${state.skills.size} skill${state.skills.size > 1 ? "s" : ""}`
      : "";
    for (const li of $$(".pj__how li", c)) {
      const mine = li.dataset.skills.split(" ").filter((s) => state.skills.has(s));
      li.classList.toggle("is-hit", mine.length > 0);
      $(".pj__proves", li).textContent = mine.map((s) => SKILL[s].label).join(" · ");
    }
    for (const li of $$(".pj__tools li", c)) {
      li.classList.toggle("is-hit", hits.some((s) => SKILL[s].tools.includes(li.dataset.tool)));
    }
  }

  // Grid: pressed rows, and dim the columns that are filtered out.
  for (const b of $$(".mx__skill")) b.setAttribute("aria-pressed", String(state.skills.has(b.dataset.s)));
  for (const tr of $$(".mx tr[data-skill]")) tr.classList.toggle("is-on", state.skills.has(tr.dataset.skill));
  for (const cell of $$(".mx [data-col]")) cell.classList.toggle("is-out", !visible.has(cell.dataset.col));

  for (const b of $$(".roles__btn")) {
    b.setAttribute("aria-pressed", String(sameSet(state.skills, ROLES[b.dataset.role].skills)));
  }

  renderBar();
  writeUrl();

  if (calm.matches) return;
  for (const c of cards) {
    if (c.hidden) continue;
    const a = before.get(c);
    const b = c.getBoundingClientRect();
    if (!a) {
      c.animate([{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], {
        duration: 420,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
    } else if (a.top !== b.top) {
      c.animate([{ transform: `translateY(${a.top - b.top}px)` }, { transform: "none" }], {
        duration: 520,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
    }
  }
}

// ── Boot ────────────────────────────────────────────────────
readUrl();
renderGrid();
renderRoles();
$(".pj-list").innerHTML = PROJECTS.map(card).join("");
bindGrid();
bindBar();
update();
