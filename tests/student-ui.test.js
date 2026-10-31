// Execute the actual client components with a small deterministic hook runtime.
// Network responses are controlled to exercise identity changes and stale requests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const swc = require("next/dist/build/swc");
await swc.loadBindings();
async function component(file, fetch) {
  const code = (await swc.transform(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" },
  })).code;
  const slots = []; let cursor = 0, queued = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const hooks = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], (x) => { slots[i] = typeof x === "function" ? x(slots[i]) : x; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) queued.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, fetch, require: (s) => s === "react" ? hooks : s.startsWith("@/") ? { __esModule: true, default: function Child() {} } : require(s) });
  return (props = {}) => { cursor = 0; const tree = module.exports.default(props); const effects = queued; queued = []; effects.forEach((f) => f()); return tree; };
}
function find(node, predicate) { if (!node) return null; if (predicate(node)) return node; for (const c of [].concat(node.props?.children ?? [])) { const found = find(c, predicate); if (found) return found; } return null; }
const tick = () => new Promise((resolve) => setImmediate(resolve));
const response = (json) => ({ ok: true, json: async () => json });

test("S6: switching students clears the previous student's regrade draft", async () => {
  const render = await component("components/student/RegradeRequest.tsx", async () => response({ saved: true }));
  let tree = render({ anonId: "S-01", questionId: "grade" });
  find(tree, (n) => n.type === "textarea").props.onChange({ target: { value: "Please review my first student's denominator." } });
  tree = render({ anonId: "S-01", questionId: "grade" });
  assert.match(find(tree, (n) => n.type === "textarea").props.value, /first student/);
  render({ anonId: "S-02", questionId: "grade" });
  tree = render({ anonId: "S-02", questionId: "grade" });
  assert.equal(find(tree, (n) => n.type === "textarea").props.value, "");
});

test("S6: a slower earlier student response cannot replace the selected student's view", async () => {
  const pending = new Map();
  const render = await component("app/student/page.tsx", (path) => path === "/counts"
    ? Promise.resolve(response({ decisions: [{ itemId: "S-01" }, { itemId: "S-02" }] }))
    : new Promise((resolve) => pending.set(path, resolve)));
  render(); await tick();
  let tree = render();
  find(tree, (n) => n.type === "select").props.onChange({ target: { value: "S-02" } });
  render();
  const view = (anonId, total) => ({ anonId, total, outOf: 10, questions: [] });
  pending.get("/api/student/S-02")(response(view("S-02", 9))); await tick(); render();
  pending.get("/api/student/S-01")(response(view("S-01", 7))); await tick(); tree = render();
  assert.equal(find(tree, (n) => n.type === "select").props.value, "S-02");
  assert.equal(find(tree, (n) => n.type === "p" && n.props.className === "mt-6 text-3xl font-bold").props.children[0], 9);
});

test("S6: a network failure keeps the regrade draft and enables retry with an error", async () => {
  const render = await component("components/student/RegradeRequest.tsx", async () => { throw new Error("offline"); });
  let tree = render({ anonId: "S-01", questionId: "grade" });
  find(tree, (n) => n.type === "textarea").props.onChange({ target: { value: "Please review the denominator in this step." } });
  tree = render({ anonId: "S-01", questionId: "grade" });
  await find(tree, (n) => n.type === "button").props.onClick();
  tree = render({ anonId: "S-01", questionId: "grade" });
  assert.equal(find(tree, (n) => n.type === "button").props.disabled, false);
  assert.match(find(tree, (n) => n.props?.role === "alert").props.children, /connection/);
  assert.match(find(tree, (n) => n.type === "textarea").props.value, /denominator/);
});
