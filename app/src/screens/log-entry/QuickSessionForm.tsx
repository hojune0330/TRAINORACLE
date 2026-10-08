import React from "react"
import { JournalWritingDecorationPreview } from "../journal/JournalDecorationPreview"
import { FormInputDraftBoundary, useFormInputDraft, useRecoveredFormInput } from "./useFormInputDraft"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import { accountJournalRecordsEnabled } from "../../domain/account/account-journal-record-service"
import { FormFinalizationRecovery, useFormFinalization } from "./useFormFinalization"
import { Check, ChevronRight, Clock3, FilePenLine, RotateCcw, TriangleAlert } from "lucide-react"
import { compactDate, dowOf, isoToDate } from "../../domain/dates"
import { derivedProvenance, explicitOrMissing } from "../../domain/field-provenance"
import {
  newEntryId,
  nextJournalSavedAt,
  saveEntry,
  todayISO,
  updateEntry,
  savePrivateEntry,
  updatePrivateEntry,
  loadEntries,
  type PostSessionEntry,
} from "../../domain/journal-store"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import { PLAN_EXECUTION_CHANGE_LABELS, type PlanExecutionChange } from "../../domain/journal-schema"
import { derivePlanExecutionRelation } from "../../domain/plan-execution-relation"
import { useOrderedStepMotion } from "../../hooks/useOrderedStepMotion"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { TopBar } from "./shared"
import { TaskFlowStep } from "../../components/TaskFlowStep"
import { PurposeScopedMemoField, usePurposeScopedMemo } from "./PurposeScopedMemoField"
import { ExerciseLogEditor, ExerciseLogSummary } from "./ExerciseLogEditor"
import { hasExerciseLog, type ExerciseLog } from "../../domain/exercise-log"
import { PlannedRepetitionEditor } from "./PlannedRepetitionEditor"
import { PlannedWorkoutContext } from "./PlannedWorkoutContext"
import { usePlannedNumberInputs } from "./planned-number-input"
import type { ExerciseEditorDraft, FormInput, QuickActiveQuestion } from "./form-input-draft"
import { JournalPlanProgressAction } from "./JournalPlanProgressAction"
import { journalProgressAction, reflectSavedJournalProgress } from "../../domain/journal-plan-progress"
import { loadVersionedPlanBetaState } from "../../domain/plan-beta-store"
import "./QuickSessionChanges.css"

type QuickStep = "activity" | "effort" | "review" | "exercise" | "memo" | "saved"
type Outcome = NonNullable<PostSessionEntry["activityOutcome"]>
type Slot = Exclude<NonNullable<PostSessionEntry["activitySlot"]>, "SINGLE">
type PainStatus = NonNullable<PostSessionEntry["painCheckStatus"]>

const GENERIC_OUTCOMES: readonly { readonly value: Outcome; readonly label: string; readonly ink: string }[] = [
  { value: "COMPLETED", label: "운동을 마쳤어요", ink: "운동 완료" },
  { value: "PARTIAL", label: "하던 운동을 일부만 했어요", ink: "일부 완료" },
  { value: "LIGHT_ACTIVITY", label: "가볍게 움직였어요", ink: "가벼운 운동" },
  { value: "RESTED", label: "오늘은 쉬었어요", ink: "휴식" },
  { value: "SKIPPED", label: "하려던 운동을 건너뛰었어요", ink: "건너뜀" },
]

const PLANNED_OUTCOMES: readonly { readonly value: Outcome; readonly label: string; readonly ink: string }[] = [
  { value: "COMPLETED", label: "계획대로 마쳤어요", ink: "계획대로 완료" },
  { value: "PARTIAL", label: "일부만 했거나 내용을 바꿨어요", ink: "계획 일부 변경" },
  { value: "LIGHT_ACTIVITY", label: "계획 대신 가볍게 움직였어요", ink: "가벼운 운동으로 변경" },
  { value: "RESTED", label: "계획 대신 쉬었어요", ink: "휴식으로 변경" },
  { value: "SKIPPED", label: "계획한 훈련을 건너뛰었어요", ink: "계획 건너뜀" },
]

const RPE_OPTIONS = [
  { value: 1, detail: "걷기·느린 자전거 같은 회복 움직임" },
  { value: 2, detail: "걷기보다 조금 빠른 아주 느린 조깅" },
  { value: 3, detail: "친구와 편하게 대화할 수 있는 기초 유산소" },
  { value: 4, detail: "땀이 나지만 전화 통화가 가능한 강도" },
  { value: 5, detail: "호흡이 빨라지지만 꾸준히 움직일 수 있는 노력" },
  { value: 6, detail: "짧은 문장으로만 말할 수 있는 강도" },
  { value: 7, detail: "몇 마디만 가능한 힘든 운동" },
  { value: 8, detail: "매우 힘들지만 정해진 반복을 수행하는 강도" },
  { value: 9, detail: "거의 최대에 가까운 강한 노력" },
  { value: 10, detail: "아주 짧게만 가능한 최대 노력에 가까운 느낌" },
] as const

const ACTIVITY_SLOTS: readonly { readonly value: Slot; readonly label: string }[] = [
  { value: "UNSPECIFIED", label: "시간 미지정" },
  { value: "AM", label: "오전" },
  { value: "PM", label: "오후" },
]

function performed(outcome: Outcome | null): boolean {
  return outcome === "COMPLETED" || outcome === "PARTIAL" || outcome === "LIGHT_ACTIVITY"
}

function slotFromEntry(entry: PostSessionEntry | undefined): Slot | null {
  if (entry?.activitySlot === "AM" || entry?.activitySlot === "PM") return entry.activitySlot
  if (entry?.activitySlot === "UNSPECIFIED" || entry?.activitySlot === "SINGLE") return "UNSPECIFIED"
  return null
}

type QuickFormInput = Extract<FormInput, { readonly kind: "quick" }>
type QuickPresentation = {
  readonly step: QuickStep
  readonly activityQuestion: "outcome" | "slot"
  readonly effortQuestion: "rpe" | "pain"
}

function restoreQuickPresentation(input: QuickFormInput | undefined): QuickPresentation {
  if (input === undefined) return { step: "activity", activityQuestion: "outcome", effortQuestion: "rpe" }
  if (input.step === "activity" && (input.activeQuestion === "outcome" || input.activeQuestion === "slot")) {
    return { step: input.step, activityQuestion: input.activeQuestion, effortQuestion: "rpe" }
  }
  if (input.step === "effort" && (input.activeQuestion === "rpe" || input.activeQuestion === "pain")) {
    return { step: input.step, activityQuestion: "outcome", effortQuestion: input.activeQuestion }
  }

  // Older drafts stored only the broad step, so resume at its earliest unanswered question.
  if (input.step === "activity") {
    if (input.outcome === null || !performed(input.outcome)) {
      return { step: input.step, activityQuestion: "outcome", effortQuestion: "rpe" }
    }
    if (input.slot === null) return { step: input.step, activityQuestion: "slot", effortQuestion: "rpe" }
    if (!input.effortAnswered) return { step: "effort", activityQuestion: "outcome", effortQuestion: "rpe" }
    if (input.painStatus === "UNANSWERED" || input.painStatus === "SIGNAL_REPORTED") {
      return { step: "effort", activityQuestion: "outcome", effortQuestion: "pain" }
    }
    return { step: input.step, activityQuestion: "outcome", effortQuestion: "rpe" }
  }
  if (input.step === "effort") {
    if (input.effortAnswered && (input.painStatus === "UNANSWERED" || input.painStatus === "SIGNAL_REPORTED")) {
      return { step: input.step, activityQuestion: "outcome", effortQuestion: "pain" }
    }
    return { step: input.step, activityQuestion: "outcome", effortQuestion: "rpe" }
  }
  return { step: input.step, activityQuestion: "outcome", effortQuestion: "rpe" }
}

export function QuickSessionForm(props: React.ComponentProps<typeof QuickSessionFormEditor>) {
  const date = props.initialEntry?.date ?? props.targetDate ?? todayISO()
  return <JournalWritingDecorationPreview date={date}><FormInputDraftBoundary kind="quick" date={date}
    hasInitialContext={props.initialEntry !== undefined || props.plannedSessionLink !== undefined}
    identity={JSON.stringify([props.initialEntry?.id, props.initialEntry?.savedAt, props.plannedSessionLink])}>
    <QuickSessionFormEditor {...props} />
  </FormInputDraftBoundary></JournalWritingDecorationPreview>
}

function QuickSessionFormEditor({
  onBack,
  onDone,
  onSaved,
  onContinueDetailed,
  targetDate,
  initialEntry,
  plannedSessionLink,
}: {
  readonly onBack?: () => void
  readonly onDone?: (entry: PostSessionEntry, reviewMessage?: string, storageMessage?: string) => void
  /** Confirmed persistence, independent of leaving the local completion screen. */
  readonly onSaved?: (entry: PostSessionEntry, reviewMessage?: string, storageMessage?: string) => void
  readonly onContinueDetailed?: (entry: PostSessionEntry) => void
  readonly targetDate?: string
  readonly initialEntry?: PostSessionEntry
  readonly plannedSessionLink?: PlannedSessionLink
}) {
  const recovered = useRecoveredFormInput("quick")
  const input = recovered?.input
  const presentation = restoreQuickPresentation(input)
  const initial = initialEntry?.kind === "post-session" ? initialEntry : undefined
  const date = initial?.date ?? targetDate ?? todayISO()
  const planLink = initial?.plannedSessionLink ?? plannedSessionLink
  const outcomes = planLink === undefined ? GENERIC_OUTCOMES : PLANNED_OUTCOMES
  const [step, setStep] = React.useState<QuickStep>(presentation.step)
  const [outcome, setOutcome] = React.useState<Outcome | null>(() => input ? input.outcome : initial?.activityOutcome ?? null)
  const [planExecutionChange, setPlanExecutionChange] = React.useState<PlanExecutionChange | null>(() => input
    ? input.planExecutionChange ?? null : initial?.planExecutionChange ?? null)
  const [slot, setSlot] = React.useState<Slot | null>(() => input ? input.slot : slotFromEntry(initial))
  const [rpe, setRpe] = React.useState(() => input?.rpe ?? initial?.rpe ?? 0)
  const [effortAnswered, setEffortAnswered] = React.useState(() => input?.effortAnswered ?? (initial?.rpe ?? 0) > 0)
  const [activityQuestion, setActivityQuestion] = React.useState<"outcome" | "slot">(presentation.activityQuestion)
  const [effortQuestion, setEffortQuestion] = React.useState<"rpe" | "pain">(presentation.effortQuestion)
  const [painStatus, setPainStatus] = React.useState<PainStatus>(input?.painStatus ?? initial?.painCheckStatus ?? "UNANSWERED")
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...(input?.painParts ?? initial?.painParts ?? {}) }))
  const [savedEntry, setSavedEntry] = React.useState<PostSessionEntry | null>(initial ?? null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const persistInFlight = React.useRef(false)
  const accountEnabled = accountJournalRecordsEnabled()
  const [savedStorage, setSavedStorage] = React.useState<"ACCOUNT" | "PENDING" | "CONFLICT" | null>(null)
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null)
  const inheritedMemo = usePurposeScopedMemo(input?.memo ?? initial?.memo ?? "", input?.purpose ?? initial?.memoPurpose)
  const [exerciseLog, setExerciseLog] = React.useState<ExerciseLog>(() => input?.exerciseLog ?? initial?.exerciseLog ?? { version: 1, source: "SELF_REPORTED", components: [] })
  const plannedInputs = usePlannedNumberInputs(input?.plannedInputs)
  const [exerciseEditor, setExerciseEditor] = React.useState<ExerciseEditorDraft | undefined>(input?.exerciseEditor)
  const [savedReviewMessage, setSavedReviewMessage] = React.useState<string | undefined>()
  const [savedStorageMessage, setSavedStorageMessage] = React.useState<string | undefined>()
  const [requestedProgress, setRequestedProgress] = React.useState<string | null>(null)
  const [progressResult, setProgressResult] = React.useState<{ ok: boolean; message: string } | null>(null)
  const currentPlan = loadVersionedPlanBetaState()
  const proposedProgress = currentPlan && outcome !== null ? journalProgressAction(currentPlan, {
    date, plannedSessionLink: planLink, activityOutcome: outcome,
    activitySlot: performed(outcome) ? slot ?? undefined : undefined,
    painCheckStatus: performed(outcome) ? painStatus : undefined,
    painParts: performed(outcome) ? painParts : undefined,
    fieldProvenance: {
      activityOutcome: explicitOrMissing(true), activitySlot: explicitOrMissing(slot !== null),
      painCheckStatus: explicitOrMissing(painStatus !== "UNANSWERED"),
    },
  }) : null
  const progressIdentity = proposedProgress === null ? null : JSON.stringify([planLink, proposedProgress, outcome, slot, painStatus, painParts])
  const includeProgress = progressIdentity !== null && requestedProgress === progressIdentity
  React.useEffect(() => { setRequestedProgress(null) }, [progressIdentity])
  const progressLabel = proposedProgress?.state === "PAIN_CHECKIN" ? "몸 상태 확인 필요"
    : proposedProgress?.state === "RESTED" ? "휴식" : proposedProgress?.state === "SKIPPED" ? "건너뜀" : "완료"
  const [taps, setTaps] = React.useState(0)
  const [entryId] = React.useState(() => recovered?.entryId ?? initial?.id ?? newEntryId())
  const lastSavedAt = React.useRef(recovered?.baseSavedAt ?? initial?.savedAt)
  const finalization = useFormFinalization(entryId, accountEnabled, lastSavedAt)
  const draftQuestion: QuickActiveQuestion | undefined = step === "activity" ? activityQuestion
    : step === "effort" ? effortQuestion : undefined
  const draft = useFormInputDraft({ kind: "quick", step: step === "saved" ? "activity" : step,
    outcome, slot, rpe, effortAnswered, painStatus, painParts, exerciseLog, exerciseEditor, plannedInputs: plannedInputs.values, planExecutionChange,
    ...(draftQuestion === undefined ? {} : { activeQuestion: draftQuestion }),
    memo: inheritedMemo.text, purpose: inheritedMemo.purpose ?? null }, entryId, step !== "saved", lastSavedAt.current)
  const activeQuestion = step === "activity" ? activityQuestion : step === "effort" ? effortQuestion : step
  // Optional editors are branches, not forward progress through required questions.
  const motion = useOrderedStepMotion(activeQuestion, ["outcome", "slot", "rpe", "pain", "review", "saved"])

  const persist = async (next: {
    readonly outcome: Outcome
    readonly slot: Slot | null
    readonly rpe: number
    readonly effortAnswered: boolean
    readonly painStatus: PainStatus
    readonly painParts: Readonly<Record<string, number>>
    readonly answerTapCount: number
  }) => {
    if (persistInFlight.current || !draft.current()) return
    if (plannedInputs.invalidKeys.length > 0) { setSaveError("구간 기록에 고칠 숫자가 있어요. 수정하거나 입력한 구간 기록을 지운 뒤 저장해 주세요."); setStep("review"); plannedInputs.revealFirstInvalid(); return }
    if (exerciseEditor) { setSaveError("작성하던 운동 내용을 반영하거나 지운 뒤 저장해 주세요."); setStep("exercise"); return }
    const base = savedEntry ?? initial
    const didPerform = performed(next.outcome)
    const hasPain = Object.values(next.painParts).some((level) => level > 0)
    if (next.painStatus === "SIGNAL_REPORTED" && !hasPain) {
      setSaveError("불편한 곳을 하나 이상 골라 주세요.")
      return
    }
    setPainStatus(next.painStatus)
    setPainParts({ ...next.painParts })
    if (!didPerform && hasExerciseLog(exerciseLog)) {
      setSaveError("운동 내용이 남아 있어요. 운동 결과를 바꾸거나 운동 내용을 직접 정리해 주세요.")
      return
    }
    const memoPreparation = inheritedMemo.prepareForSave()
    if (memoPreparation && !memoPreparation.ready) {
      setSaveError("글의 저장 방법을 확인해 주세요.")
      setStep("memo")
      return
    }

    const objectiveDataState = didPerform
      ? base?.objectiveDataState === "CONFIRMED" ? "CONFIRMED" : "WAITING"
      : "NONE"
    const relation = derivePlanExecutionRelation(next.outcome, next.slot ?? undefined, planLink)
    const {
      rpeBand: _legacyRpeBand,
      activitySlot: _previousSlot,
      planExecutionRelation: _previousRelation,
      planExecutionChange: _previousChange,
      plannedSessionLink: _previousPlanLink,
      painCheckStatus: _previousPainStatus,
      painParts: _previousPainParts,
      plannedRpe: _previousPlannedRpe,
      objectiveComponents: _previousObjectiveComponents,
      ...previousProvenance
    } = base?.fieldProvenance ?? {}
    let entry: PostSessionEntry = {
      id: entryId,
      kind: "post-session",
      date,
      savedAt: nextJournalSavedAt(lastSavedAt.current),
      syncState: "local",
      captureDepth: "QUICK",
      activityOutcome: next.outcome,
      ...(next.outcome === "PARTIAL" && planLink && planExecutionChange ? { planExecutionChange } : {}),
      ...(didPerform && next.slot !== null ? { activitySlot: next.slot } : {}),
      objectiveDataState,
      planExecutionRelation: relation,
      ...(didPerform ? { painCheckStatus: next.painStatus } : {}),
      ...(didPerform && next.painStatus === "SIGNAL_REPORTED" ? { painParts: next.painParts } : {}),
      system: didPerform ? base?.system ?? "" : "",
      title: outcomes.find((candidate) => candidate.value === next.outcome)?.ink ?? "오늘 기록",
      distanceKm: didPerform ? base?.distanceKm ?? "" : "",
      durationMin: didPerform ? base?.durationMin ?? "" : "",
      avgPace: didPerform ? base?.avgPace ?? "" : "",
      rpe: didPerform && next.effortAnswered ? next.rpe : 0,
      memo: inheritedMemo.text,
      ...(inheritedMemo.purpose === undefined ? {} : { memoPurpose: inheritedMemo.purpose }),
      ...(hasExerciseLog(exerciseLog) ? { exerciseLog } : {}),
      ...(didPerform && base?.intensityAssessment !== undefined
        ? { intensityAssessment: base.intensityAssessment }
        : {}),
      ...(planLink === undefined ? {} : { plannedSessionLink: planLink }),
      ...(base?.fileObservation === undefined ? {} : { fileObservation: base.fileObservation }),
      ...(base?.comparisonRelations === undefined ? {} : { comparisonRelations: base.comparisonRelations }),
      fieldProvenance: {
        ...previousProvenance,
        activityOutcome: explicitOrMissing(true),
        ...(next.outcome === "PARTIAL" && planLink && planExecutionChange ? { planExecutionChange: explicitOrMissing(true) } : {}),
        ...(didPerform ? { activitySlot: explicitOrMissing(next.slot !== null) } : {}),
        plannedSessionLink: explicitOrMissing(planLink !== undefined),
        planExecutionRelation: derivedProvenance(
          ["activityOutcome", "activitySlot", "plannedSessionLink"],
          "QUICK_PLAN_EXECUTION_RELATION_V2",
        ),
        ...(didPerform ? { painCheckStatus: explicitOrMissing(next.painStatus !== "UNANSWERED") } : {}),
        ...(didPerform ? { painParts: explicitOrMissing(hasPain) } : {}),
        system: didPerform ? base?.fieldProvenance?.system ?? explicitOrMissing(false) : explicitOrMissing(false),
        distanceKm: didPerform ? base?.fieldProvenance?.distanceKm ?? explicitOrMissing(false) : explicitOrMissing(false),
        durationMin: didPerform ? base?.fieldProvenance?.durationMin ?? explicitOrMissing(false) : explicitOrMissing(false),
        avgPace: didPerform ? base?.fieldProvenance?.avgPace ?? explicitOrMissing(false) : explicitOrMissing(false),
        rpe: explicitOrMissing(didPerform && next.effortAnswered && next.rpe > 0),
        ...(didPerform && _previousPlannedRpe !== undefined ? { plannedRpe: _previousPlannedRpe } : {}),
        ...(didPerform && _previousObjectiveComponents !== undefined
          ? { objectiveComponents: _previousObjectiveComponents }
          : {}),
      },
    }
    persistInFlight.current = true
    const applyProgressAfterSave = includeProgress
    setSaving(true)
    setSaveError(null)
    try {
      const accountResult = accountEnabled ? await finalization.save(entry, lastSavedAt.current) : null
      if (accountResult?.ok) entry = accountResult.entry
      const privateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.memo.trim() !== ""
      const result = accountEnabled ? accountResult : (base === undefined
        ? privateMemo ? await savePrivateEntry(entry) : saveEntry(entry)
        : privateMemo ? await updatePrivateEntry(entry, base.savedAt) : updateEntry(entry, base.savedAt))
      if (window.location.search.includes("uitest")) {
        console.log(`[QUICKLOG] step=saved answerActions=${next.answerTapCount} explicitConfirmation=true ok=${result?.ok === true}`)
        console.log(`[JSAVE] kind=post-session ok=${result?.ok === true}`)
      }
      if (!result?.ok) {
        setSaveError(accountEnabled ? accountResult?.notice ?? "계정 저장을 완료하지 못했어요. 입력은 유지했어요. 연결과 로그인 상태를 확인한 뒤 다시 시도해 주세요." : "이 기기에 저장하지 못했어요. 저장 공간과 입력 내용을 확인해 주세요.")
        return
      }
      if (!draft.current()) return
      if (accountResult?.ok && accountResult.storage !== "ACCOUNT") {
        setSaveError([memoPreparation?.reviewMessage, accountResult.storage === "CONFLICT"
          ? "수정 충돌을 확인해 주세요. 기기에는 보관했지만 기록 완료는 아직이에요."
          : "계정 전송 대기 중이에요. 기기에는 보관했지만 기록 완료는 아직이에요."].filter(Boolean).join(" "))
        return
      }
      if (accountEnabled) await draft.complete()
      else void draft.complete()
      if (!draft.current()) return
      lastSavedAt.current = entry.savedAt
      setOutcome(next.outcome)
      setSlot(next.slot)
      setRpe(next.rpe)
      setEffortAnswered(next.effortAnswered)
      setPainStatus(next.painStatus)
      setPainParts({ ...next.painParts })
      setSavedEntry(accountResult?.ok ? { ...entry, syncState: accountResult.storage === "ACCOUNT" ? "synced" : "local" } : entry)
      const storage = accountResult?.ok ? accountResult.storage : null
      setSavedStorage(storage)
      const isPrivateMemo = entry.memoPurpose === "PRIVATE_SELF_ONLY" && entry.memo.trim() !== ""
      const storageMessage = storage === null ? null : storage === "ACCOUNT"
        ? isPrivateMemo ? "비밀 일지를 계정에 저장했어요. 공유·분석에는 사용하지 않아요." : "일지를 계정에 저장했어요."
        : storage === "CONFLICT"
          ? "수정 충돌을 확인해 주세요. 이 기기의 내용은 보관했지만 계정 저장은 완료되지 않았어요."
          : isPrivateMemo ? "비밀 일지를 이 기기에 보관했어요. 계정 전송 대기 중이며 공유·분석에는 사용하지 않아요."
            : "일지를 이 기기에 보관했어요. 계정 전송 대기 중이에요."
      setSavedMessage([memoPreparation?.reviewMessage, storageMessage].filter(Boolean).join(" ") || null)
      setSavedStorageMessage(storageMessage ?? undefined)
      const reviewMessage = memoPreparation.reviewMessage ?? (painLevelsRequireReview(entry.painParts ?? {}) ? "불편한 곳을 기록했어요. 몸 상태를 확인해 주세요." : undefined)
      setSavedReviewMessage(reviewMessage)
      setProgressResult(null)
      if (applyProgressAfterSave) {
        // A confirmed journal stays saved even if the separate plan write fails.
        let reflected: { ok: boolean; message: string }
        try { reflected = await reflectSavedJournalProgress(entry) }
        catch { reflected = { ok: false, message: "일지는 저장했어요. 계획 표시는 반영하지 못했어요. 다시 시도해 주세요." } }
        if (!draft.current()) return
        setProgressResult(reflected)
      }
      setSaveError(null)
      onSaved?.(entry, reviewMessage, storageMessage ?? undefined)
      setStep("saved")
    } catch {
      setSaveError("저장을 완료하지 못했어요. 입력은 그대로 남아 있어요. 다시 시도해 주세요.")
    } finally {
      persistInFlight.current = false
      setSaving(false)
    }
  }

  const selectOutcome = (value: Outcome) => {
    const nextTapCount = taps + 1
    setTaps(nextTapCount)
    setOutcome(value)
    if (value !== "PARTIAL") setPlanExecutionChange(null)
    setSaveError(null)
    if (!performed(value)) {
      setStep("review")
      return
    }
    setActivityQuestion("slot")
    setStep("activity")
  }

  const selectSlot = (value: Slot) => {
    setTaps((current) => current + 1)
    setSlot(value)
    setEffortQuestion("rpe")
    setStep("effort")
  }

  const selectRpe = (value: number) => {
    setTaps((current) => current + 1)
    setRpe(value)
    setEffortAnswered(true)
    setEffortQuestion("pain")
    setSaveError(null)
  }

  const selectNoPain = () => {
    if (outcome === null || slot === null || !effortAnswered) return
    const nextTapCount = taps + 1
    setTaps(nextTapCount)
    setPainStatus("NO_SIGNAL_REPORTED")
    setPainParts({})
    setStep("review")
  }

  const selectPain = () => {
    setTaps((current) => current + 1)
    setPainStatus("SIGNAL_REPORTED")
    setSaveError(null)
  }

  const savePain = () => {
    if (outcome === null || slot === null || !effortAnswered) return
    const nextTapCount = taps + 1
    setTaps(nextTapCount)
    if (!Object.values(painParts).some(level => level > 0)) { setSaveError("불편한 곳을 하나 이상 골라 주세요."); return }
    setStep("review")
  }

  const outcomeLabel = outcomes.find((candidate) => candidate.value === outcome)?.ink
  const slotLabel = ACTIVITY_SLOTS.find((candidate) => candidate.value === slot)?.label
  const returnToRecord = () => setStep(outcome === null ? "activity" : "review")
  const editOutcome = () => { setActivityQuestion("outcome"); setStep("activity") }
  const editSlot = () => { setActivityQuestion("slot"); setStep("activity") }
  const editEffort = () => { setEffortQuestion("rpe"); setStep("effort") }
  const editPain = () => { setEffortQuestion("pain"); setStep("effort") }
  const goBack = () => {
    setSaveError(null)
    if (step === "saved" || (step === "activity" && activityQuestion === "outcome")) { draft.back(onBack)?.(); return }
    if (step === "memo" || step === "exercise") { returnToRecord(); return }
    if (step === "activity") { editOutcome(); return }
    if (step === "effort") { if (effortQuestion === "pain") editEffort(); else editSlot(); return }
    if (performed(outcome)) editPain()
    else editOutcome()
  }
  const firstQuestion = step === "activity" && activityQuestion === "outcome"
  useTaskFlowBack({ enabled: !firstQuestion && step !== "saved", busy: saving, onBack: goBack })

  const saveReview = () => {
    if (outcome === null) return
    if (performed(outcome) && (!effortAnswered || slot === null || painStatus === "UNANSWERED")) {
      if (slot === null) editSlot()
      else if (!effortAnswered) editEffort()
      else editPain()
      return
    }
    void persist({ outcome, slot: performed(outcome) ? slot : null, rpe: performed(outcome) ? rpe : 0,
      effortAnswered: performed(outcome) && effortAnswered, painStatus: performed(outcome) ? painStatus : "UNANSWERED",
      painParts: performed(outcome) ? painParts : {}, answerTapCount: taps + 1 })
  }

  const recordSummary = (
      <section className={`quick-log__paper${step !== "saved" ? " quick-log__paper--review" : ""}`} aria-label="현재까지 답한 내용">
        <div className="quick-log__date">{compactDate(date)} · {dowOf(date)}</div>
        {step === "saved" && planLink !== undefined && <div className="quick-log__plan-source">계획 {planLink.sessionDay}일차 · {planLink.sessionSlot === "AM" ? "오전" : "오후"}</div>}
        <div className="quick-log__ink-stack" aria-live="polite">
          {outcomeLabel === undefined && <span className="quick-log__empty">누르면 여기에 기록돼요.</span>}
          {outcomeLabel !== undefined && <button type="button" aria-label={`${savedDateLabel(date)} ${outcomeLabel}`} onClick={editOutcome}><span>{savedDateLabel(date)}</span><strong>{outcomeLabel}</strong></button>}
          {slot !== null && performed(outcome) && <button type="button" aria-label={`시간 ${slotLabel}`} onClick={editSlot}><span>시간</span><strong>{slotLabel}</strong></button>}
          {effortAnswered && performed(outcome) && <button type="button" aria-label={`힘든 정도 ${rpe > 0 ? `${rpe}/10` : "입력 안 함"}`} onClick={editEffort}><span>힘든 정도</span><strong>{rpe > 0 ? `${rpe}/10` : "입력 안 함"}</strong></button>}
          {painStatus !== "UNANSWERED" && performed(outcome) && <button type="button" aria-label={`몸 상태 ${painStatus === "SIGNAL_REPORTED" ? "불편한 곳 있음" : "불편한 곳 없음"}`} onClick={editPain}><span>몸 상태</span><strong>{painStatus === "SIGNAL_REPORTED" ? "불편한 곳 있음" : "불편한 곳 없음"}</strong></button>}
        </div>
        {step === "saved" && <div className="quick-log__stamp" aria-label={savedStorage === "PENDING" ? "계정 전송 대기" : savedStorage === "CONFLICT" ? "수정 충돌" : "저장 완료"}>
          {savedStorage === "PENDING" ? <Clock3 aria-hidden="true" /> : savedStorage === "CONFLICT" ? <TriangleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
          {savedStorage === "ACCOUNT" ? "계정에 저장됨" : savedStorage === "PENDING" ? "기기 보관 · 전송 대기" : savedStorage === "CONFLICT" ? "기기 보관 · 수정 충돌" : "저장됨"}
        </div>}
      </section>
  )

  const taskTitle = step === "activity"
    ? activityQuestion === "outcome" ? `${savedDateLabel(date)} 운동은 어떻게 됐나요?` : "언제 했나요?"
    : step === "effort"
      ? effortQuestion === "rpe" ? "몸에는 어느 정도로 느껴졌나요?" : "운동 후 불편하거나 아픈 곳이 있나요?"
      : step === "review" ? "이 내용으로 남길까요?"
        : step === "exercise" ? "실제로 한 운동"
          : step === "memo" ? "오늘 남길 말"
            : savedEntry ? savedReceiptLabel(savedEntry.date) : "기록을 남겼어요."

  const taskFlowActions = step === "review" && outcome !== null ? (
    <button type="button" className="quick-log__primary" onClick={saveReview}>
      {inheritedMemo.text.trim() !== "" && inheritedMemo.needsPrivateSetup ? "비밀 메모 보관 준비" : includeProgress ? `저장하고 계획에 ${progressLabel} 표시` : "이대로 저장"}
    </button>
  ) : step === "effort" && effortQuestion === "pain" && painStatus === "SIGNAL_REPORTED" ? (
    <button className="quick-log__primary" type="button" onClick={savePain}>이 상태로 기록</button>
  ) : step === "exercise" ? (
    <button type="button" className="quick-log__primary" onClick={() => { setSaveError(null); returnToRecord() }}>
      {outcome === null ? "운동 결과 선택으로" : "기록 요약으로"}
    </button>
  ) : step === "memo" ? (
    <button type="button" className="quick-log__primary" onClick={() => { setSaveError(null); returnToRecord() }}>내용 반영</button>
  ) : step === "saved" && savedEntry !== null ? (
    <button className="quick-log__primary" type="button" onClick={() => savedStorageMessage !== undefined
      ? onDone?.(savedEntry, savedReviewMessage, savedStorageMessage)
      : savedReviewMessage !== undefined ? onDone?.(savedEntry, savedReviewMessage) : onDone?.(savedEntry)}>완료</button>
  ) : undefined

  return (
    <div className="quick-log" aria-busy={saving}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <TopBar onBack={goBack}>빠르게 기록</TopBar>
      <FormFinalizationRecovery recovery={finalization} onBack={draft.back(onBack)} />
      {saving && <p role="status">저장 중이에요.</p>}
      <TaskFlowStep stepKey={activeQuestion} title={taskTitle} summary={outcomeLabel === undefined ? undefined : recordSummary}
        summaryFirst={step === "review" || step === "saved"} actions={taskFlowActions} busy={saving} motion={motion}>
      <div className="quick-log__stage">
        <div data-task-motion-surface>
        {(step === "exercise" || step === "memo") && <div className="quick-log__safety-actions" role="group" aria-label="추가 기록 종류">
          <button type="button" aria-pressed={step === "exercise"} onClick={() => setStep("exercise")}>운동 내용</button>
          <button type="button" aria-pressed={step === "memo"} onClick={() => setStep("memo")}>글 쓰기</button>
        </div>}
        {step === "activity" && activityQuestion === "outcome" && (
          <section>
            <small>운동 결과</small>
            {planLink !== undefined && <div className="quick-log__plan-source">계획 {planLink.sessionDay}일차 · {planLink.sessionSlot === "AM" ? "오전" : "오후"}</div>}
            {planLink && <PlannedWorkoutContext entryId={entryId} date={date} link={planLink} />}
            <div className="quick-log__choices">
              {outcomes.map((item) => <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => selectOutcome(item.value)}><span>{item.label}</span><ChevronRight aria-hidden="true" /></button>)}
            </div>
            <InfoDisclosure purpose="actions" title="메모·운동 내용 먼저 쓰기">
              <div className="quick-log__choices">
                <button type="button" onClick={() => setStep("memo")}>메모 먼저 쓰기<FilePenLine aria-hidden="true" /></button>
                <button type="button" onClick={() => setStep("exercise")}>달리기·근력 등 운동 추가<ChevronRight aria-hidden="true" /></button>
              </div>
            </InfoDisclosure>
            {saveError !== null && <p className="quick-log__error" role="alert">{saveError}</p>}
          </section>
        )}
        {step === "activity" && activityQuestion === "slot" && <section>
          <small>운동 시간대</small>
          {planLink && <p>계획은 {planLink.sessionSlot === "AM" ? "오전" : "오후"}이에요. 실제로 한 시간대를 골라 주세요.</p>}
          <div className="quick-log__choices">
            {[...ACTIVITY_SLOTS].sort((a, b) => Number(b.value === planLink?.sessionSlot) - Number(a.value === planLink?.sessionSlot)).map(item => <button key={item.value} type="button" aria-pressed={slot === item.value} onClick={() => selectSlot(item.value)}>{item.label}<ChevronRight aria-hidden="true" /></button>)}
          </div>
        </section>}
        {step === "effort" && effortQuestion === "rpe" && (
          <section>
            <small>힘든 정도</small>
            <p>1 아주 가벼움 · 10 최대 노력</p>
            <div className="quick-log__rpe-scale" role="group" aria-label="힘든 정도 1부터 10까지">
              {RPE_OPTIONS.map((item) => <button key={item.value} type="button" aria-label={`힘든 정도 ${item.value}/10, ${item.detail}`} aria-pressed={effortAnswered && rpe === item.value} onClick={() => selectRpe(item.value)}>{item.value}</button>)}
            </div>
            <button className="quick-log__unknown" type="button" aria-pressed={effortAnswered && rpe === 0} onClick={() => selectRpe(0)}>모르겠어요 · 비워 둘게요</button>
            <InfoDisclosure title="숫자별 느낌"><dl className="quick-log__rpe-guide">{RPE_OPTIONS.map(item => <div key={item.value}><dt>{item.value}</dt><dd>{item.detail}</dd></div>)}</dl></InfoDisclosure>
          </section>
        )}
        {step === "effort" && effortQuestion === "pain" && (
              <section>
                <small>몸 상태</small>
                <p>이 확인은 몸 상태를 남기기 위한 것이며 의료 판단이 아니에요.</p>
                <div className="quick-log__safety-actions">
                  <button type="button" aria-pressed={painStatus === "NO_SIGNAL_REPORTED"} onClick={selectNoPain}>없어요</button>
                  <button type="button" aria-pressed={painStatus === "SIGNAL_REPORTED"} onClick={selectPain}>있어요</button>
                </div>
                {painStatus === "SIGNAL_REPORTED" && (
                  <div className="quick-log__pain-details">
                    <BodyDiagram selected={painParts} onChange={setPainParts} />
                    {painLevelsRequireReview(painParts) && <PainReviewBanner />}
                  </div>
                )}
            {saveError !== null && <p className="quick-log__error" role="alert">{saveError}</p>}
              </section>
        )}
        {step === "review" && outcome !== null && <section>
          <small>마지막 확인</small>
          {!performed(outcome) && performed(savedEntry?.activityOutcome ?? null) && <p>쉬거나 건너뛴 기록으로 바꾸면 운동 시간·거리·힘든 정도·몸 상태 응답은 제외돼요.</p>}
            <ExerciseLogSummary log={exerciseLog} />
            {(performed(outcome) || exerciseLog.plannedRepetitions || exerciseLog.plannedSegments || Object.keys(plannedInputs.values).length > 0) && <PlannedRepetitionEditor entryId={entryId} date={date} link={planLink} value={exerciseLog} onChange={setExerciseLog} inputs={plannedInputs} />}
          {plannedInputs.invalidKeys.length > 0 && <p className="quick-log__error">구간 기록 {plannedInputs.invalidKeys.length}곳의 숫자를 확인해 주세요. 확인 전에는 저장되지 않아요.</p>}
          {inheritedMemo.text.trim() !== "" && <p>{inheritedMemo.needsPrivateSetup
            ? "글은 아직 저장 전이에요. 비밀 메모 보관을 먼저 준비해요."
            : "저장 버튼을 누르면 글도 함께 저장돼요."}</p>}
          {performed(outcome) && painLevelsRequireReview(painParts) && <PainReviewBanner />}
          <div className="quick-log__choices">
            {(performed(outcome) || exerciseLog.components.length > 0) && <button type="button" onClick={() => setStep("exercise")}>운동 추가·수정<ChevronRight aria-hidden="true" /></button>}
            <button type="button" onClick={() => setStep("memo")}>{inheritedMemo.text ? "글 수정" : "글 추가"}<FilePenLine aria-hidden="true" /></button>
          </div>
          {outcome === "PARTIAL" && planLink && <fieldset>
            <legend>무엇이 달랐나요? · 선택</legend>
            <div className="quick-log__choices quick-log__change-choices">
              {(Object.entries(PLAN_EXECUTION_CHANGE_LABELS) as [PlanExecutionChange, string][]).map(([value, label]) =>
                <button key={value} type="button" aria-pressed={planExecutionChange === value}
                  onClick={() => setPlanExecutionChange(current => current === value ? null : value)}>{label}</button>)}
              <button type="button" aria-pressed={planExecutionChange === null} onClick={() => setPlanExecutionChange(null)}>간단히만 남길게요</button>
            </div>
          </fieldset>}
          {exerciseEditor && <p role="status">작성 중인 운동이 있어요. 반영 여부를 확인해 주세요.</p>}
          {proposedProgress !== null && <label className="quick-log__plan-confirm">
            <input type="checkbox" checked={includeProgress} onChange={event => setRequestedProgress(event.target.checked ? progressIdentity : null)} />
            계획에도 {progressLabel} 표시 남기기
          </label>}
          {saveError && <p role="alert">{saveError}</p>}
        </section>}
        {step === "exercise" && <section>
          <ExerciseLogEditor value={exerciseLog} onChange={setExerciseLog} draft={exerciseEditor} onDraftChange={setExerciseEditor}
            recent={loadEntries().filter(entry => entry.id !== entryId).flatMap(entry => entry.kind === "post-session" ? entry.exerciseLog?.components ?? [] : []).slice(0, 6)} />
          {saveError && <p role="alert">{saveError}</p>}
        </section>}
        {step === "memo" && <section>
          <PurposeScopedMemoField controller={inheritedMemo} fieldId="quick-memo" label="일지 내용" rows={4} />
        </section>}
        {step === "saved" && savedEntry !== null && (
          <section className="quick-log__complete">
            <small>{savedDateLabel(savedEntry.date)} 기록</small>
            {savedMessage !== null && <p role="status">{savedMessage}</p>}
            {painLevelsRequireReview(savedEntry.painParts ?? {}) && <PainReviewBanner />}
            <ExerciseLogSummary log={savedEntry.exerciseLog} />
            {savedEntry.planExecutionChange && <p>{PLAN_EXECUTION_CHANGE_LABELS[savedEntry.planExecutionChange]}</p>}
            {progressResult !== null && <JournalPlanProgressAction entry={savedEntry} initialResult={progressResult} />}
            <InfoDisclosure title="내용 추가·수정" purpose="actions">
              {progressResult === null && <JournalPlanProgressAction entry={savedEntry} />}
              <button className="quick-log__secondary" type="button" onClick={() => onContinueDetailed?.(savedEntry)}><FilePenLine aria-hidden="true" /><span>일지 더 쓰기</span></button>
              <button className="quick-log__secondary" type="button" onClick={() => { setTaps(0); editOutcome() }}><RotateCcw aria-hidden="true" /><span>방금 기록 수정</span></button>
            </InfoDisclosure>
          </section>
        )}
        </div>
      </div>
      </TaskFlowStep>
      </fieldset>
    </div>
  )
}

function savedDateLabel(date: string): string {
  if (date === todayISO()) return "오늘"
  const localDate = isoToDate(date)
  return `${localDate.getMonth() + 1}월 ${localDate.getDate()}일`
}

function savedReceiptLabel(date: string): string {
  return `${savedDateLabel(date)} 기록을 남겼어요.`
}
