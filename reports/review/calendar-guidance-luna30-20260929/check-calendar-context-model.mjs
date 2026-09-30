import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { anchor, boot, step } from "./calendar-context-model.mjs";

const record = date => ({ date, accepted: true });
const ready = (s, records, extra = {}) => ({ type: "READY", owner: s.owner, epoch: s.epoch, records, ...extra });
const cases = [];
const check = (name, fn) => { fn(); cases.push(name); };
check("recent activity date, not upload timestamp", () => {
  assert.equal(anchor("JOURNAL", "2026-09-29", [record("2026-08-18"), { ...record("2025-01-01"), updatedAt: "2026-09-29" }]).date, "2026-08-18");
});
check("future, deleted, unaccepted, demo and invalid dates are excluded", () => {
  const data = [record("2028-01-01"), record("2026-02-30"), { ...record("2026-09-29"), deleted: true },
    { ...record("2026-09-28"), accepted: false }, { ...record("2026-09-27"), demo: true }, record("2026-08-18")];
  assert.equal(anchor("JOURNAL", "2026-09-29", data).date, "2026-08-18");
});
check("today included in active plan, including an empty scheduled day", () => {
  assert.equal(anchor("ACTIVE_PLAN", "2026-09-29", [], ["2026-09-28", "2026-09-30"]).date, "2026-09-29");
});
check("future active plan begins at first plan date", () => {
  assert.equal(anchor("ACTIVE_PLAN", "2026-09-29", [], ["2026-10-02", "2026-10-04"]).date, "2026-10-02");
});
check("completed range ends at last date rather than suggesting catch-up", () => {
  assert.equal(anchor("ACTIVE_PLAN", "2026-09-29", [], ["2026-08-01", "2026-08-09"]).date, "2026-08-09");
});
for (const policy of ["PLAN_CANDIDATE", "INTAKE_PREVIEW"]) check(`${policy} ignores recent journal`, () => {
  assert.equal(anchor(policy, "2026-09-29", [record("2026-09-28")], ["2026-10-05", "2026-10-01"]).date, "2026-10-01");
});
check("manual date during loading survives response", () => {
  let s = step(boot(), { type: "SELECT", date: "2024-02-29" });
  s = step(s, ready(s, [record("2026-09-28")]));
  assert.equal(s.date, "2024-02-29");
});
check("manual month without selection survives response", () => {
  let s = step(boot(), { type: "MONTH", month: "2024-02" });
  s = step(s, ready(s, [record("2026-09-28")]));
  assert.equal(s.month, "2024-02"); assert.equal(s.date, null);
});
check("error is not authoritative empty", () => {
  let s = boot(); s = step(s, { type: "ERROR", owner: s.owner, epoch: s.epoch });
  assert.equal(s.status, "ERROR"); assert.equal(step(s, { type: "DEMO" }).demo, false);
});
check("stale record remains available after load failure", () => {
  let s = boot(); s = step(s, ready(s, [record("2026-08-18")]));
  s = step(s, { type: "ERROR", owner: s.owner, epoch: s.epoch });
  assert.equal(s.status, "STALE"); assert.equal(s.records.length, 1); assert.equal(s.date, "2026-08-18");
});
check("old owner response rejected after account change", () => {
  const a = boot(); const response = ready(a, [record("2026-09-27")]);
  const b = step(a, { type: "ACCOUNT", owner: "synthetic-B" });
  assert.deepEqual(step(b, response), b);
});
check("same owner stale epoch rejected after leave and return", () => {
  const a = boot(); const response = ready(a, [record("2026-09-27")]);
  const b = step(step(a, { type: "ACCOUNT", owner: "synthetic-B" }), { type: "ACCOUNT", owner: "synthetic-A" });
  assert.deepEqual(step(b, response), b);
});
check("midnight and deletion do not steal selected date", () => {
  let s = step(boot(), { type: "SELECT", date: "2024-02-29" });
  s = step(s, { type: "MIDNIGHT", today: "2026-09-30" });
  s = step(s, ready(s, [])); assert.equal(s.date, "2024-02-29");
});
check("explicit new intent is allowed after manual selection", () => {
  let s = step(boot(), { type: "SELECT", date: "2024-02-29" });
  s = step(s, { type: "EXPLICIT", date: "2026-09-29" }); assert.equal(s.date, "2026-09-29");
});
check("reader back restores date and never writes", () => {
  let s = step(boot(), { type: "SELECT", date: "2024-02-29" });
  s = step(step(s, { type: "OPEN" }), { type: "BACK" }); assert.equal(s.date, "2024-02-29"); assert.equal(s.writes, 0);
});
check("empty demo is distinct and never writes", () => {
  let s = boot(); s = step(s, ready(s, [])); s = step(s, { type: "DEMO" });
  assert.equal(s.demo, true); assert.equal(s.records.length, 0); assert.equal(s.writes, 0);
});
check("same account late response cannot erase newer snapshot", () => {
  let s = boot(); s = step(s, ready(s, [record("2026-09-28")], { generation: 2 }));
  const fresh = structuredClone(s);
  s = step(s, ready(s, [], { generation: 1 })); assert.deepEqual(s, fresh);
});
check("explicit example stays separate when actual data arrives", () => {
  let s = boot(); s = step(s, ready(s, [])); s = step(s, { type: "DEMO" });
  const example = structuredClone(s.demoContext);
  s = step(s, ready(s, [record("2026-09-28")], { generation: 2 }));
  assert.deepEqual(s.demoContext, example); assert.equal(s.records.length, 1); assert.equal(s.demo, true);
  s = step(s, { type: "END_DEMO" }); assert.equal(s.demo, false); assert.equal(s.records.length, 1);
});

const mutationResults = [];
function killed(name, defects, probe) {
  let caught = false;
  try { probe(defects); } catch (error) { if (error.code !== "ERR_ASSERTION") throw error; caught = true; }
  assert.ok(caught, `mutation survived: ${name}`); mutationResults.push(name);
}
killed("owner epoch guard removed", { ignoreScope: true }, defects => {
  const a = boot(); const b = step(a, { type: "ACCOUNT", owner: "synthetic-B" });
  assert.deepEqual(step(b, ready(a, [record("2026-09-27")]), defects), b);
});
killed("every response reanchors", { refreshReanchors: true }, defects => {
  let s = step(boot(), { type: "SELECT", date: "2024-02-29" });
  s = step(s, ready(s, [record("2026-09-28")]), defects); assert.equal(s.date, "2024-02-29");
});
killed("load error treated as empty", { errorIsEmpty: true }, defects => {
  const s = boot(); assert.equal(step(s, { type: "ERROR", owner: s.owner, epoch: s.epoch }, defects).status, "ERROR");
});
killed("same-owner response generation guard removed", { ignoreGeneration: true }, defects => {
  let s = boot(); s = step(s, ready(s, [record("2026-09-28")], { generation: 2 }));
  assert.deepEqual(step(s, ready(s, [], { generation: 1 }), defects), s);
});

// Independent invariants, not a comparison against a second copy of the reducer.
const seeds = [20260929, 101, 8675309, 429496729];
const counts = {};
let transitions = 0;
for (const seed of seeds) {
  let random = seed >>> 0;
  const next = max => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % max; };
  for (let run = 0; run < 250; run++) {
    let s = boot();
    for (let i = 0; i < 50; i++) {
      const n = next(14);
      const event = n === 0 ? { type: "SELECT", date: ["2024-02-29", "2026-08-18", "2027-01-01"][next(3)] }
        : n === 1 ? { type: "MONTH", month: ["2024-02", "2026-08", "2027-01"][next(3)] }
        : n === 2 ? { type: "ACCOUNT", owner: `synthetic-${next(3)}` }
        : n === 3 ? ready(s, [record("2026-09-28")], { epoch: Math.max(0, s.epoch - 1) })
        : n === 4 ? ready(s, [])
        : n === 5 ? ready(s, [record("2026-08-18")])
        : n === 6 ? { type: "ERROR", owner: s.owner, epoch: s.epoch }
        : n === 7 ? { type: "MIDNIGHT", today: "2026-09-30" }
        : n === 8 ? { type: "OPEN" }
        : n === 9 ? { type: "BACK" }
        : n === 10 ? { type: "DEMO" }
        : n === 11 ? { type: "RECENT" }
        : n === 12 ? ready(s, [record("2026-09-28")], { generation: Math.max(1, s.generation + 1) })
        : { type: "END_DEMO" };
      const before = structuredClone(s); s = step(s, event); transitions++;
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      assert.equal(s.writes, 0);
      if (event.type === "ACCOUNT") {
        assert.equal(s.date, null); assert.equal(s.records.length, 0); assert.equal(s.readerOpen, false); assert.equal(s.demo, false);
      }
      if (["READY", "ERROR"].includes(event.type) && (event.owner !== before.owner || event.epoch !== before.epoch))
        assert.deepEqual(s, before);
      if (["READY", "ERROR"].includes(event.type) && (event.generation ?? 0) < before.generation)
        assert.deepEqual(s, before);
      if (["READY", "ERROR", "MIDNIGHT"].includes(event.type) && before.demo)
        assert.deepEqual(s.demoContext, before.demoContext);
      if (["READY", "ERROR", "MIDNIGHT", "BACK"].includes(event.type) && before.locked) {
        assert.equal(s.date, before.date); assert.equal(s.month, before.month);
      }
      if (["READY", "ERROR", "MIDNIGHT"].includes(event.type)) assert.equal(s.readerOpen, before.readerOpen);
      if (event.type === "ERROR" && event.owner === before.owner && event.epoch === before.epoch && (event.generation ?? 0) >= before.generation)
        assert.notEqual(s.status, "READY");
    }
  }
}
const result = { status: "PASS", scope: "standalone planning model, not application runtime",
  sourceCommit: "3e659d4", cases: cases.length, caseNames: cases, seeds, randomSequences: 1000,
  transitions, eventCounts: counts, killedMutations: mutationResults,
  excluded: ["actual React rendering", "real accounts", "cycle index mapping", "actual network", "browser gestures", "performance"] };
writeFileSync(fileURLToPath(new URL("./model-evidence.json", import.meta.url)), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
