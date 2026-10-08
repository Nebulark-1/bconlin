// Phase 2, the review: every bullet from my old résumés, sorted by Claude
// into facts. A fact the bank already has offers its old wordings as more
// wordings; a new fact can join the bank as a draft (off the public page
// until I publish it). Decisions are saved as they're made; the ones
// Claude made say why.

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const slug = (text, taken) => {
  const base = text.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 3).slice(0, 2).join("") || "line";
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}${n}`;
  return id;
};

/**
 * root: the review panel. api: the studio's fetch helper. bank(): the
 * studio's working bank. changed(): call after changing the bank (saves it).
 * ask(task, input): asks Claude and resolves with the result.
 */
export function mountReview({ root, api, bank, changed, ask }) {
  let data = null;

  const saveMined = () => api("/mined", { method: "PUT", body: JSON.stringify({ made: data.made, mined: data.mined, sort: data.sort }) });
  const lineOf = (id) => data.mined.find((m) => m.id === id);

  async function load() {
    data = await api("/mined");
    draw();
  }

  async function dig() {
    root.innerHTML = `<p class="rv-wait">Reading the old résumés…</p>`;
    data = await api("/mined/dig", { method: "POST" });
    draw();
  }

  async function sort() {
    const b = bank();
    const input = {
      entries: b.entries.map((e) => ({ id: e.id, org: e.org, role: e.role })),
      bank: b.entries.flatMap((e) => e.bullets.map((x) => ({ id: `${e.id}-${x.id}`, entry: e.id, text: x.text }))),
      lines: data.mined.map((m) => ({ id: m.id, text: m.text, heading: m.heading })),
    };
    root.querySelector("[data-sort]").outerHTML = `<p class="rv-wait st-wait">Asking Claude to sort ${input.lines.length} lines…</p>`;
    const sorted = await ask("sort", input);
    for (const f of sorted.facts) f.status = "open";
    data.sort = sorted;
    await saveMined();
    draw();
  }

  /** Every wording of a fact: its lines' text plus their variations, newest first, no repeats. */
  const wordingsOf = (fact) => [...new Set(fact.lines.flatMap((id) => lineOf(id)?.wordings || []))];

  function bulletFor(match) {
    if (!match) return null;
    const cut = match.indexOf("-");
    const entry = bank().entries.find((e) => e.id === match.slice(0, cut));
    return entry && { entry, bullet: entry.bullets.find((b) => b.id === match.slice(cut + 1)) };
  }

  function entryFor(key) {
    const b = bank();
    if (!key.startsWith("new:")) return b.entries.find((e) => e.id === key);
    const id = key.slice(4);
    let entry = b.entries.find((e) => e.id === id);
    if (!entry) {
      const info = data.sort.newEntries?.[id] || { org: id, role: "", when: "", section: "experience" };
      entry = { id, section: info.section, org: info.org, role: info.role, when: info.when, max: 2, bullets: [] };
      b.entries.push(entry);
    }
    return entry;
  }

  async function decide(fact, action, pick) {
    if (action === "wordings") {
      const { bullet } = bulletFor(fact.match);
      for (const text of wordingsOf(fact)) if (!bullet.wordings.some((w) => w.text === text)) bullet.wordings.push({ text, source: "résumé" });
    } else if (action === "add") {
      const entry = entryFor(fact.entry);
      const taken = new Set(entry.bullets.map((b) => b.id));
      const blank = Object.fromEntries(bank().lenses.map((l) => [l.id, 0]));
      const wordings = [pick, ...wordingsOf(fact).filter((w) => w !== pick)].map((text) => ({ text, source: "résumé" }));
      entry.bullets.push({ id: slug(pick, taken), text: pick, score: blank, tags: [], wordings, draft: true });
    }
    fact.status = action === "skip" ? "skipped" : "added";
    if (action !== "skip") await changed();
    await saveMined();
    draw();
  }

  function draw() {
    if (!data.mined.length) {
      root.innerHTML = `<div class="rv-start"><p>Nothing dug up yet.</p><button type="button" class="st-save" data-dig>Read my old résumés</button></div>`;
      root.querySelector("[data-dig]").addEventListener("click", dig);
      return;
    }
    const files = new Set(data.mined.flatMap((m) => m.files)).size;
    const head = `<header class="rv-head"><h2>From your old résumés</h2><p>${data.mined.length} distinct lines from ${files} files.</p></header>`;
    if (!data.sort) {
      root.innerHTML = `${head}<button type="button" class="st-save" data-sort>Sort them with Claude</button>
        <ol class="rv-raw">${data.mined.map((m) => `<li>${esc(m.text)}</li>`).join("")}</ol>`;
      root.querySelector("[data-sort]").addEventListener("click", sort);
      return;
    }

    const facts = data.sort.facts;
    const open = facts.filter((f) => f.status === "open").length;
    const b = bank();
    // group facts under their entry: the bank's entries first, then new ones
    const keys = [...new Set([...b.entries.map((e) => e.id), ...facts.map((f) => f.entry)])].filter((k) => facts.some((f) => f.entry === k));
    const decided = facts.length - open;
    root.innerHTML = `${head.replace("</p>", ` ${facts.length} facts; ${open} still to decide.</p>`)}
      ${keys.map((key) => section(key, facts.filter((f) => f.entry === key && f.status === "open"))).join("")}
      <details class="rv-decided"><summary>${decided} already decided (${facts.filter((f) => f.decidedBy === "claude").length} by Claude)</summary>
        ${keys.map((key) => section(key, facts.filter((f) => f.entry === key && f.status !== "open"))).join("")}</details>
      <details class="rv-other"><summary>${data.sort.other.length} lines that aren't bullets (skills lists, coursework, headings)</summary>
        <ul>${data.sort.other.map((id) => `<li>${esc(lineOf(id)?.text)}</li>`).join("")}</ul></details>`;

    root.querySelectorAll("[data-act]").forEach((btn) =>
      btn.addEventListener("click", () => decide(facts[Number(btn.dataset.fact)], btn.dataset.act, btn.dataset.pick && wordingsOf(facts[Number(btn.dataset.fact)])[Number(btn.dataset.pick)])),
    );
  }

  function section(key, list) {
    if (!list.length) return "";
    const existing = bank().entries.find((e) => e.id === key.replace(/^new:/, ""));
    const info = existing || data.sort.newEntries?.[key.slice(4)] || { org: key };
    const tag = key.startsWith("new:") && !existing ? `<em class="rv-new">new</em>` : "";
    const facts = data.sort.facts;
    return `<section class="rv-entry"><h3>${esc(info.org)} ${tag}<small>${esc(info.role)}</small></h3>
      ${list.map((f) => card(f, facts.indexOf(f))).join("")}</section>`;
  }

  function card(fact, i) {
    const words = wordingsOf(fact);
    const files = [...new Set(fact.lines.flatMap((id) => lineOf(id)?.files || []))];
    const from = `<p class="rv-from">${fact.note ? `${esc(fact.note)} · ` : ""}in ${files.length} résumé${files.length === 1 ? "" : "s"}</p>`;
    if (fact.status !== "open") {
      const who = fact.decidedBy === "claude" ? `<p class="rv-why">Claude: ${esc(fact.why)}</p>` : "";
      return `<article class="rv-card is-done">${from}<p class="rv-done">${fact.status === "skipped" ? "Skipped" : "Added"}: ${esc(words[0])}</p>${who}</article>`;
    }

    const match = bulletFor(fact.match);
    if (match?.bullet) {
      const have = new Set(match.bullet.wordings.map((w) => w.text));
      const fresh = words.filter((w) => !have.has(w));
      return `<article class="rv-card">
        ${from}
        <p class="rv-bank"><b>In the bank</b>${esc(match.bullet.text)}</p>
        ${fresh.length ? `<ul class="rv-words">${fresh.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : `<p class="rv-from">Every wording is already in the bank.</p>`}
        <div class="rv-actions">
          ${fresh.length ? `<button type="button" data-act="wordings" data-fact="${i}">Keep ${fresh.length === 1 ? "it" : `all ${fresh.length}`} as other wordings</button>` : ""}
          <button type="button" class="is-quiet" data-act="skip" data-fact="${i}">Skip</button>
        </div></article>`;
    }
    return `<article class="rv-card is-new">
      ${from}
      <ul class="rv-words">${words.map((w, k) => `<li><button type="button" data-act="add" data-fact="${i}" data-pick="${k}" title="Add this wording to the bank">${esc(w)}</button></li>`).join("")}</ul>
      <div class="rv-actions"><span>Pick a wording to add it.</span><button type="button" class="is-quiet" data-act="skip" data-fact="${i}">Skip</button></div>
    </article>`;
  }

  return { load };
}
