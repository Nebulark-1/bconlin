// Line fit: how well a bullet fills its printed lines. Most of the work of
// editing a résumé is the bullet whose last line holds one to three words,
// so this measures the real layout (the page is drawn at exactly 8.5 inches,
// the width it prints at) word by word and says how much to cut or add.

/** Where each line of el's text breaks: [{ words, chars, width }], plus the width available. */
export function measure(el) {
  const range = document.createRange();
  const lines = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const m of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      // a hyphenated word can break across lines; count each piece where it lands
      for (const r of rects) {
        const line = lines.find((l) => Math.abs(l.top - r.top) < r.height / 2);
        if (line) {
          line.words++;
          line.chars += m[0].length + 1;
          line.right = Math.max(line.right, r.right);
        } else lines.push({ top: r.top, left: r.left, right: r.right, words: 1, chars: m[0].length });
      }
    }
  }
  lines.sort((a, b) => a.top - b.top);
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const avail = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  return { lines: lines.map(({ words, chars, left, right }) => ({ words, chars, width: right - left })), avail };
}

/**
 * Grade a measured bullet:
 *   full   the last line is at least 70% full
 *   short  the last line is part full: room to add, or a line you could save
 *   spill  one to three words (or under a quarter line) hang on a line of their own
 * cut: characters to remove to lose the last line. add: characters that would fill it.
 */
export function grade({ lines, avail }) {
  if (!lines.length) return { grade: "full", fill: 1, lines: 0, cut: 0, add: 0 };
  const last = lines[lines.length - 1];
  const fill = Math.min(1, last.width / avail);
  const sum = lines.reduce((a, l) => ({ chars: a.chars + l.chars, width: a.width + l.width }), { chars: 0, width: 0 });
  const perPx = sum.chars / sum.width;
  const cut = last.chars + 1;
  const add = Math.max(0, Math.floor((avail - last.width) * perPx) - 2);
  const spill = lines.length > 1 && (last.words <= 3 || fill < 0.25);
  return { grade: spill ? "spill" : fill >= 0.7 ? "full" : "short", fill, lines: lines.length, cut, add, lastWords: last.words };
}

/** The text ranges of el's last line (for highlighting the words that spill). */
export function lastLineRange(el) {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let lastTop = -Infinity;
  let start = null;
  let end = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const m of node.textContent.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      const top = rects[rects.length - 1].top;
      if (top > lastTop + 2) {
        lastTop = top;
        // a hyphenated word that wraps starts the line partway through
        let at = m.index;
        if (rects.length > 1) {
          const probe = document.createRange();
          while (at < m.index + m[0].length - 1) {
            probe.setStart(node, at);
            probe.setEnd(node, at + 1);
            if (probe.getBoundingClientRect().top >= top - 2) break;
            at++;
          }
        }
        start = [node, at];
      }
      end = [node, m.index + m[0].length];
    }
  }
  if (!start) return null;
  const out = new Range();
  out.setStart(...start);
  out.setEnd(...end);
  return out;
}
