import React from "react"
import { Check, ArrowLeft } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareAdjustedPlanCandidate } from "../../domain/adjusted-plan-candidate"
import { saveSelectedAdjustedPlan, saveSelectedAdjustedSuccessor } from "../../domain/adjusted-plan-store"
import type { AdjustedPlanSelectionRequest } from "../../domain/adjusted-plan-selection"
import type { StoredAdjustedPlanState } from "../../domain/adjusted-plan-storage-schema"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import { isoShift } from "../../domain/dates"

type SaveInput = Parameters<typeof saveSelectedAdjustedPlan>[0]
const identity = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-apply-ui.v1", value)

/** Final whole-plan confirmation after the editor, not an editor draft commit.
 * The owning flow supplies current trusted review data, never local-storage authority. */
export function AdjustedPlanApplyReview({ request, readReview, isCurrentDraft, locks, onSaved, onCancel, expectedPredecessorFingerprint }: {
  readonly request: AdjustedPlanSelectionRequest
  readonly readReview: SaveInput["readReview"]
  readonly isCurrentDraft: () => boolean
  readonly locks?: SaveInput["locks"]
  readonly onSaved: (state: StoredAdjustedPlanState) => void
  readonly onCancel: () => void
  readonly expectedPredecessorFingerprint?: string
}) {
  const [opened] = React.useState(() => ({ request: structuredClone(request), fingerprint: identity(request), expectedPredecessorFingerprint }))
  const live = React.useRef({ request, isCurrentDraft, onSaved, readReview, expectedPredecessorFingerprint })
  live.current = { request, isCurrentDraft, onSaved, readReview, expectedPredecessorFingerprint }
  const valid = React.useRef(true)
  const inFlight = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => { valid.current = true; return () => { valid.current = false } }, [])
  const prepared = prepareAdjustedPlanCandidate(opened.request.preparation)
  const current = () => valid.current && live.current.isCurrentDraft()
    && identity(live.current.request) === opened.fingerprint
    && live.current.expectedPredecessorFingerprint === opened.expectedPredecessorFingerprint
  const apply = async () => {
    if (inFlight.current || !valid.current) return
    inFlight.current = true; setSaving(true); setError(null)
    try {
      const save = { request: opened.request, readReview: () => live.current.readReview(), isCurrentDraft: current, locks }
      const result = opened.expectedPredecessorFingerprint === undefined
        ? await saveSelectedAdjustedPlan(save)
        : await saveSelectedAdjustedSuccessor({ ...save, expectedPredecessorFingerprint: opened.expectedPredecessorFingerprint })
      if (!valid.current) return
      if (result.kind === "saved") { valid.current = false; live.current.onSaved(result.state) }
      else setError(result.code === "PLAN_STORAGE_STATE_UNCERTAIN"
        ? "저장 상태를 확인하지 못했어요. 계획 화면을 다시 열어 저장 여부를 확인해 주세요."
        : "계획을 적용하지 않았어요. 기록이나 검토 기준이 바뀌었을 수 있으니 다시 확인해 주세요.")
    } finally { inFlight.current = false; if (valid.current) setSaving(false) }
  }
  return <section aria-labelledby="adjusted-apply-title">
    <button type="button" onClick={() => { valid.current = false; onCancel() }}><ArrowLeft size={18} aria-hidden="true" />돌아가기</button>
    <h1 id="adjusted-apply-title">{opened.expectedPredecessorFingerprint === undefined
      ? "변경한 훈련을 계획에 적용할까요?" : "이 구성으로 다음 계획을 저장할까요?"}</h1>
    <p>{opened.expectedPredecessorFingerprint === undefined
      ? "아직 저장하지 않았어요. 아래 훈련만 바뀌고 다른 날짜의 훈련은 그대로예요."
      : "아직 이전 계획을 유지하고 있어요. 저장하면 이전 원본을 보관하고, 검토한 다음 계획으로 전환해요."}</p>
    {prepared.kind === "prepared" ? prepared.candidate.sessions.filter(session =>
      session.day === prepared.candidate.changedSlot.day && session.slot === prepared.candidate.changedSlot.slot).map(session =>
        <section key={session.slot} aria-label="적용할 훈련">
          <h2>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
          <AdjustedJournalOriginalPlan session={session} explanation={opened.request.preparation.explanation} context="preview" />
        </section>) : <p role="alert">변경안의 수치와 근거를 확인하지 못했어요. 돌아가서 다시 선택해 주세요.</p>}
    {error !== null && <p role="alert">{error}</p>}
    <button type="button" disabled={saving || prepared.kind !== "prepared"} onClick={() => void apply()}>
      <Check size={18} aria-hidden="true" />{saving ? "저장 중" : "이 구성으로 계획 저장"}
    </button>
  </section>
}
