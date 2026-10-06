// About page copy, kept apart from the code so it's easy to edit.
//
// The page is a short bio, then a map of the things I love. Each thing is a
// point; threads tie together the points that share a reason.
//
// Markup inside text:
//   [words](https://…) or [words](page.html) is an ordinary link
//   [[TODO: …]]       a placeholder, shown highlighted until it's filled in
//
// Every personal detail here came from Ben. Don't add stories, places or
// feelings that aren't theirs.

export const BIO = [
  "I'm Ben. I live in Fort Collins, Colorado, and I'm open to moving. I work in a hospital's surgical department, and on the side I'm building Chaos Coaching, an AI coach that plans each athlete's training.",
  "I've been running since high school. It took me to BYU for a year of Division I, then to Michigan Tech, where I raced Division II, earned a computer science degree, and served as student body president.",
  "Outside of work I'm usually outside, in the water, or folding something.",
];

// A thread: a reason several of the things below belong together.
// color: one of the site's chapter colors.
export const THREADS = [
  {
    id: "limits",
    name: "Testing my limits",
    color: "#ffb48c",
    text: "Testing the limits of my body is a common thread in a lot of what I do.",
  },
  {
    id: "water",
    name: "Water",
    color: "#5ec8ff",
    text: "I've always been obsessed with breath, weightlessness and water.",
  },
  {
    id: "value",
    name: "Adding value",
    color: "#ff4da6",
    text: "Finding something that's missing, then creating it. [[TODO: your own line for this thread]]",
  },
  {
    id: "leading",
    name: "Leading",
    color: "#a99bff",
    text: "I like leading because it lets me make a difference.",
  },
  {
    id: "joys",
    name: "Simple joys",
    color: "#39ff88",
    text: "Food is one of the greatest joys. [[TODO: a line for the rest of this thread, if you want one]]",
  },
];

// A point: one thing, its threads, where it sits on the map (0..1000 across,
// 0..700 down), a scene from scenes.js, and a few short paragraphs.
export const POINTS = [
  {
    id: "running",
    name: "Running",
    threads: ["limits", "leading"],
    at: [60, 300],
    scene: "race",
    text: [
      "Senior year of high school I placed second at state. I wrote about it for MileSplit: [Dear Running, You Taught Me to Smile](#todo-milesplit-link). [[TODO: the article's link, and the year and race]]",
      "Later I coached 50+ high school cross country runners as a volunteer. Every one of them set a personal best.",
    ],
  },
  {
    id: "tri",
    name: "Ironman 70.3",
    threads: ["limits"],
    at: [150, 185],
    scene: "tri",
    text: [
      "Boulder 70.3 was the hardest thing I've ever done. My time was nowhere near what I wanted, and I was proud the whole way.",
      "I forgot how to swim when I hit the water, so I backstroked most of it, and I cramped early. I fought cramps on the bike too, and still rode faster than I ever had in training. Then the run flattened me. It was my second-longest run ever by time, and I'd done plenty of 20-mile runs in college.",
      "I couldn't stop enjoying myself, pain and all.",
    ],
  },
  {
    id: "skydive",
    name: "Skydiving",
    threads: ["limits"],
    at: [470, 70],
    scene: "jump",
    text: [
      "Once, south of Colorado Springs. It was a static line jump, so I was entirely alone. Letting go of the plane was awe and sheer terror at once. I was 100% in the moment, with nothing on my mind but what was right in front of me.",
      "My brothers and my dad all jumped too, which made the day extra special. It was the coolest thing ever.",
    ],
  },
  {
    id: "herman",
    name: "Mount Herman",
    threads: ["limits", "joys"],
    at: [40, 70],
    scene: "shelter",
    text: [
      "My favorite place, outside Colorado Springs. In high school I built a big survival shelter up there. When school was first canceled for COVID, I spent a lot of snowy, freezing nights in it.",
    ],
  },
  {
    id: "redbull",
    name: "Red Bull, call me",
    threads: ["limits"],
    at: [160, 415],
    scene: "long",
    text: [
      "I love the drink, and I love that Red Bull backs people testing the limits of what humans can do. I'm not a thrill seeker, so it wouldn't be for anything scary. I'd want to do something ultra-endurance.",
    ],
  },
  {
    id: "freedive",
    name: "Freediving",
    threads: ["limits", "water"],
    at: [470, 300],
    scene: "dive",
    text: [
      "At some point breath, weightlessness and water combined into a question. How long can I hold my breath, and what can I find down there that I couldn't see otherwise?",
      "In Lake Superior I went down 80 feet to chase a rock. It was just a rock.",
    ],
  },
  {
    id: "ocean",
    name: "The ocean",
    threads: ["water", "joys"],
    at: [970, 70],
    scene: "horizon",
    text: [
      "Oceans, beaches, snorkeling, sunrises and sunsets. Hawaii amazed me with how much nature there was, and that was before I started freediving.",
    ],
  },
  {
    id: "tanks",
    name: "Fish tanks",
    threads: ["water", "joys"],
    at: [980, 300],
    scene: "tanks",
    text: [
      "A 10 gallon, a 5 gallon, and an indoor fairy garden of about 5. The shrimp are my favorite: cherry shrimp in one tank and blue dreams in the fairy garden. There's also a pea puffer and a betta.",
    ],
  },
  {
    id: "school",
    name: "A 75 gallon, someday",
    threads: ["water"],
    at: [940, 185],
    scene: "school",
    text: ["The dream is a 75 gallon with real schooling. [[TODO: what would you keep in it?]]"],
  },
  {
    id: "origami",
    name: "Origami",
    threads: ["value", "joys"],
    at: [470, 530],
    scene: "fold",
    text: [
      "My favorite model is the crane. It's a perfect example of symmetry and folds overlapping.",
      "I love that we can model the collapse of the paper with math, to the point that most advanced models are designed with software. But at the very end, a piece can't come to life without someone who knows wet folding, shaping and design.",
    ],
  },
  {
    id: "cranes",
    name: "1,000 cranes",
    threads: ["value", "leading"],
    at: [130, 645],
    scene: "thousand",
    text: ["I once folded a thousand paper cranes against nuclear weapons. [[TODO: the cause or event, how long it took, and where the cranes went]]"],
  },
  {
    id: "chaos",
    name: "Chaos Coaching",
    threads: ["value", "leading", "limits"],
    at: [60, 530],
    scene: "plan",
    text: [
      "For a long time I felt lost without a coach designing my training. So I'm building one.",
      "[See it live ↗](https://chaoscoaching.co)",
    ],
  },
  {
    id: "government",
    name: "Student government",
    threads: ["leading", "value"],
    at: [440, 645],
    scene: "voices",
    text: [
      "I made a difference. I could hear from students on the edges, the ones who usually aren't heard, and actually do something about it.",
      "I also surrounded myself with people who cared about the same things, and with people far more experienced than me, like the Board of Trustees and the university president, so I could learn everything I could from them.",
    ],
  },
  {
    id: "home",
    name: "Colorado",
    threads: ["joys"],
    at: [560, 415],
    scene: "map",
    text: [
      "I was born in Kirkland, Washington, and moved to Colorado Springs in preschool. I still go back to Washington every summer.",
      "College took me to Provo for a year, then to Houghton, Michigan. Now I'm in Fort Collins.",
    ],
  },
  {
    id: "hike",
    name: "Hiking",
    threads: ["joys", "limits"],
    at: [440, 185],
    scene: "photo",
    photo: { src: "photos/portrait-red-rocks.png", alt: "Ben at Garden of the Gods", caption: "Garden of the Gods, Colorado Springs" },
    text: ["[[TODO: a line or two about hiking and exploring, if you want one]]"],
  },
  {
    id: "food",
    name: "Hot dogs",
    threads: ["joys"],
    at: [950, 415],
    scene: "stamps",
    text: ["I'll eat anything, but I travel by hot dogs: Chicago dogs, Philly cheesesteaks, New York dogs."],
  },
  {
    id: "music",
    name: "Luke Combs",
    threads: ["joys"],
    at: [980, 530],
    scene: "record",
    text: ["I listen to everything, with a soft spot for Luke Combs. His album Getting Old is at the top of my list every year."],
  },
  {
    id: "books",
    name: "Historical fiction",
    threads: ["joys"],
    at: [970, 645],
    scene: "pages",
    text: [
      "I read voraciously when I can, which is less often than I'd like between work and everything I build after work.",
      "My favorite is historical fiction. It's a stylized retelling of true events that lets me stand in someone else's shoes.",
    ],
  },
];
