// Illustrative sketch, written for this page. It shows the idea behind
// Chaos Coaching's guardrails: the AI coach proposes a week, and plain code
// decides whether it can be saved. The rules are simplified versions of the
// ones on the app's public How it works page, and the numbers are
// placeholders. This is not the app's code.

const LIMITS = {
  weeklyStep: 0.1, // volume may climb about this much at once (placeholder)
  hardDays: 2, // two hard days a week, not three
  painCeiling: 5, // above this, pain says hold (out of 10)
  repeats: 3, // the same spot this often is a pattern
};

/** Does recent pain say "don't add load"? Behaviour counts, not just the number. */
export function painSaysHold(entries) {
  for (const p of entries) {
    if (p.moved) return `${p.site} pain changed how you moved`;
    if (p.pain > LIMITS.painCeiling) return `${p.site} pain was ${p.pain}/10`;
  }
  const bySite = {};
  for (const p of entries) bySite[p.site] = (bySite[p.site] || 0) + 1;
  for (const [site, n] of Object.entries(bySite)) if (n >= LIMITS.repeats) return `${site} has come up ${n} times lately`;
  return null;
}

/**
 * Check a proposed week. Each finding is a "stop" (the week isn't saved)
 * or a "note" (saved, with the problem shown to the athlete).
 */
export function checkWeek(week, lastWeekMiles, pain) {
  const findings = [];
  const miles = week.days.flatMap((d) => d.sessions).reduce((n, s) => n + (s.sport === "run" ? s.miles : 0), 0);
  const hard = week.days.map((d) => d.sessions.some((s) => s.hard));

  if (miles > lastWeekMiles * (1 + LIMITS.weeklyStep)) findings.push({ level: "note", text: `Mileage climbs from ${lastWeekMiles} to ${miles}, faster than the weekly limit.` });
  const hardCount = hard.filter(Boolean).length;
  if (hardCount > LIMITS.hardDays) findings.push({ level: "stop", text: `${hardCount} hard days. Two is the most.` });
  if (hard.some((h, i) => h && hard[i - 1])) findings.push({ level: "note", text: "Two hard days in a row. They need a day between them." });

  const hold = painSaysHold(pain);
  if (hold && miles > lastWeekMiles) findings.push({ level: "stop", text: `${hold}, so the load can't go up this week.` });

  return { miles, findings, saved: !findings.some((f) => f.level === "stop") };
}
