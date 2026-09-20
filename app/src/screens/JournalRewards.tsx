import React from "react"
import { ArrowLeft } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { loadEntries, todayISO } from "../domain/journal-store"
import {
  loadEngagementSummary,
  reconcileJournalAwards,
  recordDailyVisit,
  toEngagementJournalRef,
  type EngagementAwardResult,
} from "../domain/engagement"
import { buildEngagementSharePayload } from "../domain/engagement-rewards"
import { DECORATION_CATALOG, loadDecorationState } from "../domain/decorations"
import {
  ACCOUNT_REWARD_EVENT,
  accountRewardsEnabled,
  accountRewardStatus,
  hydrateAccountRewards,
  readAccountRewardSummary,
  recordAccountDailyVisit,
} from "../domain/account/account-reward-service"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { ACCOUNT_AUTH_STATE_EVENT, accountAuthState } from "../domain/account/account-auth-state"
import { DecorationShop } from "./home/DecorationShop"
import { EngagementStrip } from "./home/EngagementStrip"
import "../styles/home-menu.css"

const VISIT_NOTICE = {
  AWARDED: "오늘 방문 +1P가 반영됐어요.",
  ALREADY_AWARDED: "오늘 방문 1P는 이미 반영돼 있어요.",
  INELIGIBLE: "오늘 날짜를 확인하지 못해 방문 포인트를 반영하지 않았어요.",
  SAVE_FAILED: "방문 포인트를 이 기기에 저장하지 못했어요.",
  PENDING: "계정 방문 포인트를 확인하고 있어요.",
} satisfies Record<EngagementAwardResult["kind"], string>

export type JournalRewardsProps = {
  readonly onBack: () => void
  readonly onOpenMore?: () => void
  readonly onDecorateToday?: () => void
}

export function JournalRewards({ onBack, onOpenMore, onDecorateToday }: JournalRewardsProps) {
  const [revision, setRevision] = React.useState(0)
  const entries = React.useMemo(() => loadEntries(), [revision])
  const today = todayISO()
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

  React.useEffect(() => {
    setEngagement(reconcileJournalAwards(engagementRefs, today))
  }, [engagementRefs, today])

  React.useEffect(() => {
    const refresh = () => {
      setEngagement(loadEngagementSummary(today))
      setSpentPoints(accountRewardsEnabled() ? readAccountRewardSummary()?.spentPoints ?? 0 : loadDecorationState().spentPoints)
      setRevision((value) => value + 1)
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
      } else if (navigator.clipboard !== undefined) {
        await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`)
        setShareNotice("공유할 내용을 복사했어요.")
      } else setShareNotice("이 브라우저에서는 공유를 열 수 없어요.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (error instanceof Error) setShareNotice("공유하지 못했어요. 다시 시도해 주세요.")
      else throw error
    }
  }

  const rewardStatusNotice = accountRewardsEnabled() && accountRewardStatus() !== "READY"
    ? accountRewardStatus() === "AUTH_REQUIRED" ? accountAuthState() === "FAILED"
      ? "인증을 확인하지 못했어요. 게스트 장부로 전환하지 않았어요. 계정에서 로그인 상태를 확인해 주세요."
      : "로그인 상태를 확인하고 있어요. 확인 전에는 포인트 장부를 열지 않아요."
      : accountRewardStatus() === "FAILED" ? "계정 포인트를 불러오지 못했어요." : "계정 포인트를 불러오고 있어요."
    : null

  return (
    <div className="more-screen journal-rewards-screen">
      <header className="utility-header">
        <button type="button" onClick={onBack} aria-label="뒤로가기" title="뒤로"><ArrowLeft aria-hidden="true" size={19} /></button>
        <div><div className="utility-header__eyebrow">TRAINORACLE</div><h1>일지 꾸미기·포인트</h1></div>
      </header>
      <DecorationShop
        earnedPoints={engagement.points}
        hasJournalEntries={entries.length > 0}
        onSpentPointsChange={setSpentPoints}
        onDecorateToday={onDecorateToday}
      />
      {accountAuthState() === "GUEST" && <div className="training-home__support-note"><InfoDisclosure title="게스트 포인트는 어디에 보관되나요?"><p>로그인하지 않고 모은 포인트는 이 기기에 남아요. 계정 포인트와는 별도로 보관해요.</p></InfoDisclosure></div>}
      <EngagementStrip
        summary={engagement}
        savedCount={entries.length}
        notice={engagementNotice ?? rewardStatusNotice}
        availablePoints={availablePoints}
        spentPoints={spentPoints}
        nextReward={nextReward}
        onRecordVisit={() => { void recordVisit() }}
        onOpenMore={onOpenMore}
        onShare={() => { void shareEngagement() }}
        shareNotice={shareNotice}
      />
    </div>
  )
}
