import type { PaceAnchorRecord } from "@impl/prescription/types"
import type { AthleteRecord } from "./athlete-records"
import {
  elapsedSinceAchieved,
  SEASON_WINDOW_MONTHS,
} from "./athlete-record-display"
import type {
  GoalReferenceEvidenceSnapshot,
  PaceAnchorEvidenceSnapshot,
  PaceSelectionFreshness,
} from "./pace-target-plan"

export function deriveRecordCurrentness(
  record: AthleteRecord,
  evaluatedAt: Date,
): PaceSelectionFreshness {
  const elapsed = elapsedSinceAchieved(record, evaluatedAt)
  if (elapsed === null) return "UNKNOWN"
  return elapsed.months <= SEASON_WINDOW_MONTHS ? "CURRENT" : "STALE"
}

export function toRuntimeAnchor(
  record: AthleteRecord,
  freshnessState: PaceSelectionFreshness,
): PaceAnchorRecord {
  switch (record.purpose) {
    case "PERSONAL_BEST":
      return baseAnchor(record, freshnessState, "PB", "CURRENT_CAPABILITY")
    case "RECENT_RESULT":
      return baseAnchor(record, freshnessState, "RECENT_RESULT", "CURRENT_CAPABILITY")
    case "SEASON_BEST":
      return baseAnchor(record, freshnessState, "SB", "SEASON_CONTEXT")
    case "RACE_GOAL":
      return baseAnchor(record, freshnessState, "GOAL", "ASPIRATIONAL_TARGET")
  }
}

export function toCurrentSnapshot(
  record: AthleteRecord,
  freshness: PaceSelectionFreshness,
  today: Date,
): PaceAnchorEvidenceSnapshot | null {
  if (freshness !== "CURRENT" || record.achievedOn === null) return null
  const elapsedLabel = elapsedSinceAchieved(record, today)?.label
  if (elapsedLabel === undefined) return null

  switch (record.purpose) {
    case "PERSONAL_BEST":
      return snapshot(record, "PB", "CURRENT_CAPABILITY", elapsedLabel)
    case "RECENT_RESULT":
      return snapshot(record, "RECENT_RESULT", "CURRENT_CAPABILITY", elapsedLabel)
    case "SEASON_BEST":
      return snapshot(record, "SB", "SEASON_CONTEXT", elapsedLabel)
  }
}

export function toGoalSnapshot(
  record: Extract<AthleteRecord, { readonly purpose: "RACE_GOAL" }>,
): GoalReferenceEvidenceSnapshot {
  return Object.freeze({
    anchorId: record.id,
    kind: "GOAL",
    purpose: "ASPIRATIONAL_TARGET",
    eventDistanceM: record.eventDistanceM,
    performanceSeconds: record.performanceSeconds,
    enteredBy: record.enteredBy,
    verificationState: record.verificationState,
    freshnessState: "UNKNOWN",
    sourceRef: record.sourceRef,
  })
}

function baseAnchor(
  record: AthleteRecord,
  freshnessState: PaceSelectionFreshness,
  kind: PaceAnchorRecord["kind"],
  purpose: PaceAnchorRecord["purpose"],
): PaceAnchorRecord {
  return Object.freeze({
    anchorId: record.id,
    kind,
    eventDistanceM: record.eventDistanceM,
    performanceSeconds: record.performanceSeconds,
    achievedAt: record.achievedOn,
    seasonId: record.seasonId,
    enteredBy: record.enteredBy,
    sourceRef: record.sourceRef,
    verificationState: record.verificationState,
    freshnessState,
    purpose,
  })
}

function snapshot(
  record: Exclude<AthleteRecord, { readonly purpose: "RACE_GOAL" }>,
  kind: PaceAnchorEvidenceSnapshot["kind"],
  purpose: PaceAnchorEvidenceSnapshot["purpose"],
  elapsedLabel: string,
): PaceAnchorEvidenceSnapshot {
  return Object.freeze({
    anchorId: record.id,
    kind,
    purpose,
    eventDistanceM: record.eventDistanceM,
    performanceSeconds: record.performanceSeconds,
    achievedAt: record.achievedOn,
    seasonId: record.purpose === "SEASON_BEST"
      ? record.achievedOn.slice(0, 4)
      : null,
    enteredBy: record.enteredBy,
    verificationState: record.verificationState,
    freshnessState: "CURRENT",
    sourceRef: record.sourceRef,
    elapsedLabel,
  })
}
