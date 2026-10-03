// Choosing lines and drawing the page, shared by the public résumé page and
// the studio. Both take the bank as an argument, so the studio can work on
// its own copy without the page reloading every time it saves.

export const ONE_PAGE_LINES = 16; // bullets that fit on one page with the rest
export const SECTIONS = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
  ["volunteer", "Volunteering"],
];

/**
 * Choose and order lines for the current settings. A bullet is one fact
 * with any number of wordings; bullet.text is the wording the public page
 * shows. Bullets still marked draft (new from old résumés) stay off the
 * public page; the studio passes drafts: true.
 *
 * The studio can also pass scoreOf(bullet) to rank against a job
 * description instead of a focus, and textOf(bullet, entry) to pick the
 * wording that suits it, and lines to fit fewer bullets when its wordings
 * run long.
 */
export function compose(bank, { lens, full, healthcare, drafts = false, scoreOf, textOf, lines: budget = ONE_PAGE_LINES }) {
  const score = scoreOf || ((b) => b.score[lens]);
  let entries = bank.entries.filter((e) => !(e.optional === "healthcare" && !healthcare)).map((e) => {
    const ranked = e.bullets.filter((b) => drafts || !b.draft).sort((a, b) => score(b) - score(a));
    const chosen = full ? ranked : ranked.slice(0, e.max);
    return { ...e, top: ranked.length ? score(ranked[0]) : 0, bullets: textOf ? chosen.map((b) => ({ ...b, text: textOf(b, e) })) : chosen };
  }).filter((e) => e.bullets.length);
  // On one page, an entry earns its place only if it speaks to this focus
  // or job: a project or volunteer role needs a strong line, other work a
  // fair one. Education always stays, and so does an optional role I've
  // switched on.
  if (!full) entries = entries.filter((e) => e.section === "education" || e.optional || e.top >= (e.section === "experience" ? 3 : 6));

  if (!full) {
    // Trim the weakest lines across the page until it fits, keeping at
    // least one line per entry.
    const lines = () => entries.reduce((n, e) => n + e.bullets.length, 0);
    while (lines() > budget) {
      let worst = null;
      for (const e of entries) {
        if (e.bullets.length <= 1) continue;
        const last = e.bullets[e.bullets.length - 1];
        if (!worst || score(last) < score(worst.b)) worst = { e, b: last };
      }
      if (!worst) break;
      worst.e.bullets = worst.e.bullets.slice(0, -1);
    }
  }
  // projects in order of how well they fit
  const projects = entries.filter((e) => e.section === "projects").sort((a, b) => b.top - a.top);
  entries = [...entries.filter((e) => e.section === "experience"), ...projects, ...entries.filter((e) => !["experience", "projects"].includes(e.section))];

  const skills = bank.skills.map(({ row, items }) => ({
    row,
    items: [...items].sort((a, b) => b[1][lens] - a[1][lens]).slice(0, full ? items.length : 5).map(([name]) => name),
  }));
  const shown = entries.reduce((n, e) => n + e.bullets.length, 0);
  const total = bank.entries.reduce((n, e) => n + e.bullets.filter((b) => drafts || !b.draft).length, 0);
  return { summary: bank.summary[lens], entries, skills, shown, total };
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Draw a composed résumé into el. */
export function renderPaper(el, bank, model) {
  const { profile } = bank;
  const block = (e) => `
    <div class="r-entry" style="view-transition-name: e-${e.id}">
      <div class="r-entry__head">
        <p><b>${esc(e.org)}</b>${e.where ? `<span class="r-where">${esc(e.where)}</span>` : ""}</p>
        <p class="r-when">${esc(e.when)}</p>
      </div>
      <p class="r-role">${esc(e.role)}</p>
      <ul>${e.bullets.map((b) => `<li data-id="${e.id}-${b.id}"${b.draft ? ' class="is-draft"' : ""} style="view-transition-name: b-${e.id}-${b.id}">${esc(b.text)}</li>`).join("")}</ul>
    </div>`;
  el.innerHTML = `
    <header class="r-head">
      <h1>${profile.name}</h1>
      <p>${profile.location} · <a href="mailto:${profile.email}">${profile.email}</a> · <a href="https://www.${profile.linkedin}">${profile.linkedin}</a> · <a href="https://${profile.site}">${profile.site}</a></p>
    </header>
    <p class="r-summary" style="view-transition-name: summary">${esc(model.summary)}</p>
    ${SECTIONS.map(([key, title]) => {
      const list = model.entries.filter((e) => e.section === key);
      return list.length ? `<section class="r-section" style="view-transition-name: s-${key}"><h2>${title}</h2>${list.map(block).join("")}</section>` : "";
    }).join("")}
    <section class="r-section" style="view-transition-name: s-skills">
      <h2>Skills</h2>
      ${model.skills.map((r) => `<p class="r-skill"><b>${r.row}:</b> <span data-skill="${r.row}">${esc(r.items.join(", "))}</span></p>`).join("")}
      <p class="r-skill"><b>Spoken:</b> ${bank.spoken}</p>
    </section>`;
}
