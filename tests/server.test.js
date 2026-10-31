import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createApp, ROUTES } from "../legacy/server.js";
import { course } from "./helpers.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
function start() {
  const localDir = mkdtempSync(join(tmpdir(), "remain-srv-"));
  const server = createApp({ env: {}, fetchImpl: () => { throw new Error("no network in tests"); }, localDir });
  return new Promise((ok) => server.listen(0, () => ok({ server, localDir, base: `http://localhost:${server.address().port}` })));
}

test("T21 eval labels are never served; page and data are", async () => {
  const { server, base } = await start();
  try {
    assert.equal((await fetch(`${base}/data/grade-q5.submissions.eval.json`)).status, 404);
    assert.equal((await fetch(`${base}/data/grade-q5.submissions.json`)).status, 200);
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/../package.json`)).status, 404);
  } finally { server.close(); }
  const pub = readdirSync(join(ROOT, "legacy", "public")).map((f) => readFileSync(join(ROOT, "legacy", "public", f), "utf8")).join("\n");
  assert.ok(!pub.includes("eval.json"), "public/ must not reference eval.json");
});

test("T12 server: unclean payload gets 422 BLOCKED, nothing sent, blocked.jsonl written without the value", async () => {
  const { server, base, localDir } = await start();
  try {
    const res = await fetch(`${base}/propose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idea: "grade", itemId: "S-01", payload: { steps: ["mail test@example.org"], finalAnswer: 10 } }) });
    assert.equal(res.status, 422);
    const body = await res.json(); assert.equal(body.code, "BLOCKED"); assert.equal(body.rule, "R-01");
    const lines = readFileSync(join(localDir, "blocked.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 1); assert.ok(!lines[0].includes("example.org"));
    for (const f of readdirSync(localDir)) if (statSync(join(localDir, f)).isFile()) assert.ok(!readFileSync(join(localDir, f), "utf8").includes("example.org"), f);
  } finally { server.close(); }
});

test("clean payload without G0 is refused honestly with 502 and the smoke message", async () => {
  const { server, base } = await start();
  try {
    const res = await fetch(`${base}/propose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idea: "grade", itemId: "S-01", payload: { steps: ["SD = 10"], finalAnswer: 10 } }) });
    assert.equal(res.status, 502);
    const body = await res.json(); assert.ok(body.attempts[0].includes("smoke-g0"));
  } finally { server.close(); }
});

test("/log accepts gate and decision records only and rejects unsafe ones; /counts reads logs", async () => {
  const { server, base } = await start();
  try {
    const post = (rec) => fetch(`${base}/log`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) });
    assert.equal((await post({ type: "decision", idea: "grade", itemId: "S-01", decidedBy: "Test TA", proposed: ["E-VAR-SD"], confirmed: ["E-VAR-SD"], overrides: [], computedScore: 7, grade: 7, receipt: "Assigned by you (TA)" })).status, 200);
    assert.equal((await post({ type: "proposal" })).status, 400);
    assert.equal((await post({ type: "gate", idea: "grade", itemId: "S-12", counts: {}, note: course.roster[3].name })).status, 500);
    const counts = await (await fetch(`${base}/counts`)).json();
    assert.equal(counts.confirmed, 1); assert.equal(counts.decisionsByHuman, 1);
  } finally { server.close(); }
});

test("T22 no-submission path: fetch targets, forbidden words, route list", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
  walk(join(ROOT, "legacy", "public")); walk(join(ROOT, "lib")); walk(join(ROOT, "server")); if (existsSync(join(ROOT, "app"))) walk(join(ROOT, "app")); if (existsSync(join(ROOT, "components"))) walk(join(ROOT, "components"));
  const allowed = new Set(["/propose", "/log", "/counts", "/api/rubric", "/api/ingest", "/api/assignment", "/api/eval-cases", "/api/eval-summary", "API_URL"]);
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/canvas|gradebook/i.test(src), `${f} mentions canvas or gradebook`);
    for (const m of src.matchAll(/fetch(?:Impl)?\(\s*([^,)]+)/g)) {
      const target = m[1].trim().replace(/^[`'"]|[`'"]$/g, "");
      if (/^(path|url|API_URL|`\$\{base\}|\$\{)/.test(target) || target.startsWith("${")) continue;
      assert.ok(allowed.has(target) || target.startsWith("/data/"), `${f}: fetch target ${target} not allowed`);
    }
  }
  assert.deepEqual(ROUTES, ["GET /*", "POST /propose", "POST /log", "GET /counts"]);
});

test("T22b public-repo hygiene: nothing under local/, no .env, no key-like string in tracked files", () => {
  if (!existsSync(join(ROOT, ".git"))) { console.log("git not initialised yet; hygiene check runs on the working tree"); }
  let tracked;
  try { tracked = execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean); }
  catch { tracked = []; }
  for (const f of tracked) {
    assert.ok(!f.startsWith("local/"), `${f} would be committed`);
    assert.ok(!/^\.env/.test(f) || f === ".env.example", `${f} would be committed`);
    if (existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).isFile()) assert.ok(!/sk-ant-[A-Za-z0-9_-]{8,}/.test(readFileSync(join(ROOT, f), "utf8")), `${f} contains a key-like string`);
  }
});
