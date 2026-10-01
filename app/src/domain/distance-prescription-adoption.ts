import artifact from "./distance-prescription-adoption.json" with { type: "json" }
import type { DetailedTemplateRef } from "@impl/plan-generator/types"

export const DISTANCE_ADOPTION = artifact
export const DISTANCE_ADOPTION_ACTIVE = artifact.status === "OWNER_ADOPTED"

export function distanceAdoptionRecord(reference: DetailedTemplateRef) {
  return artifact.records.find(item => item.templateRef.templateId === reference.templateId
    && item.templateRef.version === reference.version && item.templateRef.fingerprint === reference.fingerprint) ?? null
}

/** This bounds new adopted configurations only; it cannot grant template authority. */
export function distancePrescriptionFits(reference: DetailedTemplateRef, targetRepSeconds: number,
  qualityDistanceM: number, totalSeconds: number, availableMinutes?: number | null): boolean {
  const record = distanceAdoptionRecord(reference)
  if (record === null) return true
  const limits = record.parameterLimits
  return Number.isFinite(targetRepSeconds) && targetRepSeconds >= limits.minimumRepSeconds
    && targetRepSeconds <= limits.maximumRepSeconds
    && Number.isFinite(qualityDistanceM) && qualityDistanceM > 0 && qualityDistanceM <= limits.maximumQualityDistanceM
    && Number.isFinite(totalSeconds) && totalSeconds > 0
    && (availableMinutes == null || totalSeconds <= availableMinutes * 60)
}
