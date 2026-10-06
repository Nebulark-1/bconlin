// About page copy, kept apart from the code so it's easy to edit.
//
// Markup:
//   [words](id)       opens the dive-in with that id between the lines
//   [words](https://…) or [words](page.html) is an ordinary link
//   [[TODO: …]]       a placeholder, shown highlighted until it's filled in
//
// Every personal detail here came from Ben. Don't add stories, places or
// feelings that aren't theirs.

export const BIO = [
  "I'm Ben. I live in [Fort Collins, Colorado](home), and I'm open to moving. I work in a hospital's surgical department, and on the side I'm building [Chaos Coaching](chaos), an AI coach that plans each athlete's training.",
  "I've been [running](running) since high school. It took me to BYU for a year of Division I, then to Michigan Tech, where I raced Division II, earned a computer science degree, and served as [student body president](leading).",
  "Most of my free time is spent outside. I raced [Ironman 70.3 Boulder](tri), I'll [hike](hike) just about anywhere, and my favorite place is [a mountain](herman) I used to sleep on in the snow.",
  "I love [the water](water), and I keep [two fish tanks](tanks) at home. I've [jumped out of a plane](skydive) once. I also [fold paper](origami).",
  "Other than that, I'll [eat almost anything](food), I [listen to everything](music), and I [read](books) whenever work leaves room.",
];

// Each dive-in: a scene (see scenes.js) and a few short paragraphs, which
// can open dive-ins of their own.
export const DIVES = {
  home: {
    scene: "map",
    text: [
      "I was born in Kirkland, Washington, and moved to Colorado Springs in preschool. I still go back to Washington every summer.",
      "College took me to Provo for a year, then to Houghton, Michigan. Now I'm in Fort Collins.",
    ],
  },
  running: {
    scene: "race",
    text: [
      "Senior year of high school I placed second at state. I wrote about it for MileSplit: [Dear Running, You Taught Me to Smile](#todo-milesplit-link). [[TODO: the article's link, and the year and race]]",
      "Later I coached 50+ high school cross country runners as a volunteer. Every one of them set a personal best.",
    ],
  },
  tri: {
    scene: "tri",
    text: [
      "The hardest thing I've ever done. My time was nowhere near what I wanted, and I was proud the whole way.",
      "I forgot how to swim when I hit the water, so I backstroked most of it, and I cramped early. I fought cramps on the bike too, and still rode faster than I ever had in training. Then the run flattened me. It was my second-longest run ever by time, and I'd done plenty of 20-mile runs in college.",
      "I couldn't stop enjoying myself, pain and all. [Red Bull, call me.](redbull)",
    ],
  },
  redbull: {
    scene: "long",
    text: [
      "I love the drink, and I love that Red Bull backs people testing the limits of what humans can do. I'm not a thrill seeker, so it wouldn't be for anything scary. I'd want to do something ultra-endurance.",
    ],
  },
  hike: {
    scene: "photo",
    photo: { src: "photos/portrait-red-rocks.png", alt: "Ben at Garden of the Gods", caption: "Garden of the Gods, Colorado Springs" },
    text: ["[[TODO: a line or two about hiking and exploring, if you want one]]"],
  },
  herman: {
    scene: "shelter",
    text: [
      "Mount Herman, outside Colorado Springs. In high school I built a big survival shelter up there. When school was first canceled for COVID, I spent a lot of snowy, freezing nights in it.",
    ],
  },
  water: {
    scene: "horizon",
    text: [
      "I've always been obsessed with breath, weightlessness and water. Oceans, beaches, snorkeling, all of it. Hawaii amazed me with how much nature there was, and that was before I started [freediving](freedive).",
      "My girlfriend, Syd, is my sunrise and sunset companion.",
    ],
  },
  freedive: {
    scene: "dive",
    text: [
      "At some point breath, weightlessness and water combined into a question. How long can I hold my breath, and what can I find down there that I couldn't see otherwise?",
      "In Lake Superior I went down 80 feet to chase a rock. It was just a rock. Testing the limits of my body is a thread through most of what I do.",
    ],
  },
  tanks: {
    scene: "tanks",
    text: [
      "A 10 gallon, a 5 gallon, and an indoor fairy garden of about 5. The shrimp are my favorite: cherry shrimp in one tank and blue dreams in the fairy garden. There's also a pea puffer and a betta.",
      "The dream is [a 75 gallon](school) with real schooling.",
    ],
  },
  school: {
    scene: "school",
    text: ["[[TODO: what would you keep in it?]]"],
  },
  skydive: {
    scene: "jump",
    text: [
      "South of Colorado Springs. It was a static line jump, so I was entirely alone. Letting go of the plane was awe and sheer terror at once. I was 100% in the moment, with nothing on my mind but what was right in front of me.",
      "My brothers and my dad all jumped too, which made the day extra special. It was the coolest thing ever.",
    ],
  },
  origami: {
    scene: "fold",
    text: [
      "My favorite model is the crane. It's a perfect example of symmetry and folds overlapping.",
      "I love that we can model the collapse of the paper with math, to the point that most advanced models are designed with software. But at the very end, a piece can't come to life without someone who knows wet folding, shaping and design.",
      "I once folded [a thousand cranes](cranes) against nuclear weapons.",
    ],
  },
  cranes: {
    scene: "thousand",
    text: ["[[TODO: the cause or event, how long it took, and where the cranes went]]"],
  },
  leading: {
    scene: "voices",
    text: [
      "I made a difference. I could hear from students on the edges, the ones who usually aren't heard, and actually do something about it.",
      "I also surrounded myself with people who cared about the same things, and with people far more experienced than me, like the Board of Trustees and the university president, so I could learn everything I could from them.",
    ],
  },
  chaos: {
    scene: "plan",
    text: [
      "For a long time I felt lost without a coach designing my training. So I'm building one. Finding something missing and adding it is my favorite kind of work.",
      "[See it live ↗](https://chaoscoaching.co)",
    ],
  },
  food: {
    scene: "stamps",
    text: [
      "Food is one of the greatest joys. I'll eat anything, but I travel by hot dogs: Chicago dogs, Philly cheesesteaks, New York dogs.",
    ],
  },
  music: {
    scene: "record",
    text: ["I listen to everything, with a soft spot for Luke Combs. His album Getting Old is at the top of my list every year."],
  },
  books: {
    scene: "pages",
    text: [
      "I read voraciously when I can, which is less often than I'd like between work and everything I build after work.",
      "My favorite is historical fiction. It's a stylized retelling of true events that lets me stand in someone else's shoes.",
    ],
  },
};
