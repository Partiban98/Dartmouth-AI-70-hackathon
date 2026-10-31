"use client";
// Counts only: how many cases the TAs have kept, and how many the AI still
// disagrees with. No per-case expected answer is ever fetched or shown.
import { useEffect, useState } from "react";
import { COPY } from "./copy";

const c = COPY.evalSet;

export default function RegressionBadge({ bump }: { bump: number }) {
  const [s, setS] = useState<{ cases: number; lastRun: string | null; mismatch: number | null } | null>(null);
  useEffect(() => { fetch("/api/eval-summary", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {}); }, [bump]);
  if (!s || !s.cases) return null;
  return <span className="text-sm text-fg-3">{c.badge(s.cases)} · {s.lastRun && s.mismatch !== null ? c.lastEval(s.mismatch) : c.noEval}</span>;
}
