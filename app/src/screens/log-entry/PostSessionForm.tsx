import React from "react"
import { JournalWritingDecorationPreview } from "../journal/JournalDecorationPreview"
import { Plus, ChevronUp } from "lucide-react"
import { FormInputDraftBoundary, useFormInputDraft, useRecoveredFormInput } from "./useFormInputDraft"
import type { ObjectiveEditorDraft, ExerciseEditorDraft } from "./form-input-draft"
import { hasExerciseLog, type ExerciseLog } from "../../domain/exercise-log"
import { PlannedRepetitionEditor } from "./PlannedRepetitionEditor"
import { PlannedWorkoutContext } from "./PlannedWorkoutContext"
import { usePlannedNumberInputs } from "./planned-number-input"
import { ExerciseLogEditor } from "./ExerciseLogEditor"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { FormFinalizationRecovery, useFormFinalization } from "./useFormFinalization"
import { IndexCard } from "../../components/JournalPrimitives"
import { compactDate, dowOf, nowClock } from "../../domain/dates"
import { derivedProvenance, explicitOrMissing, isImportedField } from "../../domain/field-provenance"
import { IMPORTED_OBJECTIVE_FIELDS } from "../../domain/journal-edit-policy"
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
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { IntensityAssessmentField, useIntensityAssessment } from "./IntensityAssessmentField"
import { inputStyle } from "./input-style"
import { FormSec, TopBar, useSectionTouchOrder } from "./shared"
import { FormInputSaveBar as StickyBar } from "./useFormInputDraft"
import type { EntryFormProps } from "./shared"
import { JOURNAL_ENERGY_SYSTEM_OPTIONS } from "../../domain/energy-system-taxonomy"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { derivePlanExecutionRelation } from "../../domain/plan-execution-relation"
import { TaskFlowStep } from "../../components/TaskFlowStep"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"

const DETAILED_OUTCOMES = [
  ["COMPLETED", "완료"],
  ["PARTIAL", "일부 완료"],
  ["LIGHT_ACTIVITY", "가벼운 운동"],
  ["RESTED", "휴식"],
  ["SKIPPED", "건너뜀"],
] as const

const DETAILED_SLOTS = [
  ["UNSPECIFIED", "시간 미지정"],
  ["AM", "오전"],
  ["PM", "오후"],
] as const

const OUTCOME_TITLES = {
  COMPLETED: "운동 완료",
  PARTIAL: "일부 완료",
  LIGHT_ACTIVITY: "가벼운 운동",
  RESTED: "휴식",
  SKIPPED: "건너뜀",
} as const
const GENERATED_OUTCOME_TITLES = new Set<string>(Object.values(OUTCOME_TITLES))

type DetailedOutcome = (typeof DETAILED_OUTCOMES)[number][0]
type PostSessionTask = "outcome" | "slot" | "content" | "measurements" | "effort" | "body" | "memo" | "review"

function isPerformedOutcome(outcome: DetailedOutcome | undefined): boolean {
  return outcome === "COMPLETED" || outcome === "PARTIAL" || outcome === "LIGHT_ACTIVITY"
}

function isNonPerformedOutcome(outcome: DetailedOutcome | undefined): boolean {
  return outcome === "RESTED" || outcome === "SKIPPED"
}

export function PostSessionForm(props: EntryFormProps) {
  const date = props.initialEntry?.date ?? props.targetDate ?? todayISO()
  return <JournalWritingDecorationPreview date={date}><FormInputDraftBoundary kind="post-session" date={date}
    hasInitialContext={props.initialEntry !== undefined || props.plannedSessionLink !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt, props.plannedSessionLink])}>
    <PostSessionFormEditor {...props} />
  </FormInputDraftBoundary></JournalWritingDecorationPreview>
}

function PostSessionFormEditor({ onBack, onDone, targetDate, initialEntry, plannedSessionLink }: EntryFormProps) {
  const recovered = useRecoveredFormInput("post-session")
  const input = recovered?.input
  const initial = initialEntry?.kind === "post-session" ? initialEntry : undefined
  const isEditing = initial !== undefined
  const isInputReview = isEditing || input !== undefined
  const [task, setTask] = React.useState<PostSessionTask>(isInputReview ? "review" : "outcome")
  const [editingFromReview, setEditingFromReview] = React.useState(false)
  const returnsToReview = isInputReview || editingFromReview
  React.useEffect(() => { if (isInputReview) setTask("review") }, [isInputReview])
  const [entryId] = React.useState(() => recovered?.entryId ?? initial?.id ?? newEntryId())
  const lastSavedAt = React.useRef(recovered?.baseSavedAt ?? initial?.savedAt)
  const persistInFlight = React.useRef(false)
  const [saving, setSaving] = React.useState(false)
  const accountEnabled = accountJournalRecordsEnabled()
  const finalization = useFormFinalization(entryId, accountEnabled, lastSavedAt)
  const entryDate = initial?.date ?? targetDate ?? todayISO()
  const planLink = initial?.plannedSessionLink ?? plannedSessionLink
  const [rpe, setRpe] = React.useState(() => input?.rpe ?? initial?.rpe ?? 0)
  const [activityOutcome, setActivityOutcome] = React.useState(() => input ? input.activityOutcome ?? undefined : initial?.activityOutcome)
  const [activitySlot, setActivitySlot] = React.useState<"UNSPECIFIED" | "AM" | "PM" | undefined>(() => {
    if (input) return input.activitySlot ?? undefined
    if (initial?.activitySlot === "AM" || initial?.activitySlot === "PM") return initial.activitySlot
    if (initial?.activitySlot === "SINGLE" || initial?.activitySlot === "UNSPECIFIED") return "UNSPECIFIED"
    return undefined
  })
  const [painCheckStatus, setPainCheckStatus] = React.useState(() => input?.painCheckStatus ?? initial?.painCheckStatus ?? "UNANSWERED")
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...(input?.painParts ?? initial?.painParts ?? {}) }))
  const [saveError, setSaveError] = React.useState(false)
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null)
  const [system, setSystem] = React.useState(() => (
    input?.system ?? (initial?.fieldProvenance?.system?.provenance === "EXPLICIT" ? initial.system : "")
  ))
  const [title, setTitle] = React.useState(() => input?.title ?? initial?.title ?? "")
  const [distanceKm, setDistanceKm] = React.useState(() => input?.distanceKm ?? initial?.distanceKm ?? "")
  const [durationMin, setDurationMin] = React.useState(() => input?.durationMin ?? initial?.durationMin ?? "")
  const [avgPace, setAvgPace] = React.useState(() => input?.avgPace ?? initial?.avgPace ?? "")
  const intensity = useIntensityAssessment(input ? { schemaVersion: 1, plannedRpe: input.plannedRpe,
    objectiveComponents: input.objectiveComponents } : initial?.intensityAssessment)
  const [objectiveEditor, setObjectiveEditor] = React.useState<ObjectiveEditorDraft>(() => input?.objectiveEditor ?? { kind: "INTERVALS", fields: {} })
  const [exerciseLog, setExerciseLog] = React.useState<ExerciseLog>(() => input?.exerciseLog ?? initial?.exerciseLog ?? { version: 1, source: "SELF_REPORTED", components: [] })
  const plannedInputs = usePlannedNumberInputs(input?.plannedInputs)
  const [exerciseEditor, setExerciseEditor] = React.useState<ExerciseEditorDraft | undefined>(input?.exerciseEditor)
  const [exerciseOpen, setExerciseOpen] = React.useState(() => Boolean(input?.exerciseEditor || (input?.exerciseLog ?? initial?.exerciseLog)?.components.length))
  const exercisePanelId = React.useId()
  const memo = usePurposeScopedMemo(input?.memo ?? initial?.memo ?? "", input ? input.purpose ?? undefined : initial?.memoPurpose)
  const draft = useFormInputDraft({ kind: "post-session", rpe, activityOutcome: activityOutcome ?? null,
    activitySlot: activitySlot ?? null, painCheckStatus, painParts, system, title, distanceKm, durationMin,
    avgPace, plannedRpe: intensity.plannedRpe, objectiveComponents: [...intensity.objectiveComponents],
    objectiveEditor, exerciseLog, exerciseEditor, plannedInputs: plannedInputs.values, memo: memo.text, purpose: memo.purpose ?? null }, entryId, true, lastSavedAt.current)
  const didNotPerform = isNonPerformedOutcome(activityOutcome)
  const recordsPerformance = !didNotPerform
  const importedObjective = IMPORTED_OBJECTIVE_FIELDS.some((field) => isImportedField(field, initial?.fieldProvenance))
  const returnToReview = () => {
    setEditingFromReview(false)
    setTask("review")
  }
  const chooseOutcome = (value: DetailedOutcome) => {
    setActivityOutcome(value)
    setTitle((current) => GENERATED_OUTCOME_TITLES.has(current) ? OUTCOME_TITLES[value] : current)
    setSaveError(false)
    if (returnsToReview) returnToReview()
    else setTask(isPerformedOutcome(value) ? "slot" : "memo")
  }
  const chooseSlot = (value: "UNSPECIFIED" | "AM" | "PM") => {
    setActivitySlot(value)
    if (returnsToReview) returnToReview()
    else setTask("content")
  }
  const skipOutcome = () => { if (returnsToReview) returnToReview(); else setTask("content") }
  const reviewNow = () => setTask("review")
  const nextTask = () => {
    if (returnsToReview) { returnToReview(); return }
    if (task === "content") setTask("measurements")
    else if (task === "measurements") setTask("effort")
    else if (task === "effort") setTask("body")
    else if (task === "body") setTask("memo")
    else if (task === "memo") setTask("review")
  }
  const previousTask = () => {
    setSaveError(false)
    if (returnsToReview) { returnToReview(); return }
    if (task === "slot") setTask("outcome")
    else if (task === "content") setTask(isPerformedOutcome(activityOutcome) ? "slot" : "outcome")
    else if (task === "measurements") setTask("content")
    else if (task === "effort") setTask("measurements")
    else if (task === "body") setTask("effort")
    else if (task === "memo") setTask(isNonPerformedOutcome(activityOutcome) ? "outcome" : "body")
    else if (task === "review") setTask("memo")
  }
  const firstTask = isInputReview ? task === "review" : task === "outcome"
  const goBackFlow = () => {
    if (firstTask) { draft.back(onBack)?.(); return }
    previousTask()
  }
  useTaskFlowBack({ enabled: !firstTask, busy: saving, onBack: goBackFlow })

  const selectedOutcome = activityOutcome
    ? DETAILED_OUTCOMES.find(([value]) => value === activityOutcome)?.[1] ?? "선택한 결과"
    : "아직 기록하지 않았어요"
  const selectedSlot = activitySlot
    ? DETAILED_SLOTS.find(([value]) => value === activitySlot)?.[1] ?? "선택한 시간대"
    : "아직 기록하지 않았어요"
  const selectedSystem = system
    ? JOURNAL_ENERGY_SYSTEM_OPTIONS.find((option) => option.journalValue === system)?.pickerLabel ?? "선택한 강도 시스템"
    : "아직 선택하지 않았어요"
  const measurementSummary = [
    distanceKm.trim() ? `${distanceKm.trim()} km` : null,
    durationMin.trim() ? `${durationMin.trim()}분` : null,
    avgPace.trim() ? `${avgPace.trim()} /km` : null,
  ].filter((value): value is string => value !== null)
  const hasExplicitSessionTitle = title.trim() !== "" && !GENERATED_OUTCOME_TITLES.has(title.trim())
  const hasExerciseContent = hasExplicitSessionTitle || system !== "" || hasExerciseLog(exerciseLog)
    || Object.values(plannedInputs.values).some(value => value.trim() !== "")
  const hasMeasurements = distanceKm.trim() !== "" || durationMin.trim() !== "" || avgPace.trim() !== ""
  const hasEffort = rpe > 0 || intensity.plannedRpe > 0 || intensity.objectiveComponents.length > 0
  const bodySummary = painCheckStatus === "NO_SIGNAL_REPORTED"
    ? "불편한 곳 없음"
    : painCheckStatus === "SIGNAL_REPORTED"
      ? `불편한 곳 표시 ${Object.values(painParts).filter((level) => level > 0).length}곳`
      : "아직 응답하지 않았어요"
  const memoPreview = memo.text.trim().replace(/\s+/gu, " ")
  const reviewItems: Array<{ key: PostSessionTask; label: string; value: string; answered: boolean }> = [
    { key: "outcome", label: "운동 결과", value: selectedOutcome, answered: activityOutcome !== undefined },
    ...(recordsPerformance ? [
      { key: "slot" as const, label: "운동 시간대", value: selectedSlot, answered: activitySlot !== undefined },
      {
        key: "content" as const,
        label: "실제로 한 운동",
        value: [
          hasExplicitSessionTitle ? title.trim() : null,
          system ? selectedSystem : null,
          exerciseLog.components.length > 0 ? `운동 내용 ${exerciseLog.components.length}개` : null,
          plannedInputs.invalidKeys.length > 0 ? "구간 기록 확인 필요" : null,
        ].filter(Boolean).join(" · "),
        answered: hasExerciseContent,
      },
      { key: "measurements" as const, label: "거리와 시간", value: measurementSummary.join(" · ") || "아직 기록하지 않았어요", answered: hasMeasurements },
      {
        key: "effort" as const,
        label: "운동 강도",
        value: [rpe > 0 ? `느낌 ${rpe}/10` : null, intensity.plannedRpe > 0 ? `예상 ${intensity.plannedRpe}/10` : null,
          intensity.objectiveComponents.length > 0 ? `구간 기록 ${intensity.objectiveComponents.length}개` : null]
          .filter(Boolean).join(" · "),
        answered: hasEffort,
      },
      { key: "body" as const, label: "운동 후 몸 상태", value: bodySummary, answered: painCheckStatus !== "UNANSWERED" },
    ] : []),
    { key: "memo", label: "메모", value: memoPreview ? `${memoPreview.slice(0, 80)}${memoPreview.length > 80 ? "…" : ""}${memo.purpose === "PRIVATE_SELF_ONLY" ? " · 나만 보는 메모" : ""}` : "메모 없음", answered: memo.text.trim() !== "" },
  ]
  const answeredReviewItems = reviewItems.filter(item => item.answered)
  const [emptyNotice, setEmptyNotice] = React.useState(false)
  const addableReviewItems = reviewItems.filter(item => !item.answered)
  const taskTitle: Record<PostSessionTask, string> = {
    outcome: "오늘 운동은 어떻게 됐나요?",
    slot: "언제 운동했나요?",
    content: "실제로 한 운동",
    measurements: "거리와 시간을 남겨요",
    effort: "몸에 느껴진 강도",
    body: "운동 후 몸 상태",
    memo: "오늘 남길 메모",
    review: "입력 확인",
  }
  const editReviewItem = (key: PostSessionTask) => {
    setEditingFromReview(true)
    setTask(key)
  }

  // "다음 구획을 건드렸다" 판정은 화면이 한다 (오너 결정 2026-07-28 "건드릴 때").
  // FormSec 안에 넣지 않는 이유: 무엇이 "다음" 인지는 화면 순서가 정하는
  // 것이고 화면마다 다르다. FormSec 은 신호만 받는다.
  //
  // 값이 아니라 순서로 재는 이유는 useSectionTouchOrder 주석에 있다.
  // 요약: 예상 강도를 먼저 채운 사람이 RPE 를 누르면 값 판정으로는 누른
  // 순간 접힌다. 그건 오너가 물리친 동작이다.
  const touchOrder = useSectionTouchOrder()

  const persist = async () => {
    if (persistInFlight.current || !draft.current()) return
    if (answeredReviewItems.length === 0) { setEmptyNotice(true); return }
    setEmptyNotice(false)
    if (plannedInputs.invalidKeys.length > 0) {
      plannedInputs.revealFirstInvalid()
      setSaveError(true)
      setAccountNotice("구간 기록에 고칠 숫자가 있어요. 수정하거나 입력한 구간 기록을 지운 뒤 저장해 주세요.")
      setTask("content")
      return
    }
    if (exerciseEditor || (didNotPerform && hasExerciseLog(exerciseLog))) {
      setSaveError(true)
      setAccountNotice(exerciseEditor ? "작성 중인 운동 내용을 반영하거나 지운 뒤 저장해 주세요." : "운동 내용이 남아 있어요. 운동 결과를 바꾸거나 운동 내용을 직접 정리해 주세요.")
      setTask("content")
      return
    }
    const memoPreparation = memo.prepareForSave()
    if (!memoPreparation.ready) { setTask("memo"); return }
    if (recordsPerformance && painCheckStatus === "SIGNAL_REPORTED"
      && !Object.values(painParts).some((level) => level > 0)) {
      setSaveError(true)
      setTask("body")
      return
    }
    const didPerform = isPerformedOutcome(activityOutcome)
    const planExecutionRelation = activityOutcome === undefined
      ? initial?.planExecutionRelation
      : derivePlanExecutionRelation(activityOutcome, activitySlot, planLink)
    const persistedSystem = didNotPerform ? "" : system
    const persistedDistanceKm = didNotPerform ? "" : distanceKm
    const persistedDurationMin = didNotPerform ? "" : durationMin
    const persistedAvgPace = didNotPerform ? "" : avgPace
    const persistedRpe = didNotPerform ? 0 : rpe
    const persistedObjectiveDataState = didNotPerform ? "NONE" as const : initial?.objectiveDataState
    let entry: JournalEntry = {
      id: entryId, kind: "post-session", date: entryDate,
      savedAt: nextJournalSavedAt(lastSavedAt.current), syncState: "local",
      captureDepth: "DETAILED",
      ...(activityOutcome === undefined ? {} : { activityOutcome }),
      ...(activityOutcome === "PARTIAL" && planLink && initial?.planExecutionChange
        ? { planExecutionChange: initial.planExecutionChange } : {}),
      ...(didPerform && activitySlot !== undefined ? { activitySlot } : {}),
      ...(recordsPerformance && persistedRpe === 0 && initial?.rpeBand !== undefined
        ? { rpeBand: initial.rpeBand }
        : {}),
      ...(persistedObjectiveDataState === undefined ? {} : { objectiveDataState: persistedObjectiveDataState }),
      ...(planExecutionRelation === undefined ? {} : { planExecutionRelation }),
      ...(!recordsPerformance || painCheckStatus === "UNANSWERED" ? {} : { painCheckStatus }),
      ...(recordsPerformance && painCheckStatus === "SIGNAL_REPORTED" ? { painParts } : {}),
      system: persistedSystem,
      title,
      distanceKm: persistedDistanceKm,
      durationMin: persistedDurationMin,
      avgPace: persistedAvgPace,
      rpe: persistedRpe,
      memo: memo.text,
      ...(hasExerciseLog(exerciseLog) ? { exerciseLog } : {}),
      ...(recordsPerformance && intensity.assessment !== undefined
        ? { intensityAssessment: intensity.assessment }
        : {}),
      ...(planLink === undefined ? {} : { plannedSessionLink: planLink }),
      ...(initial?.fileObservation === undefined ? {} : { fileObservation: initial.fileObservation }),
      ...(initial?.comparisonRelations === undefined ? {} : { comparisonRelations: initial.comparisonRelations }),
      fieldProvenance: {
        ...(activityOutcome === undefined ? {} : { activityOutcome: explicitOrMissing(true) }),
        ...(activityOutcome === "PARTIAL" && planLink && initial?.planExecutionChange
          ? { planExecutionChange: explicitOrMissing(true) } : {}),
        ...(didPerform && activitySlot !== undefined ? { activitySlot: explicitOrMissing(true) } : {}),
        plannedSessionLink: explicitOrMissing(planLink !== undefined),
        ...(planExecutionRelation === undefined ? {} : {
          planExecutionRelation: derivedProvenance(
            ["activityOutcome", "activitySlot", "plannedSessionLink"],
            "QUICK_PLAN_EXECUTION_RELATION_V2",
          ),
        }),
        ...(!recordsPerformance || painCheckStatus === "UNANSWERED" ? {} : { painCheckStatus: explicitOrMissing(true) }),
        ...(!recordsPerformance || painCheckStatus === "UNANSWERED" ? {} : { painParts: explicitOrMissing(Object.values(painParts).some((level) => level > 0)) }),
        ...(recordsPerformance && persistedRpe === 0 && initial?.rpeBand !== undefined
          ? { rpeBand: initial.fieldProvenance?.rpeBand ?? explicitOrMissing(true) }
          : {}),
        system: explicitOrMissing(persistedSystem !== ""),
        distanceKm: recordsPerformance && initial?.distanceKm === persistedDistanceKm && initial.fieldProvenance?.distanceKm !== undefined
          ? initial.fieldProvenance.distanceKm
          : explicitOrMissing(persistedDistanceKm.trim() !== ""),
        durationMin: recordsPerformance && initial?.durationMin === persistedDurationMin && initial.fieldProvenance?.durationMin !== undefined
          ? initial.fieldProvenance.durationMin
          : explicitOrMissing(persistedDurationMin.trim() !== ""),
        avgPace: recordsPerformance && initial?.avgPace === persistedAvgPace && initial.fieldProvenance?.avgPace !== undefined
          ? initial.fieldProvenance.avgPace
          : explicitOrMissing(persistedAvgPace.trim() !== ""),
        rpe: explicitOrMissing(persistedRpe > 0),
        ...(recordsPerformance ? { plannedRpe: explicitOrMissing(intensity.plannedRpe > 0) } : {}),
        ...(recordsPerformance ? { objectiveComponents: explicitOrMissing(intensity.objectiveComponents.length > 0) } : {}),
      },
      ...(memo.text.trim() !== "" && memo.purpose !== undefined ? { memoPurpose: memo.purpose } : {}),
    }
    const isPrivateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.memo.trim() !== ""
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
      if (window.location.search.includes("uitest")) console.log(`[JSAVE] kind=post-session ok=${result?.ok === true}`)
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
      const reviewMessage = memoPreparation.reviewMessage ?? (painLevelsRequireReview(saved.painParts ?? {}) ? "불편한 곳을 기록했어요. 몸 상태를 확인해 주세요." : undefined)
      if (storageMessage) onDone?.("post-session", saved, reviewMessage, storageMessage)
      else onDone?.("post-session", saved, reviewMessage)
    } catch {
      setSaveError(true)
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  return (
    <div style={{ paddingBottom: task === "review" ? 100 : 24 }} aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={goBackFlow}>훈련 후 · 기록</TopBar>
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      <div style={{ padding: "8px 20px 0" }}>
        <IndexCard date={compactDate(entryDate)} dow={`${dowOf(entryDate)} · ${nowClock()}`} />
      </div>
      {planLink !== undefined && (
        <div className="planned-session-link-note" role="status">
          <strong>계획의 DAY {planLink.sessionDay} {planLink.sessionSlot === "AM" ? "오전" : "오후"} 훈련</strong>
          <PlannedWorkoutContext entryId={entryId} date={entryDate} link={planLink} />
          <span>이 일지를 선택한 훈련과 연결해 저장해요. 실제로 한 내용은 아래에 직접 적어 주세요.</span>
        </div>
      )}

      <TaskFlowStep stepKey={task} title={taskTitle[task]} busy={saving}
        actions={task === "review" ? <StickyBar onSave={persist} error={saveError && !accountEnabled && !accountNotice}
          label={saving ? "저장 중" : isEditing ? "수정 저장" : undefined} /> : (
          <div className="task-flow__actions">
            {task === "outcome" && (returnsToReview
              ? <button type="button" className="quick-log__primary" onClick={reviewNow}>입력 확인으로</button>
              : <>
                <button type="button" className="quick-log__secondary" onClick={skipOutcome}>결과는 생략하고 계속</button>
                <button type="button" className="quick-log__primary" onClick={reviewNow}>지금 입력 확인</button>
              </>)}
            {task === "slot" && (returnsToReview
              ? <button type="button" className="quick-log__primary" onClick={reviewNow}>입력 확인으로</button>
              : <>
                <button type="button" className="quick-log__secondary" onClick={() => setTask("content")}>시간대는 기록하지 않고 계속</button>
                <button type="button" className="quick-log__primary" onClick={reviewNow}>지금 입력 확인</button>
              </>)}
            {task !== "outcome" && task !== "slot" && (returnsToReview
              ? <button type="button" className="quick-log__primary" onClick={nextTask}>입력 확인으로</button>
              : <>
                <button type="button" className="quick-log__primary" onClick={nextTask}>다음 질문</button>
                <button type="button" className="quick-log__secondary" onClick={reviewNow}>지금 입력 확인</button>
              </>)}
          </div>
        )}>

      {task === "review" && <div className="post-session-review" aria-label="저장 전 입력 확인">
        {emptyNotice && answeredReviewItems.length === 0 && <p role="alert">아직 입력한 내용이 없어요. 남길 항목 하나를 골라 주세요.</p>}
        <p>입력한 내용만 저장해요.</p>
        {memo.reviewMessage !== null && <p role="status" className="post-session-review__notice">
          {memo.reviewMessage} {accountEnabled ? "계정 저장 여부는 저장 결과에서 확인해 주세요." : "저장은 이 기기에만 됩니다."}
        </p>}
        {painLevelsRequireReview(painParts) && <PainReviewBanner />}
        {answeredReviewItems.length > 0 && <dl className="post-session-review__answers" style={{ display: "grid", gap: 8, margin: 0 }}>
          {answeredReviewItems.map((item) => (
            <div key={item.key} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line)", paddingBlock: 8 }}>
              <div style={{ minWidth: 0 }}>
                <dt style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.label}</dt>
                <dd style={{ margin: "2px 0 0", fontSize: 14, color: "var(--ink)", overflowWrap: "anywhere" }}>{item.value}</dd>
              </div>
              <button type="button" className="quick-log__secondary" aria-label={`${item.label} 수정`}
                onClick={() => editReviewItem(item.key)}>수정</button>
            </div>
          ))}
        </dl>}
        {addableReviewItems.length > 0 && <section className="post-session-review__additions" aria-labelledby="post-session-review-additions-title">
          <h3 id="post-session-review-additions-title">추가할 항목</h3>
          <div className="post-session-review__additions-grid" role="group" aria-label="추가할 항목">
            {addableReviewItems.map((item) => (
              <button key={item.key} type="button" className="quick-log__secondary post-session-review__add-item"
                aria-label={`${item.label} 수정`} onClick={() => editReviewItem(item.key)}>{item.label}</button>
            ))}
          </div>
        </section>}
      </div>}

      {task === "outcome" && <FormSec compact lb="운동 결과 · 선택">
        <div className="journal-progressive-edit app-choice-group" role="group" aria-label="운동 결과 수정">
          {DETAILED_OUTCOMES.map(([value, label]) => (
            <button className="app-choice-control app-choice-control--answer" key={value} type="button" aria-pressed={activityOutcome === value}
              disabled={importedObjective && isNonPerformedOutcome(value)} onClick={() => chooseOutcome(value)}>{label}</button>
          ))}
        </div>
        {importedObjective && <p role="note">가져온 활동 값이 있어 휴식·건너뜀으로 변경할 수 없는 기록이에요.</p>}
      </FormSec>}
      {task === "slot" && recordsPerformance && <FormSec compact lb="운동 시간대 · 선택">
        <div className="journal-progressive-edit app-choice-group" role="group" aria-label="운동 시간대 수정">
          {DETAILED_SLOTS.map(([value, label]) => (
            <button className="app-choice-control app-choice-control--answer" key={value} type="button" aria-pressed={activitySlot === value}
              onClick={() => chooseSlot(value)}>{label}</button>
          ))}
        </div>
      </FormSec>}

      {task === "content" && recordsPerformance && <FormSec compact lb="강도 시스템" help="energy-system">
        <div className="journal-energy-picker app-choice-group">
          {JOURNAL_ENERGY_SYSTEM_OPTIONS.map((energySystem) => (
            <button
              key={energySystem.key}
              type="button"
              className="journal-energy-picker__option app-choice-control"
              aria-label={`${energySystem.code} ${energySystem.shortLabel}`}
              aria-pressed={system === energySystem.journalValue}
              title={energySystem.shortLabel}
              onClick={() => setSystem(energySystem.journalValue)}
            >
              <span className={`energy-dot energy-dot--${energySystem.key.toLowerCase().replace("_", "-")}`} aria-hidden="true" />
              <span className="journal-energy-picker__label">
                <strong>{energySystem.pickerLabel}</strong>
                <small>{energySystem.code}</small>
              </span>
            </button>
          ))}
        </div>
      </FormSec>}

      {task === "content" && recordsPerformance && <FormSec compact lb="세션 제목">
        <div className="exercise-editor__entry">
          <input aria-label="세션 제목" type="text" value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle()} />
          <button type="button" aria-label="운동 내용 추가·수정" title="실제로 한 운동 추가·수정"
            aria-expanded={exerciseOpen} aria-controls={exercisePanelId} onClick={() => setExerciseOpen(open => !open)}>
            {exerciseOpen ? <ChevronUp size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            <span>{exerciseLog.components.length > 0 ? `운동 ${exerciseLog.components.length}개` : "운동 내용"}</span>
          </button>
        </div>
        <div id={exercisePanelId} hidden={!exerciseOpen}>
          <ExerciseLogEditor value={exerciseLog} onChange={setExerciseLog} draft={exerciseEditor} onDraftChange={setExerciseEditor} />
        </div>
      </FormSec>}
      {task === "content" && (recordsPerformance || exerciseLog.plannedRepetitions || exerciseLog.plannedSegments || Object.keys(plannedInputs.values).length > 0) && <PlannedRepetitionEditor entryId={entryId} date={entryDate} link={planLink} value={exerciseLog} onChange={setExerciseLog} inputs={plannedInputs} />}
      {task === "content" && plannedInputs.invalidKeys.length > 0 && <p>구간 기록 {plannedInputs.invalidKeys.length}곳의 숫자를 확인해 주세요. 확인 전에는 저장되지 않아요.</p>}
      {task === "measurements" && recordsPerformance && <FormSec compact lb="거리 · 시간 · 평균 페이스" help="pace">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <input aria-label="거리 (km)" readOnly={isImportedField("distanceKm", initial?.fieldProvenance)} type="text" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="시간 (분)" readOnly={isImportedField("durationMin", initial?.fieldProvenance)} type="text" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
          <input aria-label="평균 페이스 (/km)" readOnly={isImportedField("avgPace", initial?.fieldProvenance)} type="text" value={avgPace} onChange={(event) => setAvgPace(event.target.value)} style={{ ...inputStyle(), fontFamily: "var(--mono)", textAlign: "right" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
          <span>km</span><span>min</span><span>/km</span>
        </div>
        {importedObjective && <p role="note">파일에서 가져온 거리·시간·페이스는 읽기 전용이에요.</p>}
        {/* WORK_ORDER_UX2 §3-2 (D-06): 페이스 입력 형식 가이드 — 파서 철거가 아니라 안내 */}
        <p style={{ margin: "6px 0 0", fontFamily: "var(--sans)", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.5 }}>
          예: 5'30&quot; 또는 5:30 (분:초)
        </p>
      </FormSec>}

      {/*
        RPE 구획은 버튼 10개 + 눈금 글자로 175px 다. 답을 고른 뒤에는
        `7/10` 한 줄이면 충분하다. 접는 시점은 오너가 정했다 — 다음 구획을
        건드릴 때다 (shared.tsx FormSec 주석).
        summary 가 비면 FormSec 이 접기를 거부하므로, 아직 안 고른 상태에서는
        `미선택` 을 넣지 않고 undefined 를 준다. 판정 문구가 아니라 "값이 없다"
        는 뜻이고, 값이 없으면 접혀서는 안 된다.
      */}
      {task === "effort" && recordsPerformance && <FormSec
        compact
        lb="힘든 정도 · 1~10"
        help="rpe"
        collapsible
        summary={rpe > 0 ? `${rpe}/10` : undefined}
        collapseWhenLeft={touchOrder.leftBehind("rpe")}
        onTouch={() => touchOrder.touch("rpe")}
      >
        <div className="journal-ten-scale" style={{ display: "grid", gap: 0, border: "1px solid var(--ink)" }}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button key={value} aria-pressed={rpe === value} onClick={() => setRpe(value)} style={{
              minHeight: 44, padding: "12px 0", border: 0, cursor: "pointer",
              background: rpe === value ? "var(--ink)" : "transparent",
              color: rpe === value ? "var(--bg)" : "var(--ink)",
              fontFamily: "var(--mono)", fontSize: 12, fontWeight: 500,
              borderRight: value < 10 ? "1px solid var(--line)" : 0,
            }}>{value}</button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>매우 쉬움</span><span>최대</span>
        </div>
      </FormSec>}

      {task === "body" && recordsPerformance && <FormSec compact lb="운동 후 몸 상태">
        <div className="journal-progressive-edit" role="group" aria-label="운동 후 불편함 확인">
          <button type="button" aria-pressed={painCheckStatus === "NO_SIGNAL_REPORTED"} onClick={() => { setPainCheckStatus("NO_SIGNAL_REPORTED"); setPainParts({}) }}>불편한 곳 없음</button>
          <button type="button" aria-pressed={painCheckStatus === "SIGNAL_REPORTED"} onClick={() => setPainCheckStatus("SIGNAL_REPORTED")}>불편한 곳 있음</button>
        </div>
        {painCheckStatus === "SIGNAL_REPORTED" && (
          <>
            <BodyDiagram selected={painParts} onChange={setPainParts} />
            {painLevelsRequireReview(painParts) && <PainReviewBanner />}
          </>
        )}
      </FormSec>}

      {task === "effort" && recordsPerformance && <IntensityAssessmentField
        controller={intensity}
        editorDraft={objectiveEditor}
        onEditorDraftChange={setObjectiveEditor}
        reportedRpe={rpe}
        onSectionTouch={touchOrder.touch}
      />}

      {task === "memo" && <FormSec compact lb="메모 · 손글씨처럼" onTouch={() => touchOrder.touch("memo")}>
        <PurposeScopedMemoField
          controller={memo}
          fieldId="post-session-memo"
          label="훈련 메모 내용"
          placeholder="오늘 어땠는지 한 줄이라도..."
          rows={4}
        />
      </FormSec>}

      {saveError && (accountEnabled || accountNotice) && <p role="alert">{accountNotice ?? "계정 저장을 완료하지 못했어요. 입력은 그대로 남아 있어요. 연결과 로그인 상태를 확인한 뒤 다시 저장해 주세요."}</p>}
      </TaskFlowStep>
      </fieldset>
    </div>
  )
}
