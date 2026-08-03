import { describe, expect, it } from "vitest"
import { buildTrainingHomeViewModel } from "./home-view-model"
import type { JournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry } from "./safe-export"

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
    expect(model.flowSummary).toBe("9일·10일로 일지 묶어 보기 · 시작일 직접 선택")
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
