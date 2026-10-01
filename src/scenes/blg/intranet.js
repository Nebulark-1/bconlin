// Illustrative sketch written for this site - not the firm's code or
// content. The real intranet's operations manual was searchable; this is a
// working search index over generic sample procedures, to show the idea:
// ranked full-text search, so "how do I…" stops being an interruption.

export const MANUAL = [
  { title: "Requesting PTO", tags: "leave vacation time off approval", body: "Submit the PTO form at least two weeks ahead; your supervisor approves it and the calendar updates." },
  { title: "Opening a new client matter", tags: "intake new client engagement", body: "Run a conflict check, send the engagement letter, then create the matter so time can be billed to it." },
  { title: "Running a conflict check", tags: "conflicts intake parties ethics", body: "Search every party and related entity before accepting a matter; record the result on the intake." },
  { title: "Connecting to the VPN", tags: "remote access it network", body: "Install the client from the IT page, sign in with your firm account, and approve the prompt on your phone." },
  { title: "Resetting your password", tags: "it account login locked", body: "Use the self-service reset; if you're locked out, file an IT request and you'll be back within the hour." },
  { title: "Submitting time entries", tags: "time billing hours realization", body: "Enter time daily against the matter, with a description a client would understand on the invoice." },
  { title: "Reporting an IT issue", tags: "it help ticket printer computer", body: "File an IT request with what happened and when; urgent issues that stop client work are flagged first." },
  { title: "Benefits enrollment", tags: "benefits health insurance hr", body: "Open enrollment runs each November; new hires have thirty days from their start date." },
  { title: "Filing IRS notices", tags: "tax irs notices scanning", body: "Scan every notice on arrival; it's routed to the client's file and its response deadline is calendared." },
  { title: "Onboarding a new hire", tags: "hr onboarding accounts training", body: "Accounts, devices and building access are provisioned before day one; training follows the manual." },
  { title: "Closing a matter", tags: "matter close file retention billing", body: "Send the final invoice, return client documents, and set the file's retention date." },
  { title: "Ordering supplies", tags: "office supplies purchasing", body: "Add requests to the supplies list; orders go out every Friday." },
];

const tokenize = (text) => text.toLowerCase().match(/[a-z0-9]+/g) || [];

/**
 * Build an inverted index: term → [{ doc, tf }]. Titles count three times
 * and tags twice, so a word in the title outranks a passing mention.
 */
export function buildIndex(docs = MANUAL) {
  const index = new Map();
  docs.forEach((doc, d) => {
    const counts = new Map();
    const add = (text, weight) => tokenize(text).forEach((t) => counts.set(t, (counts.get(t) || 0) + weight));
    add(doc.title, 3);
    add(doc.tags, 2);
    add(doc.body, 1);
    for (const [term, tf] of counts) {
      if (!index.has(term)) index.set(term, []);
      index.get(term).push({ doc: d, tf });
    }
  });
  return { index, size: docs.length };
}

/**
 * TF-IDF ranking with prefix matching, so "vac" finds vacation. Terms that
 * appear in every procedure score near zero; rare, specific terms dominate.
 */
export function searchManual(query, { index, size } = buildIndex(), docs = MANUAL) {
  const scores = new Map();
  for (const q of tokenize(query)) {
    for (const [term, postings] of index) {
      if (!term.startsWith(q)) continue;
      const idf = Math.log(1 + size / postings.length);
      const exact = term === q ? 1 : 0.6;
      for (const { doc, tf } of postings) scores.set(doc, (scores.get(doc) || 0) + tf * idf * exact);
    }
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([d, score]) => ({ title: docs[d].title, score }));
}
