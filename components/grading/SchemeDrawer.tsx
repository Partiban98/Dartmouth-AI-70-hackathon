"use client";
import { useState } from "react";
import { validateStandards } from "@/lib/engine.js";
import { bumpVersion } from "@/lib/feedback.js";
import { COPY } from "./copy";

const c = COPY.scheme;
export default function SchemeDrawer({ table, onClose, onSave }: any) {
  const [draft, setDraft] = useState<any>(() => JSON.parse(JSON.stringify(table)));
  const [errors, setErrors] = useState<string[] | null>(null);
  const [method, setMethod] = useState({ id: "", label: "", signature: "" });
  const [showPattern, setShowPattern] = useState(false);
  const v = validateStandards(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(table);
  const setCode = (i: number, patch: any) => setDraft((d: any) => ({ ...d, codes: d.codes.map((x: any, j: number) => (j === i ? { ...x, ...patch } : x)) }));
  const approve = (i: number) => setDraft((d: any) => { const p = d.pendingPrecedents[i]; return { ...d, precedents: [...(d.precedents ?? []), `${p.code}: ${p.reason} (${p.by}, paper ${p.itemId})`], pendingPrecedents: d.pendingPrecedents.filter((_: any, j: number) => j !== i) }; });
  const save = async () => { const errs = await onSave({ ...draft, version: bumpVersion(table.version) }); if (errs) setErrors(errs); else onClose(); };
  return (
    <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto bg-card p-6" aria-label={c.title}>
        <div className="flex items-baseline justify-between"><h2 className="text-2xl font-semibold">{c.title} <span className="text-sm text-fg-3">{c.version(table.version)}</span></h2><button className="underline text-sm" onClick={onClose}>{c.close}</button></div>
        <p className="mt-1 text-sm text-fg-2">{c.owner(draft.owner)} <span className={v.ok ? "text-good" : "text-bad"}>{v.ok ? c.ready : c.invalid + ": " + v.errors.join("; ")}</span></p>
        <table className="mt-5 w-full text-sm"><thead><tr className="text-left text-fg-3"><th className="py-1">{c.mistake}</th><th className="py-1 text-right">{c.pointsOff}</th></tr></thead>
          <tbody>{draft.codes.filter((x: any) => x.code !== "OK" && x.code !== "UNSURE").map((x: any) => { const i = draft.codes.indexOf(x); return <tr key={x.code} className="border-t border-line"><td className="py-1"><input value={x.label} onChange={(e) => setCode(i, { label: e.target.value })} className="w-full rounded border border-line bg-bg px-2 py-1" /><span className="font-mono text-xs text-fg-3">{x.code}</span></td><td className="py-1 text-right"><input type="number" step="0.25" max={0} value={x.deduction} onChange={(e) => setCode(i, { deduction: Number(e.target.value) })} className="w-20 rounded border border-line bg-bg px-2 py-1 text-right tabular-nums" /></td></tr>; })}</tbody></table>
        <h3 className="mt-6 font-semibold">{c.methods}</h3>
        <ul className="mt-2 space-y-1 text-sm">{(draft.methods ?? []).map((m: any) => <li key={m.id}><span className="font-semibold">{m.id}</span> {m.label}{showPattern && <span className="ml-2 font-mono text-xs text-fg-3">/{m.signature}/</span>}</li>)}</ul>
        <button className="text-xs underline" onClick={() => setShowPattern((s) => !s)}>{c.showPattern}</button>
        <div className="mt-2 grid grid-cols-[70px_1fr_1fr_auto] gap-2 text-sm">
          <input placeholder="M2" value={method.id} onChange={(e) => setMethod({ ...method, id: e.target.value })} className="rounded border border-line bg-bg px-2 py-1" aria-label="Short name" />
          <input placeholder="Computational formula" value={method.label} onChange={(e) => setMethod({ ...method, label: e.target.value })} className="rounded border border-line bg-bg px-2 py-1" aria-label="What it is" />
          <input placeholder="words that identify it, e.g. 360|320" value={method.signature} onChange={(e) => setMethod({ ...method, signature: e.target.value })} className="rounded border border-line bg-bg px-2 py-1 font-mono" aria-label="Words that identify it" />
          <button className="btn text-sm" onClick={() => { if (!method.id || !method.signature) return; setDraft((d: any) => ({ ...d, methods: [...(d.methods ?? []), { ...method }] })); setMethod({ id: "", label: "", signature: "" }); }}>{c.addMethod}</button>
        </div>
        {(draft.pendingPrecedents ?? []).length > 0 && <>
          <h3 className="mt-6 font-semibold">{c.reviewTitle}</h3><p className="text-sm text-fg-3">{c.reviewHelp}</p>
          <ul className="mt-2 space-y-2 text-sm">{draft.pendingPrecedents.map((p: any, i: number) => <li key={i} className="flex items-start gap-2 rounded-lg bg-wait-bg p-2"><span><span className="font-mono">{p.code}</span>: {p.reason} <span className="text-fg-3">({p.by}, paper {p.itemId})</span></span><button className="btn text-xs ml-auto" onClick={() => approve(i)}>{c.approve}</button></li>)}</ul>
        </>}
        {(draft.precedents ?? []).length > 0 && <ul className="mt-4 list-disc pl-5 text-sm text-fg-2">{draft.precedents.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>}
        {errors && <ul role="alert" className="mt-3 text-sm text-bad list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        <div className="mt-6 flex gap-2"><button className="btn btn-primary" disabled={!dirty || !v.ok} onClick={save}>{c.save(bumpVersion(table.version))}</button><button className="btn" onClick={onClose}>{c.cancel}</button></div>
      </aside>
    </div>
  );
}
