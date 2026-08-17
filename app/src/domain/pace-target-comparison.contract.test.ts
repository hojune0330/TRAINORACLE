import { describe, expect, it } from "vitest"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import type { AthleteRecord } from "./athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { buildPaceTargetPlanItem } from "./pace-target-plan"

type AchievedRecord = Exclude<AthleteRecord, { readonly purpose: "RACE_GOAL" }>

const TODAY = new Date("2026-07-30T12:00:00.000Z")
const V2_APPROVAL = DETAILED_PRESCRIPTION_APPROVALS.find(
  (approval) => approval.templateId === "V2-SEED-05" && approval.templateVersion === "1.0.0",
)
if (V2_APPROVAL === undefined) throw new TypeError("Trusted V2-SEED-05 approval is missing")
const OPERATIONAL_COMPONENTS = V2_APPROVAL.canonicalTemplateContent.operationalComponents
const ACTIVE_FIXTURE = {
  lifecycleStatus: "ACTIVE" as const,
  eligibilityStatus: "ELIGIBLE" as const,
}
const CLEARED_GATE = decideSafetyGate(mapD9ResultToRveSignal({
  disposition: "D9_CLEARED",
  blocksPlanGeneration: false,
  reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
  evidence: [],
}))

function record(
  purpose: "PERSONAL_BEST" | "SEASON_BEST" | "RECENT_RESULT",
  performanceSeconds: number,
): AchievedRecord {
  const common = {
    schemaVersion: 1 as const,
    id: `${purpose}-${performanceSeconds}`,
    eventDistanceM: 5000,
    performanceSeconds,
    achievedOn: "2026-05-10",
    enteredBy: "ATHLETE" as const,
    verificationState: "SELF_REPORTED" as const,
    sourceRef: `athlete-record:${purpose}-${performanceSeconds}`,
    savedAt: "2026-07-30T00:00:00.000Z",
  }
  return purpose === "SEASON_BEST"
    ? { ...common, purpose: "SEASON_BEST", seasonId: "2026-outdoor" }
    : { ...common, purpose, seasonId: null }
}

describe("P3 comparison sign", () => {
  it.each([
    ["slower", record("PERSONAL_BEST", 930), record("SEASON_BEST", 945), 3],
    ["faster", record("SEASON_BEST", 945), record("PERSONAL_BEST", 930), -3],
    ["equal", record("PERSONAL_BEST", 930), record("RECENT_RESULT", 930), 0],
    ["absent", record("PERSONAL_BEST", 930), null, null],
  ] as const)(
    "uses comparison minus selected for the %s row",
    (_label, selectedRecord, comparisonRecord, expectedDelta) => {
      const result = buildPaceTargetPlanItem({
        selectedRecord,
        selectedFreshness: "CURRENT",
        comparison: comparisonRecord === null
          ? null
          : { record: comparisonRecord, freshness: "CURRENT" },
        goalRecord: null,
        notation: "5×1000m @5000m RP · r150″ JOG",
        displayRoundingPolicyVersion: "seconds-v1",
        template: ACTIVE_FIXTURE,
        safetyGate: CLEARED_GATE,
        operationalComponents: OPERATIONAL_COMPONENTS,
        today: TODAY,
      })

      expect(result).toMatchObject({
        kind: "created",
        item: expectedDelta === null
          ? { comparisonAnchor: null }
          : { comparisonAnchor: { deltaSeconds: expectedDelta } },
      })
    },
  )
})
