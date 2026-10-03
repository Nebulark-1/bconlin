import bank from "./bank.json";

// The résumé bank: every line I might put on a résumé, written once, each
// scored 0-10 for how well it serves each kind of role. The generator picks
// and orders lines from here; it never writes new ones. All facts come from
// my existing résumés. The data lives in bank.json so the studio (my
// private editor, studio.html, dev only) can read and write it.
//
// Scores: best (the default, strongest overall), swe (software
// engineering), data (data and analytics), it (IT and systems), ops
// (operations and leadership).

export default bank;
export const { profile: PROFILE, lenses: LENSES, summary: SUMMARY, entries: ENTRIES, skills: SKILLS, spoken: LANGUAGES_SPOKEN } = bank;
