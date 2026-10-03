import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { paragraphs } from "./docx.js";

// Phase 2: dig every bullet out of my old résumés (resumes/*.docx, private)
// so the ones the bank doesn't have yet can be reviewed in the studio.
//   node tools/mine.js
// Writes resumes/engine/mined.json. Lines that repeat across résumés are
// grouped, and each group is matched against the bank by shared words.
// Contact lines are never read in: anything with a phone number, an email
// address, or a street address is skipped.

const ROOT = resolve(import.meta.dirname, "..");
const DIR = resolve(ROOT, "resumes");
const OUT = resolve(DIR, "engine/mined.json");

const PRIVATE = /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}|@|\b\d+ [A-Z][a-z]+ (St|Ave|Rd|Dr|Ln|Blvd|Ct|Way)\b/;
const STOP = new Set("a an and the of to for in on with by at from as that this into across over per its their our my i we".split(" "));
export const words = (t) => new Set(t.toLowerCase().replace(/[^a-z0-9$%+ ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)));

/** How alike two lines are: shared words over the shorter line's words (0 to 1). */
export function overlap(a, b) {
  const A = words(a);
  const B = words(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / Math.max(1, Math.min(A.size, B.size));
}

// a line that's only a heading inside a list ("Projects:") isn't a bullet
const isHeading = (t) => t.length < 40 && /:$/.test(t);

export function mine() {
  const bank = JSON.parse(readFileSync(resolve(ROOT, "src/resume/bank.json"), "utf8"));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".docx"));
  const lines = [];
  for (const file of files) {
    let heading = "";
    const when = statSync(resolve(DIR, file)).mtime.toISOString().slice(0, 10);
    for (const p of paragraphs(resolve(DIR, file))) {
      if (PRIVATE.test(p.text)) continue;
      if (!p.list) {
        if (p.text.length < 120) heading = p.text;
        continue;
      }
      if (isHeading(p.text) || p.text.length < 25) continue;
      lines.push({ text: p.text, file, heading, when });
    }
  }

  // group the same line across résumés (small edits count as the same line)
  const groups = [];
  for (const line of lines) {
    const g = groups.find((g) => overlap(g.versions[0].text, line.text) >= 0.85);
    if (g) g.versions.push(line);
    else groups.push({ versions: [line] });
  }

  const known = bank.entries.flatMap((e) => e.bullets.flatMap((b) => [b.text, ...(b.variants || [])].map((text) => ({ entry: e.id, bullet: b.id, text }))));
  const mined = groups.map((g, i) => {
    // the newest wording leads
    g.versions.sort((a, b) => b.when.localeCompare(a.when) || b.text.length - a.text.length);
    const best = known.map((k) => ({ ...k, score: Math.max(...g.versions.map((v) => overlap(v.text, k.text))) })).sort((a, b) => b.score - a.score)[0];
    return {
      id: `m${i + 1}`,
      text: g.versions[0].text,
      heading: g.versions[0].heading,
      files: [...new Set(g.versions.map((v) => v.file))],
      wordings: [...new Set(g.versions.map((v) => v.text))],
      // 0.6+ shared words: very likely a wording of a bullet the bank has
      guess: best && best.score >= 0.6 ? { entry: best.entry, bullet: best.bullet, score: Math.round(best.score * 100) / 100 } : null,
      status: "new", // new → matched / added / skipped once reviewed
    };
  });
  return { mined, lines: lines.length, files: files.length };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const { mined, lines, files } = mine();
  mkdirSync(resolve(DIR, "engine"), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ made: new Date().toISOString(), mined }, null, 2));
  const guessed = mined.filter((m) => m.guess).length;
  console.log(`${files} files, ${lines} bullets, ${mined.length} distinct; ${guessed} look like bullets the bank has, ${mined.length - guessed} don't`);
}
