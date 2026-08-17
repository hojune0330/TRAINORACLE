import { thisWeekStats } from "./aggregates"
import type { JournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry } from "./safe-export"
import type { PlanBetaState } from "./plan-beta-store"
import type { VersionedStoredPlanSession } from "./plan-session-schema"
import { isoShift, isValidIsoDate } from "./dates"

export type NextTraining = {
  readonly date: string
  readonly session: Exclude<VersionedStoredPlanSession, { readonly role: "REST" }>
  readonly laterSameDaySession: Exclude<VersionedStoredPlanSession, { readonly role: "REST" }> | null
}

export type TrainingHomeViewModel = {
  readonly todayMessage: string
  readonly journalSummary: string
  readonly flowSummary: string
  readonly planSummary: string
  readonly analysisSummary: string
  readonly showMinjiPrompt: boolean
  readonly nextTraining: NextTraining | null
  /** 오늘(또는 어제) 수면·심박·체중·통증 한 줄 요약. 값이 없으면 빈 문자열 — 거짓 브리핑 금지(WORK_ORDER_UX2 §2-1). */
  readonly briefing: string
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
  const briefing = buildBriefing(visibleAnalysis, today)

  return {
    todayMessage: todayCount === 0
      ? "아직 오늘 기록이 없어요."
      : `오늘 ${todayCount}개의 기록이 있어요.`,
    journalSummary: visibleEntries.length === 0
      ? "아직 기록이 없어요"
      : `${journalDays}일 · ${visibleEntries.length}개의 기록`,
    flowSummary: "9.5일 주기로 일지 묶어 보기 · 시작일 직접 선택",
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
    nextTraining: nextTrainingFor(plan, today),
    briefing,
  }
}

function nextTrainingFor(plan: PlanBetaState | null, today: string): NextTraining | null {
  const startDate = plan?.intake.startDate
  if (plan === null || startDate === undefined || !isValidIsoDate(startDate)) return null

  const planned = plan.activePlan.sessions
    .flatMap((session) => session.role === "REST"
      ? []
      : [{ date: isoShift(startDate, session.day - 1), session }])
    .filter((entry) => entry.date >= today)
    .sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date)
      if (dateOrder !== 0) return dateOrder
      return left.session.slot.localeCompare(right.session.slot)
    })

  const next = planned[0]
  if (next === undefined) return null
  const laterSameDaySession = planned.find(
    (entry, index) => index > 0 && entry.date === next.date,
  )?.session ?? null
  return { ...next, laterSameDaySession }
}

/**
 * 오늘(또는 어제) 하루 마무리 기록에서 수면·심박·체중·통증을 한 줄로 요약한다.
 *
 * 정직성 원칙(WORK_ORDER_UX2 §2-1): 값이 없는 항목은 렌더링하지 않는다.
 * 어제 기록이 최신이면 그 날짜를 함께 보여준다(어제로 오해하지 않도록).
 * 하루 마무리 기록이 전혀 없으면 빈 문자열 — 홈에서 아무것도 렌더링하지 않는다.
 */
function buildBriefing(
  analysis: readonly AnalysisJournalEntry[],
  today: string,
): string {
  const evening = [...analysis]
    .filter((entry): entry is Extract<AnalysisJournalEntry, { kind: "evening" }> => entry.kind === "evening")
    .filter((entry) => entry.date === today || entry.date === isoShift(today, -1))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  if (evening === undefined) return ""

  const parts: string[] = []
  if (evening.sleepH > 0) parts.push(`수면 ${evening.sleepH}h`)
  if (evening.restingHr.trim() !== "") parts.push(`심박 ${evening.restingHr}bpm`)
  if (evening.weightKg.trim() !== "") parts.push(`체중 ${evening.weightKg}kg`)
  const painParts = Object.entries(evening.painParts)
    .filter(([, level]) => level > 0)
    .map(([part, level]) => `${part} ${level}`)
  if (painParts.length > 0) parts.push(`통증 ${painParts.join(", ")}`)
  if (parts.length === 0) return ""

  const where = evening.date === today ? "오늘" : "어제"
  return `${where} 기록 · ${parts.join(" · ")}`
}
