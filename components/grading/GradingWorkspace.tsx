"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runPipeline } from "@/lib/pipeline.js";
import { makeIdeas } from "@/lib/ideas.js";
import { HONEST_LIMIT } from "@/lib/gate.js";
import { validateStandards, recurring } from "@/lib/engine.js";
import { normalize } from "@/lib/text.js";
import { feedbackLine, bumpVersion as bump } from "@/lib/feedback.js";

type Stage =
  | { kind: "idle" }
  | { kind: "gate"; report: any; flags: any[]; blocked: boolean }
  | { kind: "flags"; report: any; flags: any[] }
  | { kind: "waiting" }
  | { kind: "review"; card: any }
  | { kind: "decide"; bar: any }
  | { kind: "receipt"; result: any }
  | { kind: "stopped"; text: string; detail?: any };

const SETS: Record<string, { file: string; subs: string; title: string; sub: string }> = {
  grade: { file: "grade-q5.v1.0.json", subs: "grade-q5.submissions.json", title: "DEMO-STATS 101 · Quiz 5", sub: "Synthetic course, 25 papers" },
  grade93: { file: "engs93-q3q5.v1.0.json", subs: "engs93-q3q5.submissions.json", title: "ENGS 93 · Quiz 3, Q5", sub: "Real rubric and precedents, 38 papers, steps reconstructed" },
};

const get = (path: string) => fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export default function GradingWorkspace() {
  const [data, setData] = useState<any>(null);
  const [standards, setStandards] = useState<Record<string, any>>({});
  const [setId, setSetId] = useState<string>("grade");
  const [counts, setCounts] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [modelLabel, setModelLabel] = useState<string>("No model call yet");
  const [rubricOpen, setRubricOpen] = useState(false);
  const [pasted, setPasted] = useState<any[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [imported, setImported] = useState<any[]>([]);
  const [importedPapers, setImportedPapers] = useState<Record<string, any[]>>({});
  const pending = useRef<((v: any) => void) | null>(null);

  const load = useCallback(async () => {
    const [course, companion, upskill, subs, subs93, std, std93] = await Promise.all([
      get("/data/course.json"), get("/data/companion-ch3.json"), get("/data/upskill-email.v1.0.json"),
      get("/data/grade-q5.submissions.json"), get("/data/engs93-q3q5.submissions.json"),
      get("/api/rubric?id=grade-q5"), get("/api/rubric?id=engs93-q3q5"),
    ]);
    setData({ course, companion, upskill, submissions: { grade: subs ?? [], grade93: subs93 ?? [] } });
    setStandards({ grade: std, grade93: std93 });
    const imp = await get("/api/imported");
    const sets = imp?.sets ?? [];
    setImported(sets);
    const papers: Record<string, any[]> = {};
    await Promise.all(sets.map(async (m: any) => { const d = await get(`/api/imported?set=${encodeURIComponent(m.id)}`); papers[m.id] = d?.papers ?? []; }));
    setImportedPapers(papers);
  }, []);
  const refreshCounts = useCallback(async () => { setCounts(await get("/counts")); }, []);
  useEffect(() => { load(); refreshCounts(); }, [load, refreshCounts]);

  const ideas = useMemo(() => {
    if (!data || !standards.grade) return null;
    const gradingSets: Record<string, any> = standards.grade93 ? { grade93: standards.grade93 } : {};
    for (const m of imported) { const st = m.rubric === "engs93-q3q5" ? standards.grade93 : standards.grade; if (st) gradingSets[m.id] = { ...st, course: m.title }; }
    return makeIdeas({ gradeStandards: standards.grade, companion: data.companion, upskillStandards: data.upskill, gradingSets });
  }, [data, standards, imported]);
  const idea = ideas?.[setId];
  const submissions: any[] = useMemo(() => [...(data?.submissions?.[setId] ?? importedPapers[setId] ?? []), ...pasted.filter((p) => p.set === setId)], [data, setId, pasted, importedPapers]);
  const setInfo = SETS[setId] ?? (() => { const m = imported.find((x) => x.id === setId); return m ? { title: m.title, sub: `${m.count} papers from ${m.folder}, rubric ${m.rubric}` } : { title: setId, sub: "" }; })();
  const rubricKey = SETS[setId] ? setId : (imported.find((x) => x.id === setId)?.rubric === "engs93-q3q5" ? "grade93" : "grade");
  const decided = useMemo(() => new Set((counts?.decisions ?? []).filter((d: any) => d.idea === setId).map((d: any) => d.itemId)), [counts, setId]);
  const analyticsForSet = counts?.analyticsByIdea?.[setId] ?? {};

  const table = standards[SETS[setId] ? setId : (imported.find((x) => x.id === setId)?.rubric === "engs93-q3q5" ? "grade93" : "grade")];
  const ask = (s: Stage) => new Promise<any>((resolve) => { pending.current = resolve; setStage(s); });
  const answer = (v: any, next?: Stage) => { const r = pending.current; pending.current = null; if (next) setStage(next); r?.(v); };

  async function start(item: any) {
    if (!idea || !data) return;
    setCurrent(item); setStage({ kind: "idle" });
    const ui = {
      resolveFlags: (flags: any[], report: any) => ask({ kind: "flags", flags, report }),
      approveGate: (report: any, flags: any[], { blocked }: any) => ask({ kind: "gate", report, flags, blocked }),
      review: (card: any) => { setModelLabel(card.label); return ask({ kind: "review", card }); },
      decide: (bar: any) => ask({ kind: "decide", bar }),
    };
    const r = await runPipeline(idea, item, ui, { course: data.course });
    if (r.receipt) {
      setStage({ kind: "receipt", result: r }); refreshCounts();
      const pend = (r.overrides ?? []).filter((o: any) => o.precedent).map((o: any) => ({ code: o.from, reason: o.reason, by: r.decidedBy, itemId: r.itemId, at: new Date().toISOString() }));
      if (pend.length) await saveRubric({ ...table, pendingPrecedents: [...(table.pendingPrecedents ?? []), ...pend] });
    }
    else if (r.stopped === "blocked") { setStage({ kind: "stopped", text: `Blocked by the server's assertClean (${r.detail?.rule}). Nothing was sent. Logged as a blocked event.` }); refreshCounts(); }
    else if (r.stopped === "provider") setStage({ kind: "stopped", text: `No model answer. ${r.detail?.error ?? ""}`, detail: r.detail?.attempts });
    else if (r.stopped === "standards") setStage({ kind: "stopped", text: `Rubric failed validation, nothing runs: ${r.errors.join("; ")}` });
    else setStage({ kind: "stopped", text: `Stopped at ${r.stopped}${r.error ? `: ${r.error}` : ""}. Nothing was decided.` });
  }

  async function saveRubric(next: any) {
    const res = await fetch("/api/rubric", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    const j = await res.json();
    if (!res.ok) return j.errors ?? [j.error];
    setStandards((s) => ({ ...s, [rubricKey]: next }));
    return null;
  }

  if (!data || !idea || !table) return <main className="p-10 text-ink-3">Loading seeds…</main>;
  const v = validateStandards(table);
  const total = submissions.length;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      <aside className="space-y-4">
        <section className="rounded-xl border border-line bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Question set</h2>
          <div className="mt-2 space-y-1">
            {[...Object.entries(SETS).filter(([k]) => standards[k]), ...imported.map((m) => [m.id, { title: m.title, sub: `${m.count} papers · local folder · rubric ${m.rubric}` }] as [string, any])].map(([k, s]) => (
              <button key={k} onClick={() => { setSetId(k); setCurrent(null); setStage({ kind: "idle" }); }} aria-pressed={setId === k}
                className={cls("w-full text-left rounded-lg px-3 py-2 border", setId === k ? "border-ink bg-ink text-white" : "border-line hover:bg-paper")}>
                <div className="text-sm font-medium">{s.title}</div>
                <div className={cls("text-xs", setId === k ? "text-white/70" : "text-ink-3")}>{s.sub}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Rubric v{table.version}</h2>
            <span className={cls("text-xs font-medium", v.ok ? "text-human" : "text-warn")}>{v.ok ? "✓ validated by code" : "✗ invalid"}</span>
          </div>
          <p className="mt-1 text-xs text-ink-3">Owner: {table.owner}. Max {table.max}. {table.codes.length} codes, {(table.methods ?? []).length} listed methods.</p>
          <button onClick={() => setRubricOpen(true)} className="mt-2 text-sm underline underline-offset-2">Open rubric</button>
        </section>
        <section className="rounded-xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3">Queue</h2>
            <span className="text-xs text-ink-3">{decided.size} of {total} decided</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded bg-line"><div className="h-1.5 rounded bg-human" style={{ width: `${total ? (100 * decided.size) / total : 0}%` }} /></div>
          <ul className="mt-3 max-h-[46vh] overflow-auto space-y-1 pr-1" aria-label="Review queue, one paper at a time">
            {submissions.map((s) => (
              <li key={s.id}>
                <button onClick={() => start(s)} aria-current={current?.id === s.id ? "true" : undefined}
                  className={cls("w-full flex items-center justify-between rounded-md px-3 py-1.5 text-sm border", current?.id === s.id ? "border-ink" : "border-transparent hover:bg-paper")}>
                  <span className="font-mono">{s.id}</span>
                  <span className={cls("text-xs", decided.has(s.id) ? "text-human" : "text-ink-3")}>{decided.has(s.id) ? "decided" : "pending"}</span>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setPasteOpen(true)} className="mt-3 w-full rounded-md border border-dashed border-ink-3 px-3 py-2 text-sm hover:bg-paper">+ Paste a paper</button>
          <p className="mt-2 text-xs text-ink-3">No bulk approval. Every paper is a separate decision.</p>
          <p className="mt-1 text-xs text-ink-3">Folder of PDFs? <span className="font-mono">node scripts/ingest.js &lt;folder&gt; --propose</span> adds it here. Names stay in a local map on this machine.</p>
        </section>
      </aside>

      <div className="space-y-5 min-w-0">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{setInfo.title}</h1>
            <p className="text-sm text-ink-2 max-w-3xl">{table.question}</p>
          </div>
          <a href={`/api/export?set=${encodeURIComponent(setId)}`} className="ml-auto rounded-md border border-line bg-card px-3 py-1.5 text-sm hover:bg-paper" download>Export CSV</a>
          <span className="rounded-md border border-line bg-card px-3 py-1.5 font-mono text-xs" aria-live="polite">{modelLabel}</span>
        </header>
        <Stepper stage={stage} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <PaperView item={current} stage={stage} />
          <div className="space-y-4">
            {stage.kind === "idle" && <Panel title="Pick a paper">
              <p className="text-sm text-ink-2">Each paper runs the same four stages: Privacy Gate on this machine, model proposes with a quoted line, rules engine verifies, you decide. Keys: 1 confirm, 2 change, 3 override, Enter to continue.</p>
            </Panel>}
            {stage.kind === "gate" && <GatePanel report={stage.report} flags={stage.flags} blocked={stage.blocked}
              onApprove={() => answer(true, { kind: "waiting" })} onCancel={() => answer(false)} />}
            {stage.kind === "flags" && <FlagsPanel report={stage.report} flags={stage.flags} onDone={(picks) => answer(picks)} onCancel={() => answer(null)} />}
            {stage.kind === "waiting" && <Panel title="2 · Model proposes"><p className="text-sm text-ink-2 animate-pulse">Alias-only payload sent. Waiting for the model, at most two attempts per rung, 60 seconds each.</p></Panel>}
            {stage.kind === "review" && <ReviewCard card={stage.card} table={table} analytics={analyticsForSet} onSubmit={(r) => answer(r)} />}
            {stage.kind === "decide" && <DecisionBar bar={stage.bar} table={table} card={current} onDecide={(d) => answer(d)} />}
            {stage.kind === "receipt" && <Receipt result={stage.result} table={table} />}
            {stage.kind === "stopped" && <Panel title="Stopped" tone="warn"><p className="text-sm">{stage.text}</p>{stage.detail && <ul className="mt-2 text-xs text-ink-3 list-disc pl-4">{stage.detail.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>}</Panel>}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Insights analytics={analyticsForSet} table={table} decided={decided.size} total={total} />
          <DecisionLog counts={counts} setId={setId} />
        </div>
        <p className="text-xs text-ink-3 border-l-2 border-line pl-3">{HONEST_LIMIT}</p>
      </div>

      {rubricOpen && <RubricDrawer table={table} onClose={() => setRubricOpen(false)} onSave={saveRubric} />}
      {pasteOpen && <PasteDialog onClose={() => setPasteOpen(false)} onSubmit={(item) => { const it = { ...item, set: setId, id: `P-${String(pasted.length + 1).padStart(2, "0")}` }; setPasted((p) => [...p, it]); setPasteOpen(false); start(it); }} />}
    </main>
  );
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "warn" | "human" }) {
  return (
    <section className={cls("rounded-xl border bg-card p-5", tone === "warn" ? "border-warn bg-warn-bg" : tone === "human" ? "border-human bg-human-bg" : "border-line")}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const idx = { idle: -1, gate: 0, flags: 0, waiting: 1, review: 2, decide: 3, receipt: 4, stopped: -1 }[stage.kind];
  const steps = ["Privacy Gate, on this machine", "Model proposes", "Rules engine verifies", "You decide"];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Stages">
      {steps.map((s, i) => (
        <li key={s} className={cls("rounded-md border px-3 py-2 text-xs", i < idx || idx === 4 ? "border-human bg-human-bg text-human" : i === idx ? "border-ink bg-ink text-white" : "border-line text-ink-3")}>
          <span className="font-mono mr-1">{i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}

function PaperView({ item, stage }: { item: any; stage: Stage }) {
  const quotes: string[] = stage.kind === "review" ? stage.card.items.map((i: any) => normalize(i.quote ?? "")) : stage.kind === "receipt" ? (stage.result.proposed ?? []).map((i: any) => normalize(i.quote ?? "")) : [];
  const hit = (step: string) => quotes.some((q) => q && normalize(step).includes(q));
  return (
    <section className="rounded-xl border border-line bg-card p-5" aria-label="Student work">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{item ? `Paper ${item.id}` : "Paper"}</h2>
        {item && <span className="text-xs text-ink-3">{item.header ? "Header dropped by the gate before any send" : "No header"}</span>}
      </div>
      {!item && <p className="mt-3 text-sm text-ink-3">The student's work appears here. Lines the model quotes are highlighted once they are verified by code.</p>}
      {item && (
        <ol className="mt-3 space-y-1.5 font-mono text-[13px] leading-relaxed">
          {item.steps.map((s: string, i: number) => (
            <li key={i} className="flex gap-3"><span className="w-5 shrink-0 text-ink-3">{i + 1}</span><span className={hit(s) ? "mark" : ""}>{s}</span></li>
          ))}
        </ol>
      )}
      {item && <p className="mt-3 text-xs text-ink-3">Final answer as written: <span className="font-mono">{String(item.finalAnswer ?? "none")}</span>{item.reconstructed ? " · steps reconstructed from the TA's grading notes, not the student's words" : item.imported ? " · imported from a local file; name and header fields dropped by the gate" : ""}</p>}
    </section>
  );
}

function CountsTable({ report }: { report: any }) {
  const rows = Object.entries(report.counts).filter(([, n]: any) => n > 0);
  return (
    <div className="mt-3 text-sm">
      <p>Fields dropped by allowlist: <span className="font-mono">{report.droppedFields}</span></p>
      {rows.length ? (
        <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-ink-3"><th className="py-1">Replaced, by type</th><th className="py-1 text-right">Count</th></tr></thead>
          <tbody>{rows.map(([t, n]: any) => <tr key={t} className="border-t border-line"><td className="py-1 font-mono">{t}</td><td className="py-1 text-right font-mono">{n}</td></tr>)}</tbody></table>
      ) : <p className="mt-2 text-ink-3">No identifiers found in the allowlisted fields.</p>}
      <p className="mt-2 text-xs text-ink-3">Counts only. Stripped values never appear in any log. The alias map stays in this browser tab.</p>
    </div>
  );
}

function GatePanel({ report, flags, blocked, onApprove, onCancel }: any) {
  return (
    <Panel title="1 · Privacy Gate, on this machine">
      <CountsTable report={report} />
      {blocked && <p className="mt-3 rounded-md bg-warn-bg border border-warn px-3 py-2 text-sm">BLOCKED by {report.blockedRules.join(", ")}. Nothing will be sent.</p>}
      <div className="mt-4 flex gap-2">
        <button disabled={blocked} onClick={onApprove} className="rounded-md bg-ink px-4 py-2 text-sm text-white disabled:opacity-40">Approve and send alias-only payload</button>
        <button onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm">Stop, send nothing</button>
      </div>
    </Panel>
  );
}

function FlagsPanel({ report, flags, onDone, onCancel }: any) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const left = flags.filter((f: any) => !picks[f.token]).length;
  return (
    <Panel title="1 · Privacy Gate: a human decides on possible names" tone="warn">
      <p className="text-sm">R-11 found capitalised words that may be a name. They are shown here only, never sent, never logged, until you decide.</p>
      <ul className="mt-3 space-y-2">
        {flags.map((f: any) => (
          <li key={f.token} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono rounded bg-card px-2 py-0.5 border border-line">{f.token}</span>
            {["name", "not-name"].map((v) => <button key={v} onClick={() => setPicks((p) => ({ ...p, [f.token]: v }))} aria-pressed={picks[f.token] === v}
              className={cls("rounded-md border px-3 py-1", picks[f.token] === v ? "bg-ink text-white border-ink" : "border-line bg-card")}>{v === "name" ? "Mark as name" : "Not a name"}</button>)}
          </li>
        ))}
      </ul>
      <CountsTable report={report} />
      <div className="mt-4 flex gap-2">
        <button disabled={left > 0} onClick={() => onDone(picks)} className="rounded-md bg-ink px-4 py-2 text-sm text-white disabled:opacity-40">Continue to the before and after view</button>
        <button onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm">Stop, send nothing</button>
      </div>
    </Panel>
  );
}

function ReviewCard({ card, table, analytics, onSubmit }: any) {
  const [state, setState] = useState<any[]>(() => card.items.map((it: any) => ({ action: "confirm", to: it.code, reason: "", precedent: false })));
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState("");
  const labels = Object.fromEntries(table.codes.map((c: any) => [c.code, c]));
  const setRow = (i: number, patch: any) => setState((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const submit = useCallback(() => {
    const confirmed: string[] = [], overrides: any[] = [];
    for (const [i, s] of state.entries()) {
      const from = card.items[i].code;
      if (s.action === "confirm") confirmed.push(from);
      else { if (!s.reason.trim()) { setError(`Item ${i + 1}: a reason is required.`); return; } overrides.push({ from, to: s.to, reason: s.reason, precedent: s.precedent }); if (s.action === "change") confirmed.push(s.to); }
    }
    onSubmit({ confirmed, overrides });
  }, [state, card, onSubmit]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && (e.target as HTMLInputElement).type === "text") { if (e.key === "Enter") submit(); return; }
      if (e.key === "1") setRow(focus, { action: "confirm", to: card.items[focus].code });
      else if (e.key === "2") setRow(focus, { action: "change" });
      else if (e.key === "3") setRow(focus, { action: "override", to: "OK" });
      else if (e.key === "Enter") submit();
      else if (e.key === "ArrowDown") setFocus((f) => Math.min(f + 1, card.items.length - 1));
      else if (e.key === "ArrowUp") setFocus((f) => Math.max(f - 1, 0));
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [focus, submit, card]);
  return (
    <Panel title="3 · Review: proposals with evidence">
      {card.items.length === 0 && <p className="text-sm text-ink-2">No proposals from the model and no rule candidates. You still decide the grade.</p>}
      <ul className="space-y-3">
        {card.items.map((it: any, i: number) => {
          const a = analytics[it.code]; const s = state[i];
          return (
            <li key={i} onFocus={() => setFocus(i)} onClick={() => setFocus(i)} className={cls("rounded-lg border p-3", focus === i ? "border-ink" : "border-line")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{it.code}</span>
                <span className="text-sm text-ink-2">{labels[it.code]?.label}</span>
                <span className={cls("ml-auto rounded px-2 py-0.5 text-xs font-medium", it.source === "Rule" ? "bg-rule-bg text-rule" : "bg-ai-bg text-ai")}>{it.source === "Rule" ? "Rule" : "AI"}</span>
                <span className="text-xs text-ink-3">deduction <span className="font-mono">{labels[it.code]?.deduction}</span></span>
              </div>
              <blockquote className="mt-2 border-l-2 border-ink-3 pl-3 font-mono text-[13px]">{it.sourceLine ?? it.quote}</blockquote>
              <div className="mt-1 flex flex-wrap gap-3 text-xs">
                <span className={cls("font-medium", it.verified ? "text-human" : "text-warn")}>{it.verified ? "✓ verified in source by code" : "✗ not found in source"}</span>
                {typeof it.confidence === "number" && <span className="text-ink-3">confidence {it.confidence.toFixed(2)}</span>}
                {a && <span className="text-ink-3">same mark every time: confirmed on {a.confirmed} paper{a.confirmed === 1 ? "" : "s"}, overridden {a.overridden}</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {[["confirm", "1 Confirm"], ["change", "2 Change type"], ["override", "3 Override to no error"]].map(([k, l]) => (
                  <button key={k} onClick={() => setRow(i, { action: k, to: k === "override" ? "OK" : k === "confirm" ? it.code : s.to === it.code ? table.codes[0].code : s.to })} aria-pressed={s.action === k}
                    className={cls("rounded-md border px-3 py-1", s.action === k ? "bg-ink text-white border-ink" : "border-line bg-card")}>{l}</button>
                ))}
                {s.action === "change" && <select value={s.to} onChange={(e) => setRow(i, { to: e.target.value })} className="rounded-md border border-line px-2 py-1" aria-label={`Change type for item ${i + 1}`}>
                  {table.codes.map((c: any) => <option key={c.code} value={c.code}>{c.code}: {c.label}</option>)}
                </select>}
              </div>
              {s.action !== "confirm" && (
                <div className="mt-2 space-y-1">
                  <input type="text" value={s.reason} onChange={(e) => setRow(i, { reason: e.target.value })} placeholder="Reason, required" aria-label={`Reason for item ${i + 1}`} className="w-full rounded-md border border-line px-3 py-1.5 text-sm" />
                  <label className="flex items-center gap-2 text-xs text-ink-2"><input type="checkbox" checked={s.precedent} onChange={(e) => setRow(i, { precedent: e.target.checked })} /> Save this reason as a precedent for {it.code}, pending instructor approval</label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
      <button onClick={submit} className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-white">Done reviewing every item ⏎</button>
    </Panel>
  );
}

function DecisionBar({ bar, table, card, onDecide }: any) {
  const [name, setName] = useState(() => { try { return localStorage.getItem("remain.decidedBy") ?? ""; } catch { return ""; } });
  const [grade, setGrade] = useState(String(bar.computedScore));
  const [feedback, setFeedback] = useState(() => feedbackLine(bar.confirmed ?? [], table));
  const ok = name.trim() && grade !== "";
  const go = () => { if (!ok) return; try { localStorage.setItem("remain.decidedBy", name.trim()); } catch {} onDecide({ decidedBy: name.trim(), grade: Number(grade), feedback }); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") go(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  return (
    <Panel title="4 · Your decision" tone="human">
      <p className="text-sm">Score from the codes you confirmed, computed by code: <span className="font-mono text-lg font-semibold">{bar.computedScore}</span> / {table.max}. You enter the grade.</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="flex flex-col gap-1">Decided by<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-md border border-line px-3 py-1.5" /></label>
        <label className="flex flex-col gap-1">Grade you assign<input type="number" step="0.25" min={0} max={table.max} value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded-md border border-line px-3 py-1.5" /></label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm">Feedback line the student will see (from your confirmed codes; edit freely)
        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="rounded-md border border-line px-3 py-1.5 text-sm" /></label>
      <button disabled={!ok} onClick={go} className="mt-3 rounded-md bg-human px-4 py-2 text-sm text-white disabled:opacity-40">Confirm my decision ⏎</button>
      <p className="mt-2 text-xs text-ink-3">Receipt will read: {bar.receipt}</p>
    </Panel>
  );
}

function Receipt({ result, table }: any) {
  const text = [
    `${result.receipt}: ${result.decidedBy}`, `Paper ${result.itemId}`, `Rubric v${result.rubricVersion}`,
    `Confirmed codes: ${result.confirmed.length ? result.confirmed.join(", ") : "none"}`,
    ...result.overrides.map((o: any) => `Override ${o.from} → ${o.to}: ${o.reason}`),
    `Score from confirmed codes: ${result.computedScore} / ${table.max}`, `Grade assigned: ${result.grade}`, `Feedback: ${result.feedback ?? ""}`, `Model: ${result.label}`,
  ].join("\n");
  return (
    <Panel title="Receipt" tone="human">
      <p className="text-lg font-semibold">{result.receipt}: {result.decidedBy}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-3">Grade assigned</dt><dd className="font-mono">{result.grade} / {table.max}</dd>
        <dt className="text-ink-3">Score from confirmed codes</dt><dd className="font-mono">{result.computedScore}</dd>
        <dt className="text-ink-3">Confirmed</dt><dd className="font-mono">{result.confirmed.length ? result.confirmed.join(", ") : "none"}</dd>
        <dt className="text-ink-3">Overridden</dt><dd>{result.overrides.length ? result.overrides.map((o: any, i: number) => <div key={i}><span className="font-mono">{o.from} → {o.to}</span>: {o.reason}</div>) : "none"}</dd>
        <dt className="text-ink-3">Feedback line</dt><dd>{result.feedback}</dd>
        <dt className="text-ink-3">Rubric</dt><dd className="font-mono">v{result.rubricVersion}</dd>
        <dt className="text-ink-3">Model</dt><dd className="font-mono text-xs">{result.label}</dd>
      </dl>
      <button onClick={() => navigator.clipboard?.writeText(text)} className="mt-3 rounded-md border border-line bg-card px-3 py-1.5 text-sm">Copy receipt</button>
    </Panel>
  );
}

function Insights({ analytics, table, decided, total }: any) {
  const list = recurring(analytics, table);
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="text-sm font-semibold">Class insights, from decisions a person confirmed</h2>
      <p className="mt-1 text-xs text-ink-3">Papers decided: {decided} of {total}. Nothing here comes from model text.</p>
      {list.length ? (
        <table className="mt-3 w-full text-sm"><thead><tr className="text-left text-xs text-ink-3"><th className="py-1">Code</th><th className="py-1">What to reteach</th><th className="py-1 text-right">Confirmed</th><th className="py-1 text-right">Proposed</th><th className="py-1 text-right">Overridden</th></tr></thead>
          <tbody>{list.map((r: any) => <tr key={r.code} className="border-t border-line"><td className="py-1 font-mono">{r.code}</td><td className="py-1">{r.label}</td><td className="py-1 text-right font-mono">{r.confirmed}</td><td className="py-1 text-right font-mono">{r.proposed}</td><td className="py-1 text-right font-mono">{r.overridden}</td></tr>)}</tbody></table>
      ) : <p className="mt-3 text-sm text-ink-3">No confirmed mistakes yet.</p>}
    </section>
  );
}

function DecisionLog({ counts, setId }: any) {
  const rows = (counts?.decisions ?? []).filter((d: any) => d.idea === setId).slice().reverse();
  const pii = Object.entries(counts?.piiStripped ?? {}).map(([t, n]) => `${t} ${n}`).join(", ") || "none";
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="text-sm font-semibold">Decision log, real counts from logs <span className="font-normal text-ink-3">(counts across all sets; rows for this set)</span></h2>
      {counts && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[["Model proposals", counts.proposed], ["Confirmed by a person", counts.confirmed], ["Overridden", counts.overridden], ["Decisions by a person", counts.decisionsByHuman], ["Quotes verified", counts.quotesVerified], ["Quotes not found", counts.quotesNotFound], ["Identifiers stripped", pii], ["Fields dropped", counts.fieldsDropped]].map(([k, v]) => (
            <div key={k as string} className="rounded-md bg-paper px-2 py-1.5"><div className="text-ink-3">{k}</div><div className="font-mono text-sm">{String(v)}</div></div>
          ))}
        </div>
      )}
      {rows.length ? (
        <table className="mt-3 w-full text-sm"><thead><tr className="text-left text-xs text-ink-3"><th className="py-1">Paper</th><th className="py-1">Decided by</th><th className="py-1">Confirmed</th><th className="py-1 text-right">Overrides</th><th className="py-1 text-right">Grade</th></tr></thead>
          <tbody>{rows.slice(0, 12).map((d: any, i: number) => <tr key={i} className="border-t border-line"><td className="py-1 font-mono">{d.itemId}</td><td className="py-1">{d.decidedBy}</td><td className="py-1 font-mono text-xs">{d.confirmed?.length ? d.confirmed.join(", ") : "none"}</td><td className="py-1 text-right font-mono">{d.overrides}</td><td className="py-1 text-right font-mono">{d.grade ?? ""}</td></tr>)}</tbody></table>
      ) : <p className="mt-3 text-sm text-ink-3">No decisions yet for this set.</p>}
    </section>
  );
}

function RubricDrawer({ table, onClose, onSave }: any) {
  const [draft, setDraft] = useState<any>(() => JSON.parse(JSON.stringify(table)));
  const [errors, setErrors] = useState<string[] | null>(null);
  const [method, setMethod] = useState({ id: "", label: "", signature: "" });
  const v = validateStandards(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(table);
  const setCode = (i: number, patch: any) => setDraft((d: any) => ({ ...d, codes: d.codes.map((c: any, j: number) => (j === i ? { ...c, ...patch } : c)) }));
  const addMethod = () => { if (!method.id || !method.signature) return; setDraft((d: any) => ({ ...d, methods: [...(d.methods ?? []), { ...method }] })); setMethod({ id: "", label: "", signature: "" }); };
  const approve = (i: number) => setDraft((d: any) => { const p = d.pendingPrecedents[i]; return { ...d, precedents: [...(d.precedents ?? []), `${p.code}: ${p.reason} (${p.by}, paper ${p.itemId})`], pendingPrecedents: d.pendingPrecedents.filter((_: any, j: number) => j !== i) }; });
  const save = async () => { const next = { ...draft, version: bump(table.version) }; const errs = await onSave(next); if (errs) setErrors(errs); else onClose(); };
  return (
    <div className="fixed inset-0 z-20 bg-black/30" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto bg-card p-6 shadow-xl" aria-label="Rubric">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Rubric {draft.id} <span className="font-mono text-sm text-ink-3">v{table.version}{dirty ? ` → v${bump(table.version)}` : ""}</span></h2>
          <button onClick={onClose} className="text-sm underline">Close</button>
        </div>
        <p className="mt-1 text-sm text-ink-2">Owner: {draft.owner}. Status: {draft.status}. Max {draft.max}. <span className={v.ok ? "text-human" : "text-warn"}>{v.ok ? "Validated by code." : "Invalid: " + v.errors.join("; ")}</span></p>
        <p className="mt-2 text-xs text-ink-3">The instructor owns this table. Every change is a new version, validated by code before it is used. The model never sees these numbers.</p>
        <h3 className="mt-5 text-sm font-semibold">Error codes and deductions</h3>
        <table className="mt-2 w-full text-sm"><thead><tr className="text-left text-xs text-ink-3"><th className="py-1">Code</th><th className="py-1">Error type</th><th className="py-1 text-right">Deduction</th></tr></thead>
          <tbody>{draft.codes.map((c: any, i: number) => <tr key={c.code} className="border-t border-line"><td className="py-1 font-mono">{c.code}</td><td className="py-1"><input value={c.label} onChange={(e) => setCode(i, { label: e.target.value })} className="w-full rounded border border-line px-2 py-0.5" /></td><td className="py-1 text-right"><input type="number" step="0.25" max={0} value={c.deduction} onChange={(e) => setCode(i, { deduction: Number(e.target.value) })} className="w-20 rounded border border-line px-2 py-0.5 text-right font-mono" /></td></tr>)}</tbody></table>
        <h3 className="mt-5 text-sm font-semibold">Listed methods</h3>
        <ul className="mt-2 space-y-1 text-sm">{(draft.methods ?? []).map((m: any) => <li key={m.id} className="flex gap-2"><span className="font-mono">{m.id}</span><span>{m.label}</span><span className="ml-auto font-mono text-xs text-ink-3">/{m.signature}/</span></li>)}</ul>
        <div className="mt-2 grid grid-cols-[80px_1fr_1fr_auto] gap-2 text-sm">
          <input placeholder="M2" value={method.id} onChange={(e) => setMethod({ ...method, id: e.target.value })} className="rounded border border-line px-2 py-1" aria-label="Method id" />
          <input placeholder="Computational formula" value={method.label} onChange={(e) => setMethod({ ...method, label: e.target.value })} className="rounded border border-line px-2 py-1" aria-label="Method label" />
          <input placeholder="regex, e.g. 360|320|sum of x squared" value={method.signature} onChange={(e) => setMethod({ ...method, signature: e.target.value })} className="rounded border border-line px-2 py-1 font-mono" aria-label="Method signature" />
          <button onClick={addMethod} className="rounded-md border border-line px-3 py-1">Add method</button>
        </div>
        <h3 className="mt-5 text-sm font-semibold">Precedents</h3>
        <ul className="mt-2 list-disc pl-5 text-sm space-y-1">{(draft.precedents ?? []).map((p: string, i: number) => <li key={i}>{p}</li>)}{!(draft.precedents ?? []).length && <li className="list-none text-ink-3">None yet.</li>}</ul>
        {(draft.pendingPrecedents ?? []).length > 0 && <>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Pending instructor approval</h4>
          <ul className="mt-1 space-y-1 text-sm">{draft.pendingPrecedents.map((p: any, i: number) => <li key={i} className="flex items-start gap-2"><span><span className="font-mono">{p.code}</span>: {p.reason} <span className="text-ink-3">({p.by}, paper {p.itemId})</span></span><button onClick={() => approve(i)} className="ml-auto rounded-md border border-line px-2 py-0.5 text-xs">Approve</button></li>)}</ul>
        </>}
        {errors && <ul role="alert" className="mt-3 text-sm text-warn list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="mt-6 flex gap-2">
          <button disabled={!dirty || !v.ok} onClick={save} className="rounded-md bg-ink px-4 py-2 text-sm text-white disabled:opacity-40">Save as v{bump(table.version)}</button>
          <button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm">Cancel</button>
        </div>
      </aside>
    </div>
  );
}

function PasteDialog({ onClose, onSubmit }: any) {
  const [text, setText] = useState("");
  const submit = () => {
    const steps = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!steps.length) return;
    const nums = steps.join(" ").match(/-?\d+(?:\.\d+)?/g);
    onSubmit({ steps, finalAnswer: nums ? Number(nums[nums.length - 1]) : null, header: null });
  };
  return (
    <div className="fixed inset-0 z-20 bg-black/30 flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Paste a paper</h2>
        <p className="mt-1 text-sm text-ink-2">One step per line. The gate runs on this machine first; anything that looks like a name is blocked until you decide. The last number is taken as the final answer.</p>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-3 w-full rounded-md border border-line p-3 font-mono text-sm" placeholder={"Mean = 40 / 5 = 8\nSample variance = 40 / (5 - 1) = 10\nSD = 10"} />
        <div className="mt-3 flex gap-2"><button onClick={submit} className="rounded-md bg-ink px-4 py-2 text-sm text-white">Run the gate</button><button onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm">Cancel</button></div>
      </div>
    </div>
  );
}
