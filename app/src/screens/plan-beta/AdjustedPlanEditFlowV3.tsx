import React from "react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { AdjustmentReceiptV3 } from "@impl/prescription/prescription-adjustment-v3"
import { prepareSourceAdjustmentOfferV3 } from "../../domain/source-adjustment-offer"
import { createAdjustedMethodSnapshotV3 } from "../../domain/adjusted-method-snapshot-v3"
import { prepareAdjustedPlanCandidateV3, resolveAdjustedCandidateScope } from "../../domain/adjusted-plan-candidate"
import type { AdjustedPlanSelectionRequestV3 } from "../../domain/selected-adjusted-plan-v3"
import type { StoredAdjustedPlanStateV5 } from "../../domain/adjusted-plan-storage-v5"
import type { AdjustmentEntryV3 } from "./adjustment-entry-v3"
import { PrescriptionAdjustmentEditorV3 } from "./PrescriptionAdjustmentEditorV3"
import { AdjustedPlanApplyReviewV3 } from "./AdjustedPlanApplyReviewV3"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-edit-flow.v3", value)

export function AdjustedPlanEditFlowV3({ seed, readReview, readAdjustmentReview, orderedChoices, locks,
  isCurrentDraft, onSaved, onCancel, expectedPredecessorFingerprint }: AdjustmentEntryV3 & {
  readonly isCurrentDraft: () => boolean
  readonly onSaved: (state: StoredAdjustedPlanStateV5) => void
  readonly onCancel: () => void
  readonly expectedPredecessorFingerprint?: string
}) {
  const [opened] = React.useState(() => ({ seed: structuredClone(seed), identity: hash(seed), expectedPredecessorFingerprint }))
  const live = React.useRef({ seed, isCurrentDraft, readReview, readAdjustmentReview, expectedPredecessorFingerprint })
  live.current = { seed, isCurrentDraft, readReview, readAdjustmentReview, expectedPredecessorFingerprint }
  const [staged, setStaged] = React.useState<{ request: AdjustedPlanSelectionRequestV3; receipt: AdjustmentReceiptV3 } | null>(null)
  const current = () => live.current.isCurrentDraft() && hash(live.current.seed) === opened.identity
    && live.current.expectedPredecessorFingerprint === opened.expectedPredecessorFingerprint
  const reviewFor = (receipt: AdjustmentReceiptV3) => live.current.readAdjustmentReview?.(receipt) ?? live.current.readReview()
  if (staged) return <AdjustedPlanApplyReviewV3 seed={staged.request} readReview={() => reviewFor(staged.receipt)}
    isCurrentDraft={current} onSaved={onSaved} onCancel={onCancel} locks={locks} expectedPredecessorFingerprint={expectedPredecessorFingerprint} />
  const offer = prepareSourceAdjustmentOfferV3({ ...opened.seed.preparation.source, nowMs: Date.now() })
  if (offer.kind !== "available") return <section><p role="alert">현재 적용할 수 있는 조정 구성을 확인하지 못했어요. 계획은 바뀌지 않았어요.</p><button type="button" onClick={onCancel}>돌아가기</button></section>
  return <PrescriptionAdjustmentEditorV3 authority={offer.authority} current={offer.current} policy={offer.policy}
    contextKey={offer.contextKey} now={Date.now} onCancel={onCancel} orderedChoices={orderedChoices}
    choices={offer.targets.map(configuration => {
      const family = offer.authority.catalog.find(f => f.familyId === configuration.familyId)
      const configurationSource = family?.configurations.find(c => c.configurationId === configuration.configurationId && c.version === configuration.version)
      return { configuration, label: configurationSource?.sequence.label ?? "검토된 다른 구성" }
    })}
    onApply={(receipt, prescription) => {
      if (!current()) throw Error("STALE_CANDIDATE_SELECTION")
      const review = reviewFor(receipt), source = { ...review.source, nowMs: Date.now() }
      const latestOffer = prepareSourceAdjustmentOfferV3(source)
      if (latestOffer.kind !== "available") throw Error(latestOffer.code)
      const { candidate, address, startDate } = opened.seed.preparation
      const scope = resolveAdjustedCandidateScope(candidate, address, startDate)
      if (!scope) throw Error("ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE")
      if (hash(receipt.after) !== hash(prescription)) throw Error("EDITOR_PRESCRIPTION_MISMATCH")
      const snapshot = createAdjustedMethodSnapshotV3({ authority: latestOffer.authority, current: latestOffer.current,
        contextKey: latestOffer.contextKey, nowMs: source.nowMs, receipt, scope, explanation: review.explanation })
      if (snapshot.kind !== "prepared") throw Error(snapshot.code)
      const preparation = { candidate, address, startDate, rawSnapshot: JSON.stringify(snapshot.snapshot), source, explanation: review.explanation }
      const prepared = prepareAdjustedPlanCandidateV3(preparation)
      if (prepared.kind !== "prepared") throw Error(prepared.code)
      setStaged({ receipt, request: { ...opened.seed, preparation, expectedCandidateFingerprint: prepared.candidate.contentFingerprint } })
    }} />
}
