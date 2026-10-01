// The résumé bank: every line I might put on a résumé, written once, each
// scored 0-10 for how well it serves each kind of role. The generator picks
// and orders lines from here; it never writes new ones. All facts come from
// my existing résumés.
//
// Scores: best (the default, strongest overall), swe (software
// engineering), data (data and analytics), it (IT and systems), ops
// (operations and leadership).

export const PROFILE = {
  name: "Ben Conlin",
  location: "Fort Collins, CO",
  email: "benaconlin@gmail.com",
  linkedin: "linkedin.com/in/benconlin",
  site: "chaoscoaching.co",
};

export const LENSES = [
  { id: "best", label: "Best overall", blurb: "My strongest single page" },
  { id: "swe", label: "Software engineering", blurb: "Systems I designed, built and shipped" },
  { id: "data", label: "Data & analytics", blurb: "Pipelines, warehouses and decisions" },
  { id: "it", label: "IT & systems", blurb: "Infrastructure, reliability and support" },
  { id: "ops", label: "Operations & leadership", blurb: "Running teams, budgets and process" },
];

export const SUMMARY = {
  best: "Computer science graduate who turns messy real-world processes into software. Built automation, data pipelines and full-stack platforms that cut hundreds of hours of manual work and served tens of thousands of users.",
  swe: "CS graduate who ships production software: an AI-coached training platform, a document classification pipeline, and a community platform that served 30,000+ users.",
  data: "Builds the pipelines, warehouses and reports that leadership acts on: firm margins that reshaped compensation and billing, and a tax audit cut from a projected 200 hours to 50.",
  it: "Systems generalist who keeps environments reliable and cheap to run: in-house IT for 20+ staff at 82% lower cost, automated provisioning and backups, and self-hosted platforms at scale.",
  ops: "Operator who builds the systems behind the work. Promoted twice in twelve months to run a law firm's operations, with tooling that saved hundreds of hours and decisions grounded in data.",
};

const s = (best, swe, data, it, ops) => ({ best, swe, data, it, ops });

export const ENTRIES = [
  {
    id: "blg",
    section: "experience",
    org: "Business Law Group",
    role: "Operations Manager · IT Manager · Tax Paralegal",
    where: "Colorado Springs, CO",
    when: "Jan 2025–Jan 2026 · Summers 2021–2024",
    max: 5,
    bullets: [
      { id: "audit", score: s(10, 9, 10, 6, 8), text: "Cut a six-year tax audit from a projected 200+ attorney hours ($80,000) to about 50 by building a transaction-extraction pipeline that produced a cross-validated ledger matching every expense to its receipt" },
      { id: "docs", score: s(10, 10, 8, 7, 6), text: "Eliminated hundreds of hours of manual filing a year with a Python and SQLite pipeline that ingests tens of thousands of documents: OCR, in-house Whisper transcription, rule-based routing and a trained classifier with human review" },
      { id: "margins", score: s(9, 7, 10, 4, 9), text: "Exposed per-attorney and per-matter margins by consolidating decades of records and tens of millions in case income into a SQL warehouse; the results drove compensation, staffing and the move to flat-rate billing" },
      { id: "promoted", score: s(9, 4, 5, 6, 10), text: "Promoted twice in twelve months and given ownership of “Optimizing the Work,” one of the firm's five strategic pillars" },
      { id: "intranet", score: s(8, 8, 4, 7, 9), text: "Led the design and build of a firm intranet for time tracking, PTO, intake, IT requests and benefits, saving 50+ staff hours a week" },
      { id: "itcost", score: s(8, 3, 3, 10, 8), text: "Cut IT costs 82% by bringing IT in-house for 20+ staff, from $135 to $25 an hour" },
      { id: "dashboards", score: s(6, 5, 9, 5, 8), text: "Replaced manual reporting for 20+ staff with automated dashboards for case performance, workloads and deadlines, and presented monthly reviews to firm leadership" },
      { id: "reconcile", score: s(5, 6, 9, 3, 6), text: "Reverse-engineered leadership's profitability calculations until the warehouse reconciled to their exact figures" },
      { id: "provision", score: s(5, 5, 2, 10, 5), text: "Automated provisioning, imaging, patching and backups across a 20+ user environment and replaced ad hoc permissions with role-based access" },
      { id: "manual", score: s(6, 2, 2, 6, 10), text: "Wrote the firm's operations manual and led staff trainings, cutting leadership interruptions by about half" },
      { id: "licenses", score: s(2, 1, 2, 8, 5), text: "Managed Microsoft 365 and Adobe contracts to right-size seats and secure accounts" },
      { id: "tax", score: s(3, 1, 3, 2, 6), text: "Managed 100+ active IRS cases a year: transcripts, notices, powers of attorney and filings" },
      { id: "deals", score: s(4, 1, 2, 1, 7), text: "Organized purchase agreements for $3M and $20M acquisitions and worked directly with clients and opposing counsel" },
    ],
  },
  {
    id: "uch",
    section: "experience",
    org: "UCHealth Medical Center of the Rockies",
    role: "Perioperative Assistant",
    when: "May 2026–Present",
    max: 2,
    optional: "healthcare",
    bullets: [
      { id: "flow", score: s(7, 4, 4, 5, 8), text: "Coordinate patient flow through 20+ pre- and post-op bays supporting 12 operating rooms at a Level I trauma center" },
      { id: "team", score: s(5, 3, 3, 3, 6), text: "Support patients before and after anesthesia alongside nurses, anesthesia providers and surgeons in a high-acuity environment" },
      { id: "epic", score: s(3, 4, 4, 6, 4), text: "Use Epic daily in a HIPAA-regulated, mission-critical environment" },
    ],
  },
  {
    id: "chaos",
    section: "projects",
    org: "Chaos Coaching",
    role: "Founder and developer · chaoscoaching.co",
    when: "2026–Present",
    max: 3,
    bullets: [
      { id: "platform", score: s(10, 10, 7, 6, 6), text: "Designed, built and deployed an AI-coached training platform that plans each athlete's week from their synced training, notes and goals" },
      { id: "stack", score: s(9, 10, 5, 7, 3), text: "Integrated Strava webhooks, the Claude API and Stripe; about 24,000 lines of Node, Express and SQLite with 298 automated tests, deployed with Docker" },
      { id: "guardrails", score: s(7, 9, 6, 4, 4), text: "Enforced injury-prevention rules in code so the AI's plans can't skip them, stress-tested against 13 simulated athletes" },
      { id: "trends", score: s(4, 5, 9, 2, 3), text: "Analyzes longitudinal training and physiological data to surface trends and adjust each plan" },
    ],
  },
  {
    id: "wiki",
    section: "projects",
    org: "Community Gaming Wiki",
    role: "Founder · Python, full stack",
    when: "Personal",
    max: 1,
    bullets: [
      { id: "wiki", score: s(9, 9, 7, 9, 6), text: "Founded, scaled and sold a community wiki and analytics platform serving 30,000+ users and 10,000+ peak daily visitors; owned hosting, database performance and traffic end to end" },
    ],
  },
  {
    id: "compiler",
    section: "projects",
    org: "Pascal-like Compiler",
    role: "C · Flex · Yacc",
    when: "Michigan Tech",
    max: 1,
    bullets: [{ id: "compiler", score: s(6, 9, 3, 3, 1), text: "Built a compiler for a Pascal-like language covering lexical analysis, parsing, semantic analysis and code generation" }],
  },
  {
    id: "ml",
    section: "projects",
    org: "Evolutionary ML Framework",
    role: "Python",
    when: "Personal",
    max: 1,
    bullets: [{ id: "ml", score: s(4, 7, 9, 2, 1), text: "Built an evolutionary framework for time-series prediction that ingests live market data and iteratively refines its model architectures" }],
  },
  {
    id: "mtu",
    section: "education",
    org: "Michigan Technological University",
    role: "B.S. Computer Science · GPA 3.50",
    where: "Houghton, MI",
    when: "Spring 2025",
    max: 3,
    bullets: [
      { id: "president", score: s(9, 6, 6, 6, 10), text: "Student Body President: represented 8,000+ students to university leadership, led 30+ representatives and grew student involvement 37%" },
      { id: "budget", score: s(6, 3, 6, 3, 9), text: "Managed a $1M+ budget across 200+ student organizations" },
      { id: "aipolicy", score: s(7, 6, 5, 6, 8), text: "Drafted the university's AI policy as the only student on its AI Working Group, then trained faculty to apply it" },
      { id: "teams", score: s(5, 8, 4, 3, 7), text: "Led 7-, 6- and 5-person student software teams that shipped a game, a health analytics platform and an e-commerce system" },
      { id: "athlete", score: s(6, 5, 5, 5, 6), text: "NCAA Division I (BYU) and Division II (Michigan Tech) distance runner; Ironman finisher" },
    ],
  },
];

// Skills, each scored the same way; the top ones per row are shown.
export const SKILLS = [
  {
    row: "Programming",
    items: [
      ["Python", s(10, 10, 10, 8, 7)],
      ["SQL", s(9, 8, 10, 7, 7)],
      ["JavaScript", s(8, 9, 5, 5, 4)],
      ["Java", s(6, 8, 4, 3, 2)],
      ["C", s(4, 7, 2, 3, 1)],
      ["Rust", s(4, 6, 2, 2, 1)],
      ["VBA", s(3, 2, 7, 5, 6)],
    ],
  },
  {
    row: "Systems",
    items: [
      ["Node and Express", s(8, 10, 4, 5, 3)],
      ["REST APIs and webhooks", s(8, 9, 7, 6, 3)],
      ["Relational schema design", s(8, 8, 10, 5, 4)],
      ["ETL and reconciliation", s(6, 5, 10, 4, 6)],
      ["LLM and NLP pipelines", s(8, 9, 8, 4, 4)],
      ["React", s(5, 7, 3, 3, 2)],
      ["Docker", s(5, 7, 3, 8, 2)],
      ["Provisioning, backups and RBAC", s(4, 3, 2, 10, 5)],
      ["Microsoft 365 administration", s(2, 1, 2, 9, 5)],
    ],
  },
  {
    row: "Tools",
    items: [
      ["Git", s(8, 9, 6, 6, 4)],
      ["Excel (advanced)", s(4, 2, 9, 5, 8)],
      ["Jira", s(5, 6, 5, 6, 7)],
      ["Agile and Scrum", s(5, 6, 4, 4, 8)],
      ["Epic", s(2, 1, 2, 5, 4)],
    ],
  },
];

export const LANGUAGES_SPOKEN = "French (C1)";
