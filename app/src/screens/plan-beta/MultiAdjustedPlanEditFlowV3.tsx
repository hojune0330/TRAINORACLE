import React from "react"
import { ArrowLeft, ArrowRight, Pencil } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { MultiAdjustedLiveReviewV3, StoredMultiAdjustedPlanStateV6 } from "../../domain/adjusted-plan-storage-v6"
import type { MultiAdjustedPlanSelectionRequestV3 } from "../../domain/selected-multi-adjusted-plan-v3"
import { stageMultiAdjustmentV3, type AddressedAdjustmentV3 } from "../../domain/stage-multi-adjustment-v3"
import { prepareSourceAdjustmentOfferV3 } from "../../domain/source-adjustment-offer"
import { prepareUnanchoredAdjustmentOfferV3 } from "../../domain/unanchored-adjustment-offer-v3"
import { prepareMultiAdjustedPlanCandidateV3 } from "../../domain/adjusted-plan-multi-candidate-v3"
import { PrescriptionAdjustmentEditorV3, type AdjustmentOrderedChoicesV3 } from "./PrescriptionAdjustmentEditorV3"
import { MultiAdjustedPlanApplyReviewV3, type MultiAdjustmentEntryV3 } from "./MultiAdjustedPlanApplyReviewV3"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { isoShift } from "../../domain/dates"
import { JournalConfirmationDialog } from "../../components/JournalConfirmationDialog"
import { recommendMethodsV3, type RepeatPreference } from "@impl/prescription/method-recommendation"
import { readMultiPlanMethodHistoryV3 } from "../../domain/multi-plan-method-history-v3"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.multi-edit-flow.v3", value)
export function MultiAdjustedPlanEditFlowV3({ seed, readReview, locks, readReviewForEdits, orderedChoicesFor,
  isCurrentDraft, onSaved, onCancel, expectedPredecessorFingerprint }: MultiAdjustmentEntryV3 & {
  readonly readReviewForEdits: (request: MultiAdjustedPlanSelectionRequestV3, changes: readonly AddressedAdjustmentV3[]) => MultiAdjustedLiveReviewV3;
  readonly orderedChoicesFor?: (address: AddressedAdjustmentV3["address"]) => readonly AdjustmentOrderedChoicesV3[];
  readonly isCurrentDraft: () => boolean; readonly onSaved: (state: StoredMultiAdjustedPlanStateV6) => void;
  readonly onCancel: () => void; readonly expectedPredecessorFingerprint?: string;
}) {
  const [opened] = React.useState(() => ({ identity: hash(seed), predecessor: expectedPredecessorFingerprint }))
  const [request, setRequest] = React.useState(() => structuredClone(seed))
  const [changes, setChanges] = React.useState<readonly AddressedAdjustmentV3[]>([])
  const [editing, setEditing] = React.useState<AddressedAdjustmentV3["address"] | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [discarding, setDiscarding] = React.useState(false)
  const [repeatPreference, setRepeatPreference] = React.useState<RepeatPreference>("NEUTRAL")
  const leaving = React.useRef(false)
  React.useEffect(() => {
    if (!changes.length) return
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (leaving.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", preventLoss)
    return () => window.removeEventListener("beforeunload", preventLoss)
  }, [changes.length])
  const current = () => isCurrentDraft() && hash(seed) === opened.identity && expectedPredecessorFingerprint === opened.predecessor
  const review = () => changes.length ? readReviewForEdits(request, changes) : readReview()
  if (confirming) return <MultiAdjustedPlanApplyReviewV3 seed={request} readReview={review} locks={locks}
    isCurrentDraft={current} onSaved={state => { leaving.current = true; onSaved(state) }} onCancel={() => setConfirming(false)} expectedPredecessorFingerprint={expectedPredecessorFingerprint} />
  let live: MultiAdjustedLiveReviewV3 | null = null
  try { live = review() } catch { /* Show the unavailable state without inventing review data. */ }
  const prepared = live === null ? null : prepareMultiAdjustedPlanCandidateV3(request.preparations, live.rpeBindings)
  const history = live ? readMultiPlanMethodHistoryV3(request.intake.eventDistanceM, live.retained) : null
  if (editing && live) {
    const selected = prepared?.kind === "prepared" ? prepared.candidate.sessions.find(s => s.day === editing.day && s.slot === editing.slot)?.prescription : undefined
    const source = live.preparations.find(p => p.address.day === editing.day && p.address.slot === editing.slot)
    const offer = source === undefined ? null : "experienceBand" in source
      ? prepareUnanchoredAdjustmentOfferV3({ ...source.source, nowMs: Date.now() })
      : prepareSourceAdjustmentOfferV3({ ...source.source, nowMs: Date.now() })
    const recommendations = offer?.kind === "available" ? recommendMethodsV3({ catalog: offer.authority.catalog,
      assessments: offer.targets.map(configuration => ({ ...configuration, eligibility: "ELIGIBLE" as const,
        eligibilityPriority: 0, purposePriority: 0, contextPriority: 0 })),
      history: history?.kind === "read" ? history.history : [], repeatPreference }) : null
    if (offer?.kind === "available" && recommendations?.kind === "recommended") return <PrescriptionAdjustmentEditorV3 key={`${editing.day}:${editing.slot}`}
      sessionLabel={`${isoShift(request.preparations[0]!.startDate, editing.day - 1)} · ${editing.slot === "AM" ? "오전" : "오후"}`}
      authority={offer.authority} current={offer.current} policy={offer.policy} contextKey={offer.contextKey}
      initialConfiguration={selected?.kind === "ADJUSTED_METHOD_V3" ? selected.snapshot.receipt.after.configuration : undefined}
      now={Date.now} orderedChoices={orderedChoicesFor?.(editing)} onCancel={() => setEditing(null)}
      primaryConfigurations={offer.targets.filter(ref => recommendations.defaults.some(choice => choice.familyId === ref.familyId
        && choice.configurationId === ref.configurationId && choice.version === ref.version))}
      choices={offer.targets.map(configuration => ({ configuration, label: offer.authority.catalog.find(f => f.familyId === configuration.familyId)
        ?.configurations.find(c => c.configurationId === configuration.configurationId && c.version === configuration.version)?.sequence.label ?? "검토된 다른 구성" }))}
      onApply={(receipt, prescription) => {
        if (!current()) throw Error("STALE_CANDIDATE_SELECTION")
        const change = { address: editing, receipt }
        const updated = [...changes.filter(c => c.address.day !== editing.day || c.address.slot !== editing.slot), change]
        const fresh = readReviewForEdits(request, updated)
        const staged = stageMultiAdjustmentV3(request, change, prescription, fresh)
        if (staged.kind !== "staged") throw Error(staged.code)
        setRequest(staged.request); setChanges(updated); setEditing(null)
      }} />
  }
  return <section className="adjusted-next-flow">
    {discarding && <JournalConfirmationDialog title="변경안을 버리고 돌아갈까요?"
      description="이 화면에서 바꾼 구성만 없어져요. 저장된 현재 계획은 바뀌지 않아요."
      confirmLabel="변경안 버리고 돌아가기" onCancel={() => setDiscarding(false)}
      onConfirm={() => { leaving.current = true; setDiscarding(false); onCancel(); return true }} />}
    <button type="button" onClick={() => changes.length ? setDiscarding(true) : onCancel()}><ArrowLeft size={18} aria-hidden="true" />후보로 돌아가기</button>
    <h1>주요 훈련을 하나씩 확인해 주세요</h1>
    <fieldset><legend>선택지 순서</legend>
      {([["NEUTRAL", "기본 순서"], ["PREFER_REPEAT", "완료 표시 많은 순"], ["PREFER_VARIETY", "완료 표시 적은 순"]] as const).map(([value, label]) =>
        <label key={value}><input type="radio" name="multi-method-order" checked={repeatPreference === value}
          onChange={() => setRepeatPreference(value)} />{label}</label>)}
    </fieldset>
    <p>{history?.kind !== "read" ? "훈련 이력을 확인하지 못해 기본 순서를 사용해요."
      : history.history.length ? "이 기기의 같은 종목 계획에서 직접 남긴 완료 표시 기준이에요."
        : "연결된 훈련 이력이 없어 기본 순서를 사용해요."}</p>
    <p role="status">{changes.length ? `변경한 주요 훈련 ${changes.length}개 · 아직 저장하지 않았어요.` : "아직 저장하지 않은 계획이에요."}</p>
    {prepared?.kind === "prepared" ? prepared.candidate.sessions.filter(s => prepared.candidate.changedSlots.some(c => c.day === s.day && c.slot === s.slot)).map(session => <section key={`${session.day}:${session.slot}`} aria-label="고른 주요 훈련">
      <h2>{isoShift(prepared.candidate.startDate, session.day - 1)} · {session.slot === "AM" ? "오전" : "오후"}</h2>
      <AdjustedPrescriptionV3 session={session} explanation={request.preparations.find(p => p.address.day === session.day && p.address.slot === session.slot)?.explanation} />
      <button type="button" onClick={() => setEditing({ day: session.day, slot: session.slot })}><Pencil size={18} aria-hidden="true" />이 훈련 구성 바꾸기</button>
    </section>) : <p role="alert">훈련 구성과 검토 자료를 확인하지 못했어요. 현재 계획은 바뀌지 않았어요.</p>}
    {editing && <p role="alert">현재 적용할 조정 범위를 확인하지 못했어요.</p>}
    <button type="button" disabled={prepared?.kind !== "prepared" || !current()} onClick={() => setConfirming(true)}><ArrowRight size={18} aria-hidden="true" />전체 확인으로</button>
  </section>
}
