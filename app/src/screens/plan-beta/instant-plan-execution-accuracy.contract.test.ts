import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "../../domain/athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { prescriptionLabel } from "./labels"

const now = new Date("2026-09-27T03:00:00Z")
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it.each([
  { event: 800, seconds: 121.5, template: "MD-800-01", focus: "GLY_INTENT", work: "200m를 약 30초에 10회", rest: "반복 사이 1분 서서 쉬기" },
  { event: 1500, seconds: 245, template: "MD-1500-01", focus: "MIXED_INTENT", work: "500m를 약 1분 22초에 3회", rest: "반복 사이 3분 서서 쉬기" },
  { event: 3000, seconds: 611, template: "MD-3000-01", focus: "VO2_INTENT", work: "800m를 약 2분 43초에 4회", rest: "반복 사이 3분 걷기" },
  { event: 5000, seconds: 1111, template: "V2-SEED-05", focus: "VO2_INTENT", work: "1000m를 약 3분 42초에 5회", rest: "반복 사이 2분 30초 조깅" },
] as const)("projects the actual $event prescription without modifying dose or unrounded targets", c => {
  const record = createSelfReportedAthleteRecord({ id: `synthetic-${c.event}`, purpose: "RECENT_RESULT",
    eventDistanceM: c.event, performanceSeconds: c.seconds, achievedOn: "2026-09-20", seasonId: null }, now)!
  expect(saveAthleteRecord(record, now).ok).toBe(true)
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(a => a.templateId === c.template)!
  const result = generatePlanFromDraft({ eventGroup: c.event === 5000 ? "FIVE_K" : "MIDDLE_DISTANCE",
    eventDistanceM: c.event, competitionDivision: "HIGH_SCHOOL", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus: c.focus, secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "VARIES", selectedDetailedTemplateRef: { templateId: approval.templateId,
      version: approval.templateVersion, fingerprint: approval.templateContentFingerprint } }, "NO_KNOWN_RISK", { selectedRecordId: record.id })
  if (result.kind !== "generated") throw Error("Expected generated fixture")
  expect(result.prescriptionBinding.kind).toBe("bound")
  for (const candidate of result.generated.candidates) {
    const session = candidate.sessions.find(s => s.prescription.kind === "PACE_TARGET")!
    expect(session).toBeDefined()
    const before = JSON.stringify(session)
    const steps = projectInstantExecutionSteps(session)
    expect(steps.map(s => s.label)).toEqual(["준비", "본운동", "회복", "정리"])
    expect(steps.find(s => s.label === "본운동")?.instruction).toContain(c.work)
    expect(steps.find(s => s.label === "회복")?.instruction).toBe(c.rest)
    expect(steps[0]?.instruction).toContain("15분")
    expect(steps[0]?.instruction).toContain("20초씩 점점 빠르게 4회")
    expect(steps[0]?.instruction).toContain("40초 걷기·조깅")
    expect(steps.at(-1)?.instruction).toContain("10분")
    expect(JSON.stringify(session)).toBe(before)
    if (session.prescription.kind === "PACE_TARGET") expect(session.prescription.targetRepSeconds)
      .toBe(c.seconds * session.prescription.repetitionDistanceM / c.event)
  }
})

it("does not display duplicate endpoints as 35~35 minutes", () => {
  expect(prescriptionLabel({ day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 35, maximum: 35 }, rpe: { minimum: 3, maximum: 4 } } }))
    .toContain("총 35분 · RPE 3~4")
})
