"use client";
import { useEffect, useState } from "react";
import { COPY } from "./copy";

const w = COPY.wizard;
const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export default function Start({ g, onStart }: { g: any; onStart: () => void }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [upload, setUpload] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });
  const [limitOpen, setLimitOpen] = useState(false);
  const canNext = step === 1 ? !!g.table : step === 2 ? g.papers.length > 0 : step === 3 ? g.name.trim().length > 0 : true;
  const rubricId = g.rubricKey === "grade93" ? "demo201-q3q5" : "grade-q5";

  useEffect(() => {
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) && t.tagName !== "INPUT") return; if (e.key === "Enter" && canNext) { e.preventDefault(); step < 4 ? setStep(step + 1) : onStart(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [step, canNext, onStart]);

  async function readFiles() {
    if (!files.length) return;
    setUpload({ kind: "busy" });
    const fd = new FormData(); for (const f of files) fd.append("files", f); fd.append("rubric", rubricId); fd.append("name", uploadName);
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
            {g.allSets.filter((s: any) => ["grade", "grade93"].includes(s.id)).map((s: any) => (
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
              <input id="upload-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder={COPY.start.uploadNamePlaceholder} aria-label={COPY.start.uploadName} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
              <button className="btn btn-primary" disabled={!files.length || upload.kind === "busy"} onClick={readFiles}>{upload.kind === "busy" ? COPY.start.uploading : "Read these papers"}</button>
            </div>
            {upload.kind === "done" && <p className="text-sm text-good">{upload.text}</p>}
            {upload.kind === "error" && <p className="text-sm text-bad">{COPY.start.uploadFailed} {upload.text ?? ""}</p>}
            {g.uploader && <p className="text-xs text-fg-3">{COPY.start.thisLaptop(g.uploader)}</p>}
          </div>
          <div className="grid gap-2">
            {g.allSets.filter((s: any) => s.id === g.rubricKey || !["grade", "grade93"].includes(s.id)).map((s: any) => (
              <button key={s.id} onClick={() => g.setSetId(s.id)} aria-pressed={g.setId === s.id} className={cls("text-left rounded-xl border p-3 text-sm", g.setId === s.id ? "border-accent ring-2 ring-accent" : "border-line")}>
                <span className="font-semibold">{["grade", "grade93"].includes(s.id) ? w.p.sample : s.title}</span> <span className="text-fg-3">· {s.sub}</span>
              </button>
            ))}
          </div>
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
          <p className="text-sm">{g.setInfo.title} · {w.g.starting(g.papers.length)} · {g.name}</p>
        </>}

        <div className="flex items-center gap-2 pt-2">
          {step > 1 && <button className="btn" onClick={() => setStep(step - 1)}>{w.back}</button>}
          <span className="flex-1" />
          {step < 4 ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>{w.next} <span className="kbd">⏎</span></button>
            : <button className="btn btn-primary" onClick={onStart}>{w.g.start} <span className="kbd">⏎</span></button>}
        </div>
      </section>
    </main>
  );
}
