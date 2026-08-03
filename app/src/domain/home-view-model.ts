import { thisWeekStats } from "./aggregates"
import type { JournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry } from "./safe-export"
import type { PlanBetaState } from "./plan-beta-store"
import { isValidIsoDate } from "./dates"

export type TrainingHomeViewModel = {
  readonly todayMessage: string
  readonly journalSummary: string
  readonly flowSummary: string
  readonly planSummary: string
  readonly analysisSummary: string
  readonly showMinjiPrompt: boolean
}

export function buildTrainingHomeViewModel(
  entries: readonly JournalEntry[],
  analysisEntries: readonly AnalysisJournalEntry[],
  plan: PlanBetaState | null,
  today: string,
): TrainingHomeViewModel {
  const visibleEntries = entries.filter((entry) => isValidIsoDate(entry.date) && entry.date <= today)
  const visibleAnalysis = analysisEntries.filter((entry) => isValidIsoDate(entry.date) && entry.date <= today)
  const todayCount = visibleEntries.filter((entry) => entry.date === today).length
  const journalDays = new Set(visibleEntries.map((entry) => entry.date)).size
  const analysisDays = new Set(visibleAnalysis.map((entry) => entry.date)).size
  const week = thisWeekStats([...visibleAnalysis], today)

  return {
    todayMessage: todayCount === 0
      ? "아직 오늘 기록이 없어요."
      : `오늘 ${todayCount}개의 기록이 있어요.`,
    journalSummary: visibleEntries.length === 0
      ? "아직 기록이 없어요"
      : `${journalDays}일 · ${visibleEntries.length}개의 기록`,
    flowSummary: "9일·10일로 일지 묶어 보기 · 시작일 직접 선택",
    planSummary: plan === null
      ? "저장된 계획 없음 · 계획 후보 만들기"
      : `저장된 계획 · ${plan.activePlan.sessions.length}개 일정`,
    analysisSummary: week.sessions === 0
      ? visibleEntries.length === 0
        ? "기록이 쌓이면 변화를 볼 수 있어요"
        : visibleAnalysis.length === 0
          ? "분석에 쓸 직접 입력 기록이 없어요"
          : "이번 주 직접 입력 기록이 없어요"
      : week.distanceKm > 0
        ? `이번 주 ${week.sessions}회 · ${week.distanceKm}km`
        : `이번 주 ${week.sessions}회 · 입력된 거리 없음`,
    showMinjiPrompt: analysisDays < 7,
  }
}
