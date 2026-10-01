// Pure functions behind the Business Law Group chapter: the documents, how
// they're routed, how receipts reconcile to the ledger, and where every
// sheet sits at any scroll position. No DOM here - the scene renders it and
// the code inspector shows it.

import { rng } from "../../art/draw.js";
import { clamp, lerp, easeInOutCubic } from "../../engine/math.js";

export const BEATS = 5;
export const SHEETS = 48;

const KINDS = {
  notice: ["IRS NOTICE CP2000", "IRS NOTICE CP14", "IRS NOTICE CP504", "LETTER 1058", "IRS NOTICE CP90"],
  contract: ["ASSET PURCHASE AGREEMENT", "SHARE PURCHASE AGREEMENT", "OPERATING AGREEMENT", "ENGAGEMENT LETTER", "CEASE AND DESIST"],
  transcript: ["ACCOUNT TRANSCRIPT", "WAGE & INCOME TRANSCRIPT", "RECORD OF ACCOUNT", "TAX RETURN TRANSCRIPT"],
  receipt: ["RECEIPT"],
};
export const BINS = ["notice", "contract", "transcript", "receipt"];
export const BIN_LABELS = { notice: "IRS notices", contract: "Contracts", transcript: "Transcripts", receipt: "Receipts" };

/** 48 documents, 12 of each kind, in a deterministic shuffled order. */
export function makeSheets(seed = 7) {
  const r = rng(seed);
  const sheets = [];
  BINS.forEach((kind) => {
    for (let k = 0; k < 12; k++) {
      const titles = KINDS[kind];
      sheets.push({ kind, k, title: titles[Math.floor(r() * titles.length)], jx: r() + r() - 1, jy: r() + r() - 1, jr: r() * 2 - 1, signal: r() });
    }
  });
  for (let i = sheets.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [sheets[i], sheets[j]] = [sheets[j], sheets[i]];
  }
  sheets.forEach((s, i) => {
    s.i = i;
    s.route = route(s);
  });
  return sheets;
}

/**
 * Route a document: known IRS forms are matched by rule with full
 * confidence; everything else gets a classifier score, and anything under
 * the threshold goes to a human review queue (whose corrections become
 * training signal).
 */
export function route(doc, threshold = 0.8) {
  const rule = /\b(CP\d+|LETTER \d+|TRANSCRIPT|RECEIPT)\b/.exec(doc.title);
  if (rule) return { bin: doc.kind, by: "rule", confidence: 1, review: false };
  const confidence = 0.6 + doc.signal * 0.4; // stand-in for the model's score
  return { bin: doc.kind, by: "model", confidence, review: confidence < threshold };
}

// ── The audit: receipts vs. ledger ────────────────────────────
const VENDORS = ["Office Depot", "Delta Air Lines", "Hertz", "Marriott", "Shell", "Staples", "Comcast", "AT&T", "Costco", "Home Depot", "FedEx", "Adobe"];

/** Twelve receipts and the ledger lines they should reconcile to - with the
 *  usual mess: posting delays, re-ordered rows, and one bad entry. */
export function makeAudit(seed = 19) {
  const r = rng(seed);
  const receipts = VENDORS.map((vendor, k) => ({
    id: k,
    vendor,
    day: 10 + Math.floor(r() * 330),
    amount: Math.round((20 + r() ** 2 * 1800) * 100) / 100,
  }));
  const ledger = receipts.map((rc) => ({ id: rc.id, payee: rc.vendor, day: rc.day + Math.floor(r() * 4), amount: rc.amount }));
  ledger[5].amount = Math.round((ledger[5].amount + 112.4) * 100) / 100; // a posting error to catch
  for (let i = ledger.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ledger[i], ledger[j]] = [ledger[j], ledger[i]];
  }
  return { receipts, ledger };
}

/**
 * Reconcile ledger rows to receipts. Every (row, receipt) pair within a cent
 * and a few days is a candidate, scored by date distance; candidates are
 * taken greedily, best first, each side used at most once. Rows left over
 * are exceptions for a person to look at.
 */
export function matchLedger(ledger, receipts, { days = 5 } = {}) {
  const candidates = [];
  ledger.forEach((row, li) =>
    receipts.forEach((rc, ri) => {
      const dd = Math.abs(row.day - rc.day);
      if (Math.abs(row.amount - rc.amount) < 0.01 && dd <= days) candidates.push({ li, ri, score: dd });
    }),
  );
  candidates.sort((a, b) => a.score - b.score);
  const usedL = new Set();
  const usedR = new Set();
  const pairs = [];
  for (const c of candidates) {
    if (usedL.has(c.li) || usedR.has(c.ri)) continue;
    usedL.add(c.li);
    usedR.add(c.ri);
    pairs.push(c);
  }
  const exceptions = ledger.map((_, li) => li).filter((li) => !usedL.has(li));
  return { pairs, exceptions, considered: ledger.length * receipts.length };
}

// ── Choreography ─────────────────────────────────────────────
// A sheet's state: centre (x, y), size (w, h), rotation, opacity, and how
// much it reads as paper (text lines) vs. ink (a solid data block).
const state = (x, y, w, h, r = 0, o = 1, paper = 1, ink = 0) => ({ x, y, w, h, r, o, paper, ink });

const mix = (a, b, t) => {
  const out = {};
  for (const k in a) out[k] = lerp(a[k], b[k], t);
  return out;
};

export const BAR_VALUES = [0.92, 0.58, 0.76, 0.41, 0.67, 0.86, 0.33, 0.62];

/** Where sheet `s` rests in beat `b`, inside the visual region R. */
export function layout(b, s, R, unit) {
  const W = unit;
  const H = unit * 1.3;
  const bin = BINS.indexOf(s.kind);
  if (b === 0) {
    // a messy pile
    return state(R.x + R.w * 0.5 + s.jx * R.w * 0.2, R.y + R.h * 0.6 + s.jy * R.h * 0.12 - s.i * 0.8, W, H, s.jr * 16);
  }
  if (b === 1) {
    // sorted into four bins, neat stacks
    return state(R.x + R.w * (0.125 + bin * 0.25) + s.jx * 3, R.y + R.h * 0.7 - s.k * R.h * 0.014, W * 0.92, H * 0.92, s.jr * 2.5);
  }
  if (b === 2) {
    // receipts become slips beside the ledger; everything else drops away
    if (s.kind !== "receipt") return state(R.x + R.w * (0.125 + bin * 0.25), R.y + R.h * 1.3, W * 0.9, H * 0.9, s.jr * 20, 0);
    return state(R.x + R.w * 0.11, R.y + R.h * (0.09 + s.k * 0.066), R.w * 0.16, R.h * 0.055, 0, 1, 0.5);
  }
  if (b === 3) {
    // every sheet becomes a block in a bar chart
    const bar = s.i % 8;
    const seg = Math.floor(s.i / 8);
    const total = R.h * 0.72 * BAR_VALUES[bar];
    const segH = total / 6;
    const x = R.x + R.w * (0.1 + bar * 0.115);
    return state(x, R.y + R.h * 0.86 - (seg + 0.5) * segH, R.w * 0.075, segH - 2, 0, 1, 0, 1);
  }
  // b === 4: blocks become the intranet's tiles (eight stacked per tile)
  const tile = s.i % 6;
  const col = tile % 3;
  const row = Math.floor(tile / 3);
  const left = R.x + R.w * 0.25;
  const tw = (R.w * 0.73 - 16) / 3;
  const th = R.h * 0.3;
  return state(left + col * (tw + 8) + tw / 2, R.y + R.h * 0.3 + row * (th + 8) + th / 2, tw, th, 0, 1, 0, 0);
}

/** Before beat 0: hanging above the panel, ready to fall. */
const sky = (s, R, unit) => state(R.x + R.w * 0.5 + s.jx * R.w * 0.5, R.y - R.h * 0.6 - s.i * 6, unit, unit * 1.3, s.jr * 60, 0);
const at = (b, s, R, unit) => (b < 0 ? sky(s, R, unit) : layout(b, s, R, unit));

/**
 * Where sheet `s` is partway through a move from layout `from` to layout
 * `to`, at move-clock t (0→1). Sheets set off in index order across the
 * first 30% of the move and each eases over the remaining 70%, so the change
 * ripples through the stack.
 */
export function sheetBetween(s, from, to, t, R, unit) {
  const delay = (s.i / SHEETS) * 0.3;
  const k = easeInOutCubic(clamp((t - delay) / 0.7));
  return mix(at(from, s, R, unit), at(to, s, R, unit), k);
}

export { createConductor } from "../../engine/conductor.js";
