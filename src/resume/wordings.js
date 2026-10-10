// A bullet is one fact with any number of wordings. The fact decides
// whether it belongs on a page; the wording is chosen for the page on
// substance:
//   1. keywords first: the terms a job description asks for (or, with no
//      job description, the bank's vocabulary), found literally in the text,
//      because applicant tracking systems match words
//   2. then fewer problems (see substance below)
//   3. then more of the fact's numbers: results beat descriptions
//   4. then how often I've sent it
// A wording another one beats on every count (every keyword and number it
// has, no more problems, and more of something) is "covered" and never
// chosen, though it's kept. How long a wording runs is my call: I delete
// the ones whose length I don't like.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = new Map();
/** Does text contain this term as a whole word or phrase (any case)? */
export function hasTerm(text, term) {
  const key = term.toLowerCase();
  if (!wordRe.has(key)) wordRe.set(key, new RegExp(`(^|[^a-z0-9+#])${escapeRe(key)}($|[^a-z0-9+#])`, "i"));
  return wordRe.get(key).test(text);
}

/** Which of these terms ([{ term, synonyms, weight }]) appear in text. */
export function termsIn(text, terms) {
  return terms.filter((k) => [k.term, ...(k.synonyms || [])].some((s) => hasTerm(text, s)));
}

// ── Substance ───────────────────────────────────────────────
/** The numbers a wording claims ("8,000+", "10k", "$1M", "82%", "half"), normalized so "10000", "10,000+", and "10k" match. */
export function numbersIn(text) {
  const found = text.match(/\$?\d[\d,]*(\.\d+)?[km]?\+?%?(?![a-z])|\b(half|twice|doubled?|tripled?)\b/gi) || [];
  const scale = { k: 1e3, m: 1e6 };
  const norm = (n) => n.toLowerCase().replace(/[,+]/g, "").replace(/^(\$?)([\d.]+)([km])/, (_, $, d, u) => $ + Math.round(parseFloat(d) * scale[u]));
  return [...new Set(found.map(norm))];
}

// words my résumé never uses, and marks of a wording that isn't finished
const BANNED = [
  [/\bleverag(e|ed|es|ing)\b/i, "leveraging"],
  [/\bspearhead(ed|ing|s)?\b/i, "spearheaded"],
  [/\bsynerg/i, "synergy"],
  [/\butiliz(e|ed|es|ing)\b/i, "utilize"],
];
/**
 * What's wrong with a wording, next to the fact's other wordings:
 *   drops    numbers another wording of the same fact has and this one doesn't
 *   flags    a banned word, an em dash, or a trailing period
 */
export function substance(text, others = []) {
  const mine = new Set(numbersIn(text));
  const drops = [...new Set(others.filter((o) => o !== text).flatMap(numbersIn))].filter((n) => !mine.has(n));
  const flags = BANNED.filter(([re]) => re.test(text)).map(([, word]) => word);
  if (text.includes("—")) flags.push("em dash");
  if (/\.\s*$/.test(text)) flags.push("ends in a period");
  return { numbers: [...mine], drops, flags };
}

/**
 * Every wording of a bullet, best first.
 * terms: what to look for.
 * Returns [{ text, source, used, terms, weight, numbers, drops, flags, coveredBy }].
 */
export function rankWordings(bullet, terms) {
  const texts = bullet.wordings.map((w) => w.text);
  const list = bullet.wordings.map((w) => {
    const found = termsIn(w.text, terms);
    return { ...w, used: w.used || 0, terms: found.map((k) => k.term), weight: found.reduce((n, k) => n + (k.weight || 1), 0), ...substance(w.text, texts) };
  });
  // covered: another wording has every term and number this one has, no more problems, and more of something
  for (const a of list) {
    a.coveredBy = list.find((b) => {
      if (b === a || b.flags.length > a.flags.length) return false;
      const bt = new Set(b.terms);
      const bn = new Set(b.numbers);
      if (!a.terms.every((t) => bt.has(t)) || !a.numbers.every((n) => bn.has(n))) return false;
      return bt.size > a.terms.length || bn.size > a.numbers.length || b.flags.length < a.flags.length;
    })?.text;
  }
  return list.sort(
    (a, b) =>
      !!a.coveredBy - !!b.coveredBy ||
      b.weight - a.weight ||
      a.flags.length - b.flags.length ||
      b.numbers.length - a.numbers.length ||
      b.used - a.used,
  );
}

/**
 * How well a fact answers a job description: the weight of the posting's
 * keywords found in any of its wordings or its tags.
 */
export function relevance(bullet, posting) {
  const text = bullet.wordings.map((w) => w.text).join(" | ");
  const tags = (bullet.tags || []).join(" | ");
  const found = posting.keywords.filter((k) => [k.term, ...(k.synonyms || [])].some((s) => hasTerm(text, s) || hasTerm(tags, s)));
  return { weight: found.reduce((n, k) => n + (k.weight || 1), 0), terms: found.map((k) => k.term) };
}

// ── Learning from my picks ──────────────────────────────────
/** How alike two job descriptions are, 0 to about 1.25: the keywords they share, and their focus. */
export function similarity(a, b) {
  const words = (p) => new Set((p.keywords || []).flatMap((k) => [k.term, ...(k.synonyms || [])]).map((w) => w.toLowerCase()));
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  const jaccard = shared / Math.max(1, new Set([...wa, ...wb]).size);
  return Math.min(1, jaccard * 3) + (a.lens && a.lens === b.lens ? 0.25 : 0);
}

/**
 * What my adds and removes on other jobs say about each fact for this one.
 * Every other job at least a quarter alike votes: +1 for a fact I added
 * there, -1 for one I removed, weighted by how much that job looks like this
 * one (a software role says little about an IT support one). Returns a Map
 * of "entry-bullet" → { lean (-1 to 1), jobs (how many voted) }.
 */
export const ALIKE = 0.25;
export function learned(posting, postings) {
  const votes = new Map();
  for (const other of postings) {
    if (other.id === posting.id) continue;
    const w = similarity(posting, other);
    if (w < ALIKE) continue;
    for (const [list, sign] of [[other.pin || [], 1], [other.drop || [], -1]])
      for (const key of list) {
        const v = votes.get(key) || { sum: 0, weight: 0, jobs: 0 };
        v.sum += sign * w;
        v.weight += w;
        v.jobs++;
        votes.set(key, v);
      }
  }
  return new Map([...votes].map(([key, v]) => [key, { lean: v.sum / Math.max(1, v.weight), jobs: v.jobs }]));
}
