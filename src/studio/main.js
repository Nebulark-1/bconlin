import { compose, renderPaper, SECTIONS } from "../resume/paper.js";
import { measure, grade, lastLineRange } from "../resume/linefit.js";
import { rankWordings, relevance, termsIn, hasTerm } from "../resume/wordings.js";
import { mountReview, slug } from "./review.js";

// The résumé studio: my private editor for the bank. The page is drawn at
// exactly 8.5 inches, so every line breaks where it will when printed.
//   Focus mode    edit the bank itself: the wordings the public page shows
//   A job         paste a job description; Claude reads its keywords, the
//                 facts that answer it rise, and each one shows its best
//                 wording for that posting. Edits become new wordings, and
//                 "I sent this" records what went out.
// The gutter colors each bullet by how well it fills its lines (the page
// marks a short or spilling last line too), and opens every wording I've
// written for a bullet, ranked. Under the page, the bench lists every
// fact that didn't make it, so I can add one by hand to fill spare room.

const $ = (sel) => document.querySelector(sel);
const paper = $(".paper");
const gutter = $(".st-gutter");
const sheet = $(".st-sheet");
const saveBtn = $("[data-save]");

const api = async (path, opts = {}) => {
  const r = await fetch(`/__studio${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  const json = await r.json();
  if (r.status >= 400) throw new Error(json.error || r.statusText);
  return Array.isArray(json) ? json : { status: r.status, ...json };
};
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

let bank = null;
let version = null; // which save of the bank this window is working from
const state = { lens: "best", full: false, healthcare: true, benchBy: "match" };
const focusPicks = { pin: [], drop: [], sections: {}, skills: { pin: [], drop: [], spoken: true } }; // hand picks without a job (this session only)
let postings = [];
let posting = null; // the job description being drafted for, if any
let dirty = false;
let postingDirty = false;
let openWordings = null; // the bullet whose wordings are showing

// ── The bank ────────────────────────────────────────────────
function bulletOf(dataId) {
  const cut = dataId.indexOf("-");
  const entry = bank.entries.find((e) => e.id === dataId.slice(0, cut));
  return { entry, bullet: entry?.bullets.find((b) => b.id === dataId.slice(cut + 1)) };
}
const allBullets = () => bank.entries.flatMap((e) => e.bullets.map((b) => ({ entry: e, bullet: b, key: `${e.id}-${b.id}` })));

/** Make sure a wording is one of the bullet's wordings. */
function keepWording(bullet, text, source) {
  if (text && !bullet.wordings.some((w) => w.text === text)) bullet.wordings.push({ text, source });
}

function setDirty(on) {
  dirty = on;
  refreshSave();
}
function refreshSave() {
  const any = dirty || postingDirty;
  saveBtn.disabled = !any;
  saveBtn.textContent = any ? "Save" : "Saved";
}

async function save() {
  if (!dirty && !postingDirty) return;
  saveBtn.textContent = "Saving…";
  // whatever is on the page becomes a wording of its fact
  for (const { bullet, key } of allBullets()) {
    keepWording(bullet, bullet.text, "studio");
    if (posting?.draft[key]) keepWording(bullet, posting.draft[key], "studio");
  }
  try {
    if (dirty) ({ version } = await api("/bank", { method: "PUT", body: JSON.stringify({ bank, version }) }));
    if (postingDirty) await api(`/postings/${posting.id}`, { method: "PUT", body: JSON.stringify(posting) });
    dirty = postingDirty = false;
    refreshSave();
  } catch (err) {
    // another studio window saved first; don't overwrite its work
    saveBtn.textContent = "Changed elsewhere";
    saveBtn.title = `${err.message}. Copy anything you need from this window, then reload.`;
  }
}

// ── Line fit for any text ───────────────────────────────────
// A hidden copy of the page holds one bullet at the real width, so any
// wording can be graded without touching what's showing.
const measurer = document.createElement("article");
measurer.className = "paper st-measure";
measurer.setAttribute("aria-hidden", "true");
measurer.innerHTML = "<ul><li></li></ul>";
document.body.append(measurer);
const fits = new Map();
function fitOf(text) {
  if (!fits.has(text)) {
    const li = measurer.querySelector("li");
    li.textContent = text;
    fits.set(text, grade(measure(li)));
  }
  return fits.get(text);
}

// ── Which facts, which wordings ─────────────────────────────
/** What wordings are judged on: the job's keywords, or the bank's vocabulary. */
const terms = () => (posting ? posting.keywords : bank.vocabulary);
const lensNow = () => (posting ? posting.lens : state.lens);

/** How strongly a fact belongs on this page: the job's keywords first, or just the focus. */
function scorer() {
  if (!posting) return (b) => b.score[state.lens] || 0;
  const lens = posting.lens;
  const hits = new Map(allBullets().map(({ bullet }) => [bullet, relevance(bullet, posting).weight]));
  const most = Math.max(1, ...hits.values());
  // the posting's keywords lead, on a curve so a fact with half the best
  // match still scores well; the focus breaks ties and fills gaps
  return (b) => 7 * Math.sqrt(hits.get(b) / most) + 0.3 * (b.score[lens] || 0);
}
/** The wording a fact would show on this page. */
const textFor = (b, e) => (posting ? posting.draft[`${e.id}-${b.id}`] || rankWordings(b, posting.keywords, fitOf)[0].text : b.text);

/** Bullets and sections I've added or removed by hand: saved with the job, or kept for this session. */
function picks() {
  if (!posting) return focusPicks;
  posting.pin ??= [];
  posting.drop ??= [];
  posting.sections ??= {};
  posting.skills ??= { pin: [], drop: [], spoken: true };
  return posting;
}
/** Show a skill on this page (on) or leave it off, whatever its score says. */
function pickSkill(name, on) {
  const s = picks().skills;
  s.pin = s.pin.filter((n) => n !== name);
  s.drop = s.drop.filter((n) => n !== name);
  (on ? s.pin : s.drop).push(name);
  if (posting) (postingDirty = true), refreshSave();
  draw();
}
/** A skill the bank doesn't have yet: it joins the row (unscored) and goes on this page. */
function addSkill(row, name) {
  const r = bank.skills.find((x) => x.row === row);
  if (!name || bank.skills.some((x) => x.items.some(([n]) => n.toLowerCase() === name.toLowerCase()))) return;
  r.items.push([name, Object.fromEntries(bank.lenses.map((l) => [l.id, 0]))]);
  setDirty(true);
  pickSkill(name, true);
}
/** Switch a section on or off for this page, or back to auto (the usual rules). */
function setSection(key, mode) {
  const { sections } = picks();
  if (mode === "auto") delete sections[key];
  else sections[key] = mode;
  if (posting) (postingDirty = true), refreshSave();
  draw();
}
/** Put a fact on the page (on) or take it off, whatever the ranking says. */
function pick(key, on) {
  const p = picks();
  p.pin = p.pin.filter((k) => k !== key);
  p.drop = p.drop.filter((k) => k !== key);
  (on ? p.pin : p.drop).push(key);
  if (posting) (postingDirty = true), refreshSave();
  openWordings = null;
  draw();
}

function model(lines) {
  const { pin, drop, sections, skills } = picks();
  const opts = { ...state, lines, drafts: state.full || !!posting, pin: new Set(pin), drop: new Set(drop), sections, skills };
  if (posting) {
    opts.lens = posting.lens;
    opts.scoreOf = scorer();
    opts.textOf = textFor;
  }
  const m = compose(bank, opts);
  if (posting?.summary) m.summary = posting.summary;
  return m;
}

// ── Drawing ─────────────────────────────────────────────────
/** Is the page longer than one sheet (with its bottom margin)? */
const overflows = () => (paper.lastElementChild?.getBoundingClientRect().bottom ?? 0) > paper.getBoundingClientRect().top + 10.5 * 96;

let shownModel = null; // what draw() last put on the page
function draw() {
  // one page means one page: with long wordings, fit fewer bullets
  let lines = 16;
  renderPaper(paper, bank, (shownModel = model(lines)));
  while (!state.full && overflows() && lines > 8) renderPaper(paper, bank, (shownModel = model(--lines)));
  for (const el of paper.querySelectorAll("li[data-id], .r-summary")) {
    el.contentEditable = "plaintext-only";
    el.spellcheck = true;
  }
  drawKeys();
  regrade();
}

/** The job's keywords: on the page, in the bank but not on the page, or nowhere in the bank. */
function drawKeys() {
  const strip = $(".st-keys");
  strip.hidden = !posting;
  if (!posting) return;
  const page = paper.innerText; // with line breaks, so words at the end of a bullet stay whole
  const inBank = (k) => allBullets().some(({ bullet }) => relevance(bullet, { keywords: [k] }).weight);
  const chips = [...posting.keywords]
    .sort((a, b) => (b.weight || 1) - (a.weight || 1))
    .map((k) => {
      const on = [k.term, ...(k.synonyms || [])].some((s) => hasTerm(page, s));
      const cls = on ? "is-on" : inBank(k) ? "is-bank" : "is-none";
      const tip = on ? "on the page" : inBank(k) ? "in the bank, not on the page" : "nothing in the bank says this";
      return `<span class="st-key ${cls}" title="${tip}${k.synonyms?.length ? ` · also: ${esc(k.synonyms.join(", "))}` : ""}">${esc(k.term)}<i>${"•".repeat(k.weight || 1)}</i></span>`;
    })
    .join("");
  const sent = posting.sent ? ` · sent ${new Date(posting.sent.at).toLocaleDateString()}` : "";
  strip.innerHTML = `<p><b>${esc(posting.title)}</b> at ${esc(posting.company)}${sent}</p><div>${chips}</div>`;
}

/** The things graded: every bullet, and the summary. */
const graded = () => [...paper.querySelectorAll(".r-summary, li[data-id]")];
const keyOf = (el) => el.dataset.id || "summary";

let pending = 0;
function regrade() {
  // a short timer rather than an animation frame, so it still runs in a background tab
  clearTimeout(pending);
  pending = setTimeout(() => {
    const top = sheet.getBoundingClientRect().top;
    const marks = { spill: [], short: [] };
    const tally = { full: 0, short: 0, spill: 0 };
    gutter.innerHTML = "";
    for (const el of graded()) {
      const g = grade(measure(el));
      tally[g.grade]++;
      if (g.grade !== "full") {
        const r = lastLineRange(el);
        if (r) marks[g.grade].push(r);
      }
      gutter.append(chip(el, g, el.getBoundingClientRect().top - top));
    }
    if (window.CSS?.highlights) {
      CSS.highlights.set("st-spill", new Highlight(...marks.spill));
      CSS.highlights.set("st-short", new Highlight(...marks.short));
    }
    $(".st-tally").innerHTML = `<i class="is-full"></i>${tally.full} full <i class="is-short"></i>${tally.short} short <i class="is-spill"></i>${tally.spill} spill`;
    // does it still fit on one page?
    const pageEnd = paper.getBoundingClientRect().top + 11 * 96;
    const last = paper.lastElementChild?.getBoundingClientRect().bottom ?? 0;
    sheet.classList.toggle("is-over", last > pageEnd - 0.5 * 96);
    drawBench(pageEnd - 0.5 * 96 - last);
  }, 16);
}

// ── Skills: every skill in each row, on the page or not ────
/** Click a skill to put it on this page or take it off; type one in to add it to the bank. */
function drawSkills(box, lens) {
  const { skills: picked } = picks();
  const shown = new Map(shownModel.skills.map((r) => [r.row, new Set(r.items)]));
  const pill = (label, on, onClick, title) => {
    const b = button(label, onClick, `st-skill${on ? " is-on" : ""}`);
    b.title = title;
    return b;
  };
  for (const { row, items } of bank.skills) {
    const line = document.createElement("div");
    line.className = "st-skills__row";
    line.innerHTML = `<b>${esc(row)}</b>`;
    const on = shown.get(row) || new Set();
    for (const [name, score] of [...items].sort((a, b) => (b[1][lens] || 0) - (a[1][lens] || 0))) {
      const isOn = on.has(name);
      const why = picked.pin.includes(name) ? "added by hand" : picked.drop.includes(name) ? "removed by hand" : `${lens} ${score[lens] || 0}`;
      line.append(pill(name, isOn, () => pickSkill(name, !isOn), `${isOn ? "On the page" : "Off the page"} (${why}). Click to ${isOn ? "remove" : "add"}.`));
    }
    const input = document.createElement("input");
    input.className = "st-skills__add";
    input.placeholder = "+ new skill";
    input.addEventListener("keydown", (e) => e.key === "Enter" && addSkill(row, input.value.trim()));
    line.append(input);
    box.append(line);
  }
  const spoken = document.createElement("div");
  spoken.className = "st-skills__row";
  spoken.innerHTML = `<b>Spoken</b>`;
  spoken.append(
    pill(bank.spoken, picked.spoken !== false, () => {
      picked.spoken = picked.spoken === false;
      if (posting) (postingDirty = true), refreshSave();
      draw();
    }, "Click to show or leave off the Spoken row"),
  );
  box.append(spoken);
}

// ── The bench: facts that aren't on the page ───────────────
/** How many printed bullet lines fit in this much space (px), less one gap between bullets. */
function linesIn(px) {
  const li = paper.querySelector("li[data-id]");
  if (!li) return 0;
  const css = getComputedStyle(li);
  const line = parseFloat(css.lineHeight) || 18;
  const gap = (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
  return Math.max(0, Math.floor((px - gap) / line));
}

function drawBench(room) {
  const box = $(".st-bench");
  box.hidden = state.full; // the whole bank is already showing
  if (state.full) return;
  const free = linesIn(room);
  const onPage = new Set([...paper.querySelectorAll("li[data-id]")].map((li) => li.dataset.id));
  const { drop, sections } = picks();
  const match = scorer();
  const lens = lensNow();
  const strength = (b) => b.score[lens] || 0;
  const byMatch = posting && state.benchBy === "match";
  const list = allBullets()
    .filter(({ entry, bullet, key }) => !onPage.has(key) && (posting || !bullet.draft) && !(entry.optional === "healthcare" && !state.healthcare) && sections[entry.section] !== "off")
    .map((x) => {
      const text = textFor(x.bullet, x.entry);
      return { ...x, text, fit: fitOf(text), found: posting ? termsIn(text, posting.keywords).map((k) => k.term) : [] };
    })
    .sort((a, b) => (byMatch ? match(b.bullet) - match(a.bullet) : 0) || strength(b.bullet) - strength(a.bullet) || match(b.bullet) - match(a.bullet));

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const sorts = posting
    ? `<div class="st-seg">${[["match", "Job match"], ["strength", "Strength"]]
        .map(([k, label]) => `<button type="button" data-bench-by="${k}" aria-pressed="${state.benchBy === k}">${label}</button>`)
        .join("")}</div>`
    : "";
  box.innerHTML = `
    <div class="st-bench__head">
      <h2>Bench <span>${plural(list.length, "fact")} not on the page</span></h2>
      <p class="${free ? "has-room" : ""}">${free ? `about ${plural(free, "line")} free` : "the page is full"}</p>
      ${sorts}
      <button type="button" class="st-btn" data-new-fact>New fact</button>
    </div>
    <div class="st-sections"></div>
    <div class="st-skills"></div>
    <ol></ol>`;
  box.querySelectorAll("[data-bench-by]").forEach((b) => b.addEventListener("click", () => ((state.benchBy = b.dataset.benchBy), regrade())));

  // sections: auto follows the usual rules (and says what they decided); on or off overrides them
  const shown = new Set([...paper.querySelectorAll(".r-section h2")].map((h) => h.textContent));
  const row = box.querySelector(".st-sections");
  for (const [key, title] of SECTIONS.filter(([key]) => bank.entries.some((e) => e.section === key))) {
    const mode = sections[key] || "auto";
    const group = document.createElement("div");
    group.className = `st-section${shown.has(title) ? " is-shown" : ""}`;
    group.innerHTML = `<span>${title}${mode === "auto" ? `<i>${shown.has(title) ? "showing" : "hidden"}</i>` : ""}</span>`;
    const seg = document.createElement("div");
    seg.className = "st-seg";
    for (const m of ["auto", "on", "off"]) {
      const b = button(m[0].toUpperCase() + m.slice(1), () => setSection(key, m));
      b.setAttribute("aria-pressed", String(m === mode));
      seg.append(b);
    }
    group.append(seg);
    row.append(group);
  }
  drawSkills(box.querySelector(".st-skills"), lens);
  const ol = box.querySelector("ol");
  for (const x of list) {
    const fits = x.fit.lines <= free;
    const li = document.createElement("li");
    li.className = `is-${x.fit.grade}${fits ? " fits" : ""}`;
    const meta = [
      `${plural(x.fit.lines, "line")}${fits ? " · fits" : ""}`,
      `${lens} ${strength(x.bullet)}`,
      posting ? x.found.join(", ") || "no keywords" : "",
      drop.includes(x.key) ? "removed" : "",
      x.bullet.draft ? "draft" : "",
    ].filter(Boolean);
    li.innerHTML = `<p class="st-offers__grade">${esc(meta.join(" · "))}</p><p class="st-bench__text">${esc(x.text)}</p><p class="st-bench__where">${esc(x.entry.org)} · ${esc(x.entry.role)}</p>`;
    li.prepend(button("Add", () => pick(x.key, true), "st-bench__add"));
    ol.append(li);
  }
}

function button(label, onClick, cls = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

/** The gutter note beside one bullet: a bar colored by its line fit, its keywords, and its wordings. */
function chip(el, g, y) {
  const key = keyOf(el);
  const box = document.createElement("div");
  box.className = `st-chip is-${g.grade}`;
  box.style.top = `${y}px`;
  box.style.minHeight = `${el.getBoundingClientRect().height - 4}px`; // the bar runs the bullet's height, with a gap before the next
  if (key === "summary") return box;

  const { bullet } = bulletOf(key);
  // one row, so a chip is never taller than a one-line bullet: buttons, then the job's keywords it hits
  const row = document.createElement("p");
  row.className = "st-chip__ask";
  const n = bullet.wordings.length;
  row.append(button(`${n} wording${n === 1 ? "" : "s"}`, () => ((openWordings = openWordings === key ? null : key), regrade()), openWordings === key ? "is-open" : ""));
  row.append(button(picks().pin.includes(key) ? "Remove (added)" : "Remove", () => pick(key, false), "st-chip__remove"));
  const found = posting ? termsIn(el.textContent, posting.keywords).map((k) => k.term).join(" · ") : "";
  if (found) row.insertAdjacentHTML("beforeend", `<span class="st-chip__terms" title="${esc(found)}">${esc(found)}</span>`);
  box.append(row);

  if (openWordings === key) box.append(wordingList(el, bullet));
  return box;
}

// ── Wordings ────────────────────────────────────────────────
/** Put a wording on the page: the bank's default in focus mode, this job's draft otherwise. */
function use(el, text, source) {
  const key = keyOf(el);
  const { bullet } = bulletOf(key);
  keepWording(bullet, text, source);
  if (posting) {
    posting.draft[key] = text;
    postingDirty = true;
  } else bullet.text = text;
  setDirty(true);
  draw();
}

/** Every wording of a bullet, ranked for what's on screen (the job, or the bank's vocabulary). */
function wordingList(el, bullet) {
  const shown = el.textContent.replace(/\s+/g, " ").trim();
  const ranked = rankWordings(bullet, terms(), fitOf);
  const list = document.createElement("ol");
  list.className = "st-offers st-wordings";
  list.insertAdjacentHTML(
    "beforeend",
    `<p class="st-wordings__head">Ranked by ${posting ? "this job's keywords" : "keywords"}, then line fit${bullet.draft ? " · <em>draft: not on the public page</em>" : ""}</p>`,
  );
  ranked.forEach((w, i) => {
    const li = document.createElement("li");
    li.className = `is-${w.fit.grade}${w.text === shown ? " is-current" : ""}${w.coveredBy ? " is-covered" : ""}`;
    const meta = [
      `${w.fit.lines} · ${Math.round(w.fit.fill * 100)}%`,
      w.terms.length ? w.terms.join(", ") : "no keywords",
      w.used ? `sent ${w.used}×` : "",
      w.source,
      w.coveredBy ? `covered by #${ranked.findIndex((x) => x.text === w.coveredBy) + 1}` : "",
      w.text === shown ? "on the page" : "",
    ].filter(Boolean);
    const pick = button("", () => use(el, w.text, w.source));
    pick.innerHTML = `<span class="st-offers__grade">#${i + 1} · ${esc(meta.join(" · "))}</span>`;
    pick.append(w.text);
    li.append(pick);
    if (w.text !== shown && bullet.wordings.length > 1)
      li.append(
        button("×", () => {
          bullet.wordings = bullet.wordings.filter((x) => x.text !== w.text);
          setDirty(true);
          regrade();
        }, "st-wordings__drop"),
      );
    list.append(li);
  });
  if (bullet.draft) {
    const scored = Object.values(bullet.score).some((n) => n > 0);
    const pub = button(scored ? "Put it on the public page" : "Tag the bank first to score it", () => {
      delete bullet.draft;
      setDirty(true);
      draw();
    }, "st-offers__none");
    pub.disabled = !scored;
    list.append(pub);
  }
  return list;
}

// ── Asking Claude ───────────────────────────────────────────
/**
 * Ask Claude to do a task. With the API it answers straight away; in queue
 * mode the request waits in resumes/engine/queue/ until Claude Code writes
 * the answer, so check every few seconds.
 */
async function ask(task, input) {
  const r = await api("/llm", { method: "POST", body: JSON.stringify({ task, input }) });
  if (r.result) return (usage(), r.result);
  return new Promise((done) => {
    const poll = setInterval(async () => {
      const p = await api(`/llm/${r.id}`).catch(() => null);
      if (!p || p.pending) return;
      clearInterval(poll);
      usage();
      done(p.result);
    }, 2500);
  });
}

async function usage() {
  const u = await api("/usage").catch(() => null);
  if (!u) return;
  const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n);
  $(".st-usage").textContent = `Claude (${u.mode}): ${u.total.calls} calls · ${k(u.total.input)} in · ${k(u.total.output)} out`;
}

// ── Tagging (once for the bank, then for new facts) ─────────
function refreshTagButton() {
  const untagged = allBullets().filter(({ bullet }) => !bullet.tags?.length);
  const btn = $("[data-tag]");
  btn.hidden = !untagged.length;
  btn.textContent = `Tag ${untagged.length} fact${untagged.length === 1 ? "" : "s"}`;
  return untagged;
}

async function tagBank() {
  const untagged = refreshTagButton();
  const btn = $("[data-tag]");
  btn.disabled = true;
  btn.textContent = "Tagging…";
  const facts = untagged.map(({ entry, bullet, key }) => ({
    id: key,
    where: `${entry.role}, ${entry.org}`,
    wordings: bullet.wordings.map((w) => w.text),
    score: !Object.values(bullet.score).some((n) => n > 0),
  }));
  const result = await ask("tag", { lenses: bank.lenses, facts });
  for (const [key, r] of Object.entries(result)) {
    const { bullet } = bulletOf(key);
    if (!bullet) continue;
    bullet.tags = r.tags || [];
    if (r.score) bullet.score = { ...bullet.score, ...r.score };
  }
  btn.disabled = false;
  setDirty(true);
  await save();
  refreshTagButton();
  draw();
}

// ── Jobs ────────────────────────────────────────────────────
function drawPostingSelect() {
  const sel = $("[data-posting]");
  sel.innerHTML =
    `<option value="">None: use the focus</option>` +
    postings.map((p) => `<option value="${p.id}">${esc(p.company)} · ${esc(p.title)}${p.sent ? " (sent)" : ""}</option>`).join("") +
    `<option value="new">New job description…</option>`;
  sel.value = posting?.id || "";
}

async function choosePosting(id) {
  if (postingDirty) await save();
  posting = postings.find((p) => p.id === id) || null;
  openWordings = null;
  document.body.classList.toggle("has-posting", !!posting);
  $("[data-lens]").value = posting ? posting.lens : state.lens;
  $("[data-sent]").hidden = !posting;
  $("[data-sent]").textContent = posting?.sent ? "Sent ✓ (send again)" : "I sent this";
  drawPostingSelect();
  draw();
}

async function readPosting(text) {
  const dialog = $(".st-job");
  dialog.querySelector("[data-read]").disabled = true;
  dialog.querySelector(".st-dialog__status").textContent = "Claude is reading it…";
  const r = await ask("posting", { text, lenses: bank.lenses });
  const p = {
    id: `${new Date().toISOString().slice(0, 10)}-${(r.company || "job").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`,
    created: new Date().toISOString(),
    company: r.company || "Unknown company",
    title: r.title || "Untitled role",
    lens: bank.lenses.some((l) => l.id === r.lens) ? r.lens : "best",
    keywords: r.keywords || [],
    text,
    draft: {},
    sent: null,
  };
  await api(`/postings/${p.id}`, { method: "PUT", body: JSON.stringify(p) });
  postings.unshift(p);
  dialog.close();
  await choosePosting(p.id);
}

/** Record what went out: each line's wording counts as sent once more. */
async function markSent() {
  const lines = [...paper.querySelectorAll("li[data-id]")].map((li) => ({ key: li.dataset.id, text: li.textContent.replace(/\s+/g, " ").trim() }));
  for (const { key, text } of lines) {
    const { bullet } = bulletOf(key);
    keepWording(bullet, text, "studio");
    const w = bullet.wordings.find((x) => x.text === text);
    w.used = (w.used || 0) + 1;
  }
  posting.sent = { at: new Date().toISOString(), summary: paper.querySelector(".r-summary")?.textContent.trim(), lines };
  postingDirty = true;
  setDirty(true);
  await save();
  await choosePosting(posting.id);
}

// ── Editing ─────────────────────────────────────────────────
paper.addEventListener("input", (e) => {
  const el = e.target.closest("li[data-id], .r-summary");
  if (!el) return;
  const text = el.textContent.replace(/\s+/g, " ").trim();
  if (el.matches(".r-summary")) {
    if (posting) (posting.summary = text), (postingDirty = true);
    else bank.summary[state.lens] = text;
  } else if (posting) {
    posting.draft[el.dataset.id] = text;
    postingDirty = true;
  } else bulletOf(el.dataset.id).bullet.text = text;
  setDirty(true);
  regrade();
});
// a bullet is one line of text: Enter finishes editing instead of splitting it
paper.addEventListener("keydown", (e) => {
  if (e.key === "Enter") (e.preventDefault(), e.target.blur());
});
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") (e.preventDefault(), save());
});
window.addEventListener("beforeunload", (e) => (dirty || postingDirty) && e.preventDefault());
window.addEventListener("resize", regrade);
saveBtn.addEventListener("click", save);
// printing: just the page, without the marks
window.addEventListener("beforeprint", () => CSS.highlights?.clear());
window.addEventListener("afterprint", regrade);

// ── Controls ────────────────────────────────────────────────
function controls() {
  const lens = $("[data-lens]");
  lens.innerHTML = bank.lenses.map((l) => `<option value="${l.id}">${l.label}</option>`).join("");
  lens.addEventListener("change", () => {
    if (posting) (posting.lens = lens.value), (postingDirty = true), setDirty(dirty);
    else state.lens = lens.value;
    draw();
  });
  document.querySelectorAll("[data-length]").forEach((b) =>
    b.addEventListener("click", () => {
      state.full = b.dataset.length === "full";
      document.querySelectorAll("[data-length]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      draw();
    }),
  );
  $("[data-healthcare]").addEventListener("change", (e) => ((state.healthcare = e.target.checked), draw()));
  $("[data-posting]").addEventListener("change", (e) => {
    if (e.target.value !== "new") return choosePosting(e.target.value);
    e.target.value = posting?.id || "";
    const dialog = $(".st-job");
    dialog.querySelector("textarea").value = "";
    dialog.querySelector("[data-read]").disabled = false;
    dialog.querySelector(".st-dialog__status").textContent = "";
    dialog.showModal();
  });
  $("[data-read]").addEventListener("click", () => {
    const text = $(".st-job textarea").value.trim();
    if (text.length > 80) readPosting(text);
  });
  $("[data-cancel]").addEventListener("click", () => $(".st-job").close());
  $("[data-tag]").addEventListener("click", tagBank);
  $("[data-sent]").addEventListener("click", () => {
    if (confirm(`Record this page as sent to ${posting.company}?`)) markSent();
  });
  $("[data-print]").addEventListener("click", () => window.print());
  newFactControls();
}

// ── New facts, typed in (no old résumé needed) ──────────────
function openNewFact() {
  const dialog = $(".st-newfact");
  const sel = dialog.querySelector("[data-nf-entry]");
  sel.innerHTML =
    SECTIONS.map(([key, title]) => {
      const list = bank.entries.filter((e) => e.section === key);
      return list.length ? `<optgroup label="${title}">${list.map((e) => `<option value="${e.id}">${esc(e.org)} · ${esc(e.role)}</option>`).join("")}</optgroup>` : "";
    }).join("") + `<option value="new">New job, project, or certification…</option>`;
  for (const el of dialog.querySelectorAll("input, textarea")) el.value = "";
  dialog.querySelector("[data-nf-new]").hidden = true;
  dialog.querySelector(".st-dialog__status").textContent = "";
  dialog.showModal();
}

async function addNewFact() {
  const dialog = $(".st-newfact");
  const val = (sel) => dialog.querySelector(sel).value.trim();
  const status = (msg) => (dialog.querySelector(".st-dialog__status").textContent = msg);
  const text = val("[data-nf-text]").replace(/\s+/g, " ");
  let entry;
  if (val("[data-nf-entry]") === "new") {
    const section = val("[data-nf-section]");
    if (!val("[data-nf-org]")) return status("Give it a name.");
    if (!text && section !== "certifications") return status("Write the bullet. Only a certification can go without one.");
    entry = { id: slug(val("[data-nf-org]"), new Set(bank.entries.map((e) => e.id))), section, org: val("[data-nf-org]"), role: val("[data-nf-role]"), when: val("[data-nf-when]") };
    if (val("[data-nf-where]")) entry.where = val("[data-nf-where]");
    Object.assign(entry, { max: 2, bullets: [] });
    bank.entries.push(entry);
  } else {
    if (!text) return status("Write the bullet.");
    entry = bank.entries.find((e) => e.id === val("[data-nf-entry]"));
  }
  if (text) {
    const id = slug(text, new Set(entry.bullets.map((b) => b.id)));
    const blank = Object.fromEntries(bank.lenses.map((l) => [l.id, 0]));
    entry.bullets.push({ id, text, score: blank, tags: [], wordings: [{ text, source: "studio" }], draft: true });
    // put it on the page I'm working on, whatever its (not yet scored) rank
    const p = picks();
    p.pin.push(`${entry.id}-${id}`);
    if (posting) postingDirty = true;
  }
  dialog.close();
  setDirty(true);
  await save();
  refreshTagButton();
  draw();
}

function newFactControls() {
  const dialog = $(".st-newfact");
  dialog.querySelector("[data-nf-entry]").addEventListener("change", (e) => (dialog.querySelector("[data-nf-new]").hidden = e.target.value !== "new"));
  dialog.querySelector("[data-nf-add]").addEventListener("click", addNewFact);
  dialog.querySelector("[data-nf-cancel]").addEventListener("click", () => dialog.close());
  // the bench is redrawn often, so its New fact button is handled here
  $(".st-bench").addEventListener("click", (e) => e.target.closest("[data-new-fact]") && openNewFact());
}

// ── Page or review ──────────────────────────────────────────
const review = mountReview({
  root: $(".st-review"),
  api,
  bank: () => bank,
  ask,
  changed: async () => {
    setDirty(true);
    await save();
    refreshTagButton();
  },
});
document.querySelectorAll("button[data-view]").forEach((b) =>
  b.addEventListener("click", () => {
    const view = b.dataset.view;
    document.querySelectorAll("button[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.body.dataset.view = view;
    if (view === "review") review.load();
    else draw();
  }),
);

({ bank, version } = await api("/bank"));
postings = await api("/postings");
controls();
drawPostingSelect();
refreshTagButton();
await document.fonts.ready; // measure only once the real font is in
draw();
usage();
