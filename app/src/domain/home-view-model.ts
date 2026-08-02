import { thisWeekStats } from "./aggregates"
import type { JournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry } from "./safe-export"
import type { PlanBetaState } from "./plan-beta-store"

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
  const todayCount = entries.filter((entry) => entry.date === today).length
  const journalDays = new Set(entries.map((entry) => entry.date)).size
  const week = thisWeekStats([...analysisEntries], today)

  return {
    todayMessage: todayCount === 0
      ? "아직 오늘 기록이 없어요."
      : `오늘 ${todayCount}개의 기록이 있어요.`,
    journalSummary: entries.length === 0
      ? "아직 기록이 없어요"
      : `${journalDays}일 · ${entries.length}개의 기록`,
    flowSummary: plan === null
      ? "9.5일 기본 틀 · 아직 시작 전"
      : `${plan.activePlan.frame.lengthDays}일 계획 · ${plan.progress.length}/${plan.activePlan.sessions.length}개 일정 확인`,
    planSummary: plan === null
      ? "지금 사용 중인 계획 없음 · 계획 후보 만들기"
      : `지금 사용 중인 계획 · ${plan.activePlan.sessions.length}개 일정`,
    analysisSummary: week.sessions === 0
      ? "기록이 쌓이면 변화를 볼 수 있어요"
      : week.distanceKm > 0
        ? `이번 주 ${week.sessions}회 · ${week.distanceKm}km`
        : `이번 주 ${week.sessions}회 · 입력된 거리 없음`,
    showMinjiPrompt: journalDays < 7,
  }
}
