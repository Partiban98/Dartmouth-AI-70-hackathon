import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url), swc = require("next/dist/build/swc");
await swc.loadBindings();
test("blind-call Enter leaves focused navigation buttons to their native action", async () => {
  const code = (await swc.transform(readFileSync(new URL("../components/grading/CallItFirst.tsx", import.meta.url), "utf8"), { jsc: { parser: { syntax: "typescript", tsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } })).code;
  let handler, calls = 0, prevented = 0;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, window: { addEventListener: (_, h) => { handler = h; }, removeEventListener() {} }, require: (s) => s === "react" ? { useState: (v) => [v, () => {}], useEffect: (fn) => fn() } : s === "./copy" ? { COPY: { callFirst: {} } } : require(s) });
  module.exports.default({ table: { codes: [] }, onLock: () => { calls++; } });
  handler({ key: "Enter", target: { tagName: "BUTTON" }, preventDefault: () => prevented++ });
  assert.equal(calls, 0); assert.equal(prevented, 0);
  handler({ key: "Enter", target: { tagName: "BODY" }, preventDefault: () => prevented++ });
  assert.equal(calls, 1); assert.equal(prevented, 1);
});
