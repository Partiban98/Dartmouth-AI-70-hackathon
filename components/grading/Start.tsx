"use client";
import { useState } from "react";
import { COPY } from "./copy";

const c = COPY.start;
export default function Start({ g, onStart }: { g: any; onStart: () => void }) {
  const [addOpen, setAddOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const ready = g.name.trim().length > 0;
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
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-3">{c.papers}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-line bg-card px-4 py-3">{g.papers.length === 25 && g.setId === "grade" ? c.samplePapers(25) : `${g.papers.length} papers`}{g.decided.size ? `, ${g.decided.size} already marked` : ""}</span>
          <button onClick={() => setAddOpen(true)} className="btn">{c.addPapers}</button>
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
