import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, appendFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { formatJson } from "./json-format.js";
import { TASKS } from "./prompts.js";

// The studio's back end: a Vite plugin that only exists while the dev
// server runs (it is never part of the built site). It reads and saves the
// résumé bank and sends the studio's questions to Claude.
//
// Two ways to reach Claude:
//   queue (the default)  each request is written to resumes/engine/queue/
//                        and answered by Claude Code, which writes a
//                        matching .response.json. Free while developing.
//   api                  STUDIO_LLM=api and ANTHROPIC_API_KEY in .env: the
//                        request goes straight to the Anthropic API.
// Either way, every call's input and output tokens go in
// resumes/engine/usage.jsonl (estimated for the queue, exact for the API).

const ROOT = resolve(import.meta.dirname, "..");
const BANK = resolve(ROOT, "src/resume/bank.json");
const ENGINE = resolve(ROOT, "resumes/engine");
const QUEUE = resolve(ENGINE, "queue");
const DONE = resolve(QUEUE, "done");
const USAGE = resolve(ENGINE, "usage.jsonl");
const MINED = resolve(ENGINE, "mined.json");
const POSTINGS = resolve(ENGINE, "postings");

/** Roughly how many tokens a piece of English text costs (about 3.5 characters each). */
export const estimateTokens = (text) => Math.ceil(text.length / 3.5);

function logUsage(entry) {
  mkdirSync(ENGINE, { recursive: true });
  appendFileSync(USAGE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

function readUsage() {
  if (!existsSync(USAGE)) return [];
  return readFileSync(USAGE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const body = (req) =>
  new Promise((ok, fail) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        ok(data ? JSON.parse(data) : {});
      } catch (err) {
        fail(err);
      }
    });
  });

function send(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

async function callApi(task, request, key) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: request.model, max_tokens: request.max_tokens, system: request.system, messages: request.messages }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message || `API ${r.status}`);
  return { text: json.content.map((c) => c.text || "").join(""), usage: { input: json.usage.input_tokens, output: json.usage.output_tokens, estimated: false } };
}

export function studio({ env = {} } = {}) {
  return {
    name: "bc-studio",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__studio", async (req, res) => {
        try {
          const url = new URL(req.url, "http://x");
          const path = url.pathname;

          // the bank, with a version (when the file last changed) so two
          // studio windows can't quietly overwrite each other's work
          const version = () => String(statSync(BANK).mtimeMs);
          if (path === "/bank" && req.method === "GET") return send(res, 200, { bank: JSON.parse(readFileSync(BANK, "utf8")), version: version() });
          if (path === "/bank" && req.method === "PUT") {
            const { bank, version: seen } = await body(req);
            if (!Array.isArray(bank?.entries) || !bank.profile) return send(res, 400, { error: "that doesn't look like the bank" });
            if (seen !== version()) return send(res, 409, { error: "the bank changed in another window" });
            writeFileSync(BANK, formatJson(bank) + "\n");
            return send(res, 200, { saved: true, version: version() });
          }

          // lines dug out of my old résumés (phase 2): read, re-dig, or save review progress
          if (path === "/mined" && req.method === "GET") return send(res, 200, existsSync(MINED) ? JSON.parse(readFileSync(MINED, "utf8")) : { mined: [] });
          if (path === "/mined/dig" && req.method === "POST") {
            const { mine } = await import("./mine.js");
            const { mined } = mine();
            const out = { made: new Date().toISOString(), mined };
            mkdirSync(ENGINE, { recursive: true });
            writeFileSync(MINED, JSON.stringify(out, null, 2));
            return send(res, 200, out);
          }
          if (path === "/mined" && req.method === "PUT") {
            mkdirSync(ENGINE, { recursive: true });
            writeFileSync(MINED, JSON.stringify(await body(req), null, 2));
            return send(res, 200, { saved: true });
          }

          // job descriptions I've drafted for (private): the posting, its keywords, my draft, and what I sent
          if (path === "/postings" && req.method === "GET") {
            if (!existsSync(POSTINGS)) return send(res, 200, []);
            const all = readdirSync(POSTINGS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(resolve(POSTINGS, f), "utf8")));
            return send(res, 200, all.sort((a, b) => b.created.localeCompare(a.created)));
          }
          if (path.startsWith("/postings/") && req.method === "PUT") {
            const id = path.slice(10).replace(/[^\w-]/g, "");
            mkdirSync(POSTINGS, { recursive: true });
            writeFileSync(resolve(POSTINGS, `${id}.json`), JSON.stringify(await body(req), null, 2));
            return send(res, 200, { saved: true });
          }

          if (path === "/usage") {
            const all = readUsage();
            const total = all.reduce((t, u) => ({ calls: t.calls + 1, input: t.input + u.input, output: t.output + u.output }), { calls: 0, input: 0, output: 0 });
            return send(res, 200, { total, recent: all.slice(-20).reverse(), mode: env.STUDIO_LLM === "api" ? "api" : "queue" });
          }

          // ask Claude: POST /llm { task, input }
          if (path === "/llm" && req.method === "POST") {
            const { task, input } = await body(req);
            const t = TASKS[task];
            if (!t) return send(res, 400, { error: `no task "${task}"` });
            const { system, content } = t.build(input);
            const request = { task, model: t.model, max_tokens: t.max_tokens, system, messages: [{ role: "user", content }] };
            const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${task}`;

            if (env.STUDIO_LLM === "api" && env.ANTHROPIC_API_KEY) {
              const { text, usage } = await callApi(task, request, env.ANTHROPIC_API_KEY);
              logUsage({ id, task, mode: "api", model: t.model, ...usage });
              return send(res, 200, { id, result: t.parse(text), usage });
            }
            mkdirSync(QUEUE, { recursive: true });
            writeFileSync(resolve(QUEUE, `${id}.request.json`), JSON.stringify({ id, created: new Date().toISOString(), ...request }, null, 2));
            return send(res, 202, { id, pending: true });
          }

          // has Claude Code answered? GET /llm/<id>
          if (path.startsWith("/llm/") && req.method === "GET") {
            const id = path.slice(5).replace(/[^\w.-]/g, "");
            const reqFile = resolve(QUEUE, `${id}.request.json`);
            const resFile = resolve(QUEUE, `${id}.response.json`);
            if (!existsSync(resFile)) return send(res, existsSync(reqFile) ? 202 : 404, { id, pending: existsSync(reqFile) });
            const request = JSON.parse(readFileSync(reqFile, "utf8"));
            const { text } = JSON.parse(readFileSync(resFile, "utf8"));
            const result = TASKS[request.task].parse(text); // a bad answer throws here and stays in the queue
            const usage = {
              input: estimateTokens(request.system + request.messages.map((m) => m.content).join("")),
              output: estimateTokens(text),
              estimated: true,
            };
            logUsage({ id, task: request.task, mode: "queue", model: request.model, ...usage });
            mkdirSync(DONE, { recursive: true });
            renameSync(reqFile, resolve(DONE, `${id}.request.json`));
            renameSync(resFile, resolve(DONE, `${id}.response.json`));
            return send(res, 200, { id, result, usage });
          }

          if (path === "/queue") return send(res, 200, existsSync(QUEUE) ? readdirSync(QUEUE).filter((f) => f.endsWith(".request.json")) : []);
          send(res, 404, { error: "not found" });
        } catch (err) {
          send(res, 500, { error: err.message });
        }
      });
    },
  };
}
