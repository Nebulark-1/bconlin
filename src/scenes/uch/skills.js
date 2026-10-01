// What a hospital teaches that a CS degree doesn't - each hospital practice
// paired with the engineering practice it sharpens.

export const SKILLS = [
  {
    hospital: "Calming a frightened patient",
    software: "Incident composure",
    why: "The minutes before anesthesia are some of the most frightening in a person's life. Staying steady so someone else can be. The same muscle holds on a production incident, when everyone is looking at you.",
  },
  {
    hospital: "De-escalating delirium",
    software: "Debugging under pressure",
    why: "A delirious patient isn't being difficult; something is wrong and they can't say what. You stop arguing with the symptom and look for the cause, which is most of debugging.",
  },
  {
    hospital: "Sitting with the dying",
    software: "Perspective",
    why: "Being present at the end of someone's life recalibrates what counts as a bad day. It makes it easier to stay calm, kind and clear when the stakes are only software.",
  },
  {
    hospital: "Handoffs between teams",
    software: "Interfaces & on-call handoffs",
    why: "A patient passes through many hands in a single day; most failures happen at the seams. Clear, complete handoffs are the hospital's version of a well-specified interface.",
  },
  {
    hospital: "Surgical time-outs",
    software: "Checklists & pre-deploy review",
    why: "Before an incision the whole room stops to confirm the patient, the procedure and the site. It's a checklist that exists because experts still make mistakes. It's the same reason code review and deploy checklists do.",
  },
  {
    hospital: "The sterile field",
    software: "Invariants & isolation",
    why: "Nothing unsterile crosses the field, and a break means you stop and fix it, not hope. It's the discipline of an invariant: a boundary you defend absolutely, because recovering later costs far more.",
  },
  {
    hospital: "Patient privacy rules",
    software: "Least-privilege access",
    why: "Healthcare runs on seeing only what you need for the task in front of you. It's the same principle as role-scoped data access, which I'd already built, and now see enforced from the other side.",
  },
  {
    hospital: "Using Epic all day",
    software: "Designing for people under stress",
    why: "When a nurse needs a chart in the middle of a crisis, the software has to just work. Using mission-critical software as a front-line user is the best UX education I've had.",
  },
  {
    hospital: "Moving 20+ bays and 12 ORs",
    software: "Queues, throughput & bottlenecks",
    why: "A surgical day is a pipeline of finite resources. When recovery fills, the ORs back up, then pre-op. It's the same backpressure that takes down a busy system.",
  },
];
