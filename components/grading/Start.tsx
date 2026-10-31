"use client";
import { useState } from "react";
import { COPY } from "./copy";

const c = COPY.start;
const SETS_STATIC = new Set(["grade", "grade93"]);
export default function Start({ g, onStart }: { g: any; onStart: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadName, setUploadName] = useState("");
  const [uploadState, setUploadState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text?: string }>({ kind: "idle" });
  const ready = g.name.trim().length > 0 && g.papers.length > 0;
  const rubricId = g.rubricKey === "grade93" ? "demo201-q3q5" : "grade-q5";
  async function upload() {
    if (!files.length) return;
    setUploadState({ kind: "busy" });
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("rubric", rubricId); fd.append("name", uploadName);
    const res = await fetch("/api/ingest", { method: "POST", body: fd });
    const j = await res.json();
    if (!res.ok || !j.ok) { setUploadState({ kind: "error", text: j.error }); return; }
    await g.reload();
    g.setSetId(j.set.id);
    const names = j.report.reduce((a: number, r: any) => a + (r.counts?.NAME ?? 0), 0);
    setUploadState({ kind: "done", text: c.uploaded(j.report.length, names) });
    setFiles([]);
  }
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 space-y-8">
      <h1 className="text-4xl font-bold">{c.title}</h1>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-3">{c.question}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {g.allSets.map((s: any) => (
            <button key={s.id} onClick={() => g.setSetId(s.id)} aria-pressed={g.setId === s.id} className={`text-left rounded-xl border p-4 ${g.setId === s.id ? "border-accent bg-card ring-2 ring-accent" : "border-line bg-card"}`}>
              <div className="font-semibold">{s.title}</div><div className="text-sm text-fg-3">{s.sub}</div>
            </button>
          ))}
        </div>
        <p className="text-sm text-fg-2">{g.table.question}</p>
      </section>
      <section className="rounded-xl border border-line bg-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">{c.uploadTitle}</h2>
        <p className="text-sm text-fg-2">{c.uploadHint}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn cursor-pointer">{c.uploadButton}<input id="paper-files" type="file" multiple accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setUploadState({ kind: "idle" }); }} /></label>
          {files.length > 0 && <span className="text-sm">{files.length} {files.length === 1 ? "file" : "files"} chosen</span>}
          <input id="upload-name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder={c.uploadNamePlaceholder} aria-label={c.uploadName} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
          <button className="btn btn-primary" disabled={!files.length || uploadState.kind === "busy"} onClick={upload}>{uploadState.kind === "busy" ? c.uploading : "Read these papers"}</button>
        </div>
        {uploadState.kind === "done" && <p className="text-sm text-good">{uploadState.text}</p>}
        {uploadState.kind === "error" && <p className="text-sm text-bad">{c.uploadFailed} {uploadState.text ?? ""}</p>}
        {g.uploader && <p className="text-xs text-fg-3">{c.thisLaptop(g.uploader)}</p>}
        {!SETS_STATIC.has(g.setId) && <button className="btn text-sm" onClick={async () => { const r = await fetch("/api/ingest", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ set: g.setId }) }); const j = await r.json(); await g.reload(); setUploadState({ kind: j.ok ? "done" : "error", text: j.ok ? c.rereadDone(j.count) : j.error }); }}>{c.reread}</button>}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
          <span className="text-sm text-fg-3">{c.orSample}</span>
          <span className="rounded-lg border border-line px-3 py-2 text-sm">{g.setInfo.title}: {g.papers.length} papers{g.decided.size ? `, ${g.decided.size} already marked` : ""}</span>
          <button onClick={() => setAddOpen(true)} className="text-sm underline">{c.pasteTitle}</button>
        </div>
      </section>
      <section className="space-y-2">
        <label className="block text-sm font-semibold uppercase tracking-wide text-fg-3" htmlFor="grader-name">{c.yourName}</label>
        <input id="grader-name" value={g.name} onChange={(e) => g.setName(e.target.value)} placeholder={c.namePlaceholder} className="w-full max-w-md rounded-xl border border-line bg-card px-4 py-3 text-lg" />
      </section>
      <button disabled={!ready} onClick={onStart} className="btn btn-primary">{c.startButton} <span className="kbd">⏎</span></button>
      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-semibold">{c.howTitle}</h2>
        <ol className="mt-3 space-y-2 text-fg-2">{c.how.map((h, i) => <li key={i} className="flex gap-3"><span className="font-mono text-fg-3">{i + 1}</span><span>{h}</span></li>)}</ol>
        <button onClick={() => setLimitOpen((o) => !o)} className="mt-3 text-sm underline">{c.whatLeaves}</button>
        {limitOpen && <p className="mt-2 text-sm text-fg-2 border-l-2 border-line pl-3">{c.limit}</p>}
      </section>
      {addOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-5" onClick={() => setAddOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-xl bg-card p-6 space-y-4">
            <h2 className="text-xl font-semibold">{c.addPapers}</h2>
            <div><h3 className="font-semibold">{c.pasteTitle}</h3><p className="text-sm text-fg-3">{c.pasteHint}</p>
              <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className="mt-2 w-full rounded-lg border border-line bg-bg p-3 font-mono text-sm" />
              <button className="btn mt-2" onClick={() => { const steps = paste.split("\n").map((l) => l.trim()).filter(Boolean); if (!steps.length) return; const nums = steps.join(" ").match(/-?\d+(?:\.\d+)?/g); g.addPasted({ steps, finalAnswer: nums ? Number(nums[nums.length - 1]) : null, header: null }); setPaste(""); setAddOpen(false); }}>{c.pasteButton}</button></div>
            <div><h3 className="font-semibold">{c.folderTitle}</h3><p className="text-sm text-fg-3">{c.folderHint}</p>
              <pre className="mt-2 rounded-lg bg-bg p-3 font-mono text-sm overflow-x-auto">node scripts/ingest.js ~/Desktop/papers --set quiz5 --propose</pre></div>
            <button className="btn" onClick={() => setAddOpen(false)}>{COPY.scheme.close}</button>
          </div>
        </div>
      )}
    </main>
  );
}
