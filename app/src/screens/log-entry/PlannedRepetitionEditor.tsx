import React from "react"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import type { ExerciseLog } from "../../domain/exercise-log"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { plannedRepeatRecovery, repetitionPrescription, type PlannedRepetitionEvidence } from "../../domain/planned-repetition-evidence"
import "./planned-repetition-editor.css"
import { linkedCatalogWorkout } from "../../domain/planned-segment-evidence"
import { PlannedSegmentEditor } from "./PlannedSegmentEditor"

type Result = PlannedRepetitionEvidence["results"][number]
export function PlannedRepetitionEditor({ entryId, date, link, value, onChange }: {
  readonly entryId: string; readonly date: string; readonly link?: PlannedSessionLink
  readonly value: ExerciseLog; readonly onChange: (value: ExerciseLog) => void
}) {
  const [page, setPage] = React.useState(0)
  const saved = value.plannedRepetitions
  const clear = () => {
    if (!window.confirm("입력한 반복 기록만 지울까요? 원래 훈련 계획과 다른 운동 기록은 그대로 남아요.")) return
    const { plannedRepetitions: _previous, plannedSegments: _segments, ...rest } = value
    onChange(rest)
  }
  const clearButton = <button className="planned-repetition-editor__clear" type="button" aria-label="입력한 반복 기록 지우기" title="입력한 반복 기록 지우기" onClick={clear}><Trash2 aria-hidden="true" size={18} /></button>
  const unavailable = saved || value.plannedSegments ? <section className="planned-repetition-editor" aria-label="반복 기록 확인">
    <p role="alert">원래 처방과 연결을 확인하지 못했어요. 입력한 반복 기록은 보존했으며 비교하지 않아요.</p>{clearButton}
  </section> : null
  if (!link) return unavailable
  const original = readJournalOriginalPlan({ id: entryId, date, plannedSessionLink: link })
  if (!("session" in original) || !original.session || original.sourceVerificationPending) return unavailable
  const catalog = linkedCatalogWorkout(link, original.session)
  if (catalog) return <PlannedSegmentEditor workout={catalog} link={link} value={value} onChange={onChange} />
  const p = repetitionPrescription(link, original.session)
  if (!p) return unavailable
  if (saved && (saved.plannedSessionId !== link.plannedSessionId || saved.sessionContentFingerprint !== link.sessionContentFingerprint)) {
    return unavailable
  }
  const results = saved?.results ?? []
  const total = p.setCount * p.repetitionsPerSet
  const pages = Math.ceil(total / 3), currentPage = Math.min(page, pages - 1)
  const update = (set: number, repetition: number, key: keyof Pick<Result, "distanceM" | "seconds" | "recoverySeconds" | "recoveryMode">, text: string) => {
    const row: Result = { ...(results.find(item => item.set === set && item.repetition === repetition) ?? { set, repetition }) }
    if (text === "") delete row[key]
    else if (key === "recoveryMode") row.recoveryMode = text as Result["recoveryMode"]
    else {
      const number = Number(text)
      if (!Number.isFinite(number) || number < (key === "recoverySeconds" ? 0 : Number.MIN_VALUE) || number > 86400) return
      row[key] = number
    }
    const next = results.filter(item => item.set !== set || item.repetition !== repetition)
    if (Object.keys(row).length > 2) next.push(row)
    const { plannedRepetitions: _previous, ...rest } = value
    onChange(next.length ? { ...rest, plannedRepetitions: { version: 1, source: "SELF_REPORTED",
      plannedSessionId: link.plannedSessionId, sessionContentFingerprint: link.sessionContentFingerprint, results: next } } : rest)
  }
  return <details className="planned-repetition-editor">
    <summary>반복별 기록 남기기{results.length ? ` · ${results.length}회 입력` : ""}</summary>
    {results.length > 0 && clearButton}
    <p>계획 {p.repetitionDistanceM}m · 목표 {Number(p.targetRepSeconds.toFixed(2))}초</p>
    <div className="planned-repetition-editor__rows">
      {Array.from({ length: Math.min(3, total - currentPage * 3) }, (_, offset) => {
        const index = currentPage * 3 + offset
        const set = Math.floor(index / p.repetitionsPerSet) + 1, repetition = index % p.repetitionsPerSet + 1
        const row = results.find(item => item.set === set && item.repetition === repetition)
        const key = `${set}세트 ${repetition}회`, recovery = plannedRepeatRecovery(p, set, repetition)
        return <fieldset key={key}><legend>{p.setCount > 1 ? key : `${repetition}회`}</legend>
          <div className="planned-repetition-editor__numbers">
            <label>실제 거리 · m<input aria-label={`${key} 실제 거리`} type="number" inputMode="decimal" min="0.01" max="86400" step="any"
              value={row?.distanceM ?? ""} placeholder={String(p.repetitionDistanceM)} onChange={event => update(set, repetition, "distanceM", event.target.value)} /></label>
            <label>실제 시간 · 초<input aria-label={`${key} 실제 시간`} type="number" inputMode="decimal" min="0.01" max="86400" step="any"
              value={row?.seconds ?? ""} placeholder="미기록" onChange={event => update(set, repetition, "seconds", event.target.value)} /></label>
          </div>
          {recovery && <details><summary>이 반복 뒤 회복 · 계획 {recovery.seconds}초</summary>
            <div className="planned-repetition-editor__numbers">
              <label>실제 회복 · 초<input aria-label={`${key} 실제 회복`} type="number" inputMode="decimal" min="0" max="86400" step="any"
                value={row?.recoverySeconds ?? ""} placeholder="미기록" onChange={event => update(set, repetition, "recoverySeconds", event.target.value)} /></label>
              <label>실제 회복 방식<select aria-label={`${key} 실제 회복 방식`} value={row?.recoveryMode ?? ""} onChange={event => update(set, repetition, "recoveryMode", event.target.value)}>
                <option value="">미기록</option><option value="JOG">조깅</option><option value="WALK">걷기</option><option value="STAND">서서 쉬기</option>
              </select></label>
            </div>
          </details>}
        </fieldset>
      })}
    </div>
    {pages > 1 && <nav className="planned-repetition-editor__pages" aria-label="반복 기록 페이지">
      <button type="button" aria-label="앞 반복 보기" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></button>
      <span aria-live="polite">{currentPage + 1}/{pages}</span>
      <button type="button" aria-label="뒤 반복 보기" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>}
  </details>
}
