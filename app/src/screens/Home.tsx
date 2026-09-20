import React from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, accountPlansEnabled } from "../domain/account/account-plan-service"
import { TermHelp } from "../components/TermHelp"
import { InstallShortcutSuggestion } from "../components/InstallShortcut"
import { accountAuthState } from "../domain/account/account-auth-state"
import { buildTrainingHomeViewModel, type HomeSession } from "../domain/home-view-model"
import { loadEntries, todayISO } from "../domain/journal-store"
import { readPlanBetaStateFromStorage } from "../domain/plan-beta-store"
import { toAnalysisJournalEntry, type AnalysisJournalEntry } from "../domain/safe-export"
import { compactDate, isoShift } from "../domain/dates"
import { summarizeToDateDistances } from "../domain/cumulative-distance"
import { projectStructuredJournalObservations } from "../domain/journal-observation"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { AccountEntryButton } from "../components/AccountEntryButton"
import { DailyContextTags } from "./home/DailyContextTags"
import { TrainingHome } from "./home/TrainingHome"
import { LatestJournalDay } from "./home/LatestJournalDay"
import type { LogEntryType } from "./log-entry/shared"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { accountJournalProjectionStatus } from "../domain/account/account-journal-projection"
import { createPlannedSessionLogDraft, type PlannedSessionLink } from "../domain/planned-session-link"

export type HomeProps = {
  readonly onWriteLog?: (entryType?: LogEntryType) => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenNextTraining?: (link: PlannedSessionLink) => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
  readonly onOpenAccount?: () => void
  readonly onOpenContent?: () => void
  readonly onOpenRewards?: () => void
  readonly onDecorateToday?: () => void
}

export function Home({
  onWriteLog, onOpenDay, onOpenArchive, onOpenGuide, onOpenPlan,
  onOpenNextTraining, onOpenTrends, onOpenMore, onOpenAccount, onOpenContent, onOpenRewards,
}: HomeProps) {
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => {
      unsubscribe()
      window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
    }
  }, [])
  const entries = React.useMemo(() => loadEntries(), [revision])
  const analysisEntries = React.useMemo(
    () => entries.flatMap(entry => {
      const projected = toAnalysisJournalEntry(entry)
      return projected === null ? [] : [projected]
    }),
    [entries],
  )
  const today = todayISO()
  const planRead = readPlanBetaStateFromStorage()
  const planState = planRead.kind === "loaded" ? planRead.state : null
  const adjustedPlan = planRead.kind === "adjusted_loaded" || planRead.kind === "adjusted_v3_loaded" || planRead.kind === "multi_adjusted_v3_loaded"
    ? { ...planRead.state.selection, progress: planRead.state.progress } : null
  const accountCurrent = accountPlansEnabled() ? accountPlanService()?.snapshot().currentPlan : null
  const original = accountCurrent?.kind === "evidence_required" ? accountCurrent.packet.state : null
  const homePlan = original ? original.version === 2 || original.version === 3
    ? original
    : { ...original.selection, progress: original.progress }
    : adjustedPlan ?? planState
  const observations = React.useMemo(() => projectStructuredJournalObservations(entries), [entries])
  const toDateDistance = React.useMemo(() => summarizeToDateDistances(observations, today), [observations, today])
  const baseModel = buildTrainingHomeViewModel(entries, analysisEntries, homePlan, today)
  const model = {
    ...baseModel,
    ...(accountCurrent?.kind === "evidence_required" ? { nextTraining: null,
      planSummary: "보관한 계획 · 출처 검증 대기 · 원본과 진행 기록 확인" } : {}),
    analysisSummary: toDateDistance.week.totalKm === null
      ? baseModel.analysisSummary
      : "이번 주 " + toDateDistance.week.totalKm + "km · 직접 입력 " + toDateDistance.week.includedSourceCount + "건",
  }
  const painReviewDates = recentPainReviewDates(analysisEntries, today)
  const needsPainCheck = adjustedPlan?.progress.some(item => item.state === "PAIN_CHECKIN") ?? false
  const storageStatus = accountJournalProjectionStatus()
  const storageMessage = storageStatus === "CONFLICT" ? "다른 기기의 수정과 겹친 기록이 있어요. 사용할 내용을 확인해 주세요."
    : storageStatus === "REJECTED" ? "계정에 저장하지 못한 기록이 있어요. 기기에 보관된 내용을 확인해 주세요."
    : storageStatus === "FAILED" ? "계정의 기록을 확인하지 못했어요. 저장 상태를 확인해 주세요."
    : storageStatus === "PENDING" ? "계정 저장을 기다리는 기록이 있어요. 아직 계정 저장이 완료되지 않았어요."
    : null
  const needsPlanReview = accountCurrent?.kind === "evidence_required"
  const safetyNotice = needsPainCheck || painReviewDates.length > 0 || storageMessage !== null || needsPlanReview ? (
    <div className="home-hub__notices">
      {needsPainCheck && <p role="alert" className="home-hub__notice">
        계획에 통증 확인 기록이 있어요. 다음 훈련 전에 몸 상태를 확인하고 지도자·보호자와 상의해 주세요.
      </p>}
      {painReviewDates.length > 0 && <PainReview dates={painReviewDates} />}
      {storageMessage !== null && <div className="home-hub__notice" role={storageStatus === "PENDING" ? "status" : "alert"}>
        <p>{storageMessage}</p>
        {onOpenAccount && <button type="button" onClick={onOpenAccount}>계정 저장 상태 확인</button>}
      </div>}
      {needsPlanReview && <div className="home-hub__notice" role="status">
        <p>보관한 계획의 출처 확인이 필요해요. 원본과 진행 기록을 먼저 확인해 주세요.</p>
        <button type="button" onClick={onOpenPlan}>보관한 계획 확인</button>
      </div>}
    </div>
  ) : undefined

  const openNextTraining = () => {
    if (homePlan !== null && model.nextTraining !== null && onOpenNextTraining !== undefined) {
      // Opening uses a validated session identity without saving or completing anything.
      const draft = createPlannedSessionLogDraft<HomeSession>(homePlan, model.nextTraining.session, new Date().toISOString())
      if (draft !== null) {
        onOpenNextTraining(draft.link)
        return
      }
    }
    onOpenPlan?.()
  }

  return (
    <div className="training-home-screen">
      <TrainingHome
        model={model}
        hasPlan={homePlan !== null}
        safetyNotice={safetyNotice}
        onWriteLog={onWriteLog}
        onOpenArchive={onOpenArchive}
        onOpenToday={onOpenDay === undefined ? onOpenArchive : () => onOpenDay(today)}
        onOpenGuide={onOpenGuide}
        onOpenPlan={onOpenPlan}
        onOpenNextTraining={openNextTraining}
        onOpenTrends={onOpenTrends}
        onOpenMore={onOpenMore}
        onOpenContent={onOpenContent}
        onOpenRewards={onOpenRewards}
        accountEntry={<AccountEntryButton onOpenAccount={onOpenAccount} />}
        todayContext={<DailyContextTags date={today} />}
        installSuggestion={<InstallShortcutSuggestion compact eligible={entries.length > 0 || homePlan !== null || accountCurrent !== null || accountAuthState() === "ACCOUNT"} returnFocusTo={() => document.querySelector<HTMLElement>('[data-install-shortcut-return="home"]')} />}
        recentJournal={<LatestJournalDay entries={entries} today={today} onOpenDay={onOpenDay} onOpenArchive={onOpenArchive} />}
      />
    </div>
  )
}

function recentPainReviewDates(entries: readonly AnalysisJournalEntry[], today: string): readonly string[] {
  const from = isoShift(today, -13)
  const dates = entries
    .filter(entry => entry.kind === "evening" && entry.date >= from && painLevelsRequireReview(entry.painParts))
    .map(entry => entry.date)
  return [...new Set(dates)].sort().reverse()
}

function PainReview({ dates }: { readonly dates: readonly string[] }) {
  return (
    <div className="home-hub__notice" data-testid="home-pain-review" role="alert">
      <strong>최근 강한 통증 기록<TermHelp term="review" /></strong>
      <p>{dates.map(compactDate).join(" · ")}에 통증 4 이상을 적었어요. 계속 불편하면 훈련 전에 지도자나 보호자와 상의해 주세요.</p>
    </div>
  )
}
