import React from "react"
import { loadEntries, todayISO, type PostSessionEntry } from "../../domain/journal-store"

const RPE_BAND_LABEL: Readonly<Record<NonNullable<PostSessionEntry["rpeBand"]>, string>> = {
  RPE_1_2: "RPE 1~2 (대략)",
  RPE_3_4: "RPE 3~4 (대략)",
  RPE_5_6: "RPE 5~6 (대략)",
  RPE_7_8: "RPE 7~8 (대략)",
  RPE_9_10: "RPE 9~10 (대략)",
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

function comparableKey(entry: PostSessionEntry): string {
  if (entry.system.trim() !== "") return `system:${entry.system}`
  if (entry.activityOutcome !== undefined) return `outcome:${entry.activityOutcome}`
  return "post-session"
}

function sessionLabel(entry: PostSessionEntry, fallback: string): string {
  if (entry.activitySlot === "AM") return "오늘 오전"
  if (entry.activitySlot === "PM") return "오늘 오후"
  return fallback
}

function numberValue(value: string): number | null {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function differenceFacts(previous: PostSessionEntry, current: PostSessionEntry): readonly string[] {
  const differences: string[] = []
  const previousDistance = numberValue(previous.distanceKm)
  const currentDistance = numberValue(current.distanceKm)
  if (previousDistance !== null && currentDistance !== null) {
    const delta = currentDistance - previousDistance
    differences.push(`거리 ${delta === 0 ? "같음" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}km`}`)
  }
  if (previous.rpe > 0 && current.rpe > 0) {
    const delta = current.rpe - previous.rpe
    differences.push(`RPE ${delta === 0 ? "같음" : `${delta > 0 ? "+" : ""}${delta}`}`)
  }
  return differences
}

export function JournalThenNow({ onOpenDay }: { readonly onOpenDay?: (date: string) => void }) {
  const today = todayISO()
  const sessions = loadEntries()
    .filter((entry): entry is PostSessionEntry => entry.kind === "post-session")
    .sort((left, right) => `${left.date}:${left.savedAt}`.localeCompare(`${right.date}:${right.savedAt}`))
  const todayEntries = sessions.filter((entry) => entry.date === today)
  const todayEntry = todayEntries.at(-1)
  if (todayEntry === undefined) return null

  const older = sessions.filter((entry) => entry.date < today).reverse()
  const previousDateEntry = older.find((entry) => comparableKey(entry) === comparableKey(todayEntry)) ?? older[0]
  const sameDayEntry = todayEntries.length > 1
    ? [...todayEntries].reverse().find((entry) => entry.id !== todayEntry.id)
    : undefined
  // On a two-a-day, the athlete's immediate question is how the two sessions differed.
  // Prefer that pair even when older records exist; historical comparison remains the
  // fallback for ordinary one-session days.
  const previousEntry = sameDayEntry ?? previousDateEntry
  if (previousEntry === undefined) return null

  const sameDay = previousEntry.date === todayEntry.date
  const difference = differenceFacts(previousEntry, todayEntry)
  const cards = [
    { entry: previousEntry, label: sameDay ? sessionLabel(previousEntry, "먼저 한 운동") : "이전 기록" },
    { entry: todayEntry, label: sameDay ? sessionLabel(todayEntry, "나중에 한 운동") : "오늘" },
  ] as const

  return (
    <section className="journal-then-now" aria-labelledby="journal-then-now-title">
      <div className="journal-then-now__heading">
        <div>
          <small>기록 비교</small>
          <h2 id="journal-then-now-title">{sameDay ? "오늘 두 운동 비교" : "이전 기록과 오늘"}</h2>
        </div>
      </div>
      <div className="journal-then-now__pair">
        {cards.map(({ entry, label }) => {
          const entryFacts = facts(entry)
          return (
            <button key={entry.id} type="button" className="journal-then-now__card" onClick={() => onOpenDay?.(entry.date)}>
              <span className="journal-then-now__label">{label}</span>
              <time dateTime={entry.date}>{entry.date.replaceAll("-", ". ")}.</time>
              <strong>{entry.title || "훈련 기록"}</strong>
              <span>{entryFacts.length === 0 ? "수치 없이 남긴 기록" : entryFacts.join(" · ")}</span>
            </button>
          )
        })}
      </div>
      <p>{difference.length === 0
        ? "두 기록에 실제로 남긴 값만 함께 보여줘요. 값이 없으면 차이를 만들지 않아요."
        : `${difference.join(" · ")} · 높고 낮음을 성과로 평가하지 않아요.`}</p>
    </section>
  )
}
