import React from "react"
import { ACCOUNT_PLAN_EVENT, accountPlanService, accountPlansEnabled } from "../domain/account/account-plan-service"
import { TermHelp } from "../components/TermHelp"
import { buildTrainingHomeViewModel } from "../domain/home-view-model"
import { loadEntries, todayISO } from "../domain/journal-store"
import { readPlanBetaStateFromStorage } from "../domain/plan-beta-store"
import { toAnalysisJournalEntry } from "../domain/safe-export"
import type { AnalysisJournalEntry } from "../domain/safe-export"
import { compactDate, isoShift } from "../domain/dates"
import { activePlanDateWindow, summarizeToDateDistances } from "../domain/cumulative-distance"
import { projectStructuredJournalObservations } from "../domain/journal-observation"
import {
  loadEngagementSummary,
  reconcileJournalAwards,
  recordDailyVisit,
  type EngagementAwardResult,
  toEngagementJournalRef,
} from "../domain/engagement"
import { buildEngagementSharePayload } from "../domain/engagement-rewards"
import { DECORATION_CATALOG, loadDecorationState } from "../domain/decorations"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { AccountEntryButton } from "../components/AccountEntryButton"
import { DailyContextTags } from "./home/DailyContextTags"
import { DeviceJournal } from "./home/DeviceJournal"
import { DecorationShop } from "./home/DecorationShop"
import { EngagementStrip } from "./home/EngagementStrip"
import { TrainingHome } from "./home/TrainingHome"
import { CumulativeDistancePanel } from "./trends/CumulativeDistancePanel"
import { EnergySystemLedgerPanel } from "./trends/EnergySystemLedgerPanel"
import { TrashBin } from "./home/TrashBin"
import { TrainingContentTeaser } from "./home/TrainingContentTeaser"
import { JournalThenNow } from "./home/JournalThenNow"
import type { LogEntryType } from "./log-entry/shared"
import { ACCOUNT_REWARD_EVENT, accountRewardsEnabled, accountRewardStatus, hydrateAccountRewards,
  readAccountRewardSummary, recordAccountDailyVisit } from "../domain/account/account-reward-service"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { ACCOUNT_AUTH_STATE_EVENT, accountAuthState } from "../domain/account/account-auth-state"

const VISIT_NOTICE = {
  AWARDED: "오늘 방문 +1P가 반영됐어요.",
  ALREADY_AWARDED: "오늘 방문 1P는 이미 반영돼 있어요.",
  INELIGIBLE: "오늘 날짜를 확인하지 못해 방문 포인트를 반영하지 않았어요.",
  SAVE_FAILED: "방문 포인트를 이 기기에 저장하지 못했어요.",
  PENDING: "계정 방문 포인트를 확인하고 있어요.",
} satisfies Record<EngagementAwardResult["kind"], string>

export type HomeProps = {
  readonly onWriteLog?: (entryType?: LogEntryType) => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
  readonly onOpenAccount?: () => void
  readonly onOpenContent?: () => void
  /* 홈 꾸미기 카드 → 오늘 일지 상세에서 편집기 자동 열기. */
  readonly onDecorateToday?: () => void
}

export function Home({
  onWriteLog,
  onOpenDay,
  onOpenArchive,
  onOpenGuide,
  onOpenPlan,
  onOpenTrends,
  onOpenMore,
  onOpenAccount,
  onOpenContent,
  onDecorateToday,
}: HomeProps) {
  const [revision, setRevision] = React.useState(0)
  React.useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    window.addEventListener(ACCOUNT_PLAN_EVENT, refresh)
    return () => { unsubscribe(); window.removeEventListener(ACCOUNT_PLAN_EVENT, refresh) }
  }, [])
  const entries = React.useMemo(() => loadEntries(), [revision])
  const analysisEntries = React.useMemo(
    () => entries.flatMap((entry) => {
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
  const observations = React.useMemo(
    () => projectStructuredJournalObservations(entries),
    [entries],
  )
  const toDateDistance = React.useMemo(
    () => summarizeToDateDistances(observations, today),
    [observations, today],
  )
  const baseModel = buildTrainingHomeViewModel(entries, analysisEntries, homePlan, today)
  const model = {
    ...baseModel,
    ...(accountCurrent?.kind === "evidence_required" ? { nextTraining: null,
      planSummary: "보관한 계획 · 출처 검증 대기 · 원본과 진행 기록 확인" } : {}),
    analysisSummary: toDateDistance.week.totalKm === null
      ? baseModel.analysisSummary
      : `이번 주 ${toDateDistance.week.totalKm}km · 직접 입력 ${toDateDistance.week.includedSourceCount}건`,
  }
  const planFrame = homePlan?.activePlan.frame
  const planVisibleLength = planFrame === undefined
    ? undefined
    : "projectionLengthDays" in planFrame
      ? planFrame.projectionLengthDays ?? planFrame.lengthDays
      : planFrame.lengthDays
  const planWindow = activePlanDateWindow(homePlan?.intake.startDate, planVisibleLength)
  const engagementRefs = React.useMemo(
    () => entries.flatMap((entry) => {
      const ref = toEngagementJournalRef(entry)
      return ref === null ? [] : [ref]
    }),
    [entries],
  )
  const [engagement, setEngagement] = React.useState(() => loadEngagementSummary(today))
  const [engagementNotice, setEngagementNotice] = React.useState<string | null>(null)
  const [shareNotice, setShareNotice] = React.useState<string | null>(null)
  const [spentPoints, setSpentPoints] = React.useState(() => loadDecorationState().spentPoints)
  const decorationState = loadDecorationState()
  const availablePoints = accountRewardsEnabled() ? readAccountRewardSummary()?.availablePoints ?? 0
    : Math.max(0, engagement.points - spentPoints)
  /* "다음 목표"는 포인트로 살 수 있는 것만 — 보상·시즌 지급분(cost 0)이나 신규 제공이 끝난 RETIRED 항목은 후보가 아니다. */
  const nextRewardItem = DECORATION_CATALOG
    .filter((item) => (
      !item.starterOwned
      && !decorationState.ownedItemIds.includes(item.id)
      && item.availability === "ACTIVE"
      && (item.acquisition.kind === "POINTS" || item.acquisition.kind === "BUNDLE")
    ))
    .sort((left, right) => left.cost - right.cost)[0]
  const nextReward = nextRewardItem === undefined ? null : {
    name: nextRewardItem.name,
    cost: nextRewardItem.cost,
    remainingPoints: Math.max(0, nextRewardItem.cost - availablePoints),
  }
  const painReviewDates = recentPainReviewDates(analysisEntries, today)

  React.useEffect(() => {
    setEngagement(reconcileJournalAwards(engagementRefs, today))
  }, [engagementRefs, today])

  React.useEffect(() => {
    const refresh = () => {
      setEngagement(loadEngagementSummary(today))
      setSpentPoints(accountRewardsEnabled() ? readAccountRewardSummary()?.spentPoints ?? 0 : loadDecorationState().spentPoints)
    }
    const hydrate = () => { if (accountRewardsEnabled()) void hydrateAccountRewards(); else refresh() }
    const scope = () => { refresh(); setEngagementNotice(null); setShareNotice(null); hydrate() }
    window.addEventListener(ACCOUNT_REWARD_EVENT, refresh)
    window.addEventListener(ACCOUNT_AUTH_STATE_EVENT, scope)
    window.addEventListener("trainoracle:account-decorations-changed", hydrate)
    window.addEventListener("trainoracle:account-journals-changed", hydrate)
    const unsubscribe = onLocalJournalScopeChange(scope)
    refresh(); hydrate()
    return () => {
      window.removeEventListener(ACCOUNT_REWARD_EVENT, refresh)
      window.removeEventListener(ACCOUNT_AUTH_STATE_EVENT, scope)
      window.removeEventListener("trainoracle:account-decorations-changed", hydrate)
      window.removeEventListener("trainoracle:account-journals-changed", hydrate)
      unsubscribe()
    }
  }, [today])

  const recordVisit = async () => {
    if (accountRewardsEnabled()) {
      const owner = activeLocalAccount()
      if (owner === null) return
      setEngagementNotice(VISIT_NOTICE.PENDING)
      const result = await recordAccountDailyVisit()
      if (owner !== activeLocalAccount() || !result.ok && result.code === "STALE_RESPONSE") return
      setEngagement(loadEngagementSummary(today))
      setEngagementNotice(!result.ok ? "계정 방문 포인트를 확인하지 못했어요. 다시 시도해 주세요."
        : result.awardedPoints === 1 ? VISIT_NOTICE.AWARDED : VISIT_NOTICE.ALREADY_AWARDED)
      return
    }
    const result = recordDailyVisit(today)
    setEngagement(result.summary)
    setEngagementNotice(VISIT_NOTICE[result.kind])
  }

  const shareEngagement = async () => {
    const payload = buildEngagementSharePayload({
      journalDays: engagement.journalDays,
      availablePoints,
      ownedDecorationIds: decorationState.ownedItemIds,
      appUrl: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
    })
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload)
        setShareNotice("공유창에 내 러닝 기록 요약을 보냈어요.")
        return
      }
      if (navigator.clipboard !== undefined) {
        await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`)
        setShareNotice("공유할 내용을 복사했어요.")
        return
      }
      setShareNotice("이 브라우저에서는 공유를 열 수 없어요.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (error instanceof Error) {
        setShareNotice("공유하지 못했어요. 다시 시도해 주세요.")
        return
      }
      throw error
    }
  }

  React.useEffect(() => {
    if (!window.location.search.includes("uitest")) return
    console.log(`[HOMEJ] total=${entries.length} painReview=${painReviewDates.length}`)
  }, [entries.length, painReviewDates.length])

  return (
    <div className="training-home-screen">
      {adjustedPlan?.progress.some(item => item.state === "PAIN_CHECKIN") && <p role="alert">
        계획에 통증 확인 기록이 있어요. 다음 훈련 전에 몸 상태를 확인하고 지도자·보호자와 상의해 주세요.
      </p>}
      <TrainingHome
        model={model}
        onWriteLog={onWriteLog}
        onOpenArchive={onOpenArchive}
        onOpenToday={onOpenDay === undefined ? onOpenArchive : () => onOpenDay(today)}
        onOpenGuide={onOpenGuide}
        onOpenPlan={onOpenPlan}
        onOpenTrends={onOpenTrends}
        onOpenMore={onOpenMore}
        accountEntry={<AccountEntryButton onOpenAccount={onOpenAccount} />}
        todayContext={<DailyContextTags date={today} />}
        recentJournal={(
          <section className="training-home__recent" aria-label="최근 기록">
            <DeviceJournal onOpenDay={onOpenDay} onOpenArchive={onOpenArchive} />
            <JournalThenNow onOpenDay={onOpenDay} />
          </section>
        )}
      />

      {(entries.length > 0 || homePlan !== null) && (
        <CumulativeDistancePanel
          observations={observations}
          today={today}
          planWindow={planWindow}
          mode="compact"
          onOpenTrends={onOpenTrends}
        />
      )}

      {(entries.length > 0 || homePlan !== null) && (
        <TrainingContentTeaser onOpen={onOpenContent} />
      )}

      {(entries.length > 0 || homePlan !== null) && (
        <EnergySystemLedgerPanel
          observations={observations}
          today={today}
          planState={planState}
          mode="compact"
          onOpenTrends={onOpenTrends}
        />
      )}

      {painReviewDates.length > 0 && <PainReview dates={painReviewDates} />}
      {accountAuthState() === "GUEST" && <p role="note">이 기기의 게스트 포인트예요. 계정 포인트와 별도로 보관해요.</p>}
      <EngagementStrip
        summary={engagement}
        savedCount={entries.length}
        notice={engagementNotice ?? (accountRewardsEnabled() && accountRewardStatus() !== "READY"
          ? accountRewardStatus() === "AUTH_REQUIRED" ? accountAuthState() === "FAILED"
            ? "인증을 확인하지 못했어요. 게스트 장부로 전환하지 않았어요. 계정에서 로그인 상태를 확인해 주세요."
            : "로그인 상태를 확인하고 있어요. 확인 전에는 포인트 장부를 열지 않아요."
            : accountRewardStatus() === "FAILED" ? "계정 포인트를 불러오지 못했어요." : "계정 포인트를 불러오고 있어요."
          : null)}
        availablePoints={availablePoints}
        spentPoints={spentPoints}
        nextReward={nextReward}
        onRecordVisit={recordVisit}
        onOpenMore={onOpenMore}
        onShare={() => { void shareEngagement() }}
        shareNotice={shareNotice}
      />
      {model.homeMode !== "WELCOME" && (
        <DecorationShop
          earnedPoints={engagement.points}
          hasJournalEntries={entries.length > 0}
          onSpentPointsChange={setSpentPoints}
          onDecorateToday={onDecorateToday}
        />
      )}

      {model.homeMode !== "WELCOME" && model.showMinjiPrompt && (
        <div className="training-home__example">
          <button type="button" onClick={onOpenGuide}>
            <span>기록이 쌓이면 어떻게 보일까요?</span>
            <strong>민지의 예시 일지 보기</strong>
          </button>
        </div>
      )}

      <TrashBin onChanged={() => setRevision((value) => value + 1)} />
    </div>
  )
}

function recentPainReviewDates(entries: readonly AnalysisJournalEntry[], today: string): readonly string[] {
  // WORK_ORDER_UX2 §2-1: 통증 4+ 배너 창을 6일 → 14일로 확장.
  const from = isoShift(today, -13)
  const dates = entries
    .filter((entry) => entry.kind === "evening" && entry.date >= from && painLevelsRequireReview(entry.painParts))
    .map((entry) => entry.date)
  return [...new Set(dates)].sort().reverse()
}

function PainReview({ dates }: { readonly dates: readonly string[] }) {
  return (
    <div className="training-home__pain" data-testid="home-pain-review">
      <strong>최근 강한 통증 기록<TermHelp term="review" /></strong>
      <p>{dates.map(compactDate).join(" · ")}에 통증 4 이상을 적었어요. 계속 불편하면 훈련 전에 지도자나 보호자와 상의해 주세요.</p>
    </div>
  )
}
