import React from "react"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import type { CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import type { ExerciseLog } from "../../domain/exercise-log"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import type { PlannedSegmentEvidence } from "../../domain/planned-segment-evidence"
import { PlannedActualNumberInput, type PlannedNumberInputs } from "./planned-number-input"

export function PlannedSegmentEditor({ workout, link, value, onChange, inputs }: {
  readonly workout: CalculatedWorkout; readonly link: PlannedSessionLink; readonly value: ExerciseLog
  readonly onChange: (value: ExerciseLog) => void
  readonly inputs: PlannedNumberInputs
}) {
  const [page, setPage] = React.useState(0)
  const steps = workout.steps.filter(s => s.phase === "main")
  const results = value.plannedSegments?.results ?? []
  const pages = Math.ceil(steps.length / 2), current = Math.min(page, Math.max(0, pages - 1))
  const requestedPage = inputs.focusRequest ? Math.floor(steps.findIndex(s => inputs.focusRequest!.key.startsWith(`segment:${s.key}:`)) / 2) : -1
  React.useEffect(() => { if (requestedPage >= 0) setPage(requestedPage) }, [inputs.focusRequest, requestedPage])
  const clear = () => {
    if (!window.confirm("입력한 구간 기록만 지울까요? 계획과 다른 운동 기록은 그대로 남아요.")) return
    const { plannedSegments: _previous, ...rest } = value
    inputs.clear()
    onChange(rest)
  }
  if (value.plannedSegments && (value.plannedSegments.plannedSessionId !== link.plannedSessionId
    || value.plannedSegments.sessionContentFingerprint !== link.sessionContentFingerprint
    || value.plannedSegments.calculationFingerprint !== workout.fingerprint)) return <p role="alert">기록과 원래 훈련의 연결을 확인하지 못했어요. 입력한 값은 그대로 보관해요.</p>
  const update = (key: string, field: "distanceM" | "seconds" | "rpe", number: number | undefined) => {
    const row: PlannedSegmentEvidence["results"][number] = { ...(results.find(r => r.key === key) ?? { key }) }
    if (number === undefined) delete row[field]
    else row[field] = number
    const next = results.filter(r => r.key !== key)
    if (Object.keys(row).length > 1) next.push(row)
    const { plannedSegments: _old, ...rest } = value
    onChange(next.length ? { ...rest, plannedSegments: { version: 1, source: "SELF_REPORTED", plannedSessionId: link.plannedSessionId,
      sessionContentFingerprint: link.sessionContentFingerprint, calculationFingerprint: workout.fingerprint, results: next } } : rest)
  }
  return <details className="planned-repetition-editor"><summary>구간별로 자세히 남기기{results.length ? ` · ${results.length}개 입력` : ""}</summary>
    {(results.length > 0 || Object.keys(inputs.values).length > 0) && <button className="planned-repetition-editor__clear" type="button" aria-label="구간 기록 지우기" title="구간 기록 지우기" onClick={clear}><Trash2 size={18} aria-hidden="true" /></button>}
    {pages > 1 && <label>세트·구간 바로 이동<select value={current} onChange={event => setPage(Number(event.target.value))}>
      {Array.from({ length: pages }, (_, index) => {
        const group = steps.slice(index * 2, index * 2 + 2)
        const names = group.map((s, offset) => `${s.set ? `${s.set}세트 · ` : ""}${index * 2 + offset + 1}번 ${s.kind === "RECOVERY" ? "회복" : "운동"}`)
        const invalid = group.some(s => inputs.invalidKeys.some(key => key.startsWith(`segment:${s.key}:`)))
        return <option key={index} value={index}>{names.join(" / ")}{invalid ? " · 입력 확인" : ""}</option>
      })}
    </select></label>}
    <div className="planned-repetition-editor__rows">{steps.slice(current * 2, current * 2 + 2).map((s, index) => {
      const label = `${current * 2 + index + 1}번 ${s.kind === "RECOVERY" ? "회복" : "운동"} 구간`
      return <fieldset key={s.key}>
      <legend>{s.set ? `${s.set}세트 · ` : ""}{label}</legend>
      <p>계획: {s.distanceM !== null ? `${s.distanceM}m · ` : ""}{s.seconds ? `${Number(s.seconds.minimum.toFixed(2))}${s.seconds.minimum === s.seconds.maximum ? "" : `~${Number(s.seconds.maximum.toFixed(2))}`}초` : "시간 미지정"}</p>
      <div className="planned-repetition-editor__numbers">
        {s.distanceM !== null && <label>실제 거리 · m<PlannedActualNumberInput inputKey={`segment:${s.key}:distanceM`} label={`${label} 실제 거리`}
          inputs={inputs} value={results.find(r => r.key === s.key)?.distanceM} onValue={n => update(s.key, "distanceM", n)} /></label>}
        <label>실제 시간 · 초<PlannedActualNumberInput inputKey={`segment:${s.key}:seconds`} label={`${label} 실제 시간`}
          inputs={inputs} value={results.find(r => r.key === s.key)?.seconds} onValue={n => update(s.key, "seconds", n)} /></label>
        {s.kind !== "RECOVERY" && <label>느낀 강도 · RPE<PlannedActualNumberInput inputKey={`segment:${s.key}:rpe`} label={`${label} RPE`}
          inputs={inputs} value={results.find(r => r.key === s.key)?.rpe} onValue={n => update(s.key, "rpe", n)} /></label>}
      </div>
    </fieldset> })}</div>
    {pages > 1 && <nav className="planned-repetition-editor__pages" aria-label="운동·회복 구간 페이지">
      <button type="button" aria-label="앞 구간" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /></button>
      <span aria-live="polite">{current + 1}/{pages}</span>
      <button type="button" aria-label="다음 구간" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>}
  </details>
}
