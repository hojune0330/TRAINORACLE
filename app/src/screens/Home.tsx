import React from "react"
import { TermHelp } from "../components/TermHelp"
import { buildTrainingHomeViewModel } from "../domain/home-view-model"
import { loadEntries, todayISO } from "../domain/journal-store"
import { loadPlanBetaState } from "../domain/plan-beta-store"
import { toAnalysisJournalEntry } from "../domain/safe-export"
import type { AnalysisJournalEntry } from "../domain/safe-export"
import { compactDate, isoShift } from "../domain/dates"
import { engagementSummary, toEngagementJournalRef } from "../domain/engagement"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { DailyContextTags } from "./home/DailyContextTags"
import { DeviceJournal } from "./home/DeviceJournal"
import { DecorationShop } from "./home/DecorationShop"
import { EngagementStrip } from "./home/EngagementStrip"
import { TrainingHome } from "./home/TrainingHome"
import { TrashBin } from "./home/TrashBin"
import type { JournalEntryType } from "./log-entry/shared"

export type HomeProps = {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
}

export function Home({
  onWriteLog,
  onOpenDay,
  onOpenArchive,
  onOpenGuide,
  onOpenPlan,
  onOpenTrends,
  onOpenMore,
}: HomeProps) {
  const [revision, setRevision] = React.useState(0)
  const entries = React.useMemo(() => loadEntries(), [revision])
  const analysisEntries = React.useMemo(
    () => entries.flatMap((entry) => {
      const projected = toAnalysisJournalEntry(entry)
      return projected === null ? [] : [projected]
    }),
    [entries],
  )
  const today = todayISO()
  const model = buildTrainingHomeViewModel(entries, analysisEntries, loadPlanBetaState(), today)
  const engagement = engagementSummary(
    entries.flatMap((entry) => {
      const ref = toEngagementJournalRef(entry)
      return ref === null ? [] : [ref]
    }),
    today,
  )
  const painReviewDates = recentPainReviewDates(analysisEntries, today)

  React.useEffect(() => {
    if (!window.location.search.includes("uitest")) return
    console.log(`[HOMEJ] total=${entries.length} painReview=${painReviewDates.length}`)
  }, [entries.length, painReviewDates.length])

  return (
    <div className="training-home-screen">
      <TrainingHome
        model={model}
        onWriteLog={onWriteLog}
        onOpenArchive={onOpenArchive}
        onOpenPlan={onOpenPlan}
        onOpenTrends={onOpenTrends}
        onOpenMore={onOpenMore}
        todayContext={<DailyContextTags date={today} />}
        recentJournal={(
          <section className="training-home__recent" aria-label="최근 기록">
            <DeviceJournal onOpenDay={onOpenDay} onOpenArchive={onOpenArchive} />
          </section>
        )}
      />

      {painReviewDates.length > 0 && <PainReview dates={painReviewDates} />}
      <EngagementStrip summary={engagement} savedCount={entries.length} onOpenMore={onOpenMore} />
      <DecorationShop earnedPoints={engagement.points} showPreview={entries.length > 0} />

      {model.showMinjiPrompt && (
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
