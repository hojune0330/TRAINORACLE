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
