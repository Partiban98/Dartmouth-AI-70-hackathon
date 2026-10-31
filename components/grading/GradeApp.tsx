"use client";
import { useEffect, useState } from "react";
import { useGrading } from "./useGrading";
import Start from "./Start";
import Grader from "./Grader";
import Finish from "./Finish";
import SchemeDrawer from "./SchemeDrawer";

export default function GradeApp() {
  const g = useGrading();
  const [view, setView] = useState<"start" | "grade" | "finish">("start");
  const [schemeOpen, setSchemeOpen] = useState(false);

  // Finished when every paper in the set has a mark.
  useEffect(() => { if (view === "grade" && g.papers.length && g.decided.size >= g.papers.length && g.stage.kind !== "saved") setView("finish"); }, [g.decided, g.papers, view, g.stage]);

  if (!g.data || !g.table) return <main className="mx-auto max-w-3xl px-5 py-16 text-fg-3">Loading…</main>;
  return (
    <>
      {view === "start" && <Start g={g} onStart={() => { setView("grade"); const first = g.papers.find((p) => !g.decided.has(p.id)) ?? g.papers[0]; if (first) g.start(first); }} />}
      {/* While the marking scheme is open, the paper behind it takes no focus, clicks or keys: Tab and Enter cannot reach its Save. */}
      {view === "grade" && <div inert={schemeOpen}><Grader g={g} onFinish={() => setView("finish")} onScheme={() => setSchemeOpen(true)} /></div>}
      {view === "finish" && <Finish g={g} onStartOver={() => setView("start")} onMore={() => { setView("grade"); const p = g.papers.find((x) => !g.decided.has(x.id)) ?? g.papers[0]; if (p) g.start(p); }} />}
      {schemeOpen && <SchemeDrawer table={g.table} onClose={() => setSchemeOpen(false)} onSave={g.saveRubric} readOnlyBy={g.assignment?.joined ? g.assignment.createdBy : undefined} />}
    </>
  );
}
