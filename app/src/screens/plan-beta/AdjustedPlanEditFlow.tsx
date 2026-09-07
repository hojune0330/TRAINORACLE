import React from "react"
import type { AdjustmentReceipt } from "@impl/prescription/prescription-adjustment"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { prepareSourceAdjustmentOffer } from "../../domain/source-adjustment-offer"
import { createAdjustedMethodSnapshot } from "../../domain/adjusted-method-snapshot"
import { prepareAdjustedPlanCandidate, resolveAdjustedCandidateScope } from "../../domain/adjusted-plan-candidate"
import type { AdjustedPlanSelectionRequest } from "../../domain/adjusted-plan-selection"
import type { saveSelectedAdjustedPlan } from "../../domain/adjusted-plan-store"
import type { StoredAdjustedPlanState } from "../../domain/adjusted-plan-storage-schema"
import { PrescriptionAdjustmentEditor } from "./PrescriptionAdjustmentEditor"
import { AdjustedPlanApplyReview } from "./AdjustedPlanApplyReview"

type SaveInput = Parameters<typeof saveSelectedAdjustedPlan>[0]
type Review = ReturnType<SaveInput["readReview"]>
const fingerprint = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-edit-flow.v1", value)

/** The owning candidate flow supplies a current whole-plan context and trusted
 * configuration-specific reviews. Editor Apply stages; final Apply saves. */
export function AdjustedPlanEditFlow({ seed, readReview, isCurrentDraft, onSaved, onCancel, locks, expectedPredecessorFingerprint }: {
  readonly seed: AdjustedPlanSelectionRequest
  readonly readReview: (receipt: AdjustmentReceipt) => Review
  readonly isCurrentDraft: () => boolean
  readonly onSaved: (state: StoredAdjustedPlanState) => void
  readonly onCancel: () => void
  readonly locks?: SaveInput["locks"]
  readonly expectedPredecessorFingerprint?: string
}) {
  const [opened] = React.useState(() => structuredClone(seed))
  const openingIdentity = React.useRef(fingerprint(seed))
  const openingPredecessor = React.useRef(expectedPredecessorFingerprint)
  const live = React.useRef({ seed, isCurrentDraft, readReview })
  live.current = { seed, isCurrentDraft, readReview }
  const [staged, setStaged] = React.useState<{ request: AdjustedPlanSelectionRequest; receipt: AdjustmentReceipt } | null>(null)
  const offer = prepareSourceAdjustmentOffer({ ...opened.preparation.source, nowMs: Date.now() })
  const current = () => live.current.isCurrentDraft() && fingerprint(live.current.seed) === openingIdentity.current
    && expectedPredecessorFingerprint === openingPredecessor.current
  if (staged !== null) return <AdjustedPlanApplyReview request={staged.request}
    readReview={() => live.current.readReview(staged.receipt)} isCurrentDraft={current}
    locks={locks} onSaved={onSaved} onCancel={onCancel} expectedPredecessorFingerprint={expectedPredecessorFingerprint} />
  if (offer.kind !== "available") return <section>
    <p role="alert">지금 적용할 수 있는 조정 구성을 확인하지 못했어요. 계획은 바뀌지 않았어요.</p>
    <button type="button" onClick={onCancel}>돌아가기</button>
  </section>
  return <PrescriptionAdjustmentEditor authority={offer.authority} policy={offer.policy}
    contextKey={offer.contextKey} current={offer.current} now={Date.now} onCancel={onCancel}
    choices={offer.targets.map(configuration => {
      const family = offer.authority.catalog.find(item => item.familyId === configuration.familyId)
      const source = family?.configurations.find(item => item.configurationId === configuration.configurationId && item.version === configuration.version)
      return { configuration, label: source?.sequence.label ?? "검토된 다른 구성" }
    })}
    onApply={(receipt, prescription) => {
      if (!current()) throw Error("STALE_CANDIDATE_SELECTION")
      const review = live.current.readReview(receipt)
      const source = { ...review.source, nowMs: Date.now() }
      const { candidate, address, startDate } = opened.preparation
      const scope = resolveAdjustedCandidateScope(candidate, address, startDate)
      const original = candidate.sessions.find(item => item.day === address.day && item.slot === address.slot)?.prescription
      if (scope === null || original === undefined) throw Error("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
      const snapshot = createAdjustedMethodSnapshot({ original, source, scope, receipt, explanation: review.explanation })
      if (snapshot.kind !== "prepared") throw Error(snapshot.code)
      // The editor's emitted numbers must match the receipt, not just its label.
      if (fingerprint(receipt.after) !== fingerprint(prescription)) throw Error("EDITOR_PRESCRIPTION_MISMATCH")
      const preparation = { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source, explanation: review.explanation }
      const prepared = prepareAdjustedPlanCandidate(preparation)
      if (prepared.kind !== "prepared") throw Error(prepared.code)
      setStaged({ receipt, request: { ...opened, preparation, expectedCandidateFingerprint: prepared.candidate.contentFingerprint } })
    }} />
}
