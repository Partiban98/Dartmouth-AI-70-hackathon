// Local ingest: a folder of student papers on this machine becomes a question set.
// The name-to-paper map lives in local/ingest/<set>/map.json and never leaves this machine. The model sees paper ids and alias tokens only.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { runGate, assertClean, PATTERN_RULES } from "../lib/gate.js";

/** A set id travels in payloads and logs, so it must not look like an identifier. Throws naming the rule it trips. */
export function safeSetId(raw) {
  const id = String(raw).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id) throw new Error("set id is empty");
  for (const [rule, , , re] of PATTERN_RULES) if (new RegExp(re.source).test(id)) throw new Error(`set id "${id}" matches identifier rule ${rule}; choose another name`);
  return id;
}

export const INGEST_DIR = (localDir) => join(localDir, "ingest");

export async function extractText(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true }).promise;
    const lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let line = "", lastY = null;
      for (const it of content.items) {
        const y = it.transform?.[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) { if (line.trim()) lines.push(line.trim()); line = ""; }
        line += (line && !line.endsWith(" ") ? " " : "") + it.str;
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
    }
    return lines.join("\n");
  }
  return readFileSync(file, "utf8");
}

/** Split a paper's text into header fields (dropped by the gate) and steps. "Name:"-style lines become header fields. */
export function parsePaper(text, file) {
  const header = {};
  const steps = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(name|student|netid|net id|email|e-mail|id|student id|date|course|section|file)\s*[:\-]\s*(.+)$/i);
    if (m) { header[m[1].toLowerCase().replace(/\s+/g, "")] = m[2].trim(); continue; }
    steps.push(line);
  }
  if (!header.name) header.name = basename(file, extname(file)).replace(/[_-]+/g, " ").trim();
  const nums = steps.join(" ").match(/-?\d+(?:\.\d+)?/g);
  return { header, steps, finalAnswer: nums ? Number(nums[nums.length - 1]) : null };
}

/** Roster CSV: name,email,netid,studentId (header row optional). Aliases S-01.. in row order. */
export function rosterFromCsv(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(",").map((c) => c.trim()));
  const body = /name/i.test(rows[0]?.[0] ?? "") ? rows.slice(1) : rows;
  return body.map(([name, email = "", netid = "", studentId = ""], i) => ({ alias: `S-${String(i + 1).padStart(2, "0")}`, name, email, netid, studentId }));
}

export async function importFolder({ folder, setId, rubricId, course, localDir, ideaConfig, title }) {
  const files = readdirSync(folder).filter((f) => /\.(pdf|txt|md)$/i.test(f) && statSync(join(folder, f)).isFile()).sort();
  if (!files.length) throw new Error(`no .pdf, .txt, or .md files in ${folder}`);
  const papers = [], map = {}, report = [];
  for (const [i, f] of files.entries()) {
    const id = `P-${String(i + 1).padStart(2, "0")}`;
    const parsed = parsePaper(await extractText(join(folder, f)), f);
    papers.push({ id, imported: true, header: parsed.header, steps: parsed.steps, finalAnswer: parsed.finalAnswer });
    map[id] = { file: f, name: parsed.header.name ?? "", netid: parsed.header.netid ?? "", email: parsed.header.email ?? "" };
    const g = runGate(papers[papers.length - 1], ideaConfig, course);
    let clean = true; try { if (!g.blocked) assertClean(g.payload, course); } catch { clean = false; }
    report.push({ id, file: f, steps: parsed.steps.length, droppedFields: g.report.droppedFields, counts: Object.fromEntries(Object.entries(g.report.counts).filter(([, n]) => n > 0)), blocked: g.blocked, blockedRules: g.report.blockedRules, clean });
  }
  const dir = join(INGEST_DIR(localDir), setId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "papers.json"), JSON.stringify(papers, null, 2) + "\n");
  writeFileSync(join(dir, "map.json"), JSON.stringify({ note: "LOCAL ONLY. Paper id to student. Never sent to any model, never logged.", map }, null, 2) + "\n");
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ id: setId, title: title ?? `Imported: ${basename(folder)}`, rubric: rubricId, folder, count: papers.length, importedAt: new Date().toISOString() }, null, 2) + "\n");
  return { papers, report, dir };
}

export function listImported(localDir) {
  const root = INGEST_DIR(localDir);
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => existsSync(join(root, d, "meta.json"))).map((d) => JSON.parse(readFileSync(join(root, d, "meta.json"), "utf8")));
}
export function loadImported(localDir, setId) {
  const dir = join(INGEST_DIR(localDir), setId);
  if (!existsSync(join(dir, "papers.json"))) return null;
  return { meta: JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")), papers: JSON.parse(readFileSync(join(dir, "papers.json"), "utf8")) };
}
export function loadMap(localDir, setId) {
  const p = join(INGEST_DIR(localDir), setId, "map.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).map : {};
}

const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV for the TA's sheet. Names come from the local map on this machine; proposals and decisions come from the logs. */
export function exportCsv({ setId, papers, map, logs, table }) {
  const latest = {};
  for (const d of logs.decisions ?? []) if (d.idea === setId) latest[d.itemId] = d;
  const proposed = {};
  for (const p of logs.proposals ?? []) if (p.idea === setId) proposed[p.itemId] = p;
  const header = ["paper", "file", "student", "proposed_codes", "model", "confirmed_codes", "overrides", "score_from_confirmed", "grade", "decided_by", "feedback", "rubric_version", "decided_at"];
  const rows = papers.map((pp) => {
    const m = map[pp.id] ?? {}; const d = latest[pp.id]; const pr = proposed[pp.id];
    return [pp.id, m.file ?? "", m.name ?? "", (pr?.proposals ?? []).map((x) => x.code).join(" "), pr?.modelId ?? "", d ? d.confirmed.join(" ") : "", d ? (d.overrides ?? []).map((o) => `${o.from}>${o.to}`).join(" ") : "", d?.computedScore ?? "", d?.grade ?? "", d?.decidedBy ?? "", d?.feedback ?? "", d?.rubricVersion ?? table?.version ?? "", d?.ts ?? ""];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Files chosen in the browser are written to local/uploads/<set>/ on this machine, then imported like a folder. */
export async function importUploads({ files, setName, rubricId, course, localDir, ideaConfig }) {
  const setId = safeSetId(setName || `upload-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`);
  const dir = join(localDir, "uploads", setId);
  mkdirSync(dir, { recursive: true });
  let kept = 0;
  for (const f of files) {
    const name = basename(String(f.name)).replace(/[^\w.() -]+/g, "_");
    if (!/\.(pdf|txt|md)$/i.test(name)) continue;
    writeFileSync(join(dir, name), f.bytes);
    kept++;
  }
  if (!kept) throw new Error("no .pdf, .txt, or .md files were chosen");
  const r = await importFolder({ folder: dir, setId, rubricId, course, localDir, ideaConfig, title: setName ? `${setName}` : `Uploaded papers` });
  return { ...r, meta: JSON.parse(readFileSync(join(INGEST_DIR(localDir), setId, "meta.json"), "utf8")) };
}
