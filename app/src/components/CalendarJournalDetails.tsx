import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from "react"
import { isBrowserPopNavigationConsumed } from "../navigation/browserNavigation"
import { BookOpen, ChevronLeft, PenLine } from "lucide-react"
import { useLocalToday } from "../hooks/useLocalToday"
import type { JournalEntry } from "../domain/journal-schema"
import { PLAN_EXECUTION_CHANGE_LABELS } from "../domain/journal-schema"
import { EXERCISE_KINDS, describeExerciseRow } from "../domain/exercise-log"
import { journalRpeLabel, quickOutcomeLabel } from "../domain/quick-journal"
import { isImportedField } from "../domain/field-provenance"
import { bodyPartLabel } from "./body-parts"
import { CalendarTrainingMark } from "./CalendarTrainingMark"
import { calendarMarksDescription, journalCalendarMarks } from "../domain/calendar-training-presentation"
import { isValidIsoDate } from "../domain/dates"
import { JournalDecorationPreview, useJournalDecorationPreviews } from "../screens/journal/JournalDecorationPreview"
import "./CalendarJournalDetails.css"

const OriginalJournal = lazy(() => import("../screens/LogDetail").then(module => ({ default: module.LogDetail })))

export function CalendarJournalBadge({ entries, date }: { entries: readonly JournalEntry[]; date: string }) {
  const day = entries.filter(entry => entry.date === date)
  if (day.length === 0) return null
  const ordered = [...day].sort((a, b) => Number(b.kind === "race") - Number(a.kind === "race"))
  return <>
    {ordered.slice(0, 3).map(entry => journalCalendarMarks(entry).map((mark, index) =>
      <CalendarTrainingMark key={`${entry.id}-${index}`} {...mark} slot={mark.slot ? `일지 · ${mark.slot}` : "일지"} />))}
    {day.length > 3 && <span className="month-calendar__event">일지 +{day.length - 3}</span>}
  </>
}

export function calendarJournalDescription(entries: readonly JournalEntry[], date: string): string {
  const day = entries.filter(entry => entry.date === date)
  return day.length === 0 ? "" : `일지 ${day.length}개 · ${calendarMarksDescription(day.flatMap(journalCalendarMarks))}`
}

export function CalendarJournalDetails({ entries, date, onOpenDay, onWriteDate }: {
  readonly entries: readonly JournalEntry[]
  readonly date: string
  readonly onOpenDay?: (date: string) => void
  readonly onWriteDate?: (date: string) => void
}) {
  const [original, setOriginal] = useState(false)
  const [selection, setSelection] = useState<{ readonly date: string; readonly id: string } | null>(null)
  const originalEntryCreated = useRef(false)
  const originalToken = useRef<string | null>(null)
  const selectionPanelId = useId()
  const closeOriginal = () => { if (originalToken.current && window.history.state?.calendarOriginal === originalToken.current) window.history.back(); else setOriginal(false) }
  useEffect(() => {
    if (!original) { originalEntryCreated.current = false; originalToken.current = null; return }
    const previous = window.history.state
    const token = `original-${date}`
    originalToken.current = token
    try {
      window.history[originalEntryCreated.current ? "replaceState" : "pushState"]({ ...previous, calendarOriginal: token }, "", window.location.href)
      originalEntryCreated.current = true
    } catch { /* The in-reader Back action remains available. */ }
    const pop = (event: PopStateEvent) => {
      if (isBrowserPopNavigationConsumed(event)) return
      if (window.history.state?.calendarOriginal !== token) setOriginal(false)
    }
    window.addEventListener("popstate", pop)
    return () => {
      window.removeEventListener("popstate", pop)
      try {
        if (window.history.state?.calendarOriginal === token) window.history.replaceState(previous, "", window.location.href)
      } catch { /* History may be unavailable in embedded browsers. */ }
    }
  }, [original, date])
  const today = useLocalToday()
  const activeDates = useMemo(() => new Set(entries.map((entry) => entry.date).filter(isValidIsoDate)), [entries])
  const decorationPreviews = useJournalDecorationPreviews(activeDates)
  useEffect(() => setOriginal(false), [date])
  const day = useMemo(() => entries.filter(entry => entry.date === date), [entries, date])
  const defaultEntry = day.find(entry => entry.kind === "post-session") ?? day[0] ?? null
  const selectedEntry = day.find(entry => selection?.date === date && entry.id === selection.id) ?? defaultEntry
  const selectedIndex = day.findIndex(entry => entry.id === selectedEntry?.id)
  useEffect(() => {
    if (selection?.date === date && day.some(entry => entry.id === selection.id)) return
    setSelection(defaultEntry ? { date, id: defaultEntry.id } : null)
  }, [date, day, defaultEntry, selection])
  if (original) return <section className="calendar-journal-detail">
    <button type="button" onClick={closeOriginal}><ChevronLeft size={18} aria-hidden="true" />날짜 요약으로</button>
    <Suspense fallback={<p role="status">일지를 여는 중이에요.</p>}><OriginalJournal date={date} initialEntryId={selectedEntry?.id} onBack={closeOriginal} /></Suspense>
  </section>
  return <section className="calendar-journal-detail" aria-label="이날 남긴 기록">
    <h3 className="calendar-journal-detail__heading">
      <span>이날 남긴 기록</span>
      {day.length > 0 && <small className="calendar-journal-detail__count">{day.length}개</small>}
      <JournalDecorationPreview item={decorationPreviews.get(date)} />
    </h3>
    {day.length === 0 ? <>
      <p className="calendar-journal-detail__empty">이날 작성한 일지가 없어요.</p>
      {onWriteDate && date <= today && <button type="button" onClick={() => onWriteDate(date)}>
        <PenLine size={18} aria-hidden="true" />이날 일지 쓰기
      </button>}
    </> : <>
      <p className="calendar-journal-detail__caption">계획과 별도로 남긴 실제 기록이에요.</p>
      {day.length > 1 && <div className="calendar-journal-detail__entries" role="group" aria-label="이날 기록 선택">
        {day.map((entry, index) => <button key={entry.id} type="button"
          className="calendar-journal-detail__entry-choice" aria-pressed={selectedEntry?.id === entry.id}
          aria-controls={selectionPanelId} onClick={() => setSelection({ date, id: entry.id })}>
          <span className="calendar-journal-detail__entry-head">
            <strong>{entryHeading(entry)}</strong>
            <small>{selectedEntry?.id === entry.id ? "선택됨" : `기록 ${index + 1}`}</small>
          </span>
          <span className="calendar-journal-detail__entry-summary">{entrySummary(entry)}</span>
        </button>)}
      </div>}
      {selectedEntry && <article id={selectionPanelId} aria-label="선택한 기록 상세">
        <h4>{entryHeading(selectedEntry)}<small>기록 {selectedIndex + 1}</small></h4>
        <dl>{facts(selectedEntry).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {selectedEntry.kind === "post-session" && selectedEntry.exerciseLog?.components.map(component => <div className="calendar-journal-detail__exercise" key={component.id}>
          <strong>{EXERCISE_KINDS[component.kind]}</strong>
          {component.rows.map(row => <p key={row.id}>{describeExerciseRow(row)}</p>)}
        </div>)}
      </article>}
      <button type="button" className="calendar-journal-detail__open" onClick={() => onOpenDay ? onOpenDay(date) : setOriginal(true)}>
        <BookOpen size={18} aria-hidden="true" />일지·메모 원문 열기
      </button>
      <small>메모는 원래 일지에서 확인해요. 공유 설정은 바뀌지 않아요.</small>
    </>}
  </section>
}

function slotLabel(entry: Extract<JournalEntry, { kind: "post-session" }>) {
  // A save timestamp is not a workout time. Conflicting/missing slots stay unknown.
  const explicit = entry.activitySlot
  if (explicit === "AM") return "오전"
  if (explicit === "PM") return "오후"
  if (explicit === "SINGLE") return "하루 한 번"
  return "시간대 미기록"
}

function entryHeading(entry: JournalEntry): string {
  if (entry.kind === "post-session") return `${slotLabel(entry)} · 훈련 기록`
  if (entry.kind === "race") return entry.stage === "pre" ? "경기 전 기록" : "경기 결과"
  return "하루 마무리"
}

function entrySummary(entry: JournalEntry): string {
  if (entry.kind === "evening") return "하루 마무리 기록"
  const values = entry.kind === "post-session" ? [
    summaryFact(entry, "수행", "activityOutcome", quickOutcomeLabel(entry)),
    summaryFact(entry, "거리", "distanceKm", entry.distanceKm, " km"),
    summaryFact(entry, "시간", "durationMin", entry.durationMin, "분"),
    summaryFact(entry, "평균 페이스", "avgPace", entry.avgPace, "/km"),
  ] : [
    summaryFact(entry, "경기 기록", "record", entry.record),
    summaryFact(entry, "순위", "rank", entry.rank),
  ]
  const exercises = entry.kind === "post-session"
    ? [...new Set((entry.exerciseLog?.components ?? []).map(component => EXERCISE_KINDS[component.kind]))]
    : []
  return [...values.filter((value): value is string => value !== null), ...exercises].slice(0, 2).join(" · ") || "기록 내용을 확인할 수 있어요"
}

function summaryFact(entry: JournalEntry, label: string, field: string, value: string | number | null | undefined, suffix = ""): string | null {
  if (value === undefined || value === null || value === "" || entry.fieldProvenance?.[field]?.provenance === "MISSING") return null
  const source = isImportedField(field, entry.fieldProvenance) ? " · 가져온 값" : entry.fieldProvenance?.[field] === undefined ? " · 입력 출처 미확인" : ""
  return `${label} ${value}${suffix}${source}`
}

function facts(entry: JournalEntry): [string, string][] {
  const result: [string, string][] = []
  const add = (label: string, field: string, value: string | number | undefined, suffix = "") => {
    if (value === undefined || value === "" || entry.fieldProvenance?.[field]?.provenance === "MISSING") return
    const source = isImportedField(field, entry.fieldProvenance) ? " · 가져온 값" : entry.fieldProvenance?.[field] === undefined ? " · 입력 출처 미확인" : ""
    result.push([label, `${value}${suffix}${source}`])
  }
  if (entry.kind === "post-session") {
    const outcome = quickOutcomeLabel(entry)
    if (outcome) add("수행", "activityOutcome", outcome)
    if (entry.planExecutionChange) add("바꾼 내용", "planExecutionChange", PLAN_EXECUTION_CHANGE_LABELS[entry.planExecutionChange])
    add("거리", "distanceKm", entry.distanceKm, " km")
    add("시간", "durationMin", entry.durationMin, "분")
    add("평균 페이스", "avgPace", entry.avgPace, "/km")
    const rpe = journalRpeLabel(entry)
    if (rpe !== null) add("체감 강도", entry.rpe > 0 ? "rpe" : "rpeBand", rpe)
  } else if (entry.kind === "evening") {
    add("체중", "weightKg", entry.weightKg, " kg")
    add("안정시 심박", "restingHr", entry.restingHr, " bpm")
    if (entry.sleepH > 0 || entry.fieldProvenance?.sleepH?.provenance === "EXPLICIT") add("수면", "sleepH", entry.sleepH, "시간")
    if (entry.mood > 0) add("기분", "mood", `${entry.mood}/5`)
  } else {
    add("경기 기록", "record", entry.record)
    add("순위", "rank", entry.rank)
    if (entry.tension !== undefined) add("긴장도", "tension", `${entry.tension}/10`)
    if (entry.condition !== undefined) add("컨디션", "condition", `${entry.condition}/5`)
  }
  if (entry.kind !== "race") {
    const pain = Object.entries(entry.painParts ?? {}).filter(([, level]) => level > 0)
    if (pain.length > 0) add("통증 기록", "painParts", pain.map(([part, level]) => `${bodyPartLabel(part)} ${level}/5`).join(" · "))
    else if (entry.kind === "post-session") {
      const answer = entry.painCheckStatus
      if (answer === "SIGNAL_REPORTED") add("통증 기록", "painCheckStatus", "통증 신호를 남겼어요")
      else if (answer === "NO_SIGNAL_REPORTED") add("통증 확인", "painCheckStatus", "통증을 느끼지 않았다고 기록했어요")
      else if (answer === "UNANSWERED") result.push(["통증 확인", "통증 질문에 답하지 않았어요"])
    }
  }
  return result
}
