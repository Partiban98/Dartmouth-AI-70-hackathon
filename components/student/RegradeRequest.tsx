"use client";
// The student decides whether to ask, and writes the argument themselves.
// A person decides the outcome later. Nothing here notifies anyone.
import { useState } from "react";

const MIN = 20;

export default function RegradeRequest({ anonId, questionId }: { anonId: string; questionId: string }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (text.trim().length < MIN) { setError(`Please use at least ${MIN} characters so your TA has something to read.`); return; }
    setSending(true); setError("");
    const res = await fetch("/api/regrade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ anonId, questionId, text }) });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(j.error ?? "That could not be saved."); return; }
    setText(""); setMsg("Saved for your TA to review. A person will decide.");
  };

  return (
    <section className="mt-8 rounded-xl border border-line p-5">
      <h2 className="text-lg font-semibold">Ask for a regrade</h2>
      <label className="mt-3 block text-sm font-semibold" htmlFor="regrade-text">Explain in your own words
        <textarea id="regrade-text" value={text} onChange={(e) => { setText(e.target.value); setMsg(""); }} rows={4}
          className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal" />
      </label>
      <p className="mt-1 text-sm text-fg-3">At least {MIN} characters. Your TA reads this; nothing is sent automatically.</p>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-3" disabled={sending} onClick={send}>Submit</button>
      <p role="status" className="mt-3 text-sm font-semibold text-good">{msg}</p>
    </section>
  );
}
