// A bullet is one fact with any number of wordings. The fact decides
// whether it belongs on a page; the wording is chosen for the page:
//   1. keywords first: the terms a job description asks for (or, with no
//      job description, the bank's vocabulary), found literally in the text,
//      because applicant tracking systems match words
//   2. line fit second: a wording that fills its lines beats one that spills
//   3. then how often I've sent it
// A wording another one beats on every count (every keyword it has, and at
// least as good a fit) is "covered" and never chosen, though it's kept.

export const FIT_RANK = { full: 2, short: 1, spill: 0 };

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

/**
 * Every wording of a bullet, best first.
 * terms: what to look for. fitOf(text): its line-fit grade ({ grade, fill }).
 * Returns [{ text, source, used, terms, fit, weight, coveredBy }].
 */
export function rankWordings(bullet, terms, fitOf) {
  const list = bullet.wordings.map((w) => {
    const found = termsIn(w.text, terms);
    return { ...w, used: w.used || 0, terms: found.map((k) => k.term), weight: found.reduce((n, k) => n + (k.weight || 1), 0), fit: fitOf(w.text) };
  });
  // covered: another wording has every term this one has and fits at least as well, and beats it somewhere
  for (const a of list) {
    const has = new Set(a.terms);
    a.coveredBy = list.find((b) => {
      if (b === a) return false;
      const bt = new Set(b.terms);
      if (![...has].every((t) => bt.has(t))) return false;
      const fa = FIT_RANK[a.fit.grade];
      const fb = FIT_RANK[b.fit.grade];
      return fb >= fa && (bt.size > has.size || fb > fa);
    })?.text;
  }
  return list.sort(
    (a, b) =>
      !!a.coveredBy - !!b.coveredBy ||
      b.weight - a.weight ||
      FIT_RANK[b.fit.grade] - FIT_RANK[a.fit.grade] ||
      b.fit.fill - a.fit.fill ||
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
