import { createElement } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "../../domain/athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import { InstantPlanTodayView } from "../../components/instant-plan/InstantPlanTodayView"
import { projectInstantExecutionSteps } from "./instant-plan-today"
import { formatTrainingSeconds, prescriptionLabel } from "./labels"
import type { PlanSession } from "@impl/plan-generator/session-types"

type PaceTargetSession = Extract<PlanSession, { readonly role: "QUALITY" }> & {
  readonly prescription: Extract<PlanSession["prescription"], { readonly kind: "PACE_TARGET" }>
}

function isPaceTargetSession(session: PlanSession): session is PaceTargetSession {
  return session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
}

const now = new Date("2026-09-27T03:00:00Z")
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it.each([
  { event: 800, seconds: 121.5, template: "MD-800-01", focus: "GLY_INTENT", work: "200m를 약 30.4초에 10회", rest: "반복 사이 1분 서서 쉬기" },
  { event: 1500, seconds: 245, template: "MD-1500-01", focus: "MIXED_INTENT", work: "500m를 약 1분 21.7초에 3회", rest: "반복 사이 3분 서서 쉬기" },
  { event: 3000, seconds: 611, template: "MD-3000-01", focus: "VO2_INTENT", work: "800m를 약 2분 42.9초에 4회", rest: "반복 사이 3분 걷기" },
  { event: 5000, seconds: 1111, template: "V2-SEED-05", focus: "VO2_INTENT", work: "1000m를 약 3분 42.2초에 5회", rest: "반복 사이 2분 30초 조깅" },
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
    const session = candidate.sessions.find(isPaceTargetSession)
    if (!session) throw Error("Expected PACE_TARGET quality session")
    const before = JSON.stringify(session)
    const steps = projectInstantExecutionSteps(session)
    expect(steps.map(s => s.label)).toEqual(["총 시간", "준비", "본운동", "회복", "정리"])
    const storedMainSessionSeconds = session.prescription.totals.mainSessionTotalExcludingWarmupCooldown
    expect(steps[0]).toMatchObject({ role: "TOTAL_DURATION", label: "총 시간",
      instruction: storedMainSessionSeconds === null
        ? "전체 시간 미정 · 본운동·회복 시간 미정 · 준비·정리 별도"
        : `전체 시간 미정 · 본운동·회복 ${formatTrainingSeconds(storedMainSessionSeconds)} · 준비·정리 별도` })
    expect(steps.find(s => s.label === "본운동")?.instruction).toContain(c.work)
    expect(steps.find(s => s.label === "회복")?.instruction).toBe(c.rest)
    expect(steps.find(s => s.label === "준비")?.instruction).toContain("15분")
    expect(steps.find(s => s.label === "준비")?.instruction).toContain("20초씩 점점 빠르게 4회")
    expect(steps.find(s => s.label === "준비")?.instruction).toContain("40초 걷기·조깅")
    expect(steps.find(s => s.label === "정리")?.instruction).toContain("10분")
    expect(JSON.stringify(session)).toBe(before)
    expect(session.prescription.targetRepSeconds)
      .toBe(c.seconds * session.prescription.repetitionDistanceM / c.event)
  }
})

it("keeps an unknown overall duration visible in compact PACE_TARGET today view", () => {
  const record = createSelfReportedAthleteRecord({ id: "synthetic-pace-compact-unknown", purpose: "RECENT_RESULT",
    eventDistanceM: 1500, performanceSeconds: 245, achievedOn: "2026-09-20", seasonId: null }, now)!
  expect(saveAthleteRecord(record, now).ok).toBe(true)
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(a => a.templateId === "MD-1500-01")!
  const result = generatePlanFromDraft({ eventGroup: "MIDDLE_DISTANCE", eventDistanceM: 1500,
    competitionDivision: "HIGH_SCHOOL", experienceBand: "EXPERIENCED", availableDayCount: 5,
    requestedFrameLength: 9, trainingFocus: "MIXED_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "VARIES", selectedDetailedTemplateRef: { templateId: approval.templateId,
      version: approval.templateVersion, fingerprint: approval.templateContentFingerprint } }, "NO_KNOWN_RISK", { selectedRecordId: record.id })
  if (result.kind !== "generated") throw Error("Expected generated fixture")
  const plannedSession = result.generated.candidates[0]?.sessions.find(isPaceTargetSession)
  if (!plannedSession) throw Error("Expected PACE_TARGET quality fixture")
  const session = { ...plannedSession, prescription: { ...plannedSession.prescription,
    totals: { ...plannedSession.prescription.totals, mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: [...new Set([...plannedSession.prescription.totals.uncomputableReasonCodes,
        "WORK_DURATION_UNAVAILABLE" as const])] } } }
  const today = { dateLabel: "2026-09-27", state: "SCHEDULED" as const, title: "오늘 훈련", sessions: [{
    id: "1:AM", slotLabel: "오전", title: "반복 훈련", recorded: false, steps: projectInstantExecutionSteps(session),
  }] }

  render(createElement(InstantPlanTodayView, { compact: true, today }))
  expect(screen.getByText("전체 시간 미정 · 본운동·회복 시간 미정 · 준비·정리 별도")).toBeVisible()
})

it("does not display duplicate endpoints as 35~35 minutes", () => {
  expect(prescriptionLabel({ day: 1, slot: "AM", role: "EASY", plannedEnergyIntent: "BASE_INTENT",
    prescription: { kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 35, maximum: 35 }, rpe: { minimum: 3, maximum: 4 } } }))
    .toBe("전체 35min @ RPE 3–4")
})
