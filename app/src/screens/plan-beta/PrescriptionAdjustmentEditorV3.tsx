import React from "react"
import { TaskGuide } from "../../components/TaskGuide"
import { createPortal } from "react-dom"
import { ArrowLeft, Minus, Plus, RotateCcw, Undo2, Redo2, RefreshCw } from "lucide-react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { applyAdjustmentDraftV3, createAdjustmentDraftV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentAuthorityV3, AdjustmentDraftV3, AdjustmentReceiptV3, PrescriptionSnapshotV3 } from "@impl/prescription/prescription-adjustment-v3"
import type { AdjustmentPolicyReference, ConfigurationReference } from "@impl/prescription/prescription-adjustment"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import { hasCanonicalJsonTree } from "../../domain/plan-beta-schema"
import { createWorkoutPreviewHistory, pushWorkoutPreview, undoWorkoutPreview, redoWorkoutPreview } from "../../domain/workout-preview-history"
import { buildWorkoutTuningStepsV3, distinctWorkoutMethodsV3, drawWorkoutMethodV3, workoutMethodPoolV3, workoutTuningChangesV3 } from "../../domain/workout-tuning-v3"
import { PrescriptionStructureV3 } from "./PrescriptionStructureV3"
import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import { sequenceNotation, sequenceWorkoutName } from "../../domain/workout-notation"
import { formatTrainingSeconds } from "./labels"
import "./PrescriptionAdjustmentEditor.css"

export type AdjustmentOrderedChoicesV3 = {
  readonly dimension: "repetitions" | "distance" | "time" | "recovery" | "sets" | "intensity"
  readonly configurations: readonly ConfigurationReference[]
}
type Props = {
  readonly intent?: PlannedEnergyIntent
  readonly sessionLabel?: string
  readonly authority: AdjustmentAuthorityV3
  readonly current: PrescriptionSnapshotV3
  readonly policy: AdjustmentPolicyReference
  readonly contextKey: string
  readonly choices: readonly { readonly configuration: ConfigurationReference; readonly label: string }[]
  readonly primaryConfigurations?: readonly ConfigurationReference[]
  readonly orderedChoices?: readonly AdjustmentOrderedChoicesV3[]
  readonly initialConfiguration?: ConfigurationReference
  readonly now: () => number
  readonly onApply: (receipt: AdjustmentReceiptV3, prescription: PrescriptionSnapshotV3) => void | Promise<void>
  readonly onCancel: () => void
}
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
const CORE_METRICS: readonly [keyof Totals, string, string][] = [
  ["repetitionBlocks", "반복 횟수", "회"], ["workDistanceM", "본운동 거리", "m"],
  ["workSeconds", "본운동 시간", "초"], ["recoverySeconds", "회복 시간", "초"],
  ["recoveryDistanceM", "회복 거리", "m"], ["totalSeconds", "본운동 소요시간", "초"],
]
function metric(value: number | null, unit: string) { return value === null ? "산출 불가" : `${value}${unit}` }
function coreMetric(value: number | null, unit: string) {
  return value === null ? "—" : unit === "초" ? formatTrainingSeconds(value) : `${value}${unit}`
}

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
  const [history, setHistory] = React.useState(() => createWorkoutPreviewHistory<AdjustmentDraftV3 | null>(opened.initialDraft))
  const draft = history.present
  const [seenMethods, setSeenMethods] = React.useState<readonly PrescriptionSnapshotV3[]>(() => {
    const initial = opened.initialDraft?.after ?? opened.current
    return initial ? [initial] : []
  })
  const [error, setError] = React.useState<string | null>(opened.initialError)
  const [discarding, setDiscarding] = React.useState(false), [closed, setClosed] = React.useState(false)
  const [applying, setApplying] = React.useState(false), [invalidated, setInvalidated] = React.useState(false)
  const [showAllChoices, setShowAllChoices] = React.useState(false)
  const [showAllControls, setShowAllControls] = React.useState(false)
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
  const visibleBaseline = opened.initialDraft?.after ?? opened.current
  const requestCancel = () => {
    if (pending.current || completed.current) return
    if (same(draft?.after.configuration ?? visibleBaseline?.configuration, visibleBaseline?.configuration)) { cancel(); return }
    discardOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : back.current
    setDiscarding(true)
  }
  const select = (target: ConfigurationReference, action: "choose" | "undo" | "redo" = "choose") => {
    if (pending.current || completed.current || stale || discarding || !opened.current) return
    try {
      const live = latest.current
      if (changed(live)) { setInvalidated(true); return }
      let next: AdjustmentDraftV3 | null = null
      if (!same(target, opened.current.configuration)) {
        if (!live.choices.some(c => same(c.configuration, target))) { setError("이 구성은 더 이상 선택할 수 없어요. 현재 변경안은 유지했어요."); return }
        const result = createAdjustmentDraftV3({ authority: live.authority, policy: live.policy, contextKey: live.contextKey,
          current: opened.current, target, nowMs: live.now() })
        if (result.kind !== "draft") { setError(errorMessage(result.code)); return }
        next = result.draft
      }
      setHistory(previous => {
        if (action === "undo") return { ...undoWorkoutPreview(previous), present: next }
        if (action === "redo") return { ...redoWorkoutPreview(previous), present: next }
        return same(previous.present?.after.configuration ?? opened.current?.configuration, target)
          ? previous : pushWorkoutPreview(previous, next)
      })
      const seen = next?.after ?? opened.current
      setSeenMethods(previous => previous.some(item => same(item.configuration, seen.configuration)) ? previous : [...previous, seen])
      setError(null)
      return true
    } catch { setError("구성을 확인하지 못했어요. 현재 훈련은 바뀌지 않았어요.") }
  }
  const choose = (target: ConfigurationReference) => select(target)
  const reset = () => { const target = opened.initialDraft?.after.configuration ?? opened.current?.configuration; if (target) select(target) }
  const travel = (action: "undo" | "redo") => {
    const entries = action === "undo" ? history.past : history.future
    if (!entries.length || !opened.current) return
    const entry = action === "undo" ? entries[entries.length - 1] : entries[0]
    select(entry?.after.configuration ?? opened.current.configuration, action)
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
  const before = visibleBaseline?.sequence, after = draft?.after.sequence ?? before
  const a = before ? deriveSequenceV3Totals(before) : null, b = after ? deriveSequenceV3Totals(after) : null
  const selected = draft?.after.configuration ?? opened.current?.configuration
  const blocked = applying || stale || !opened.current
  const authorized = opened.current ? props.choices.flatMap(choice => {
    try {
      const result = createAdjustmentDraftV3({ authority: props.authority, policy: props.policy, contextKey: props.contextKey,
        current: opened.current!, target: choice.configuration, nowMs: props.now() })
      return result.kind === "draft" ? [result.draft.after] : []
    } catch { return [] }
  }) : []
  const canExplore = !blocked && authorized.some(item => !same(item.configuration, selected))
  const preview = draft?.after ?? visibleBaseline
  const pool = visibleBaseline ? [visibleBaseline, ...authorized.filter(item => !same(item.configuration, visibleBaseline.configuration))] : authorized
  const methodGroups = props.orderedChoices?.map(group => group.configurations) ?? []
  const methodPool = preview ? workoutMethodPoolV3(preview, pool, methodGroups) : pool
  const hasOtherMethod = distinctWorkoutMethodsV3(methodPool).length > 1
  const orderedGroup = preview ? props.orderedChoices?.find(group =>
    group.configurations.some(configuration => same(configuration, preview.configuration))) : undefined
  const orderedPool = orderedGroup
    ? orderedGroup.configurations.flatMap(configuration => pool.filter(item => same(item.configuration, configuration)))
    : props.orderedChoices ? [] : pool
  const controlDimensions = orderedGroup ? ({ repetitions: ["repetitions"], distance: ["repDistance"],
    time: ["workTime"], recovery: ["repeatRecovery", "setRecovery"], sets: ["sets"], intensity: [],
  } as const)[orderedGroup.dimension] : null
  const controls = preview ? buildWorkoutTuningStepsV3(preview, orderedPool)
    .filter(control => controlDimensions === null || (controlDimensions as readonly string[]).includes(control.dimension)) : []
  const changes = draft && visibleBaseline ? workoutTuningChangesV3(visibleBaseline, draft.after) : []
  const coreChanges = draft && a && b ? CORE_METRICS.flatMap(([key, label, unit]) => {
    const beforeValue = a.main[key], afterValue = b.main[key]
    return beforeValue === null && afterValue === null || beforeValue === afterValue
      ? [] : [{ key, label, unit, beforeValue, afterValue }]
  }) : []
  const resetDisabled = same(selected, visibleBaseline?.configuration)
  const choiceLabel = (configuration: ConfigurationReference, fallback: string) => {
    const item = [visibleBaseline, ...authorized].find(value => value && same(value.configuration, configuration))
    return props.intent && item ? `${sequenceWorkoutName(item.sequence, props.intent)} · ${sequenceNotation(item.sequence)}` : fallback
  }
  return createPortal(<dialog ref={dialog} className="prescription-adjustment" role={discarding ? "alertdialog" : "dialog"}
    aria-modal="true" aria-busy={applying} aria-labelledby={`${id}-${discarding ? "discard" : "title"}`}
    aria-describedby={discarding ? `${id}-discard-description` : props.sessionLabel ? `${id}-session` : undefined}
    onKeyDown={event => {
      if (blocked || discarding || !(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key.toLowerCase() === "z") { event.preventDefault(); travel(event.shiftKey ? "redo" : "undo") }
      else if (event.key.toLowerCase() === "y") { event.preventDefault(); travel("redo") }
    }}
    onCancel={event => { event.preventDefault(); if (discarding) setDiscarding(false); else requestCancel() }}>
    {discarding ? <div className="prescription-adjustment__discard">
      <h2 id={`${id}-discard`}>변경안을 버릴까요?</h2><p id={`${id}-discard-description`}>아직 저장하지 않은 변경안만 없어져요. 기존 계획은 유지돼요.</p>
      <div className="prescription-adjustment__actions"><button ref={keepEditing} type="button" onClick={() => setDiscarding(false)}>계속 수정</button>
        <button type="button" onClick={cancel}>변경안 버리기</button></div>
    </div> : <>
      <header className="prescription-adjustment__header">
        <button ref={back} type="button" className="prescription-adjustment__icon" title="취소" aria-label="취소" disabled={applying} onClick={requestCancel}><ArrowLeft size={20} aria-hidden="true" /></button>
        <h2 id={`${id}-title`}>훈련 바꾸기</h2>
        <button type="button" className="prescription-adjustment__icon" title="처음 열었던 구성으로" aria-label="변경안 초기화" disabled={resetDisabled || blocked} onClick={reset}><RotateCcw size={18} aria-hidden="true" /></button>
      </header>
      <div className="prescription-adjustment__content">
        {props.sessionLabel && <p id={`${id}-session`}>{props.sessionLabel}</p>}
        {stale && <p role="alert">현재 훈련이나 적용 조건이 바뀌었어요. 닫은 뒤 다시 열어 주세요.</p>}
        {error && <p role="alert">{error}</p>}
        {opened.current !== null && <TaskGuide as="h3" title={canExplore || draft ? "훈련 조절하기" : "현재 훈련 확인"}
          description={!blocked && !error && (canExplore || draft) ? "변경안은 적용을 눌러야 반영돼요." : undefined}
          illustration={!blocked && !error && (canExplore || draft) ? "plan-adjust" : undefined} />}
        <div className="prescription-adjustment__preview-tools">
          {hasOtherMethod && <button type="button" disabled={blocked} onClick={() => {
            if (!preview || blocked || discarding || pending.current || completed.current) return
            const draw = drawWorkoutMethodV3(preview, methodPool, seenMethods, Math.random, methodGroups)
            if (draw && choose(draw.next.configuration)) setSeenMethods(draw.seen)
          }}><RefreshCw size={18} aria-hidden="true" />다른 훈련</button>}
          <div role="group" aria-label="변경안 되돌리기" className="prescription-adjustment__history">
            <button type="button" className="prescription-adjustment__icon" title="되돌리기" aria-label="되돌리기" disabled={blocked || !history.past.length} onClick={() => travel("undo")}><Undo2 size={18} aria-hidden="true" /></button>
            <button type="button" className="prescription-adjustment__icon" title="다시 하기" aria-label="다시 하기" disabled={blocked || !history.future.length} onClick={() => travel("redo")}><Redo2 size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <p role="status" className="prescription-adjustment__note">{draft ? "변경안 · 아직 저장 전" : "현재 처방"}</p>
        <section className="prescription-adjustment__preview" aria-label="훈련 미리보기" key={identity(selected)}>
          {after && <PrescriptionStructureV3 sequence={after} intent={props.intent} compact collapseSupport />}
        </section>
        {controls.slice(0, showAllControls ? undefined : 2).map(control => <div key={control.dimension}
          className="prescription-adjustment__stepper" role="group" aria-label={control.label}>
          <span>{control.label}</span>
          <button type="button" className="prescription-adjustment__icon" aria-label={control.decrease?.label ?? `${control.label} 줄이기`} title={control.decrease?.label ?? `${control.label} 줄이기`}
            disabled={blocked || !control.decrease} onClick={() => { if (control.decrease) choose(control.decrease.target.configuration) }}><Minus size={18} aria-hidden="true" /></button>
          <output>{control.unit === "초" ? formatTrainingSeconds(control.value) : `${control.value}${control.unit}`}</output>
          <button type="button" className="prescription-adjustment__icon" aria-label={control.increase?.label ?? `${control.label} 늘리기`} title={control.increase?.label ?? `${control.label} 늘리기`}
            disabled={blocked || !control.increase} onClick={() => { if (control.increase) choose(control.increase.target.configuration) }}><Plus size={18} aria-hidden="true" /></button>
        </div>)}
        {changes.length > 0 && <ul className="prescription-adjustment__changes" aria-label="바뀐 값" aria-live="polite">
          {changes.map(change => <li key={change}>{change}</li>)}
        </ul>}
        {draft && <section aria-label="핵심 수치 변경 전후">
          <h3>현재와 변경안 · 본운동 합계</h3>
          {coreChanges.length > 0 ? <table className="prescription-adjustment__totals" aria-label="핵심 수치 변경 전후">
            <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경안</th></tr></thead>
            <tbody>{coreChanges.map(row => <tr key={row.key}><th scope="row">{row.label}</th>
              <td>{coreMetric(row.beforeValue, row.unit)}</td><td>{coreMetric(row.afterValue, row.unit)}</td></tr>)}</tbody>
          </table> : <p>본운동 합계 수치는 달라지지 않았어요.</p>}
          {coreChanges.some(row => row.beforeValue === null || row.afterValue === null)
            && <p className="prescription-adjustment__note">산출할 수 없는 값은 임의로 계산하지 않았어요.</p>}
        </section>}
        {controls.length > 2 && <button type="button" aria-expanded={showAllControls} onClick={() => setShowAllControls(value => !value)}>{showAllControls ? "조절 접기" : "더 조절"}</button>}
        {controls.length > 0 && <p className="prescription-adjustment__note">구성에 따라 다른 값도 함께 바뀔 수 있어요. 위 훈련 순서를 확인해 주세요.</p>}
        <details><summary>훈련 목록·다른 설정</summary>
        <fieldset disabled={blocked} className="prescription-adjustment__choices"><legend>훈련 구성</legend>
          {visibleBaseline && <label><input type="radio" name={`${id}-choice`} checked={same(selected, visibleBaseline.configuration)}
            onChange={() => choose(visibleBaseline.configuration)} />{choiceLabel(visibleBaseline.configuration, visibleBaseline.sequence.label ?? "현재 구성")}</label>}
          {props.choices.filter(c => !same(c.configuration, visibleBaseline?.configuration)
            && (showAllChoices || props.primaryConfigurations === undefined || same(c.configuration, selected)
              || props.primaryConfigurations.some(ref => same(ref, c.configuration)))).map((choice, i) => <label key={`${i}-${choice.configuration.configurationId}`}>
            <input type="radio" name={`${id}-choice`} checked={same(selected, choice.configuration)} onChange={() => choose(choice.configuration)} />{choiceLabel(choice.configuration, choice.label)}</label>)}
        </fieldset>
        {props.primaryConfigurations && props.choices.some(c => !same(c.configuration, visibleBaseline?.configuration)
          && !props.primaryConfigurations!.some(ref => same(ref, c.configuration))) && <button type="button"
          disabled={blocked} aria-expanded={showAllChoices} onClick={() => setShowAllChoices(value => !value)}>
          {showAllChoices ? "기본 선택지만 보기" : "다른 검토된 구성 보기"}</button>}
        </details>
        <details><summary>전체 합계 세부 비교</summary><p className="prescription-adjustment__note">거리와 시간은 따로 계산해요. 값이 없는 항목은 추정하지 않아요.</p>
        {(["warmup", "main", "cooldown"] as const).map(phase => <section key={phase} aria-label={`${PHASES[phase]} 변경 전후 합계`}>
          <h4>{PHASES[phase]} 합계</h4>
          <table className="prescription-adjustment__totals" aria-label={`${PHASES[phase]} 변경 전후 합계`}>
            <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">변경안</th><th scope="col">차이</th></tr></thead>
            <tbody>{METRICS.flatMap(([key, label, unit]) => {
              const first = a?.[phase][key] ?? null, second = b?.[phase][key] ?? null
              if (first === null && second === null) return []
              return [<tr key={key}><th scope="row">{label}</th><td>{metric(first, unit)}</td><td>{metric(second, unit)}</td>
                <td>{first === null || second === null ? "산출 불가" : `${second > first ? "+" : ""}${metric(second - first, unit)}`}</td></tr>
              ]
            })}</tbody>
          </table></section>)}
        </details>
        <details><summary>현재 수행 순서</summary>{before && <PrescriptionStructureV3 sequence={before} />}</details>
      </div>
      <footer className="prescription-adjustment__actions"><button type="button" disabled={applying} onClick={requestCancel}>취소</button>
        <button type="button" className="prescription-adjustment__apply" disabled={!draft || blocked} onClick={() => void apply()}>{applying ? "적용 중" : "변경안 적용"}</button></footer>
    </>}
  </dialog>, document.body)
}
