import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const POLICY_START = "<!-- MACHINE_POLICY:ADAPTIVE_REPLANNING_V1:START -->"
const POLICY_END = "<!-- MACHINE_POLICY:ADAPTIVE_REPLANNING_V1:END -->"

export const EXPECTED_POLICY = Object.freeze({
  schemaVersion: 1,
  supportedEvents: Object.freeze(["800M", "1500M", "3000M", "5000M"]),
  deferredEvents: Object.freeze(["100M", "200M", "400M"]),
  activeFrame: Object.freeze({
    immutableFrom: Object.freeze([
      "PB_SB", "COMPLETION", "RPE", "ATTENDANCE", "STREAKS", "POINTS", "JOURNAL_AGGREGATES",
    ]),
    recoveryAvailabilityActions: Object.freeze([
      "MAINTAIN", "REDUCE", "REST", "MOVE_NOT_YET_DUE_FLEXIBLE_WORK",
    ]),
    missedMainCatchUp: false,
  }),
  nextFrameTriggers: Object.freeze({
    sameEventPbSb: Object.freeze({
      sameEventRequired: true,
      achievedAfterActivePlanStart: true,
    }),
    explicitRequestActors: Object.freeze(["ATHLETE", "COACH"]),
  }),
  proposal: Object.freeze({
    origins: Object.freeze(["SELF_SERVICE", "COACH_AUTHORED"]),
    selectionAuthorityByOrigin: Object.freeze({
      SELF_SERVICE: "SELF",
      COACH_AUTHORED: "COACH_REQUIRED",
    }),
    changeDimensions: Object.freeze(["INTENSITY", "VOLUME", "FREQUENCY"]),
    maxChangedDimensions: 1,
    approvedValuesOnly: true,
    percentagesAllowed: false,
    freeNumericEditorAllowed: false,
    automaticProgressionAllowed: false,
  }),
  selectionBlock: Object.freeze({
    d9States: Object.freeze(["ACTIVE", "UNKNOWN"]),
    staleSafety: true,
    activeHold: true,
    selectableProposalAllowed: false,
  }),
  privacy: Object.freeze({ rawMemoNoteSymptomTextAllowed: false }),
})

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

function parsePolicy(document, name) {
  const start = document.indexOf(POLICY_START)
  const end = document.indexOf(POLICY_END)
  invariant(start >= 0 && end > start, `${name} missing adaptive machine policy block`)
  const match = document.slice(start + POLICY_START.length, end).match(/```json\s*([\s\S]*?)\s*```/u)
  invariant(match !== null, `${name} adaptive machine policy must be a JSON code block`)
  try {
    return JSON.parse(match[1])
  } catch (error) {
    throw new Error(`${name} adaptive machine policy is malformed JSON`, { cause: error })
  }
}

function samePolicy(actual, name) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(EXPECTED_POLICY),
    `${name} adaptive machine policy does not match the locked policy`,
  )
}

function finalMarkerIsClean(document, name) {
  invariant(document.trimEnd().split(/\r?\n/u).at(-1) === "[DRAFT_COMPLETE]", `${name} final marker is not clean`)
}

function requireMarkers(document, name, markers) {
  for (const marker of markers) {
    invariant(document.includes(marker), `${name} missing policy marker: ${marker}`)
  }
}

function requireNormativeMarkers(document, name, markers) {
  for (const marker of markers) {
    invariant(document.includes(marker), `${name} missing normative policy prose: ${marker}`)
  }
}

function requireNormativeLines(document, name, requiredLines) {
  const lines = new Set(document.split(/\r?\n/u).map((line) => line.trim()))
  for (const line of requiredLines) {
    invariant(lines.has(line), `${name} missing exact normative policy line: ${line}`)
  }
}

function sectionBetween(document, startMarker, endMarker, name) {
  const start = document.indexOf(startMarker)
  const end = document.indexOf(endMarker, start + startMarker.length)
  invariant(start >= 0 && end > start, `${name} record block is missing or malformed`)
  return document.slice(start, end)
}

function declaredInteger(document, pattern, label) {
  const match = document.match(pattern)
  invariant(match !== null, `${label} declaration missing`)
  return Number.parseInt(match[1], 10)
}

function validateOpenIssueTable(document, prefix, countPattern, blockingPattern, name) {
  const rows = document.split(/\r?\n/u).filter((line) => (
    line.startsWith(`| OI-${prefix}-`) || line.startsWith(`| \`OI-${prefix}-`)
  ))
  invariant(rows.length > 0, `${name} open issue table missing`)
  invariant(rows.every((row) => /\| OPEN \|/u.test(row)), `${name} must preserve every issue as OPEN`)
  invariant(
    declaredInteger(document, countPattern, `${name} open issue count`) === rows.length,
    `${name} open issue metadata does not match its opened table`,
  )
  const blocking = rows.filter((row) => /\| YES \| OPEN \|/u.test(row)).length
  invariant(
    declaredInteger(document, blockingPattern, `${name} blocking issue count`) === blocking,
    `${name} blocking issue metadata does not match its opened table`,
  )
}

export function characterizeExistingAdaptiveGuards({ formation, generator, projection, coachRuleset }) {
  requireMarkers(formation, "formation", [
    "Plan content and `PlanVersionRecord` never mutate.",
    "Missed MAIN with or without a reschedule request",
  ])
  requireMarkers(generator, "generator", ["An athlete may select only an approved `SYSTEM` template"])
  requireMarkers(projection, "projection", ["No projection mutates a plan."])
  requireMarkers(coachRuleset, "coach ruleset", [
    "progression: false",
    "Raw analyzable-note text is also forbidden.",
  ])
  for (const [document, name] of [
    [formation, "formation"],
    [generator, "generator"],
    [projection, "projection"],
    [coachRuleset, "coach ruleset"],
  ]) finalMarkerIsClean(document, name)
  return Object.freeze({ existingGuards: true })
}

export function validateAdaptiveReplanningPolicy({ formation, generator, projection, coachRuleset, design }) {
  characterizeExistingAdaptiveGuards({ formation, generator, projection, coachRuleset })
  samePolicy(parsePolicy(formation, "formation"), "formation")
  samePolicy(parsePolicy(generator, "generator"), "generator")

  requireNormativeMarkers(formation, "formation", [
    "it cannot increase\n  demand or move fixed or already-due work.",
    "CurrentFrameAdjustmentRecord:",
    "Only these triggers may create `PlanAdaptationProposal`:",
    "Only these triggers may create `CurrentFrameAdjustmentRecord`:",
    "cannot be\nrelabelled as `EXPLICIT_REQUEST` or otherwise enter `PlanAdaptationProposal`.",
    "Current-frame adjustment is one target-owned atomic transaction.",
    "the adjustment is neither appended nor applied. D9 `ACTIVE`/`UNKNOWN`, stale safety,\nor an active hold cannot be overridden by a coach or any other actor.",
    "An exact\ncommitted replay returns the prior result without a second append; reuse with a\ndifferent request hash is rejected.",
  ])
  requireNormativeLines(formation, "formation", [
    "`APPLY_CURRENT_FRAME_ADJUSTMENT -> APPLY_CURRENT_FRAME_ADJUSTMENT`, and",
    "trigger: SAME_EVENT_PB_SB_AFTER_ACTIVE_PLAN_START | EXPLICIT_REQUEST",
    "| Accepted race or immovable-anchor change | `NO_ADAPTIVE_PROPOSAL`; use only the owning re-anchor/rebuild contract |",
    "| Provenance invalidation of a required source | `NO_ADAPTIVE_PROPOSAL`; invalidate or block through the owning provenance/hold contract |",
    "| Missing required source that invalidates the remainder | `NO_ADAPTIVE_PROPOSAL`; fail closed through the owning source contract |",
    "| `FA-TC-105` | Current-frame adjustment lacks scoped `APPLY_CURRENT_FRAME_ADJUSTMENT` authorization or capability | Transaction rejects; no adjustment, aggregate event, audit, outbox, or idempotency result is appended |",
    "| `FA-TC-106` | Current-frame adjustment observes D9 `ACTIVE` or `UNKNOWN` at atomic recheck | Transaction rolls back; no adjustment is appended or applied and no coach override exists |",
    "| `FA-TC-107` | Current-frame adjustment presents stale, wrong-target, or wrong-scope safety state/ref | Transaction rolls back without adjustment or payload disclosure |",
    "| `FA-TC-108` | An active hold exists or activates before current-frame adjustment CAS | `expectedActiveHoldState: NONE` fails; no adjustment is appended or applied and the hold remains active |",
    "| `FA-TC-109` | Exact current-frame adjustment request is replayed, or its idempotency key is reused with altered payload | Exact replay returns the durable prior result without a second append; altered request hash is rejected |",
  ])

  const adjustmentRecord = sectionBetween(
    formation,
    "CurrentFrameAdjustmentRecord:",
    "PlanAdaptationDecisionRecord:",
    "CurrentFrameAdjustmentRecord",
  )
  requireNormativeLines(adjustmentRecord, "CurrentFrameAdjustmentRecord", [
    "trigger: RECOVERY_CHANGE | AVAILABILITY_CHANGE",
    "action: MAINTAIN | REDUCE | REST | MOVE_NOT_YET_DUE_FLEXIBLE_WORK",
    "expectedAggregateRevision: integer",
    "expectedSafetyEpoch: integer",
    "adjustmentAuthorizationDecisionRef: FormationAuthorizationDecisionId",
    "freshSafetyBlockRefId: SafetyBlockRefId",
    "expectedActiveHoldState: NONE",
    "createsNextFrameProposal: false",
    "coachOverrideAllowed: false",
    "idempotency: IdempotencyEnvelope",
  ])

  const formationVectors = formation.split(/\r?\n/u).filter((line) => line.startsWith("| `FA-TC-"))
  invariant(
    declaredInteger(formation, /^  contract_vectors_total: (\d+)$/mu, "formation contract vector count")
      === formationVectors.length,
    "formation contract vector metadata does not match its table",
  )

  for (const forbidden of [
    "coach_final_selection_required: true",
    "requiresCoachSelection: true",
    "8_require_atomic_authorization_safety_recheck_and_coach_selection",
    "initialStatus: DRAFT | WAITING_FOR_COACH",
  ]) invariant(!formation.includes(forbidden), `formation retains global coach-only selection: ${forbidden}`)

  requireMarkers(projection, "projection", [
    "NEXT_FRAME_PROPOSAL: nonexecuting_one_dimension_delta",
    "SELF_SELECT_NEXT_FRAME_PROPOSAL: SELF_SERVICE_origin_only_after_fresh_gates",
    "COACH_SELECT_NEXT_FRAME_PROPOSAL: COACH_AUTHORED_origin_only_after_fresh_gates",
    "derived `selectionAuthority`, and at most one delta labeled",
    "`FREQUENCY`. It displays only existing approved before/after values",
  ])
  requireMarkers(coachRuleset, "coach ruleset", [
    "proposal_contract_scope: COACH_AUTHORED_ONLY",
    "`SELF_SERVICE -> SELF` path",
    "Every coach-authored successor is a `NEXT_FRAME` proposal changing at most one",
  ])
  requireMarkers(design, "design", [
    "Active-frame integrity: PB/SB, completion, RPE, attendance, streaks, points, and journal aggregates never rewrite",
    "`SELF_SERVICE` shows athlete selection and `COACH_AUTHORED` shows coach-required review",
    "D9 `ACTIVE`/`UNKNOWN`, stale safety, or an active hold removes selection controls",
  ])

  validateOpenIssueTable(
    formation,
    "FA",
    /^  open_issues_total: (\d+)$/mu,
    /^  canonical_blocking_count: (\d+)$/mu,
    "formation",
  )
  validateOpenIssueTable(
    generator,
    "PG",
    /^  open_issues_total: (\d+)$/mu,
    /^  open_issues_canonical_blocking_count: (\d+)$/mu,
    "generator",
  )
  requireMarkers(formation, "formation", [
    "status: DRAFT_FOR_REVIEW",
    "upload_allowed: false",
    "canonical_promotion_allowed: false",
  ])
  requireMarkers(generator, "generator", [
    "status: DRAFT_FOR_REVIEW",
    "upload_allowed: false",
    "canonical_promotion_allowed: false",
  ])
  requireMarkers(projection, "projection", ["runtime_authority: false"])
  requireMarkers(coachRuleset, "coach ruleset", ["runtime_authority: false", "ruleset_accepted: false"])

  return Object.freeze({
    documentState: "DRAFT_NON_RUNTIME_PREPARED",
    supportedEvents: EXPECTED_POLICY.supportedEvents,
    activeFrameImmutable: true,
    maxChangedDimensions: EXPECTED_POLICY.proposal.maxChangedDimensions,
    authority: EXPECTED_POLICY.proposal.selectionAuthorityByOrigin,
    allIssuesOpen: true,
  })
}

function argumentPath(flag, fallback) {
  const index = process.argv.indexOf(flag)
  if (index < 0) return resolve(root, fallback)
  invariant(process.argv[index + 1] !== undefined, `${flag} requires a path`)
  return resolve(process.argv[index + 1])
}

function readArgument(flag, fallback) {
  return readFileSync(argumentPath(flag, fallback), "utf8")
}

if (process.argv[1] === import.meta.filename) {
  try {
    const summary = validateAdaptiveReplanningPolicy({
      formation: readArgument("--formation", "specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md"),
      generator: readArgument("--generator", "specs/active/PLAN_GENERATOR_SPEC.md"),
      projection: readArgument("--projection", "specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md"),
      coachRuleset: readArgument("--coach-ruleset", "specs/reconstruct/FORMATION_COACH_RULESET_AND_EXPOSURE_CONTRACT.md"),
      design: readArgument("--design", "DESIGN.md"),
    })
    console.log(`adaptive replanning docs: draft/non-runtime/prepared; events=${summary.supportedEvents.join(",")}; maxChangedDimensions=${summary.maxChangedDimensions}; allIssuesOpen=${summary.allIssuesOpen}`)
  } catch (error) {
    console.error(`adaptive replanning policy: invalid: ${error.message}`)
    process.exitCode = 1
  }
}
