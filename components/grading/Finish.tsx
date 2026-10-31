"use client";
import { recurring } from "@/lib/engine.js";
import { COPY } from "./copy";
import AgreementPanel from "./AgreementPanel";

const c = COPY.finish;
export default function Finish({ g, onStartOver, onMore }: { g: any; onStartOver: () => void; onMore: () => void }) {
  const counts = g.counts ?? {};
  const rows = (counts.decisions ?? []).filter((d: any) => d.idea === g.setId);
  const analytics = counts.analyticsByIdea?.[g.setId] ?? {};
  const wrong = recurring(analytics, g.table);
  const names = Object.values(counts.piiStripped ?? {}).reduce((a: number, b: any) => a + Number(b), 0);
  const left = g.papers.length - g.decided.size;
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 space-y-8">
      <h1 className="text-4xl font-bold">{c.title(rows.length, g.name)}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[[c.tiles.marked, rows.length], [c.tiles.changed, counts.overridden ?? 0], [c.tiles.notInPaper, counts.quotesNotFound ?? 0], [c.tiles.names, names]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-line bg-card p-4"><div className="text-sm text-fg-3">{k}</div><div className="text-3xl font-bold tabular-nums">{String(v)}</div></div>
        ))}
      </div>
      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="text-xl font-semibold">{c.wrongTitle}</h2><p className="text-sm text-fg-3">{c.wrongHelp}</p>
        {wrong.length ? <ul className="mt-3 space-y-1">{wrong.map((r: any) => <li key={r.code} className="flex gap-3"><span className="font-semibold tabular-nums w-8">{r.confirmed}</span><span>{c.reteach(r.label, r.confirmed)}</span></li>)}</ul> : <p className="mt-3 text-fg-3">{c.none}</p>}
      </section>
      <AgreementPanel idea={g.setId} table={g.table} />
      <section className="rounded-xl border border-line bg-card p-5 overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="text-left text-fg-3"><th className="py-1">{c.table.paper}</th><th className="py-1">{c.table.mark}</th><th className="py-1">{c.table.by}</th><th className="py-1">{c.table.note}</th></tr></thead>
          <tbody>{rows.map((d: any, i: number) => <tr key={i} className="border-t border-line"><td className="py-1 font-mono">{d.itemId}</td><td className="py-1 tabular-nums">{d.grade} / {g.table.max}</td><td className="py-1">{d.decidedBy}</td><td className="py-1 text-fg-2">{d.feedback}</td></tr>)}</tbody></table>
      </section>
      <div className="flex flex-wrap gap-3">
        {g.assignment ? <>
          <a className="btn btn-primary" href={`/api/export?set=${encodeURIComponent(g.setId)}`} download>{c.downloadShared}</a>
          <a className="btn" href={`/api/export?set=${encodeURIComponent(g.setId)}&names=1`} download>{c.downloadNames}</a>
        </> : <a className="btn btn-primary" href={`/api/export?set=${encodeURIComponent(g.setId)}`} download>{c.download}</a>}
        {left > 0 && <button className="btn" onClick={onMore}>{c.more} ({left} left)</button>}
        <button className="btn" onClick={onStartOver}>{c.startOver}</button>
      </div>
    </main>
  );
}
