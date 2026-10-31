// Claude API provider adapter. Raw HTTP, zero dependencies (project rule). Wire format from official docs: POST /v1/messages.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateProposal, proposalJsonSchema } from "../lib/schema.js";
import { SYSTEM, buildUserPrompt } from "../lib/prompts.js";

export const CALL_CAP = 150;
export const REQUEST_TIMEOUT_MS = 60_000; // a hang must become a failed attempt, never a frozen demo
export const API_URL = "https://api.anthropic.com/v1/messages";
export const API_VERSION = "2026-10-21";
export const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const LABEL_REPLAY = "CACHED REHEARSAL: NOT LIVE MODEL OUTPUT";
export const liveLabel = (modelId) => `LIVE API: ${modelId}`;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const writeJson = (p, o) => { mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); };

export function makeAdapter({ env = process.env, fetchImpl = globalThis.fetch, localDir = "local" } = {}) {
  const paths = { smoke: join(localDir, "smoke.json"), smokeGemini: join(localDir, "smoke-gemini.json"), calls: join(localDir, "calls.json"), cache: join(localDir, "cache") };
  mkdirSync(paths.cache, { recursive: true });

  const payloadHash = (promptName, payload) => sha256(JSON.stringify({ system: SYSTEM, promptName, payload }));
  const cachePath = (ph, modelId) => join(paths.cache, `${ph}.${modelId}.json`);
  const callCount = () => readJson(paths.calls, { count: 0 }).count;
  const bumpCalls = () => writeJson(paths.calls, { count: callCount() + 1 });

  /** One request to the provider. Throws on transport, HTTP, refusal, or schema failure. */
  async function callOnce({ modelId, mode, ideaConfig, payload }) {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set on this machine (team item: key holder)");
    const schema = proposalJsonSchema(ideaConfig);
    // Thinking is on by default on these models and counts against max_tokens; leave room for it.
    const body = { model: modelId, max_tokens: 4096, system: SYSTEM, messages: [{ role: "user", content: buildUserPrompt(ideaConfig, payload) }] };
    if (mode === "structured") body.output_config = { format: { type: "json_schema", schema } };
    else {
      body.tools = [{ name: "propose", description: "Submit proposals: allowlist code, exact quote, confidence.", strict: true, input_schema: schema }];
      body.tool_choice = { type: "auto" };
      body.messages[0].content += "\n\nUse the propose tool to answer.";
    }
    if (callCount() >= CALL_CAP) throw new Error(`Call cap ${CALL_CAP} reached; verify spend before raising`);
    bumpCalls();
    const res = await fetchImpl(API_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": API_VERSION }, body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error?.type ?? ""} ${json?.error?.message ?? ""}`.trim());
    if (json.stop_reason === "refusal") throw new Error("provider refusal");
    let parsed;
    if (mode === "structured") {
      const text = (json.content ?? []).find((b) => b.type === "text")?.text;
      parsed = JSON.parse(text ?? "null");
    } else {
      parsed = (json.content ?? []).find((b) => b.type === "tool_use" && b.name === "propose")?.input;
    }
    const v = validateProposal(parsed, ideaConfig);
    if (!v.ok) throw new Error(`SCHEMA_INVALID: ${v.errors.join("; ")}`);
    return { proposals: v.value.proposals, modelId: json.model, usage: json.usage ?? null, raw: json };
  }

  /** Gate G0: one schema-valid call on the exact model. Writes local/smoke.json. */
  async function smokeTest({ ideaConfig, payload }) {
    const modelId = env.MODEL_DEMO;
    if (!modelId) return writeSmoke({ ok: false, error: "MODEL_DEMO not set (team item: exact model ID)" });
    const errors = [];
    for (const mode of ["structured", "tool"]) {
      try {
        const r = await callOnce({ modelId, mode, ideaConfig, payload });
        return writeSmoke({ ok: true, mode, modelId: r.modelId, requestedModel: modelId, usage: r.usage, at: new Date().toISOString() });
      } catch (e) { errors.push(`${mode}: ${e.message}`); }
    }
    return writeSmoke({ ok: false, requestedModel: modelId, errors, at: new Date().toISOString() });
  }
  function writeSmoke(o) { writeJson(paths.smoke, o); return o; }

  /** Rung 3: Gemini generateContent, raw HTTP. Key in a header, never in the URL. Paid tier only. */
  async function callGeminiOnce({ modelId, mode, ideaConfig, payload }) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    if (env.GEMINI_TIER !== "paid") throw new Error("GEMINI_TIER must be paid; free tier never");
    const schema = proposalJsonSchema(ideaConfig);
    const stripAdditional = (o) => Array.isArray(o) ? o.map(stripAdditional) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([k]) => k !== "additionalProperties").map(([k, v]) => [k, stripAdditional(v)])) : o;
    const generationConfig = { responseMimeType: "application/json", maxOutputTokens: 1024, ...(mode === "jsonSchema" ? { responseJsonSchema: schema } : { responseSchema: stripAdditional(schema) }) };
    const body = { systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: buildUserPrompt(ideaConfig, payload) }] }], generationConfig };
    if (callCount() >= CALL_CAP) throw new Error(`Call cap ${CALL_CAP} reached; verify spend before raising`);
    bumpCalls();
    const res = await fetchImpl(`${GEMINI_URL}/${modelId}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error?.status ?? ""} ${json?.error?.message ?? ""}`.trim());
    const cand = json.candidates?.[0];
    if (!cand || (cand.finishReason && cand.finishReason !== "STOP")) throw new Error(`gemini finishReason ${cand?.finishReason ?? "none"}${json.promptFeedback?.blockReason ? `, blocked ${json.promptFeedback.blockReason}` : ""}`);
    const text = (cand.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const v = validateProposal(JSON.parse(text || "null"), ideaConfig);
    if (!v.ok) throw new Error(`SCHEMA_INVALID: ${v.errors.join("; ")}`);
    const u = json.usageMetadata;
    return { proposals: v.value.proposals, modelId: json.modelVersion ?? modelId, usage: u ? { input_tokens: u.promptTokenCount, output_tokens: u.candidatesTokenCount } : null, raw: json };
  }

  /** Gemini smoke: proves which schema field the endpoint accepts. Writes local/smoke-gemini.json. */
  async function smokeGemini({ ideaConfig, payload }) {
    const modelId = env.GEMINI_MODEL;
    const write = (o) => { writeJson(paths.smokeGemini, o); return o; };
    if (!modelId) return write({ ok: false, error: "GEMINI_MODEL not set (spec expects gemini-2.5-flash; team confirms)" });
    const errors = [];
    for (const mode of ["jsonSchema", "openApi"]) {
      try {
        const r = await callGeminiOnce({ modelId, mode, ideaConfig, payload });
        return write({ ok: true, mode, modelId: r.modelId, requestedModel: modelId, usage: r.usage, at: new Date().toISOString() });
      } catch (e) { errors.push(`${mode}: ${e.message}`); }
    }
    return write({ ok: false, requestedModel: modelId, errors, at: new Date().toISOString() });
  }

  /** Fallback ladder. Never silently substitutes: rung and label are always returned. */
  async function propose({ ideaConfig, payload, promptName }) {
    const attempts = [];
    const replay = env.REPLAY_MODE === "1";
    const ph = payloadHash(promptName, payload);
    const smoke = readJson(paths.smoke, null);
    const dev = env.NODE_ENV === "development";
    const rungs = replay ? [] : [
      { n: 1, modelId: dev ? env.MODEL_DEV : env.MODEL_DEMO },
      { n: 2, modelId: env.MODEL_DEV },
    ];
    if (!replay && !smoke?.ok) {
      attempts.push("Run scripts/smoke-g0.js first (gate G0)");
      rungs.length = 0;
    }
    const mode = smoke?.mode ?? "structured";
    for (const rung of rungs) {
      if (!rung.modelId) { attempts.push(`rung ${rung.n}: model env not set`); continue; }
      if (rung.n === 2 && rung.modelId === rungs[0].modelId) { attempts.push("rung 2: same model as rung 1, skipped"); continue; }
      const cached = readJson(cachePath(ph, rung.modelId), null);
      if (cached) return { ok: true, proposals: cached.proposals, label: liveLabel(cached.modelId), modelId: cached.modelId, rung: rung.n, cacheHit: true, usage: cached.usage, attempts };
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await callOnce({ modelId: rung.modelId, mode, ideaConfig, payload });
          writeJson(cachePath(ph, rung.modelId), { modelId: r.modelId, proposals: r.proposals, usage: r.usage, at: new Date().toISOString() });
          return { ok: true, proposals: r.proposals, label: liveLabel(r.modelId), modelId: r.modelId, rung: rung.n, cacheHit: false, usage: r.usage, attempts, caveat: rung.n === 2 ? "same key, account, and billing as rung 1; covers model failure only" : undefined };
        } catch (e) {
          attempts.push(`rung ${rung.n} attempt ${attempt}: ${e.message}`);
          if (/Call cap/.test(e.message)) { attempt = 2; }
        }
      }
    }
    // Rung 3: Gemini on the paid tier, only with a separate key. The first real backup.
    if (!replay) {
      if (!(env.GEMINI_API_KEY && env.GEMINI_TIER === "paid")) attempts.push("rung 3 not configured");
      else if (!env.GEMINI_MODEL) attempts.push("rung 3: GEMINI_MODEL not set");
      else {
        const gsmoke = readJson(paths.smokeGemini, null);
        if (!gsmoke?.ok) attempts.push("rung 3: run scripts/smoke-gemini.js first");
        else {
          const cached = readJson(cachePath(ph, env.GEMINI_MODEL), null);
          if (cached) return { ok: true, proposals: cached.proposals, label: liveLabel(cached.modelId), modelId: cached.modelId, rung: 3, cacheHit: true, usage: cached.usage, attempts };
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const r = await callGeminiOnce({ modelId: env.GEMINI_MODEL, mode: gsmoke.mode, ideaConfig, payload });
              writeJson(cachePath(ph, env.GEMINI_MODEL), { modelId: r.modelId, proposals: r.proposals, usage: r.usage, at: new Date().toISOString() });
              return { ok: true, proposals: r.proposals, label: liveLabel(r.modelId), modelId: r.modelId, rung: 3, cacheHit: false, usage: r.usage, attempts };
            } catch (e) {
              attempts.push(`rung 3 attempt ${attempt}: ${e.message}`);
              if (/Call cap/.test(e.message)) attempt = 2;
            }
          }
        }
      }
    }
    // Rung 4: labelled cached rehearsal.
    const hit = readdirSync(paths.cache).find((f) => f.startsWith(`${ph}.`));
    if (hit) {
      const cached = readJson(join(paths.cache, hit), null);
      return { ok: true, proposals: cached.proposals, label: LABEL_REPLAY, modelId: cached.modelId, rung: 4, cacheHit: true, usage: null, attempts };
    }
    attempts.push("rung 4: no cached rehearsal for this payload");
    return { ok: false, error: attempts[attempts.length - 1], attempts };
  }

  return { propose, smokeTest, smokeGemini, callOnce, callGeminiOnce, callCount, paths };
}
