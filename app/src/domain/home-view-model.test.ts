import { describe, expect, it } from "vitest"
import { buildTrainingHomeViewModel } from "./home-view-model"
import type { JournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry } from "./safe-export"
import type { PlanBetaState } from "./plan-beta-store"

const entry: JournalEntry = {
  id: "home-1",
  kind: "post-session",
  date: "2026-08-03",
  savedAt: "2026-08-03T09:00:00.000Z",
  syncState: "local",
  system: "base",
  title: "가벼운 달리기",
  distanceKm: "5",
  durationMin: "30",
  avgPace: "6:00",
  rpe: 4,
  memo: "화면 요약에 나오면 안 되는 개인 메모",
  memoPurpose: "PRIVATE_SELF_ONLY",
}

const analysisEntry: AnalysisJournalEntry = {
  id: entry.id,
  kind: entry.kind,
  date: entry.date,
  savedAt: entry.savedAt,
  syncState: "local",
  system: entry.system,
  title: entry.title,
  distanceKm: entry.distanceKm,
  durationMin: entry.durationMin,
  avgPace: entry.avgPace,
  rpe: entry.rpe,
}

const activePlan = {
  version: 1,
  intake: {
    eventGroup: "MIDDLE_DISTANCE",
    experienceBand: "DEVELOPING",
    availableDayCount: 3,
    requestedFrameLength: 9,
    trainingFocus: "LT_INTENT",
    secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "EVENING",
    startDate: "2026-08-17",
  },
  activePlan: {
    kind: "BETA_ACTIVE_PLAN_SNAPSHOT",
    activationState: "SELECTED_BETA_SNAPSHOT",
    candidateId: "home-next-session",
    candidateKind: "BALANCED",
    selectionActor: "SELF",
    sourceMode: "PROFILE_ONLY",
    selectedEnergyIntent: "LT_INTENT",
    frame: {
      formationKind: "LOCAL_CIVIL_9_5",
      lengthDays: 9.5,
      slotCount: 19,
      continuity: { kind: "STANDARD_FRAME" },
    },
    sessions: [
      {
        day: 1,
        slot: "AM",
        role: "REST",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: { kind: "REST" },
      },
      {
        day: 2,
        slot: "PM",
        role: "QUALITY",
        plannedEnergyIntent: "LT_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 5, maximum: 6 },
          durationMinutes: { minimum: 25, maximum: 40 },
        },
      },
    ],
  },
  progress: [],
  generatedAt: "2026-08-17T09:00:00.000Z",
} satisfies PlanBetaState

describe("training home view model", () => {
  it("summarizes entry shells and safe analysis without exposing memo text", () => {
    const model = buildTrainingHomeViewModel([entry], [analysisEntry], null, "2026-08-03")

    expect(model.todayMessage).toBe("오늘 1개의 기록이 있어요.")
    expect(model.journalSummary).toBe("1일 · 1개의 기록")
    expect(model.analysisSummary).toContain("5km")
    expect(JSON.stringify(model)).not.toContain(entry.memo)
  })

  it("does not invent a plan or analysis when there is no evidence", () => {
    const model = buildTrainingHomeViewModel([], [], null, "2026-08-03")

    expect(model.planSummary).toBe("저장된 계획 없음 · 계획 후보 만들기")
    expect(model.analysisSummary).toContain("기록이 쌓이면")
    expect(model.flowSummary).toBe("9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택")
  })

  it("shows the next saved training without inventing a pace or a plan", () => {
    // Given
    const today = "2026-08-18"

    // When
    const model = buildTrainingHomeViewModel([], [], activePlan, today)

    // Then
    expect(model.nextTraining).toMatchObject({
      date: today,
      session: {
        slot: "PM",
        role: "QUALITY",
        plannedEnergyIntent: "LT_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 5, maximum: 6 },
          durationMinutes: { minimum: 25, maximum: 40 },
        },
      },
    })
  })

  it("does not invent a next training when an older saved plan has no start date", () => {
    // Given
    const { startDate: _startDate, ...intakeWithoutStartDate } = activePlan.intake
    const legacyPlan = {
      ...activePlan,
      intake: intakeWithoutStartDate,
    } satisfies PlanBetaState

    // When
    const model = buildTrainingHomeViewModel([], [], legacyPlan, "2026-08-18")

    // Then
    expect(model.nextTraining).toBeNull()
  })

  it("leaves the briefing empty when there is no evening check-in", () => {
    const model = buildTrainingHomeViewModel([entry], [analysisEntry], null, "2026-08-03")

    expect(model.briefing).toBe("")
  })

  it("summarizes the latest evening check-in without inventing missing fields", () => {
    const eveningEntry: JournalEntry = {
      ...entry,
      id: "home-evening",
      kind: "evening",
      sleepH: 7.5,
      sleepQuality: 4,
      weightKg: "62.0",
      restingHr: "49",
      painParts: { "오른 무릎": 2 },
      mood: 4,
      note: "",
    }
    const model = buildTrainingHomeViewModel([eveningEntry], [eveningEntry], null, "2026-08-03")

    expect(model.briefing).toContain("수면 7.5h")
    expect(model.briefing).toContain("심박 49bpm")
    expect(model.briefing).toContain("체중 62.0kg")
    expect(model.briefing).toContain("통증 오른 무릎 2")
    expect(JSON.stringify(model)).not.toContain(entry.memo)
  })

  it("uses yesterday's check-in with an explicit date marker when today has none", () => {
    const yesterdayEvening: JournalEntry = {
      ...entry,
      id: "home-evening-yesterday",
      kind: "evening",
      date: "2026-08-02",
      sleepH: 6.5,
      sleepQuality: 3,
      weightKg: "",
      restingHr: "",
      painParts: {},
      mood: 0,
      note: "",
    }
    const model = buildTrainingHomeViewModel([], [yesterdayEvening], null, "2026-08-03")

    expect(model.briefing).toContain("어제 기록")
    expect(model.briefing).toContain("수면 6.5h")
    expect(model.briefing).not.toContain("심박")
    expect(model.briefing).not.toContain("체중")
  })

  it("distinguishes imported journal rows from analysis-ready direct input", () => {
    const importedEntries = Array.from({ length: 7 }, (_, index) => ({
      ...entry,
      id: `imported-${index}`,
      date: `2026-07-${String(20 + index).padStart(2, "0")}`,
      fieldProvenance: {
        distanceKm: {
          provenance: "DERIVED",
          derivedFrom: ["import:activity-file"],
          derivationRuleId: "import.activity-file.v1",
        },
      },
    } satisfies JournalEntry))

    const model = buildTrainingHomeViewModel(importedEntries, [], null, "2026-08-03")

    expect(model.analysisSummary).toBe("분석에 쓸 직접 입력 기록이 없어요")
    expect(model.showMinjiPrompt).toBe(true)
  })

  it("does not claim all direct input is missing when it only falls outside this week", () => {
    const olderEntry = { ...entry, date: "2026-07-01" }
    const olderAnalysis = { ...analysisEntry, date: "2026-07-01" }

    const model = buildTrainingHomeViewModel([olderEntry], [olderAnalysis], null, "2026-08-03")

    expect(model.analysisSummary).toBe("이번 주 직접 입력 기록이 없어요")
  })
})
