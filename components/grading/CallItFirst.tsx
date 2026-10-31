"use client";
// The TA's own call, before the AI says anything. Nothing from the AI's
// proposal is passed to this component, so there is nothing for it to leak.
import { useEffect, useState } from "react";
import { COPY } from "./copy";

const c = COPY.callFirst;

export default function CallItFirst({ table, onLock }: { table: any; onLock: (code: string) => void }) {
  const [code, setCode] = useState("OK");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = async () => { if (busy) return; setBusy(true); setError(""); try { await onLock(code); } catch (e: any) { setError(e?.message ?? "That call could not be saved."); } finally { setBusy(false); } };
  useEffect(() => { const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && /^(BUTTON|SELECT|TEXTAREA|INPUT|A)$/.test(t.tagName)) return; if (e.key === "Enter") { e.preventDefault(); lock(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold text-lg">{c.title}</h2>
      <p className="mt-2 text-fg-2">{c.help}</p>
      <label className="mt-4 block text-sm font-semibold" htmlFor="my-call">{c.label}
        <select id="my-call" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal">
          <option value="OK">{c.noError}</option>
          {(table?.codes ?? []).filter((x: any) => x.code !== "OK" && x.code !== "UNSURE").map((x: any) => <option key={x.code} value={x.code}>{x.label} ({x.code})</option>)}
        </select>
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-4" disabled={busy} onClick={lock}>{c.lock} <span className="kbd">⏎</span></button>
    </section>
  );
}
