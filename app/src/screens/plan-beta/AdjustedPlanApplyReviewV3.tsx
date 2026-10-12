import React from "react"
import { ArrowLeft, Check } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { deriveSequenceV3Totals } from "@impl/prescription/sequence-v3"
import { prepareAdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-candidate"
import { saveSelectedAdjustedPlanV3, type StoredAdjustedPlanStateV5 } from "../../domain/adjusted-plan-storage-v5"
import { saveSelectedAdjustedSuccessorV3 } from "../../domain/adjusted-plan-successor-v3"
import type { AdjustmentEntryV3 } from "./adjustment-entry-v3"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { formatTrainingSeconds } from "./labels"
import { isoShift } from "../../domain/dates"
import { planErrorMessage } from "./plan-feedback"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import "./AdjustedPlanNextFlow.css"
import "./PrescriptionAdjustmentEditor.css"
import type { CatalogCycleDraftContext } from "../../domain/catalog-cycle-draft"

const identity = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-apply-ui.v3", value)

export function AdjustedPlanApplyReviewV3({ seed, readReview, locks, isCurrentDraft, onSaved, onCancel, expectedPredecessorFingerprint, cycleDraft }: AdjustmentEntryV3 & {
  readonly isCurrentDraft: () => boolean
  readonly onSaved: (state: StoredAdjustedPlanStateV5) => void
  readonly onCancel: () => void
  readonly expectedPredecessorFingerprint?: string
  readonly cycleDraft?: CatalogCycleDraftContext
}) {
  const [opened] = React.useState(() => ({ request: structuredClone(seed), fingerprint: identity(seed), expectedPredecessorFingerprint,
    cycleDraft: structuredClone(cycleDraft) }))
  const live = React.useRef({ seed, readReview, isCurrentDraft, onSaved, expectedPredecessorFingerprint, cycleDraft })
  live.current = { seed, readReview, isCurrentDraft, onSaved, expectedPredecessorFingerprint, cycleDraft }
  const valid = React.useRef(true), pending = React.useRef(false)
  const [environmentConfirmed, setEnvironmentConfirmed] = React.useState(false)
  const environment = React.useRef(false)
  const [saving, setSaving] = React.useState(false), [error, setError] = React.useState<string | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null), id = React.useId()
  useActiveContentScroll("review-v3", heading, heading)
  React.useEffect(() => { valid.current = true; return () => { valid.current = false } }, [])
  const current = () => valid.current && live.current.isCurrentDraft()
    && identity(live.current.seed) === opened.fingerprint
    && live.current.expectedPredecessorFingerprint === opened.expectedPredecessorFingerprint
    && identity(live.current.cycleDraft ?? null) === identity(opened.cycleDraft ?? null)
    && (opened.expectedPredecessorFingerprint === undefined || environment.current)
  const prepared = React.useMemo(() => prepareAdjustedPlanCandidateV3(opened.request.preparation), [opened])
  const comparison = prepared.kind === "prepared" ? (() => {
    const address = prepared.candidate.changedSlot
    const original = opened.request.preparation.candidate.sessions.find(session =>
      session.day === address.day && session.slot === address.slot)
    const changed = prepared.candidate.sessions.find(session =>
      session.day === address.day && session.slot === address.slot)
    if (original?.role !== "QUALITY" || original.prescription.kind !== "PACE_TARGET"
      || changed?.role !== "QUALITY" || changed.prescription.kind !== "ADJUSTED_METHOD_V3") return null
    const receipt = changed.prescription.snapshot.receipt
    return { original, changed,
      before: deriveSequenceV3Totals(receipt.before.sequence).main,
      after: deriveSequenceV3Totals(receipt.after.sequence).main }
  })() : null
  const comparisonMetrics = [
    ["repetitionBlocks", "반복 횟수", "회"], ["workDistanceM", "본운동 거리", "m"],
    ["workSeconds", "본운동 시간", "초"], ["recoverySeconds", "회복 시간", "초"],
    ["recoveryDistanceM", "회복 거리", "m"], ["totalSeconds", "본운동 소요시간", "초"],
  ] as const
  const comparisonRows = comparison ? comparisonMetrics.flatMap(([key, label, unit]) => {
    const before = comparison.before[key], after = comparison.after[key]
    return before === null && after === null ? [] : [{ key, label, unit, before, after }]
  }) : []
  const apply = async () => {
    if (pending.current || !valid.current) return
    pending.current = true; setSaving(true); setError(null)
    try {
      const input = { request: opened.request, readReview: () => live.current.readReview(), isCurrentDraft: current, locks }
      const result = opened.expectedPredecessorFingerprint === undefined
        ? await saveSelectedAdjustedPlanV3(input)
        : await saveSelectedAdjustedSuccessorV3({ ...input, expectedPredecessorFingerprint: opened.expectedPredecessorFingerprint,
          cycleDraft: opened.cycleDraft, futureEnvironmentConfirmed: environment.current })
      if (!valid.current) return
      if (result.kind === "saved") { valid.current = false; live.current.onSaved(result.state) }
      else setError(planErrorMessage(result.code))
    } catch { if (valid.current) setError("계획을 저장하지 못했어요. 현재 일정을 다시 확인해 주세요.") }
    finally { pending.current = false; if (valid.current) setSaving(false) }
  }
  return <section className="adjusted-next-flow" aria-labelledby={`${id}-title`} aria-busy={saving}>
    <button type="button" disabled={saving} onClick={() => { valid.current = false; onCancel() }}>
      <ArrowLeft size={18} aria-hidden="true" />후보로 돌아가기</button>
    <h1 ref={heading} tabIndex={-1} id={`${id}-title`}>{opened.expectedPredecessorFingerprint === undefined
      ? "이 훈련 구성으로 계획을 저장할까요?" : "이 구성으로 다음 계획을 저장할까요?"}</h1>
    <p>{opened.expectedPredecessorFingerprint === undefined ? "아직 저장하지 않았어요. 날짜와 훈련 방법을 확인해 주세요."
      : "아직 이전 계획을 유지하고 있어요. 저장하면 이전 원본과 일지 연결은 보관하고 다음 일정으로 전환해요."}</p>
    {prepared.kind === "prepared" ? <>
      {comparison ? <>
        <section aria-label="현재와 변경안 핵심 비교">
          <h2>현재와 변경안</h2>
          <p>{isoShift(prepared.candidate.startDate, comparison.changed.day - 1)} · {comparison.changed.slot === "AM" ? "오전" : "오후"}</p>
          <table className="prescription-adjustment__totals" aria-label="현재와 변경안 핵심 수치">
            <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경안</th></tr></thead>
            <tbody>{comparisonRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>
              <td>{row.before === null ? "—" : row.unit === "초" ? formatTrainingSeconds(row.before) : `${row.before}${row.unit}`}</td>
              <td>{row.after === null ? "—" : row.unit === "초" ? formatTrainingSeconds(row.after) : `${row.after}${row.unit}`}</td></tr>)}</tbody>
          </table>
          {comparisonRows.some(row => row.before === null || row.after === null)
            && <p className="prescription-adjustment__note">자료가 없는 항목은 추정하지 않았어요.</p>}
          <section aria-label="현재 구성">
            <h3>현재 구성</h3>
            <AdjustedPrescriptionV3 session={comparison.original} explanation={opened.request.preparation.explanation} />
          </section>
          <section aria-label="변경 후 구성">
            <h3>변경 후 구성</h3>
            <AdjustedPrescriptionV3 session={comparison.changed} explanation={opened.request.preparation.explanation} />
          </section>
        </section>
      </> : <p role="alert">현재 구성과 변경안을 함께 확인할 수 없어 저장하지 않았어요. 후보로 돌아가 다시 확인해 주세요.</p>}
      <details><summary>전체 일정 확인</summary>{prepared.candidate.sessions.map(session => <section key={`${session.day}-${session.slot}`}>
        <h2>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
        <AdjustedPrescriptionV3 session={session} explanation={opened.request.preparation.explanation} />
      </section>)}</details>
    </> : <p role="alert">구성과 설명의 연결을 확인하지 못했어요. 후보로 돌아가 다시 선택해 주세요.</p>}
    {error && <p role="alert">{error}</p>}
    {opened.expectedPredecessorFingerprint !== undefined && <label><input type="checkbox" checked={environmentConfirmed} disabled={saving}
      onChange={event => { environment.current = event.target.checked; setEnvironmentConfirmed(event.target.checked) }} />
      다음 날짜에도 이 훈련에 필요한 장소와 시간을 확보했어요</label>}
    <button type="button" disabled={saving || prepared.kind !== "prepared" || comparison === null || opened.expectedPredecessorFingerprint !== undefined && !environmentConfirmed} onClick={() => void apply()}>
      <Check size={18} aria-hidden="true" />{saving ? "저장 중" : "이 구성으로 계획 저장"}</button>
  </section>
}
