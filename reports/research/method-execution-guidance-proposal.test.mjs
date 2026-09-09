import { test } from "node:test"
import assert from "node:assert/strict"
import { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS, expandProposal } from "./method-adoption-protocols.mjs"
import { proposeMethodExecutionGuidance } from "./method-execution-guidance-proposal.mjs"

test("every proposed configuration preserves exact ordered work and recovery while adding instructions", () => {
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const result = proposeMethodExecutionGuidance(p)
    assert.deepEqual(result.segments.map(({ instruction, ...part }) => part), expandProposal(p))
    assert.ok(result.segments.every(s => s.instruction.length > 0))
    assert.equal(result.executionAuthority, "NONE")
    assert.equal(result.scientificDoseValidation, false)
    assert.equal(result.personalPaceCalculated, false)
    assert.equal(Boolean(result.offReason), p.family === "OFF")
  }
})

test("ATP distance, flying, and timed methods retain different execution instructions", () => {
  const cues = ["P-ATP-A", "P-ATP-F", "P-ATP-T"].map(id =>
    proposeMethodExecutionGuidance(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)).methodCue)
  assert.equal(new Set(cues).size, 3)
  assert.ok(cues.every(Boolean))
})

test("recovery effort refers to exact recovery parts without assigning numeric RPE to roll-on or standing", () => {
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const parts = expandProposal(p), recovery = proposeMethodExecutionGuidance(p).effortProposal.recovery
    if (!recovery) continue
    assert.equal(recovery.rpe, null)
    assert.equal(recovery.targets.length, parts.filter(p => !["WORK", "BUILDUP"].includes(p.role)).length)
    for (const { partIndex, rpe, cue, ...part } of recovery.targets) {
      assert.deepEqual(part, parts[partIndex])
      assert.ok(cue.length > 0)
      assert.deepEqual(rpe, ["WALK", "JOG", "EASY_RUN"].includes(part.role) ? [1, 3] : null)
    }
  }
})

test("work effort is explicit without inventing sprint RPE, session targets or automatic increases", () => {
  for (const p of [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]) {
    const result = proposeMethodExecutionGuidance(p).effortProposal
    assert.equal(result.sessionRpeTarget, null)
    if (p.family === "OFF") {
      assert.equal(result.work, null)
      assert.equal(result.recovery, null)
      continue
    }
    assert.equal(result.automaticDoseChange, false)
    assert.equal(result.measuredPhysiology, false)
    assert.equal(result.status, "PRODUCT_COACHING_CHOICE_OWNER_PENDING")
    assert.ok(result.work.adjustment.length > 0)
    if (p.family === "ATP-PC") assert.equal(result.work.rpe, null)
    else assert.ok(result.work.rpe[0] >= 1 && result.work.rpe[1] <= 9 && result.work.rpe[0] <= result.work.rpe[1])
  }
})
