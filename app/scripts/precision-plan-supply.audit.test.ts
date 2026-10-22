import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { initializeCanonicalJournalFixture } from "../src/test/canonical-journal-fixture"
import { reviewInitialMainConditions } from "../src/domain/initial-main-conditions"
import { planPrescriptionSupply } from "../src/domain/plan-prescription-supply"
import { generatePlanFromDraft } from "../src/domain/plan-beta-flow"
import { setActiveLocalAccount } from "../src/domain/account/local-journal-ownership"
import type { PlanBetaIntake } from "../src/domain/plan-beta-store"

const eventDistances = [800, 1500, 3000, 5000, 10000, 21097, 42195] as const
const experiences = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const
const focuses = ["BASE_INTENT", "RECOVERY_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT"] as const
const startDate = "2026-10-23"

function eventGroupFor(distance: number): PlanBetaIntake["eventGroup"] {
  if (distance <= 3000) return "MIDDLE_DISTANCE"
  if (distance === 5000) return "FIVE_K"
  if (distance === 10000) return "TEN_K"
  return "GENERAL_ENDURANCE"
}

describe("opt-in generated prescription-supply coverage audit", () => {
  beforeAll(async () => {
    localStorage.clear()
    sessionStorage.clear()
    setActiveLocalAccount(null)
    await initializeCanonicalJournalFixture()
  })

  it("writes a reproducible synthetic report without saving or activating a plan", () => {
    const scenarios: Record<string, unknown>[] = []
    const outcomes: Record<string, number> = { generated: 0, preview_only: 0, rejected: 0 }
    const flagCounts: Record<string, number> = {}
    let generatedSlotRows = 0
    let candidatePreviewCatalogBoundSlots = 0

    for (const eventDistanceM of eventDistances) {
      for (const experienceBand of experiences) {
        for (const trainingFocus of focuses) {
          const result = generatePlanFromDraft({
            eventGroup: eventGroupFor(eventDistanceM),
            eventDistanceM,
            competitionDivision: "NOT_PROVIDED",
            experienceBand,
            availableDayCount: 5,
            requestedFrameLength: 9,
            trainingFocus,
            secondSessionMode: "SINGLE_SESSION_ONLY",
            trainingTimePreference: "VARIES",
            selectedDetailedTemplateRef: null,
            startDate,
          }, "NO_KNOWN_RISK")

          if (result.kind !== "generated") {
            outcomes.rejected = (outcomes.rejected ?? 0) + 1
            scenarios.push({ eventDistanceM, experienceBand, trainingFocus, outcome: "rejected", code: result.code })
            continue
          }
          outcomes.generated = (outcomes.generated ?? 0) + 1

          const initialReview = reviewInitialMainConditions({
            generated: result.generated,
            intake: result.intake,
            gate: result.gate,
            context: { mode: "newplan", startDate, accountScope: null, revision: 1 },
          })
          const candidates = result.generated.candidates.map(candidate => {
            const visibleSessions = candidate.sessions.filter(session => session.day <= Math.ceil(candidate.frame.projectionLengthDays ?? candidate.frame.lengthDays))
            const supply = planPrescriptionSupply(visibleSessions, {
              initialReview: initialReview ?? undefined,
            })
            generatedSlotRows += supply.length
            for (const row of supply) {
              for (const flag of row.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1
              if (row.flags.length === 1 && row.flags[0] === "detailed_applied") candidatePreviewCatalogBoundSlots += 1
            }
            return {
              candidateKind: candidate.kind,
              qualitySlotCount: supply.length,
              states: supply.map(({ day, slot, flags }) => ({ day, slot, flags })),
            }
          })
          scenarios.push({ eventDistanceM, experienceBand, trainingFocus, outcome: "generated",
            initialMainReview: initialReview === null ? "unavailable" : "available", candidates })
        }
      }
    }

    const report = {
      schemaVersion: 2,
      date: startDate,
      mode: "synthetic_read_only_candidate_preview_coverage",
      interpretation: {
        generatedCandidatesArePreviewOnly: true,
        plansSaved: false,
        plansActivated: false,
        catalogBoundCountIsCandidateSlotRowsAcrossAlternatives: true,
        catalogBoundValidation: "calculator fingerprints and resolved catalog binding required by planPrescriptionSupply",
        flagCountsMayOverlap: true,
      },
      inputContext: {
        scenariosExpected: eventDistances.length * experiences.length * focuses.length,
        eventDistancesM: eventDistances,
        experiences,
        focusValues: focuses,
        hasAthleteRecord: false,
        selectedDetailedTemplateRef: null,
        confirmedEnvironmentRequirements: [],
        currentCheck: "NO_KNOWN_RISK",
        startDate,
        availableDayCount: 5,
        requestedFrameLength: 9,
        secondSessionMode: "SINGLE_SESSION_ONLY",
        trainingTimePreference: "VARIES",
        mutation: false,
      },
      outcomes: { ...outcomes, preview_only: 0 },
      candidatePreviewCatalogBoundSlots,
      flagCounts,
      generatedSlotRows,
      scenarios,
    }
    const reportPath = resolve(process.cwd(), "../reports/review/PRECISION_PLAN_SUPPLY_2026-10-23.json")
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

    expect(outcomes.generated + outcomes.rejected).toBe(147)
    expect(outcomes.rejected).toBe(0)
    expect(flagCounts.detailed_applied).toBe(candidatePreviewCatalogBoundSlots)
    expect(generatedSlotRows).toBeGreaterThan(0)
  })
})
