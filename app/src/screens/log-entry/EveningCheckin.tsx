import React from "react"
import { JournalWritingDecorationPreview } from "../journal/JournalDecorationPreview"
import { FormInputDraftBoundary, useFormInputDraft, useRecoveredFormInput } from "./useFormInputDraft"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { FormFinalizationRecovery, useFormFinalization } from "./useFormFinalization"
import { IndexCard, MoodStrip } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { explicitOrMissing } from "../../domain/field-provenance"
import {
  newEntryId,
  nextJournalSavedAt,
  saveEntry,
  savePrivateEntry,
  todayISO,
  updateEntry,
  updatePrivateEntry,
} from "../../domain/journal-store"
import type { JournalEntry } from "../../domain/journal-store"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { inputStyle } from "./input-style"
import { FormSec, TopBar } from "./shared"
import { FormInputSaveBar as StickyBar } from "./useFormInputDraft"
import type { EntryFormProps } from "./shared"
import { TaskFlowStep } from "../../components/TaskFlowStep"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"

const MOOD_LABELS = ["흐림", "무덤덤", "보통", "좋음", "최고"] as const
const SLEEP_QUALITY_LABELS = ["최악", "나쁨", "보통", "좋음", "최고"] as const
type EveningStep = "sleep" | "condition" | "metrics" | "memo" | "review"
type EveningEditGroup = Exclude<EveningStep, "review"> | null
type EveningLocation = { readonly step: EveningStep; readonly editGroup: EveningEditGroup; readonly returnToReview?: boolean }
type EveningFlow = { readonly location: EveningLocation; readonly history: readonly EveningLocation[] }

export function EveningCheckin(props: EntryFormProps) {
  const date = props.initialEntry?.date ?? props.targetDate ?? todayISO()
  return <JournalWritingDecorationPreview date={date}><FormInputDraftBoundary kind="evening" date={date}
    hasInitialContext={props.initialEntry !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt])}>
    <EveningCheckinEditor {...props} />
  </FormInputDraftBoundary></JournalWritingDecorationPreview>
}

function EveningCheckinEditor({ onBack, onDone, targetDate, initialEntry }: EntryFormProps) {
  const recovered = useRecoveredFormInput("evening")
  const input = recovered?.input
  const initial = initialEntry?.kind === "evening" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const [entryId] = React.useState(() => recovered?.entryId ?? initial?.id ?? newEntryId())
  const lastSavedAt = React.useRef(recovered?.baseSavedAt ?? initial?.savedAt)
  const persistInFlight = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const accountEnabled = accountJournalRecordsEnabled()
  const finalization = useFormFinalization(entryId, accountEnabled, lastSavedAt)
  const entryDate = initial?.date ?? targetDate ?? todayISO()
  const [flow, setFlow] = React.useState<EveningFlow>(() => ({
    location: { step: initial !== undefined || recovered !== null ? "review" : "sleep", editGroup: null }, history: [],
  }))
  const { step, editGroup } = flow.location
  const [sleep, setSleep] = React.useState(() => input?.sleep ?? initial?.sleepH ?? 0)
  const [quality, setQuality] = React.useState(() => input?.quality ?? initial?.sleepQuality ?? 0)
  const [mood, setMood] = React.useState(() => input?.mood ?? initial?.mood ?? 0)
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...(input?.painParts ?? initial?.painParts) }))
  const [weight, setWeight] = React.useState(() => input?.weight ?? initial?.weightKg ?? "")
  const [hr, setHr] = React.useState(() => input?.hr ?? initial?.restingHr ?? "")
  const [saveError, setSaveError] = React.useState(false)
  const [emptyNotice, setEmptyNotice] = React.useState(false)
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null)
  const note = usePurposeScopedMemo(input?.memo ?? initial?.note ?? "", input ? input.purpose ?? undefined : initial?.memoPurpose)
  const draft = useFormInputDraft({ kind: "evening", sleep, quality, mood, painParts, weight, hr,
    memo: note.text, purpose: note.purpose ?? null }, entryId, true, lastSavedAt.current)
  const hasInput = sleep > 0 || quality > 0 || mood > 0 || Object.values(painParts).some(level => level > 0)
    || weight.trim() !== "" || hr.trim() !== "" || note.text.trim() !== ""

  const navigateTo = (location: EveningLocation) => setFlow((current) => ({
    location, history: [...current.history, current.location],
  }))
  const goBackFlow = () => setFlow((current) => {
    const previous = current.history[current.history.length - 1]
    if (previous === undefined) return current
    return { location: previous, history: current.history.slice(0, -1) }
  })
  const enterReview = () => {
    const preparation = note.prepareForSave()
    if (!preparation.ready) {
      if (step !== "memo") navigateTo({ step: "memo", editGroup: "memo", returnToReview: true })
      return
    }
    navigateTo({ step: "review", editGroup: null })
  }
  const continueFlow = () => {
    if (flow.location.returnToReview || editGroup !== null) { enterReview(); return }
    if (step === "sleep") navigateTo({ step: "condition", editGroup: null })
    else if (step === "condition") navigateTo({ step: "memo", editGroup: null })
    else if (step === "memo") enterReview()
    else if (step === "metrics") enterReview()
  }
  const goToMemoOnly = () => navigateTo({ step: "memo", editGroup: null })
  useTaskFlowBack({ enabled: flow.history.length > 0, busy: saving, onBack: goBackFlow })
  React.useEffect(() => {
    if (step === "memo" && note.purposeError !== null) note.privateOptionRef.current?.focus()
  }, [step, note.purposeError, note.privateOptionRef])

  const persist = async () => {
    if (persistInFlight.current || !draft.current()) return
    if (!hasInput) { setEmptyNotice(true); return }
    setEmptyNotice(false)
    const notePreparation = note.prepareForSave()
    if (!notePreparation.ready) {
      if (step !== "memo") navigateTo({ step: "memo", editGroup: "memo", returnToReview: true })
      return
    }
    let entry: JournalEntry = {
      id: entryId, kind: "evening", date: entryDate,
      savedAt: nextJournalSavedAt(lastSavedAt.current), syncState: "local",
      sleepH: sleep, sleepQuality: quality, weightKg: weight, restingHr: hr,
      painParts, mood, note: note.text,
      fieldProvenance: {
        sleepH: explicitOrMissing(sleep > 0),
        sleepQuality: explicitOrMissing(quality > 0),
        weightKg: explicitOrMissing(weight.trim() !== ""),
        restingHr: explicitOrMissing(hr.trim() !== ""),
        painParts: explicitOrMissing(Object.values(painParts).some((level) => level > 0)),
        mood: explicitOrMissing(mood > 0),
      },
      ...(note.text.trim() !== "" && note.purpose !== undefined ? { memoPurpose: note.purpose } : {}),
    }
    const isPrivateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.note.trim() !== ""
    persistInFlight.current = true
    setSaving(true)
    setSaveError(false)
    setAccountNotice(null)
    try {
      const accountResult = accountEnabled ? await finalization.save(entry, lastSavedAt.current) : null
      if (accountResult?.ok) entry = accountResult.entry
      const result = accountEnabled ? accountResult : (lastSavedAt.current === undefined
        ? isPrivateMemo ? await savePrivateEntry(entry) : saveEntry(entry)
        : isPrivateMemo ? await updatePrivateEntry(entry, lastSavedAt.current) : updateEntry(entry, lastSavedAt.current))
      if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=evening ok=${result?.ok === true}`)
      if (!result?.ok) { setAccountNotice(accountResult?.notice ?? null); setSaveError(true); return }
      if (!draft.current()) return
      if (accountResult?.ok && accountResult.storage !== "ACCOUNT") {
        setAccountNotice(accountResult.storage === "CONFLICT" ? "수정 충돌 확인 필요 · 기기 보관됨 · 기록 미완료" : "계정 전송 대기 · 기기 보관됨 · 기록 미완료")
        setSaveError(true); return
      }
      if (accountEnabled) await draft.complete()
      else void draft.complete()
      if (!draft.current()) return
      lastSavedAt.current = entry.savedAt
      const saved = accountResult?.ok ? { ...entry, syncState: accountResult.storage === "ACCOUNT" ? "synced" as const : "local" as const } : entry
      const storageMessage = !accountResult?.ok ? null : accountResult.storage === "ACCOUNT"
        ? isPrivateMemo ? "비밀 일지를 계정에 저장했어요. 공유·분석에는 사용하지 않아요." : "일지를 계정에 저장했어요."
        : accountResult.storage === "CONFLICT"
          ? "수정 충돌을 확인해 주세요. 이 기기의 내용은 보관했지만 계정 저장은 완료되지 않았어요."
          : isPrivateMemo ? "비밀 일지를 이 기기에 보관했어요. 계정 전송 대기 중이며 공유·분석에는 사용하지 않아요."
            : "일지를 이 기기에 보관했어요. 계정 전송 대기 중이에요."
      const reviewMessage = notePreparation.reviewMessage ?? (painLevelsRequireReview(saved.painParts) ? "불편한 곳을 기록했어요. 몸 상태를 확인해 주세요." : undefined)
      if (storageMessage) onDone?.("evening", saved, reviewMessage, storageMessage)
      else onDone?.("evening", saved, reviewMessage)
    } catch {
      setSaveError(true)
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  const stepTitle: Record<EveningStep, string> = {
    sleep: "어젯밤 수면",
    condition: "오늘 몸 상태와 기분",
    metrics: "체중 · 안정시 심박",
    memo: "오늘 남길 메모",
    review: "입력 확인",
  }
  const guidance: Record<Exclude<EveningStep, "review">, string> = {
    sleep: "수면 시간과 질은 선택 입력이에요. 모르면 비워 두고 넘어가도 괜찮아요.",
    condition: "몸 상태와 기분은 각각 선택 입력이에요. 입력하지 않아도 됩니다.",
    metrics: "재지 않은 값은 비워 둬도 괜찮아요.",
    memo: "메모는 선택이에요. 남기지 않고 입력 확인으로 갈 수 있어요.",
  }
  const painPartCount = Object.values(painParts).filter((level) => level > 0).length
  const sleepSummary = [
    sleep > 0 ? `${sleep}h` : null,
    quality > 0 ? `수면 질 ${SLEEP_QUALITY_LABELS[quality - 1]}` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "입력 안 함"
  const conditionSummary = [
    painPartCount > 0 ? `불편한 곳 ${painPartCount}곳 표시` : null,
    mood > 0 ? `기분 ${MOOD_LABELS[mood - 1]}` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "입력 안 함"
  const hasMetricInput = weight.trim() !== "" || hr.trim() !== ""
  const metricsSummary = [
    weight.trim() ? `체중 ${weight.trim()}kg` : null,
    hr.trim() ? `안정시 심박 ${hr.trim()}bpm` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "입력 안 함"
  const memoPreview = note.text.trim().replace(/\s+/gu, " ")
  const memoSummary = memoPreview
    ? `${memoPreview.slice(0, 80)}${memoPreview.length > 80 ? "…" : ""}${note.purpose === "PRIVATE_SELF_ONLY" ? " · 나만 보는 메모" : note.purpose === undefined ? " · 용도 미선택" : ""}`
    : "입력 안 함"
  const reviewItems: Array<{ key: Exclude<EveningStep, "review">; label: string; value: string }> = [
    { key: "sleep", label: "수면", value: sleepSummary },
    { key: "condition", label: "몸 상태 · 기분", value: conditionSummary },
    { key: "metrics", label: "체중 · 안정시 심박", value: metricsSummary },
    { key: "memo", label: "메모", value: memoSummary },
  ]
  const reviewActionLabel = (key: Exclude<EveningStep, "review">) => {
    const hasValue = key === "sleep" ? sleep > 0 || quality > 0
      : key === "condition" ? painPartCount > 0 || mood > 0
        : key === "metrics" ? hasMetricInput
          : memoPreview.length > 0
    return hasValue ? "수정" : "입력"
  }

  return (
    <div style={{ paddingBottom: 100 }} aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={draft.back(onBack)}>회복 · 하루 마무리</TopBar>
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={compactDate(entryDate)} dow={`${dowOf(entryDate)} · ${nowClock()}`} />
      </div>
      {step === "review" && emptyNotice && !hasInput && <p role="alert">아직 입력한 내용이 없어요. 남길 항목 하나를 골라 주세요.</p>}
      <TaskFlowStep stepKey={`${step}:${editGroup ?? "flow"}`} title={stepTitle[step]}
        busy={saving} onBack={flow.history.length > 0 ? goBackFlow : undefined}
        summary={step === "review" ? undefined : <p style={{ margin: 0 }}>{guidance[step]}</p>}
        actions={step === "review" ? <StickyBar onSave={persist} error={saveError && !accountEnabled}
          label={saving ? "저장 중" : isEditing ? "수정 저장" : undefined} /> : (
          <div className="task-flow__actions">
            {flow.location.returnToReview
              ? <button type="button" className="quick-log__primary" onClick={enterReview}>입력 확인으로</button>
              : <>
                {step === "sleep" && <button type="button" className="quick-log__secondary" onClick={goToMemoOnly}>메모만 남기기</button>}
                {(step === "sleep" || step === "condition") && <button type="button" className="quick-log__primary" onClick={continueFlow}>다음 질문</button>}
                {(step === "sleep" || step === "condition") && <button type="button" className="quick-log__secondary" onClick={enterReview}>지금 입력 확인</button>}
                {(step === "memo" || step === "metrics") && <button type="button" className="quick-log__primary" onClick={continueFlow}>입력 확인으로</button>}
              </>}
          </div>
        )}>

        {step === "review" && <div className="post-session-review" aria-label="저장 전 입력 확인">
          {note.reviewMessage !== null && <p role="status">{note.reviewMessage}</p>}
          {painLevelsRequireReview(painParts) && <PainReviewBanner />}
          <p>입력한 내용만 저장해요.</p>
          <dl style={{ display: "grid", gap: 8, margin: 0 }}>
            {reviewItems.filter(item => reviewActionLabel(item.key) === "수정").map((item) => (
              <div key={item.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)", paddingBlock: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <dt style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.label}</dt>
                  <dd style={{ margin: "2px 0 0", fontSize: 14, color: "var(--ink)", overflowWrap: "anywhere" }}>{item.value}</dd>
                </div>
                <button type="button" className="quick-log__secondary" aria-label={`${item.label} ${reviewActionLabel(item.key)}`}
                  onClick={() => navigateTo({ step: item.key, editGroup: item.key, returnToReview: true })}>{reviewActionLabel(item.key)}</button>
              </div>
            ))}
          </dl>
          {reviewItems.some(item => reviewActionLabel(item.key) === "입력") && <div className="task-review-additions" role="group" aria-label="추가할 항목">
            {reviewItems.filter(item => reviewActionLabel(item.key) === "입력").map(item => <button key={item.key}
              type="button" className="quick-log__secondary" aria-label={`${item.label} 입력`}
              onClick={() => navigateTo({ step: item.key, editGroup: item.key, returnToReview: true })}>{item.label}</button>)}
          </div>}
        </div>}

        {step === "sleep" && <>
          <FormSec compact lb={`수면 시간 · ${sleep > 0 ? `${sleep}h` : "선택 입력"}`}>
            <div style={{ position: "relative", height: 44, display: "flex", alignItems: "center" }}>
              <div aria-hidden="true" style={{
                position: "absolute", left: 0, right: 0, top: "50%", height: 4,
                transform: "translateY(-50%)", background: "var(--line)",
              }}>
                <div style={{
                  width: sleep > 0 ? `${((sleep - 4) / 8) * 100}%` : "0%",
                  height: 4, background: "var(--ink)",
                }} />
              </div>
              {sleep > 0 && (
                <div aria-hidden="true" style={{
                  position: "absolute", top: "50%", left: `${((sleep - 4) / 8) * 100}%`,
                  width: 18, height: 18, transform: "translate(-50%, -50%)",
                  borderRadius: 999, background: "var(--ink)", border: "3px solid var(--bg)",
                }} />
              )}
              {sleep === 0 && (
                <div aria-hidden="true" style={{
                  position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
                  fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
                  letterSpacing: "0.06em", pointerEvents: "none",
                }}>아래로 움직여 기록</div>
              )}
              <input aria-label="수면 시간" type="range" min="4" max="12" step="0.5"
                value={sleep > 0 ? sleep : 4}
                onChange={(event) => setSleep(parseFloat(event.target.value))}
                style={{ position: "absolute", inset: 0, width: "100%", height: 44, margin: 0, opacity: 0.01, cursor: "pointer" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>
              <span>4h</span><span>8h</span><span>12h</span>
            </div>
            {sleep > 0 && <button type="button" className="quick-log__secondary" onClick={() => setSleep(0)}>시간 입력 안 함</button>}
          </FormSec>

          <FormSec compact lb="수면 질 · 선택">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", border: "1px solid var(--ink)" }}>
              {SLEEP_QUALITY_LABELS.map((label, index) => (
                <button key={label} type="button" aria-label={`수면 질 ${index + 1} ${label}`} aria-pressed={quality === index + 1} onClick={() => setQuality(index + 1)} style={{
                  minHeight: 44, padding: "10px 0", border: 0,
                  background: quality === index + 1 ? "var(--ink)" : "transparent",
                  color: quality === index + 1 ? "var(--bg)" : "var(--ink)",
                  fontFamily: "var(--mono)", fontSize: 10.5,
                  borderRight: index < 4 ? "1px solid var(--line)" : 0,
                  cursor: "pointer", letterSpacing: "0.04em",
                }}>{label}</button>
              ))}
            </div>
            {quality > 0 && <button type="button" className="quick-log__secondary" onClick={() => setQuality(0)}>수면 질 입력 안 함</button>}
          </FormSec>
        </>}

        {step === "condition" && <>
          <FormSec compact lb="몸 상태 · 표시 선택">
            <BodyDiagram selected={painParts} onChange={setPainParts} />
            {painLevelsRequireReview(painParts) && <PainReviewBanner />}
          </FormSec>
          <FormSec compact lb="오늘 감정 · 선택">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {MOOD_LABELS.map((label, index) => (
                <button key={label} type="button" aria-label={`감정 ${index + 1} ${label}`} aria-pressed={mood === index + 1} onClick={() => setMood(index + 1)} style={{
                  minHeight: 44, padding: "14px 4px 10px",
                  background: mood === index + 1 ? "var(--surface)" : "transparent",
                  border: mood === index + 1 ? "1px solid var(--ink)" : "1px solid var(--line)",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  borderRadius: 0,
                }}>
                  <MoodStrip level={index + 1} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: mood === index + 1 ? "var(--ink)" : "var(--ink-3)", letterSpacing: "0.06em" }}>{label}</span>
                </button>
              ))}
            </div>
            {mood > 0 && <button type="button" className="quick-log__secondary" onClick={() => setMood(0)}>기분 입력 안 함</button>}
          </FormSec>
        </>}

        {step === "metrics" && <FormSec compact lb="체중 · 안정시 심박 · 선택">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <input aria-label="체중 (kg)" type="text" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="62.0" style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>kg · 안 재면 비워둬요</div>
            </div>
            <div>
              <input aria-label="안정시 심박 (bpm)" type="text" value={hr} onChange={(event) => setHr(event.target.value)} placeholder="55" style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", marginTop: 4 }}>bpm · 아침 안정시 기준</div>
            </div>
          </div>
        </FormSec>}

        {step === "memo" && <FormSec compact lb="오늘의 한 줄 · 선택">
          <PurposeScopedMemoField
            controller={note}
            fieldId="evening-note"
            label="오늘의 메모"
            placeholder="메모만 남겨도 괜찮아요"
          />
        </FormSec>}

        {accountEnabled && saveError && <p role="alert">{accountNotice ?? "계정 저장을 완료하지 못했어요. 입력은 그대로 남아 있어요. 연결과 로그인 상태를 확인한 뒤 다시 저장해 주세요."}</p>}
      </TaskFlowStep>
      </fieldset>
    </div>
  )
}
