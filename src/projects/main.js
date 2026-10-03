import { PROJECTS, SCORES, STATUS } from "./data.js";
import { mountFab } from "../site/fab.js";

// The projects page: a ranked index, then half a screen of picture and half
// a screen of write-up for each project. Projects small enough to run in a
// browser have a live copy under demos/.

mountFab({ current: "projects" });
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const host = (p) => (p.url ? p.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : p.id);

// ── The index ───────────────────────────────────────────────
$(".projects__index").innerHTML = PROJECTS.map(
  (p, i) => `
  <li>
    <a href="#${p.id}">
      <span class="pi__n">${String(i + 1).padStart(2, "0")}</span>
      <span class="pi__name">${esc(p.name)}</span>
      <span class="status status--${p.status}">${STATUS[p.status].label}</span>
      ${p.demo ? `<span class="pi__live">live demo</span>` : ""}
    </a>
  </li>`,
).join("");

// ── A project ───────────────────────────────────────────────
function shot(p) {
  const chrome = `<div class="frame__bar"><i></i><i></i><i></i><span>${esc(host(p))}</span></div>`;
  const body = p.shot.src
    ? `<img src="${p.shot.src}" alt="${esc(p.shot.alt)}" loading="lazy" />`
    : `<div class="frame__empty"><p>Screenshot coming</p></div>`;
  return `<figure class="frame">${chrome}${body}</figure>`;
}

function project(p, i) {
  const scores = SCORES.map(
    (s) => `<li><span>${s.label}</span><b style="--v:${p.scores[s.id] / 10}"></b><em>${p.scores[s.id]}</em></li>`,
  ).join("");
  const links = [
    p.demo && `<a class="proj__link proj__link--live" href="${p.demo}" target="_blank" rel="noopener">Try it live</a>`,
    p.url.startsWith("http") && !p.demo && `<a class="proj__link" href="${p.url}" target="_blank" rel="noopener">Visit ${esc(host(p))}</a>`,
  ].filter(Boolean);
  return `
    <section class="proj" id="${p.id}">
      <div class="proj__shot">${shot(p)}</div>
      <div class="proj__copy">
        <p class="proj__n">${String(i + 1).padStart(2, "0")} · ${esc(p.when)} <span class="status status--${p.status}">${STATUS[p.status].label}</span></p>
        <h2>${esc(p.name)}</h2>
        <p class="proj__tagline">${esc(p.tagline)}</p>
        <p class="proj__what">${esc(p.what)}</p>
        ${p.why ? `<h3>Why I built it</h3><p>${esc(p.why)}</p>` : `<p class="proj__todo">Why I built it: coming soon, in my own words.</p>`}
        <h3>How it works</h3>
        <ul class="proj__how">${p.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>
        <dl class="proj__stats">${p.stats.map(([n, label]) => `<div><dt>${esc(n)}</dt><dd>${esc(label)}</dd></div>`).join("")}</dl>
        <ul class="proj__tools">${p.tools.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <ul class="proj__scores" aria-label="Scores out of 10">${scores}</ul>
        ${links.length ? `<div class="proj__links">${links.join("")}</div>` : ""}
      </div>
    </section>`;
}

$(".projects__list").innerHTML = PROJECTS.map(project).join("");
