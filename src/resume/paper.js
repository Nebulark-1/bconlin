// Choosing lines and drawing the page, shared by the public résumé page and
// the studio. Both take the bank as an argument, so the studio can work on
// its own copy without the page reloading every time it saves.

export const ONE_PAGE_LINES = 16; // bullets that fit on one page with the rest
export const SECTIONS = [
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["volunteer", "Volunteering"],
];
// sections a one-page résumé always shows, whatever the focus or job, unless switched off
const ALWAYS = ["education", "certifications"];

/**
 * Choose and order lines for the current settings. A bullet is one fact
 * with any number of wordings; bullet.text is the wording the public page
 * shows. Bullets still marked draft (new from old résumés) stay off the
 * public page; the studio passes drafts: true.
 *
 * The studio can also pass scoreOf(bullet) to rank against a job
 * description instead of a focus, and textOf(bullet, entry) to pick the
 * wording that suits it, and lines to fit fewer bullets when its wordings
 * run long. pin and drop (Sets of "entry-bullet" keys) are the studio's
 * hand picks: a pinned bullet is always on the page, past its entry's
 * limit and never trimmed, and a dropped one never is. sections
 * ({ projects: "on", volunteer: "off" }) overrides which sections a
 * one-page résumé shows; a section left out follows the usual rules.
 * skills ({ pin: [name], drop: [name], spoken: false }) does the same for
 * the skills: a pinned skill is shown past its row's five, a dropped one
 * never is, and spoken: false leaves off the Spoken row. order
 * ({ entries: [entryId], bullets: { entryId: [bulletId] } }) is the order
 * I've put things in by hand; it changes only the order, never what's
 * chosen, and anything it doesn't list keeps its usual place after.
 */
export function compose(bank, { lens, full, healthcare, drafts = false, scoreOf, textOf, lines: budget = ONE_PAGE_LINES, pin = new Set(), drop = new Set(), sections = {}, skills: skillPicks = {}, order = {} }) {
  const score = scoreOf || ((b) => b.score[lens]);
  const pinned = (e, b) => pin.has(`${e.id}-${b.id}`);
  const off = (e) => !full && sections[e.section] === "off";
  let entries = bank.entries.filter((e) => !(e.optional === "healthcare" && !healthcare) && !off(e)).map((e) => {
    const ranked = e.bullets.filter((b) => (drafts || !b.draft) && !drop.has(`${e.id}-${b.id}`)).sort((a, b) => score(b) - score(a));
    const chosen = full ? ranked : ranked.filter((b, i) => i < e.max || pinned(e, b));
    return {
      ...e,
      top: ranked.length ? score(ranked[0]) : 0,
      pinned: chosen.some((b) => pinned(e, b)),
      had: e.bullets.length,
      bullets: textOf ? chosen.map((b) => ({ ...b, text: textOf(b, e) })) : chosen,
    };
  // an entry left with nothing to say goes, but one that never had bullets
  // (a certification: just its name, issuer, and date) stays
  }).filter((e) => e.bullets.length || !e.had);
  // On one page, an entry earns its place only if it speaks to this focus
  // or job: a project or volunteer role needs a strong line, other work a
  // fair one. Education and certifications always stay, and so does an
  // optional role I've switched on. A section I've switched on brings its
  // entries that are strong for the focus (a 6 or better), and always its
  // best one. An entry that's only here because I pinned a line from it
  // shows just the pinned lines.
  const strength = (e) => Math.max(0, ...e.bullets.map((b) => b.score[lens] || 0));
  const best = new Map();
  for (const e of entries) if (!best.has(e.section) || strength(e) > strength(best.get(e.section))) best.set(e.section, e);
  const switchedOn = (e) => sections[e.section] === "on" && (strength(e) >= 6 || best.get(e.section) === e);
  if (!full)
    entries = entries
      .map((e) => {
        if (ALWAYS.includes(e.section) || switchedOn(e) || e.optional || e.top >= (e.section === "experience" ? 3 : 6)) return e;
        return e.pinned ? { ...e, bullets: e.bullets.filter((b) => pinned(e, b)) } : null;
      })
      .filter(Boolean);

  if (!full) {
    // Trim the weakest lines across the page until it fits, keeping at
    // least one line per entry and every pinned line. Pinned lines are
    // extra: they don't count toward the budget, so adding one fills space
    // instead of bumping another line.
    const lines = () => entries.reduce((n, e) => n + e.bullets.filter((b) => !pinned(e, b)).length, 0);
    while (lines() > budget) {
      let worst = null;
      for (const e of entries) {
        if (e.bullets.length <= 1) continue;
        const last = e.bullets.findLast((b) => !pinned(e, b));
        if (last && (!worst || score(last) < score(worst.b))) worst = { e, b: last };
      }
      if (!worst) break;
      worst.e.bullets = worst.e.bullets.filter((b) => b !== worst.b);
    }
  }
  // projects in order of how well they fit
  const projects = entries.filter((e) => e.section === "projects").sort((a, b) => b.top - a.top);
  entries = [...entries.filter((e) => e.section === "experience"), ...projects, ...entries.filter((e) => !["experience", "projects"].includes(e.section))];

  // then my own order, if I've set one (after trimming, which needs the
  // bullets weakest-last); the sorts are stable, so anything unlisted keeps
  // its place behind the listed ones
  const rank = (list, id) => (list?.includes(id) ? list.indexOf(id) : Infinity);
  if (order.entries) entries.sort((a, b) => rank(order.entries, a.id) - rank(order.entries, b.id) || 0);
  for (const e of entries) if (order.bullets?.[e.id]) e.bullets.sort((a, b) => rank(order.bullets[e.id], a.id) - rank(order.bullets[e.id], b.id) || 0);

  const { pin: skillPin = [], drop: skillDrop = [], spoken = true } = skillPicks;
  const skills = bank.skills
    .map(({ row, items }) => ({
      row,
      // the row's five best, then my picks: a removed skill leaves a gap
      // rather than letting the sixth in, so removing one shortens the row
      items: [...items]
        .sort((a, b) => (b[1][lens] || 0) - (a[1][lens] || 0))
        .filter(([name], i) => (full || i < 5 || skillPin.includes(name)) && !skillDrop.includes(name))
        .map(([name]) => name),
    }))
    .filter((r) => r.items.length);
  const shown = entries.reduce((n, e) => n + e.bullets.length, 0);
  const total = bank.entries.reduce((n, e) => n + e.bullets.filter((b) => drafts || !b.draft).length, 0);
  return { summary: bank.summary[lens], entries, skills, spoken: spoken ? bank.spoken : "", shown, total };
}

const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Draw a composed résumé into el. */
export function renderPaper(el, bank, model) {
  const { profile } = bank;
  const block = (e) => `
    <div class="r-entry" data-entry="${e.id}" style="view-transition-name: e-${e.id}">
      <div class="r-entry__head">
        <p><b>${esc(e.org)}</b>${e.where ? `<span class="r-where">${esc(e.where)}</span>` : ""}</p>
        <p class="r-when">${esc(e.when)}</p>
      </div>
      <p class="r-role">${esc(e.role)}</p>
      ${e.bullets.length ? `<ul>${e.bullets.map((b) => `<li data-id="${e.id}-${b.id}"${b.draft ? ' class="is-draft"' : ""} style="view-transition-name: b-${e.id}-${b.id}">${esc(b.text)}</li>`).join("")}</ul>` : ""}
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
      ${model.spoken ? `<p class="r-skill"><b>Spoken:</b> ${esc(model.spoken)}</p>` : ""}
    </section>`;
}
