import React from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Minus, Plus, RotateCcw } from "lucide-react"
import { applyAdjustmentDraft, createAdjustmentDraft, resetAdjustmentDraft } from "@impl/prescription/prescription-adjustment"
import type {
  AdjustmentAuthority, AdjustmentDraft, AdjustmentErrorCode, AdjustmentPolicyReference,
  AdjustmentReceipt, ConfigurationReference, PrescriptionSnapshot,
} from "@impl/prescription/prescription-adjustment"
import { deriveSequenceRecoveryDistanceTotals, deriveSequenceTotals, parsePrescriptionSequence } from "@impl/prescription/sequence"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import { PrescriptionStructure } from "./PrescriptionStructure"
import "./PrescriptionAdjustmentEditor.css"

export type PrescriptionAdjustmentChoice = {
  readonly label: string
  readonly configuration: ConfigurationReference
}

/** Each ordered entry is a complete reviewed configuration, never a numeric step. */
export type PrescriptionAdjustmentOrderedChoices = {
  readonly dimension: "repetitions" | "recovery" | "time"
  readonly configurations: readonly ConfigurationReference[]
}

export type PrescriptionAdjustmentEditorProps = {
  /** Independently trusted registry; never reconstruct authority from a saved draft. */
  readonly authority: AdjustmentAuthority
  readonly policy: AdjustmentPolicyReference
  readonly contextKey: string
  readonly current: PrescriptionSnapshot
  readonly choices: readonly PrescriptionAdjustmentChoice[]
  readonly orderedChoices?: readonly PrescriptionAdjustmentOrderedChoices[]
  readonly now: () => number
  /** The owner must atomically guard/idempotently persist any async save, and reject on failure. */
  readonly onApply: (receipt: AdjustmentReceipt, prescription: PrescriptionSnapshot) => void | Promise<void>
  readonly onCancel: () => void
}

const ERRORS: Record<AdjustmentErrorCode, string> = {
  INVALID_AUTHORITY: "검토된 조정 근거를 확인할 수 없어요. 다시 확인해 주세요.",
  POLICY_MISMATCH: "조정 기준이 바뀌었거나 확인되지 않아요. 닫은 뒤 다시 열어 주세요.",
  POLICY_EXPIRED: "조정 기준의 유효 시간이 지났거나 아직 시작되지 않았어요. 기준을 다시 확인해 주세요.",
  CONTEXT_MISMATCH: "훈련 대상이나 적용 조건이 바뀌었어요. 닫은 뒤 다시 열어 주세요.",
  CONFIGURATION_MISMATCH: "선택한 구성과 검토된 내용이 일치하지 않아요. 구성을 다시 확인해 주세요.",
  EDGE_NOT_ALLOWED: "현재 처방에서 이 구성으로 바꾸는 조정은 허용되지 않아요.",
  DRAFT_MISMATCH: "변경안과 검토된 내용이 일치하지 않아요. 구성을 다시 확인해 주세요.",
  CURRENT_MISMATCH: "현재 처방이 바뀌었어요. 변경안은 그대로 두었으니 닫은 뒤 다시 열어 주세요.",
  EXPLICIT_ACTION_REQUIRED: "적용 버튼으로 변경안을 직접 확인해 주세요.",
}
const DIMENSIONS = { repetitions: "반복", recovery: "회복", time: "시간" } as const

function identity(value: unknown): string | null {
  try { return JSON.stringify(value) ?? null } catch { return null }
}

function sameReference(a: ConfigurationReference, b: ConfigurationReference): boolean {
  return a.familyId === b.familyId && a.configurationId === b.configurationId
    && a.version === b.version && a.contentIdentity === b.contentIdentity
}

type Totals = ReturnType<typeof deriveSequenceTotals> & ReturnType<typeof deriveSequenceRecoveryDistanceTotals>
type Metric = readonly [Exclude<keyof Totals, "uncomputableReasonCodes">, string, string]
const SUMMARY: readonly Metric[] = [
  ["totalRepetitions", "본운동 반복", "회"],
  ["qualityDistanceM", "본운동 거리", "m"],
  ["qualityDurationSeconds", "본운동 시간", "초"],
  ["plannedRecoverySeconds", "회복 시간 합계", "초"],
  ["plannedRecoveryDistanceM", "회복 거리 합계", "m"],
  ["mainSessionTotalExcludingWarmupCooldown", "본운동과 회복 시간", "초"],
]
const RECOVERY: readonly Metric[] = [
  ["repetitionRecoveryOccurrences", "반복 사이 회복 횟수", "회"],
  ["repetitionRecoveryTotalSeconds", "반복 사이 회복 시간", "초"],
  ["repetitionRecoveryTotalDistanceM", "반복 사이 회복 거리", "m"],
  ["setRecoveryOccurrences", "세트 사이 회복 횟수", "회"],
  ["setRecoveryTotalSeconds", "세트 사이 회복 시간", "초"],
  ["setRecoveryTotalDistanceM", "세트 사이 회복 거리", "m"],
  ["transitionRecoveryOccurrences", "구간 사이 회복 횟수", "회"],
  ["transitionRecoveryTotalSeconds", "구간 사이 회복 시간", "초"],
  ["transitionRecoveryTotalDistanceM", "구간 사이 회복 거리", "m"],
  ["terminalRecoveryOccurrences", "마지막 회복 횟수", "회"],
  ["terminalRecoveryTotalSeconds", "마지막 회복 시간", "초"],
  ["terminalRecoveryDistanceM", "마지막 회복 거리", "m"],
]

function totals(sequence: PrescriptionSequence | null): Totals | null {
  return sequence === null ? null : { ...deriveSequenceTotals(sequence), ...deriveSequenceRecoveryDistanceTotals(sequence) }
}

function metricText(value: number | null | undefined, unit: string, delta = false): string {
  return value == null ? "산출 불가" : `${delta && value > 0 ? "+" : ""}${value}${unit}`
}

function TotalsTable({ before, after, metrics, label }: {
  readonly before: Totals | null; readonly after: Totals | null
  readonly metrics: readonly Metric[]; readonly label: string
}) {
  return <table className="prescription-adjustment__totals" aria-label={label}>
    <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경안</th><th scope="col">차이</th></tr></thead>
    <tbody>{metrics.map(([key, name, unit]) => {
      const a = before?.[key]
      const b = after?.[key]
      return <tr key={key}><th scope="row">{name}</th><td>{metricText(a, unit)}</td><td>{metricText(b, unit)}</td>
        <td>{metricText(a != null && b != null ? b - a : null, unit, true)}</td></tr>
    })}</tbody>
  </table>
}

/** Mount to open; unmount to abandon. No runtime policy, default dose or save is supplied here. */
export function PrescriptionAdjustmentEditor(props: PrescriptionAdjustmentEditorProps) {
  const [opened] = React.useState(() => {
    const parsed = parsePrescriptionSequence(props.current.sequence)
    return {
      currentIdentity: identity(props.current), policyIdentity: identity(props.policy), contextKey: props.contextKey,
      current: parsed.kind === "parsed"
        ? { configuration: { ...props.current.configuration }, sequence: parsed.sequence } : null,
    }
  })
  const [draft, setDraft] = React.useState<AdjustmentDraft | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [discarding, setDiscarding] = React.useState(false)
  const [closed, setClosed] = React.useState(false)
  const [applying, setApplying] = React.useState(false)
  const [invalidated, setInvalidated] = React.useState(false)
  const completed = React.useRef(false)
  const pending = React.useRef(false)
  const mounted = React.useRef(true)
  const latest = React.useRef(props)
  latest.current = props
  const dialog = React.useRef<HTMLDialogElement>(null)
  const back = React.useRef<HTMLButtonElement>(null)
  const keepEditing = React.useRef<HTMLButtonElement>(null)
  const discardOpener = React.useRef<HTMLElement | null>(null)
  const id = React.useId()

  function staleReason(live: PrescriptionAdjustmentEditorProps): string | null {
    if (opened.contextKey !== live.contextKey) return ERRORS.CONTEXT_MISMATCH
    if (opened.currentIdentity === null || opened.currentIdentity !== identity(live.current)) return ERRORS.CURRENT_MISMATCH
    if (opened.policyIdentity === null || opened.policyIdentity !== identity(live.policy)) return ERRORS.POLICY_MISMATCH
    return null
  }
  const changed = staleReason(props)
  const stale = invalidated || changed !== null
  React.useEffect(() => { if (changed !== null) setInvalidated(true) }, [changed])
  React.useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  React.useEffect(() => {
    if (closed) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    const modal = dialog.current
    document.body.style.overflow = "hidden"
    if (modal && !modal.open) modal.showModal()
    back.current?.focus()
    return () => {
      if (modal?.open) modal.close()
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [closed])

  React.useEffect(() => {
    if (discarding) keepEditing.current?.focus()
    else if (discardOpener.current !== null) {
      (discardOpener.current.isConnected ? discardOpener.current : back.current)?.focus({ preventScroll: true })
    }
  }, [discarding])

  function reset() {
    if (pending.current || completed.current) return
    if (draft !== null) setDraft(resetAdjustmentDraft(draft))
    setError(null)
  }

  function cancel() {
    if (completed.current || pending.current) return
    completed.current = true
    setClosed(true)
    latest.current.onCancel()
  }

  function requestCancel() {
    if (completed.current || pending.current) return
    if (draft === null) { cancel(); return }
    discardOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : back.current
    setDiscarding(true)
  }

  function select(configuration: ConfigurationReference) {
    if (completed.current || pending.current || stale || discarding || opened.current === null) return
    if (sameReference(configuration, opened.current.configuration)) { reset(); return }
    try {
      const nowMs = latest.current.now()
      const live = latest.current
      const reason = staleReason(live)
      if (reason !== null) { setInvalidated(true); setError(reason); return }
      const result = createAdjustmentDraft({ authority: live.authority, policy: live.policy,
        contextKey: live.contextKey, current: opened.current, target: configuration, nowMs })
      if (result.kind === "rejected") { setError(ERRORS[result.code]); return }
      setDraft(result.draft)
      setError(null)
    } catch { setError("조정 정보를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.") }
  }

  async function apply() {
    if (completed.current || pending.current || draft === null || discarding) return
    let result
    try {
      const nowMs = latest.current.now()
      const live = latest.current
      const reason = staleReason(live)
      if (stale || reason !== null) {
        setInvalidated(true)
        setError(reason ?? ERRORS.CURRENT_MISMATCH)
        return
      }
      if (!live.choices.some(choice => sameReference(choice.configuration, draft.after.configuration))) {
        setError(ERRORS.CONFIGURATION_MISMATCH)
        return
      }
      result = applyAdjustmentDraft({ authority: live.authority, draft, current: live.current,
        contextKey: live.contextKey, nowMs, action: "USER_EXPLICIT" })
    } catch { setError("조정 정보를 확인하지 못했어요. 변경안을 유지했으니 다시 확인해 주세요."); return }
    if (result.kind === "rejected") { setError(ERRORS[result.code]); return }
    pending.current = true
    setApplying(true)
    setError(null)
    try {
      await latest.current.onApply(result.receipt, result.prescription)
      completed.current = true
      if (mounted.current) setClosed(true)
    } catch {
      if (mounted.current) setError("변경안을 적용하지 못했어요. 변경안은 유지했으니 현재 처방을 확인하고 다시 시도해 주세요.")
    } finally {
      pending.current = false
      if (mounted.current) setApplying(false)
    }
  }

  const beforeSequence = opened.current?.sequence ?? null
  const afterSequence = draft?.after.sequence ?? beforeSequence
  const before = totals(beforeSequence)
  const after = totals(afterSequence)
  const selected = draft?.after.configuration ?? opened.current?.configuration
  const choices = props.choices.filter(choice => opened.current === null || !sameReference(choice.configuration, opened.current.configuration))
  const blocked = applying || stale || opened.current === null
  const notice = changed ?? (invalidated ? ERRORS.CURRENT_MISMATCH : error)

  if (closed) return null
  return createPortal(<dialog ref={dialog} className="prescription-adjustment" role={discarding ? "alertdialog" : "dialog"}
    aria-modal="true" aria-busy={applying} aria-labelledby={`${id}-${discarding ? "discard" : "title"}`}
    aria-describedby={discarding ? `${id}-discard-description` : undefined}
    onCancel={event => { event.preventDefault(); if (discarding) setDiscarding(false); else requestCancel() }}>
    {discarding ? <div className="prescription-adjustment__discard">
      <h2 id={`${id}-discard`}>변경안을 버릴까요?</h2>
      <p id={`${id}-discard-description`}>적용하지 않은 변경안만 없어져요. 현재 처방은 바뀌지 않아요.</p>
      <div className="prescription-adjustment__actions">
        <button ref={keepEditing} type="button" onClick={() => setDiscarding(false)}>계속 수정</button>
        <button type="button" onClick={cancel}>변경안 버리기</button>
      </div>
    </div> : <>
      <header className="prescription-adjustment__header">
        <button ref={back} type="button" className="prescription-adjustment__icon" title="취소" aria-label="취소" disabled={applying} onClick={requestCancel}><ArrowLeft size={20} aria-hidden="true" /></button>
        <h2 id={`${id}-title`}>처방 조정</h2>
        <button type="button" className="prescription-adjustment__icon" title="변경안 초기화" aria-label="변경안 초기화" disabled={draft === null || applying} onClick={reset}><RotateCcw size={18} aria-hidden="true" /></button>
      </header>
      <div className="prescription-adjustment__content">
        {notice !== null && <p role="alert" className="prescription-adjustment__error">{notice}</p>}
        {opened.current === null && <p role="alert">현재 처방을 확인할 수 없어요. 닫은 뒤 다시 확인해 주세요.</p>}
        <fieldset disabled={blocked} className="prescription-adjustment__choices">
          <legend>훈련 구성</legend>
          <label><input type="radio" name={`${id}-choice`} checked={draft === null} onChange={reset} />현재 구성</label>
          {choices.map((choice, index) => <label key={`${index}-${choice.configuration.configurationId}`}>
            <input type="radio" name={`${id}-choice`} checked={selected !== undefined && sameReference(selected, choice.configuration)}
              onChange={() => select(choice.configuration)} />{choice.label}
          </label>)}
        </fieldset>
        {choices.length === 0 && <p>검토된 변경 구성이 없어요.</p>}
        {(props.orderedChoices ?? []).map((group, groupIndex) => {
          const index = selected === undefined ? -1 : group.configurations.findIndex(ref => sameReference(ref, selected))
          const previous = index > 0 ? group.configurations[index - 1] : undefined
          const next = index >= 0 ? group.configurations[index + 1] : undefined
          const available = (ref: ConfigurationReference | undefined) => ref !== undefined &&
            (opened.current !== null && sameReference(ref, opened.current.configuration) || choices.some(choice => sameReference(choice.configuration, ref)))
          const label = DIMENSIONS[group.dimension]
          return <div key={`${group.dimension}-${groupIndex}`} className="prescription-adjustment__stepper" role="group" aria-label={`${label} 구성`}>
            <span>{label}</span>
            <button type="button" className="prescription-adjustment__icon" aria-label={`${label} 이전 구성`} title={`${label} 이전 구성`}
              disabled={blocked || !available(previous)} onClick={() => { if (previous) select(previous) }}><Minus size={18} aria-hidden="true" /></button>
            <output>{draft === null ? "현재 구성" : choices.find(choice => sameReference(choice.configuration, draft.after.configuration))?.label ?? "선택한 구성"}</output>
            <button type="button" className="prescription-adjustment__icon" aria-label={`${label} 다음 구성`} title={`${label} 다음 구성`}
              disabled={blocked || !available(next)} onClick={() => { if (next) select(next) }}><Plus size={18} aria-hidden="true" /></button>
          </div>
        })}
        <section aria-labelledby={`${id}-preview`}>
          <h3 id={`${id}-preview`}>변경 전후</h3>
          <p className="prescription-adjustment__note">준비·정리 제외. 거리와 시간은 각각 계산해요.</p>
          <TotalsTable before={before} after={after} metrics={SUMMARY} label="변경 전후 합계" />
          <details><summary>회복 구간별 합계</summary><TotalsTable before={before} after={after} metrics={RECOVERY} label="변경 전후 회복 구간" /></details>
          <details><summary>현재 수행 순서</summary>{beforeSequence && <PrescriptionStructure sequence={beforeSequence} />}</details>
          <details><summary>변경안 수행 순서</summary>{afterSequence && <PrescriptionStructure sequence={afterSequence} />}</details>
        </section>
      </div>
      <footer className="prescription-adjustment__actions">
        <button type="button" disabled={applying} onClick={requestCancel}>취소</button>
        <button type="button" className="prescription-adjustment__apply" disabled={draft === null || blocked} onClick={() => { void apply() }}>{applying ? "적용 중" : "적용"}</button>
      </footer>
    </>}
  </dialog>, document.body)
}
