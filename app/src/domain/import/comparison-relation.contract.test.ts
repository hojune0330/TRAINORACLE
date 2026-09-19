import { describe, expect, it } from "vitest"
import { createPlannedSessionLogDraft } from "../planned-session-link"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { comparisonRelationSchema, confirmComparisonRelationRequestSchema, parseComparisonRelation,
  releaseComparisonRelationRequestSchema, type ComparisonRelationV1 } from "./comparison-relation"

const digest = `sha256:${"a".repeat(64)}`
function relation(): ComparisonRelationV1 {
  const state = stateFixture()
  const link = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, "2026-09-19T01:00:00Z")!.link
  return { schemaVersion: 1, relationId: "10000000-0000-4000-8000-000000000001", journalId: "synthetic-journal",
    journalRevisionAtConfirmation: 7, contentRevisionFingerprint: digest, observationInterpretationFingerprint: digest,
    original: { planFingerprint: digest, session: link }, mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED",
    segmentMappings: [{ planSegmentId: "main/0/0", sourceLapIndex: 0, confirmedKind: "WORK", confirmedTargetUnit: "DISTANCE",
      confirmedDurationMeaning: "TIMER", confirmedRecoveryMode: null }], createdAt: "2026-09-19T01:00:00Z", releasedAt: null }
}
const request = () => ({ action: "confirmComparisonRelation", documentId: "20000000-0000-4000-8000-000000000001",
  operationId: "30000000-0000-4000-8000-000000000001", expectedRevision: 7, relation: relation() })

describe("ComparisonRelationV1 shared contract", () => {
  it("round trips confirmation and release without storing observation or a new plan schema", () => {
    const active = relation()
    expect(parseComparisonRelation(JSON.parse(JSON.stringify(active)))).toEqual(active)
    const released = { ...active, releasedAt: "2026-09-20T01:00:00Z" }
    expect(comparisonRelationSchema.parse(released)).toEqual(released)
    expect(releaseComparisonRelationRequestSchema.safeParse({ action: "releaseComparisonRelation", documentId: request().documentId,
      operationId: request().operationId, expectedRevision: 8, relationId: active.relationId, releasedAt: released.releasedAt }).success).toBe(true)
  })

  it.each(["plannedSessionLink", "rpe", "adaptation", "executionAuthority", "memo", "fileObservation"])("rejects extra %s instead of stripping it", field => {
    expect(parseComparisonRelation({ ...relation(), [field]: "sentinel" })).toBeNull()
    const original = relation().original
    expect(parseComparisonRelation({ ...relation(), original: { ...original, session: { ...original.session, [field]: "sentinel" } } })).toBeNull()
  })

  it.each(["plannedDate", "sessionSlot", "sessionDay", "sessionContentFingerprint", "planVersionId"])("reuses immutable session validation for %s tampering", field => {
    const value = relation()
    const changes = { plannedDate: "2026-09-20", sessionSlot: "PM", sessionDay: 2, sessionContentFingerprint: `sha256:${"b".repeat(64)}`, planVersionId: `sha256:${"c".repeat(64)}` }
    Reflect.set(value.original.session, field, changes[field as keyof typeof changes])
    expect(parseComparisonRelation(value)).toBeNull()
  })

  it("rejects duplicate, absent and oversized mappings and unconfirmed schemas", () => {
    const value = relation(), mapping = value.segmentMappings[0]!
    for (const segmentMappings of [[], [mapping, { ...mapping, planSegmentId: "other" }], [mapping, { ...mapping, sourceLapIndex: 1 }],
      Array.from({ length: 1001 }, (_, i) => ({ ...mapping, planSegmentId: `segment-${i}`, sourceLapIndex: i }))]) {
      expect(parseComparisonRelation({ ...value, segmentMappings })).toBeNull()
    }
    for (const patch of [{ mappingConfirmation: "SUGGESTED" }, { schemaVersion: 2 }, { mappingVersion: 2 },
      { journalRevisionAtConfirmation: 0 }, { journalRevisionAtConfirmation: Number.MAX_SAFE_INTEGER + 1 },
      { releasedAt: "2026-09-18T01:00:00Z" }]) expect(parseComparisonRelation({ ...value, ...patch })).toBeNull()
    expect(parseComparisonRelation({ ...value, segmentMappings: [{ ...mapping, confirmedRecoveryMode: "JOG" }] })).toBeNull()
    expect(parseComparisonRelation({ ...value, segmentMappings: [{ ...mapping, confirmedDurationMeaning: "UNKNOWN" }] })).toBeNull()
  })

  it("requires CAS revision equality only for creation and refuses embedded snapshot payloads", () => {
    expect(confirmComparisonRelationRequestSchema.safeParse(request()).success).toBe(true)
    expect(confirmComparisonRelationRequestSchema.safeParse({ ...request(), expectedRevision: 8 }).success).toBe(false)
    expect(confirmComparisonRelationRequestSchema.safeParse({ ...request(), snapshot: stateFixture() }).success).toBe(false)
    expect(confirmComparisonRelationRequestSchema.safeParse({ ...request(), relation: { ...relation(), releasedAt: "2026-09-20T01:00:00Z" } }).success).toBe(false)
  })
})
