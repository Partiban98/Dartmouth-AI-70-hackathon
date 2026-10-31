"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalize } from "@/lib/text.js";
import { feedbackLine } from "@/lib/feedback.js";
import { COPY } from "./copy";
import { buildReview, addableCodes } from "./review.js";
import type { Stage } from "./useGrading";
import MakeTestCase from "./MakeTestCase";
import RegressionBadge from "./RegressionBadge";
import { firstTrueOverride } from "./overrides.js";
import CallItFirst from "./CallItFirst";
import BlindAgreementStat from "./BlindAgreementStat";
import { visibleCard, callChip, markStartValue, lockPrecall } from "./callfirst.js";

const c = COPY.grader;
/** Keys drive the panel. Links and buttons keep their own behaviour; Enter never leaks to a focused link. */
const own = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && /^(A|BUTTON|SELECT|TEXTAREA)$/.test(t.tagName)) return false; if (e.key === "Enter") e.preventDefault(); return true; };
const cls = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export default function Grader({ g, onFinish, onScheme }: { g: any; onFinish: () => void; onScheme: () => void }) {
  const { current, papers, index, stage, table, answer } = g;
  const [lit, setLit] = useState<number[]>([]);
  const [evalBump, setEvalBump] = useState(0);
  // Call it first: opted into on the setup screen, off for everyone else, so
  // the recorded flow is unchanged unless a grader turns it on.
  const [callFirst, setCallFirst] = useState(false);
  const [myCall, setMyCall] = useState<string | null>(null);
  const [agreeBump, setAgreeBump] = useState(0);
  useEffect(() => { try { setCallFirst(localStorage.getItem("remain.callFirst") === "1"); } catch {} }, []);
  const session = useMemo(() => { try { let s = sessionStorage.getItem("remain.session"); if (!s) { s = Math.random().toString(36).slice(2); sessionStorage.setItem("remain.session", s); } return s; } catch { return "nosession"; } }, []);
  // A new paper means a new call: never carry one paper's call to the next.
  useEffect(() => { setMyCall(null); }, [current?.id]);
  const identity = `${g.setId}:${current?.id}`;
  const activePaper = useRef(identity); activePaper.current = identity;
  const [caseOpen, setCaseOpen] = useState(false);
  useEffect(() => { setCaseOpen(false); }, [identity]);
  const total = papers.length;

  // Which paper line a suggestion points at.
  const lineOf = useCallback((quote: string) => {
    if (!current) return -1; const q = normalize(quote ?? ""); if (!q) return -1;
    const hits = current.steps.map((s: string, i: number) => (normalize(s).includes(q) ? i : -1)).filter((i: number) => i >= 0);
    if (!hits.length) return -1;
    // A bare number is the final answer, which sits at the end of the paper.
    return /^-?\d+(?:\.\d+)?$/.test(q) ? hits[hits.length - 1] : hits[0];
  }, [current]);

  // Auto-advance after a save.
  useEffect(() => {
    if (stage.kind !== "saved" || caseOpen) return;
    const next = g.nextPending(index);
    g.advance.current = setTimeout(() => { if (next) g.start(next); else onFinish(); }, 1400);
    return () => { if (g.advance.current) clearTimeout(g.advance.current); };
  }, [stage.kind, caseOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={index <= 0} onClick={() => g.start(papers[index - 1])}>← {c.prev}</button>
        <div className="font-semibold text-lg">{c.paperOf(index + 1, total)} <span className="font-normal text-fg-3">· {({ idle: "Privacy check", privacy: "Privacy check", names: "Privacy check", reading: "Suggestions", suggestions: "Suggestions", mark: "Your mark", saved: "Saved", stopped: "Stopped" } as any)[stage.kind]}</span></div>
        <button className="btn" disabled={index >= total - 1} onClick={() => g.start(papers[index + 1])}>{c.next} →</button>
        <div className="flex-1 min-w-[120px] h-2 rounded bg-line"><div className="h-2 rounded bg-good" style={{ width: `${total ? (100 * g.decided.size) / total : 0}%` }} /></div>
        <span className="text-sm text-fg-3">{g.decided.size} of {total} marked</span>
        <RegressionBadge bump={evalBump} />
        {callFirst && <BlindAgreementStat session={session} bump={agreeBump} />}
        <button className="btn" onClick={onScheme}>{c.scheme}</button>
        <button className="btn" onClick={onFinish}>{c.finish}</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border border-line bg-card p-5 min-w-0" aria-label="Paper">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold">{current ? `Paper ${current.id}` : ""}</h2>{current?.header && <span className="text-xs text-fg-3">Header hidden</span>}</div>
          <ol className="mt-3 space-y-1.5 font-mono text-[15px] leading-relaxed">
            {(current?.steps ?? []).map((s: string, i: number) => <li key={i} className="flex gap-3"><span className="w-6 shrink-0 text-fg-3 select-none">{i + 1}</span><span className={cls("paper-line", lit.includes(i) && "lit")}>{s}</span></li>)}
          </ol>
          {current && <p className="mt-3 text-xs text-fg-3">{current.imported ? c.blind(current.uploader) : c.sample}</p>}
          {g.othersOnCurrent?.map((d: any, i: number) => <p key={i} className="mt-1 text-sm text-wait">{c.alsoMarked(d.decidedBy, d.grade, table.max)}</p>)}
        </section>

        <section className="min-w-0">
          <div key={stage.kind} className="panel-in">
            {stage.kind === "idle" && <Panel title={c.privacyTitle}><p className="text-fg-2">{c.reading}</p></Panel>}
            {stage.kind === "privacy" && <Tip id="privacy" text={c.tips.privacy} />}
            {stage.kind === "privacy" && <Privacy stage={stage} onCheck={() => answer(true, { kind: "reading" })} onSkip={() => answer(false)} />}
            {stage.kind === "names" && <Names stage={stage} onDone={(picks: any) => answer(picks)} onSkip={() => answer(null)} />}
            {stage.kind === "reading" && <Panel title={c.suggestionsTitle}><p className="text-fg-2 animate-pulse">{c.reading}</p><div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="h-20 rounded-lg bg-bg" />)}</div></Panel>}
            {stage.kind === "suggestions" && !visibleCard(stage.card, { enabled: callFirst, locked: !!myCall }) && (
              <CallItFirst key={identity} table={table} onLock={async (code: string) => {
                const mine = identity;
                const storedCode = await lockPrecall({ call: { idea: g.setId, itemId: current?.id, code, by: g.name, session } });
                if (activePaper.current !== mine) return;
                setMyCall(storedCode); setAgreeBump((b) => b + 1);
              }} />
            )}
            {stage.kind === "suggestions" && visibleCard(stage.card, { enabled: callFirst, locked: !!myCall }) && <Tip id="suggestions" text={c.tips.suggestions} />}
            {stage.kind === "suggestions" && visibleCard(stage.card, { enabled: callFirst, locked: !!myCall }) && (
              <>
                {callFirst && myCall && <p className="mb-2 rounded-full bg-bg px-3 py-1 text-sm inline-block">{callChip(myCall, stage.card.items?.[0]?.code ?? "OK")}</p>}
                <Suggestions card={stage.card} table={table} lineOf={lineOf} onLight={setLit} onDone={(r: any) => { setLit([]); answer(r); }} />
              </>
            )}
            {stage.kind === "mark" && <Tip id="mark" text={c.tips.mark} />}
            {stage.kind === "mark" && <Mark bar={stage.bar} table={table} name={g.name} callFirst={callFirst} onDone={(d: any) => answer(d)} />}
            {stage.kind === "saved" && <Saved result={stage.result} table={table} idea={g.setId} onOpen={() => setCaseOpen(true)} onAdded={() => setEvalBump((b) => b + 1)} />}
            {stage.kind === "stopped" && <Panel title={stage.text.startsWith("notSaved") ? c.notSavedTitle : c.privacyTitle} tone="bad"><p>{stage.text === "blocked" ? c.blocked : stage.text === "noAnswer" ? c.noAnswer : stage.text === "notSaved" ? c.notSaved : stage.text === "notSavedName" ? `${c.notSaved} ${c.notSavedName}` : c.stopped}</p>{stage.text.startsWith("notSaved") ? stage.detail && <p className="mt-2 text-sm">{c.notSavedTyped(stage.detail[0], stage.detail[1])}</p> : stage.detail && <ul className="mt-2 text-xs text-fg-3 list-disc pl-4">{stage.detail.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>}<div className="mt-3 flex gap-2"><button className="btn" onClick={() => g.start(current)}>Try again</button>{index < total - 1 && <button className="btn" onClick={() => g.start(papers[index + 1])}>{c.next} →</button>}</div></Panel>}
          </div>
        </section>
      </div>
      <p className="text-xs text-fg-3">{g.modelLabel ? c.footer(g.modelLabel) : c.footerNoCall}</p>
    </main>
  );
}

/** Shown once per step, remembered on this browser. A newcomer reads it; a regular never sees it again. */
function Tip({ id, text }: { id: string; text: string }) {
  const [seen, setSeen] = useState(true);
  useEffect(() => { try { setSeen(localStorage.getItem(`remain.tip.${id}`) === "1"); } catch { setSeen(false); } }, [id]);
  if (seen) return null;
  return <div className="mb-3 rounded-lg border border-wait bg-wait-bg p-3 text-sm"><p>{text}</p><button className="btn text-xs mt-2" onClick={() => { try { localStorage.setItem(`remain.tip.${id}`, "1"); } catch {} setSeen(true); }}>{c.gotIt}</button></div>;
}

function Panel({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "good" | "wait" | "bad" }) {
  return <section className={cls("rounded-xl border p-5 bg-card", tone === "good" && "border-good bg-good-bg", tone === "wait" && "border-wait bg-wait-bg", tone === "bad" && "border-bad bg-bad-bg")}><h2 className="font-semibold text-lg">{title}</h2><div className="mt-3">{children}</div></section>;
}

function Privacy({ stage, onCheck, onSkip }: any) {
  const names = stage.report.counts.NAME ?? 0;
  const removed = Object.entries(stage.report.counts).filter(([t, n]: any) => n > 0 && t !== "NAME");
  useEffect(() => { const h = (e: KeyboardEvent) => { if (!own(e)) return; if (e.key === "Enter" && !stage.blocked) onCheck(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [stage.blocked, onCheck]);
  return (
    <Panel title={c.privacyTitle} tone={stage.blocked ? "bad" : undefined}>
      <p className="text-fg-2">{c.privacyBody(names, stage.report.droppedFields)}</p>
      {removed.length > 0 && <p className="mt-2 text-sm text-fg-3">{c.removed}: {removed.map(([t, n]: any) => `${plain(t)} ×${n}`).join(", ")}</p>}
      {stage.blocked && <p className="mt-2 text-sm">{c.blocked}</p>}
      <div className="mt-4 flex gap-2"><button className="btn btn-primary" disabled={stage.blocked} onClick={onCheck}>{c.checkButton} <span className="kbd">⏎</span></button><button className="btn" onClick={onSkip}>{c.stopButton}</button></div>
    </Panel>
  );
}
const plain = (t: string) => ({ EMAIL: "email", PHONE: "phone number", STUDENT_ID: "student ID", NETID: "NetID", EMPLOYEE_ID: "employee ID", INTERNAL_ID: "ticket number", ADDRESS: "address", URL: "web link", HEADER_LINE: "header line", DOB: "date of birth" } as any)[t] ?? t.toLowerCase();

function Names({ stage, onDone, onSkip }: any) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const left = stage.flags.filter((f: any) => !picks[f.token]).length;
  return (
    <Panel title={c.privacyTitle} tone="wait">
      {stage.flags.map((f: any) => (
        <div key={f.token} className="mb-3">
          <p className="font-semibold">{c.nameQuestion(f.token)}</p>
          <div className="mt-2 flex gap-2">{[["name", c.nameYes], ["not-name", c.nameNo]].map(([v, l]) => <button key={v} className={cls("btn", picks[f.token] === v && "btn-primary")} onClick={() => setPicks((p) => ({ ...p, [f.token]: v }))}>{l}</button>)}</div>
        </div>
      ))}
      <p className="text-sm text-fg-3">{c.nameHelp}</p>
      <div className="mt-4 flex gap-2"><button className="btn btn-primary" disabled={left > 0} onClick={() => onDone(picks)}>{c.checkButton}</button><button className="btn" onClick={onSkip}>{c.stopButton}</button></div>
    </Panel>
  );
}

function Suggestions({ card: raw, table, lineOf, onLight, onDone }: any) {
  // One card per mistake. When AI and the marking scheme agree, the grader answers once.
  const card = useMemo(() => {
    const groups: any[] = [];
    for (const [idx, it] of raw.items.entries()) {
      const g = groups.find((x) => x.code === it.code);
      if (g) { g.members.push(idx); g.sources.add(it.source); if (!g.verified && it.verified) { g.verified = true; g.quote = it.quote; } g.confidence = Math.max(g.confidence ?? 0, it.source === "Rule" ? 0 : it.confidence ?? 0); }
      else groups.push({ ...it, members: [idx], sources: new Set([it.source]), confidence: it.source === "Rule" ? undefined : it.confidence });
    }
    return { ...raw, items: groups };
  }, [raw]);
  const [state, setState] = useState<any[]>(() => card.items.map((it: any) => ({ action: "", to: it.code, reason: "", precedent: false })));
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const labels = Object.fromEntries(table.codes.map((x: any) => [x.code, x]));
  const setRow = (i: number, patch: any) => setState((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const complete = state.every((s) => s.action);
  const submit = useCallback(() => {
    const r: any = buildReview(card.items, state, added);
    if (r.error) { setError(r.error === "choose" ? `Suggestion ${r.n}: choose an answer.` : c.needWhy(r.n)); return; }
    onDone(r);
  }, [state, card, added, onDone]);
  // A mistake no suggestion raised: the grader adds it from the marking scheme, and it counts like a yes.
  const missed = (
    <div className="mt-4 rounded-lg border border-line p-3">
      <p className="font-semibold">{c.missedTitle}</p>
      <p className="text-sm text-fg-3">{c.missedHelp}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={c.missedTitle} className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm">
          <option value="">{c.missedPick}</option>
          {addableCodes(table).filter((x: any) => !added.includes(x.code)).map((x: any) => <option key={x.code} value={x.code}>{x.label} ({c.pointsOff(x.deduction)})</option>)}
        </select>
        <button className="btn text-sm" disabled={!pick} onClick={() => { setAdded((a) => [...a, pick]); setPick(""); }}>{c.missedAdd}</button>
      </div>
      {added.length > 0 && <ul className="mt-2 space-y-1">{added.map((code) => (
        <li key={code} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-bg px-2 py-0.5 text-fg-2">{c.addedByYou}</span>
          <span>{labels[code]?.label ?? code} · {c.pointsOff(labels[code]?.deduction ?? 0)}</span>
          <button className="btn text-xs" onClick={() => setAdded((a) => a.filter((x) => x !== code))}>{c.missedRemove}</button>
        </li>))}</ul>}
    </div>
  );
  useEffect(() => { onLight(card.items.map((it: any) => lineOf(it.quote)).filter((n: number) => n >= 0)); }, [card, lineOf, onLight]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!own(e)) return;
      const t = e.target as HTMLElement;
      if (t?.tagName === "INPUT" && (t as HTMLInputElement).type === "text") { if (e.key === "Enter") submit(); return; }
      if (!card.items.length) { if (e.key === "Enter") submit(); return; }
      if (e.key === "1") setRow(focus, { action: "confirm", to: card.items[focus].code });
      else if (e.key === "2") setRow(focus, { action: "change", to: state[focus].to === card.items[focus].code ? table.codes[0].code : state[focus].to });
      else if (e.key === "3") setRow(focus, { action: "override", to: "OK" });
      else if (e.key === "Enter") submit();
      else if (e.key === "ArrowDown") setFocus((f) => Math.min(f + 1, card.items.length - 1));
      else if (e.key === "ArrowUp") setFocus((f) => Math.max(f - 1, 0));
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [focus, submit, card, state, table]);
  if (!card.items.length) return <Panel title={c.suggestionsTitle} tone="good"><p className="text-fg-2">{c.noSuggestions}</p>{missed}<button className="btn btn-primary mt-4" onClick={submit}>{c.continueButton} <span className="kbd">⏎</span></button></Panel>;
  return (
    <Panel title={c.suggestionsTitle}>
      <p className="text-sm text-fg-3">{c.suggestionsHelp}</p>
      <ol className="mt-3 space-y-3">
        {card.items.map((it: any, i: number) => {
          const s = state[i]; const ln = lineOf(it.quote); const lab = labels[it.code];
          return (
            <li key={i} onMouseEnter={() => onLight(ln >= 0 ? [ln] : [])} onMouseLeave={() => onLight(card.items.map((x: any) => lineOf(x.quote)).filter((n: number) => n >= 0))} onClick={() => setFocus(i)} className={cls("rounded-lg border p-3", focus === i ? "border-accent" : "border-line")}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold">{lab?.label ?? it.code}</span>
                <span className="font-mono text-xs text-fg-3">{it.code}</span>
                <span className="text-sm text-fg-3">· {c.pointsOff(lab?.deduction ?? 0)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                {it.sources.has("AI") && <span className="rounded-full bg-bg px-2 py-0.5 text-fg-2">{c.byAI}</span>}
                {it.sources.has("Rule") && <span className="rounded-full bg-bg px-2 py-0.5 text-fg-2">{c.byScheme}</span>}
                {it.verified && ln >= 0 ? <span className="rounded-full bg-good-bg text-good px-2 py-0.5">{c.lineOf(ln + 1)}</span> : <span className="rounded-full bg-bad-bg text-bad px-2 py-0.5">{c.notInPaper}</span>}
                {typeof it.confidence === "number" && <span className="text-fg-3" title={it.confidence.toFixed(2)}>{c.sure(it.confidence)}</span>}
              </div>
              <blockquote className="mt-2 border-l-2 border-line pl-3 font-mono text-sm text-fg-2">{it.quote}</blockquote>
              <div className="mt-3 flex flex-wrap gap-2">
                {[["confirm", c.yes, "1"], ["change", c.different, "2"], ["override", c.no, "3"]].map(([k, l, key]) => (
                  <button key={k} onClick={() => setRow(i, { action: k, to: k === "override" ? "OK" : k === "confirm" ? it.code : s.to === it.code ? table.codes[0].code : s.to })} aria-pressed={s.action === k} className={cls("btn text-sm", s.action === k && "btn-primary")}>{l} <span className="kbd">{key}</span></button>
                ))}
              </div>
              {s.action === "change" && <select value={s.to} onChange={(e) => setRow(i, { to: e.target.value })} className="mt-2 w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm">{table.codes.filter((x: any) => x.code !== "OK").map((x: any) => <option key={x.code} value={x.code}>{x.label} ({c.pointsOff(x.deduction)})</option>)}</select>}
              {(s.action === "change" || s.action === "override") && (
                <div className="mt-2 space-y-1">
                  <input type="text" value={s.reason} onChange={(e) => setRow(i, { reason: e.target.value })} placeholder={c.why} aria-label={c.why} className="w-full rounded-lg border border-line bg-card px-3 py-1.5 text-sm" />
                  <label className="flex items-center gap-2 text-sm text-fg-2"><input type="checkbox" checked={s.precedent} onChange={(e) => setRow(i, { precedent: e.target.checked })} /> {c.remember}</label>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {missed}
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
      <button className="btn btn-primary mt-4" disabled={!complete} onClick={submit}>{c.continueButton} <span className="kbd">⏎</span></button>
    </Panel>
  );
}

function Mark({ bar, table, name, callFirst, onDone }: any) {
  const [grade, setGrade] = useState(() => markStartValue(bar.computedScore, { enabled: callFirst }));
  const [note, setNote] = useState(() => feedbackLine(bar.confirmed ?? [], table));
  const go = () => { if (grade === "" || !name.trim()) return; onDone({ decidedBy: name.trim(), grade: Number(grade), feedback: note }); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (!own(e)) return; if (e.key === "Enter") go(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  return (
    <Panel title={c.markTitle} tone="good">
      <p className="text-fg-2">{c.markFromChoices}</p>
      <p className="text-4xl font-bold">{bar.computedScore} <span className="text-xl font-normal text-fg-3">/ {table.max}</span></p>
      <label className="mt-4 block text-sm font-semibold">{c.finalMark}<input autoFocus type="number" step="0.25" min={0} max={table.max} value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 block w-32 rounded-lg border border-line bg-card px-3 py-2 text-2xl font-bold" /></label>
      <label className="mt-3 block text-sm font-semibold">{c.note}<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal" /></label>
      <button className="btn btn-primary mt-4" disabled={grade === "" || !name.trim()} onClick={go}>{c.saveButton} <span className="kbd">⏎</span></button>
    </Panel>
  );
}

function Saved({ result, table, idea, onAdded, onOpen }: any) {
  // An override is a suggestion the TA ruled out: to === "OK". A confirm never
  // reaches overrides, and a change carries the code it was changed to.
  const override = firstTrueOverride(result.overrides);
  return (
    <Panel title={c.savedTitle} tone="good">
      <p className="text-2xl font-bold">{c.savedBy(result.decidedBy, result.grade, table.max)}</p>
      <p className="text-sm text-fg-3">{c.receiptSub}{result.overrides?.length ? ` · ${result.overrides.length} suggestion${result.overrides.length === 1 ? "" : "s"} changed by you` : ""}</p>
      {result.feedback && <p className="mt-2 text-fg-2">“{result.feedback}”</p>}
      {override && <MakeTestCase idea={idea} itemId={result.itemId} aiCode={override.from} taRuling="OK" onOpen={onOpen} onAdded={onAdded} />}
    </Panel>
  );
}
