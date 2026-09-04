import React from "react"
import { Check, ChevronRight, FilePenLine, RotateCcw } from "lucide-react"
import { compactDate, dowOf, isoToDate } from "../../domain/dates"
import { derivedProvenance, explicitOrMissing } from "../../domain/field-provenance"
import {
  newEntryId,
  nextJournalSavedAt,
  saveEntry,
  todayISO,
  updateEntry,
  type PostSessionEntry,
} from "../../domain/journal-store"
import type { PlannedSessionLink } from "../../domain/planned-session-link"
import { derivePlanExecutionRelation } from "../../domain/plan-execution-relation"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { useOrderedStepMotion } from "../../hooks/useOrderedStepMotion"
import { painLevelsRequireReview } from "../../safety/memo-safety"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { TopBar } from "./shared"

type QuickStep = "activity" | "effort" | "saved"
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
  { value: 5, detail: "호흡을 의식하며 꾸준히 이어가는 노력" },
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

export function QuickSessionForm({
  onBack,
  onDone,
  onContinueDetailed,
  targetDate,
  initialEntry,
  plannedSessionLink,
}: {
  readonly onBack?: () => void
  readonly onDone?: (entry: PostSessionEntry) => void
  readonly onContinueDetailed?: (entry: PostSessionEntry) => void
  readonly targetDate?: string
  readonly initialEntry?: PostSessionEntry
  readonly plannedSessionLink?: PlannedSessionLink
}) {
  const initial = initialEntry?.kind === "post-session" ? initialEntry : undefined
  const date = initial?.date ?? targetDate ?? todayISO()
  const planLink = initial?.plannedSessionLink ?? plannedSessionLink
  const outcomes = planLink === undefined ? GENERIC_OUTCOMES : PLANNED_OUTCOMES
  const [step, setStep] = React.useState<QuickStep>("activity")
  const [outcome, setOutcome] = React.useState<Outcome | null>(initial?.activityOutcome ?? null)
  const [slot, setSlot] = React.useState<Slot | null>(() => slotFromEntry(initial))
  const [rpe, setRpe] = React.useState(() => initial?.rpe ?? 0)
  const [effortAnswered, setEffortAnswered] = React.useState(() => (initial?.rpe ?? 0) > 0)
  const [painStatus, setPainStatus] = React.useState<PainStatus>(initial?.painCheckStatus ?? "UNANSWERED")
  const [painParts, setPainParts] = React.useState<Record<string, number>>(() => ({ ...(initial?.painParts ?? {}) }))
  const [savedEntry, setSavedEntry] = React.useState<PostSessionEntry | null>(initial ?? null)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [taps, setTaps] = React.useState(0)
  const entryId = React.useRef(initial?.id ?? newEntryId())
  const stageRef = React.useRef<HTMLDivElement>(null)
  const slotRef = React.useRef<HTMLDivElement>(null)
  const slotHeadingRef = React.useRef<HTMLSpanElement>(null)
  const safetyRef = React.useRef<HTMLDivElement>(null)
  const safetyHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const motion = useOrderedStepMotion(step, ["activity", "effort", "saved"])
  useActiveContentScroll(step, stageRef, undefined, true)
  useActiveContentScroll(performed(outcome) ? outcome : null, slotRef, slotHeadingRef, true)
  useActiveContentScroll(effortAnswered ? `rpe-${rpe}` : null, safetyRef, safetyHeadingRef, true)

  const persist = (next: {
    readonly outcome: Outcome
    readonly slot: Slot | null
    readonly rpe: number
    readonly effortAnswered: boolean
    readonly painStatus: PainStatus
    readonly painParts: Readonly<Record<string, number>>
    readonly answerTapCount: number
  }) => {
    const base = savedEntry ?? initial
    const didPerform = performed(next.outcome)
    const hasPain = Object.values(next.painParts).some((level) => level > 0)
    if (next.painStatus === "SIGNAL_REPORTED" && !hasPain) {
      setSaveError("불편한 곳을 하나 이상 골라 주세요.")
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
      plannedSessionLink: _previousPlanLink,
      painCheckStatus: _previousPainStatus,
      painParts: _previousPainParts,
      plannedRpe: _previousPlannedRpe,
      objectiveComponents: _previousObjectiveComponents,
      ...previousProvenance
    } = base?.fieldProvenance ?? {}
    const entry: PostSessionEntry = {
      id: entryId.current,
      kind: "post-session",
      date,
      savedAt: nextJournalSavedAt(base?.savedAt),
      syncState: "local",
      captureDepth: "QUICK",
      activityOutcome: next.outcome,
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
      memo: base?.memo ?? "",
      ...(base?.memoPurpose === undefined ? {} : { memoPurpose: base.memoPurpose }),
      ...(didPerform && base?.intensityAssessment !== undefined
        ? { intensityAssessment: base.intensityAssessment }
        : {}),
      ...(planLink === undefined ? {} : { plannedSessionLink: planLink }),
      fieldProvenance: {
        ...previousProvenance,
        activityOutcome: explicitOrMissing(true),
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
    const result = base === undefined ? saveEntry(entry) : updateEntry(entry, base.savedAt)
    if (window.location.search.includes("uitest")) {
      console.log(`[QUICKLOG] step=saved taps=${next.answerTapCount + 1} answers=${next.answerTapCount} screens=2 ok=${result.ok}`)
      console.log(`[JSAVE] kind=post-session ok=${result.ok}`)
    }
    if (!result.ok) {
      setSaveError("이 기기에 저장하지 못했어요. 저장 공간과 입력 내용을 확인해 주세요.")
      return
    }
    setOutcome(next.outcome)
    setSlot(next.slot)
    setRpe(next.rpe)
    setEffortAnswered(next.effortAnswered)
    setPainStatus(next.painStatus)
    setPainParts({ ...next.painParts })
    setSavedEntry(entry)
    setSaveError(null)
    setStep("saved")
  }

  const selectOutcome = (value: Outcome) => {
    const nextTapCount = taps + 1
    setTaps(nextTapCount)
    setOutcome(value)
    setSaveError(null)
    if (!performed(value)) {
      setSlot(null)
      setRpe(0)
      setEffortAnswered(false)
      setPainStatus("UNANSWERED")
      setPainParts({})
      persist({
        outcome: value,
        slot: null,
        rpe: 0,
        effortAnswered: false,
        painStatus: "UNANSWERED",
        painParts: {},
        answerTapCount: nextTapCount,
      })
      return
    }
    setStep("activity")
  }

  const selectSlot = (value: Slot) => {
    setTaps((current) => current + 1)
    setSlot(value)
    setStep("effort")
  }

  const selectRpe = (value: number) => {
    setTaps((current) => current + 1)
    setRpe(value)
    setEffortAnswered(true)
    setSaveError(null)
  }

  const selectNoPain = () => {
    if (outcome === null || slot === null || !effortAnswered) return
    const nextTapCount = taps + 1
    setTaps(nextTapCount)
    persist({
      outcome,
      slot,
      rpe,
      effortAnswered,
      painStatus: "NO_SIGNAL_REPORTED",
      painParts: {},
      answerTapCount: nextTapCount,
    })
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
    persist({
      outcome,
      slot,
      rpe,
      effortAnswered,
      painStatus: "SIGNAL_REPORTED",
      painParts,
      answerTapCount: nextTapCount,
    })
  }

  const outcomeLabel = outcomes.find((candidate) => candidate.value === outcome)?.ink
  const slotLabel = ACTIVITY_SLOTS.find((candidate) => candidate.value === slot)?.label
  const rpeDetail = RPE_OPTIONS.find((candidate) => candidate.value === rpe)?.detail

  return (
    <div className="quick-log">
      <TopBar onBack={onBack}>빠르게 기록</TopBar>
      <section className="quick-log__paper" aria-label="지금까지 기록한 내용">
        <div className="quick-log__date">{compactDate(date)} · {dowOf(date)}</div>
        {planLink !== undefined && <div className="quick-log__plan-source">계획 DAY {planLink.sessionDay} · {planLink.sessionSlot === "AM" ? "오전" : "오후"}</div>}
        <div className="quick-log__ink-stack" aria-live="polite">
          {outcomeLabel === undefined && <span className="quick-log__empty">누르면 여기에 기록돼요.</span>}
          {outcomeLabel !== undefined && <button type="button" onClick={() => setStep("activity")}><span>{savedDateLabel(date)}</span><strong>{outcomeLabel}</strong></button>}
          {slot !== null && <button type="button" onClick={() => setStep("activity")}><span>시간</span><strong>{slotLabel}</strong></button>}
          {effortAnswered && performed(outcome) && <button type="button" onClick={() => setStep("effort")}><span>몸의 느낌</span><strong>{rpe > 0 ? `RPE ${rpe}` : "미기록"}</strong></button>}
          {painStatus !== "UNANSWERED" && <button type="button" onClick={() => setStep("effort")}><span>몸 상태</span><strong>{painStatus === "SIGNAL_REPORTED" ? "불편한 곳 있음" : "불편한 곳 없음"}</strong></button>}
        </div>
        {step === "saved" && <div className="quick-log__stamp" aria-label="저장 완료"><Check aria-hidden="true" /> 저장됨</div>}
      </section>

      <div
        key={step}
        ref={stageRef}
        className="quick-log__stage active-stage-content active-content-scroll-target"
        data-flow-direction={motion}
      >
        {step === "activity" && (
          <section aria-labelledby="quick-activity-title">
            <small>1 / 2</small>
            <h1 id="quick-activity-title">{savedDateLabel(date)} 운동은 어떻게 됐나요?</h1>
            <div className="quick-log__choices">
              {outcomes.map((item) => <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => selectOutcome(item.value)}><span>{item.label}</span><ChevronRight aria-hidden="true" /></button>)}
            </div>
            {performed(outcome) && (
              <div ref={slotRef} className="quick-log__slot active-content-scroll-target" aria-labelledby="quick-slot-title">
                <span id="quick-slot-title" ref={slotHeadingRef} tabIndex={-1}>언제 했나요?</span>
                <div>
                  {ACTIVITY_SLOTS.map((item) => <button key={item.value} type="button" aria-pressed={slot === item.value} onClick={() => selectSlot(item.value)}>{item.label}</button>)}
                </div>
              </div>
            )}
            {saveError !== null && <p className="quick-log__error" role="alert">{saveError}</p>}
          </section>
        )}
        {step === "effort" && (
          <section aria-labelledby="quick-effort-title">
            <small>2 / 2</small>
            <h1 id="quick-effort-title">몸에는 어느 정도로 느껴졌나요?</h1>
            <p>가장 가까운 숫자를 한 번 눌러 주세요. 답하기 어렵다면 비워 둘 수 있어요.</p>
            <div className="quick-log__rpe-scale" role="group" aria-label="RPE 1부터 10까지">
              {RPE_OPTIONS.map((item) => <button key={item.value} type="button" aria-label={`RPE ${item.value}, ${item.detail}`} aria-pressed={effortAnswered && rpe === item.value} onClick={() => selectRpe(item.value)}>{item.value}</button>)}
            </div>
            <button className="quick-log__unknown" type="button" aria-pressed={effortAnswered && rpe === 0} onClick={() => selectRpe(0)}>모르겠어요 · RPE는 비워 둘게요</button>
            {effortAnswered && <p className="quick-log__rpe-detail" role="status">{rpeDetail ?? "RPE를 추정하지 않고 미기록으로 남겨요."}</p>}

            {effortAnswered && (
              <div ref={safetyRef} className="quick-log__safety active-content-scroll-target" aria-labelledby="quick-safety-title">
                <h2 id="quick-safety-title" ref={safetyHeadingRef} tabIndex={-1}>운동 후 불편하거나 아픈 곳이 있나요?</h2>
                <p>이 확인은 몸 상태를 남기기 위한 것이며 의료 판단이 아니에요.</p>
                <div className="quick-log__safety-actions">
                  <button type="button" aria-pressed={painStatus === "NO_SIGNAL_REPORTED"} onClick={selectNoPain}>없어요</button>
                  <button type="button" aria-pressed={painStatus === "SIGNAL_REPORTED"} onClick={selectPain}>있어요</button>
                </div>
                {painStatus === "SIGNAL_REPORTED" && (
                  <div className="quick-log__pain-details">
                    <BodyDiagram selected={painParts} onChange={setPainParts} />
                    {painLevelsRequireReview(painParts) && <PainReviewBanner />}
                    <button className="quick-log__primary" type="button" onClick={savePain}>이 상태로 기록</button>
                  </div>
                )}
              </div>
            )}
            {saveError !== null && <p className="quick-log__error" role="alert">{saveError}</p>}
          </section>
        )}
        {step === "saved" && savedEntry !== null && (
          <section className="quick-log__complete" aria-labelledby="quick-saved-title">
            <small>{savedDateLabel(savedEntry.date)} 기록</small>
            <h1 id="quick-saved-title">{savedReceiptLabel(savedEntry.date)}</h1>
            <p>{performed(savedEntry.activityOutcome ?? null)
              ? "거리와 시간은 워치 기록이 들어오면 확인한 뒤 같은 일지에 더할 수 있어요."
              : "쉬거나 건너뛴 내용도 선택한 날짜에 저장했어요."}</p>
            <button className="quick-log__primary" type="button" onClick={() => onDone?.(savedEntry)}>완료</button>
            <button className="quick-log__secondary" type="button" onClick={() => onContinueDetailed?.(savedEntry)}><FilePenLine aria-hidden="true" /><span>일지 더 쓰기</span></button>
            <button className="quick-log__secondary" type="button" onClick={() => { setTaps(0); setStep("activity") }}><RotateCcw aria-hidden="true" /><span>방금 기록 수정</span></button>
          </section>
        )}
      </div>
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
