import type { PlanSession, PlanSessionSlot } from "./session-types"
import type { SupportedPlanEventDistanceM } from "./types"

export type RacePlacementProjection = 7 | 9 | 10

export const RACE_PLACEMENT_STATES = Object.freeze([
  "NO_TARGET_RACE",
  "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
  "TARGET_RACE_STORED_FOR_LATER",
  "RACE_PLACEMENT_ONLY",
  "GENERIC_PLACEMENT_NO_AUTHORITY",
] as const)

export type RacePlacementState =
  | {
      readonly kind: "NO_TARGET_RACE"
      readonly reasonCode: "NO_TARGET_RACE_REQUESTED"
      readonly numericTaperAuthority: "NOT_GRANTED"
    }
  | {
      readonly kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED"
      readonly reasonCode: "RACE_DATE_RETENTION_NOT_AUTHORIZED"
      readonly eventDistanceM: SupportedPlanEventDistanceM
      readonly projectionH: RacePlacementProjection
      readonly targetRaceDate: string
      readonly placementFallback: "GENERIC_PLACEMENT_NO_AUTHORITY"
      readonly placementReasonCode: "NO_ACTIVE_RACE_PLACEMENT_ROWS"
      readonly numericTaperAuthority: "NOT_GRANTED"
    }
  | {
      readonly kind: "TARGET_RACE_STORED_FOR_LATER"
      readonly reasonCode: "TARGET_OUTSIDE_VISIBLE_PROJECTION"
      readonly eventDistanceM: SupportedPlanEventDistanceM
      readonly projectionH: RacePlacementProjection
      readonly targetRaceDate: string
      readonly numericTaperAuthority: "NOT_GRANTED"
    }
  | {
      readonly kind: "RACE_PLACEMENT_ONLY"
      readonly reasonCode: "EXACT_PLACEMENT_AUTHORITY_APPLIED"
      readonly eventDistanceM: SupportedPlanEventDistanceM
      readonly projectionH: RacePlacementProjection
      readonly targetRaceDate: string
      readonly authorityRowId: string
      readonly numericTaperAuthority: "NOT_GRANTED"
    }
  | {
      readonly kind: "GENERIC_PLACEMENT_NO_AUTHORITY"
      readonly reasonCode:
        | "NO_EXACT_EVENT_PROJECTION_ROW"
        | "POPULATION_TRANSFER_NOT_APPROVED"
        | "PLACEMENT_AUTHORITY_CONFLICT"
      readonly eventDistanceM: SupportedPlanEventDistanceM
      readonly projectionH: RacePlacementProjection
      readonly targetRaceDate: string
      readonly numericTaperAuthority: "NOT_GRANTED"
    }

export type RacePlacementCoordinate = {
  readonly day: number
  readonly slot: PlanSessionSlot
}

export type DormantRacePlacementRow = {
  readonly eventDistanceM: SupportedPlanEventDistanceM
  readonly projectionH: RacePlacementProjection
  readonly fixedCoordinate: RacePlacementCoordinate
  readonly minimumQualitySpacingDays: number
  readonly coordinatePermutation: readonly {
    readonly from: RacePlacementCoordinate
    readonly to: RacePlacementCoordinate
  }[]
}

export type DormantRacePlacementValidation =
  | { readonly kind: "valid" }
  | {
      readonly kind: "invalid"
      readonly code:
        | "EVENT_SCOPE_MISMATCH"
        | "PROJECTION_SCOPE_MISMATCH"
        | "VISIBLE_BOUNDARY_CROSSING"
        | "VISIBLE_COORDINATE_SET_MISMATCH"
        | "FIXED_ANCHOR_MOVED"
        | "QUALITY_SPACING_NOT_AUTHORIZED"
        | "SESSION_CONTENT_CHANGED"
    }

export const COMPILED_RACE_PLACEMENT_ROWS: readonly [] = Object.freeze([])

export function noTargetRacePlacement(): Extract<RacePlacementState, { readonly kind: "NO_TARGET_RACE" }> {
  return Object.freeze({
    kind: "NO_TARGET_RACE",
    reasonCode: "NO_TARGET_RACE_REQUESTED",
    numericTaperAuthority: "NOT_GRANTED",
  })
}

export function previewOnlyRacePlacement(
  eventDistanceM: SupportedPlanEventDistanceM,
  projectionH: RacePlacementProjection,
  targetRaceDate: string,
): Extract<RacePlacementState, { readonly kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED" }> {
  return Object.freeze({
    kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
    reasonCode: "RACE_DATE_RETENTION_NOT_AUTHORIZED",
    eventDistanceM,
    projectionH,
    targetRaceDate,
    placementFallback: "GENERIC_PLACEMENT_NO_AUTHORITY",
    placementReasonCode: "NO_ACTIVE_RACE_PLACEMENT_ROWS",
    numericTaperAuthority: "NOT_GRANTED",
  })
}

function coordinateKey(coordinate: RacePlacementCoordinate): string {
  return `${coordinate.day}:${coordinate.slot}`
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value !== "object") throw new TypeError("Race placement fixture must use JSON data")
  const record = value as Readonly<Record<string, unknown>>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`
}

function sessionContentMultiset(sessions: readonly PlanSession[]): readonly string[] {
  return sessions.map(({ day: _day, slot: _slot, ...content }) => canonicalJson(content)).sort()
}

function qualitySpacingIsAllowed(sessions: readonly PlanSession[], minimumDays: number): boolean {
  const qualityDays = [...new Set(sessions.filter((session) => session.role === "QUALITY").map((session) => session.day))].sort((a, b) => a - b)
  return qualityDays.slice(1).every((day, index) => day - (qualityDays[index] ?? day) >= minimumDays)
}

function moveSession(session: PlanSession, coordinate: RacePlacementCoordinate): PlanSession {
  switch (session.role) {
    case "REST":
    case "EASY":
    case "QUALITY":
      return { ...session, day: coordinate.day, slot: coordinate.slot }
  }
}

export function validateDormantRacePlacementRow(
  row: DormantRacePlacementRow,
  eventDistanceM: SupportedPlanEventDistanceM,
  projectionH: RacePlacementProjection,
  sessions: readonly PlanSession[],
  expectedSessions: readonly PlanSession[] = sessions,
): DormantRacePlacementValidation {
  if (row.eventDistanceM !== eventDistanceM) return { kind: "invalid", code: "EVENT_SCOPE_MISMATCH" }
  if (row.projectionH !== projectionH) return { kind: "invalid", code: "PROJECTION_SCOPE_MISMATCH" }

  const visibleDay = Math.ceil(projectionH)
  const crossing = row.coordinatePermutation.some((entry) => (
    (entry.from.day <= visibleDay) !== (entry.to.day <= visibleDay)
  ))
  if (crossing) return { kind: "invalid", code: "VISIBLE_BOUNDARY_CROSSING" }

  const expectedVisibleCoordinates = sessions
    .filter((session) => session.day <= visibleDay)
    .map(coordinateKey)
    .sort()
  const fromVisibleCoordinates = row.coordinatePermutation
    .filter((entry) => entry.from.day <= visibleDay)
    .map((entry) => coordinateKey(entry.from))
    .sort()
  const toVisibleCoordinates = row.coordinatePermutation
    .filter((entry) => entry.to.day <= visibleDay)
    .map((entry) => coordinateKey(entry.to))
    .sort()
  if (
    JSON.stringify(fromVisibleCoordinates) !== JSON.stringify(expectedVisibleCoordinates)
    || JSON.stringify(toVisibleCoordinates) !== JSON.stringify(expectedVisibleCoordinates)
  ) {
    return { kind: "invalid", code: "VISIBLE_COORDINATE_SET_MISMATCH" }
  }

  const fixedMapping = row.coordinatePermutation.find((entry) => coordinateKey(entry.from) === coordinateKey(row.fixedCoordinate))
  if (fixedMapping === undefined || coordinateKey(fixedMapping.to) !== coordinateKey(row.fixedCoordinate)) {
    return { kind: "invalid", code: "FIXED_ANCHOR_MOVED" }
  }
  const permutationByCoordinate = new Map(row.coordinatePermutation.map((entry) => [coordinateKey(entry.from), entry.to] as const))
  const placedSessions = sessions.map((session) => {
    const destination = permutationByCoordinate.get(coordinateKey(session))
    return destination === undefined ? session : moveSession(session, destination)
  })
  if (!qualitySpacingIsAllowed(placedSessions, row.minimumQualitySpacingDays)) {
    return { kind: "invalid", code: "QUALITY_SPACING_NOT_AUTHORIZED" }
  }
  if (JSON.stringify(sessionContentMultiset(placedSessions)) !== JSON.stringify(sessionContentMultiset(expectedSessions))) {
    return { kind: "invalid", code: "SESSION_CONTENT_CHANGED" }
  }
  return { kind: "valid" }
}
