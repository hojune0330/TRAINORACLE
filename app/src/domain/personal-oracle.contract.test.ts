import { describe, expect, it } from "vitest"
import { stateFixture } from "./plan-beta-store.test-fixture"
import { derivePersonalOracle } from "./personal-oracle"
import type { StructuredJournalObservation } from "./journal-observation"

function observation(
  id: string,
  loggedOn: string,
  distanceKm: number,
  energySystem: StructuredJournalObservation["energySystem"] = "BASE",
): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId: id,
      sourceVersion: null,
      observedAt: `${loggedOn}T08:00:00.000Z`,
      trustState: "ACCEPTED",
      containsPrivateRawText: false,
    },
    loggedOn,
    energySystem,
    distanceKm,
    durationMin: 40,
    secondsPerKm: null,
    rpe: 4,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      system: "EXPLICIT",
      distanceKm: "EXPLICIT",
      durationMin: "EXPLICIT",
      secondsPerKm: "MISSING",
      rpe: "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("personal oracle explanation contract", () => {
  it("stays explicit about missing evidence instead of inventing a score", () => {
    const result = derivePersonalOracle({ observations: [], today: "2026-08-28", planState: null })

    expect(result.maturity).toBe("EMPTY")
    expect(result.structuredSourceCount).toBe(0)
    expect(result.insights).toHaveLength(3)
    expect(result.insights.map((item) => item.headline).join(" ")).toContain("아직")
    expect(JSON.stringify(result)).not.toMatch(/점|등급|퍼센트|%/u)
  })

  it("describes distance, selected systems, and plan marks without prescribing change", () => {
    const observations = [
      observation("a", "2026-08-04", 8, "BASE"),
      observation("b", "2026-08-10", 9, "BASE"),
      observation("c", "2026-08-18", 7, "LT"),
      observation("d", "2026-08-27", 6, "RECOVERY"),
    ]
    const result = derivePersonalOracle({ observations, today: "2026-08-28", planState: stateFixture() })

    expect(result.maturity).toBe("DESCRIPTIVE")
    expect(result.insights.find((item) => item.id === "DISTANCE_FLOW")?.headline).toBe("최근 4주 30 km")
    expect(result.insights.find((item) => item.id === "ENERGY_COVERAGE")?.headline).toBe("최근 8주 3가지 유형을 기록했어요")
    expect(result.insights.find((item) => item.id === "PLAN_FOLLOW_THROUGH")?.headline).toMatch(/예정 1회/u)
    expect(result.unknowns.join(" ")).toMatch(/자동으로 올리거나 내리지 않습니다/u)
  })

  it("is deterministic and ignores extra raw memo-shaped properties", () => {
    const clean = observation("private-boundary", "2026-08-27", 5, "BASE")
    const withRawText = {
      ...clean,
      memo: "분석하면 안 되는 비밀 메모",
      hasPrivateMemo: true,
    } as StructuredJournalObservation

    const cleanResult = derivePersonalOracle({ observations: [clean], today: "2026-08-28", planState: null })
    const privateResult = derivePersonalOracle({ observations: [withRawText], today: "2026-08-28", planState: null })

    expect(privateResult).toEqual(cleanResult)
    expect(JSON.stringify(privateResult)).not.toContain("분석하면 안 되는 비밀 메모")
  })

  it("does not count unverified imported sessions as oracle evidence", () => {
    const imported = {
      ...observation("imported", "2026-08-27", 10, "VO2"),
      sourceRef: {
        ...observation("imported", "2026-08-27", 10, "VO2").sourceRef,
        trustState: "SOURCE_NOT_VERIFIED" as const,
      },
    }
    const result = derivePersonalOracle({ observations: [imported], today: "2026-08-28", planState: null })

    expect(result.structuredSourceCount).toBe(0)
    expect(result.insights.find((item) => item.id === "DISTANCE_FLOW")?.headline).toContain("아직")
    expect(result.insights.find((item) => item.id === "ENERGY_COVERAGE")?.headline).toContain("아직")
  })

  it("names every jointly most frequent system as a tie", () => {
    const result = derivePersonalOracle({
      observations: [
        observation("base-a", "2026-08-20", 6, "BASE"),
        observation("lt-a", "2026-08-22", 5, "LT"),
        observation("recovery-a", "2026-08-24", 3, "RECOVERY"),
      ],
      today: "2026-08-28",
      planState: null,
    })
    const detail = result.insights.find((item) => item.id === "ENERGY_COVERAGE")?.detail

    expect(detail).toContain("BASE 기초 지구력 · LT 지속 페이스 · REC 회복")
    expect(detail).toContain("모두 1회로 동률")
  })
})
