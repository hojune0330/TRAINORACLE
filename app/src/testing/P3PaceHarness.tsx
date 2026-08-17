import React from "react"
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

export function P3PaceHarness() {
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null)
  return (
    <main className="p3-pace-harness">
      <PaceEvidenceFlow
        eventGroup="FIVE_K"
        records={RECORDS}
        selectedRecordId={selectedRecordId}
        comparisonRecordId={null}
        binding={{ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR" }}
        onSelectRecord={setSelectedRecordId}
        onCompareRecord={() => undefined}
        onConfirm={() => undefined}
      />
    </main>
  )
}
