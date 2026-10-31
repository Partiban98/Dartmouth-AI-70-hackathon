// Local ingest: a folder of student papers on this machine becomes a question set.
// The name-to-paper map lives in local/ingest/<set>/map.json and never leaves this machine. The model sees paper ids and alias tokens only.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import { runGate, assertClean, PATTERN_RULES } from "../lib/gate.js";
import { CODE_RE } from "./assignment.js";

/** A set id travels in payloads and logs, so it must not look like an identifier. Throws naming the rule it trips. */
export function safeSetId(raw) {
  if (CODE_RE.test(String(raw).trim())) return String(raw).trim(); // a Quiz/Assignment code is the set id as is
  const id = String(raw).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!id) throw new Error("set id is empty");
  for (const [rule, , , re] of PATTERN_RULES) if (new RegExp(re.source).test(id)) throw new Error(`set id "${id}" matches identifier rule ${rule}; choose another name`);
  return id;
}

export const INGEST_DIR = (localDir) => join(localDir, "ingest");

/** QA-05: the import script's set id when none is given. A folder name can look like an identifier (demo-papers looks like a NetID), so fall back to a dated id. */
export function defaultSetId(folderName) {
  try { return safeSetId(`imp-${folderName}`); } catch { return safeSetId(`imp-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`); }
}

/** One id per laptop, made once, kept in local/uploader.json. Paper ids carry it, so two laptops never collide and names stay where the papers were uploaded. */
export function uploaderId(localDir) {
  const p = join(localDir, "uploader.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")).id;
  const id = "U" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  mkdirSync(localDir, { recursive: true });
  writeFileSync(p, JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2) + "\n");
  return id;
}

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

const FOOTER = /^(page|question|q|problem|part)\b/i; // page and question labels are not work and not the answer

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
  // Whole numbers including exponents and leading-dot decimals; page and question footers are not the answer.
  const nums = steps.filter((l) => !FOOTER.test(l)).join(" ").match(/-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?/g);
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
  const me = uploaderId(localDir);
  const dir = join(INGEST_DIR(localDir), setId);
  // An id always means one student's one piece of work. Re-reading keeps ids for unchanged files; a changed file under
  // the same name gets a new id; ids are never reused, because a deleted file's entry stays in the map.
  const previous = existsSync(join(dir, "map.json")) ? JSON.parse(readFileSync(join(dir, "map.json"), "utf8")).map : {};
  const byFile = Object.fromEntries(Object.entries(previous).filter(([, m]) => !m.removed).map(([id, m]) => [m.file, id]));
  const prevPapers = Object.fromEntries((existsSync(join(dir, "papers.json")) ? JSON.parse(readFileSync(join(dir, "papers.json"), "utf8")) : []).map((p) => [p.id, p]));
  // Same paper: same fingerprint; for a map written before fingerprints, every header field (name, IDs, email) and every step the same.
  const sortedJson = (o) => JSON.stringify(Object.keys(o ?? {}).sort().map((k) => [k, o[k]]));
  const samePaper = (id, hash, parsed) => previous[id].hash ? previous[id].hash === hash : !!prevPapers[id] && sortedJson(prevPapers[id].header) === sortedJson(parsed.header) && JSON.stringify(prevPapers[id].steps) === JSON.stringify(parsed.steps);
  let next = Math.max(0, ...Object.keys(previous).map((id) => Number((id.match(/-P-(\d+)$/) ?? [])[1] ?? 0)));
  for (const f of files) {
    const hash = createHash("sha256").update(readFileSync(join(folder, f))).digest("hex");
    const parsed = parsePaper(await extractText(join(folder, f)), f);
    if (!parsed.steps.some((l) => !FOOTER.test(l))) { report.push({ file: f, held: "no readable work", steps: 0 }); continue; }
    const known = byFile[f];
    const id = known && samePaper(known, hash, parsed) ? known : `${me}-P-${String(++next).padStart(2, "0")}`;
    papers.push({ id, imported: true, uploader: me, header: parsed.header, steps: parsed.steps, finalAnswer: parsed.finalAnswer });
    map[id] = { file: f, hash, name: parsed.header.name ?? "", netid: parsed.header.netid ?? "", email: parsed.header.email ?? "", studentId: parsed.header.studentid ?? parsed.header.id ?? "" };
    const g = runGate(papers[papers.length - 1], ideaConfig, course);
    let clean = true; try { if (!g.blocked) assertClean(g.payload, course); } catch { clean = false; }
    report.push({ id, file: f, steps: parsed.steps.length, droppedFields: g.report.droppedFields, counts: Object.fromEntries(Object.entries(g.report.counts).filter(([, n]) => n > 0)), blocked: g.blocked, blockedRules: g.report.blockedRules, clean });
  }
  if (!papers.length) throw new Error("none of these files has readable work (scans without a text layer cannot be read)");
  // Ids no longer in the folder keep their student, so an old mark still exports against the right name.
  for (const [id, m] of Object.entries(previous)) if (!map[id]) map[id] = { ...m, removed: true };
  mkdirSync(dir, { recursive: true });
  papers.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(dir, "papers.json"), JSON.stringify(papers, null, 2) + "\n");
  writeFileSync(join(dir, "map.json"), JSON.stringify({ note: "LOCAL ONLY. Paper id to student. Never sent to any model, never logged.", map }, null, 2) + "\n");
  writeFileSync(join(dir, "meta.json"), JSON.stringify({ id: setId, title: title ?? `Imported: ${basename(folder)}`, rubric: rubricId, folder, uploader: me, count: papers.length, importedAt: new Date().toISOString() }, null, 2) + "\n");
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

// Text that starts like a spreadsheet formula gets a leading apostrophe so it opens as text; numbers stay numbers.
const csvCell = (v) => { let s = v == null ? "" : String(v); if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/** CSV for the TA's sheet. Names come from the local map on this machine; proposals and decisions come from the logs. */
export function exportCsv({ setId, papers, map, logs, table, assignment = "", names = !assignment, laptop = "" }) {
  const latest = {};
  for (const d of logs.decisions ?? []) if (d.idea === setId) latest[d.itemId] = d;
  const proposed = {};
  for (const p of logs.proposals ?? []) if (p.idea === setId) proposed[p.itemId] = p;
  const header = ["paper", "file", "student", "proposed_codes", "model", "confirmed_codes", "overrides", "score_from_confirmed", "grade", "decided_by", "feedback", "rubric_version", "decided_at", "assignment", "laptop", "proposed_change"];
  // A Quiz/Assignment CSV is shared with the head TA, so names and file names stay out unless this laptop asks for them.
  // Notes are typed by people, so a shared file scrubs every name word from this laptop's map and every identifier pattern from them.
  const words = names ? [] : [...new Set(Object.values(map).flatMap((m) => [m.name, m.netid, m.email, m.studentId, ...String(m.name ?? "").split(/\s+/)]).filter((w) => w && String(w).length >= 2))].map(String).sort((a, b) => b.length - a.length);
  // Unicode-aware edges, so a known name in any script is matched whole: \b only knows ASCII letters.
  const nameRe = words.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
  const scrub = (t) => { if (names || t == null) return t; let x = String(t); for (const [, , , re] of PATTERN_RULES) x = x.replace(new RegExp(re.source, "g"), "[removed]"); return nameRe ? x.replace(nameRe, "[student]") : x; };
  const proposedFor = (id) => (table?.pendingPrecedents ?? []).filter((p) => p.itemId === id).map((p) => `${p.code}: ${scrub(p.reason)}`).join(" | ");
  const rows = papers.map((pp) => {
    const m = names ? map[pp.id] ?? {} : {}; const d = latest[pp.id]; const pr = proposed[pp.id];
    return [pp.id, m.file ?? "", m.name ?? "", (pr?.proposals ?? []).map((x) => x.code).join(" "), pr?.modelId ?? "", d ? d.confirmed.join(" ") : "", d ? (d.overrides ?? []).map((o) => `${o.from}>${o.to}`).join(" ") : "", d?.computedScore ?? "", d?.grade ?? "", d?.decidedBy ?? "", scrub(d?.feedback) ?? "", d?.rubricVersion ?? table?.version ?? "", d?.ts ?? "", assignment, pp.uploader ?? laptop, proposedFor(pp.id)];
  });
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Files chosen in the browser are written to local/uploads/<set>/ on this machine, then imported like a folder. */
export async function importUploads({ files, setName, title, rubricId, course, localDir, ideaConfig }) {
  const setId = safeSetId(setName || `upload-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`);
  const dir = join(localDir, "uploads", setId);
  mkdirSync(dir, { recursive: true });
  let kept = 0;
  for (const f of files) {
    const name = basename(String(f.name)).replace(/[^\w.() -]+/g, "_");
    if (!/\.(pdf|txt|md)$/i.test(name)) continue;
    // Never overwrite a different paper that has the same name: keep both, as "name (2).txt".
    const ext = extname(name), stem = name.slice(0, name.length - ext.length);
    let target = name;
    for (let n = 2; existsSync(join(dir, target)) && !readFileSync(join(dir, target)).equals(Buffer.from(f.bytes)); n++) target = `${stem} (${n})${ext}`;
    writeFileSync(join(dir, target), f.bytes);
    kept++;
  }
  if (!kept) throw new Error("no .pdf, .txt, or .md files were chosen");
  const r = await importFolder({ folder: dir, setId, rubricId, course, localDir, ideaConfig, title: title ?? (setName ? `${setName}` : `Uploaded papers`) });
  return { ...r, meta: JSON.parse(readFileSync(join(INGEST_DIR(localDir), setId, "meta.json"), "utf8")) };
}

/** Re-read the folder a set came from, keeping ids. Used by the Start screen's "Re-read folder" and by --watch. */
export async function refreshSet({ setId, course, localDir, ideaConfig }) {
  const metaPath = join(INGEST_DIR(localDir), setId, "meta.json");
  if (!existsSync(metaPath)) throw new Error("unknown set");
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  return importFolder({ folder: meta.folder, setId, rubricId: meta.rubric, course, localDir, ideaConfig, title: meta.title });
}
