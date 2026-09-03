import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import {
  characterizeExistingAdaptiveGuards,
  validateAdaptiveReplanningPolicy,
} from "./validate-adaptive-replanning-policy.mjs"

const root = resolve(import.meta.dirname, "../..")
const read = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/gu, "\n")

function documents() {
  return {
    formation: read("specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md"),
    generator: read("specs/active/PLAN_GENERATOR_SPEC.md"),
    projection: read("specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md"),
    coachRuleset: read("specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md"),
    design: read("DESIGN.md"),
  }
}

function replaceExact(document, before, after, label) {
  assert.ok(document.includes(before), `${label} mutation target must exist`)
  const mutated = document.replace(before, after)
  assert.notEqual(mutated, document, `${label} mutation must change input`)
  return mutated
}

function expectMutationRejected(key, before, after, pattern) {
  const input = documents()
  input[key] = replaceExact(input[key], before, after, key)
  assert.throws(() => validateAdaptiveReplanningPolicy(input), pattern)
}

test("characterizes existing immutable-plan, self-selection, privacy, and no-progression guards", () => {
  assert.deepEqual(characterizeExistingAdaptiveGuards(documents()), { existingGuards: true })
})

test("accepts the bounded origin-scoped next-frame policy", () => {
  assert.deepEqual(validateAdaptiveReplanningPolicy(documents()), {
    documentState: "DRAFT_NON_RUNTIME_PREPARED",
    supportedEvents: ["800M", "1500M", "3000M", "5000M"],
    activeFrameImmutable: true,
    maxChangedDimensions: 1,
    authority: { SELF_SERVICE: "SELF", COACH_AUTHORED: "COACH_REQUIRED" },
    allIssuesOpen: true,
  })
})

test("accepts the same policy with Windows line endings without weakening prose checks", () => {
  const lf = documents()
  const crlf = Object.fromEntries(Object.entries(lf).map(([key, value]) => [key, value.replace(/\n/gu, "\r\n")]))
  assert.deepEqual(validateAdaptiveReplanningPolicy(crlf), validateAdaptiveReplanningPolicy(lf))
  crlf.formation = replaceExact(
    crlf.formation,
    "it cannot increase\r\n  demand or move fixed or already-due work.",
    "it may increase\r\n  demand or move fixed or already-due work.",
    "CRLF normative prose",
  )
  assert.throws(() => validateAdaptiveReplanningPolicy(crlf), /normative policy/u)
})

test("rejects a restored global coach-only SYSTEM selection policy", () => {
  expectMutationRejected(
    "generator",
    '"SELF_SERVICE": "SELF"',
    '"SELF_SERVICE": "COACH_REQUIRED"',
    /locked policy/u,
  )
})

test("rejects automatic dose progression", () => {
  expectMutationRejected(
    "formation",
    '"automaticProgressionAllowed": false',
    '"automaticProgressionAllowed": true',
    /locked policy/u,
  )
})

test("rejects a proposal that changes multiple dimensions", () => {
  expectMutationRejected(
    "generator",
    '"maxChangedDimensions": 1',
    '"maxChangedDimensions": 2',
    /locked policy/u,
  )
})

test("rejects raw memo, note, or symptom text as proposal input", () => {
  expectMutationRejected(
    "formation",
    '"rawMemoNoteSymptomTextAllowed": false',
    '"rawMemoNoteSymptomTextAllowed": true',
    /locked policy/u,
  )
})

test("rejects stale safety becoming selectable", () => {
  expectMutationRejected(
    "generator",
    '"staleSafety": true',
    '"staleSafety": false',
    /locked policy/u,
  )
})

test("rejects prose that permits a current-frame demand increase", () => {
  expectMutationRejected(
    "formation",
    "it cannot increase\n  demand or move fixed or already-due work.",
    "it may increase\n  demand or move fixed or already-due work.",
    /normative policy/u,
  )
})

test("rejects a current-frame adjustment that creates a next-frame proposal", () => {
  expectMutationRejected(
    "formation",
    "createsNextFrameProposal: false",
    "createsNextFrameProposal: true",
    /normative policy/u,
  )
})

test("rejects widening next-frame proposal triggers to race changes", () => {
  expectMutationRejected(
    "formation",
    "trigger: SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START | EXPLICIT_REQUEST",
    "trigger: SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START | EXPLICIT_REQUEST | RACE_CHANGE",
    /normative policy/u,
  )
})

test("rejects mapping an anchor change to a next-frame proposal", () => {
  expectMutationRejected(
    "formation",
    "| Accepted race or immovable-anchor change | `NO_ADAPTIVE_PROPOSAL`; use only the owning re-anchor/rebuild contract |",
    "| Accepted race or immovable-anchor change | `NEXT_FRAME` `PlanAdaptationProposal` |",
    /normative policy/u,
  )
})

test("rejects a current-frame adjustment without its authorization binding", () => {
  expectMutationRejected(
    "formation",
    "adjustmentAuthorizationDecisionRef: FormationAuthorizationDecisionId",
    "adjustmentAuthorizationDecisionRef: null",
    /normative policy/u,
  )
})

test("rejects a current-frame adjustment without its fresh safety binding", () => {
  expectMutationRejected(
    "formation",
    "adjustmentAuthorizationDecisionRef: FormationAuthorizationDecisionId\n  freshSafetyBlockRefId: SafetyBlockRefId",
    "adjustmentAuthorizationDecisionRef: FormationAuthorizationDecisionId\n  freshSafetyBlockRefId: null",
    /normative policy/u,
  )
})

test("rejects a current-frame adjustment without idempotency protection", () => {
  const input = documents()
  const recordStart = input.formation.indexOf("CurrentFrameAdjustmentRecord:")
  const recordEnd = input.formation.indexOf("PlanAdaptationDecisionRecord:", recordStart)
  assert.ok(recordStart >= 0 && recordEnd > recordStart, "adjustment record mutation target must exist")
  const record = input.formation.slice(recordStart, recordEnd)
  assert.ok(record.includes("  idempotency: IdempotencyEnvelope"), "adjustment idempotency target must exist")
  input.formation = `${input.formation.slice(0, recordStart)}${record.replace("  idempotency: IdempotencyEnvelope\n", "")}${input.formation.slice(recordEnd)}`
  assert.throws(() => validateAdaptiveReplanningPolicy(input), /normative policy/u)
})

test("rejects allowing a D9-blocked current-frame adjustment", () => {
  expectMutationRejected(
    "formation",
    "| `FA-TC-106` | Current-frame adjustment observes D9 `ACTIVE` or `UNKNOWN` at atomic recheck | Transaction rolls back; no adjustment is appended or applied and no coach override exists |",
    "| `FA-TC-106` | Current-frame adjustment observes D9 `ACTIVE` or `UNKNOWN` at atomic recheck | Adjustment may be appended |",
    /normative policy/u,
  )
})

test("rejects allowing a stale-safety current-frame adjustment", () => {
  expectMutationRejected(
    "formation",
    "| `FA-TC-107` | Current-frame adjustment presents stale, wrong-target, or wrong-scope safety state/ref | Transaction rolls back without adjustment or payload disclosure |",
    "| `FA-TC-107` | Current-frame adjustment presents stale safety state/ref | Adjustment may be appended |",
    /normative policy/u,
  )
})

test("rejects allowing a current-frame adjustment while held", () => {
  expectMutationRejected(
    "formation",
    "| `FA-TC-108` | An active hold exists or activates before current-frame adjustment CAS | `expectedActiveHoldState: NONE` fails; no adjustment is appended or applied and the hold remains active |",
    "| `FA-TC-108` | An active hold exists | Coach override may append the adjustment |",
    /normative policy/u,
  )
})

test("rejects malformed adaptive policy input", () => {
  expectMutationRejected(
    "formation",
    '"schemaVersion": 1',
    '"schemaVersion":',
    /malformed JSON/u,
  )
})

test("rejects text after a required draft marker", () => {
  const input = documents()
  input.projection = `${input.projection.trimEnd()}\nINVALID_TRAILING_TEXT\n`
  assert.throws(() => validateAdaptiveReplanningPolicy(input), /final marker is not clean/u)
})

test("mutation setup fails before validation when its target is absent", () => {
  let validatorCalled = false
  assert.throws(
    () => {
      const input = documents()
      input.generator = replaceExact(input.generator, "ABSENT_MUTATION_TARGET", "replacement", "generator")
      validatorCalled = true
      validateAdaptiveReplanningPolicy(input)
    },
    /mutation target must exist/u,
  )
  assert.equal(validatorCalled, false)
})
