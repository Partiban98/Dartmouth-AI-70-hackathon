// One deduction, as text. The heading says what it cost, the rubric line says
// why, the blockquote is the student's own step, and the last line says a
// person decided it. No colour carries meaning here.
export type Deduction = { code: string; points: number | null; rubricLine: string; quote: string | null; quoteLine: number | null; taReason: string | null };

export default function DeductionCard({ label, d }: { label: string; d: Deduction }) {
  const off = Math.abs(Number(d.points) || 0);
  return (
    <li className="rounded-lg border border-line p-4">
      <h3 className="font-semibold">{label}: {d.points == null ? "deduction confirmed by your TA" : `${off} ${off === 1 ? "point" : "points"} deducted`}</h3>
      <p className="mt-1 text-fg-2">{d.rubricLine}</p>
      {d.quote && <>
        {d.quoteLine && <p className="mt-2 text-sm text-fg-3">Your line {d.quoteLine}:</p>}
        <blockquote className="mt-1 border-l-2 border-line pl-3 font-mono text-sm text-fg-2">{d.quote}</blockquote>
      </>}
      {d.taReason && <p className="mt-2 text-fg-2">Your TA wrote: “{d.taReason}”</p>}
      <p className="mt-2 text-sm text-fg-3">Decided by your TA</p>
    </li>
  );
}
