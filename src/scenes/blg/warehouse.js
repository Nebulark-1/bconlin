// Illustrative sketch written for this site - not the firm's code, schema or
// data. It demonstrates the technique the real dashboard depended on: what a
// signed-in person can see is decided on the server, by role, before any
// query runs, so values they aren't entitled to never reach their browser.

/** What each role may see. Scope narrows rows; columns narrow fields. */
export const POLICY = {
  partner: { scope: "firm", columns: ["collected", "cost", "margin", "realization"] },
  manager: { scope: "firm", columns: ["collected", "realization"] },
  attorney: { scope: "own", columns: ["collected", "realization"] },
  staff: { scope: "none", columns: [] },
};

export const COLUMNS = ["collected", "cost", "margin", "realization"];

/**
 * Build the parameterized query a role's dashboard runs. Row scope becomes a
 * WHERE clause bound to the signed-in user; columns a role can't see are
 * never selected - there is nothing to hide client-side because it was
 * never sent.
 */
export function scopedQuery(role, userId) {
  const policy = POLICY[role];
  if (!policy || policy.scope === "none") return { denied: true };
  const select = {
    collected: "SUM(p.amount) AS collected",
    cost: "SUM(c.amount) AS cost",
    margin: "SUM(p.amount) - SUM(c.amount) AS margin",
    realization: "SUM(p.amount) / SUM(i.billed) AS realization",
  };
  const sql = [
    `SELECT a.name, ${policy.columns.map((col) => select[col]).join(", ")}`,
    "FROM attorneys a",
    "JOIN invoices i ON i.attorney_id = a.id",
    "JOIN payments p ON p.invoice_id = i.id",
    policy.columns.includes("cost") ? "JOIN costs c ON c.attorney_id = a.id" : null,
    policy.scope === "own" ? "WHERE a.user_id = :user_id" : null,
    "GROUP BY a.id",
  ]
    .filter(Boolean)
    .join("\n");
  return { sql, params: policy.scope === "own" ? { user_id: userId } : {}, policy };
}

// Illustrative numbers only - invented for the demo.
export const DEMO_ROWS = [
  { name: "Attorney A", user: 1, collected: 412, cost: 228, realization: 0.94 },
  { name: "Attorney B", user: 2, collected: 268, cost: 181, realization: 0.81 },
  { name: "Attorney C", user: 3, collected: 355, cost: 204, realization: 0.9 },
  { name: "Attorney D", user: 4, collected: 197, cost: 166, realization: 0.72 },
  { name: "Attorney E", user: 5, collected: 301, cost: 172, realization: 0.88 },
].map((r) => ({ ...r, margin: r.collected - r.cost }));

/** What the dashboard actually receives for a role: the rows and fields the
 *  scoped query would return, and nothing else. */
export function dashboardFor(role, userId) {
  const q = scopedQuery(role, userId);
  if (q.denied) return { denied: true, rows: [], columns: [] };
  const rows = DEMO_ROWS.filter((r) => q.policy.scope === "firm" || r.user === userId);
  return { rows: rows.map((r) => Object.fromEntries(["name", ...q.policy.columns].map((k) => [k, r[k]]))), columns: q.policy.columns };
}
