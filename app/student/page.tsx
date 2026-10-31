"use client";
// What a student sees about their own marks: which step cost points, the rubric
// line behind it, and that a person decided. The model writes nothing here.
import { useEffect, useState } from "react";
import DeductionCard, { type Deduction } from "@/components/student/DeductionCard";
import RegradeRequest from "@/components/student/RegradeRequest";

type Question = { questionId: string; questionText: string | null; mark: number | null; max: number | null; rubricVersion: string | null; note: string | null; rubricUnavailable: boolean; deductions: Deduction[] };
type View = { anonId: string; questions: Question[]; total: number; outOf: number | null };

const get = (path: string) => fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

export default function StudentPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [anonId, setAnonId] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);

  // Every paper a TA has actually marked, from the decision log.
  useEffect(() => { get("/counts").then((c) => {
    const seen = [...new Set(((c?.decisions ?? []) as any[]).map((d) => d.itemId))].sort();
    setIds(seen as string[]); setAnonId((prev) => prev || (seen[0] as string) || ""); setLoading(false);
  }); }, []);

  useEffect(() => {
    let active = true;
    setView(null);
    if (!anonId) { setViewLoading(false); return; }
    setViewLoading(true);
    get(`/api/student/${encodeURIComponent(anonId)}`).then((next) => {
      if (active) { setView(next); setViewLoading(false); }
    });
    return () => { active = false; };
  }, [anonId]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Why I lost points</h1>
      <p className="mt-2 text-fg-2">Every mark here was typed by a person. The AI suggested possible mistakes; your TA confirmed, changed or ruled out each one and assigned the mark.</p>
      <p className="mt-2 text-sm text-fg-3">Demo uses synthetic students. For formal accommodations, contact{" "}
        <a className="underline" href="https://students.dartmouth.edu/student-accessibility/" target="_blank" rel="noreferrer">Student Accessibility Services</a>.</p>

      <label className="mt-6 block text-sm font-semibold" htmlFor="who">Synthetic demo student
        <select id="who" value={anonId} onChange={(e) => setAnonId(e.target.value)} className="mt-1 block w-48 rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal">
          {ids.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      {loading && <p className="mt-6 text-fg-3">Loading…</p>}
      {!loading && !ids.length && <p className="mt-6 text-fg-2">Nothing has been marked yet. A TA marks papers on the grading screen first.</p>}
      {viewLoading && <p role="status" className="mt-6 text-fg-3">Loading marks…</p>}
      {!loading && !viewLoading && ids.length > 0 && !view && <p className="mt-6 text-fg-2">No marks for {anonId}.</p>}

      {view && (
        <>
          <p className="mt-6 text-3xl font-bold">{view.total} {view.outOf != null && <span className="text-xl font-normal text-fg-3">out of {view.outOf}</span>}</p>
          {view.questions.map((q, i) => (
            <section key={`${view.anonId}:${q.questionId}`} className="mt-6">
              <h2 className="text-lg font-semibold">{q.questionId} · {q.mark}{q.max != null ? ` out of ${q.max}` : ""}</h2>
              {q.questionText && <p className="mt-1 text-sm text-fg-3">{q.questionText}</p>}
              {q.rubricVersion && <p className="mt-1 text-sm text-fg-3">Marking scheme version {q.rubricVersion}</p>}
              {q.rubricUnavailable && <p className="mt-2 text-fg-3">The original marking scheme is unavailable. Your TA's saved mark is shown; the original points and rubric details cannot be reconstructed.</p>}
              {q.deductions.length === 0
                ? <p className="mt-3 text-fg-2">No mistakes were confirmed on this question.</p>
                : <ul className="mt-3 space-y-3">{q.deductions.map((d) => <DeductionCard key={d.code} label={q.questionId} d={d} />)}</ul>}
              {q.note && <p className="mt-3 text-fg-2">Note from your TA: “{q.note}”</p>}
              <RegradeRequest anonId={view.anonId} questionId={q.questionId} />
            </section>
          ))}
        </>
      )}
    </main>
  );
}
