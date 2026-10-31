"use client";
import { useEffect, useState } from "react";
import { COPY } from "./copy";
import { packPreview } from "./checks.js";

const w = COPY.wizard, d = COPY.doors, cr = COPY.create, jn = COPY.join, cf = COPY.callFirst;
const SAMPLES = ["grade", "grade93"];
const mistakesOf = (t: any) => (t?.codes ?? []).filter((x: any) => x.code !== "OK" && x.code !== "UNSURE");
const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {});
const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export default function Start({ g, onStart }: { g: any; onStart: () => void }) {
  const [mode, setMode] = useState<"doors" | "new" | "card" | "join" | "wizard">("doors");
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [upload, setUpload] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });
  const [limitOpen, setLimitOpen] = useState(false);
  const canNext = step === 1 ? !!g.table : step === 2 ? g.papers.length > 0 : step === 3 ? g.name.trim().length > 0 : true;
  const rubricId = g.rubricKey === "grade93" ? "demo201-q3q5" : "grade-q5";

  useEffect(() => {
    if (mode !== "wizard") return;
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) && t.tagName !== "INPUT") return; if (e.key === "Enter" && canNext) { e.preventDefault(); step < 4 ? setStep(step + 1) : onStart(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [mode, step, canNext, onStart]);
  const open = (setId: string, at: number) => { g.setSetId(setId); setStep(at); setMode("wizard"); };

  if (mode === "doors") return <Doors g={g} onContinue={(code) => open(code, 1)} onNew={() => setMode("new")} onJoin={() => setMode("join")} onSample={() => open(SAMPLES.includes(g.setId) ? g.setId : "grade", 1)} />;
  if (mode === "new") return <Create g={g} onBack={() => setMode("doors")} onCreated={async (code) => { await g.reload(); g.setSetId(code); setMode("card"); }} />;
  if (mode === "card" && g.assignment) return <CodeCard a={g.assignment} onNext={() => open(g.assignment.code, 2)} />;
  if (mode === "join") return <Join onBack={() => setMode("doors")} onJoined={async (code) => { await g.reload(); open(code, 1); }} />;

  async function readFiles() {
    if (!files.length) return;
    setUpload({ kind: "busy" });
    const fd = new FormData(); for (const f of files) fd.append("files", f); fd.append("rubric", rubricId); fd.append("name", uploadName); if (g.assignment) fd.append("assignment", g.assignment.code);
    const res = await fetch("/api/ingest", { method: "POST", body: fd }); const j = await res.json();
    if (!res.ok || !j.ok) { setUpload({ kind: "error", text: j.error }); return; }
    await g.reload(); g.setSetId(j.set.id);
    const names = j.report.reduce((a: number, r: any) => a + (r.counts?.NAME ?? 0), 0);
    setUpload({ kind: "done", text: `${w.p.ready(j.report.length)} ${w.p.hidden(names)}` }); setFiles([]);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-6">
      <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
        {w.steps.map((s, i) => <li key={s} className={cls("flex items-center gap-2", i + 1 === step ? "font-semibold" : "text-fg-3")}><span className={cls("w-6 h-6 rounded-full grid place-items-center text-xs", i + 1 < step ? "bg-good text-white" : i + 1 === step ? "bg-accent text-accent-fg" : "bg-line")}>{i + 1 < step ? "✓" : i + 1}</span>{s}{i < 3 && <span className="w-6 h-px bg-line" />}</li>)}
      </ol>

      <section className="rounded-xl border border-line bg-card p-6 space-y-4 panel-in" key={step}>
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">{w.stepOf(step)}</p>

        {step === 1 && <>
          <h1 className="text-3xl font-bold">{w.q.title}</h1>
          <p className="text-fg-2">{w.q.help}</p>
          <div className="grid gap-2">
            {(g.assignment ? [{ id: g.setId, ...g.setInfo }] : g.allSets.filter((s: any) => SAMPLES.includes(s.id))).map((s: any) => (
              <button key={s.id} onClick={() => g.setSetId(s.id)} aria-pressed={g.setId === s.id} className={cls("text-left rounded-xl border p-4", g.setId === s.id ? "border-accent ring-2 ring-accent" : "border-line")}>
                <div className="font-semibold">{s.title}</div><div className="text-sm text-fg-3">{s.sub}</div>
              </button>
            ))}
          </div>
          {g.table && <div className="rounded-lg bg-bg p-4 text-sm">
            <p className="text-fg-2">{g.table.question}</p>
            <p className="mt-2 text-fg-3">{w.q.scheme}: {w.q.mistakes(g.table.codes.filter((c: any) => c.code !== "OK" && c.code !== "UNSURE").length)} · {w.q.methods((g.table.methods ?? []).length)} · {w.q.max(g.table.max)} · version {g.table.version}</p>
          </div>}
        </>}

        {step === 2 && <>
          <h1 className="text-3xl font-bold">{w.p.title}</h1>
          <p className="text-fg-2">{w.p.help}</p>
          <div className="rounded-lg border border-line p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn cursor-pointer">{COPY.start.uploadButton}<input id="paper-files" type="file" multiple accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setUpload({ kind: "idle" }); }} /></label>
              {files.length > 0 && <span className="text-sm">{w.p.chosen(files.length)}</span>}
              {!g.assignment && <input id="upload-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder={COPY.start.uploadNamePlaceholder} aria-label={COPY.start.uploadName} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm" />}
              <button className="btn btn-primary" disabled={!files.length || upload.kind === "busy"} onClick={readFiles}>{upload.kind === "busy" ? COPY.start.uploading : "Read these papers"}</button>
            </div>
            {upload.kind === "done" && <p className="text-sm text-good">{upload.text}</p>}
            {upload.kind === "error" && <p className="text-sm text-bad">{COPY.start.uploadFailed} {upload.text ?? ""}</p>}
            {g.uploader && <p className="text-xs text-fg-3">{COPY.start.thisLaptop(g.uploader)}</p>}
          </div>
          {!g.assignment && <div className="grid gap-2">
            {g.allSets.filter((s: any) => s.id === g.rubricKey || !["grade", "grade93"].includes(s.id)).map((s: any) => (
              <button key={s.id} onClick={() => g.setSetId(s.id)} aria-pressed={g.setId === s.id} className={cls("text-left rounded-xl border p-3 text-sm", g.setId === s.id ? "border-accent ring-2 ring-accent" : "border-line")}>
                <span className="font-semibold">{["grade", "grade93"].includes(s.id) ? w.p.sample : s.title}</span> <span className="text-fg-3">· {s.sub}</span>
              </button>
            ))}
          </div>}
          <p className="text-sm text-fg-2">{g.papers.length ? w.p.ready(g.papers.length) : ""}{g.decided.size ? ` ${g.decided.size} already marked.` : ""}</p>
          <button onClick={() => setLimitOpen((o) => !o)} className="text-sm underline">{COPY.start.whatLeaves}</button>
          {limitOpen && <p className="text-sm text-fg-2 border-l-2 border-line pl-3">{COPY.start.limit}</p>}
        </>}

        {step === 3 && <>
          <h1 className="text-3xl font-bold">{w.y.title}</h1>
          <p className="text-fg-2">{w.y.help}</p>
          <input id="grader-name" autoFocus value={g.name} onChange={(e) => g.setName(e.target.value)} placeholder={w.y.placeholder} className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-xl" />
        </>}

        {step === 4 && <>
          <h1 className="text-3xl font-bold">{w.g.title}</h1>
          <p className="text-fg-2">{w.g.help}</p>
          <ol className="space-y-2">
            {w.g.steps.map(([t, d], i) => <li key={t} className="flex gap-3 rounded-lg bg-bg p-3"><span className="w-6 h-6 shrink-0 rounded-full bg-accent text-accent-fg grid place-items-center text-xs">{i + 1}</span><span><span className="font-semibold">{t}.</span> <span className="text-fg-2">{d}</span></span></li>)}
          </ol>
          <p className="text-sm text-fg-3">{w.g.keys}</p>
          <CallFirstToggle />
          <p className="text-sm">{g.setInfo.title} · {w.g.starting(g.papers.length)} · {g.name}</p>
        </>}

        <div className="flex items-center gap-2 pt-2">
          <button className="btn" onClick={() => (step > 1 ? setStep(step - 1) : setMode("doors"))}>{w.back}</button>
          <span className="flex-1" />
          {step < 4 ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{w.next} <span className="kbd">⏎</span></button>
            : <button className="btn btn-primary" onClick={onStart}>{w.g.start} <span className="kbd">⏎</span></button>}
        </div>
      </section>
    </main>
  );
}

function Doors({ g, onContinue, onNew, onJoin, onSample }: { g: any; onContinue: (code: string) => void; onNew: () => void; onJoin: () => void; onSample: () => void }) {
  const [copied, setCopied] = useState("");
  const door = "w-full text-left rounded-xl border border-line bg-card p-5 hover:border-accent";
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-4">
      <h1 className="text-3xl font-bold">{d.title}</h1>
      {g.assignments.map((a: any) => (
        <div key={a.code} className="rounded-xl border-2 border-accent bg-card p-5 space-y-2">
          <button className="w-full text-left" onClick={() => onContinue(a.code)}>
            <div className="text-xl font-semibold">{d.continueLabel(`${a.course} · ${a.title}`)}</div>
            <div className="text-sm text-fg-3">{d.continueSub((g.importedPapers[a.code] ?? []).length, !a.joined)} · <span className="font-mono">{a.code}</span> · version {a.version}</div>
          </button>
          <button className="text-sm underline" onClick={() => { copy(cr.message(a.course, a.title, a.code, a.pack)); setCopied(a.code); }}>{copied === a.code ? d.copied : d.copyPack}</button>
        </div>
      ))}
      <button className={door} onClick={onNew}><div className="text-xl font-semibold">{d.newLabel}</div><div className="text-sm text-fg-3">{d.newSub}</div></button>
      <button className={door} onClick={onJoin}><div className="text-xl font-semibold">{d.joinLabel}</div><div className="text-sm text-fg-3">{d.joinSub}</div></button>
      <button className="text-sm underline" onClick={onSample}>{d.sample}</button>
    </main>
  );
}

function Create({ g, onBack, onCreated }: { g: any; onBack: () => void; onCreated: (code: string) => void }) {
  const [f, setF] = useState<any>({ course: "", title: "", question: "", max: 10, answer: "", rows: [{ code: "E-1", label: "", deduction: -1 }], extra: {} });
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const set = (patch: any) => setF((x: any) => ({ ...x, ...patch }));
  const setRow = (i: number, patch: any) => set({ rows: f.rows.map((r: any, j: number) => (j === i ? { ...r, ...patch } : r)) });
  const fromSample = () => { const t = g.sampleScheme; if (!t) return; set({ question: t.question, max: t.max, answer: t.correctAnswer ?? "", rows: mistakesOf(t).map((x: any) => ({ ...x })), extra: { methods: t.methods ?? [], answerRules: t.answerRules ?? [], tolerance: t.tolerance } }); };
  const field = "w-full rounded-lg border border-line bg-bg px-3 py-2";
  async function save() {
    setState({ busy: true });
    const rows = f.rows.filter((r: any) => r.label.trim());
    const codes = [...rows.map((r: any) => ({ code: r.code, label: r.label.trim(), deduction: Number(r.deduction) })), { code: "OK", deduction: 0, label: "No mistake" }, { code: "UNSURE", deduction: 0, label: "Not sure, ask the head TA" }];
    const body = { course: f.course.trim(), title: f.title.trim(), question: f.question.trim(), max: Number(f.max), codes, methods: f.extra.methods ?? [], answerRules: (f.extra.answerRules ?? []).filter((r: any) => rows.some((x: any) => x.code === r.code)), ...(f.answer !== "" ? { correctAnswer: Number(f.answer), tolerance: f.extra.tolerance ?? 0.01 } : {}) };
    const res = await fetch("/api/assignment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await res.json();
    if (!res.ok || !j.ok) { setState({ error: j.error }); return; }
    onCreated(j.assignment.code);
  }
  const ready = f.course.trim() && f.title.trim() && f.question.trim() && f.rows.some((r: any) => r.label.trim());
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-4">
      <h1 className="text-3xl font-bold">{cr.title}</h1>
      <p className="text-fg-2">{cr.help}</p>
      <button className="text-sm underline" onClick={fromSample}>{cr.fromSample}</button>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">{cr.course}<input className={field} value={f.course} placeholder={cr.coursePlaceholder} onChange={(e) => set({ course: e.target.value })} /></label>
        <label className="text-sm">{cr.name}<input className={field} value={f.title} placeholder={cr.namePlaceholder} onChange={(e) => set({ title: e.target.value })} /></label>
      </div>
      <label className="block text-sm">{cr.question}<textarea className={field} rows={3} value={f.question} onChange={(e) => set({ question: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">{cr.max}<input className={field} type="number" min={0} value={f.max} onChange={(e) => set({ max: e.target.value })} /></label>
        <label className="text-sm">{cr.answer}<input className={field} type="number" step="any" value={f.answer} onChange={(e) => set({ answer: e.target.value })} /></label>
      </div>
      <fieldset className="space-y-2"><legend className="font-semibold">{cr.mistakes}</legend><p className="text-sm text-fg-3">{cr.mistakeHelp}</p>
        {f.rows.map((r: any, i: number) => <div key={r.code} className="grid grid-cols-[1fr_90px] gap-2">
          <input className={field} aria-label={`${cr.mistakes} ${i + 1}`} placeholder={cr.mistakePlaceholder} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} />
          <input className={field + " text-right tabular-nums"} aria-label={`${COPY.scheme.pointsOff} ${i + 1}`} type="number" step="0.25" max={0} value={r.deduction} onChange={(e) => setRow(i, { deduction: e.target.value })} />
        </div>)}
        <button className="btn text-sm" onClick={() => set({ rows: [...f.rows, { code: `E-${f.rows.length + 1}${f.rows.some((x: any) => x.code === `E-${f.rows.length + 1}`) ? "B" : ""}`, label: "", deduction: -1 }] })}>{cr.addMistake}</button>
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-bad">{cr.failed} {state.error}</p>}
      <div className="flex gap-2"><button className="btn" onClick={onBack}>{d.back}</button><span className="flex-1" /><button className="btn btn-primary" disabled={!ready || state.busy} onClick={save}>{state.busy ? cr.saving : cr.save}</button></div>
    </main>
  );
}

function CodeCard({ a, onNext }: { a: any; onNext: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-4">
      <h1 className="text-3xl font-bold">{cr.cardTitle}</h1>
      <div className="rounded-xl border-2 border-accent bg-card p-6 text-center">
        <div className="font-mono text-5xl font-bold tracking-widest">{a.code}</div>
        <div className="mt-2 text-fg-2">{a.course} · {a.title} · version {a.version}</div>
      </div>
      <p className="text-fg-2">{cr.cardHelp}</p>
      <textarea readOnly aria-label={cr.copyMessage} className="w-full rounded-lg border border-line bg-bg p-3 font-mono text-xs" rows={4} value={cr.message(a.course, a.title, a.code, a.pack)} />
      <div className="flex gap-2"><button className="btn" onClick={() => { copy(cr.message(a.course, a.title, a.code, a.pack)); setCopied(true); }}>{copied ? d.copied : cr.copyMessage}</button><span className="flex-1" /><button className="btn btn-primary" onClick={onNext}>{cr.next}</button></div>
    </main>
  );
}

function Join({ onBack, onJoined }: { onBack: () => void; onJoined: (code: string) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [clash, setClash] = useState(false);
  const p: any = text.trim() ? packPreview(text) : null; // any malformed pack reads as unreadable, never a crash
  async function join(force: boolean) {
    const pack = p?.pack;
    const res = await fetch("/api/assignment", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack, force }) }); const j = await res.json();
    if (!res.ok || !j.ok) { setError(j.error); setClash(/already/i.test(j.error ?? "")); return; }
    onJoined(j.assignment.code);
  }
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 space-y-4">
      <h1 className="text-3xl font-bold">{jn.title}</h1>
      <label className="block"><span className="font-semibold">{jn.field}</span>
        <textarea autoFocus className="mt-1 w-full rounded-lg border border-line bg-bg p-3 font-mono text-xs" rows={4} value={text} onChange={(e) => { setText(e.target.value); setError(""); setClash(false); }} /></label>
      <p className="text-sm text-fg-3">{jn.help}</p>
      {text.trim() && !p && <p className="text-sm text-bad">{jn.unreadable}</p>}
      {p && <div className="rounded-lg bg-bg p-4 text-sm space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">{jn.preview}</p>
        <p className="text-lg font-semibold">{p.course} · {p.title} <span className="font-mono text-sm text-fg-3">{p.code}</span></p>
        <p className="text-fg-2">{p.question}</p>
        <p className="text-fg-3">{w.q.scheme}: {w.q.mistakes(p.mistakes)} · {w.q.max(p.max)} · version {p.version}</p>
        <p className="text-fg-3">{jn.setBy(p.createdBy)}</p>
      </div>}
      {error && <p role="alert" className="text-sm text-bad">{jn.failed} {error}</p>}
      <div className="flex gap-2"><button className="btn" onClick={onBack}>{d.back}</button><span className="flex-1" />
        {clash && <button className="btn" onClick={() => join(true)}>{jn.replace(p?.version ?? "")}</button>}
        <button className="btn btn-primary" disabled={!p} onClick={() => join(false)}>{jn.join}</button></div>
    </main>
  );
}

/** Off unless this grader turns it on, so the existing flow is exactly as it
 *  was for anyone who does not opt in. Remembered on this browser only. */
function CallFirstToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem("remain.callFirst") === "1"); } catch {} }, []);
  const flip = (v: boolean) => { setOn(v); try { localStorage.setItem("remain.callFirst", v ? "1" : "0"); } catch {} };
  return (
    <div className="rounded-lg border border-line p-3">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={on} onChange={(e) => flip(e.target.checked)} /> {cf.toggle}
      </label>
      <p className="mt-1 text-sm text-fg-3">{cf.toggleHelp}</p>
    </div>
  );
}
