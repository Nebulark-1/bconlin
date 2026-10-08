// What the studio asks Claude, task by task. Each task turns the studio's
// input into a system prompt and a message, so the prompts live in one
// place and the browser never sees the API key.

const VOICE = `Write like Ben: plain, specific, and human. Start with a strong verb (past tense, or present tense for a current role), lead with the action, and end on the result. American spelling, Oxford commas. Never use em dashes, buzzwords ("leveraged", "spearheaded", "synergy"), or "not X but Y" constructions.`;

const FACTS = `Keep every fact exactly as given: numbers, names, tools, scale, and outcomes. Never add a fact, number, tool, or claim that isn't in the text you were given.`;

export const TASKS = {
  /**
   * Reword one bullet so its last line fills, or so it loses its last line.
   * input: { text, goal: "cut" | "add", min, max, role, siblings: [text], keep: [keyword] }
   */
  fit: {
    model: "claude-sonnet-5-5",
    max_tokens: 700,
    build({ text, goal, min, max, role, siblings = [], keep = [] }) {
      const system = `You reword résumé bullets for Ben Conlin so they fill printed lines cleanly.\n\n${FACTS}\n\n${VOICE}\n\nReply with JSON only: {"variants": ["...", "...", "..."]}.`;
      const aim =
        goal === "cut"
          ? `Shorten it so it loses its last line: between ${min} and ${max} characters. Cut words, not facts. If a fact must go, drop the least important one.`
          : `Lengthen it so its last line is nearly full: between ${min} and ${max} characters. Add detail only by being more specific about what is already there or by using facts from the other bullets for this role. Don't repeat what those bullets already say.`;
      const must = keep.length ? `\n\nKeep these exact words, which a job posting asks for: ${keep.join(", ")}.` : "";
      const others = siblings.length ? `\n\nOther bullets for this role (context only):\n${siblings.map((s) => `- ${s}`).join("\n")}` : "";
      return {
        system,
        content: `Role: ${role}\n\nBullet (${text.length} characters):\n${text}\n\n${aim}${must}${others}\n\nGive three different wordings.`,
      };
    },
    parse: (text) => json(text).variants,
  },

  /**
   * Sort lines dug out of old résumés: which are bullets, which say the same
   * thing as each other or as a bullet the bank already has, and where new
   * ones belong.
   * input: { bank: [{ id, entry, text }], entries: [{ id, org, role }], lines: [{ id, text, heading }] }
   */
  sort: {
    model: "claude-sonnet-5-5",
    max_tokens: 8000,
    build({ bank, entries, lines }) {
      const system = `You help Ben Conlin sort lines taken from his old résumés into his résumé bank. A bank bullet is one fact (an accomplishment or responsibility); the same fact can have many wordings.

For each line decide:
- kind: "bullet" (an accomplishment or responsibility worth keeping) or "other" (skills lists, coursework, languages, section headings, job titles, or anything that isn't a bullet).
- For bullets, group lines that state the same fact. If the fact is already in the bank, give its bank id as "match". Two lines are the same fact if they describe the same work and result, even if the numbers are rounded differently or one has more detail. If a line combines several bank facts, match the main one.
- entry: the bank entry id the fact belongs to, or "new:<slug>" for a job, project, or activity the bank doesn't have.

Reply with JSON only:
{"facts": [{"lines": ["m3", "m40"], "match": "blg-docs" or null, "entry": "blg" or "new:slug", "note": "under 12 words"}],
 "newEntries": {"slug": {"org": "...", "role": "...", "when": "dates if the lines give them, else empty", "section": "experience" | "projects" | "education" | "volunteer"}},
 "other": ["m1", "m2"]}
Every line id appears exactly once.`;
      const content = `Bank entries:\n${entries.map((e) => `${e.id}: ${e.org} (${e.role})`).join("\n")}\n\nBank bullets:\n${bank.map((b) => `${b.id} [${b.entry}]: ${b.text}`).join("\n")}\n\nLines from old résumés (with the heading they sat under):\n${lines.map((l) => `${l.id} {${l.heading}}: ${l.text}`).join("\n")}`;
      return { system, content };
    },
    parse: (text) => json(text),
  },
};

TASKS.tag = {
  /**
   * Tag every fact in the bank (and score the new ones) so a job
   * description can find them. Run once, then again for new facts only.
   * input: { lenses: [{ id, label, blurb }], facts: [{ id, where, wordings: [text], score: bool }] }
   */
  model: "claude-sonnet-5-5",
  max_tokens: 8000,
  build({ lenses, facts }) {
    const system = `You tag Ben Conlin's résumé bullets so job descriptions can be matched to them. Each fact may have several wordings; tag the fact, not one wording.

tags: 6 to 12 lowercase terms a job description might use for this work: tools and languages, technical skills, domains, and duties (for example "python", "etl", "document automation", "machine learning", "it administration", "stakeholder communication", "healthcare", "legal operations"). Prefer common job-posting words over Ben's phrasing. Only tag what the fact actually shows.

For facts marked "score me", also give score: 0 to 10 for how well the fact serves each focus below (10 is one of his strongest lines for that kind of role). Scores already in the bank range widely, so use the whole scale.

Focuses:
${lenses.map((l) => `${l.id}: ${l.label} (${l.blurb})`).join("\n")}

Reply with JSON only: {"facts": {"<id>": {"tags": [...], "score": {"best": n, ...}}}}. Omit score for facts not marked "score me".`;
    const content = facts.map((f) => `${f.id} (${f.where})${f.score ? " [score me]" : ""}\n${f.wordings.map((w) => `- ${w}`).join("\n")}`).join("\n\n");
    return { system, content };
  },
  parse: (text) => json(text).facts,
};

TASKS.posting = {
  /**
   * Read a job description: who it's for, which focus fits best, and the
   * keywords a résumé should match.
   * input: { text, lenses: [{ id, label, blurb }] }
   */
  model: "claude-sonnet-5-5",
  max_tokens: 2000,
  build({ text, lenses }) {
    const system = `You read job descriptions for Ben Conlin and pull out what his résumé should match. Applicant tracking systems match words literally, so use the posting's own wording for each keyword.

Reply with JSON only:
{"company": "...", "title": "...", "lens": "<the closest focus id>",
 "keywords": [{"term": "the posting's word or phrase", "weight": 3, "synonyms": ["other ways a résumé might say it"]}]}

keywords: 12 to 25 skills, tools, domains, and duties the posting asks for. weight 3: required, or stressed more than once. 2: preferred. 1: mentioned. synonyms: words Ben's résumé might use for the same thing (for "ETL": "data pipeline", "pipelines"; for "stakeholder management": "leadership", "clients"). Skip generic traits like "team player" or "detail-oriented".

Focuses:
${lenses.map((l) => `${l.id}: ${l.label} (${l.blurb})`).join("\n")}`;
    return { system, content: text };
  },
  parse: (text) => json(text),
};

/** The JSON object in a reply, ignoring anything around it. */
function json(text) {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}
