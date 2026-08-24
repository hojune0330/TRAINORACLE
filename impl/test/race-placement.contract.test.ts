import { describe, expect, it } from "vitest"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import type { PlanSession } from "../src/plan-generator/types"
import {
  COMPILED_RACE_PLACEMENT_ROWS,
  RACE_PLACEMENT_STATES,
  validateDormantRacePlacementRow,
  type DormantRacePlacementRow,
} from "../src/plan-generator/race-placement"
import { baseRequest, expectGenerated } from "./fixtures/plan-beta-request"

describe("race placement authority boundary", () => {
  it("exposes the complete closed state vocabulary", () => {
    expect(RACE_PLACEMENT_STATES).toEqual([
      "NO_TARGET_RACE",
      "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
      "TARGET_RACE_STORED_FOR_LATER",
      "RACE_PLACEMENT_ONLY",
      "GENERIC_PLACEMENT_NO_AUTHORITY",
    ])
    expect(COMPILED_RACE_PLACEMENT_ROWS).toEqual([])
  })

  it.each([
    [800, 7], [800, 9], [800, 10],
    [1500, 7], [1500, 9], [1500, 10],
    [3000, 7], [3000, 9], [3000, 10],
    [5000, 7], [5000, 9], [5000, 10],
  ] as const)("keeps %im H%i on generic no-authority placement without a target race", (eventDistanceM, projectionH) => {
    const result = expectGenerated(generatePlanCandidates({
      ...baseRequest(),
      requestedFrameLength: projectionH,
      profile: {
        ...baseRequest().profile,
        eventGroup: eventDistanceM === 5000 ? "FIVE_K" : "MIDDLE_DISTANCE",
        eventDistanceM,
      },
    }))

    expect(result.racePlacement).toEqual({
      kind: "NO_TARGET_RACE",
      reasonCode: "NO_TARGET_RACE_REQUESTED",
      numericTaperAuthority: "NOT_GRANTED",
    })
  })

  it("rejects caller-supplied placement authority without creating candidates", () => {
    for (const injected of [
      { racePlacementAuthority: { status: "ACTIVE" } },
      { placementRow: { eventDistanceM: 1500, projectionH: 9 } },
      { numericTaperAuthority: "GRANTED" },
    ]) {
      expect(generatePlanCandidates({ ...baseRequest(), ...injected })).toEqual({
        kind: "rejected",
        code: "MALFORMED_INPUT",
        candidates: [],
        audit: {
          event: "PLAN_BETA_REJECTED",
          codes: ["MALFORMED_INPUT"],
          privacy: "STRUCTURED_CODES_ONLY",
        },
      })
    }
  })

  it("labels generic generation with no target race and no numeric taper authority", () => {
    const result = expectGenerated(generatePlanCandidates(baseRequest()))

    expect(result.racePlacement).toEqual({
      kind: "NO_TARGET_RACE",
      reasonCode: "NO_TARGET_RACE_REQUESTED",
      numericTaperAuthority: "NOT_GRANTED",
    })
  })

  it("keeps a future date in preview memory while retention and placement are unauthorized", () => {
    const result = generatePlanCandidates({
      ...baseRequest(),
      targetRaceDate: "2099-08-23",
    })

    expect(result).toMatchObject({
      kind: "preview_only",
      racePlacement: {
        kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
        reasonCode: "RACE_DATE_RETENTION_NOT_AUTHORIZED",
        placementFallback: "GENERIC_PLACEMENT_NO_AUTHORITY",
        placementReasonCode: "NO_ACTIVE_RACE_PLACEMENT_ROWS",
        numericTaperAuthority: "NOT_GRANTED",
      },
      candidates: [],
    })
  })

  it("validates a dormant coordinate-only fixture without activating it", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const sessions = generated.candidates[0].sessions
    const row: DormantRacePlacementRow = {
      eventDistanceM: 1500,
      projectionH: 9,
      fixedCoordinate: { day: 6, slot: "AM" },
      minimumQualitySpacingDays: 2,
      coordinatePermutation: sessions.map((session) => ({
        from: { day: session.day, slot: session.slot },
        to: { day: session.day, slot: session.slot },
      })),
    }

    const swappedRow: DormantRacePlacementRow = {
      ...row,
      coordinatePermutation: row.coordinatePermutation.map((entry) => {
        if (entry.from.day === 1 && entry.from.slot === "AM") return { ...entry, to: { day: 2, slot: "AM" } }
        if (entry.from.day === 2 && entry.from.slot === "AM") return { ...entry, to: { day: 1, slot: "AM" } }
        return entry
      }),
    }

    expect(validateDormantRacePlacementRow(row, 1500, 9, sessions)).toEqual({ kind: "valid" })
    expect(validateDormantRacePlacementRow(swappedRow, 1500, 9, sessions)).toEqual({ kind: "valid" })
    expect(validateDormantRacePlacementRow(row, 1500, 7, sessions)).toEqual({
      kind: "invalid",
      code: "PROJECTION_SCOPE_MISMATCH",
    })
    expect(validateDormantRacePlacementRow(
      { ...row, eventDistanceM: 800 },
      1500,
      9,
      sessions,
    )).toEqual({ kind: "invalid", code: "EVENT_SCOPE_MISMATCH" })
  })

  it("rejects boundary crossing, coordinate loss, fixed-anchor movement, spacing loss, and content change", () => {
    const generated = expectGenerated(generatePlanCandidates(baseRequest()))
    const sessions = generated.candidates[0].sessions
    const identityPermutation = sessions.map((session) => ({
      from: { day: session.day, slot: session.slot },
      to: { day: session.day, slot: session.slot },
    }))
    const baseRow: DormantRacePlacementRow = {
      eventDistanceM: 1500,
      projectionH: 9,
      fixedCoordinate: { day: 6, slot: "AM" },
      minimumQualitySpacingDays: 2,
      coordinatePermutation: identityPermutation,
    }
    const qualityDays = sessions.filter((session) => session.role === "QUALITY").map((session) => session.day)
    const firstQualityDay = qualityDays[0]
    const secondQualityDay = qualityDays[1]
    if (firstQualityDay === undefined || secondQualityDay === undefined) throw new TypeError("Expected two quality days")
    const adjacentDay = firstQualityDay + 1
    const mutations: readonly [DormantRacePlacementRow, string][] = [
      [{ ...baseRow, coordinatePermutation: identityPermutation.map((entry, index) => index === 0 ? { ...entry, to: { day: 10, slot: entry.to.slot } } : entry) }, "VISIBLE_BOUNDARY_CROSSING"],
      [{ ...baseRow, coordinatePermutation: identityPermutation.slice(1) }, "VISIBLE_COORDINATE_SET_MISMATCH"],
      [{ ...baseRow, coordinatePermutation: identityPermutation.map((entry) => {
        if (entry.from.day === 6 && entry.from.slot === "AM") return { ...entry, to: { day: 8, slot: "AM" } }
        if (entry.from.day === 8 && entry.from.slot === "AM") return { ...entry, to: { day: 6, slot: "AM" } }
        return entry
      }) }, "FIXED_ANCHOR_MOVED"],
      [{ ...baseRow, coordinatePermutation: identityPermutation.map((entry) => {
        if (entry.from.day === secondQualityDay && entry.from.slot === "AM") return { ...entry, to: { day: adjacentDay, slot: "AM" } }
        if (entry.from.day === adjacentDay && entry.from.slot === "AM") return { ...entry, to: { day: secondQualityDay, slot: "AM" } }
        return entry
      }) }, "QUALITY_SPACING_NOT_AUTHORIZED"],
    ]

    for (const [row, code] of mutations) {
      expect(validateDormantRacePlacementRow(row, 1500, 9, sessions)).toEqual({ kind: "invalid", code })
    }

    const firstRpeIndex = sessions.findIndex((session) => session.prescription.kind === "RPE_TIME_RANGE")
    const changedSessions = sessions.map((session, index): PlanSession => {
      if (
        index !== firstRpeIndex
        || session.role === "REST"
        || session.prescription.kind !== "RPE_TIME_RANGE"
      ) return session
      return {
        ...session,
        prescription: {
          ...session.prescription,
          durationMinutes: { minimum: 999, maximum: 999 },
        },
      }
    })
    expect(validateDormantRacePlacementRow(baseRow, 1500, 9, changedSessions, sessions)).toEqual({
      kind: "invalid",
      code: "SESSION_CONTENT_CHANGED",
    })
  })
})
