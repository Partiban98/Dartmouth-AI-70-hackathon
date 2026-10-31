"use client";
// What left this computer for one paper, and what came back. Every field is
// read from the gate and proposal logs: counts, a hash, two timestamps and the
// model id the API returned. The removed values themselves are not in the logs
// and so cannot be shown here.
import { useEffect, useState } from "react";
import { COPY } from "./copy";

const c = COPY.receipt;
const PLAIN: Record<string, string> = { EMAIL: "email", PHONE: "phone number", STUDENT_ID: "student ID", NETID: "NetID", EMPLOYEE_ID: "employee ID", INTERNAL_ID: "ticket number", ADDRESS: "address", URL: "web link", HEADER_LINE: "header line", DOB: "date of birth", NAME: "name" };
const clock = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString() : null);

type Receipt = { removed: { type: string; n: number }[]; droppedFields: number; checkedAt: string | null; sentAt: string | null; modelId: string | null; cacheHit: boolean | null; payloadHash: string | null };

export default function GateReceipt({ idea, itemId }: { idea: string; itemId: string }) {
  const [r, setR] = useState<Receipt | null>(null);
  useEffect(() => { if (!itemId) return; const path = `/api/receipt?idea=${encodeURIComponent(idea)}&itemId=${encodeURIComponent(itemId)}`;
    fetch(path, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).then(setR).catch(() => {}); }, [idea, itemId]);
  if (!r) return null;

  return (
    <section className="mt-3 rounded-lg border border-line p-3 text-sm">
      <h3 className="font-semibold">{c.title}</h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-fg-3">{c.removedLabel}</dt>
        <dd>{r.removed.length ? r.removed.map((x) => `${PLAIN[x.type] ?? x.type.toLowerCase()} ×${x.n}`).join(", ") : c.nothingRemoved}{r.droppedFields > 0 ? `, ${c.droppedFields(r.droppedFields)}` : ""}</dd>
        {r.checkedAt && <><dt className="text-fg-3">{c.checkedAt}</dt><dd>{clock(r.checkedAt)}</dd></>}
        {r.sentAt && <><dt className="text-fg-3">{c.sentAt}</dt><dd>{clock(r.sentAt)}{r.cacheHit ? ` · ${c.fromCache}` : ""}</dd></>}
        <dt className="text-fg-3">{c.model}</dt>
        <dd>{r.modelId ?? c.noModel}</dd>
        <dt className="text-fg-3">{c.hash}</dt>
        <dd className="font-mono break-all text-xs">{r.payloadHash ?? c.noHash}</dd>
      </dl>
      <p className="mt-2 text-xs text-fg-3">{c.note}</p>
    </section>
  );
}
