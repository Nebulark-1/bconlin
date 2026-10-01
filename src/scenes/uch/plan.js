// The department as a floor plan in the monitor's own palette, drawn from
// layout.js. Kept deliberately simple - it's here to teach the gist of
// perioperative flow, not to be a lifelike model. The building is painted
// wall-colour and the floors are laid over it, so what shows between floors
// reads as walls, with doors where floors meet.

import * as L from "./layout.js";

const U = L.CELL;
const px = (r) => ({ x: r.x * U, y: r.y * U, w: r.w * U, h: r.h * U });
const rect = (r, cls, extra = "") => {
  const p = px(r);
  return `<rect class="${cls}" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${extra}/>`;
};
const FLOOR = { carpet: "floor", terrazzo: "floor", lounge: "floor", ward: "floor", core: "floor floor--core", vinyl: "hall" };

function bay(b, i, unit) {
  const r = px(b.rect);
  const bed = px({ x: b.bed[0].x, y: Math.min(b.bed[0].y, b.bed[3].y), w: 3, h: 4 });
  const edge = b.top ? r.y + r.h - 1 : r.y + 1; // curtain, on the aisle side
  const sep = (b.walls[0].x + 0.5) * U;
  return `
    <g class="bay bay--${unit}" data-bay="${i}">
      <rect class="glow" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
      <path class="sep" d="M${sep} ${r.y}V${r.y + r.h}"/>
      <rect class="bed" x="${bed.x + 2}" y="${bed.y + 2}" width="${bed.w - 4}" height="${bed.h - 4}" rx="4"/>
      <path class="curtain" d="M${r.x + 4} ${edge}H${r.x + r.w - 4}"/>
      <text class="lbl" x="${r.x + r.w - 4}" y="${b.top ? r.y + r.h - 6 : r.y + 11}" text-anchor="end">${i + 1}</text>
    </g>`;
}

function room(o, i) {
  const r = px(o.rect);
  const t = px({ x: o.tableSpot.x - 1, y: 47, w: 3, h: 6 });
  return `
    <g class="room" data-or="${i}">
      <rect class="glow" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
      <rect class="sterile" x="${r.x + 1.5 * U}" y="${r.y + 3.5 * U}" width="${r.w - 2 * U}" height="${r.h - 6 * U}" rx="4"/>
      <rect class="table" x="${t.x + 3}" y="${t.y + 3}" width="${t.w - 6}" height="${t.h - 6}" rx="4"/>
      <text class="lbl" x="${r.x + 4}" y="${r.y + r.h - 5}">OR ${i + 1}</text>
    </g>`;
}

function station(st, label) {
  const d = px(st.desk);
  return `<rect class="desk" x="${d.x + 1}" y="${d.y + 1}" width="${d.w - 2}" height="${d.h - 2}" rx="4"/>
    <text class="lbl lbl--desk" x="${d.x + d.w / 2}" y="${d.y + d.h / 2 + 3}" text-anchor="middle">${label}</text>`;
}

const swing = (x, y, r, a0, a1, sweep) =>
  `<path class="swing" d="M${x} ${y} L${x + r * Math.cos(a0)} ${y + r * Math.sin(a0)} A${r} ${r} 0 0 ${sweep} ${x + r * Math.cos(a1)} ${y + r * Math.sin(a1)}"/>`;

// a door in a horizontal wall: one leaf, or a pair for stretchers
function door(d) {
  const r = px(d.r);
  if (d.r.h !== 1) return "";
  const y = r.y + U;
  if (d.double || d.r.w >= 3) return swing(r.x, y, r.w / 2, 0, Math.PI / 2, 1) + swing(r.x + r.w, y, r.w / 2, Math.PI, Math.PI / 2, 0);
  return swing(r.x, y, r.w, 0, Math.PI / 2, 1);
}

export function planMarkup() {
  const floors = [
    ...L.ZONES.map((z) => rect(z.r, FLOOR[z.floor])),
    ...L.DECOR_ROOMS.map((d) => rect(d.r, "floor floor--quiet") + rect({ x: d.door, y: 13, w: 2, h: 1 }, "hall")),
    ...L.ORS.map((o) => rect(o.rect, "floor floor--or") + rect(o.door, "hall") + rect(o.backDoor, "floor floor--core")),
    ...L.DOORS.map((d) => rect(d.r, "hall")),
  ].join("");

  const partitions = [42, 88].map((x) => `<path class="sep" d="M${(x + 0.5) * U} ${19 * U}V${26 * U}M${(x + 0.5) * U} ${30 * U}V${37 * U}"/>`).join("");
  const seat = (s) => `<rect class="seat" x="${s.x * U + 2}" y="${s.y * U + 2}" width="${U - 4}" height="${U - 4}" rx="2"/>`;
  const furniture = [...L.LOUNGE_FURNITURE, ...L.WORK_FURNITURE, ...L.CORE_SHELVES, L.RECEPTION].map((r) => rect(r, "furn", ' rx="2"')).join("");
  // where the corridor becomes restricted
  const restricted = L.DOORS.filter((d) => d.r.y === 37)
    .map((d) => `<path class="restrict" d="M${d.r.x * U} ${38 * U - 1}H${(d.r.x + d.r.w) * U}"/>`)
    .join("");

  const signs = [...L.ZONES, ...L.DECOR_ROOMS]
    .map((z) => {
      const p = px(z.r);
      const hall = z.id === "corridor" || z.id === "orcorr";
      const ward = z.id === "preop" || z.id === "pacu";
      const x = z.id === "pacu" ? 89 * U + 6 : z.id === "waiting" ? 12 * U : p.x + 6;
      const y = ward ? 28 * U + 4 : hall ? p.y + 2.3 * U : z.id === "waiting" ? p.y + 12 : p.y + 16;
      return `<text class="sign${hall ? " sign--hall" : ""}" x="${x}" y="${y}">${z.label}</text>`;
    })
    .join("");

  return `
    <rect class="building" x="${2 * U}" y="${2 * U}" width="${130 * U}" height="${71 * U}"/>
    ${floors}
    ${restricted}
    ${L.PREOP.map((b, i) => bay(b, i, "pre")).join("")}
    ${L.PACU.map((b, i) => bay(b, i, "pacu")).join("")}
    ${partitions}
    ${L.ORS.map(room).join("")}
    ${station(L.PREOP_STATION, "RN")}
    ${station(L.PACU_STATION, "RN")}
    ${[...L.SEATS, ...L.FAMILY, ...L.LOBBY_CHAIRS].map(seat).join("")}
    ${furniture}
    ${L.DOORS.map(door).join("")}
    ${L.ORS.map((o) => door({ r: o.door, double: true })).join("")}
    ${signs}
    <g class="paths"></g>
    <g class="people"></g>`;
}

// ── Camera framing (plan units) ─────────────────────────────
// Close-ups are a centre and a height; the scene widens them to the
// screen's own aspect so nothing is letterboxed.
export const WIDE = { x: 0, y: 0, w: L.COLS * U, h: L.ROWS * U };
export const RESTRICTED = { x: 0, y: 17 * U, w: L.COLS * U, h: 58 * U }; // wards, OR corridor, rooms, core
export function shotForBay(bay) {
  const r = L.PACU[bay].rect;
  return { cx: (r.x + r.w / 2) * U, cy: (r.y + r.h / 2 + (L.PACU[bay].top ? 2.5 : -2.5)) * U, h: 16 * U };
}
export function shotForRoom(room) {
  const r = L.ORS[room].rect;
  return { cx: (r.x + r.w / 2) * U, cy: (r.y + r.h / 2 - 2) * U, h: 21 * U };
}
export function frame(s, aspect) {
  if (s.cx === undefined) return s;
  const w = s.h * aspect;
  return { x: s.cx - w / 2, y: s.cy - s.h / 2, w, h: s.h };
}

// Patients are filled dots coloured by stage (matching the census under the
// plan); staff are rings, one colour per role.
export const ROLE_COLORS = {
  patient: "#e8f0ee",
  nurse: "#9fe0c8", // pre-op / PACU
  ornurse: "#6fa8ff",
  surgeon: "#ff7aa8",
  anesthesia: "#b48cff",
  you: "#ff9f43",
};
export const roleOf = (p) => (p.role === "nurse" && p.unit === "or" ? "ornurse" : p.role);
