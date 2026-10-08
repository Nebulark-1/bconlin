// JSON for files people read and diff: nested like normal, but a short
// object or list of plain values stays on one line (a bullet's scores, a
// skill's [name, scores] pair).
const isObj = (v) => v !== null && typeof v === "object";
const shallow = (v) => !isObj(v) || Object.values(v).every((x) => !isObj(x) || Object.values(x).every((y) => !isObj(y)));

function oneLine(v) {
  if (!isObj(v)) return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(oneLine).join(", ")}]`;
  return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${oneLine(x)}`).join(", ")} }`;
}

export function formatJson(value, indent = "") {
  if (!isObj(value)) return JSON.stringify(value);
  const line = oneLine(value);
  if (shallow(value) && line.length + indent.length <= 110) return line;
  const inner = indent + "  ";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((v) => inner + formatJson(v, inner)).join(",\n")}\n${indent}]`;
  }
  const keys = Object.keys(value);
  if (!keys.length) return "{}";
  return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${formatJson(value[k], inner)}`).join(",\n")}\n${indent}}`;
}
