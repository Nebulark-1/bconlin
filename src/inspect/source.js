// Pulls a named function (or CSS block) out of a module's raw source and
// renders it with line numbers and syntax highlighting. The inspector shows
// the code that is actually running - imported verbatim via Vite's ?raw.

/**
 * Find `name` declared as a function, const, or CSS block (e.g. "@keyframes
 * thigh"), include the comment directly above it, and return its source and
 * 1-based starting line. A small scanner walks strings, template literals
 * (with nested ${…}), and comments so braces inside them don't count.
 */
export function extract(src, name) {
  const decl = name.startsWith("@")
    ? new RegExp(`(^|\\n)([ \\t]*)(${name.replace(/[-]/g, "\\-")}\\s*\\{)`)
    : new RegExp(`(^|\\n)([ \\t]*)((?:export )?(?:async )?function\\*? ?${name}\\b|(?:export )?const ${name}\\s*=)`);
  const m = decl.exec(src);
  if (!m) return null;
  const declStart = m.index + m[1].length;
  const indent = m[2];

  // walk back over the doc comment or run of // comments directly above
  let start = declStart;
  const above = src.slice(0, declStart);
  if (/\*\/[ \t]*\r?\n$/.test(above)) {
    const open = above.lastIndexOf("/*");
    start = above.lastIndexOf("\n", open) + 1;
  } else {
    const lines = above.split("\n");
    lines.pop(); // the (empty) remainder of the declaration's own line
    let k = lines.length;
    while (k > 0 && /^\s*\/\//.test(lines[k - 1])) k--;
    if (k < lines.length) start = lines.slice(0, k).join("\n").length + (k ? 1 : 0);
  }

  let i = declStart + m[2].length + m[3].length - (name.startsWith("@") ? 1 : 0);
  let depth = 0;
  let parens = 0;
  let started = false;
  let mode = "code";
  const templates = [];
  let end = src.length;

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === "tpl") {
      if (c === "\\") i += 2;
      else if (c === "`") (mode = "code"), i++;
      else if (c === "$" && d === "{") templates.push(depth), (mode = "code"), (i += 2);
      else i++;
      continue;
    }
    if (c === "/" && d === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (c === "/" && d === "*") {
      i = src.indexOf("*/", i + 2) + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (c === "`") {
      mode = "tpl";
      i++;
      continue;
    }
    if (c === "(" || c === "[") parens++; // brackets too, so an array of objects reads as one value
    else if (c === ")" || c === "]") parens--;
    else if (c === "{") {
      if (!started && parens === 0) started = true;
      depth++;
    } else if (c === "}") {
      if (templates.length && templates[templates.length - 1] === depth) {
        templates.pop();
        mode = "tpl";
        i++;
        continue;
      }
      depth--;
      if (started && depth === 0) {
        end = i + 1;
        break;
      }
    } else if (c === ";" && !started && parens === 0 && depth === 0) {
      end = i + 1;
      break;
    }
    i++;
  }

  // de-indent nested declarations so they read cleanly
  let code = src.slice(start, end);
  if (indent) code = code.replace(new RegExp(`^${indent}`, "gm"), "");
  return { code, line: src.slice(0, start).split("\n").length };
}

const KEYWORDS = {
  js: "const|let|var|function|return|if|else|for|while|of|in|new|export|import|from|async|await|true|false|null|undefined|this|continue|break|typeof",
  css: "from|to",
  py: "def|return|import|from|as|for|in|if|elif|else|with|not|and|or|is|None|True|False|class|try|except|raise|lambda|yield",
  php: "function|return|if|else|foreach|as|new|true|false|null|const|fn|exit|echo|isset|array",
  sql: "CREATE|TABLE|INTEGER|TEXT|REAL|DATE|DATETIME|PRIMARY|KEY|REFERENCES|NOT|NULL|UNIQUE|CHECK|IN|DEFAULT|INDEX|ON|SELECT|FROM|JOIN|WHERE|GROUP|BY|SUM|AS|AND|CURRENT_TIMESTAMP",
};

const COMMENTS = {
  py: /#[^\n]*/y,
  sql: /--[^\n]*/y,
  php: /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*/y,
};

const rulesFor = (lang) => [
  ["com", COMMENTS[lang] || /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ["str", /`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/y],
  ["num", /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|\.\d+\b/y],
  ["kw", new RegExp(`\\b(?:${KEYWORDS[lang] || KEYWORDS.js})\\b`, lang === "sql" ? "iy" : "y")],
  ["at", lang === "php" ? /\$\w+/y : /@[\w-]+/y],
  ["fn", /[A-Za-z_$][\w$]*(?=\s*\()/y],
  ["id", /[A-Za-z_$][\w$-]*/y],
  ["ws", /\s+/y],
  ["op", /[^\sA-Za-z_$\d]/y],
];
const RULES = Object.fromEntries(["js", "css", "py", "php", "sql"].map((l) => [l, rulesFor(l)]));

/** Language from a file path's extension. */
export const langOf = (file) => ({ py: "py", php: "php", sql: "sql", css: "css" })[file.split(".").pop()] || "js";

const escape = (t) => t.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);

/** Tokenize with sticky regexes, then split tokens across lines. */
export function highlight(code, { firstLine = 1, marks = [], lang = "js" } = {}) {
  const lines = [""];
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const [type, re] of RULES[lang] || RULES.js) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || !m[0].length) continue;
      const parts = m[0].split("\n");
      parts.forEach((part, k) => {
        if (k) lines.push("");
        if (part) lines[lines.length - 1] += type === "ws" || type === "id" ? escape(part) : `<span class="tk-${type}">${escape(part)}</span>`;
      });
      i += m[0].length;
      matched = true;
      break;
    }
    if (!matched) i++;
  }
  const raw = code.split("\n");
  return lines
    .map((html, k) => {
      const hl = marks.some((mk) => raw[k]?.includes(mk)) ? " is-mark" : "";
      return `<span class="ln${hl}"><span class="ln__n">${firstLine + k}</span>${html || " "}</span>`;
    })
    .join("");
}
