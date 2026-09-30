import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { parsePrescriptionSequenceV3, type SequenceNodeV3 } from "../../impl/src/prescription/sequence-v3"
import { buildPurposeSupplyCatalog } from "./method-purpose-supply-v3"
import { buildExpandedWorkoutCatalog } from "./expanded-workout-catalog-v3"

// Ignore names and wrapper IDs, but preserve every actual work/rest occurrence.
// This finds geometry overlap, not equivalence of targets, population or effects.
export function mainGeometry(input: unknown): unknown[] {
  const parsed = parsePrescriptionSequenceV3(input)
  if (parsed.kind !== "parsed") throw Error("INVALID_AUDIT_SEQUENCE")
  const result: unknown[] = []
  const walk = (nodes: readonly SequenceNodeV3[]) => {
    for (const node of nodes) {
      for (let i = 0; i < node.repeatCount; i++) {
        if (node.kind === "group") walk(node.children)
        else result.push({ kind: "work", role: node.role, work: node.work })
        if (i < node.repeatCount - 1) result.push(...node.recoveryBetweenRepeats.map(rest => ({ kind: "recovery", ...rest })))
        if (result.length > 10000) throw Error("AUDIT_EXPANSION_LIMIT")
      }
      result.push(...node.recoveryAfter.map(rest => ({ kind: "recovery", ...rest })))
    }
  }
  walk(parsed.sequence.main)
  return result
}

export function auditPrescriptionCatalog() {
  const original = buildPurposeSupplyCatalog(), expanded = buildExpandedWorkoutCatalog()
  const rows = [...original.map(card => ({ id: card.id, family: card.family, sequence: card.sequence,
    missingPersonalPace: card.requires.measuredDistance, terrainReview: false,
    wholeTimeUnknown: card.exactStructure.exactMainSeconds === null && card.family !== "OFF" })),
  ...expanded.map(card => ({ id: card.id, family: card.family, sequence: card.sequence,
    missingPersonalPace: card.segmentContexts.some(part => part.modality === "RUN")
      && JSON.stringify(card.sequence).includes('"kind":"distance"'),
    terrainReview: card.segmentContexts.some(part => part.terrain === "UPHILL" || part.terrain === "ROLLING"),
    wholeTimeUnknown: card.totals.totalSeconds === null }))]
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const geometry = row.sequence ? mainGeometry(row.sequence) : [{ kind: "OFF" }]
    const key = canonicalJsonFingerprint("trainoracle.audit-main-geometry.v1", { family: row.family, geometry })
    groups.set(key, [...(groups.get(key) ?? []), row.id])
  }
  return {
    schemaVersion: 1, reviewedOn: "2026-09-30", recordCount: rows.length,
    distinctMainGeometriesWithinPurpose: groups.size,
    overlappingGroups: [...groups.values()].filter(ids => ids.length > 1),
    distanceTargetReviewIds: rows.filter(row => row.missingPersonalPace).map(row => row.id),
    terrainReviewIds: rows.filter(row => row.terrainReview).map(row => row.id),
    mainTimeUnknownIds: rows.filter(row => row.wholeTimeUnknown).map(row => row.id),
    interpretation: "Geometry overlap is a review flag, not authority to merge records or claim equal effects. Draft cards do not establish individual load suitability.",
    originalRecordsRemoved: 0, runtimeActivationsGrantedByAudit: 0,
  }
}
