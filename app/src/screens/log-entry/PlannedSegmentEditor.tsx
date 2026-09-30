import React from "react"
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import type { CalculatedWorkout } from "@impl/prescription/all-workout-calculator"
import type { ExerciseLog } from "../../domain/exercise-log"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import type { PlannedSegmentEvidence } from "../../domain/planned-segment-evidence"

export function PlannedSegmentEditor({ workout, link, value, onChange }: {
  readonly workout: CalculatedWorkout; readonly link: PlannedSessionLink; readonly value: ExerciseLog
  readonly onChange: (value: ExerciseLog) => void
}) {
  const [page, setPage] = React.useState(0)
  const steps = workout.steps.filter(s => s.phase === "main")
  const results = value.plannedSegments?.results ?? []
  const pages = Math.ceil(steps.length / 2), current = Math.min(page, Math.max(0, pages - 1))
  const clear = () => {
    if (!window.confirm("입력한 구간 기록만 지울까요? 계획과 다른 운동 기록은 그대로 남아요.")) return
    const { plannedSegments: _previous, ...rest } = value
    onChange(rest)
  }
  if (value.plannedSegments && (value.plannedSegments.plannedSessionId !== link.plannedSessionId
    || value.plannedSegments.sessionContentFingerprint !== link.sessionContentFingerprint
    || value.plannedSegments.calculationFingerprint !== workout.fingerprint)) return <p role="alert">기록과 원래 훈련의 연결을 확인하지 못했어요. 입력한 값은 그대로 보관해요.</p>
  const update = (key: string, field: "distanceM" | "seconds" | "rpe", text: string) => {
    const row: PlannedSegmentEvidence["results"][number] = { ...(results.find(r => r.key === key) ?? { key }) }
    if (text === "") delete row[field]
    else {
      const n = Number(text), allowZero = field === "seconds" && workout.steps.find(s => s.key === key)?.kind === "RECOVERY"
      if (!Number.isFinite(n) || n < (allowZero ? 0 : Number.MIN_VALUE) || n > (field === "rpe" ? 10 : 86400)
        || field === "rpe" && !Number.isInteger(n)) return
      row[field] = n
    }
    const next = results.filter(r => r.key !== key)
    if (Object.keys(row).length > 1) next.push(row)
    const { plannedSegments: _old, ...rest } = value
    onChange(next.length ? { ...rest, plannedSegments: { version: 1, source: "SELF_REPORTED", plannedSessionId: link.plannedSessionId,
      sessionContentFingerprint: link.sessionContentFingerprint, calculationFingerprint: workout.fingerprint, results: next } } : rest)
  }
  return <details className="planned-repetition-editor"><summary>구간별로 자세히 남기기{results.length ? ` · ${results.length}개 입력` : ""}</summary>
    {results.length > 0 && <button className="planned-repetition-editor__clear" type="button" aria-label="구간 기록 지우기" title="구간 기록 지우기" onClick={clear}><Trash2 size={18} aria-hidden="true" /></button>}
    <div className="planned-repetition-editor__rows">{steps.slice(current * 2, current * 2 + 2).map((s, index) => {
      const label = `${current * 2 + index + 1}번 ${s.kind === "RECOVERY" ? "회복" : "운동"} 구간`
      return <fieldset key={s.key}>
      <legend>{s.set ? `${s.set}세트 · ` : ""}{label}</legend>
      <p>{s.distanceM !== null ? `${s.distanceM}m · ` : ""}{s.seconds ? `${Number(s.seconds.minimum.toFixed(2))}${s.seconds.minimum === s.seconds.maximum ? "" : `~${Number(s.seconds.maximum.toFixed(2))}`}초` : "시간 미지정"}</p>
      <div className="planned-repetition-editor__numbers">
        {s.distanceM !== null && <label>실제 거리 · m<input aria-label={`${label} 실제 거리`} type="number" inputMode="decimal" min="0.01" max="86400" step="any" placeholder="미기록"
          value={results.find(r => r.key === s.key)?.distanceM ?? ""} onChange={e => update(s.key, "distanceM", e.target.value)} /></label>}
        <label>실제 시간 · 초<input aria-label={`${label} 실제 시간`} type="number" inputMode="decimal" min={s.kind === "RECOVERY" ? 0 : 0.01} max="86400" step="any" placeholder="미기록"
          value={results.find(r => r.key === s.key)?.seconds ?? ""} onChange={e => update(s.key, "seconds", e.target.value)} /></label>
        {s.kind !== "RECOVERY" && <label>느낀 강도 · RPE<input aria-label={`${label} RPE`} type="number" inputMode="numeric" min="1" max="10" step="1" placeholder="미기록"
          value={results.find(r => r.key === s.key)?.rpe ?? ""} onChange={e => update(s.key, "rpe", e.target.value)} /></label>}
      </div>
    </fieldset> })}</div>
    {pages > 1 && <nav className="planned-repetition-editor__pages" aria-label="운동·회복 구간 페이지">
      <button type="button" aria-label="앞 구간" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft aria-hidden="true" /></button>
      <span aria-live="polite">{current + 1}/{pages}</span>
      <button type="button" aria-label="다음 구간" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}><ChevronRight aria-hidden="true" /></button>
    </nav>}
  </details>
}
