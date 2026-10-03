import React from "react"
import { formatPaceSeconds } from "@impl/prescription/record-pace"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import type { ExerciseLog } from "../../domain/exercise-log"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import { readJournalOriginalPlan } from "../../domain/journal-original-plan"
import { plannedRepeatRecovery, repetitionPrescription, type PlannedRepetitionEvidence } from "../../domain/planned-repetition-evidence"
import "./planned-repetition-editor.css"
import { linkedCatalogWorkout } from "../../domain/planned-segment-evidence"
import { PlannedSegmentEditor } from "./PlannedSegmentEditor"
import { PlannedActualNumberInput, usePlannedNumberInputs, type PlannedNumberInputs } from "./planned-number-input"

type Result = PlannedRepetitionEvidence["results"][number]
export function PlannedRepetitionEditor({ entryId, date, link, value, onChange, inputs: suppliedInputs }: {
  readonly entryId: string; readonly date: string; readonly link?: PlannedSessionLink
  readonly value: ExerciseLog; readonly onChange: (value: ExerciseLog) => void
  readonly inputs?: PlannedNumberInputs
}) {
  const fallbackInputs = usePlannedNumberInputs()
  const inputs = suppliedInputs ?? fallbackInputs
  const saved = value.plannedRepetitions
  const clear = () => {
    if (!window.confirm("입력한 반복 기록만 지울까요? 원래 훈련 계획과 다른 운동 기록은 그대로 남아요.")) return
    const { plannedRepetitions: _previous, plannedSegments: _segments, ...rest } = value
    inputs.clear()
    onChange(rest)
  }
  const clearButton = <button className="planned-repetition-editor__clear" type="button" aria-label="입력한 반복 기록 지우기" title="입력한 반복 기록 지우기" onClick={clear}><Trash2 aria-hidden="true" size={18} /></button>
  const unavailable = saved || value.plannedSegments || Object.keys(inputs.values).length > 0 ? <section className="planned-repetition-editor" aria-label="반복 기록 확인">
    <p role="alert">원래 처방과 연결을 확인하지 못했어요. 입력한 반복 기록은 보존했으며 비교하지 않아요.</p>{clearButton}
  </section> : null
  if (!link) return unavailable
  const original = readJournalOriginalPlan({ id: entryId, date, plannedSessionLink: link })
  if (!("session" in original) || !original.session || original.sourceVerificationPending) return unavailable
  const catalog = linkedCatalogWorkout(link, original.session)
  if (catalog) return <PlannedSegmentEditor workout={catalog} link={link} value={value} onChange={onChange} inputs={inputs} />
  const p = repetitionPrescription(link, original.session)
  if (!p) return unavailable
  if (saved && (saved.plannedSessionId !== link.plannedSessionId || saved.sessionContentFingerprint !== link.sessionContentFingerprint)) {
    return unavailable
  }
  return <LegacyRepetitionEditor p={p} saved={saved} link={link} value={value} onChange={onChange} inputs={inputs} clearButton={clearButton} />
}

function LegacyRepetitionEditor({ p, saved, link, value, onChange, inputs, clearButton }: {
  p: NonNullable<ReturnType<typeof repetitionPrescription>>; saved: PlannedRepetitionEvidence | undefined
  link: PlannedSessionLink; value: ExerciseLog; onChange: (value: ExerciseLog) => void
  inputs: PlannedNumberInputs; clearButton: React.ReactNode
}) {
  const [page, setPage] = React.useState(0)
  React.useEffect(() => {
    const match = /^repeat:(\d+):(\d+):/u.exec(inputs.focusRequest?.key ?? "")
    if (match) setPage(Math.floor(((Number(match[1]) - 1) * p.repetitionsPerSet + Number(match[2]) - 1) / 3))
  }, [inputs.focusRequest, p.repetitionsPerSet])
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
    {(results.length > 0 || Object.keys(inputs.values).length > 0) && clearButton}
    <p>계획 {p.repetitionDistanceM}m · 목표 {formatPaceSeconds(p.targetRepSeconds)}</p>
    {pages > 1 && <label>세트·반복 바로 이동<select value={currentPage} onChange={event => setPage(Number(event.target.value))}>
      {Array.from({ length: pages }, (_, index) => {
        const first = index * 3, last = Math.min(total - 1, first + 2)
        const label = (n: number) => `${Math.floor(n / p.repetitionsPerSet) + 1}세트 ${n % p.repetitionsPerSet + 1}회`
        const invalid = Array.from({ length: last - first + 1 }, (_, offset) => first + offset).some(n =>
          inputs.invalidKeys.some(key => key.startsWith(`repeat:${Math.floor(n / p.repetitionsPerSet) + 1}:${n % p.repetitionsPerSet + 1}:`)))
        return <option key={index} value={index}>{label(first)}~{label(last)}{invalid ? " · 입력 확인" : ""}</option>
      })}
    </select></label>}
    <div className="planned-repetition-editor__rows">
      {Array.from({ length: Math.min(3, total - currentPage * 3) }, (_, offset) => {
        const index = currentPage * 3 + offset
        const set = Math.floor(index / p.repetitionsPerSet) + 1, repetition = index % p.repetitionsPerSet + 1
        const row = results.find(item => item.set === set && item.repetition === repetition)
        const key = `${set}세트 ${repetition}회`, recovery = plannedRepeatRecovery(p, set, repetition)
        return <fieldset key={key}><legend>{p.setCount > 1 ? key : `${repetition}회`}</legend>
          <div className="planned-repetition-editor__numbers">
            <label>실제 거리 · m<PlannedActualNumberInput label={`${key} 실제 거리`} inputKey={`repeat:${set}:${repetition}:distanceM`} inputs={inputs}
              value={row?.distanceM} onValue={n => update(set, repetition, "distanceM", n === undefined ? "" : String(n))} /></label>
            <label>실제 시간 · 초<PlannedActualNumberInput label={`${key} 실제 시간`} inputKey={`repeat:${set}:${repetition}:seconds`} inputs={inputs}
              value={row?.seconds} onValue={n => update(set, repetition, "seconds", n === undefined ? "" : String(n))} /></label>
          </div>
          {recovery && <details><summary>이 반복 뒤 회복 · 계획 {recovery.seconds}초</summary>
            <div className="planned-repetition-editor__numbers">
              <label>실제 회복 · 초<PlannedActualNumberInput label={`${key} 실제 회복`} inputKey={`repeat:${set}:${repetition}:recoverySeconds`} inputs={inputs}
                value={row?.recoverySeconds} onValue={n => update(set, repetition, "recoverySeconds", n === undefined ? "" : String(n))} /></label>
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
