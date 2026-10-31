"use client";
// After the TA overrides a suggestion, this turns that ruling into a stored test
// case. The TA decides whether it is worth testing against, and says why. The
// model never sets, suggests or edits the expected result.
import { useState } from "react";
import { COPY } from "./copy";

const c = COPY.evalSet;

export default function MakeTestCase({ idea, itemId, aiCode, taRuling, onAdded }: { idea: string; itemId: string; aiCode: string | null; taRuling: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "added">("idle");
  const [error, setError] = useState("");

  if (state === "added") return <p className="mt-3 text-sm font-semibold text-good">{c.added}</p>;
  if (!open) return <button className="btn text-sm mt-3" onClick={() => setOpen(true)}>{c.make}</button>;

  const save = async () => {
    if (!reason.trim()) { setError(c.needWhy); return; }
    setState("saving"); setError("");
    const res = await fetch("/api/eval-cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idea, itemId, aiCode, taRuling, reason }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("idle"); setError(j.error ?? "Could not save that case."); return; }
    setState("added"); onAdded();
  };

  return (
    <div className="mt-3 space-y-2">
      <label className="block text-sm font-semibold" htmlFor="tc-why">{c.why}
        <input id="tc-why" type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-normal" />
      </label>
      <p className="text-xs text-fg-3">{c.whyHint}</p>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary text-sm" disabled={state === "saving" || !reason.trim()} onClick={save}>{c.save}</button>
    </div>
  );
}
