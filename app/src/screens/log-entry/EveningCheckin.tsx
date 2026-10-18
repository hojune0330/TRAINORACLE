import React from "react"
import { JournalWritingDecorationPreview } from "../journal/JournalDecorationPreview"
import { FormInputDraftBoundary, useFormInputDraft, useRecoveredFormInput } from "./useFormInputDraft"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { FormFinalizationRecovery, useFormFinalization } from "./useFormFinalization"
import { MoodStrip } from "../../components/JournalPrimitives"
import { ChevronRight, HeartPulse, Smile, Moon, Pencil, Activity } from "lucide-react"
import { compactDate, dowOf } from "../../domain/dates"
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
import { PainReviewBanner } from "./BodyDiagram"
import { JournalBodyInput } from "./JournalBodyInput"
import { journalPainPartsForSafety, type BodyPartMetadataV1 } from "../../domain/body-part-metadata"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { inputStyle } from "./input-style"
import { FormSec, TopBar } from "./shared"
import { FormInputSaveBar as StickyBar } from "./useFormInputDraft"
import type { EntryFormProps } from "./shared"
import { TaskFlowStep } from "../../components/TaskFlowStep"
import { useJournalFormNavigation } from "./useJournalFormNavigation"
import "./EveningCheckin.css"
import "../../styles/category-cards.css"

const SleepInnEntry = React.lazy(() => import("../sleep-inn/SleepInnEntry").then(module => ({ default: module.SleepInnEntry })))

const MOOD_LABELS = ["흐림", "무덤덤", "보통", "좋음", "최고"] as const
const SLEEP_QUALITY_LABELS = ["최악", "나쁨", "보통", "좋음", "최고"] as const
const validOptionalMeasurement = (value: string) => value.trim() === "" || (/^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value.trim()) && Number.isFinite(Number(value)) && Number(value) > 0)
const isValidSleepHours = (value: string) => {
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value)) return false
  const hours = Number(value)
  return Number.isFinite(hours) && hours > 0 && hours <= 24
}
type EveningInputStep = "sleep" | "condition" | "mood" | "metrics" | "memo"
type EveningStep = EveningInputStep | "choose" | "review"
type EveningEditGroup = EveningInputStep | null
type EveningLocation = { readonly step: EveningStep; readonly editGroup: EveningEditGroup; readonly returnToReview?: boolean }
type EveningFlow = { readonly location: EveningLocation; readonly history: readonly EveningLocation[] }

export function EveningCheckin(props: EntryFormProps) {
  const date = props.initialEntry?.date ?? props.targetDate ?? todayISO()
  return <JournalWritingDecorationPreview date={date}><FormInputDraftBoundary kind="evening" date={date} onExit={props.onExit ?? props.onBack}
    hasInitialContext={props.initialEntry !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt])}>
    <EveningCheckinEditor {...props} />
  </FormInputDraftBoundary></JournalWritingDecorationPreview>
}

function EveningCheckinEditor({ onBack, onExit, onDone, targetDate, initialEntry, initialBodyPartId, initialSection, embedded, onNavigationReady }: EntryFormProps) {
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
    location: { step: initialSection ?? (initial !== undefined || recovered !== null ? "review" : initialBodyPartId !== undefined ? "condition" : "choose"), editGroup: null }, history: [],
  }))
  const { step, editGroup } = flow.location
  const [sleep, setSleep] = React.useState(() => input?.sleep ?? initial?.sleepH ?? 0)
  const [sleepText, setSleepText] = React.useState(() => {
    const hours = input?.sleep ?? initial?.sleepH ?? 0
    return hours > 0 ? String(hours) : ""
  })
  const [sleepInputError, setSleepInputError] = React.useState(false)
  const sleepInputRef = React.useRef<HTMLInputElement>(null)
  const [quality, setQuality] = React.useState(() => input?.quality ?? initial?.sleepQuality ?? 0)
  const [mood, setMood] = React.useState(() => input?.mood ?? initial?.mood ?? 0)
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...(input?.painParts ?? initial?.painParts) }))
  const [bodyPartMetadata, setBodyPartMetadata] = React.useState<BodyPartMetadataV1 | undefined>(() => input?.bodyPartMetadata ?? initial?.bodyPartMetadata)
  const painSignals = journalPainPartsForSafety({ painParts, bodyPartMetadata })
  const [weight, setWeight] = React.useState(() => input?.weight ?? initial?.weightKg ?? "")
  const [hr, setHr] = React.useState(() => input?.hr ?? initial?.restingHr ?? "")
  const weightRef = React.useRef<HTMLInputElement>(null)
  const hrRef = React.useRef<HTMLInputElement>(null)
  const [metricsChecked, setMetricsChecked] = React.useState(false)
  const weightInvalid = !validOptionalMeasurement(weight)
  const hrInvalid = !validOptionalMeasurement(hr)
  const [saveError, setSaveError] = React.useState(false)
  const [emptyNotice, setEmptyNotice] = React.useState(false)
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null)
  const [sleepInnOpen, setSleepInnOpen] = React.useState(false)
  const note = usePurposeScopedMemo(input?.memo ?? initial?.note ?? "", input ? input.purpose ?? undefined : initial?.memoPurpose)
  const draft = useFormInputDraft({ kind: "evening", sleep, quality, mood, painParts, ...(bodyPartMetadata ? { bodyPartMetadata } : {}), weight, hr,
    memo: note.text, purpose: note.purpose ?? null }, entryId, true, lastSavedAt.current, sleepInputError)
  const hasInput = initial?.bodyPartMetadata !== undefined || sleep > 0 || quality > 0 || mood > 0 || Object.values(painSignals).some(level => level > 0)
    || weight.trim() !== "" || hr.trim() !== "" || note.text.trim() !== ""

  const navigateTo = (location: EveningLocation) => setFlow((current) => {
    // Review is a stable destination, not another visit in an ever-growing stack.
    if (location.step === "review") {
      const existing = current.history.findIndex(item => item.step === "review")
      return { location, history: existing >= 0 ? current.history.slice(0, existing)
        : current.history.filter(item => item.step === "choose") }
    }
    if (location.step === current.location.step) return current
    return { location, history: [...current.history, current.location] }
  })
  const updateSleepText = (value: string) => {
    setSleepText(value)
    if (value === "") {
      setSleep(0)
      setSleepInputError(false)
      return
    }
    if (!isValidSleepHours(value)) {
      setSleepInputError(true)
      return
    }
    setSleep(Number(value))
    setSleepInputError(false)
  }
  const goBackFlow = () => {
    setFlow((current) => {
      const previous = current.history[current.history.length - 1]
      if (previous === undefined) return current
      return { location: previous, history: current.history.slice(0, -1) }
    })
  }
  const validateMetrics = () => {
    if (!weightInvalid && !hrInvalid) return true
    setMetricsChecked(true)
    if (step !== "metrics") navigateTo({ step: "metrics", editGroup: "metrics" })
    window.requestAnimationFrame(() => (weightInvalid ? weightRef : hrRef).current?.focus())
    return false
  }
  const enterReview = () => {
    if (sleepInputError) {
      if (step !== "sleep") navigateTo({ step: "sleep", editGroup: "sleep", returnToReview: true })
      window.requestAnimationFrame(() => sleepInputRef.current?.focus())
      return
    }
    if (!validateMetrics()) return
    const preparation = note.prepareForSave()
    if (!preparation.ready) {
      if (step !== "memo") navigateTo({ step: "memo", editGroup: "memo", returnToReview: true })
      return
    }
    navigateTo({ step: "review", editGroup: null })
  }
  const navigation = useJournalFormNavigation({ draft, onBack, onExit, onSave: () => {
    if (!sleepInputError && step !== "review") navigateTo({ step: "review", editGroup: null })
    void persist()
  },
    flowEnabled: flow.history.length > 0, busy: saving, onStepBack: goBackFlow, rootBackEnabled: embedded })
  React.useLayoutEffect(() => {
    onNavigationReady?.(navigation.exit)
    return () => onNavigationReady?.(null)
  }, [onNavigationReady, navigation.exit])
  React.useEffect(() => {
    if (step === "memo" && note.purposeError !== null) note.privateOptionRef.current?.focus()
  }, [step, note.purposeError, note.privateOptionRef])

  const persist = async () => {
    if (persistInFlight.current || !draft.current()) return
    if (sleepInputError) {
      if (step !== "sleep") navigateTo({ step: "sleep", editGroup: "sleep", returnToReview: true })
      window.requestAnimationFrame(() => sleepInputRef.current?.focus())
      return
    }
    if (!validateMetrics()) return
    // Clearing an existing answer is a valid edit, not a new empty record.
    if (!hasInput && !isEditing) { setEmptyNotice(true); return }
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
      ...(bodyPartMetadata ? { bodyPartMetadata } : {}),
      fieldProvenance: {
        sleepH: explicitOrMissing(sleep > 0),
        sleepQuality: explicitOrMissing(quality > 0),
        weightKg: explicitOrMissing(weight.trim() !== ""),
        restingHr: explicitOrMissing(hr.trim() !== ""),
        painParts: explicitOrMissing(bodyPartMetadata !== undefined || Object.values(painSignals).some((level) => level > 0)),
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
      const reviewMessage = notePreparation.reviewMessage ?? (painLevelsRequireReview(journalPainPartsForSafety(saved)) ? "불편한 곳을 기록했어요. 몸 상태를 확인해 주세요." : undefined)
      navigation.finish(() => {
        if (storageMessage) onDone?.("evening", saved, reviewMessage, storageMessage)
        else onDone?.("evening", saved, reviewMessage)
      })
    } catch {
      setSaveError(true)
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  const stepTitle: Record<EveningStep, string> = {
    choose: "무엇을 남길까요?",
    sleep: "어젯밤 수면",
    condition: "오늘 몸 상태",
    mood: "오늘 기분",
    metrics: "체중 · 안정시 심박",
    memo: "오늘 남길 메모",
    review: "입력 확인",
  }
  const painPartCount = Object.values(painSignals).filter((level) => level > 0).length
  const sleepSummary = [
    sleep > 0 ? `${sleep}h` : null,
    quality > 0 ? `수면 질 ${SLEEP_QUALITY_LABELS[quality - 1]}` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "입력 안 함"
  const clearedBody = painPartCount === 0 && initial !== undefined && Object.values(journalPainPartsForSafety(initial)).some(level => level > 0)
  const conditionSummary = painPartCount > 0 ? `불편한 곳 ${painPartCount}곳 표시` : clearedBody ? "이 기록의 통증 표시를 지웠어요" : "입력 안 함"
  const moodSummary = mood > 0 ? `기분 ${MOOD_LABELS[mood - 1]}` : "입력 안 함"
  const hasMetricInput = weight.trim() !== "" || hr.trim() !== ""
  const metricsSummary = [
    weight.trim() ? `체중 ${weight.trim()}kg` : null,
    hr.trim() ? `안정시 심박 ${hr.trim()}bpm` : null,
  ].filter((value): value is string => value !== null).join(" · ") || "입력 안 함"
  const memoPreview = note.text.trim().replace(/\s+/gu, " ")
  const memoSummary = memoPreview
    ? `${memoPreview.slice(0, 80)}${memoPreview.length > 80 ? "…" : ""}${note.purpose === "PRIVATE_SELF_ONLY" ? " · 나만 보는 메모" : note.purpose === undefined ? " · 용도 미선택" : ""}`
    : "입력 안 함"
  const reviewItems: Array<{ key: EveningInputStep; label: string; value: string }> = [
    { key: "sleep", label: "수면", value: sleepSummary },
    { key: "condition", label: "몸 상태", value: conditionSummary },
    { key: "mood", label: "기분", value: moodSummary },
    { key: "metrics", label: "체중 · 안정시 심박", value: metricsSummary },
    { key: "memo", label: "메모", value: memoSummary },
  ]
  const reviewActionLabel = (key: EveningInputStep) => {
    const hasValue = key === "sleep" ? sleep > 0 || quality > 0
      : key === "condition" ? painPartCount > 0 || clearedBody
        : key === "mood" ? mood > 0
          : key === "metrics" ? hasMetricInput
            : memoPreview.length > 0
    return hasValue ? "수정" : "입력"
  }

  return (
    <div className="evening-checkin" style={{ paddingBottom: 100 }} aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={flow.history.length > 0 ? goBackFlow : navigation.back} onExit={navigation.exit}>컨디션·메모</TopBar>
      {!embedded && <button type="button" className="quick-log__secondary" style={{ minHeight: 44 }} onClick={() => setSleepInnOpen(true)}>
        <Moon size={18} aria-hidden="true" /> 펫과 함께 자기
      </button>}
      {sleepInnOpen && <React.Suspense fallback={<p role="status">여관을 여는 중이에요.</p>}>
        <SleepInnEntry date={entryDate} draft={{ date: entryDate, entryId, status: "draft", sourceLabel: "작성 중인 일지 · 아직 저장하지 않음",
          ...(!sleepInputError && sleep > 0 ? { sleepH: sleep } : {}), ...(quality > 0 ? { sleepQuality: quality } : {}) }}
          onBack={() => setSleepInnOpen(false)} returnLabel="작성 중인 일지로 돌아가기" />
      </React.Suspense>}
      {navigation.dialog}
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      <p className="evening-checkin__body-date">
        <time dateTime={entryDate}>{compactDate(entryDate)}</time>
        <span>{dowOf(entryDate)}</span>
      </p>
      {step === "review" && emptyNotice && !hasInput && <p role="alert">아직 입력한 내용이 없어요. 남길 항목 하나를 골라 주세요.</p>}
      <TaskFlowStep stepKey={`${step}:${editGroup ?? "flow"}`} title={stepTitle[step]}
        className={step === "condition" ? "evening-checkin__body-step" : undefined}
        busy={saving}
        actions={step === "review" ? hasInput || isEditing ? <StickyBar onSave={persist} error={saveError && !accountEnabled}
          label={saving ? "저장 중" : isEditing ? "수정 저장" : undefined} /> : undefined : step === "choose" ? undefined : step === "condition" ? (
          <button type="button" className="evening-checkin__body-review" onClick={enterReview}>입력 확인</button>
        ) : (
          <button type="button" className="evening-checkin__body-review" onClick={enterReview}>입력 확인으로</button>
        )}>

        {step === "choose" && <nav className="evening-checkin__choices" aria-label="남길 항목">
          {([
            ["condition", "몸 상태", HeartPulse], ["mood", "기분", Smile], ["sleep", "수면", Moon], ["metrics", "체중·심박", Activity], ["memo", "메모 쓰기", Pencil],
          ] as const).map(([key, label, Icon]) => <button key={key} type="button" data-category="body"
            data-entry-choice={key}
            className={`evening-checkin__choice category-card${key === "memo" ? " evening-checkin__choice--memo" : ""}`}
            onClick={() => navigateTo({ step: key, editGroup: key, returnToReview: true })}>
            <span className="evening-checkin__choice-icon category-icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="evening-checkin__choice-label category-card__copy category-card__title">{label}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>)}
        </nav>}

        {step === "review" && <div className="post-session-review" aria-label="저장 전 입력 확인">
          {!hasInput && !isEditing && <p>남길 항목을 골라 주세요.</p>}
          {note.reviewMessage !== null && <p role="status">{note.reviewMessage}</p>}
          {painLevelsRequireReview(painSignals) && <PainReviewBanner />}
          <dl className="evening-checkin__review">
            {reviewItems.filter(item => reviewActionLabel(item.key) === "수정").map((item) => (
              <div key={item.key} className="evening-checkin__review-row">
                <div style={{ minWidth: 0 }}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
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
          <FormSec compact lb="수면 시간">
            <label htmlFor="evening-sleep-hours" style={{ display: "block", fontSize: "var(--fs-body-sm)", marginBottom: "var(--space-2)" }}>
              시간 (h) · 선택 입력
            </label>
            <input id="evening-sleep-hours" ref={sleepInputRef} aria-label="수면 시간" aria-invalid={sleepInputError}
              aria-describedby={sleepInputError ? "sleep-time-error" : undefined}
              type="text" inputMode="decimal" autoComplete="off" value={sleepText}
              onChange={(event) => updateSleepText(event.target.value)}
              style={{ ...inputStyle(), borderRadius: "var(--r-action)", fontFamily: "var(--mono)", maxWidth: 220, textAlign: "right" }} />
            {sleepInputError && <p id="sleep-time-error" role="alert" style={{ fontSize: "var(--fs-caption)", color: "var(--err)", lineHeight: 1.5, margin: "var(--space-1) 0 0" }}>
              0은 비워 두고, 1시간 미만도 입력할 수 있어요. 최대 24시간이에요.
            </p>}
            {sleepText !== "" && <button type="button" className="quick-log__secondary" onClick={() => updateSleepText("")}>시간 입력 안 함</button>}
          </FormSec>

          <FormSec compact lb="수면 질 · 선택">
            <div className="app-choice-group" role="group" aria-label="수면 질" style={{ display: "flex", flexWrap: "wrap" }}>
              {SLEEP_QUALITY_LABELS.map((label, index) => (
                <button key={label} type="button" className="app-choice-control" aria-label={`수면 질 ${index + 1} ${label}`}
                  aria-pressed={quality === index + 1} onClick={() => setQuality(index + 1)}
                  style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-body-sm)", paddingInline: "var(--space-1)", flex: "1 0 44px", minWidth: "max-content", whiteSpace: "nowrap" }}>{label}</button>
              ))}
            </div>
            {quality > 0 && <button type="button" className="quick-log__secondary" onClick={() => setQuality(0)}>수면 질 입력 안 함</button>}
          </FormSec>
        </>}

        {step === "condition" &&
          <div style={{ padding: "var(--space-1) var(--space-5) 0" }}>
            <JournalBodyInput selected={painParts} onChange={setPainParts} metadata={bodyPartMetadata} onMetadataChange={setBodyPartMetadata} initialPartId={initialBodyPartId} />
            {painLevelsRequireReview(painSignals) && <PainReviewBanner />}
          </div>
        }

        {step === "mood" &&
          <div style={{ padding: "var(--space-1) var(--space-5) 0" }}>
            <div role="group" aria-label="오늘 기분" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {MOOD_LABELS.map((label, index) => (
                <button key={label} type="button" className="app-choice-control app-choice-control--answer" aria-label={`기분 ${index + 1} ${label}`} aria-pressed={mood === index + 1} onClick={() => setMood(index + 1)} style={{
                  padding: "var(--space-2) var(--space-1)",
                  flex: "1 0 44px", minWidth: "max-content", whiteSpace: "nowrap",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                }}>
                  <MoodStrip level={index + 1} />
                  <span style={{ fontFamily: "var(--sans)", fontSize: "var(--fs-body-sm)", color: "inherit" }}>{label}</span>
                </button>
              ))}
            </div>
            {mood > 0 && <button type="button" className="quick-log__secondary" onClick={() => setMood(0)}>기분 입력 안 함</button>}
          </div>
        }

        {step === "metrics" && <FormSec compact lb="체중 · 안정시 심박 · 선택">
          <div className="evening-checkin__metrics">
            <div>
              <label htmlFor="evening-weight">체중 (kg)</label>
              <input id="evening-weight" ref={weightRef} inputMode="decimal" aria-label="체중 (kg)" aria-invalid={metricsChecked && weightInvalid} aria-describedby={metricsChecked && weightInvalid ? "evening-weight-error" : undefined} type="text" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="미입력" style={{ ...inputStyle(), textAlign: "right" }} />
              {metricsChecked && weightInvalid && <p id="evening-weight-error" role="alert">0보다 큰 숫자로 입력해 주세요. 안 쟀다면 비워 두세요.</p>}
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--ink-2)", letterSpacing: "0.02em", marginTop: 4 }}>kg · 안 재면 비워둬요</div>
            </div>
            <div>
              <label htmlFor="evening-hr">안정시 심박 (bpm)</label>
              <input id="evening-hr" ref={hrRef} inputMode="numeric" aria-label="안정시 심박 (bpm)" aria-invalid={metricsChecked && hrInvalid} aria-describedby={metricsChecked && hrInvalid ? "evening-hr-error" : undefined} type="text" value={hr} onChange={(event) => setHr(event.target.value)} placeholder="미입력" style={{ ...inputStyle(), textAlign: "right" }} />
              {metricsChecked && hrInvalid && <p id="evening-hr-error" role="alert">0보다 큰 숫자로 입력해 주세요. 안 쟀다면 비워 두세요.</p>}
              <div style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", color: "var(--ink-2)", letterSpacing: "0.02em", marginTop: 4 }}>bpm · 아침 안정시 기준</div>
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
