// Career copy lives here, separate from the art, so it can be edited freely.
// House style: lead with the action, end on the result, use real numbers,
// no em dashes. Card titles double as the timeline's sub-stops, so keep
// them short (about 24 characters).

export const chapters = [
  {
    id: "houghton",
    label: "Michigan Tech",
    when: "2022–2025",
    cards: [
      {
        eyebrow: "Houghton, Michigan",
        title: "Why the far north",
        bullets: [
          "Transferred from BYU to run NCAA Division II cross country and track while finishing a computer science degree",
          "Four winters on the Keweenaw Peninsula: 200+ inches of snow a year, northern lights, and Winter Carnival",
        ],
      },
      {
        eyebrow: "Michigan Technological University",
        title: "B.S. Computer Science",
        meta: "GPA 3.50 · Spring 2025",
        bullets: [
          "Built a Pascal-like compiler in C with Flex and Yacc, from lexing and parsing through semantic analysis and code generation",
          "Led a 7-person team that designed and shipped a bullet-hell game, presenting progress to stakeholders every week",
          "Directed a 6-person capstone team that built, deployed and marketed a health analytics platform on external REST APIs",
          "Managed a 5-person team through a full e-commerce system build",
        ],
      },
      {
        eyebrow: "Undergraduate Student Government",
        title: "Student Body President",
        meta: "2024–2025 · Parliamentarian 2023–2024",
        bullets: [
          "Represented 8,000+ students to university leadership and led a body of 30+ student representatives",
          "Grew student involvement 37% through targeted outreach campaigns",
          "Managed a $1M+ budget across 200+ student organizations",
          "Drafted Michigan Tech's AI policy as the only student on its AI Working Group, then trained faculty to apply it",
          "Planned the free-speech initiatives behind Michigan Tech's #1 national FIRE ranking",
        ],
      },
      {
        eyebrow: "NCAA Division II · Division I",
        title: "Distance Runner",
        meta: "Michigan Tech 2022–2024 · BYU 2021–2022",
        bullets: [
          "Trained and competed about 20 hours a week alongside a full computer science course load",
          "Coached 50+ high school cross country runners as a volunteer (2020–2022); every one set a personal best",
          "Finished an Ironman in 2026",
        ],
      },
    ],
  },
  {
    id: "law",
    label: "Business Law Group",
    when: "2021–2026",
    cards: [
      {
        eyebrow: "Colorado Springs · Summers 2021–2024",
        title: "Legal Assistant",
        bullets: [
          "Organized the share purchase agreement for a $3M acquisition and the asset purchase agreement for a $20M acquisition",
          "Drafted contracts and disclosures and worked directly with clients and opposing counsel",
          "Formed LLCs, wrote cease-and-desist letters and filed court documents",
        ],
      },
      {
        eyebrow: "Tax Paralegal · 2025",
        title: "Document pipeline",
        bullets: [
          "Eliminated hundreds of hours of manual filing a year with a Python and SQLite pipeline that ingests tens of thousands of documents",
          "OCR'd every file and transcribed audio in-house with Whisper, then routed known forms by rule and everything else through a trained classifier",
          "Sent low-confidence results to staff for review and fed their corrections back in as training data",
          "Managed 100+ active IRS cases a year: transcripts, notices, powers of attorney and filings",
        ],
      },
      {
        eyebrow: "A six-tax-year audit",
        title: "200 hours to 50",
        bullets: [
          "Cut a six-year tax audit from a projected 200+ attorney hours ($80,000) to about 50",
          "Built the ingestion and transaction-extraction pipeline for tens of thousands of pages myself",
          "Delivered a cross-validated ledger that matched every expense to its receipt",
        ],
      },
      {
        eyebrow: "Firm analytics",
        title: "Margins nobody could see",
        bullets: [
          "Consolidated decades of firm records and tens of millions in case income into one SQL warehouse, using VBA, SQL and Python",
          "Reconciled my models to leadership's exact figures, then exposed per-attorney and per-matter margins",
          "The results drove compensation, staffing and the firm's move to flat-rate billing",
          "Presented monthly performance reviews to firm leadership and senior attorneys",
        ],
      },
      {
        eyebrow: "In-House IT → Interim Firm Manager → Operations Manager",
        title: "Running the firm",
        bullets: [
          "Promoted twice in twelve months and given ownership of one of the firm's five strategic pillars",
          "Led the build of a firm intranet for time tracking, PTO, intake, IT requests and benefits, saving 50+ staff hours a week",
          "Cut IT costs 82% by bringing IT in-house for 20+ staff ($135/hr to $25/hr)",
          "Wrote the firm's operations manual, cutting leadership interruptions by about half",
        ],
      },
    ],
  },
  {
    id: "uchealth",
    label: "UCHealth",
    when: "2026–now",
    cards: [
      {
        eyebrow: "UCHealth Medical Center of the Rockies",
        title: "Perioperative Assistant",
        meta: "May 2026–present",
        bullets: [
          "Coordinate patient flow through 20+ pre- and post-op bays supporting 12 operating rooms at a Level I trauma center",
          "Work alongside nurses, anesthesia providers and surgeons on time-critical handoffs",
          "Use Epic every day, seeing mission-critical software from the user's side",
        ],
      },
      {
        eyebrow: "Pre- and post-anesthesia",
        title: "At the bedside",
        bullets: [
          "Keep patients calm in the minutes before anesthesia, often the most frightening part of their day",
          "Talked a delirious post-op patient down safely when all he wanted was to stand up",
          "Sat with a dying patient so they would not be alone",
        ],
      },
      {
        eyebrow: "Shadowing",
        title: "Inside the OR",
        bullets: [
          "Shadowed craniotomies, open-heart surgeries and Whipple procedures",
          "Watched surgical teams run hours-long procedures on checklists, clear roles and closed-loop communication",
        ],
      },
      {
        eyebrow: "What carries over",
        title: "Systems that can't fail",
        bullets: [
          "Work daily under HIPAA, sterile technique and documentation rules in one of the most regulated industries there is",
          "Handoffs are where hospitals and software both break, so I now design for them first",
          "Built the composure and patience that incident response and user support depend on",
        ],
      },
    ],
  },
  {
    id: "chaos",
    label: "Chaos Coaching",
    when: "2026–now",
    cards: [
      {
        eyebrow: "Founder and developer · chaoscoaching.co",
        title: "Chaos Coaching",
        meta: "2026–present · invitation-only alpha",
        bullets: [
          "Designed, built and deployed a training platform where an AI coach plans each athlete's week from their real training, notes and goals",
          "Integrated Strava (by webhook), the Claude API and Stripe payments",
          "Shipped about 24,000 lines of Node, Express and SQLite, covered by 298 automated tests and deployed with Docker",
        ],
      },
      {
        eyebrow: "Say how it went",
        title: "Feedback that counts",
        bullets: [
          "Athletes rate each session's feel and effort and place any pain on a body map",
          "Pain is read by behaviour, not just the number: a 3 that changed someone's stride outranks a 7 side stitch",
          "A spot that keeps coming back is treated as a pattern and holds the next week's load",
        ],
      },
      {
        eyebrow: "Next week",
        title: "Plans with reasons",
        bullets: [
          "The coach reads recent training, planned against actual, plus notes and pain, then writes the next seven days",
          "Every plan explains what changed from last week and why",
          "Nothing changes until the athlete accepts it",
        ],
      },
      {
        eyebrow: "Guardrails",
        title: "Rules the AI can't skip",
        bullets: [
          "Enforced injury-prevention rules in code instead of trusting the prompt: mileage step limits, two hard days, scheduled deloads",
          "Unsafe weeks are refused before they're saved; borderline ones are saved with a visible warning",
          "Stress-tested against 13 simulated athletes, from a first-time runner to elite volume",
        ],
      },
    ],
  },
];

/** The last stop on the timeline: where this is heading, and how to reach me. */
export const nextChapter = {
  label: "Next chapter",
  when: "Open to work",
  pitch: "I turn messy real-world processes into software that people rely on.",
  looking: "Looking for software engineering, data and solutions roles. Based in Fort Collins, Colorado.",
  email: "benaconlin@gmail.com",
  linkedin: "https://www.linkedin.com/in/benconlin/",
};
