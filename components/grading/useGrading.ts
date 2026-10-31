"use client";
// State for the grading flow. The core does the work; this hook only turns its four questions into screens.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runPipeline } from "@/lib/pipeline.js";
import { makeIdeas } from "@/lib/ideas.js";

export type Stage =
  | { kind: "idle" }
  | { kind: "privacy"; report: any; flags: any[]; blocked: boolean }
  | { kind: "names"; report: any; flags: any[] }
  | { kind: "reading" }
  | { kind: "suggestions"; card: any }
  | { kind: "mark"; bar: any }
  | { kind: "saved"; result: any }
  | { kind: "stopped"; text: string; detail?: any };

export const SETS: Record<string, { title: string; sub: string }> = {
  grade: { title: "DEMO-STATS 101 · Quiz 5", sub: "Sample course, 25 papers" },
  grade93: { title: "DEMO-STATS 201 · Quiz 3, Question 5", sub: "Second sample course, 38 papers" },
};
const get = (path: string) => fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));

export function useGrading() {
  const [data, setData] = useState<any>(null);
  const [standards, setStandards] = useState<Record<string, any>>({});
  const [imported, setImported] = useState<any[]>([]);
  const [importedPapers, setImportedPapers] = useState<Record<string, any[]>>({});
  const [setId, setSetId] = useState("grade");
  const [counts, setCounts] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [modelLabel, setModelLabel] = useState<string>("");
  const [pasted, setPasted] = useState<any[]>([]);
  const [name, setNameState] = useState("");
  const [uploader, setUploader] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const pending = useRef<((v: any) => void) | null>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { try { setNameState(localStorage.getItem("remain.decidedBy") ?? ""); } catch {} }, []);
  const setName = (n: string) => { setNameState(n); try { localStorage.setItem("remain.decidedBy", n); } catch {} };

  const load = useCallback(async () => {
    const [course, companion, upskill, subs, subs93, std, std93, imp, asg] = await Promise.all([
      get("/data/course.json"), get("/data/companion-ch3.json"), get("/data/upskill-email.v1.0.json"),
      get("/data/grade-q5.submissions.json"), get("/data/demo201-q3q5.submissions.json"),
      get("/api/rubric?id=grade-q5"), get("/api/rubric?id=demo201-q3q5"), get("/api/imported"), get("/api/assignment"),
    ]);
    setData({ course, companion, upskill, submissions: { grade: subs ?? [], grade93: subs93 ?? [] } });
    const list = asg?.assignments ?? []; setAssignments(list);
    setStandards({ grade: std, grade93: std93, ...Object.fromEntries(list.map((a: any) => [a.code, a.standards])) });
    const sets = imp?.sets ?? []; setImported(sets);
    const papers: Record<string, any[]> = {};
    await Promise.all(sets.map(async (m: any) => { const d = await get(`/api/imported?set=${encodeURIComponent(m.id)}`); papers[m.id] = d?.papers ?? []; }));
    setImportedPapers(papers);
  }, []);
  const refreshCounts = useCallback(async () => { setCounts(await get("/counts")); }, []);
  useEffect(() => { load(); refreshCounts(); get("/api/ingest").then((j) => j?.uploader && setUploader(j.uploader)); }, [load, refreshCounts]);

  const assignment = assignments.find((a) => a.code === setId) ?? null;
  const rubricKey = SETS[setId] || assignment ? setId : imported.find((x) => x.id === setId)?.rubric === "demo201-q3q5" ? "grade93" : "grade";
  const table = standards[rubricKey];
  const ideas = useMemo(() => {
    if (!data || !standards.grade) return null;
    const gradingSets: Record<string, any> = standards.grade93 ? { grade93: standards.grade93 } : {};
    for (const m of imported) { const st = m.rubric === "demo201-q3q5" ? standards.grade93 : standards.grade; if (st) gradingSets[m.id] = { ...st, course: m.title }; }
    for (const a of assignments) if (standards[a.code]) gradingSets[a.code] = { ...standards[a.code], course: `${a.course} · ${a.title}` };
    return makeIdeas({ gradeStandards: standards.grade, companion: data.companion, upskillStandards: data.upskill, gradingSets });
  }, [data, standards, imported, assignments]);
  const idea = ideas?.[setId];
  const papers: any[] = useMemo(() => [...(data?.submissions?.[setId] ?? importedPapers[setId] ?? []), ...pasted.filter((p) => p.set === setId)], [data, setId, pasted, importedPapers]);
  const decided = useMemo(() => new Set((counts?.decisions ?? []).filter((d: any) => d.idea === setId).map((d: any) => d.itemId)), [counts, setId]);
  const setInfo = SETS[setId] ?? (assignment ? { title: `${assignment.course} · ${assignment.title}`, sub: `code ${assignment.code}` } : null) ?? (() => { const m = imported.find((x) => x.id === setId); return m ? { title: m.title, sub: `${m.count} papers from your folder` } : { title: setId, sub: "" }; })();
  const allSets = [...Object.entries(SETS).filter(([k]) => standards[k]).map(([id, s]) => ({ id, ...s })), ...imported.filter((m) => !assignments.some((a) => a.code === m.id)).map((m) => ({ id: m.id, title: m.title, sub: `${m.count} papers from your folder` }))];

  const ask = (s: Stage) => new Promise<any>((resolve) => { pending.current = resolve; setStage(s); });
  const answer = (v: any, next?: Stage) => { const r = pending.current; pending.current = null; if (next) setStage(next); r?.(v); };

  const index = current ? papers.findIndex((p) => p.id === current.id) : -1;
  const othersOnCurrent = current ? (counts?.decisions ?? []).filter((d: any) => d.idea === setId && d.itemId === current.id && d.decidedBy !== name) : [];

  const start = useCallback(async (item: any) => {
    if (!idea || !data) return;
    if (advance.current) { clearTimeout(advance.current); advance.current = null; }
    if (pending.current) { const r = pending.current; pending.current = null; r(null); }
    setCurrent(item); setStage({ kind: "idle" });
    const ui = {
      resolveFlags: (flags: any[], report: any) => ask({ kind: "names", flags, report }),
      approveGate: (report: any, flags: any[], { blocked }: any) => ask({ kind: "privacy", report, flags, blocked }),
      review: (card: any) => { setModelLabel(card.label); return ask({ kind: "suggestions", card }); },
      decide: (bar: any) => ask({ kind: "mark", bar }),
    };
    const r = await runPipeline(idea, item, ui, { course: data.course });
    if (r.receipt) {
      setStage({ kind: "saved", result: r }); refreshCounts();
      const pend = (r.overrides ?? []).filter((o: any) => o.precedent).map((o: any) => ({ code: o.from, reason: o.reason, by: r.decidedBy, itemId: r.itemId, at: new Date().toISOString() }));
      if (pend.length && table) await saveRubric({ ...table, pendingPrecedents: [...(table.pendingPrecedents ?? []), ...pend] });
    }
    else if (r.stopped === "blocked") { setStage({ kind: "stopped", text: "blocked" }); refreshCounts(); }
    else if (r.stopped === "provider") setStage({ kind: "stopped", text: "noAnswer", detail: r.detail?.attempts });
    else if (r.stopped) setStage({ kind: "stopped", text: "stopped" });
  }, [idea, data, table, refreshCounts]);

  const nextPending = (fromIndex: number) => papers.slice(fromIndex + 1).find((p) => !decided.has(p.id)) ?? papers.find((p) => !decided.has(p.id) && p.id !== current?.id) ?? null;

  async function saveRubric(next: any) {
    const res = await fetch("/api/rubric", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    const j = await res.json();
    if (!res.ok) return j.errors ?? [j.error];
    setStandards((s) => ({ ...s, [rubricKey]: next }));
    // A Quiz/Assignment's card and copied pack come from the server; reload them so the new version is what gets shared.
    if (assignments.some((a) => a.code === rubricKey)) await load();
    return null;
  }
  const addPasted = (item: any) => { const it = { ...item, set: setId, id: `P-${String(pasted.length + 1).padStart(2, "0")}` }; setPasted((p) => [...p, it]); return it; };

  return { data, table, rubricKey, idea, papers, decided, setId, setSetId, setInfo, allSets, counts, refreshCounts, current, index, stage, answer, start, nextPending, modelLabel, name, setName, saveRubric, addPasted, advance, reload: load, uploader, othersOnCurrent, assignments, assignment, importedPapers, sampleScheme: standards.grade };
}
