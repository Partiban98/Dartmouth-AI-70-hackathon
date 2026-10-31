// Shared components, frozen first: GatePanel, ReviewCard, QueueList, DecisionBar, ReceiptPanel, DecisionLog. Plain DOM, status by text, never colour alone.
import { HONEST_LIMIT } from "/lib/gate.js";

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v); }
  for (const c of children.flat()) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
};

/** PG-01. Before and after view: types and counts only. R-11 flags shown locally with a human pick. */
export function GatePanel(report, flags, { blocked, onPick, onApprove, onCancel }) {
  const rows = Object.entries(report.counts).filter(([, n]) => n > 0).map(([t, n]) => el("tr", {}, el("td", {}, t), el("td", {}, String(n))));
  const flagRows = (flags ?? []).map((f) => el("div", { class: "row" },
    el("span", {}, `${f.rule} possible name: `), el("strong", {}, f.token),
    el("button", { type: "button", onclick: () => onPick(f.token, "name") }, "Mark as name"),
    el("button", { type: "button", onclick: () => onPick(f.token, "not-name") }, "Not a name")));
  const approve = el("button", { type: "button", disabled: blocked, onclick: onApprove }, "Approve and send alias-only payload");
  return el("section", { class: "panel", "aria-labelledby": "gate-h" },
    el("h3", { id: "gate-h" }, "1. Privacy Gate, on this machine"),
    el("p", {}, `Fields dropped by allowlist: ${report.droppedFields}. Identifiers replaced, by type:`),
    rows.length ? el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Type"), el("th", {}, "Count"))), el("tbody", {}, rows)) : el("p", {}, "No identifiers found in allowlisted fields."),
    flagRows.length ? el("div", {}, el("p", { class: "status" }, "BLOCKED until you decide (shown here only, never sent, never logged):"), flagRows) : null,
    blocked && !flagRows.length ? el("p", { class: "status" }, `BLOCKED by ${report.blockedRules.join(", ")}. Nothing will be sent.`) : null,
    el("p", { class: "limit" }, HONEST_LIMIT),
    el("div", { class: "row" }, approve, el("button", { type: "button", onclick: onCancel }, "Stop, send nothing")));
}

/** C-01. One row per proposal: code, quote, confidence, AI or Rule, verified or not found. Controls per row. */
export function ReviewCard(card, { onSubmit }) {
  const state = card.items.map((it) => ({ action: "confirm", to: it.code, reason: "" }));
  const codeOptions = (sel) => card.codes.map((c) => el("option", { value: c.code, selected: c.code === sel }, `${c.code}: ${c.label}`));
  const rows = card.items.map((it, i) => {
    const reason = el("input", { type: "text", placeholder: "Reason (required when you change or override)", "aria-label": `Reason for item ${i + 1}`, oninput: (e) => { state[i].reason = e.target.value; } });
    const select = el("select", { "aria-label": `Change type for item ${i + 1}`, onchange: (e) => { state[i] = { ...state[i], action: "change", to: e.target.value }; } }, codeOptions(it.code));
    const pick = (action) => () => { state[i] = { ...state[i], action, to: action === "override" ? "OK" : action === "confirm" ? it.code : select.value }; };
    return el("tr", {},
      el("td", {}, el("strong", {}, it.code), el("br"), el("span", { class: "muted" }, it.source === "Rule" ? "Rule" : "AI")),
      el("td", {}, el("blockquote", {}, it.sourceLine ?? it.quote ?? ""), el("span", { class: "status" }, it.verified ? "verified in source" : "not found in source"), it.message ? el("div", {}, it.message) : null),
      el("td", {}, typeof it.confidence === "number" ? it.confidence.toFixed(2) : ""),
      el("td", {},
        el("label", {}, el("input", { type: "radio", name: `act-${i}`, checked: true, onchange: pick("confirm") }), " Confirm"), el("br"),
        el("label", {}, el("input", { type: "radio", name: `act-${i}`, onchange: pick("change") }), " Change type to "), select, el("br"),
        el("label", {}, el("input", { type: "radio", name: `act-${i}`, onchange: pick("override") }), " Override to no error"), el("br"),
        reason));
  });
  const factRows = (card.facts ?? []).map((f) => el("li", {}, `${f.detail}: ${f.message}`));
  const submit = el("button", { type: "button", onclick: () => {
    const confirmed = [], overrides = [];
    for (const [i, s] of state.entries()) {
      const from = card.items[i].code;
      if (s.action === "confirm") confirmed.push(from);
      else { if (!s.reason.trim()) { alertBox.textContent = `Item ${i + 1}: a reason is required.`; return; } overrides.push({ from, to: s.to, reason: s.reason }); if (s.action === "change") confirmed.push(s.to); }
    }
    onSubmit({ confirmed, overrides });
  } }, "Done reviewing every item");
  const alertBox = el("p", { class: "status", role: "alert" });
  return el("section", { class: "panel", "aria-labelledby": "review-h" },
    el("h3", { id: "review-h" }, `3. Review ${card.itemId}: proposals with evidence`),
    el("p", { class: "label" }, card.label),
    card.items.length ? el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, "Code"), el("th", {}, "Quoted evidence"), el("th", {}, "Confidence"), el("th", {}, "Your call"))), el("tbody", {}, rows)) : el("p", {}, "No proposals. Nothing to confirm; you still decide."),
    factRows.length ? el("div", {}, el("h4", {}, "Facts check"), el("ul", {}, factRows)) : null,
    alertBox, submit);
}

/** C-03. One item at a time. No select-all, no bulk action. */
export function QueueList(items, { onSelect, decided = new Set(), current }) {
  return el("nav", { class: "queue panel", "aria-label": "Review queue" },
    el("h3", {}, "2. Queue, one by one"),
    items.map((it) => el("button", { type: "button", "aria-current": it.id === current ? "true" : null, onclick: () => onSelect(it) }, `${it.id} ${decided.has(it.id) ? "(decided)" : "(pending)"}`)));
}

export function DecisionBar({ computedScore, requiresGradeInput, requiresReviewedAllCheckbox, receipt }, { onDecide }) {
  const name = el("input", { type: "text", placeholder: "Your name", "aria-label": "Decided by", required: true });
  const grade = requiresGradeInput ? el("input", { type: "number", min: 0, step: 0.5, value: String(computedScore), "aria-label": "Grade you assign" }) : null;
  const reviewed = requiresReviewedAllCheckbox ? el("input", { type: "checkbox", "aria-label": "I reviewed every change" }) : null;
  const btn = el("button", { type: "button", disabled: true, onclick: () => onDecide({ decidedBy: name.value.trim(), grade: grade ? Number(grade.value) : undefined, reviewedAll: reviewed ? reviewed.checked : undefined }) }, "Confirm my decision");
  const refresh = () => { btn.disabled = !name.value.trim() || (reviewed && !reviewed.checked) || (grade && grade.value === ""); };
  for (const x of [name, grade, reviewed]) x?.addEventListener("input", refresh);
  return el("section", { class: "panel", "aria-labelledby": "decide-h" },
    el("h3", { id: "decide-h" }, "4. Your decision"),
    el("p", {}, `Score from the codes you confirmed, computed by code: ${computedScore}. ${requiresGradeInput ? "You enter the grade." : ""}`),
    el("div", { class: "row" }, el("label", {}, "Decided by ", name), grade ? el("label", {}, "Grade ", grade) : null, reviewed ? el("label", {}, reviewed, " I reviewed every change") : null, btn),
    el("p", { class: "muted" }, `Receipt will read: ${receipt}`));
}

export function ReceiptPanel({ receipt, decidedBy, label, computedScore }) {
  return el("section", { class: "panel", "aria-labelledby": "receipt-h", role: "status" },
    el("h3", { id: "receipt-h" }, "Receipt"),
    el("p", { class: "status" }, `${receipt}: ${decidedBy}`),
    computedScore != null ? el("p", {}, `Score from confirmed codes: ${computedScore}`) : null,
    el("p", { class: "label" }, label ?? ""));
}

/** C-02. Counts from logs only. */
export function DecisionLog(counts) {
  if (!counts) return el("section", { class: "panel" }, el("h3", {}, "Decision log"), el("p", {}, "No counts yet."));
  const pii = Object.entries(counts.piiStripped ?? {}).map(([t, n]) => `${t} ${n}`).join(", ") || "none";
  return el("section", { class: "panel", "aria-labelledby": "log-h" },
    el("h3", { id: "log-h" }, "Decision log, real counts from logs"),
    el("ul", {},
      el("li", {}, `Proposed ${counts.proposed}, confirmed ${counts.confirmed}, overridden ${counts.overridden}`),
      el("li", {}, `Source lines verified by code ${counts.quotesVerified}, not found ${counts.quotesNotFound}`),
      el("li", {}, `Identifiers stripped, by type: ${pii}; header lines dropped ${counts.headerLinesDropped}; fields dropped ${counts.fieldsDropped}`),
      el("li", {}, `Decisions attributed to a human: ${counts.decisionsByHuman}`)));
}
