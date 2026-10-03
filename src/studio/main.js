import { compose, renderPaper } from "../resume/paper.js";
import { measure, grade, lastLineRange } from "../resume/linefit.js";
import { rankWordings, relevance, termsIn, hasTerm } from "../resume/wordings.js";
import { mountReview } from "./review.js";

// The résumé studio: my private editor for the bank. The page is drawn at
// exactly 8.5 inches, so every line breaks where it will when printed.
//   Focus mode    edit the bank itself: the wordings the public page shows
//   A job         paste a job description; Claude reads its keywords, the
//                 facts that answer it rise, and each one shows its best
//                 wording for that posting. Edits become new wordings, and
//                 "I sent this" records what went out.
// The gutter grades how well each bullet fills its lines, opens every
// wording I've written for a bullet (ranked), and asks Claude for shorter
// or longer ones that keep every fact.

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
const state = { lens: "best", full: false, healthcare: true };
let postings = [];
let posting = null; // the job description being drafted for, if any
let dirty = false;
let postingDirty = false;
let openWordings = null; // the bullet whose wordings are showing
const asks = new Map(); // data-id → { goal, id } while Claude is working, or { goal, variants } once it answers

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

function model(lines) {
  const opts = { ...state, lines, drafts: state.full || !!posting };
  if (posting) {
    const lens = posting.lens;
    const hits = new Map(allBullets().map(({ bullet }) => [bullet, relevance(bullet, posting).weight]));
    const most = Math.max(1, ...hits.values());
    // the posting's keywords lead, on a curve so a fact with half the best
    // match still scores well; the focus breaks ties and fills gaps
    opts.lens = lens;
    opts.scoreOf = (b) => 7 * Math.sqrt(hits.get(b) / most) + 0.3 * (b.score[lens] || 0);
    opts.textOf = (b, e) => posting.draft[`${e.id}-${b.id}`] || rankWordings(b, posting.keywords, fitOf)[0].text;
  }
  const m = compose(bank, opts);
  if (posting?.summary) m.summary = posting.summary;
  return m;
}

// ── Drawing ─────────────────────────────────────────────────
/** Is the page longer than one sheet (with its bottom margin)? */
const overflows = () => (paper.lastElementChild?.getBoundingClientRect().bottom ?? 0) > paper.getBoundingClientRect().top + 10.5 * 96;

function draw() {
  // one page means one page: with long wordings, fit fewer bullets
  let lines = 16;
  renderPaper(paper, bank, model(lines));
  while (!state.full && overflows() && lines > 8) renderPaper(paper, bank, model(--lines));
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
  }, 16);
}

const LABEL = { full: "fills its line", short: "room on the last line", spill: "spills" };

function button(label, onClick, cls = "") {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener("click", onClick);
  return b;
}

/** The gutter note beside one bullet: its grade, what to do, its wordings, and Claude's offers. */
function chip(el, g, y) {
  const key = keyOf(el);
  const box = document.createElement("div");
  box.className = `st-chip is-${g.grade}`;
  box.style.top = `${y}px`;
  const fillBar = `<span class="st-chip__bar"><b style="width:${Math.round(g.fill * 100)}%"></b></span>`;
  let advice = "";
  if (g.grade === "spill") advice = `cut ${g.cut} or add ${g.add}`;
  else if (g.grade === "short") advice = `add ${g.add} or cut ${g.cut}`;
  box.innerHTML = `
    <p class="st-chip__head">${fillBar}<span>${g.lines} line${g.lines === 1 ? "" : "s"} · ${LABEL[g.grade]}</span></p>
    ${advice ? `<p class="st-chip__advice">${advice}</p>` : ""}`;
  if (key === "summary") return box;

  const { bullet } = bulletOf(key);
  if (posting) {
    const found = termsIn(el.textContent, posting.keywords).map((k) => k.term);
    if (found.length) box.insertAdjacentHTML("beforeend", `<p class="st-chip__terms">${found.map(esc).join(" · ")}</p>`);
  }

  const row = document.createElement("p");
  row.className = "st-chip__ask";
  const n = bullet.wordings.length;
  row.append(button(`${n} wording${n === 1 ? "" : "s"}`, () => ((openWordings = openWordings === key ? null : key), regrade()), openWordings === key ? "is-open" : ""));
  const ask = asks.get(key);
  if (ask?.id) row.insertAdjacentHTML("beforeend", `<span class="st-wait">asking Claude for a ${ask.goal === "cut" ? "shorter" : "longer"} wording…</span>`);
  else if (g.grade !== "full") for (const goal of ["cut", "add"]) row.append(button(goal === "cut" ? "Shorter" : "Longer", () => askFit(el, g, goal)));
  box.append(row);

  if (openWordings === key) box.append(wordingList(el, bullet));
  if (ask?.variants) box.append(offerList(el, ask.variants));
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

async function askFit(el, g, goal) {
  const key = keyOf(el);
  const { entry, bullet } = bulletOf(key);
  const text = el.textContent.replace(/\s+/g, " ").trim();
  const len = text.length;
  const [min, max] = goal === "cut" ? [len - g.cut - 22, len - g.cut - 2] : [len + g.add - 18, len + g.add - 2];
  const input = { text, goal, min, max, role: `${entry.role}, ${entry.org}`, siblings: entry.bullets.filter((b) => b !== bullet).map((b) => b.text) };
  // with a job open, the wording has to keep the job's keywords it already has
  if (posting) input.keep = termsIn(text, posting.keywords).map((k) => k.term);
  asks.set(key, { goal, id: true });
  regrade();
  asks.set(key, { goal, variants: await ask("fit", input) });
  regrade();
}

/** Claude's wordings, each measured on the real page before you pick one. */
function offerList(el, variants) {
  const list = document.createElement("ol");
  list.className = "st-offers";
  for (const text of variants) {
    const g = fitOf(text);
    const li = document.createElement("li");
    li.className = `is-${g.grade}`;
    const pick = button("", () => {
      asks.delete(keyOf(el));
      use(el, text, "claude");
    });
    pick.innerHTML = `<span class="st-offers__grade">${g.lines} · ${Math.round(g.fill * 100)}%</span>`;
    pick.append(text);
    li.append(pick);
    list.append(li);
  }
  list.append(button("None of these", () => (asks.delete(keyOf(el)), regrade()), "st-offers__none"));
  return list;
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
  const dialog = $(".st-dialog");
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
  asks.delete(keyOf(el));
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
    const dialog = $(".st-dialog");
    dialog.querySelector("textarea").value = "";
    dialog.querySelector("[data-read]").disabled = false;
    dialog.querySelector(".st-dialog__status").textContent = "";
    dialog.showModal();
  });
  $("[data-read]").addEventListener("click", () => {
    const text = $(".st-dialog textarea").value.trim();
    if (text.length > 80) readPosting(text);
  });
  $("[data-cancel]").addEventListener("click", () => $(".st-dialog").close());
  $("[data-tag]").addEventListener("click", tagBank);
  $("[data-sent]").addEventListener("click", () => {
    if (confirm(`Record this page as sent to ${posting.company}?`)) markSent();
  });
  $("[data-print]").addEventListener("click", () => window.print());
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
