// Inspector topics for the Business Law Group chapter. Each one says what was
// actually built at the firm, in plain functional terms, and is clear about
// the code it shows: either this page's own (simplified) code, or an
// illustrative sketch written for the site. Nothing here is the firm's code.

import choreoSrc from "../scenes/blg/choreo.js?raw";
import normalizeSrc from "../scenes/blg/reference/normalize.py?raw";
import sessionSrc from "../scenes/blg/reference/session.php?raw";
import opsSrc from "../scenes/blg/reference/blg-ops.php?raw";
import warehouseSrc from "../scenes/blg/warehouse.js?raw";
import intranetSrc from "../scenes/blg/intranet.js?raw";
import { BINS, BIN_LABELS } from "../scenes/blg/choreo.js";
import { COLUMNS, dashboardFor, scopedQuery } from "../scenes/blg/warehouse.js";
import { MANUAL, searchManual } from "../scenes/blg/intranet.js";

const C = { cyan: "#5ec8ff", green: "#6cf0c2", warm: "#ffb48c", red: "#ff6b6b", dim: "rgba(160,200,240,.35)", text: "#bfe6ff" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

const money = (n) => `$${n.toFixed(2)}`;

// ── Ledger matching ─────────────────────────────────────────
const ledgerTopic = {
  id: "ledger",
  chip: "Ledger matching",
  kicker: "Greedy bipartite matching",
  provenance: "site",
  title: "Every expense to its receipt",
  summary:
    "<b>What I built:</b> for a six-tax-year audit, a pipeline that pulled the transactions out of tens of thousands of pages and produced a cross-validated ledger matching every expense to its receipt, in about 50 hours of work instead of a projected 200+.<br><br><b>What’s below:</b> the matcher that draws this page’s audit beat, a simplified version of the reconciliation step. Every (ledger row, receipt) pair within a cent and five days is a candidate, scored by date distance; candidates are taken best-first, each side used once. Whatever is left over is an exception for a person, which is exactly where their time should go.",
  sources: [{ file: "src/scenes/blg/choreo.js", src: choreoSrc, name: "matchLedger", marks: ["candidates.sort", "usedL.has(c.li)", "exceptions"] }],
  viz(ctx, w, h, t, S) {
    const { receipts, ledger } = S.audit;
    const { pairs, exceptions } = S.match;
    const n = receipts.length;
    const y = (k) => 14 + (k * (h - 24)) / (n - 1);
    const xl = 92;
    const xr = w - 92;
    const shown = Math.min(pairs.length, Math.floor((t * 4) % (pairs.length + 6)));
    ctx.lineWidth = 1.5;
    pairs.forEach((p, k) => {
      ctx.strokeStyle = k < shown ? C.cyan : "rgba(94,200,255,.12)";
      ctx.beginPath();
      ctx.moveTo(xl, y(p.ri));
      ctx.bezierCurveTo((xl + xr) / 2, y(p.ri), (xl + xr) / 2, y(p.li), xr, y(p.li));
      ctx.stroke();
    });
    receipts.forEach((rc, k) => label(ctx, rc.vendor.slice(0, 11), 6, y(k) + 3, C.text, 9));
    ledger.forEach((row, k) => label(ctx, money(row.amount), xr + 8, y(k) + 3, exceptions.includes(k) ? C.red : C.text, 9));
  },
  live(S) {
    const { pairs, exceptions, considered } = S.match;
    return [
      `pairs considered   ${considered}  (n × m)`,
      `result             ${pairs.length} matched · ${exceptions.length} exception${exceptions.length === 1 ? "" : "s"}`,
      ...exceptions.map((li) => `exception          ${S.audit.ledger[li].payee} ${money(S.audit.ledger[li].amount)}}  no receipt within a cent`),
    ];
  },
};

// ── Document router ─────────────────────────────────────────
const routerTopic = {
  id: "router",
  chip: "Document router",
  kicker: "Rules + model + human review",
  provenance: "site",
  title: "Route what you’re sure of; ask about the rest",
  summary:
    "<b>What I built:</b> a pipeline that took tens of thousands of documents a year (OCR for scans, in-house Whisper transcription for audio), identified each one, and routed it: fixed rules for known forms, a classifier for everything else, and low-confidence calls sent to a person whose corrections fed back as training signal.<br><br><b>What’s below:</b> route(), this page’s simplified version of that decision, which tags the documents in the “Sorted” beat.",
  sources: [{ file: "src/scenes/blg/choreo.js", src: choreoSrc, name: "route", marks: ["const rule", "review: confidence < threshold"] }],
  viz(ctx, w, h, t, S) {
    const cw = (w - 20) / BINS.length;
    BINS.forEach((kind, c) => {
      S.sheets
        .filter((s) => s.kind === kind)
        .forEach((s, k) => {
          const x = 10 + c * cw + 8 + (k % 4) * ((cw - 16) / 4);
          const yy = h - 30 - Math.floor(k / 4) * 26;
          const r = s.route;
          ctx.fillStyle = r.by === "rule" ? "rgba(94,200,255,.35)" : r.review ? "rgba(255,180,140,.55)" : "rgba(108,240,194,.35)";
          ctx.strokeStyle = r.by === "rule" ? C.cyan : r.review ? C.warm : C.green;
          ctx.fillRect(x, yy, (cw - 16) / 4 - 4, 20);
          ctx.strokeRect(x + 0.5, yy + 0.5, (cw - 16) / 4 - 5, 19);
        });
      label(ctx, BIN_LABELS[kind], 10 + c * cw + 8, h - 6, C.text, 9);
    });
    label(ctx, "■ rule", 10, 12, C.cyan);
    label(ctx, "■ model ≥ 0.80", 70, 12, C.green);
    label(ctx, "■ to a person", 186, 12, C.warm);
  },
  live(S) {
    const by = (fn) => S.sheets.filter(fn).length;
    return [
      `documents     ${S.sheets.length}`,
      `by rule       ${by((s) => s.route.by === "rule")}  (confidence 1.00)`,
      `by model      ${by((s) => s.route.by === "model" && !s.route.review)}  (≥ 0.80)`,
      `to review     ${by((s) => s.route.review)}  → corrections become training signal`,
    ];
  },
};

// ── Financial database ──────────────────────────────────────
const ROLE_LABEL = { partner: "Partner", manager: "Firm manager", attorney: "Attorney C", staff: "Staff" };
const ME = 3; // the signed-in attorney when viewing as "Attorney C"
const COL_LABEL = { collected: "Collected", cost: "Cost", margin: "Margin", realization: "Realized" };

const warehouseTopic = {
  id: "warehouse",
  chip: "Financial database",
  kicker: "Full stack · SQL · Python · PHP",
  provenance: "sketch",
  vizHeight: 210,
  title: "One source of truth, served by role",
  summary:
    "<b>What I built:</b> a full-stack financial database for the firm. Years of report exports were consolidated into a relational database; Python exposed and manipulated the data; and a PHP / JS / CSS dashboard put it in front of people, with logins, concurrent sessions, and access that depended on role and title, so each person saw only the values they were entitled to. Its reports informed compensation, staffing, and the move to flat-rate billing.<br><br><b>What’s below:</b> an illustrative sketch of the core technique: access decided on the server before any query runs. Switch roles: rows outside your scope aren’t returned, and fields you can’t see are never selected, so there’s nothing to hide in the browser. (Names and numbers are invented.)",
  sources: [
    { file: "src/scenes/blg/warehouse.js", src: warehouseSrc, name: "scopedQuery", marks: ["policy.scope", "WHERE a.user_id = :user_id"] },
    { file: "src/scenes/blg/reference/session.php", src: sessionSrc, name: null, marks: ["password_verify", "MAX_SESSIONS_PER_USER", "http_response_code(403)"] },
    { file: "src/scenes/blg/reference/normalize.py", src: normalizeSrc, name: null, marks: ["def normalize", "def reconcile", "PermissionError"] },
  ],
  actions: Object.keys(ROLE_LABEL).map((role) => ({
    label: `View as ${ROLE_LABEL[role]}`,
    run: (scene) => (scene.stats.role = role),
    isOn: (S) => S.role === role,
  })),
  viz(ctx, w, h, t, S) {
    const view = dashboardFor(S.role, ME);
    ctx.strokeStyle = "rgba(120,180,240,.35)";
    ctx.strokeRect(6.5, 6.5, w - 13, h - 13);
    label(ctx, `signed in as ${ROLE_LABEL[S.role]}`, 16, 24, "#fff", 10);
    label(ctx, "2 active sessions · laptop, phone", w - 16, 24, C.dim, 9, "right");
    if (view.denied) {
      ctx.fillStyle = "rgba(255,107,107,.08)";
      ctx.fillRect(16, 38, w - 32, h - 54);
      label(ctx, "403 · not permitted", w / 2, h / 2 + 4, C.red, 14, "center");
      label(ctx, "staff dashboards never query firm financials", w / 2, h / 2 + 22, C.dim, 9, "center");
      return;
    }
    // every column is drawn; ones this role can't see are hatched - they
    // were never selected, so they aren't in the response at all
    const cols = ["name", ...COLUMNS];
    const cw = (w - 32) / cols.length;
    const top = 44;
    const rh = (h - top - 14) / 6;
    cols.forEach((col, c) => {
      const x = 16 + c * cw;
      const allowed = col === "name" || view.columns.includes(col);
      label(ctx, col === "name" ? "Attorney" : COL_LABEL[col], x + 4, top + 12, allowed ? C.cyan : C.dim, 9);
      if (allowed) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top + 18, cw - 4, rh * 5);
      ctx.clip();
      ctx.strokeStyle = "rgba(160,200,240,.15)";
      for (let d = -rh * 5; d < cw + rh * 5; d += 7) {
        ctx.beginPath();
        ctx.moveTo(x + d, top + 18);
        ctx.lineTo(x + d + rh * 5, top + 18 + rh * 5);
        ctx.stroke();
      }
      ctx.restore();
    });
    view.rows.forEach((row, r) => {
      const y = top + 18 + r * rh + rh * 0.65;
      cols.forEach((col, c) => {
        if (!(col in row)) return;
        const v = row[col];
        const text = col === "name" ? v : col === "realization" ? `${Math.round(v * 100)}%` : `$${v}k`;
        label(ctx, text, 16 + c * cw + 4, y, "#e9f6ff", 9);
      });
    });
    if (view.rows.length === 1) label(ctx, "only your own row is returned", w - 16, h - 14, C.dim, 9, "right");
  },
  live(S) {
    const q = scopedQuery(S.role, ME);
    if (q.denied) return [`role: ${ROLE_LABEL[S.role]}`, "→ 403 before any query is built."];
    return [`role: ${ROLE_LABEL[S.role]}  ·  params ${JSON.stringify(q.params)}`, "", ...q.sql.split("\n")];
  },
};

// ── Firm intranet ───────────────────────────────────────────
const intranetTopic = {
  id: "intranet",
  chip: "Firm intranet",
  kicker: "WordPress · custom plugins",
  provenance: "sketch",
  vizHeight: 190,
  title: "The operations manual, and everything around it",
  summary:
    "<b>What I built:</b> the firm’s intranet on WordPress: the operations manual, curated links, custom tools and analyses, and custom plugins for the functionality WordPress didn’t have. The manual was searchable, which is a large part of why leadership interruptions dropped by about half.<br><br><b>What’s below:</b> an illustrative sketch written for this site: a working search index over generic sample procedures, and the shape of a WordPress plugin. Type in the box to search.",
  sources: [
    { file: "src/scenes/blg/intranet.js", src: intranetSrc, name: "searchManual", marks: ["const idf", "startsWith"] },
    { file: "src/scenes/blg/reference/blg-ops.php", src: opsSrc, name: null, marks: ["register_post_type", "add_shortcode", "check_admin_referer", "register_rest_route"] },
  ],
  actions: [
    { type: "search", placeholder: "Search the sample manual…", value: (S) => S.query, run: (scene, text) => (scene.stats.query = text) },
    ...["pto", "new client", "vpn", "irs"].map((q) => ({ label: `“${q}”`, fills: q, run: (scene) => (scene.stats.query = q), isOn: (S) => S.query === q })),
  ],
  viz(ctx, w, h, t, S) {
    const q = S.query.trim();
    const results = q ? searchManual(q) : [];
    label(ctx, q ? `results for “${q}”` : "type a query…", 10, 16, "#fff", 10);
    if (q && !results.length) label(ctx, "no matching procedures", 10, 40, C.dim, 10);
    const max = Math.max(1, ...results.map((r) => r.score));
    results.forEach((r, k) => {
      const y = 34 + k * ((h - 40) / 4);
      label(ctx, r.title, 10, y + 10, k ? C.text : "#fff", 10);
      ctx.fillStyle = k ? "rgba(94,200,255,.35)" : C.cyan;
      ctx.fillRect(10, y + 16, ((w - 90) * r.score) / max, 5);
      label(ctx, r.score.toFixed(1), w - 10, y + 22, C.dim, 9, "right");
    });
  },
  live(S) {
    const q = S.query.trim();
    const results = q ? searchManual(q) : [];
    return [
      `query   “${q}”`,
      `ranked  ${results.map((r) => `${r.title} (${r.score.toFixed(1)})`).join(" · ") || "none"}`,
      `index   ${MANUAL.length} sample procedures · title ×3, tags ×2, body ×1 · prefix matching`,
    ];
  },
};

export const blgTopics = [ledgerTopic, routerTopic, warehouseTopic, intranetTopic];
