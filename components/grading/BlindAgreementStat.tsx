"use client";
// Read from the logged precalls and proposals, never from screen state.
import { useEffect, useState } from "react";
import { COPY } from "./copy";

export default function BlindAgreementStat({ session, bump }: { session: string; bump: number }) {
  const [text, setText] = useState("0 of 0");
  useEffect(() => { const path = `/api/precall?session=${encodeURIComponent(session)}`;
    fetch(path, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setText(j.text)).catch(() => {}); }, [session, bump]);
  return <span className="text-sm text-fg-3">{COPY.callFirst.stat(text)}</span>;
}
