// The projects, ranked: first by how ready each one is to show, then by
// its scores. Each gets half a screen of picture and half a screen of
// write-up. Facts come from each project's own README and code, and from
// building and running them (October 2026).
//
// status: "live" (running in public), "ready" (shows well as it is),
// "polish" (works; needs a pass before it shines), "rebuild" (a strong idea
// whose core needs reworking).
// demo: a copy that runs right here on the site, in public/demos/.
//
// TODO (Ben): write each "why" in your own words, and adjust the scores.

export const SCORES = [
  { id: "scale", label: "Scale" },
  { id: "depth", label: "Technical depth" },
  { id: "polish", label: "Completeness" },
];

export const STATUS = {
  live: { label: "Live", rank: 0 },
  ready: { label: "Ready", rank: 1 },
  polish: { label: "Needs polish", rank: 2 },
  rebuild: { label: "Rebuilding", rank: 3 },
};

const PROJECT_LIST = [
  {
    id: "chaos",
    name: "Chaos Coaching",
    tagline: "An AI running coach that plans each athlete's week",
    url: "https://chaoscoaching.co",
    when: "2026–present",
    status: "live",
    scores: { scale: 6, depth: 9, polish: 9 },
    what: "A training platform that plans each athlete's week from their synced training, notes, and goals, then adjusts as the week goes.",
    why: null,
    how: [
      "Strava webhooks bring in every run as it's recorded.",
      "Claude writes the plan; injury-prevention rules in code check it before an athlete ever sees it, so the plan can't skip them.",
      "Stress-tested against 13 simulated athletes.",
    ],
    stats: [
      ["24,000", "lines of code"],
      ["298", "automated tests"],
      ["13", "simulated athletes"],
    ],
    tools: ["Node", "Express", "SQLite", "Claude API", "Strava API", "Stripe", "Docker"],
    // the app's code is private; this page only ever shows screenshots
    shot: { src: "projects/chaos.jpg", alt: "Chaos Coaching's home page, showing this week's plan" },
  },
  {
    id: "swarm",
    name: "SwarmSim",
    tagline: "Flocking birds simulated on the GPU",
    url: "https://bconlin.com/demos/swarm/",
    demo: "demos/swarm/index.html",
    when: "2026",
    status: "ready",
    scores: { scale: 8, depth: 8, polish: 8 },
    what: "A flocking simulation in the browser. Each bird steers only by the birds around it. The flocks chase invisible targets and scatter from hawks.",
    why: null,
    how: [
      "Wrote the physics as WebGPU compute shaders, so the bird data never leaves the graphics card.",
      "Found each bird's neighbors with a spatial hash rebuilt on the GPU every frame, so a step costs the same per bird at any flock size.",
      "Replaced one fixed center of gravity with moving targets and hawks, so flocks split and merge instead of circling one point.",
      "Reworked how birds keep their distance, cutting crowding from about 6,500 neighbors per bird to under 20.",
    ],
    stats: [
      ["400,000", "birds in my test"],
      ["6", "presets"],
      ["262,144", "hash buckets"],
    ],
    tools: ["WebGPU", "WGSL", "JavaScript"],
    shot: { src: "projects/swarm.jpg", alt: "Flocks of birds stretched into ribbons against a black sky" },
  },
  {
    id: "quant",
    name: "From a Spreadsheet to Neuroevolution",
    tagline: "Four rebuilds of one question: can a machine learn to trade?",
    url: "",
    when: "2025",
    status: "polish",
    scores: { scale: 6, depth: 8, polish: 5 },
    what: "It started as an Excel backtester and ended as a population of neural networks evolving their own trading strategies.",
    why: null,
    how: [
      "Excel and VBA: randomized indicator weights, replayed day by day across dozens of stocks.",
      "Python: thousands of those trials run in parallel with Monte Carlo, logged to SQLite, then a paper-trading bot on Alpaca.",
      "Neuroevolution: 250 networks per generation, mutating weights and shape, scored against the S&P 500 with fees and a diversification penalty, over 743 generations.",
      "Tested on a held-out year: 12 of 20 top strategies beat the S&P 500, but only 2 beat simply holding the same stocks, so most of the edge was in the picks, not the timing.",
    ],
    stats: [
      ["743", "generations"],
      ["250", "strategies each"],
      ["100", "stocks traded"],
    ],
    tools: ["Python", "NumPy", "SQLite", "Excel VBA", "Polygon API", "Alpaca API"],
    shot: { src: "projects/quant.jpg", alt: "Chart of best and median fitness rising over 743 generations" },
  },
  {
    id: "worldsim",
    name: "WorldSim",
    tagline: "A voxel world of people who are born, pair off, build, and die",
    url: "",
    when: "2026",
    status: "polish",
    scores: { scale: 5, depth: 8, polish: 4 },
    what: "Agents living in a voxel world. They score their options, pursue the winner, raise children who inherit their genes, and die of hunger, violence, or old age. Chopping and building really change the world.",
    why: null,
    how: [
      "Each agent weighs its needs with a utility function, then carries out the winning goal as a behavior tree.",
      "Genes pass from parents to children, so traits drift over generations.",
      "The simulation runs on a fixed tick, so it behaves the same at 1× and 100× speed.",
    ],
    stats: [
      ["6,800", "lines of Rust"],
      ["1×–100×", "same results"],
      ["1", "mutable world"],
    ],
    tools: ["Rust", "Bevy"],
    shot: { src: null, alt: "" },
  },
  {
    id: "everything",
    name: "Everything",
    tagline: "A tree of all knowledge, to learn as deep or as wide as you like",
    url: "",
    when: "2025",
    status: "rebuild",
    scores: { scale: 8, depth: 7, polish: 3 },
    what: "The goal is a tree of everything, where every topic has an article to learn from and flashcards on spaced repetition, so you can go deep on one branch or follow breadth. The database and the topic browser work. The first AI pipeline for writing articles was too simple for Wikipedia's tangle, so that layer is next.",
    why: null,
    how: [
      "Wikipedia's category dumps are parsed into PostgreSQL: 30,931 topics with definitions.",
      "Every ancestor of every topic is precomputed (725,504 rows), so a whole branch loads in one query.",
      "Links are split into 8 partitions, with fuzzy name search on every topic.",
    ],
    stats: [
      ["30,931", "topics"],
      ["725,504", "ancestor links"],
      ["8", "partitions"],
    ],
    tools: ["PostgreSQL", "TypeScript", "Express", "React", "Python"],
    shot: { src: "projects/everything.jpg", alt: "The topic browser at the root of the tree" },
  },
];

const avg = (p) => (p.scores.scale + p.scores.depth + p.scores.polish) / 3;
export const PROJECTS = [...PROJECT_LIST].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || avg(b) - avg(a));
