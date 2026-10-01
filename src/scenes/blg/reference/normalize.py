# Illustrative sketch written for this site - not the firm's code, schema or
# data. It shows the kinds of steps a data layer like the real one performs:
# normalizing messy spreadsheet exports, loading them transactionally,
# reconciling totals against known figures, and returning role-scoped results
# for a web dashboard to display.

import sqlite3
import pandas as pd

HEADERS = {
    "atty": "attorney", "attorney name": "attorney",
    "matter #": "matter_id", "matter no": "matter_id",
    "amt": "amount", "amount collected": "amount",
    "date rec'd": "received_on", "received": "received_on",
}


def normalize(path: str) -> pd.DataFrame:
    """One legacy export -> clean rows with canonical names and types."""
    df = pd.read_excel(path, header=None)
    header_row = df.notna().sum(axis=1).idxmax()          # first fully populated row
    df.columns = [str(c).strip().lower() for c in df.iloc[header_row]]
    df = df.iloc[header_row + 1:].rename(columns=HEADERS)
    df = df.dropna(how="all").ffill()                    # merged cells in the source
    df["amount"] = pd.to_numeric(df["amount"].astype(str).str.replace(r"[$,]", "", regex=True))
    df["received_on"] = pd.to_datetime(df["received_on"], errors="coerce")
    return df.drop_duplicates(subset=["matter_id", "received_on", "amount"])


def load(df: pd.DataFrame, db: sqlite3.Connection) -> None:
    """Attach each payment to its matter's latest invoice, one transaction per file."""
    with db:
        db.executemany(
            """INSERT INTO payments (invoice_id, amount, received_on)
               SELECT i.id, ?, ? FROM invoices i
               WHERE i.matter_id = ? ORDER BY i.issued_on DESC LIMIT 1""",
            ((r.amount, r.received_on.date().isoformat(), r.matter_id) for r in df.itertuples()),
        )


def reconcile(db: sqlite3.Connection, expected: dict[str, float]) -> list[str]:
    """Check loaded totals against independently reported figures, to the cent."""
    misses = []
    for month, total in expected.items():
        (got,) = db.execute(
            "SELECT ROUND(SUM(amount), 2) FROM payments WHERE strftime('%Y-%m', received_on) = ?",
            (month,),
        ).fetchone()
        if abs((got or 0) - total) > 0.005:
            misses.append(f"{month}: warehouse {got} vs reported {total}")
    return misses


def margins(db: sqlite3.Connection, role: str, attorney_id: int | None) -> list[dict]:
    """Per-attorney margin, scoped by the caller's role (the web layer passes it in)."""
    if role == "staff":
        raise PermissionError("staff cannot view firm financials")
    scope = "AND a.id = ?" if role == "attorney" else ""
    params = (attorney_id,) if role == "attorney" else ()
    rows = db.execute(f"""
        SELECT a.name,
               SUM(p.amount)                    AS collected,
               (SELECT SUM(c.amount) FROM attorney_costs c WHERE c.attorney_id = a.id) AS cost
        FROM attorneys a
        JOIN matters  m ON m.lead_attorney_id = a.id
        JOIN invoices i ON i.matter_id = m.id
        JOIN payments p ON p.invoice_id = i.id
        WHERE 1 = 1 {scope}
        GROUP BY a.id
    """, params).fetchall()
    return [{"attorney": n, "collected": c, "margin": c - (k or 0)} for n, c, k in rows]
