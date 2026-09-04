import { describe, expect, it } from "vitest"
import type { StructuredJournalObservation } from "./journal-observation"
import {
  buildEnergySystemLedger,
  energyLedgerWindow,
  summarizeCurrentPlanEnergy,
} from "./energy-system-ledger"
import type { EnergySystemKey } from "./energy-system-taxonomy"
import { stateFixture } from "./plan-beta-store.test-fixture"

function observation({
  sourceId,
  loggedOn = "2026-08-20",
  energySystem = "BASE",
  systemProvenance = "EXPLICIT",
  durationMin = 40,
  distanceKm = 8,
  rpe = 4,
  trustState = "ACCEPTED",
}: {
  readonly sourceId: string
  readonly loggedOn?: string
  readonly energySystem?: EnergySystemKey | null
  readonly systemProvenance?: StructuredJournalObservation["fieldProvenance"]["system"]
  readonly durationMin?: number | null
  readonly distanceKm?: number | null
  readonly rpe?: number | null
  readonly trustState?: StructuredJournalObservation["sourceRef"]["trustState"]
}): StructuredJournalObservation {
  return {
    sourceRef: {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId,
      sourceVersion: null,
      observedAt: `${loggedOn}T08:00:00.000Z`,
      trustState,
      containsPrivateRawText: false,
    },
    loggedOn,
    energySystem,
    distanceKm,
    durationMin,
    secondsPerKm: null,
    rpe,
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      system: systemProvenance,
      distanceKm: distanceKm === null ? "MISSING" : "EXPLICIT",
      durationMin: durationMin === null ? "MISSING" : "EXPLICIT",
      secondsPerKm: "MISSING",
      rpe: rpe === null ? "MISSING" : "EXPLICIT",
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: [],
  }
}

describe("energy system ledger contract", () => {
  const window = energyLedgerWindow("RECENT_4_WEEKS", "2026-08-28")

  it("aggregates only explicitly classified journal sessions without turning missing into BASE", () => {
    const ledger = buildEnergySystemLedger([
      observation({ sourceId: "base" }),
      observation({ sourceId: "lt", energySystem: "LT", durationMin: 30, distanceKm: 6, rpe: 6 }),
      observation({ sourceId: "legacy-default", energySystem: "BASE", systemProvenance: "LEGACY_MISSING_PROVENANCE" }),
      observation({ sourceId: "unselected", energySystem: null, systemProvenance: "MISSING" }),
    ], window)

    expect(ledger.rows.find((row) => row.key === "BASE")).toMatchObject({
      journalSessionCount: 1,
      durationMinutes: 40,
      distanceKm: 8,
      meanRpe: 4,
    })
    expect(ledger.rows.find((row) => row.key === "LT")).toMatchObject({
      journalSessionCount: 1,
      durationMinutes: 30,
      distanceKm: 6,
      meanRpe: 6,
    })
    expect(ledger.includedSourceCount).toBe(2)
    expect(ledger.excludedSourceCount).toBe(2)
    expect(ledger.coverage).toBe("PARTIAL")
  })

  it("keeps a mixed session unallocated instead of splitting it across named systems", () => {
    const ledger = buildEnergySystemLedger([
      observation({ sourceId: "mixed", energySystem: "MIXED_UNALLOCATED", durationMin: 75 }),
    ], window)

    expect(ledger.rows.find((row) => row.key === "MIXED_UNALLOCATED")?.journalSessionCount).toBe(1)
    expect(ledger.rows.filter((row) => row.key !== "MIXED_UNALLOCATED")
      .every((row) => row.journalSessionCount === 0)).toBe(true)
  })

  it("counts identical copies once and rejects a same-id duration conflict", () => {
    const same = observation({ sourceId: "same", energySystem: "VO2", durationMin: 24 })
    const ledger = buildEnergySystemLedger([
      same,
      same,
      observation({ sourceId: "conflict", energySystem: "LT", durationMin: 30 }),
      observation({ sourceId: "conflict", energySystem: "LT", durationMin: 31 }),
    ], window)

    expect(ledger.rows.find((row) => row.key === "VO2")?.journalSessionCount).toBe(1)
    expect(ledger.rows.find((row) => row.key === "LT")?.journalSessionCount).toBe(0)
    expect(ledger.duplicateSourceCount).toBe(1)
    expect(ledger.conflictingSourceCount).toBe(1)
    expect(ledger.reasonCodes).toContain("IDENTICAL_DUPLICATE_SOURCE")
    expect(ledger.reasonCodes).toContain("CONFLICTING_SOURCE_ID")
  })

  it("scopes duplicate conflict evaluation to the requested reporting window", () => {
    const ledger = buildEnergySystemLedger([
      observation({ sourceId: "cross-window", loggedOn: "2026-07-01", energySystem: "LT", durationMin: 20 }),
      observation({ sourceId: "cross-window", loggedOn: "2026-08-20", energySystem: "LT", durationMin: 30 }),
    ], window)

    expect(ledger.rows.find((row) => row.key === "LT")?.journalSessionCount).toBe(1)
    expect(ledger.reasonCodes).not.toContain("CONFLICTING_SOURCE_ID")
  })

  it("keeps planned sessions, completion marks, and journal results as separate facts", () => {
    const fixture = stateFixture()
    const state = {
      ...fixture,
      activePlan: {
        ...fixture.activePlan,
        sessions: [
          ...fixture.activePlan.sessions,
          {
            day: 2,
            slot: "AM" as const,
            role: "REST" as const,
            plannedEnergyIntent: "RECOVERY_INTENT" as const,
            prescription: { kind: "REST" as const },
          },
        ],
      },
      progress: [
        { sessionDay: 1, sessionSlot: "AM" as const, state: "COMPLETED" as const },
        { sessionDay: 2, sessionSlot: "AM" as const, state: "RESTED" as const },
      ],
    }
    const summary = summarizeCurrentPlanEnergy(state)

    expect(summary?.rows.find((row) => row.key === "BASE")).toMatchObject({
      plannedSessionCount: 1,
      completedMarkCount: 1,
    })
    expect(summary?.rows.find((row) => row.key === "RECOVERY")).toMatchObject({
      plannedSessionCount: 0,
      completedMarkCount: 0,
    })
    expect(summary?.excludedRestDayCount).toBe(1)
  })

  it("builds inclusive 4, 8, 24 week and year-to-date windows", () => {
    expect(energyLedgerWindow("RECENT_4_WEEKS", "2026-08-28").startDate).toBe("2026-08-01")
    expect(energyLedgerWindow("RECENT_8_WEEKS", "2026-08-28").startDate).toBe("2026-07-04")
    expect(energyLedgerWindow("RECENT_24_WEEKS", "2026-08-28").startDate).toBe("2026-03-14")
    expect(energyLedgerWindow("YEAR_TO_DATE", "2026-08-28").startDate).toBe("2026-01-01")
  })
})
