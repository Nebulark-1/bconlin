// The perioperative department, laid out on a grid of 12-unit cells
// (134 × 75 cells = 1608 × 900 plan units). Zoned the way real surgical
// departments are, from public to restricted:
//
//   public          family waiting · consult · family lounge · discharge lobby
//   ──────────────── main corridor (4 wide) ─────────────────────────────────
//   semi-restricted pre-op ward │ surgeons' lounge │ anesthesia │ PACU ward
//                   (open bays around a nurses' station - line of sight)
//   ──────────────── OR corridor (4 wide, restricted) ───────────────────────
//   restricted      12 operating rooms, each with a back door to …
//                   the sterile core
//
// Staff areas open only onto the restricted corridor. Generic - not any
// real hospital's plan.

export const CELL = 12;
export const COLS = 134;
export const ROWS = 75;

const R = (x, y, w, h) => ({ x, y, w, h });

// ── Floor zones (walkable), with what they're made of ────────
export const ZONES = [
  { id: "waiting", label: "FAMILY WAITING", floor: "carpet", r: R(3, 3, 30, 10) },
  { id: "lobby", label: "DISCHARGE", floor: "terrazzo", r: R(112, 3, 19, 10) },
  { id: "corridor", label: "MAIN CORRIDOR", floor: "vinyl", r: R(3, 14, 128, 4) },
  { id: "preop", label: "PRE-OP", floor: "ward", r: R(3, 19, 50, 18) },
  { id: "lounge", label: "SURGEONS' LOUNGE", floor: "lounge", r: R(54, 19, 13, 18) },
  { id: "workroom", label: "ANESTHESIA", floor: "vinyl", r: R(68, 19, 12, 18) },
  { id: "pacu", label: "PACU", floor: "ward", r: R(81, 19, 50, 18) },
  { id: "orcorr", label: "OR CORRIDOR · RESTRICTED", floor: "vinyl", r: R(3, 38, 128, 4) },
  { id: "core", label: "STERILE CORE", floor: "core", r: R(7, 58, 119, 14) },
];

// Rooms that are drawn but nobody needs to walk into.
export const DECOR_ROOMS = [
  { label: "CONSULT", floor: "carpet", r: R(34, 3, 6, 10), door: 37 },
  { label: "CONSULT", floor: "carpet", r: R(41, 3, 6, 10), door: 44 },
  { label: "REGISTRATION", floor: "carpet", r: R(48, 3, 15, 10), door: 55 },
  { label: "FAMILY LOUNGE", floor: "carpet", r: R(64, 3, 21, 10), door: 74 },
  { label: "PHASE II RECOVERY", floor: "carpet", r: R(86, 3, 25, 10), door: 98 },
];

// ── Doors: walkable cells cut through the walls ──────────────
export const DOORS = [
  { r: R(0, 6, 3, 3), label: "ENTRANCE", kind: "entrance" },
  { r: R(15, 13, 4, 1) }, // waiting → corridor
  { r: R(119, 13, 4, 1) }, // corridor → discharge lobby
  { r: R(131, 6, 3, 3), label: "EXIT", kind: "exit" },
  { r: R(44, 18, 4, 1), double: true }, // corridor → pre-op (by the desk)
  { r: R(81, 18, 4, 1), double: true }, // corridor → PACU (by the desk)
  { r: R(46, 37, 4, 1), double: true }, // pre-op → OR corridor
  { r: R(59, 37, 3, 1) }, // lounge → OR corridor
  { r: R(72, 37, 3, 1) }, // anesthesia → OR corridor
  { r: R(83, 37, 4, 1), double: true }, // PACU → OR corridor
];

export const SPAWN = { x: 0, y: 7 };
export const DESPAWN = { x: 133, y: 7 };

// ── Bays (pre-op 10, PACU 12) ───────────────────────────────
// A bay: bed against the back wall, a chair for family, an IV / supply
// table, a supply cart, and a curtain row onto the ward aisle.
function bay(x0, top, w) {
  // build for a top-row bay (back wall at y = 19), then mirror if bottom
  const m = (y) => (top ? y : 55 - y);
  const c = (x, y) => ({ x, y: m(y) });
  return {
    rect: top ? R(x0, 19, w, 7) : R(x0, 30, w, 7),
    top,
    bedSpot: c(x0 + 2, 21), // where the patient lies
    bedEntry: c(x0 + 2, 22),
    nurseSpot: c(x0 + 4, 21),
    visitSpot: c(x0 + 1, 24), // the surgeon stands here for consent …
    visit2Spot: c(x0, 23), // … and anesthesia here
    youSpot: c(x0 + 4, 23),
    curtain: c(x0 + 3, 25), // pick-up / drop-off, on the aisle side
    bed: [c(x0 + 1, 19), c(x0 + 1, 20), c(x0 + 1, 21), c(x0 + 1, 22), c(x0 + 2, 19), c(x0 + 2, 20), c(x0 + 3, 19), c(x0 + 3, 20), c(x0 + 3, 21), c(x0 + 3, 22)],
    ivTable: c(x0, 20),
    cart: [c(x0 + w - 1, 22), c(x0 + w - 1, 23)],
    chair: c(x0 + w - 1, 19),
    walls: Array.from({ length: 7 }, (_, k) => c(x0 + w, 19 + k)), // separator to the next bay
  };
}

export const PREOP = Array.from({ length: 10 }, (_, i) => bay(3 + 8 * (i % 5), i < 5, 7));
export const PACU = Array.from({ length: 12 }, (_, i) => bay(89 + 7 * (i % 6), i < 6, 6));

// ── Nurses' stations (island desks, line of sight down the aisle) ──
// Nurses work from the desk's long sides, so the walkways either side of
// the island stay clear (a parked nurse in a 1-wide passage boxes people in).
export const PREOP_STATION = { desk: R(46, 24, 4, 6), spots: [{ x: 47, y: 23 }, { x: 48, y: 23 }, { x: 47, y: 30 }, { x: 48, y: 30 }], you: { x: 44, y: 34 } };
export const PACU_STATION = { desk: R(83, 24, 3, 6), spots: [{ x: 83, y: 23 }, { x: 85, y: 23 }, { x: 83, y: 30 }, { x: 85, y: 30 }], you: { x: 81, y: 34 } };

// ── Operating rooms ─────────────────────────────────────────
function or(i) {
  const x0 = 7 + 10 * i;
  const table = [];
  for (let y = 48; y <= 52; y++) for (let x = x0 + 3; x <= x0 + 5; x++) if (!(x === x0 + 4 && y >= 47 && y <= 50)) table.push({ x, y });
  return {
    rect: R(x0, 43, 9, 14),
    door: R(x0 + 3, 42, 3, 1),
    backDoor: R(x0 + 6, 57, 2, 1),
    tableSpot: { x: x0 + 4, y: 50 }, // patient on the table
    tableEntry: { x: x0 + 4, y: 47 },
    dropSpot: { x: x0 + 4, y: 44 }, // just inside the door
    nurseSpot: { x: x0 + 6, y: 44 }, // the circulator's desk
    surgeonSpot: { x: x0 + 2, y: 50 },
    anesSpot: { x: x0 + 4, y: 53 }, // at the head of the table
    youSpot: { x: x0 + 1, y: 45 },
    table, // the table, minus the patient's cell and its entry
    backTable: [{ x: x0 + 6, y: 49 }, { x: x0 + 7, y: 49 }, { x: x0 + 6, y: 50 }, { x: x0 + 7, y: 50 }, { x: x0 + 6, y: 51 }, { x: x0 + 7, y: 51 }],
    scrub: { x: x0 + 7, y: 52 }, // the scrub tech, at the back table
    desk: [{ x: x0 + 7, y: 44 }, { x: x0 + 8, y: 44 }, { x: x0 + 7, y: 45 }, { x: x0 + 8, y: 45 }],
    machine: [{ x: x0 + 5, y: 54 }, { x: x0 + 6, y: 54 }, { x: x0 + 5, y: 55 }, { x: x0 + 6, y: 55 }],
  };
}
export const ORS = Array.from({ length: 12 }, (_, i) => or(i));

// ── Staff homes ─────────────────────────────────────────────
export const LOUNGE_SPOTS = [56, 58, 60, 62, 64].flatMap((x) => [{ x, y: 22 }, { x, y: 31 }]);
export const LOUNGE_FURNITURE = [R(54, 19, 13, 1), R(55, 25, 10, 2), R(55, 33, 10, 2)]; // lockers, sofas
export const WORK_SPOTS = [70, 73, 76].flatMap((x) => [{ x, y: 23 }, { x, y: 30 }]);
export const WORK_FURNITURE = [R(68, 19, 12, 1), R(69, 26, 10, 2)]; // supply wall, carts

// ── Waiting room: three rows of chairs facing aisles ─────────
export const SEATS = [];
export const FAMILY = []; // chairs with family already in them
for (const y of [5, 8, 11]) {
  for (let x = 12; x <= 30; x += 2) {
    const seat = { x, y, front: { x, y: y + 1 } };
    // a few chairs hold waiting family members (decor; not walkable)
    if ((x * 7 + y * 3) % 5 === 0) FAMILY.push(seat);
    else SEATS.push(seat);
  }
}
export const RECEPTION = R(4, 3, 5, 2);
export const CORE_SHELVES = Array.from({ length: 6 }, (_, k) => R(12 + k * 19, 61, 12, 2)).concat(Array.from({ length: 6 }, (_, k) => R(12 + k * 19, 67, 12, 2)));
export const LOBBY_CHAIRS = [114, 116, 118, 124, 126, 128].map((x) => ({ x, y: 4 }));

// "You" roam between these when not at a bedside or in an OR.
export const YOU_ROUTE = [PREOP_STATION.you, { x: 30, y: 40 }, { x: 64, y: 40 }, { x: 100, y: 40 }, PACU_STATION.you, { x: 100, y: 16 }, { x: 40, y: 16 }];

// ── The walkable grid ───────────────────────────────────────
export function buildWalkable() {
  const walk = new Uint8Array(COLS * ROWS);
  const fill = (r, v = 1) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < COLS && y < ROWS) walk[y * COLS + x] = v;
  };
  const block = (c) => (walk[c.y * COLS + c.x] = 0);
  ZONES.forEach((z) => fill(z.r));
  ORS.forEach((o) => {
    fill(o.rect);
    fill(o.door);
    fill(o.backDoor);
  });
  DOORS.forEach((d) => fill(d.r));
  // furniture and walls inside the zones
  for (const b of [...PREOP, ...PACU]) {
    b.bed.forEach(block);
    b.cart.forEach(block);
    block(b.ivTable);
    block(b.chair);
    b.walls.forEach(block);
  }
  // the wall between the last pre-op bays and the station, and the PACU station and its first bays
  for (const y of [19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 33, 34, 35, 36]) {
    block({ x: 42, y });
    block({ x: 88, y });
  }
  fill(PREOP_STATION.desk, 0);
  fill(PACU_STATION.desk, 0);
  for (const o of ORS) {
    o.table.forEach(block);
    o.backTable.forEach(block);
    o.desk.forEach(block);
    o.machine.forEach(block);
    block(o.scrub);
  }
  LOUNGE_FURNITURE.forEach((r) => fill(r, 0));
  WORK_FURNITURE.forEach((r) => fill(r, 0));
  CORE_SHELVES.forEach((r) => fill(r, 0));
  FAMILY.forEach(block);
  fill(RECEPTION, 0);
  LOBBY_CHAIRS.forEach(block);
  return walk;
}
