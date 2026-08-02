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

    expect(model.planSummary).toContain("지금 사용 중인 계획 없음")
    expect(model.analysisSummary).toContain("기록이 쌓이면")
    expect(model.flowSummary).toContain("아직 시작 전")
  })
})
