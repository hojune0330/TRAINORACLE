import test from "node:test"
import assert from "node:assert/strict"
import { METHOD_ADOPTION_PROTOCOLS as protocols, METHOD_ADOPTION_VARIANTS as variants, expandProposal, summarizeProposal, assembleProposalSession } from "./method-adoption-protocols.mjs"

const get = id => [...protocols, ...variants].find(p => p.id === id)
const summary = id => summarizeProposal(get(id))
test("all seventeen packet rows and eight finite variants remain review only", () => {
  assert.equal(protocols.length, 17)
  assert.equal(variants.length, 8)
  assert.equal(new Set([...protocols, ...variants].map(p => p.id)).size, 25)
  for (const p of [...protocols, ...variants]) {
    assert.equal(summarizeProposal(p).executionAuthority, "NONE")
    assert.equal(p.status, "OWNER_ADOPTION_PENDING")
    assert.equal(Object.hasOwn(p, "pairedWith"), false)
  }
})
test("all time-based original totals match the packet independently", () => {
  for (const [id, work, rest, elapsed] of [
    ["P-BASE-C",1800,null,1800], ["P-BASE-B",1800,120,1920],
    ["P-LT-C",1200,null,1200], ["P-LT-B",1200,60,1260], ["P-LT-S",1260,120,1380],
    ["P-VO2-2",720,300,1020], ["P-VO2-3",900,480,1380], ["P-VO2-4",960,540,1500],
    ["P-REC-W",900,null,900],
    ["P-ATP-T",24,540,564],
  ]) {
    const s = summary(id)
    assert.equal(s.work.SECONDS, work, id)
    assert.equal(s.recovery.SECONDS, rest, id)
    assert.equal(s.totalSeconds, elapsed, id)
    assert.equal(s.work.METERS, null, id)
  }
})
test("roll-on follows every rep including final rep and precedes additional set rest", () => {
  assert.deepEqual(summary("P-RHYTHM-400").recovery, { SECONDS: null, METERS: 1200 })
  const s = summary("P-RHYTHM-300")
  assert.equal(s.work.METERS, 1800)
  assert.deepEqual(s.recovery, { SECONDS: 240, METERS: 600 })
  assert.equal(s.afterEvery, 6)
  assert.equal(s.betweenSets, 2)
  const expanded = expandProposal(get("P-RHYTHM-300"))
  for (let i = 0; i < expanded.length; i++) if (expanded[i].boundary === "BETWEEN_SETS") assert.equal(expanded[i - 1].role, "ROLL_ON")
  assert.equal(expanded.at(-1).role, "ROLL_ON")
  assert.equal(s.totalSeconds, null)
})
test("set split preserves work and adds exact recovery without an extra inter-rep rest", () => {
  const straight = summary("P-GLY-D"), split = summary("P-GLY-S")
  assert.equal(straight.work.METERS, 1200)
  assert.deepEqual(split.work, straight.work)
  assert.equal(straight.recovery.SECONDS, 600)
  assert.equal(split.recovery.SECONDS, 780)
  assert.equal(split.betweenReps, 4)
  assert.equal(split.betweenSets, 1)
  assert.equal(expandProposal(get("P-GLY-S")).at(-1).role, "WORK")
  const roll = summary("P-RHYTHM-400-2X6")
  assert.equal(roll.work.METERS, 4800)
  assert.deepEqual(roll.recovery, { SECONDS: 180, METERS: 1200 })
})
test("buildup is retained separately from fast distance; no made-up duration", () => {
  const s = summary("P-ATP-F")
  assert.equal(s.work.METERS, 40)
  assert.equal(s.buildup.METERS, 80)
  assert.equal(s.recovery.SECONDS, 720)
  assert.equal(s.totalSeconds, null)
  assert.equal(summary("P-ATP-A").work.METERS, 120)
  assert.equal(summary("P-ATP-A").recovery.SECONDS, 600)
})
test("OFF is a planned absence, not a measured zero exercise", () => {
  const s = summary("P-OFF")
  assert.deepEqual(s.work, { SECONDS: null, METERS: null })
  assert.equal(s.observedExercise, null)
  assert.equal(s.totalSeconds, null)
  assert.deepEqual(expandProposal(get("P-OFF")), [])
})
test("variants retain method identity rather than inflating distinct method count", () => {
  for (const v of variants) {
    assert.equal(v.method, get(v.parentId).method)
    assert.equal(v.family, get(v.parentId).family)
  }
  assert.equal(summary("P-VO2-2-4").recovery.SECONDS, 180)
  assert.equal(summary("P-ATP-A-4").recovery.SECONDS, 360)
  assert.equal(summary("P-LT-B-480").work.SECONDS, 960)
})
test("invalid counts, false authorization and ambiguous recovery reject", () => {
  const base = get("P-GLY-S")
  for (const change of [ { reps: 2.5 }, { sets: -1 }, { setRest: null }, { between: null },
    { executionAuthority: "EXECUTE" }, { status: "APPROVED" },
    { afterEvery: { role: "ROLL_ON", unit: "METERS", value: 100 } },
    { work: [{ role: "WORK", unit: "SECONDS", value: NaN }] },
    { work: [{ role: "WORK", unit: "METERS", value: -200 }] },
  ]) assert.throws(() => summarizeProposal({ ...base, ...change }))
})
test("owner notation 2x(10x400m) r60 R180 totals 20 reps, 8000m and 1260s", () => {
  const p = { ...get("P-GLY-S"), id: "TEST-OWNER-NOTATION", sets: 2, reps: 10,
    work: [{ role: "WORK", unit: "METERS", value: 400 }],
    between: { role: "WALK", unit: "SECONDS", value: 60 },
    setRest: { role: "WALK_OR_STAND", unit: "SECONDS", value: 180 } }
  const s = summarizeProposal(p)
  assert.equal(s.repeats, 20)
  assert.equal(s.work.METERS, 8000)
  assert.equal(s.betweenReps, 18)
  assert.equal(s.betweenSets, 1)
  assert.equal(s.recovery.SECONDS, 1260)
  assert.equal(s.totalSeconds, null)
  // Structural arithmetic only: this fixture is not added to the proposal catalog.
  assert.equal(protocols.some(row => row.id === p.id), false)
})
test("support proposal has explicit final transition and exact elapsed time", () => {
  const session = assembleProposalSession(get("P-LT-B"))
  assert.equal(session.supportRef.version, "0.2")
  assert.ok(session.warmup.filter(s => s.role === "WALK").every(s => s.cue === "WALK"))
  assert.equal(session.warmup.reduce((sum, s) => sum + s.value, 0), 1160)
  assert.equal(session.warmup.at(-1).value, 60)
  assert.equal(session.cooldown[0].value, 600)
  assert.equal(session.supportSeconds, 1760)
  assert.equal(session.totalSeconds, 3020)
  assert.equal(session.applicabilityReviewed, false)
  assert.equal(session.executionAuthority, "NONE")
  assert.deepEqual(session.main, expandProposal(get("P-LT-B")))
})
test("BASE REC OFF do not acquire a second warmup or extra workout", () => {
  for (const id of ["P-BASE-C", "P-BASE-B", "P-REC-W", "P-OFF"]) {
    const session = assembleProposalSession(get(id))
    assert.equal(session.supportSeconds, 0)
    assert.deepEqual(session.warmup, [])
    assert.deepEqual(session.cooldown, [])
    assert.equal(session.supportRef, null)
    assert.equal(session.totalSeconds, summary(id).totalSeconds)
  }
})
test("distance main never becomes a made-up whole-session duration", () => {
  const session = assembleProposalSession(get("P-ATP-F"))
  assert.equal(session.supportSeconds, 1760)
  assert.equal(session.totalSeconds, null)
  session.warmup[0].value = 1
  assert.equal(assembleProposalSession(get("P-ATP-F")).warmup[0].value, 900)
})
