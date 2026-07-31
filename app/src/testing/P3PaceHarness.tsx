import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import type { AthleteRecord } from "../domain/athlete-records"
import { PaceEvidenceFlow } from "../screens/plan-beta/PaceEvidenceFlow"
import "./p3-pace-harness.css"

const RECORDS: readonly AthleteRecord[] = [
  {
    schemaVersion: 1,
    id: "pb-5000-1110",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-05-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5000-1110",
    savedAt: "2026-07-30T00:00:00.000Z",
  },
  {
    schemaVersion: 1,
    id: "goal-5000-1050",
    purpose: "RACE_GOAL",
    eventDistanceM: 5000,
    performanceSeconds: 1050,
    achievedOn: null,
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:goal-5000-1050",
    savedAt: "2026-07-30T00:00:00.000Z",
  },
]

const CLEARED_GATE = decideSafetyGate(mapD9ResultToRveSignal({
  disposition: "D9_CLEARED",
  blocksPlanGeneration: false,
  reasonCodes: ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"],
  evidence: [],
}))

export function P3PaceHarness() {
  return (
    <main className="p3-pace-harness">
      <PaceEvidenceFlow
        records={RECORDS}
        notation="5×1000m @5000m RP · r150″"
        template={{
          lifecycleStatus: "ACTIVE",
          eligibilityStatus: "ELIGIBLE",
        }}
        safetyGate={CLEARED_GATE}
        today={new Date("2026-07-30T12:00:00.000Z")}
      />
    </main>
  )
}
