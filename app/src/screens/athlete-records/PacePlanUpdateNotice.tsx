import React from "react"
import "./pace-plan-update.css"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { formatPaceSeconds } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "../../domain/athlete-records"
import type { ActivePlanEditPreparation } from "../../domain/active-plan-edit"
import { applyActivePlanEdit, prepareCurrentPaceUpdate, prepareCurrentPaceUndo } from "../../domain/active-plan-edit-store"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "../../domain/account/local-account-scope"

export function PacePlanUpdateNotice({ record, onDone, explicitPaceBasis = false }: { record: AthleteRecord; onDone: () => void; explicitPaceBasis?: boolean }) {
  const [preparation, setPreparation] = React.useState<ActivePlanEditPreparation | null>(null)
  const [busy, setBusy] = React.useState(true)
  const [confirmed, setConfirmed] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [applied, setApplied] = React.useState(false)
  const [undone, setUndone] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const applying = React.useRef(false)
  const live = React.useRef(true)
  const [uncertain, setUncertain] = React.useState(false)
  React.useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  React.useEffect(() => {
    let current = true
    setBusy(true); setPreparation(null); setConfirmed(false); setApplied(false); setUndone(false); setMessage("")
    const scope = localAccountScopeSnapshot()
    prepareCurrentPaceUpdate(record, explicitPaceBasis).then(result => {
      if (current && localAccountScopeIsCurrent(scope)) setPreparation(result)
    }).catch(() => {
      if (current) setMessage("변경안을 불러오지 못했어요. 원래 계획은 그대로예요.")
    }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  }, [record, retry, explicitPaceBasis])
  const changes = preparation?.kind === "ready" ? preparation.proposal.afterSessions.flatMap(after => {
    const before = preparation.proposal.beforeSessions.find(row => row.day === after.day && row.slot === after.slot)
    if (!before || JSON.stringify(before) === JSON.stringify(after)) return []
    if (before.prescription.kind === "PACE_TARGET" && after.prescription.kind === "PACE_TARGET") return [{ day: after.day, slot: after.slot,
      rows: [`${after.prescription.repetitionDistanceM}m: ${formatPaceSeconds(before.prescription.targetRepSeconds)} → ${formatPaceSeconds(after.prescription.targetRepSeconds)}`] }]
    const old = before.prescription.kind === "RPE_TIME_RANGE" && before.prescription.catalogWorkout
      ? resolveCatalogBinding(before.prescription.catalogWorkout) : null
    const next = after.prescription.kind === "RPE_TIME_RANGE" && after.prescription.catalogWorkout
      ? resolveCatalogBinding(after.prescription.catalogWorkout) : null
    const referenceKinds = (session: typeof after) => session.prescription.kind === "RPE_TIME_RANGE"
      ? session.prescription.catalogWorkout?.inputs.paceReferences?.map(ref => [ref.segmentId, ref.kind, ref.recordId, ref.recordVersion]) ?? null : null
    const basisRows = JSON.stringify(referenceKinds(before)) !== JSON.stringify(referenceKinds(after))
      ? [`기준: ${record.eventDistanceM}m ${formatPaceSeconds(record.performanceSeconds)} · ${record.purpose === "RACE_GOAL" ? "목표" : record.achievedOn ?? "날짜 미입력"}`] : []
    return [{ day: after.day, slot: after.slot, rows: [...basisRows, ...(next?.steps.filter(step => step.kind === "WORK").flatMap(step => {
      const previous = old?.steps.find(row => row.segmentId === step.segmentId)
      if (!previous || JSON.stringify([previous.seconds, previous.paceSecondsPerKm]) === JSON.stringify([step.seconds, step.paceSecondsPerKm])) return []
      const range = (value: typeof step.seconds) => value ? value.minimum === value.maximum
        ? formatPaceSeconds(value.minimum) : `${formatPaceSeconds(value.minimum)}~${formatPaceSeconds(value.maximum)}` : "체감 강도 기준"
      return [step.distanceM ? `${step.distanceM}m: ${range(previous.seconds)} → ${range(step.seconds)}`
        : `${range(step.seconds)} 달리기 · ${range(previous.paceSecondsPerKm)} → ${range(step.paceSecondsPerKm)}/km`]
    }) ?? [])] }]
  }) : []
  const apply = async () => {
    if (preparation?.kind !== "ready" || !confirmed || applying.current || applied || uncertain) return
    const scope = localAccountScopeSnapshot()
    applying.current = true; setBusy(true)
    try {
      const result = await applyActivePlanEdit(preparation.proposal, true)
      if (!live.current || !localAccountScopeIsCurrent(scope)) return
      if (result.kind === "applied") {
        setApplied(true); setMessage("남은 훈련에 적용했어요. 이전 훈련과 일지는 그대로예요.")
      } else {
        setUncertain(result.kind === "uncertain")
        setPreparation(null); setConfirmed(false); setMessage(result.message)
      }
    } catch {
      if (!live.current || !localAccountScopeIsCurrent(scope)) return
      setUncertain(true)
      setPreparation(null); setConfirmed(false)
      setMessage("저장 결과를 확인하지 못했어요. 계획을 다시 불러온 뒤 확인해 주세요.")
    } finally { applying.current = false; setBusy(false) }
  }
  const undo = async () => {
    if (!applied || undone || applying.current || uncertain) return
    const scope = localAccountScopeSnapshot()
    applying.current = true; setBusy(true)
    try {
      const restoration = await prepareCurrentPaceUndo()
      if (!live.current || !localAccountScopeIsCurrent(scope)) return
      if (restoration.kind !== "ready") { setMessage(restoration.message); return }
      const result = await applyActivePlanEdit(restoration.proposal, true)
      if (!live.current || !localAccountScopeIsCurrent(scope)) return
      if (result.kind === "applied") {
        setUndone(true); setMessage("변경 전 페이스로 되돌렸어요. 경기 기록은 그대로 보관해요.")
      } else { setUncertain(result.kind === "uncertain"); setMessage(result.message) }
    } catch { if (live.current && localAccountScopeIsCurrent(scope)) { setUncertain(true); setMessage("되돌리기 결과를 확인하지 못했어요. 계획을 다시 불러와 확인해 주세요.") } }
    finally { applying.current = false; setBusy(false) }
  }
  return <section className="pace-plan-update" aria-label="기록에 따른 계획 변경" aria-busy={busy}>
    {busy && <p role="status">{applying.current ? "계획을 저장하고 있어요…" : "바꿀 수 있는 훈련을 확인하고 있어요…"}</p>}
    {!applied && preparation?.kind === "ready" && <>
      <h2>남은 훈련 {changes.length}개의 페이스를 바꿀 수 있어요</h2>
      <p>{record.eventDistanceM === 21097.5 ? "하프" : `${record.eventDistanceM}m`} {formatPaceSeconds(record.performanceSeconds)} · {record.purpose === "RACE_GOAL" ? "목표기록" : record.achievedOn ?? "날짜 미입력"}</p>
      <ul>{changes.map(change => <li key={`${change.day}:${change.slot}`}>{change.day}일째 {change.slot === "AM" ? "오전" : "오후"}<ul>{[...new Set(change.rows)].map(row => <li key={row}>{row}</li>)}</ul></li>)}</ul>
      <details><summary>그대로 두는 훈련</summary><p>과거·수행 기록이 있는 훈련, 직접 고정한 구간, 다른 종목 기록을 쓰는 구간은 바꾸지 않아요. 반복·거리·세트·회복·일정도 유지해요.</p></details>
      {preparation.excluded && preparation.excluded.length > 0 && <details><summary>제외한 훈련 {preparation.excluded.length}개</summary><ul>{preparation.excluded.map(row => <li key={`${row.day}:${row.slot}`}>{row.day}일째 {row.slot === "AM" ? "오전" : "오후"} · {row.reason}</li>)}</ul></details>}
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />바꿀 훈련은 아직 시작하지 않았고, 새 통증이나 이상은 없어요.</label>
      {record.purpose === "RACE_GOAL" && <p>목표 페이스는 현재 실력을 뜻하지 않아요. 변경할 초를 확인해 주세요.</p>}
      <button className="pace-plan-update-primary" type="button" disabled={!confirmed || busy} onClick={() => void apply()}>남은 훈련에 적용</button>
    </>}
    {preparation?.kind === "blocked" && <>
      <p role="status">{preparation.message}</p>
      {!!preparation.excluded?.length && <details><summary>바꾸지 않은 훈련 {preparation.excluded.length}개</summary>
        <ul>{preparation.excluded.map(row => <li key={`${row.day}:${row.slot}`}>{row.day}일째 {row.slot === "AM" ? "오전" : "오후"} · {row.reason}</li>)}</ul>
      </details>}
    </>}
    {message && <p role="status">{message}</p>}
    {applied && !undone && !uncertain && <button type="button" disabled={busy} onClick={() => void undo()}>이번 페이스 변경 되돌리기</button>}
    {!busy && !applied && !uncertain && (message || preparation?.kind === "blocked") && <button type="button" onClick={() => setRetry(value => value + 1)}>변경안 다시 확인</button>}
    <button type="button" disabled={busy} onClick={onDone}>{uncertain ? "계획으로 돌아가 저장 확인" : applied ? "계획으로 돌아가기" : "계획은 그대로 두기"}</button>
  </section>
}
