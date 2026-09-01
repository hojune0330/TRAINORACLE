import React from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { loadEntries, todayISO, type PostSessionEntry } from "../../domain/journal-store"
import { useJournalPageTurn } from "../../hooks/useJournalPageTurn"

const RPE_BAND_LABEL: Readonly<Record<NonNullable<PostSessionEntry["rpeBand"]>, string>> = {
  RPE_1_2: "RPE 1~2",
  RPE_3_4: "RPE 3~4",
  RPE_5_6: "RPE 5~6",
  RPE_7_8: "RPE 7~8",
  RPE_9_10: "RPE 9~10",
  UNKNOWN: "RPE 미기록",
}

function facts(entry: PostSessionEntry): readonly string[] {
  return [
    entry.distanceKm.trim() === "" ? null : `${entry.distanceKm}km`,
    entry.durationMin.trim() === "" ? null : `${entry.durationMin}분`,
    entry.avgPace.trim() === "" ? null : `${entry.avgPace}/km`,
    entry.rpe > 0 ? `RPE ${entry.rpe}` : entry.rpeBand === undefined ? null : RPE_BAND_LABEL[entry.rpeBand],
  ].filter((value): value is string => value !== null)
}

export function JournalThenNow({ onOpenDay }: { readonly onOpenDay?: (date: string) => void }) {
  const today = todayISO()
  const sessions = loadEntries()
    .filter((entry): entry is PostSessionEntry => entry.kind === "post-session")
    .sort((left, right) => `${left.date}:${left.savedAt}`.localeCompare(`${right.date}:${right.savedAt}`))
  const todayEntry = [...sessions].reverse().find((entry) => entry.date === today)
  const previousEntry = [...sessions].reverse().find((entry) => entry.id !== todayEntry?.id)
  const [page, setPage] = React.useState<"previous" | "today">("today")
  const turn = useJournalPageTurn({
    onPrevious: page === "today" ? () => setPage("previous") : undefined,
    onNext: page === "previous" ? () => setPage("today") : undefined,
    keyboard: false,
  })

  if (todayEntry === undefined || previousEntry === undefined) return null
  const entry = page === "today" ? todayEntry : previousEntry
  const entryFacts = facts(entry)

  return (
    <section className="journal-then-now" aria-labelledby="journal-then-now-title">
      <div className="journal-then-now__heading">
        <div>
          <small>기록 비교</small>
          <h2 id="journal-then-now-title">지난 기록과 오늘</h2>
        </div>
        <span>{page === "today" ? "오늘" : "지난 기록"}</span>
      </div>
      <div
        className="journal-then-now__viewport"
        {...turn.touchHandlers}
        style={{ transform: `translateX(${turn.dragOffset}px)` }}
        data-turn-direction={turn.direction}
      >
        <button type="button" className="journal-then-now__card" onClick={() => onOpenDay?.(entry.date)}>
          <time dateTime={entry.date}>{entry.date.replaceAll("-", ". ")}.</time>
          <strong>{entry.title || "훈련 기록"}</strong>
          <span>{entryFacts.length === 0 ? "수치 없이 남긴 기록" : entryFacts.join(" · ")}</span>
        </button>
      </div>
      <div className="journal-then-now__controls">
        <button type="button" onClick={turn.goPrevious} disabled={page === "previous"} aria-label="지난 기록 보기"><ArrowLeft aria-hidden="true" /></button>
        <span aria-label={`${page === "previous" ? 1 : 2}/2`}>{page === "previous" ? "● ○" : "○ ●"}</span>
        <button type="button" onClick={turn.goNext} disabled={page === "today"} aria-label="오늘 기록 보기"><ArrowRight aria-hidden="true" /></button>
      </div>
      <p>거리나 강도를 평가하지 않고, 두 기록에 실제로 남긴 값만 나란히 봐요. 좌우로 밀어도 돼요.</p>
    </section>
  )
}
