// Teacher and TA journey, GR-01 to GR-04, built on the shared core. One paper at a time, no bulk approval.
import { runPipeline } from "/lib/pipeline.js";
import { strictLogFetch } from "/lib/saveguard.js";
import { GatePanel, ReviewCard, QueueList, DecisionBar, ReceiptPanel, DecisionLog, RubricPanel, ClassInsights } from "/components.js";

export function mountGrade({ ideas, course, submissions, mounts, modelLabel }) {
  const { rubric, queue, flow, insights } = mounts;
  const decided = new Set();
  let current = null;
  const get = (path) => fetch(path).then((r) => r.json());

  rubric.replaceChildren(RubricPanel(ideas.grade.standards));
  const show = (...nodes) => { flow.replaceChildren(...nodes.filter(Boolean)); nodes[0]?.querySelector?.("button, input, select")?.focus(); };
  const renderQueue = () => queue.replaceChildren(QueueList(submissions, { onSelect: start, decided, current }));
  const refresh = async () => {
    let counts = null;
    try { counts = await get("/counts"); } catch {}
    for (const d of counts?.decisions ?? []) if (d.idea === "grade") decided.add(d.itemId);
    renderQueue();
    insights.replaceChildren(ClassInsights(counts, ideas.grade.standards, submissions.length));
    return DecisionLog(counts);
  };
  const msg = (text) => { const p = document.createElement("p"); p.className = "panel status"; p.setAttribute("role", "alert"); p.textContent = text; return p; };

  async function start(item) {
    current = item.id; renderQueue();
    const ui = {
      resolveFlags: (flags, report) => new Promise((resolve) => {
        const picks = {}; let left = flags.length;
        show(GatePanel(report, flags, { blocked: true, onPick: (tok, v) => { picks[tok] = v; if (--left <= 0) resolve(picks); }, onApprove: () => {}, onCancel: () => resolve(null) }));
      }),
      approveGate: (report, flags, { blocked }) => new Promise((resolve) => show(GatePanel(report, flags, { blocked, onApprove: () => { show(msg("Alias-only payload sent. Waiting for the model, up to two attempts per rung, 60 seconds each.")); resolve(true); }, onCancel: () => resolve(false) }))),
      review: (card) => new Promise((resolve) => { modelLabel.textContent = `Model: ${card.label}`; show(ReviewCard(card, { onSubmit: resolve })); }),
      decide: (bar) => new Promise((resolve) => show(DecisionBar(bar, { onDecide: resolve }))),
    };
    let r;
    try { r = await runPipeline(ideas.grade, item, ui, { course, fetchImpl: strictLogFetch(fetch) }); }
    catch (e) { if (!e?.notSaved) throw e; show(msg(`Not saved: ${e.message}. Nothing was recorded for this paper.`), await refresh().catch(() => null)); return; }
    if (r.receipt) { decided.add(item.id); show(ReceiptPanel(r), await refresh()); }
    else if (r.stopped === "blocked") show(msg(`BLOCKED by the server's assertClean (${r.detail?.rule}). Nothing was sent. Logged as a blocked event.`), await refresh());
    else if (r.stopped === "provider") show(msg(`No model answer: ${r.detail?.error}. Ladder attempts: ${(r.detail?.attempts ?? []).join(" | ")}`), await refresh());
    else if (r.stopped === "standards") show(msg(`Rubric failed validation, nothing runs: ${r.errors.join("; ")}`));
    else show(msg(`Stopped at ${r.stopped}${r.error ? `: ${r.error}` : ""}. Nothing was decided.`), await refresh());
  }

  refresh().then((log) => show(msg("Pick a paper from the queue. Each paper: gate, propose, verify, your decision."), log));
}
