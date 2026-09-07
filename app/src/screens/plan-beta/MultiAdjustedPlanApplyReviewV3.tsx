import React from "react"
import { ArrowLeft, Check } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareMultiAdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-multi-candidate-v3"
import { saveSelectedMultiAdjustedPlanV6, type MultiAdjustedLiveReviewV3, type StoredMultiAdjustedPlanStateV6 } from "../../domain/adjusted-plan-storage-v6"
import { saveSelectedMultiAdjustedSuccessorV3 } from "../../domain/multi-adjusted-plan-successor-v3"
import type { MultiAdjustedPlanSelectionRequestV3 } from "../../domain/selected-multi-adjusted-plan-v3"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { MultiPlanLayoutSummaryV3 } from "./MultiPlanLayoutSummaryV3"
import { isoShift } from "../../domain/dates"
import { planErrorMessage } from "./plan-feedback"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import "./AdjustedPlanNextFlow.css"

export type MultiAdjustmentEntryV3 = {
  readonly seed: MultiAdjustedPlanSelectionRequestV3;
  readonly readReview: () => MultiAdjustedLiveReviewV3;
  readonly locks?: PlanMutationLockManager | null;
}
const identity = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-apply-ui.v3", value)
export function MultiAdjustedPlanApplyReviewV3({ seed, readReview, locks, isCurrentDraft, onSaved, onCancel, expectedPredecessorFingerprint }: MultiAdjustmentEntryV3 & {
  readonly isCurrentDraft: () => boolean; readonly onSaved: (state: StoredMultiAdjustedPlanStateV6) => void;
  readonly onCancel: () => void; readonly expectedPredecessorFingerprint?: string;
}) {
  const [opened] = React.useState(() => {
    const request = structuredClone(seed)
    let bindings: MultiAdjustedLiveReviewV3["rpeBindings"] = []
    try { bindings = structuredClone(readReview().rpeBindings) } catch { /* Missing review keeps the preview unavailable. */ }
    return { request, fingerprint: identity(seed), bindings, expectedPredecessorFingerprint }
  })
  const live = React.useRef({ seed, readReview, isCurrentDraft, onSaved, expectedPredecessorFingerprint })
  live.current = { seed, readReview, isCurrentDraft, onSaved, expectedPredecessorFingerprint }
  const valid = React.useRef(true), pending = React.useRef(false)
  const [saving, setSaving] = React.useState(false), [error, setError] = React.useState<string | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null), id = React.useId()
  useActiveContentScroll("multi-review-v3", heading, heading)
  React.useEffect(() => { valid.current = true; return () => { valid.current = false } }, [])
  const current = () => valid.current && live.current.isCurrentDraft()
    && identity(live.current.seed) === opened.fingerprint
    && live.current.expectedPredecessorFingerprint === opened.expectedPredecessorFingerprint
  const prepared = prepareMultiAdjustedPlanCandidateV3(opened.request.preparations, opened.bindings)
  const apply = async () => {
    if (pending.current || !valid.current) return
    pending.current = true; setSaving(true); setError(null)
    try {
      const input = { request: opened.request, readReview: () => live.current.readReview(), isCurrentDraft: current, locks }
      const result = opened.expectedPredecessorFingerprint === undefined
        ? await saveSelectedMultiAdjustedPlanV6(input)
        : await saveSelectedMultiAdjustedSuccessorV3({ ...input, expectedPredecessorFingerprint: opened.expectedPredecessorFingerprint })
      if (!valid.current) return
      if (result.kind === "saved") { valid.current = false; live.current.onSaved(result.state) }
      else setError(planErrorMessage(result.code))
    } catch { if (valid.current) setError("계획을 저장하지 못했어요. 현재 일정을 다시 확인해 주세요.") }
    finally { pending.current = false; if (valid.current) setSaving(false) }
  }
  return <section className="adjusted-next-flow" aria-labelledby={`${id}-title`} aria-busy={saving}>
    <button type="button" disabled={saving} onClick={() => { valid.current = false; onCancel() }}><ArrowLeft size={18} aria-hidden="true" />후보로 돌아가기</button>
    <h1 ref={heading} tabIndex={-1} id={`${id}-title`}>{opened.expectedPredecessorFingerprint === undefined ? "고른 훈련들로 계획을 저장할까요?" : "고른 훈련들로 다음 계획을 저장할까요?"}</h1>
    <p>{opened.expectedPredecessorFingerprint === undefined ? "아직 저장하지 않았어요. 날짜와 훈련 방법을 확인해 주세요."
      : "아직 이전 계획을 유지하고 있어요. 저장하면 이전 원본과 일지 연결은 보관하고 다음 일정으로 전환해요."}</p>
    {prepared.kind === "prepared" ? <>
      <MultiPlanLayoutSummaryV3 before={opened.request.preparations[0]!.candidate.sessions}
        after={prepared.candidate.sessions} startDate={prepared.candidate.startDate} />
      {prepared.candidate.sessions.filter(s => prepared.candidate.changedSlots.some(c => c.day === s.day && c.slot === s.slot)).map(session =>
        <section key={`${session.day}-${session.slot}`} aria-label="적용할 훈련">
          <h2>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
          <AdjustedPrescriptionV3 session={session} explanation={opened.request.preparations.find(p => p.address.day === session.day && p.address.slot === session.slot)?.explanation} />
        </section>)}
      <details><summary>전체 일정 확인</summary>{prepared.candidate.sessions.map(session => <section key={`${session.day}-${session.slot}`}>
        <h2>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
        <AdjustedPrescriptionV3 session={session} explanation={opened.request.preparations.find(p => p.address.day === session.day && p.address.slot === session.slot)?.explanation} />
      </section>)}</details>
    </> : <p role="alert">구성과 설명의 연결을 확인하지 못했어요. 후보로 돌아가 다시 선택해 주세요.</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={saving || prepared.kind !== "prepared"} onClick={() => void apply()}><Check size={18} aria-hidden="true" />{saving ? "저장 중" : "이 구성으로 계획 저장"}</button>
  </section>
}
