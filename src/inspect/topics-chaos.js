// Inspector topics for the Chaos Coaching chapter. The code shown is a
// simplified sketch written for this page; the app's own code stays private.

import guardSrc from "../scenes/chaos/guardrails.js?raw";
import { PROPOSALS, PAIN, HISTORY } from "../scenes/chaos/sample.js";
import { painSaysHold } from "../scenes/chaos/guardrails.js";

const C = { pink: "#ff4da6", text: "#bfe6ff", dim: "rgba(160,200,240,.45)", stop: "#ff6b6b", note: "#ffd23f", ok: "#39ff88" };

function label(ctx, text, x, y, color = C.text, size = 10, align = "left") {
  ctx.fillStyle = color;
  ctx.font = `500 ${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function wrap(text, width) {
  const lines = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).length > width) lines.push(cur), (cur = word);
    else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Guardrails ──────────────────────────────────────────────
const guardTopic = {
  id: "guardrails",
  chip: "Guardrails",
  kicker: "The AI proposes, code decides",
  provenance: "productSketch",
  vizHeight: 190,
  title: "Rules the coach has to follow too",
  summary:
    "The coach is an AI, and it's good at reading a lot of training history and writing a sensible week. But anything that could get someone hurt shouldn't rest on an AI remembering a rule. So after the coach writes a week, plain code checks it: how fast mileage climbs, how many hard days there are, and whether recent pain says to hold. Some problems stop the week from being saved; others save it with a note the athlete can see. Pick a sample week and watch the check run. The code below is a simplified sketch written for this page, with placeholder numbers.",
  sources: [{ file: "src/scenes/chaos/guardrails.js", src: guardSrc, name: "checkWeek", marks: ["level: \"stop\"", "painSaysHold(pain)"] }],
  actions: PROPOSALS.map((p, k) => ({ label: p.label, run: (scene) => scene.propose(k), isOn: (S) => S.proposal === k })),
  viz(ctx, w, h, t, S) {
    const r = S.results;
    const max = 40;
    const Y = (v) => h - 22 - (v / max) * (h - 48);
    const bars = [
      ["last week", HISTORY.previous, "rgba(160,200,240,.5)"],
      ["proposed", r.miles, !r.saved ? C.stop : r.findings.length ? C.note : C.ok],
    ];
    bars.forEach(([name, v, col], k) => {
      const x = 30 + k * 90;
      ctx.fillStyle = col;
      ctx.fillRect(x, Y(v), 56, Y(0) - Y(v));
      label(ctx, `${v} mi`, x + 28, Y(v) - 5, C.text, 10, "center");
      label(ctx, name, x + 28, h - 6, C.dim, 9, "center");
    });
    let y = 18;
    const x0 = Math.max(230, w * 0.45);
    const lines = r.findings.length ? r.findings : [{ level: "pass", text: "Every rule passes. Saved." }];
    for (const f of lines) {
      const col = f.level === "stop" ? C.stop : f.level === "note" ? C.note : C.ok;
      label(ctx, f.level.toUpperCase(), x0, y, col, 9);
      for (const ln of wrap(f.text, Math.floor((w - x0 - 50) / 5.6)).slice(0, 4)) {
        label(ctx, ln, x0 + 40, y, C.text, 9);
        y += 12;
      }
      y += 6;
    }
  },
  live(S) {
    const r = S.results;
    return [`${r.proposal.label}: ${r.miles} mi after ${HISTORY.previous}`, !r.saved ? "→ not saved; back for changes" : r.findings.length ? "→ saved, with notes" : "→ saved"];
  },
};

// ── Pain as behavior ───────────────────────────────────────
const PAIN_OPTIONS = [
  ["recurring", "Same spot, three times"],
  ["moved", "A 3 that changed my stride"],
  ["once", "A 4, once"],
  ["none", "Nothing logged"],
];
const painTopic = {
  id: "pain",
  chip: "Pain as behavior",
  kicker: "Not just a number",
  provenance: "productSketch",
  vizHeight: 130,
  title: "A 3 that changed your stride outranks a stitch",
  summary:
    "After a session the athlete taps where it hurt on a body map and says how it behaved. The number matters, but behavior matters more. Pain that changed how you moved, or the same spot coming back again and again, means next week's load doesn't go up, even if each rating was low. Pick a pain history; the guardrails screen re-checks the current week against it. The code is a simplified sketch written for this page.",
  sources: [{ file: "src/scenes/chaos/guardrails.js", src: guardSrc, name: "painSaysHold", marks: ["p.moved"] }],
  actions: PAIN_OPTIONS.map(([key, name]) => ({ label: name, run: (scene) => scene.setPain(key), isOn: (S) => S.pain === key })),
  viz(ctx, w, h, t, S) {
    const hold = painSaysHold(PAIN[S.pain]);
    const col = hold ? C.stop : C.ok;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(8, 10, w - 16, h - 20);
    ctx.globalAlpha = 1;
    label(ctx, hold ? "HOLD THE LOAD" : "NOTHING SAYS HOLD", 20, 34, col, 12);
    wrap(hold ? `${hold}.` : "No pain worth holding for. Load may go up, within the limits.", Math.floor((w - 40) / 6.2))
      .slice(0, 4)
      .forEach((ln, k) => label(ctx, ln, 20, 60 + k * 15, C.text, 10));
  },
  live(S) {
    return PAIN[S.pain].length ? PAIN[S.pain].map((p) => `${p.date}  ${p.site}  ${p.pain}/10${p.moved ? "  changed movement" : ""}`) : ["(no entries)"];
  },
};

// ── The weekly loop ─────────────────────────────────────────
const STAGES = [
  ["Train", "upload to Strava"],
  ["Sync", "it arrives on its own"],
  ["Check in", "feel · effort · pain"],
  ["Coach", "reads the last weeks"],
  ["Plan", "seven days + reasons"],
  ["Rules", "checked in code"],
  ["You", "accept or edit"],
  ["Repeat", "next week learns"],
];
const loopTopic = {
  id: "loop",
  chip: "The weekly loop",
  kicker: "From a run to next week",
  vizHeight: 170,
  title: "How a week gets written",
  summary:
    "You train and upload to Strava as usual, and the session shows up on its own. You say how it went, including anything that hurt. Each week the coach reads your recent training, planned against what you actually did, your notes, your pain and your goal, then writes the next seven days with its reasons in plain English. The rules check the week before it's saved, and nothing changes until you accept it. This is the product as its public site describes it; the app's code isn't shown.",
  sources: [],
  viz(ctx, w, h, t) {
    const n = STAGES.length;
    const cols = 4;
    const bw = (w - 30) / cols;
    const pos = (k) => [15 + (k % cols) * bw, 18 + Math.floor(k / cols) * 72];
    const active = Math.floor(t * 1.2) % n;
    STAGES.forEach(([name, sub], k) => {
      const [x, y] = pos(k);
      const on = k === active;
      ctx.strokeStyle = on ? C.pink : "rgba(94,200,255,.45)";
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(x + 4, y, bw - 18, 46);
      label(ctx, `${k + 1}. ${name}`, x + 12, y + 19, on ? "#fff" : C.text, 10);
      label(ctx, sub, x + 12, y + 35, C.dim, 9);
      if (k < n - 1) {
        const [nx, ny] = pos(k + 1);
        ctx.strokeStyle = "rgba(94,200,255,.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ny === y) {
          ctx.moveTo(x + bw - 14, y + 23);
          ctx.lineTo(nx + 4, ny + 23);
        } else {
          ctx.moveTo(x + bw / 2, y + 46);
          ctx.lineTo(x + bw / 2, y + 58);
          ctx.lineTo(nx + bw / 2, y + 58);
          ctx.lineTo(nx + bw / 2, ny);
        }
        ctx.stroke();
      }
    });
  },
  live() {
    return ["The coach suggests; the rules check; the athlete decides."];
  },
};

export const chaosTopics = [guardTopic, painTopic, loopTopic];
