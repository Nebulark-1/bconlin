// Sample data for the Chaos Coaching chapter: one made-up athlete, a pain
// history to choose from, and three versions of next week for the
// guardrails to judge.

// ── Sample athlete ──────────────────────────────────────────
// Last week ran 31 miles; the best of the last three was 31. The right shin
// has been logged three times in a fortnight, so the rules say hold.
export const HISTORY = { previous: 31, baseline: 31 };
export const PAIN = {
  none: [],
  recurring: [
    { date: "2026-10-03", pain: 3, site: "Right shin" },
    { date: "2026-10-07", pain: 3, site: "Right shin" },
    { date: "2026-10-10", pain: 4, site: "Right shin" },
  ],
  moved: [{ date: "2026-10-10", pain: 3, site: "Right knee", moved: true }],
  once: [{ date: "2026-10-10", pain: 4, site: "Right shin" }],
};

const S = (sport, title, miles, intensity = "easy") => ({ sport, title, miles, hard: ["tempo", "hills", "intervals"].includes(intensity) });
const week = (deload, ...days) => ({ deload, days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dow, i) => ({ dow, sessions: days[i] || [] })) });

export const PROPOSALS = [
  {
    key: "coach",
    label: "The coach's plan",
    plan: week(
      false,
      [S("mobility", "Runner's reset", 0)],
      [S("run", "6 mi easy", 6), S("lift", "Session A", 0)],
      [S("run", "7 mi · 3 × 1 mi tempo", 7, "tempo")],
      [S("run", "5 mi easy", 5)],
      [S("bike", "45 min easy spin", 0)],
      [S("run", "3 mi easy + strides", 3), S("lift", "Session B", 0)],
      [S("run", "10 mi long", 10, "long")],
    ),
  },
  {
    key: "push",
    label: "Add four miles",
    plan: week(
      false,
      [S("mobility", "Runner's reset", 0)],
      [S("run", "7 mi easy", 7), S("lift", "Session A", 0)],
      [S("run", "8 mi · 4 × 1 mi tempo", 8, "tempo")],
      [S("run", "6 mi easy", 6)],
      [S("bike", "45 min easy spin", 0)],
      [S("run", "3 mi easy + strides", 3), S("lift", "Session B", 0)],
      [S("run", "11 mi long", 11, "long")],
    ),
  },
  {
    key: "stack",
    label: "Stack the hard days",
    plan: week(
      false,
      [S("mobility", "Runner's reset", 0)],
      [S("run", "6 mi · hills", 6, "hills"), S("lift", "Session A", 0)],
      [S("run", "7 mi · 3 × 1 mi tempo", 7, "tempo")],
      [S("run", "5 mi easy", 5)],
      [S("bike", "45 min easy spin", 0)],
      [S("run", "3 mi easy + strides", 3), S("lift", "Session B", 0)],
      [S("run", "10 mi long", 10, "long")],
    ),
  },
];

export const total = (plan) => plan.days.flatMap((d) => d.sessions).reduce((n, s) => n + (s.sport === "run" ? s.miles : 0), 0);
