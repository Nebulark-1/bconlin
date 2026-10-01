// The perioperative department as an agent-based simulation. Everyone - each
// patient, nurse, surgeon and anesthesiologist, and each OR itself - runs as
// a coroutine (a generator) that yields "wait until …" conditions; the
// engine resumes it when the condition holds. Movement for all of them is
// planned together by mapf.js, so nobody collides.
//
// The workflow:
//   arrive → sit in family waiting
//   a pre-op nurse (≤ 3 patients each) walks them to a bay and preps them
//   their surgeon and anesthesiologist each come by for consent
//   the OR's own nurse fetches them; surgeon and anesthesia meet them there
//   anesthesia attends induction and emergence (each covers two ORs)
//   a PACU nurse (≤ 3 patients each) collects them on a stretcher
//   the surgeon checks in at PACU; lights come up as they recover; home
//
// Timings are illustrative and compressed - seconds, not hours.

import { createGrid } from "./grid.js";
import { createPlanner, REPLAN } from "./mapf.js";
import * as L from "./layout.js";
import { rng } from "../../art/draw.js";

export const TICK = 1 / 8; // seconds per step (one cell per step)
const PRIORITY = { surgeon: 6, anesthesia: 6, nurse: 4, you: 2, patient: 1 };

export function createHospital({ seed = 5 } = {}) {
  const grid = createGrid();
  const planner = createPlanner(grid);
  const r = rng(seed);
  const between = (lo, hi) => lo + r() * (hi - lo);
  const exp = (mean) => -Math.log(1 - r()) * mean;
  const C = (p) => grid.id(p.x, p.y);

  let clock = 0;
  let ticks = 0;
  let nextId = 1;
  let closed = 0;
  let replanSoon = true;
  let lastPlan = -99;
  const people = new Map();
  const log = [];
  const stats = { arrived: 0, done: 0, timeInSystem: 0, area: 0, inSystem: 0, conflicts: 0 };
  const note = (text) => {
    const m = Math.floor(clock / 60);
    log.unshift(`${String(m).padStart(2, "0")}:${String(Math.floor(clock % 60)).padStart(2, "0")}  ${text}`);
    log.length = Math.min(log.length, 7);
  };

  // ── People ──────────────────────────────────────────────
  function add(role, at, props = {}) {
    const p = { id: nextId++, role, cell: C(at), prev: C(at), goal: undefined, plan: [], step: 0, blocked: 0, jobs: [], ...props };
    p.home = props.home !== undefined ? C(props.home) : p.cell;
    people.set(p.id, p);
    return p;
  }
  const at = (p, spot) => p.cell === C(spot);
  const goTo = (p, spot) => {
    p.goal = typeof spot === "number" ? spot : C(spot);
    return () => p.cell === p.goal && !p.leader;
  };
  const sleep = (s) => {
    const until = clock + s;
    return () => clock >= until;
  };
  // hand a person a new process (dropping whatever the old one awaited)
  const become = (p, co) => {
    p.co = co;
    p.wait = null;
  };
  const link = (lead, f) => {
    lead.follower = f;
    f.leader = lead;
    f.goal = undefined;
    replanSoon = true;
  };
  const unlink = (lead, f) => {
    lead.follower = null;
    f.leader = null;
    replanSoon = true;
  };

  /** Collect a patient: walk up beside them, then lead them to `drop`. */
  function* escort(nurse, pt, drop) {
    const near = () =>
      grid.neighbours[pt.cell].reduce((best, c) => (grid.distanceTo(c)[nurse.cell] < grid.distanceTo(best)[nurse.cell] ? c : best), grid.neighbours[pt.cell][0]);
    yield goTo(nurse, near());
    link(nurse, pt);
    yield goTo(nurse, drop);
    unlink(nurse, pt);
  }

  // A job is something a staff member does when its precondition holds.
  const job = (ready, run) => ({ ready, run });
  function* staffLife(s) {
    for (;;) {
      const k = s.jobs.findIndex((j) => j.ready());
      if (k < 0) {
        s.goal = s.home; // nothing to do: back to base
        yield () => s.jobs.some((j) => j.ready());
        continue;
      }
      const [j] = s.jobs.splice(k, 1);
      yield* j.run(s);
    }
  }

  // ── Staff ───────────────────────────────────────────────
  const preopNurses = L.PREOP_STATION.spots.map((spot) => add("nurse", spot, { home: spot, unit: "preop", load: 0 }));
  const pacuNurses = L.PACU_STATION.spots.map((spot) => add("nurse", spot, { home: spot, unit: "pacu", load: 0 }));
  const orNurses = L.ORS.map((o) => add("nurse", o.nurseSpot, { home: o.nurseSpot, unit: "or" }));
  const anesthesia = L.WORK_SPOTS.map((spot, k) => add("anesthesia", spot, { home: spot, rooms: [2 * k, 2 * k + 1], busy: false }));
  const surgeons = L.LOUNGE_SPOTS.map((spot) => add("surgeon", spot, { home: spot, load: 0, busy: false }));
  const you = add("you", L.YOU_ROUTE[0], { home: L.YOU_ROUTE[0], mode: { kind: "roam" } });
  const staff = [...preopNurses, ...pacuNurses, ...orNurses, ...anesthesia, ...surgeons];

  // ── Places ──────────────────────────────────────────────
  const preopBays = Array(L.PREOP.length).fill(null);
  const pacuBays = Array(L.PACU.length).fill(null);
  const seats = Array(L.SEATS.length).fill(null);
  const rooms = L.ORS.map(() => ({ patient: null, state: "open", caseStart: 0, caseLength: 1 }));
  // the board: every admitted patient, in order. An OR that opens takes the
  // first one who's ready (prepped, consented) and whose surgeon is free.
  const board = [];
  const nextReady = () => board.find((p) => p.prepped && p.consentS && p.consentA && !p.surgeon.busy);
  const pending = []; // arrived, but every chair is taken: still outside
  const anesFor = (room) => anesthesia[Math.floor(room / 2)];

  // ── Patients ────────────────────────────────────────────
  function* patientLife(p) {
    // into family waiting, to a chair
    const seat = seats.indexOf(null);
    seats[seat] = p.id;
    p.seat = seat;
    yield goTo(p, L.SEATS[seat]);
    p.stage = "waiting";
    // from here, staff move them - until recovery hands them a new process
  }

  function arrive() {
    pending.push({ arrivedAt: clock });
    stats.arrived++;
    stats.inSystem++;
  }

  // Walk in whenever a chair is free and the doorway is clear.
  function admitFromOutside() {
    if (!pending.length || !seats.includes(null)) return;
    const door = C(L.SPAWN);
    if ([...people.values()].some((q) => q.cell === door)) return;
    const { arrivedAt } = pending.shift();
    const p = add("patient", L.SPAWN, { stage: "arriving", arrivedAt });
    p.co = patientLife(p);
  }

  // ── Dispatch: pre-op admission and booking ──────────────
  function dispatch() {
    for (const p of people.values()) {
      if (p.role !== "patient" || p.stage !== "waiting" || p.called) continue;
      const bay = preopBays.indexOf(null);
      const nurse = preopNurses.filter((n) => n.load < 3).sort((a, b) => a.load - b.load)[0];
      if (bay < 0 || !nurse) return; // first come, first served
      p.called = true;
      preopBays[bay] = p.id;
      nurse.load++;
      p.preopNurse = nurse;
      p.bay = bay;
      // their surgeon (least booked) and an anesthesiologist for consent;
      // the OR itself is chosen later, by whichever room opens first
      p.surgeon = surgeons.slice().sort((a, b) => a.load - b.load)[0];
      p.surgeon.load++;
      p.anes = anesthesia.slice().sort((a, b) => a.jobs.length - b.jobs.length)[0];
      board.push(p);
      const B = L.PREOP[bay];
      nurse.jobs.push(
        job(
          () => true,
          function* (n) {
            yield* escort(n, p, C(B.curtain));
            seats[p.seat] = null;
            p.stage = "preop";
            yield goTo(p, B.bedSpot);
            p.inBed = true;
            yield goTo(n, B.nurseSpot);
            yield sleep(between(6, 9)); // vitals, IV, checklist
            p.prepped = true;
          },
        ),
      );
      // consent visits, once they're in bed
      const consent = (who, spot, flag) =>
        who.jobs.push(
          job(
            () => p.inBed && !p.leftPreop,
            function* (s) {
              yield goTo(s, spot);
              yield sleep(2.5);
              p[flag] = true;
            },
          ),
        );
      consent(p.surgeon, B.visitSpot, "consentS");
      consent(p.anes, B.visit2Spot, "consentA");
      note(`pre-op ${bay + 1} · admitted`);
    }
  }

  // ── Each OR runs its own process ────────────────────────
  function* orLife(k) {
    const room = rooms[k];
    const O = L.ORS[k];
    for (;;) {
      room.state = "open";
      yield () => k < 12 - closed && !!nextReady();
      const p = nextReady();
      board.splice(board.indexOf(p), 1);
      p.room = k;
      const surgeon = p.surgeon;
      surgeon.busy = true;
      room.patient = p;
      room.state = "fetching";
      // the room's own nurse fetches the patient
      orNurses[k].jobs.push(
        job(
          () => true,
          function* (n) {
            yield* escort(n, p, C(O.dropSpot));
            p.leftPreop = true;
            preopBays[p.bay] = null;
            p.preopNurse.load--;
            p.stage = "or";
            p.inBed = false;
            yield goTo(p, O.tableSpot);
            p.onTable = true;
          },
        ),
      );
      surgeon.jobs.push(job(() => true, function* (s) {
        yield goTo(s, O.surgeonSpot);
        yield () => room.state === "done";
      }));
      yield () => p.onTable && at(surgeon, O.surgeonSpot);
      // induction - anesthesia covers two rooms, so this may wait for them
      yield* attend(k, 3);
      room.state = "case";
      room.caseStart = clock;
      room.caseLength = r() < 0.2 ? between(45, 60) : between(22, 40);
      note(`OR ${k + 1} · case started`);
      yield sleep(room.caseLength);
      yield* attend(k, 3); // emergence
      room.state = "done";
      surgeon.busy = false;
      surgeon.load--;
      // the surgeon checks in at PACU once they've arrived
      surgeon.jobs.push(job(() => p.stage === "pacu" && p.inBed, function* (s) {
        yield goTo(s, L.PACU[p.pacuBay].visitSpot);
        yield sleep(2.5);
      }));
      // to recovery: a free bay and a PACU nurse with room on their list
      let nurse;
      let bay;
      yield () => {
        bay = pacuBays.indexOf(null);
        nurse = pacuNurses.filter((n) => n.load < 3).sort((a, b) => a.load - b.load)[0];
        return bay >= 0 && !!nurse;
      };
      pacuBays[bay] = p.id;
      p.pacuBay = bay;
      nurse.load++;
      note(`OR ${k + 1} · to PACU ${bay + 1}`);
      const B = L.PACU[bay];
      nurse.jobs.push(
        job(
          () => true,
          function* (n) {
            p.stage = "toPacu"; // on a stretcher
            yield* escort(n, p, C(B.curtain));
            p.onTable = false;
            room.patient = null;
            p.stage = "pacu";
            yield goTo(p, B.bedSpot);
            p.inBed = true;
            p.recoverStart = clock;
            p.recoverLength = between(22, 35);
            yield goTo(n, B.nurseSpot);
            yield sleep(3); // settle them in
          },
        ),
      );
      become(p, recover(p, nurse));
      yield () => room.patient === null;
      room.state = "turnover";
      yield sleep(7);
    }
  }

  // anesthesia comes to the head of the table for `secs`
  function* attend(k, secs) {
    const a = anesFor(k);
    yield () => !a.busy;
    a.busy = true;
    const spot = L.ORS[k].anesSpot;
    let done = false;
    a.jobs.unshift(job(() => true, function* (s) {
      yield goTo(s, spot);
      yield () => done;
    }));
    yield () => at(a, spot);
    yield sleep(secs);
    done = true;
    a.busy = false;
  }

  function* recover(p, nurse) {
    yield () => p.inBed && p.stage === "pacu";
    yield () => clock - p.recoverStart >= p.recoverLength;
    nurse.load--;
    p.inBed = false;
    p.stage = "discharge";
    note(`PACU ${p.pacuBay + 1} · discharged`);
    const curtain = L.PACU[p.pacuBay].curtain;
    become(p, (function* () {
      // the bay is only free once they're actually out of it - a bed is a
      // dead end, so the next patient can't be walking in as they walk out
      yield goTo(p, curtain);
      pacuBays[p.pacuBay] = null;
      yield goTo(p, L.DESPAWN);
      stats.done++;
      stats.inSystem--;
      stats.timeInSystem += clock - p.arrivedAt;
      people.delete(p.id);
    })());
  }

  // ── "You": roam the unit, or go where the camera is looking ──
  function* youLife(y) {
    let i = 0;
    for (;;) {
      const m = y.mode;
      if (m.kind === "bay") yield goTo(y, L.PACU[m.bay].youSpot);
      else if (m.kind === "or") yield goTo(y, L.ORS[m.room].youSpot);
      else {
        i = (i + 1) % L.YOU_ROUTE.length;
        yield goTo(y, L.YOU_ROUTE[i]);
        yield sleep(2);
      }
      yield () => y.mode !== m || m.kind === "roam";
    }
  }

  staff.forEach((s) => (s.co = staffLife(s)));
  you.co = youLife(you);
  const roomProcs = rooms.map((_, k) => orLife(k));
  let nextArrival = 0;

  // ── The engine ──────────────────────────────────────────
  function run(co, owner) {
    // resume while the awaited condition holds (several steps can complete in one tick)
    for (let guard = 0; guard < 20; guard++) {
      if (owner.wait && !owner.wait()) return;
      const { value, done } = co.next();
      if (done) {
        owner.wait = null;
        return true;
      }
      owner.wait = value;
    }
  }
  const roomWaits = rooms.map(() => ({ wait: null }));

  function tick() {
    clock += TICK;
    ticks++;
    stats.area += stats.inSystem * TICK;
    if (clock >= nextArrival) {
      arrive();
      nextArrival = clock + exp(10); // ≈ what twelve rooms can actually turn over
    }
    admitFromOutside();
    dispatch();
    roomProcs.forEach((co, k) => run(co, roomWaits[k]));
    for (const p of [...people.values()]) {
      const co = p.co;
      if (!co) continue;
      // a finished process is cleared - unless it handed over to a new one
      if (run(co, p) && p.co === co) p.co = null;
    }

    // plan every REPLAN ticks, or sooner if someone's plan has run out
    const movers = [...people.values()];
    const exhausted = () => movers.some((p) => !p.leader && p.goal !== undefined && p.goal !== p.cell && p.step >= p.plan.length - 1);
    if (ticks % REPLAN === 0 || ((replanSoon || exhausted()) && ticks - lastPlan >= 2)) {
      lastPlan = ticks;
      for (const p of movers) {
        // people kept waiting get pushed up the order, so nobody starves
        p.priority = PRIORITY[p.role] + (p.leader ? 4 : 0) + (p.follower ? 1 : 0) + Math.min(3, p.blocked * 0.5);
      }
      planner.planAll(movers);
      movers.forEach((p) => (p.step = 0));
      replanSoon = false;
    }
    execute(movers);
  }

  // Take the next step of everyone's plan; if two would still collide
  // (rare - a plan made on stale information), the lower priority waits.
  function execute(movers) {
    const want = new Map();
    for (const p of movers) {
      p.prev = p.cell;
      const next = p.plan.length ? p.plan[Math.min(p.step + 1, p.plan.length - 1)] : p.cell;
      want.set(p, next);
    }
    // Resolve whatever the plans got wrong. Someone staying in a cell keeps
    // it and anyone stepping in waits; otherwise the higher priority steps
    // in. Waiting can free or block other cells, so repeat until settled.
    const hold = (p) => {
      want.set(p, p.cell);
      if (p.follower) want.set(p.follower, p.follower.cell);
      if (p.leader) want.set(p.leader, p.leader.cell);
    };
    for (let changed = true, guard = 0; changed && guard < 50; guard++) {
      changed = false;
      const byCell = new Map();
      for (const [p, c] of want) {
        if (!byCell.has(c)) byCell.set(c, []);
        byCell.get(c).push(p);
      }
      for (const [c, group] of byCell) {
        if (group.length < 2) continue;
        const stayer = group.find((p) => p.cell === c);
        const keep = stayer || group.reduce((a, b) => (b.priority > a.priority || (b.priority === a.priority && b.id < a.id) ? b : a));
        for (const p of group) if (p !== keep && want.get(p) !== p.cell) {
          hold(p);
          changed = true;
        }
      }
      // no swapping through each other
      for (const [p, c] of want) {
        if (c === p.cell) continue;
        const o = [...(byCell.get(p.cell) || [])].find((q) => q !== p && q.cell === c);
        if (o) {
          hold(o.priority > p.priority ? p : o);
          changed = true;
        }
      }
    }
    for (const [p, c] of want) {
      if (c === p.cell && p.goal !== undefined && p.goal !== p.cell && !p.leader) p.blocked += TICK;
      else if (c !== p.cell) p.blocked = 0;
      if (p.plan.length && c === p.plan[Math.min(p.step + 1, p.plan.length - 1)]) p.step++;
      else replanSoon = true;
      p.cell = c;
    }
    // bookkeeping: nobody should ever share a cell
    const seen = new Map();
    for (const p of movers) {
      if (seen.has(p.cell)) {
        stats.conflicts++;
        const o = seen.get(p.cell);
        stats.lastConflict = `${o.role}#${o.id}(${o.stage || ""}) & ${p.role}#${p.id}(${p.stage || ""}) at ${p.cell % L.COLS},${(p.cell / L.COLS) | 0}`;
      }
      seen.set(p.cell, p);
    }
  }

  const busy = (arr) => arr.filter((x) => x !== null).length;
  return {
    grid,
    planner,
    people,
    rooms,
    you,
    log,
    stats,
    tick,
    get clock() {
      return clock;
    },
    // census, for the monitor and the inspector
    get preop() {
      return preopBays;
    },
    get or() {
      return rooms.map((rm) => (rm.patient ? rm.patient.id : rm.state === "turnover" ? "turnover" : null));
    },
    get pacu() {
      return pacuBays;
    },
    get waiting() {
      return [...people.values()].filter((p) => p.role === "patient" && (p.stage === "waiting" || p.stage === "arriving")).concat(pending);
    },
    get little() {
      const T = clock || 1;
      const L_ = stats.area / T;
      const λ = stats.arrived / T;
      const W = stats.done ? stats.timeInSystem / stats.done : 0;
      return { L: L_, λ, W, λW: λ * W, done: stats.done };
    },
    surge(n = 6) {
      for (let k = 0; k < n; k++) arrive();
      note(`surge · ${n} arrivals`);
    },
    set closed(k) {
      closed = k;
      note(k ? `${k} ORs closed` : "all ORs open");
    },
    get closed() {
      return closed;
    },
    busy,
  };
}
