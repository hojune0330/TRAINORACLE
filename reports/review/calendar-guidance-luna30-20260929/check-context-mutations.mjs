import ts from "../../../app/node_modules/typescript/lib/typescript.js";
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";

const root = new URL("../../../app/src/domain/", import.meta.url);
const source = readFileSync(new URL("calendar-context.ts", root), "utf8");
function load(name, override) {
  assert.ok(["calendar-context", "dates", "training-cycle-window"].includes(name));
  const text = name === "calendar-context" ? override : readFileSync(new URL(`${name}.ts`, root), "utf8");
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(compiled.outputText, { exports, Date, require: id => load(id.replace(/^\.\//u, ""), override) });
  return exports;
}
function check(api) {
  assert.equal(api.recentCalendarDate(["2026-07-01", "2026-10-01"], "2026-09-30"), "2026-07-01");
  assert.equal(api.planCalendarDate("2026-09-01", 9, "2026-09-30"), "2026-09-09");
  assert.equal(api.planCalendarDate("2026-09-01", 9, "2026-09-03", true), "2026-09-01");
  assert.equal(api.calendarReadiness({ localComplete: true, accountEnabled: true, owner: "a", auth: "ACCOUNT", online: "FAILED", entryCount: 0 }), "ERROR");
  assert.ok(api.calendarCycleIndex("2026-09-30", "2026-07-01") < 0);
  assert.equal(api.calendarRecordDates([{ date: "2026-02-30" }]).length, 0);
}
check(load("calendar-context", source));
const mutations = [
  ["future record preferred", "dates.filter(date => date <= today).at(-1)", "dates.at(-1)"],
  ["ended plan jumps to start", "today > end ? end : today", "today > end ? start : today"],
  ["candidate jumps to today", "candidate || today < start", "today < start"],
  ["failed read treated as ready empty", '["FAILED", "REJECTED", "CONFLICT"].includes(input.online) ? "ERROR"', '["FAILED", "REJECTED", "CONFLICT"].includes(input.online) ? "READY"'],
  ["past cycle forced to zero", "return index", "return Math.max(0, index)"],
  ["invalid date admitted", ".filter(isValidIsoDate)", ""],
];
const results = [];
for (const [name, from, to] of mutations) {
  assert.ok(source.includes(from), `Mutation target absent: ${name}`);
  const mutated = source.replace(from, to);
  const api = load("calendar-context", mutated);
  let rejected = false;
  try { check(api); } catch (error) { if (error instanceof assert.AssertionError) rejected = true; else throw error; }
  assert.ok(rejected, `Surviving mutation: ${name}`);
  results.push({ name, rejected });
}
assert.equal(readFileSync(new URL("calendar-context.ts", root), "utf8"), source);
writeFileSync(new URL("./context-implementation/mutations.json", import.meta.url), JSON.stringify({ original: "PASS", sourceUnchanged: true, results }, null, 2));
console.log(JSON.stringify({ original: "PASS", rejected: results.length, sourceUnchanged: true }));
