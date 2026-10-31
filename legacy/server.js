// Tiny local API server. Routes: static GET, POST /propose, POST /log, GET /counts. Nothing else.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize as pnorm } from "node:path";
import { fileURLToPath } from "node:url";
import { assertClean } from "../lib/gate.js";
import { verifyQuote, counters, analytics } from "../lib/engine.js";
import { makeIdeas } from "../lib/ideas.js";
import { blockedRecord, proposalRecord } from "../lib/logshape.js";
import { makeAdapter } from "../server/adapter.js";
import { makeLog } from "../server/log.js";
import { loadDotenv } from "../server/env.js";

export const ROUTES = ["GET /*", "POST /propose", "POST /log", "GET /counts"];
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8" };
const readData = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));

export function createApp({ env = process.env, fetchImpl = globalThis.fetch, localDir = join(ROOT, "local") } = {}) {
  const course = readData("course.json");
  const ideas = makeIdeas({ gradeStandards: readData("grade-q5.v1.0.json"), companion: readData("companion-ch3.json"), upskillStandards: readData("upskill-email.v1.0.json") });
  const adapter = makeAdapter({ env, fetchImpl, localDir });
  const log = makeLog(localDir, course);

  const send = (res, status, body, type = "application/json; charset=utf-8") => { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const readBody = (req) => new Promise((ok, err) => { let s = ""; req.on("data", (c) => { s += c; if (s.length > 1e6) err(new Error("body too large")); }); req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { err(e); } }); });

  const textOf = (payload, fields) => fields.map((f) => { const v = payload[f]; return Array.isArray(v) ? v.join("\n") : v && typeof v === "object" ? Object.values(v).join("\n") : String(v ?? ""); }).join("\n");

  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "POST" && url.pathname === "/propose") {
        const body = await readBody(req);
        const ideaConfig = ideas[body.idea];
        if (!ideaConfig) return send(res, 400, { error: "unknown idea" });
        try { assertClean(body.payload, course); }
        catch (e) {
          if (e?.status === 422) { log.append("blocked", blockedRecord(body.idea, body.itemId, e.rule, e.count)); return send(res, 422, { code: "BLOCKED", rule: e.rule, count: e.count }); }
          throw e;
        }
        const r = await adapter.propose({ ideaConfig, payload: body.payload, promptName: body.promptName ?? ideaConfig.promptName });
        if (!r.ok) return send(res, 502, { error: r.error, attempts: r.attempts });
        const verifyText = textOf(body.payload, ideaConfig.verifyAgainst);
        const proposals = r.proposals.map((p) => ({ ...p, verified: verifyQuote(p.quote, verifyText).found }));
        log.append("proposals", proposalRecord(body.idea, body.itemId, { ...r, proposals }));
        return send(res, 200, { proposals: r.proposals, label: r.label, modelId: r.modelId, rung: r.rung, cacheHit: r.cacheHit, caveat: r.caveat, attempts: r.attempts });
      }
      if (req.method === "POST" && url.pathname === "/log") {
        const rec = await readBody(req);
        if (rec.type !== "gate" && rec.type !== "decision") return send(res, 400, { error: "only gate and decision records are accepted here" });
        log.append(rec.type === "decision" ? "decisions" : "gate", rec);
        return send(res, 200, { ok: true });
      }
      if (req.method === "GET" && url.pathname === "/counts") {
        const all = log.readAll();
        // Decision rows carry ids, names, codes, and numbers only; reasons stay in the JSONL.
        const decisions = all.decisions.map((d) => ({ ts: d.ts, idea: d.idea, itemId: d.itemId, decidedBy: d.decidedBy, confirmed: d.confirmed, overrides: (d.overrides ?? []).length, computedScore: d.computedScore, grade: d.grade }));
        return send(res, 200, { ...counters(all), analytics: analytics(all.decisions), decisions });
      }
      if (req.method === "GET") {
        let p = url.pathname === "/" ? "/index.html" : url.pathname;
        if (p.endsWith(".eval.json")) return send(res, 404, { error: "not found" });
        const shared = p.startsWith("/data/") || p.startsWith("/lib/");
        const base = shared ? ROOT : join(ROOT, "legacy", "public");
        const file = pnorm(join(base, p));
        const allowedRoot = shared ? join(ROOT, p.split("/")[1]) : join(ROOT, "legacy", "public");
        if (!file.startsWith(allowedRoot) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, { error: "not found" });
        return send(res, 200, readFileSync(file), MIME[extname(file)] ?? "application/octet-stream");
      }
      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: e.message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  loadDotenv(join(ROOT, ".env"));
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => console.log(`Remain core on http://localhost:${port}  (logs in local/, key never leaves this machine)`));
}
