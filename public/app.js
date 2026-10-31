// Mounts the core loop on the Teacher and TA tab as the G1 proof. Journeys are built by their owners on the same pieces.
import { runPipeline } from "/lib/pipeline.js";
import { makeIdeas } from "/lib/ideas.js";
import { HONEST_LIMIT } from "/lib/gate.js";
import { GatePanel, ReviewCard, QueueList, DecisionBar, ReceiptPanel, DecisionLog } from "/components.js";

const get = (path) => fetch(path).then((r) => r.json());
const [course, gradeStandards, companion, upskillStandards, submissions] = await Promise.all([
  get("/data/course.json"), get("/data/grade-q5.v1.0.json"), get("/data/companion-ch3.json"), get("/data/upskill-email.v1.0.json"), get("/data/grade-q5.submissions.json")]);
const ideas = makeIdeas({ gradeStandards, companion, upskillStandards });
document.getElementById("honest-limit").textContent = HONEST_LIMIT;

// Tabs
const tabs = [...document.querySelectorAll('[role="tab"]')];
for (const t of tabs) t.addEventListener("click", () => {
  for (const x of tabs) { x.setAttribute("aria-selected", String(x === t)); document.getElementById(x.getAttribute("aria-controls")).hidden = x !== t; }
});

const queueMount = document.getElementById("mount-queue"), flow = document.getElementById("mount-flow"), modelLabel = document.getElementById("model-label");
const decided = new Set();
let current = null;

const show = (...nodes) => { flow.replaceChildren(...nodes.filter(Boolean)); nodes[0]?.querySelector?.("button, input, select")?.focus(); };
const renderQueue = () => queueMount.replaceChildren(QueueList(submissions, { onSelect: start, decided, current }));
const refreshLog = async () => { try { return DecisionLog(await get("/counts")); } catch { return DecisionLog(null); } };

async function start(item) {
  current = item.id; renderQueue();
  const ui = {
    resolveFlags: (flags, report) => new Promise((resolve) => {
      const picks = {}; let left = flags.length;
      show(GatePanel(report, flags, { blocked: true, onPick: (tok, v) => { picks[tok] = v; if (--left <= 0) resolve(picks); }, onApprove: () => {}, onCancel: () => resolve(null) }));
    }),
    approveGate: (report, flags, { blocked }) => new Promise((resolve) => show(GatePanel(report, flags, { blocked, onApprove: () => resolve(true), onCancel: () => resolve(false) }))),
    review: (card) => new Promise((resolve) => { modelLabel.textContent = `Model: ${card.label}`; show(ReviewCard(card, { onSubmit: resolve })); }),
    decide: (bar) => new Promise((resolve) => show(DecisionBar(bar, { onDecide: resolve }))),
  };
  const r = await runPipeline(ideas.grade, item, ui, { course });
  if (r.receipt) { decided.add(item.id); renderQueue(); show(ReceiptPanel({ ...r }), await refreshLog()); }
  else if (r.stopped === "blocked") show(msg(`BLOCKED by the server's assertClean (${r.detail?.rule}). Nothing was sent. Logged as a blocked event.`), await refreshLog());
  else if (r.stopped === "provider") show(msg(`No model answer: ${r.detail?.error}. Ladder attempts: ${(r.detail?.attempts ?? []).join(" | ")}`), await refreshLog());
  else show(msg(`Stopped at ${r.stopped}${r.error ? `: ${r.error}` : ""}. Nothing was decided.`), await refreshLog());
}
function msg(text) { const p = document.createElement("p"); p.className = "panel status"; p.setAttribute("role", "alert"); p.textContent = text; return p; }

renderQueue();
show(msg("Pick a paper from the queue to run the loop: gate, propose, verify, decide."), await refreshLog());
