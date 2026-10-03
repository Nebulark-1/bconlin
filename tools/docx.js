import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// Read the paragraphs out of a .docx without any dependencies: a .docx is a
// zip, and the text lives in word/document.xml.

function unzipEntry(buf, name) {
  // the central directory lists every file; find ours there
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (buf.toString("utf8", p + 46, p + 46 + nameLen) === name) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return method === 8 ? inflateRawSync(data) : data;
    }
    p += 46 + nameLen + extra + comment;
  }
  return null;
}

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Every paragraph in a .docx: { text, list } (list: it's a bullet or numbered item). */
export function paragraphs(path) {
  const xml = unzipEntry(readFileSync(path), "word/document.xml")?.toString("utf8") || "";
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(([p]) => ({
    text: decode([...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)].map((m) => m[1] ?? " ").join("")).replace(/\s+/g, " ").trim(),
    list: /<w:numPr>|w:val="List/.test(p),
  })).filter((p) => p.text);
}
