"use client";
// How often TAs kept, changed or ruled out each suggestion, from the decisions
// log. A real table with column and row headers, so a screen reader reads
// "E-VAR-SD, kept 7" rather than a grid of loose numbers. Status is carried by
// the words and the counts; nothing here depends on colour.
import { useEffect, useState } from "react";
import { COPY } from "./copy";

const c = COPY.agreement;
type Row = { code: string; confirmed: number; changed: number; overridden: number; total: number };

export default function AgreementPanel({ idea, table }: { idea: string; table: any }) {
  const [data, setData] = useState<{ rows: Row[]; totals: Row } | null>(null);
  useEffect(() => { const path = `/api/agreement?idea=${encodeURIComponent(idea)}`;
    fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}); }, [idea]);

  const labels: Record<string, string> = Object.fromEntries((table?.codes ?? []).map((x: any) => [x.code, x.label]));
  const rows = data?.rows ?? [];

  return (
    <section className="rounded-xl border border-line bg-card p-5 overflow-x-auto">
      <h2 className="text-xl font-semibold">{c.title}</h2>
      <p className="text-sm text-fg-3">{c.help}</p>
      {!rows.length ? <p className="mt-3 text-fg-3">{c.none}</p> : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">{c.caption}</caption>
          <thead>
            <tr className="text-left text-fg-3">
              <th scope="col" className="py-1">{c.cols.mistake}</th>
              <th scope="col" className="py-1 text-right">{c.cols.kept}</th>
              <th scope="col" className="py-1 text-right">{c.cols.changed}</th>
              <th scope="col" className="py-1 text-right">{c.cols.ruledOut}</th>
              <th scope="col" className="py-1 text-right">{c.cols.total}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-t border-line">
                <th scope="row" className="py-1 text-left font-normal">{labels[r.code] ?? r.code} <span className="font-mono text-xs text-fg-3">{r.code}</span></th>
                <td className="py-1 text-right tabular-nums">{r.confirmed}</td>
                <td className="py-1 text-right tabular-nums">{r.changed}</td>
                <td className="py-1 text-right tabular-nums">{r.overridden}</td>
                <td className="py-1 text-right tabular-nums font-semibold">{r.total}</td>
              </tr>
            ))}
          </tbody>
          {data?.totals && (
            <tfoot>
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="py-1 text-left">{c.cols.allCodes}</th>
                <td className="py-1 text-right tabular-nums">{data.totals.confirmed}</td>
                <td className="py-1 text-right tabular-nums">{data.totals.changed}</td>
                <td className="py-1 text-right tabular-nums">{data.totals.overridden}</td>
                <td className="py-1 text-right tabular-nums">{data.totals.total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
      <p className="mt-3 text-sm text-fg-3">{c.sourceNote}</p>
    </section>
  );
}
