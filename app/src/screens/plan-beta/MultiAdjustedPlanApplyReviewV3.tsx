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
import { checkSessionAvailabilityV3, exactSessionSecondsV3, type SessionAvailabilityLimitV3 } from "../../domain/prescription-availability-v3"
import { formatTrainingSeconds } from "./labels"
import "./AdjustedPlanNextFlow.css"

export type MultiAdjustmentEntryV3 = {
  readonly seed: MultiAdjustedPlanSelectionRequestV3;
  readonly readReview: () => MultiAdjustedLiveReviewV3;
  readonly locks?: PlanMutationLockManager | null;
}
const identity = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-adjusted-apply-ui.v3", value)
const availabilityMessage = (code: string) => code === "AVAILABILITY_LIMIT_EXCEEDED"
  ? "가능 시간을 넘어요. 다른 구성을 고르거나 가능한 시간을 바꿔 주세요."
  : code === "AVAILABILITY_DURATION_UNRESOLVED" ? "전체 시간을 계산할 수 없어 정한 시간 안에 마칠 수 있는지 확인하지 못했어요."
    : "가능 시간은 0보다 큰 숫자로 입력해 주세요."
function readLimits(values: Readonly<Record<string, string>>): SessionAvailabilityLimitV3[] {
  return Object.entries(values).filter(([, value]) => value.trim() !== "").map(([key, value]) => {
    const [day, slot] = key.split(":")
    return { day: Number(day), slot: slot as "AM" | "PM", maximumSeconds: Number(value) * 60 }
  })
}
export function MultiAdjustedPlanApplyReviewV3({ seed, readReview, locks, isCurrentDraft, onSaved, onCancel, expectedPredecessorFingerprint,
  availabilityDraft, onAvailabilityDraftChange }: MultiAdjustmentEntryV3 & {
  readonly isCurrentDraft: () => boolean; readonly onSaved: (state: StoredMultiAdjustedPlanStateV6) => void;
  readonly onCancel: () => void; readonly expectedPredecessorFingerprint?: string;
  readonly availabilityDraft?: Readonly<Record<string, string>>;
  readonly onAvailabilityDraftChange?: (draft: Record<string, string>) => void;
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
  const [availableMinutes, setAvailableMinutes] = React.useState<Record<string, string>>(() => availabilityDraft ? { ...availabilityDraft } : Object.fromEntries(
    (opened.request.availabilityLimits ?? []).map(limit => [`${limit.day}:${limit.slot}`, String(limit.maximumSeconds / 60)])))
  const availableRef = React.useRef(availableMinutes)
  const heading = React.useRef<HTMLHeadingElement>(null), id = React.useId()
  useActiveContentScroll("multi-review-v3", heading, heading)
  React.useEffect(() => { valid.current = true; return () => { valid.current = false } }, [])
  const current = () => valid.current && live.current.isCurrentDraft()
    && identity(live.current.seed) === opened.fingerprint
    && live.current.expectedPredecessorFingerprint === opened.expectedPredecessorFingerprint
  const prepared = prepareMultiAdjustedPlanCandidateV3(opened.request.preparations, opened.bindings)
  const limits = readLimits(availableMinutes)
  const availability = prepared.kind === "prepared" ? checkSessionAvailabilityV3(prepared.candidate.sessions, limits) : null
  const apply = async () => {
    if (pending.current || !valid.current) return
    const selectedLimits = readLimits(availableRef.current)
    const timeCheck = prepared.kind === "prepared" ? checkSessionAvailabilityV3(prepared.candidate.sessions, selectedLimits) : null
    if (timeCheck?.kind !== "checked") { setError(timeCheck ? availabilityMessage(timeCheck.code) : "구성을 다시 확인해 주세요."); return }
    const timeIdentity = identity(availableRef.current)
    pending.current = true; setSaving(true); setError(null)
    try {
      const { availabilityLimits: _previousLimits, ...request } = opened.request
      const input = { request: { ...request, ...(selectedLimits.length ? { availabilityLimits: selectedLimits } : {}) },
        readReview: () => live.current.readReview(), isCurrentDraft: () => current() && identity(availableRef.current) === timeIdentity, locks }
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
      <details><summary>가능 시간 정하기 · 선택</summary>
        <p>처음 안내한 시간은 예상치예요. 시간을 직접 정하면 준비·회복·정리까지 그 안에 들어오는 구성만 저장해요. 비워 두면 시간 제한을 두지 않아요.</p>
        <div className="plan-availability-fields">{prepared.candidate.sessions.map(session => {
          const key = `${session.day}:${session.slot}`, fieldId = `${id}-time-${session.day}-${session.slot}`
          const seconds = exactSessionSecondsV3(session)
          const fieldCheck = checkSessionAvailabilityV3([session], readLimits({ [key]: availableMinutes[key] ?? "" }))
          return <div key={key}>
            <label htmlFor={fieldId}>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"} 가능 시간 (분)</label>
            <input id={fieldId} type="text" inputMode="decimal" disabled={saving} value={availableMinutes[key] ?? ""}
              aria-describedby={`${fieldId}-help`} aria-invalid={fieldCheck.kind === "rejected"}
              onChange={event => { const next = { ...availableRef.current, [key]: event.target.value }; availableRef.current = next; setAvailableMinutes(next); onAvailabilityDraftChange?.(next); setError(null) }} />
            <p id={`${fieldId}-help`}>{seconds === null ? "현재 구성의 전체 시간 미산출" : `현재 구성 ${formatTrainingSeconds(seconds)}`}
              {fieldCheck.kind === "rejected" && ` · ${availabilityMessage(fieldCheck.code)}`}</p>
          </div>
        })}</div>
      </details>
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
    {availability?.kind === "rejected" && <p role="alert">{availabilityMessage(availability.code)}</p>}
    <button type="button" disabled={saving || prepared.kind !== "prepared" || availability?.kind !== "checked"} onClick={() => void apply()}><Check size={18} aria-hidden="true" />{saving ? "저장 중" : "이 구성으로 계획 저장"}</button>
  </section>
}
