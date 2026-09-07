import React from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, Minus, Plus, RotateCcw } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { applyAdjustmentDraftV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentAuthorityV3, AdjustmentDraftV3, AdjustmentReceiptV3, PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentPolicyReference, ConfigurationReference } from "@impl/prescription/prescription-adjustment"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "../../domain/plan-beta-schema"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import "./PrescriptionAdjustmentEditor.css"

export type AdjustmentOrderedChoicesV3 = {
  readonly dimension: "repetitions" | "distance" | "time" | "recovery" | "sets" | "intensity"
  readonly configurations: readonly ConfigurationReference[]
}
type Props = {
  readonly sessionLabel?: string
  readonly authority: AdjustmentAuthorityV3
  readonly current: PrescriptionSnapshotV3
  readonly policy: AdjustmentPolicyReference
  readonly contextKey: string
  readonly choices: readonly { readonly configuration: ConfigurationReference; readonly label: string }[]
  readonly orderedChoices?: readonly AdjustmentOrderedChoicesV3[]
  readonly initialConfiguration?: ConfigurationReference
  readonly now: () => number
  readonly onApply: (receipt: AdjustmentReceiptV3, prescription: PrescriptionSnapshotV3) => void | Promise<void>
  readonly onCancel: () => void
}
const DIMENSIONS = { repetitions: "반복", distance: "거리", time: "시간", recovery: "회복", sets: "세트", intensity: "강도" } as const
const PHASES = { warmup: "준비운동", main: "본운동", cooldown: "정리운동" } as const
function identity(value: unknown) {
  try { return hasCanonicalJsonTree(value) ? canonicalJsonFingerprint("trainoracle.adjustment-editor.v3", value) : null }
  catch { return null }
}
const same = (a: unknown, b: unknown) => identity(a) !== null && identity(a) === identity(b)
function errorMessage(code: string) {
  if (code === "POLICY_EXPIRED") return "검토 기준의 유효 시간이 지났어요. 닫은 뒤 기준을 다시 확인해 주세요."
  if (code === "EDGE_NOT_ALLOWED") return "현재 훈련에서 이 구성으로 바꾸는 범위는 아직 검토되지 않았어요."
  return "현재 훈련이나 검토 근거가 달라져 적용하지 않았어요. 닫은 뒤 다시 확인해 주세요."
}
type Totals = ReturnType<typeof deriveSequenceV3Totals>["main"]
const METRICS: readonly [keyof Totals, string, string][] = [
  ["repetitionBlocks", "본운동 반복 단위", "회"], ["workSegments", "본운동 구간", "개"],
  ["workDistanceM", "본운동 거리", "m"], ["workSeconds", "본운동 시간", "초"],
  ["recoverySteps", "회복 단계", "개"], ["recoverySeconds", "회복 시간", "초"],
  ["recoveryDistanceM", "회복 거리", "m"], ["totalSeconds", "전체 시간", "초"],
]
function metric(value: number | null, unit: string) { return value === null ? "산출 불가" : `${value}${unit}` }

/** Every +/- step selects an independently reviewed complete configuration, not an invented numeric dose. */
export function PrescriptionAdjustmentEditorV3(props: Props) {
  const [opened] = React.useState(() => {
    const parsed = parsePrescriptionSequenceV3(props.current.sequence)
    let initialDraft: AdjustmentDraftV3 | null = null, initialError: string | null = null
    if (props.initialConfiguration && !same(props.initialConfiguration, props.current.configuration)) {
      try {
        const result = props.choices.some(c => same(c.configuration, props.initialConfiguration))
          ? createAdjustmentDraftV3({ authority: props.authority, policy: props.policy, contextKey: props.contextKey,
            current: props.current, target: props.initialConfiguration, nowMs: props.now() }) : null
        if (result?.kind === "draft") initialDraft = result.draft
        else initialError = "앞서 고른 구성을 현재 검토 기준에서 확인하지 못했어요. 닫은 뒤 다시 확인해 주세요."
      } catch { initialError = "앞서 고른 구성을 읽지 못했어요. 닫은 뒤 다시 확인해 주세요." }
    }
    return { currentIdentity: identity(props.current), policyIdentity: identity(props.policy), contextKey: props.contextKey,
      initialConfigurationIdentity: identity(props.initialConfiguration ?? null), initialDraft, initialError,
      current: parsed.kind === "parsed" ? { configuration: { ...props.current.configuration }, sequence: parsed.sequence } : null }
  })
  const [draft, setDraft] = React.useState<AdjustmentDraftV3 | null>(opened.initialDraft), [error, setError] = React.useState<string | null>(opened.initialError)
  const [discarding, setDiscarding] = React.useState(false), [closed, setClosed] = React.useState(false)
  const [applying, setApplying] = React.useState(false), [invalidated, setInvalidated] = React.useState(false)
  const pending = React.useRef(false), completed = React.useRef(false), mounted = React.useRef(true)
  const latest = React.useRef(props); latest.current = props
  const dialog = React.useRef<HTMLDialogElement>(null), back = React.useRef<HTMLButtonElement>(null)
  const keepEditing = React.useRef<HTMLButtonElement>(null), discardOpener = React.useRef<HTMLElement | null>(null)
  const id = React.useId()
  const changed = (live: Props) => opened.currentIdentity === null || identity(live.current) !== opened.currentIdentity
    || identity(live.initialConfiguration ?? null) !== opened.initialConfigurationIdentity
    || identity(live.policy) !== opened.policyIdentity || live.contextKey !== opened.contextKey
  const stale = invalidated || opened.initialError !== null || changed(props)
  React.useEffect(() => { if (stale) setInvalidated(true) }, [stale])
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  React.useEffect(() => {
    if (closed) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow, modal = dialog.current
    document.body.style.overflow = "hidden"
    if (modal && !modal.open) modal.showModal()
    back.current?.focus()
    return () => { if (modal?.open) modal.close(); document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [closed])
  React.useEffect(() => {
    if (discarding) keepEditing.current?.focus()
    else if (discardOpener.current) (discardOpener.current.isConnected ? discardOpener.current : back.current)?.focus({ preventScroll: true })
  }, [discarding])
  const cancel = () => {
    if (pending.current || completed.current) return
    completed.current = true; setClosed(true); latest.current.onCancel()
  }
  const requestCancel = () => {
    if (pending.current || completed.current) return
    if (!draft || same(draft.after.configuration, opened.initialDraft?.after.configuration)) { cancel(); return }
    discardOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : back.current
    setDiscarding(true)
  }
  const reset = () => { if (!pending.current && !completed.current) { setDraft(null); setError(null) } }
  const choose = (target: ConfigurationReference) => {
    if (pending.current || completed.current || stale || discarding || !opened.current) return
    if (same(target, opened.current.configuration)) { reset(); return }
    try {
      const live = latest.current
      if (changed(live)) { setInvalidated(true); return }
      const result = createAdjustmentDraftV3({ authority: live.authority, policy: live.policy, contextKey: live.contextKey,
        current: opened.current, target, nowMs: live.now() })
      if (result.kind !== "draft") { setError(errorMessage(result.code)); return }
      setDraft(result.draft); setError(null)
    } catch { setError("구성을 확인하지 못했어요. 현재 훈련은 바뀌지 않았어요.") }
  }
  const apply = async () => {
    if (pending.current || completed.current || !draft || discarding) return
    const live = latest.current
    if (stale || changed(live)) { setInvalidated(true); return }
    if (!live.choices.some(choice => same(choice.configuration, draft.after.configuration))) {
      setError("선택한 구성이 현재 제공 목록에서 바뀌었어요. 다시 확인해 주세요."); return
    }
    let result
    try { result = applyAdjustmentDraftV3({ authority: live.authority, current: live.current, draft,
      contextKey: live.contextKey, nowMs: live.now(), action: "USER_EXPLICIT" }) }
    catch { setError("조정 정보를 확인하지 못했어요. 변경안을 유지했으니 다시 확인해 주세요."); return }
    if (result.kind !== "applied") { setError(errorMessage(result.code)); return }
    pending.current = true; setApplying(true); setError(null)
    try {
      await latest.current.onApply(result.receipt, result.prescription)
      completed.current = true
      if (mounted.current) setClosed(true)
    } catch { if (mounted.current) setError("변경안을 적용하지 못했어요. 변경안은 유지했으니 다시 확인해 주세요.") }
    finally { pending.current = false; if (mounted.current) setApplying(false) }
  }
  if (closed) return null
  const before = opened.current?.sequence, after = draft?.after.sequence ?? before
  const a = before ? deriveSequenceV3Totals(before) : null, b = after ? deriveSequenceV3Totals(after) : null
  const selected = draft?.after.configuration ?? opened.current?.configuration
  const blocked = applying || stale || !opened.current
  return createPortal(<dialog ref={dialog} className="prescription-adjustment" role={discarding ? "alertdialog" : "dialog"}
    aria-modal="true" aria-busy={applying} aria-labelledby={`${id}-${discarding ? "discard" : "title"}`}
    aria-describedby={discarding ? `${id}-discard-description` : props.sessionLabel ? `${id}-session` : undefined}
    onCancel={event => { event.preventDefault(); if (discarding) setDiscarding(false); else requestCancel() }}>
    {discarding ? <div className="prescription-adjustment__discard">
      <h2 id={`${id}-discard`}>변경안을 버릴까요?</h2><p id={`${id}-discard-description`}>아직 저장하지 않은 변경안만 없어져요. 기존 계획은 유지돼요.</p>
      <div className="prescription-adjustment__actions"><button ref={keepEditing} type="button" onClick={() => setDiscarding(false)}>계속 수정</button>
        <button type="button" onClick={cancel}>변경안 버리기</button></div>
    </div> : <>
      <header className="prescription-adjustment__header">
        <button ref={back} type="button" className="prescription-adjustment__icon" title="취소" aria-label="취소" disabled={applying} onClick={requestCancel}><ArrowLeft size={20} aria-hidden="true" /></button>
        <h2 id={`${id}-title`}>훈련 구성 조정</h2>
        <button type="button" className="prescription-adjustment__icon" title="변경안 초기화" aria-label="변경안 초기화" disabled={!draft || applying} onClick={reset}><RotateCcw size={18} aria-hidden="true" /></button>
      </header>
      <div className="prescription-adjustment__content">
        {props.sessionLabel && <p id={`${id}-session`}>{props.sessionLabel}</p>}
        {stale && <p role="alert">현재 훈련이나 적용 조건이 바뀌었어요. 닫은 뒤 다시 열어 주세요.</p>}
        {error && <p role="alert">{error}</p>}
        <fieldset disabled={blocked} className="prescription-adjustment__choices"><legend>훈련 구성</legend>
          <label><input type="radio" name={`${id}-choice`} checked={!draft} onChange={reset} />현재 구성</label>
          {props.choices.filter(c => !same(c.configuration, opened.current?.configuration)).map((choice, i) => <label key={`${i}-${choice.configuration.configurationId}`}>
            <input type="radio" name={`${id}-choice`} checked={same(selected, choice.configuration)} onChange={() => choose(choice.configuration)} />{choice.label}</label>)}
        </fieldset>
        {(props.orderedChoices ?? []).map((group, i) => {
          const index = group.configurations.findIndex(ref => same(ref, selected)), label = DIMENSIONS[group.dimension]
          const previous = index > 0 ? group.configurations[index - 1] : undefined
          const next = index >= 0 ? group.configurations[index + 1] : undefined
          const available = (ref: ConfigurationReference | undefined) => ref !== undefined
            && (same(ref, opened.current?.configuration) || props.choices.some(c => same(c.configuration, ref)))
          return <div key={`${group.dimension}-${i}`} className="prescription-adjustment__stepper" role="group" aria-label={`${label} 구성`}>
            <span>{label}</span><button type="button" className="prescription-adjustment__icon" aria-label={`${label} 이전 구성`} title={`${label} 이전 구성`}
              disabled={blocked || !available(previous)} onClick={() => { if (previous) choose(previous) }}><Minus size={18} aria-hidden="true" /></button>
            <output>{draft ? props.choices.find(c => same(c.configuration, selected))?.label ?? "선택한 구성" : "현재 구성"}</output>
            <button type="button" className="prescription-adjustment__icon" aria-label={`${label} 다음 구성`} title={`${label} 다음 구성`}
              disabled={blocked || !available(next)} onClick={() => { if (next) choose(next) }}><Plus size={18} aria-hidden="true" /></button>
          </div>
        })}
        <h3>변경 전후</h3><p className="prescription-adjustment__note">거리와 시간은 따로 계산해요. 값이 없는 항목은 추정하지 않아요.</p>
        {(["warmup", "main", "cooldown"] as const).map(phase => <details key={phase} open={phase === "main"}>
          <summary>{PHASES[phase]} 합계</summary>
          <table className="prescription-adjustment__totals" aria-label={`${PHASES[phase]} 변경 전후 합계`}>
            <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경안</th><th scope="col">차이</th></tr></thead>
            <tbody>{METRICS.map(([key, label, unit]) => {
              const first = a?.[phase][key] ?? null, second = b?.[phase][key] ?? null
              return <tr key={key}><th scope="row">{label}</th><td>{metric(first, unit)}</td><td>{metric(second, unit)}</td>
                <td>{first === null || second === null ? "산출 불가" : `${second > first ? "+" : ""}${metric(second - first, unit)}`}</td></tr>
            })}</tbody>
          </table></details>)}
        <details><summary>현재 수행 순서</summary>{before && <PrescriptionStructureV3 sequence={before} />}</details>
        <details><summary>변경안 수행 순서</summary>{after && <PrescriptionStructureV3 sequence={after} />}</details>
      </div>
      <footer className="prescription-adjustment__actions"><button type="button" disabled={applying} onClick={requestCancel}>취소</button>
        <button type="button" className="prescription-adjustment__apply" disabled={!draft || blocked} onClick={() => void apply()}>{applying ? "적용 중" : "변경안 적용"}</button></footer>
    </>}
  </dialog>, document.body)
}
