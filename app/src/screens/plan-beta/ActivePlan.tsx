import React from "react"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  HeartPulse,
  Info,
  RefreshCw,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { PlanProgressState } from "@impl/plan-generator/types"
import type { PlanSession } from "@impl/plan-generator/types"
import type {
  PlanBetaState,
  StoredPlanProgress,
} from "../../domain/plan-beta-store"
import { readArchivedOriginalPlans } from "../../domain/plan-beta-store"
import { TermHelp } from "../../components/TermHelp"
import {
  candidateLabel,
  ENERGY_INTENT_LABELS,
  PROGRESS_LABELS,
  sessionSlotLabel,
} from "./labels"
import { PlanRpeGuide, PlanSchedulePreview, type PlanReaderRequest } from "./PlanSchedulePreview"
import { DIVISION_LABELS } from "./plan-intake-meta"
import { eventDistanceLabel } from "./plan-intake-navigation"
import type { PlanCurrentCheck } from "../../domain/plan-beta-flow"
import type { StoredPaceTargetPrescription } from "../../domain/plan-session-schema"
import { PlanAdaptationFlow } from "./PlanAdaptationFlow"
import { loadEntries, loadEntriesForPlanSafety, type PostSessionEntry } from "../../domain/journal-store"
import { collectSessionExplanationEvidence } from "../../domain/session-explanation-evidence"
import { isValidIsoDate, isoShift, isoToDate } from "../../domain/dates"
import { isPlanFrameCompletionEligible } from "../../domain/plan-successor-activation"
import { PERIODIZATION_PHASE_LABELS } from "../../domain/periodization-lineage"
import type { PlanCloudPersistenceState } from "../../domain/account/plan-cloud-backup"
import type { PlannedSessionLogDraft } from "../../domain/planned-session-link"
import { resolveCurrentPlannedSession, samePlannedSessionLink } from "../../domain/planned-session-link"
import { InstantPlanTodayView } from "../../components/instant-plan/InstantPlanTodayView"
import { instantSessionId } from "./instant-plan-today"
import { projectCurrentInstantToday } from "./instant-plan-today-context"
import { useLocalToday } from "../../hooks/useLocalToday"
import { SessionExplanationEntry } from "./SessionExplanation"
import { useCalendarEntries } from "../../hooks/useCalendarEntries"

const PROGRESS_ACTIONS: readonly {
  readonly state: PlanProgressState
  readonly icon: LucideIcon
}[] = [
  { state: "COMPLETED", icon: Check },
  { state: "RESTED", icon: CircleMinus },
  { state: "SKIPPED", icon: RefreshCw },
  { state: "PAIN_CHECKIN", icon: HeartPulse },
]

export function ActivePlan({
  state,
  cloudPersistence = "DEVICE_ONLY",
  onRetryCloudBackup,
  onProgress,
  onNextFrame,
  onActivateNextFrame,
  onCheckDetailedExecution,
  showCreatedCelebration = false,
  onWriteSessionLog,
  returnToSession,
  executionMessage,
  executionBlocked = false,
  futureTrainingEditor,
}: {
  readonly state: PlanBetaState
  readonly cloudPersistence?: PlanCloudPersistenceState
  readonly onRetryCloudBackup?: () => void
  readonly onProgress: (progress: StoredPlanProgress) => void
  readonly onNextFrame: () => void
  readonly onActivateNextFrame: (currentCheck: PlanCurrentCheck) => void
  readonly onCheckDetailedExecution: (
    prescription: StoredPaceTargetPrescription,
    operation: "START" | "RESTART",
    currentCheck: PlanCurrentCheck,
  ) => void
  readonly showCreatedCelebration?: boolean
  readonly onWriteSessionLog?: (session: PlanSession) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
  readonly executionMessage?: string | null
  readonly executionBlocked?: boolean
  readonly futureTrainingEditor?: React.ReactNode
}) {
  const [hasPendingSuccessor, setHasPendingSuccessor] = React.useState(false)
  const [readerRequest, setReaderRequest] = React.useState<PlanReaderRequest>()
  const calendarEntries = useCalendarEntries()
  const today = useLocalToday()
  const [showActivationCheck, setShowActivationCheck] = React.useState(false)
  const [showCreated, setShowCreated] = React.useState(false)
  const scheduleAnchor = React.useRef<HTMLDivElement>(null)
  const checkedToday = projectCurrentInstantToday(state)
  const todayView = executionBlocked
    ? { ...checkedToday, state: "UNAVAILABLE" as const, title: "몸 상태와 처방을 먼저 확인해 주세요", sessions: [] }
    : checkedToday
  const todayIds = new Set(checkedToday.sessions.map(session => session.id))
  const todayDetailedSessions = state.activePlan.sessions.filter(session => todayIds.has(instantSessionId(session))
    && session.prescription.kind === "PACE_TARGET")
  const showSchedule = () => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    scheduleAnchor.current?.scrollIntoView?.({ block: "start", behavior: reduced ? "auto" : "smooth" })
    scheduleAnchor.current?.focus({ preventScroll: true })
  }
  const { activePlan } = state
  const explanationContext = {
    plan: activePlan,
    kind: "SAVED" as const,
    generatedAt: state.generatedAt,
    receipt: state.version === 3 ? state.explanationReceipt : undefined,
    frameOrdinal: state.version === 3 ? state.periodization?.frameOrdinal : undefined,
  }
  const loadSessionEvidence = (session: PlanSession) => {
    const journal = loadEntriesForPlanSafety()
    return journal.status === "complete" ? collectSessionExplanationEvidence(journal.entries, state, session, readArchivedOriginalPlans()) : null
  }
  const recorded = new Map(
    state.progress.map((progress) => [
      `${progress.sessionDay}:${progress.sessionSlot}`,
      progress.state,
    ]),
  )
  const label = candidateLabel(
    activePlan.candidateKind,
    activePlan.selectedEnergyIntent,
  )
  const frameLengthDays = "projectionLengthDays" in activePlan.frame
    ? activePlan.frame.projectionLengthDays ?? activePlan.frame.lengthDays
    : activePlan.frame.lengthDays
  const detailedPrescription = activePlan.sessions
    .map((session) => session.prescription)
    .find((prescription): prescription is StoredPaceTargetPrescription => (
      prescription.kind === "PACE_TARGET"
    ))
  const hasDetailedPrescription = detailedPrescription !== undefined
  const frameComplete = isPlanFrameCompletionEligible(state, today)
  const startDate = state.intake.startDate ?? state.generatedAt.slice(0, 10)
  const frameDayCount = Math.ceil(frameLengthDays)
  const focusLabel = ENERGY_INTENT_LABELS[activePlan.selectedEnergyIntent].title
  const planAdjustment = activePlan.candidateKind === "CONSERVATIVE"
    ? "쉬운 훈련은 가장 짧은 시간으로 구성"
    : "쉬운 훈련은 표시 범위 안에서 조절"
  const returnedSession = returnToSession === undefined
    ? null
    : resolveCurrentPlannedSession(state, returnToSession)
  const returnedJournal = returnedSession === null || returnToSession === undefined
    ? undefined
    : loadEntries().find((entry): entry is PostSessionEntry => entry.kind === "post-session"
      && entry.date === returnToSession.plannedDate
      && samePlannedSessionLink(entry.plannedSessionLink, returnToSession))

  React.useEffect(() => {
    if (!showCreatedCelebration) return
    setShowCreated(true)
    const dismiss = () => setShowCreated(false)
    const timeout = window.setTimeout(dismiss, 3_000)
    window.addEventListener("pointerdown", dismiss, { once: true, capture: true })
    window.addEventListener("keydown", dismiss, { once: true, capture: true })
    window.addEventListener("scroll", dismiss, { once: true, capture: true })
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("pointerdown", dismiss, true)
      window.removeEventListener("keydown", dismiss, true)
      window.removeEventListener("scroll", dismiss, true)
    }
  }, [showCreatedCelebration])

  return (
    <section className="active-plan" aria-labelledby="active-plan-title">
      {showCreated && (
        <div
          className="active-plan__created-toast"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CircleCheck aria-hidden="true" size={22} />
          <span>
            <strong>훈련 계획이 완성됐어요</strong>
            <small>메인 훈련일과 날짜를 먼저 확인해 보세요.</small>
          </span>
        </div>
      )}
      <h1 id="active-plan-title">{frameLengthDays}일 훈련 계획</h1>
      {state.version === 3 && state.executionReplan && <details className="plan-detailed-options">
        <summary>수행 기록을 확인하고 바꾼 일정</summary>
        <p>오늘과 이미 기록한 훈련은 그대로 두었어요. 이전 계획은 해당 일지에서 확인할 수 있어요.</p>
        <p>{state.executionReplan.action === "REDUCE" ? "운동 시간을 기존 범위의 짧은 쪽으로 조정했어요."
          : state.executionReplan.action === "REPLACE" ? "주요 훈련을 이 계획에 있던 저강도 운동으로 바꿨어요."
            : "훈련을 뒤의 운동 날짜로 옮기고 원래 날짜는 휴식으로 두었어요."}</p>
      </details>}
      {(cloudPersistence === "FAILED" || cloudPersistence === "SAVING" || cloudPersistence === "CHECKING") && (
        <div className="active-plan__storage-status" role={cloudPersistence === "FAILED" ? "alert" : "status"}>
          <p>{cloudPersistenceLabel(cloudPersistence)}</p>
          {cloudPersistence === "FAILED" && onRetryCloudBackup !== undefined && (
            <button className="plan-source-strip__retry" type="button" onClick={onRetryCloudBackup}>계정에 다시 저장</button>
          )}
        </div>
      )}
      {todayDetailedSessions.length > 0 && <section aria-label="오늘 상세 훈련 시작 전 확인">
        <p>저장된 훈련 내용이에요. 시작 전 몸 상태와 현재 처방을 다시 확인해 주세요.</p>
        {todayDetailedSessions.map(session => session.prescription.kind === "PACE_TARGET" && <div key={instantSessionId(session)}>
          {!executionBlocked && (todayView.state === "SCHEDULED" || todayView.state === "PARTLY_RECORDED")
            && todayView.sessions.some(item => item.id === instantSessionId(session) && !item.recorded)
            && <button type="button" className="plan-text-action"
            onClick={() => { if (session.prescription.kind === "PACE_TARGET") onCheckDetailedExecution(session.prescription, "START", "NO_KNOWN_RISK") }}>
            {sessionSlotLabel(session.slot)} 상세 훈련 · 통증 없고 평소와 같음
          </button>}
          <button type="button" className="plan-text-action"
            onClick={() => { if (session.prescription.kind === "PACE_TARGET") onCheckDetailedExecution(session.prescription, "START", "REVIEW_REQUIRED") }}>
            {sessionSlotLabel(session.slot)} 상세 훈련 · 통증·이상 또는 잘 모르겠음
          </button>
        </div>)}
      </section>}
      {executionMessage && <div className="plan-execution-status" role="status">{executionMessage}</div>}
      <InstantPlanTodayView today={todayView} compact onContinue={showSchedule} changeScheduleLabel="휴식·건너뜀 기록"
        onViewSession={id => {
          const session = activePlan.sessions.find(item => instantSessionId(item) === id)
          if (session) setReaderRequest(previous => ({ day: session.day, slot: session.slot, sequence: (previous?.sequence ?? 0) + 1 }))
        }}
        onChangeSchedule={id => {
          const session = activePlan.sessions.find(item => instantSessionId(item) === id)
          if (session) setReaderRequest(previous => ({ day: session.day, slot: session.slot, section: "records", sequence: (previous?.sequence ?? 0) + 1 }))
        }}
        onRecordSession={onWriteSessionLog === undefined ? undefined : id => {
          const session = activePlan.sessions.find(item => instantSessionId(item) === id)
          if (session && session.role !== "REST") onWriteSessionLog(session)
        }} />
      {futureTrainingEditor}
      <details className="plan-detailed-options">
      <summary>전체 계획 구성</summary>
      <p className="active-plan__variant">
        <strong>{label.title}</strong>
        <span>{planAdjustment}</span>
      </p>
      <p className="active-plan__date-range">
        <CalendarDays aria-hidden="true" size={18} />
        {planDateRangeLabel(startDate, frameDayCount)}
      </p>
      <ul className="active-plan__build-summary" aria-label="계획 구성 요약">
        <li>{eventDistanceLabel(activePlan.eventDistanceM ?? state.intake.eventDistanceM)}</li>
        <li>
          {focusLabel}
          <TermHelp term={ENERGY_INTENT_LABELS[activePlan.selectedEnergyIntent].term} />
        </li>
        <li>{state.intake.secondSessionMode === "RECOVERY_PM_ALLOWED" ? "하루 2회 포함" : "하루 1회"}</li>
      </ul>
      {state.version === 3 && state.periodization !== undefined && (
        <section className="periodization-direction" aria-labelledby="periodization-direction-title">
          <div>
            <p id="periodization-direction-title">24주 훈련 방향</p>
            <strong>
              {state.periodization.frameOrdinal}/18번째 계획
              {" · "}{PERIODIZATION_PHASE_LABELS[state.periodization.phase]}
            </strong>
            <small>
              3개 계획을 한 묶음으로 보고 있어요. 지금은 {state.periodization.mesocycleOrdinal}/6번째 묶음이에요.
            </small>
          </div>
          <div
            className="periodization-direction__track"
            role="progressbar"
            aria-label="24주 훈련 방향 진행 위치"
            aria-valuemin={1}
            aria-valuemax={18}
            aria-valuenow={state.periodization.frameOrdinal}
          >
            {Array.from({ length: 18 }, (_, index) => (
              <span
                key={index}
                className={index + 1 <= state.periodization!.frameOrdinal ? "is-reached" : undefined}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="periodization-direction__boundary">
            장기 방향을 보여주는 표예요. 이 표가 훈련 강도·양·횟수를 자동으로 올리지는 않아요.
          </p>
        </section>
      )}
      </details>
      <div ref={scheduleAnchor} tabIndex={-1} aria-label="전체 일정과 기록">
      <PlanSchedulePreview
        journalEntries={calendarEntries}
        readerRequest={readerRequest}
        sessionProgress={session => recorded.get(`${session.day}:${session.slot}`)}
        startDate={startDate}
        frameLengthDays={frameLengthDays}
        sessions={activePlan.sessions}
        explanationContext={explanationContext}
        loadEvidence={loadSessionEvidence}
        focusSession={returnedSession ?? undefined}
        showRpeGuide={false}
        timelineHeading="날짜별 훈련"
        displayMode="swipe"
        detailsExpanded={false}
        readerNotice={executionMessage || executionBlocked ? <div role="status">
          {executionMessage && <p>{executionMessage}</p>}
          {executionBlocked && <p>몸 상태와 처방을 먼저 확인해 주세요.</p>}
        </div> : undefined}
        renderAfterSchedule={(
          <>
            {frameComplete ? (
              <PlanAdaptationFlow state={state} onPendingChange={setHasPendingSuccessor} onPrepareNextFrame={onNextFrame} />
            ) : (
              <div className="plan-adaptation__notice" role="status">
                각 훈련을 마친 뒤 완료·휴식·건너뜀·통증 확인 중 하나를 기록해 주세요.
              </div>
            )}
            <details className="active-plan__information">
              <summary>
                <span><Info aria-hidden="true" size={17} />계획 정보와 유의사항</span>
                <ChevronDown aria-hidden="true" size={18} />
              </summary>
              <div className="active-plan__information-body">
                <p className="active-plan__carryover-warning">
                  완료하지 못한 훈련을 다음 날에 몰아서 하지 마세요. 계획에 표시된 날짜를 기준으로 진행해 주세요.
                </p>
                <div className="plan-source-strip">
                  <Info aria-hidden="true" size={17} />
                  <span>
                    <strong>
                      <span className="plan-source-strip__title">
                        {activePlan.sourceMode === "PROFILE_ONLY"
                          ? "내가 고른 조건 · 베타 계획"
                          : "최근 일지 확인 · 베타 계획"}
                      </span>
                      <TermHelp term="plan-beta-basis" />
                    </strong>
                    <small>{cloudPersistenceLabel(cloudPersistence)} · 의료 판단 아님</small>
                    {state.athleteEvidence !== undefined && (
                      <small>
                        저장된 경기 기록 {state.athleteEvidence.storedRecordCount}개
                        {" · "}최근 일지 {state.athleteEvidence.recentJournalSessionCount}개 연결
                        {" · "}{hasDetailedPrescription
                            ? `확인한 ${detailedPrescription.targetEventDistanceM}m 기록은 상세 세션 페이스에 사용`
                          : "개인 기록에 근거한 페이스는 해당 훈련에 기준 기록과 함께 표시해요"}
                        {" · "}일지 개수 자체로 훈련량이나 강도를 정하지 않아요
                      </small>
                    )}
                    {state.intake.competitionDivision !== undefined
                      && state.intake.competitionDivision !== "NOT_PROVIDED" && (
                      <small>
                        참가 부문: {DIVISION_LABELS[state.intake.competitionDivision].title} · 화면에만 표시하며 훈련 강도와 안전 판단에는 사용하지 않았어요
                      </small>
                    )}
                  </span>
                </div>
                <PlanRpeGuide />
              </div>
            </details>
          </>
        )}
        renderSessionFooter={(session) => {
          const current = recorded.get(`${session.day}:${session.slot}`)
          const detailedPrescription = session.prescription.kind === "PACE_TARGET"
            ? session.prescription
            : null
          const isReturnedSession = returnedSession !== null
            && session.day === returnedSession.day
            && session.slot === returnedSession.slot
          const canMarkReturnedSessionCompleted = isReturnedSession
            && current === undefined
            && returnedJournal?.activityOutcome === "COMPLETED"
            && returnedJournal.activitySlot === session.slot
            && returnedJournal.painCheckStatus === "NO_SIGNAL_REPORTED"
          return (
            <>
              {detailedPrescription !== null && (
                <details className="active-plan__execution-check">
                  <summary>
                    {current === undefined
                      ? "시작 전 확인"
                      : current === "PAIN_CHECKIN"
                        ? "통증 기록 후 확인"
                        : "기록 후 몸 상태 확인"}
                  </summary>
                  <p>누를 때마다 몸 상태와 저장된 처방의 승인·만료·철회 여부를 다시 확인해요.</p>
                  {current === undefined ? (
                    <button
                      className="active-plan__execution-primary"
                      type="button"
                      onClick={() => onCheckDetailedExecution(
                        detailedPrescription,
                        "START",
                        "NO_KNOWN_RISK",
                      )}
                    >
                      통증 없고 평소와 같음 · 시작 확인
                    </button>
                  ) : (
                    <p className="active-plan__execution-note">
                      이미 결과를 기록한 세션은 다시 시작하지 않아요. 몸 상태가 이상하면 아래에서 확인해 주세요.
                    </p>
                  )}
                  <button
                    className="active-plan__execution-review"
                    type="button"
                    onClick={() => onCheckDetailedExecution(
                      detailedPrescription,
                      "START",
                      "REVIEW_REQUIRED",
                    )}
                  >
                    <AlertTriangle aria-hidden="true" size={16} />
                    통증·이상 또는 잘 모르겠음
                  </button>
                </details>
              )}
              <em className="active-plan__status">
                {current === undefined ? "예정" : PROGRESS_LABELS[current]}
              </em>
              <SessionExplanationEntry session={session} context={explanationContext} loadEvidence={loadSessionEvidence}
                initialTab="주기·기록" entryLabel="연결된 일지 기록 보기" showPurpose={false} returnLabel="훈련과 일지로 돌아가기" />
              {session.role !== "REST" && onWriteSessionLog !== undefined && (
                <button
                  className="active-plan__journal-action"
                  type="button"
                  onClick={() => onWriteSessionLog(session)}
                >
                  이 훈련 일지 쓰기
                </button>
              )}
              {isReturnedSession && returnedJournal !== undefined && (
                <p className="active-plan__journal-return" role="status">
                  일지를 저장했어요. 계획의 진행 기록은 별도예요.
                </p>
              )}
              <div
                className="active-plan__actions"
                role="group"
                aria-label={`DAY ${session.day} ${sessionSlotLabel(session.slot)} 진행 기록`}
              >
                {actionsForRole(session.role).map(({ state: progressState, icon: Icon }) => (
                  <button
                    type="button"
                    key={progressState}
                    className={canMarkReturnedSessionCompleted && progressState === "COMPLETED"
                      ? "active-plan__journal-progress-action"
                      : undefined}
                    aria-pressed={current === progressState}
                    onClick={() => onProgress({
                      sessionDay: session.day,
                      sessionSlot: session.slot,
                      state: progressState,
                    })}
                  >
                    <Icon aria-hidden="true" size={15} />
                    {canMarkReturnedSessionCompleted && progressState === "COMPLETED"
                      ? "계획에도 완료 표시"
                      : PROGRESS_LABELS[progressState]}
                  </button>
                ))}
              </div>
            </>
          )
        }}
      />
      </div>
      <div className="active-plan__continuity">
        <details className="plan-session-guidance">
        <summary>다음 계획에 반영되는 내용</summary>
        <p>
          {state.version === 3
            ? "다음 주기는 현재 일정과 연결된 수행 기록을 확인해 만들어요. 같은 목적의 상세 훈련은 유지하고, 직접 기록한 RPE가 반복해서 높으면 검토된 짧은 구성으로 조정할 수 있어요."
            : "현재 일정과 수행 여부를 기준으로 다음 주기를 이어가요. 변경 이력이 있는 이 계획의 상세 구성을 그대로 복사하거나 자동으로 줄이는 경로는 아직 지원하지 않아요."}
          기록이 부족하거나 비교가 어려우면 임의로 줄이지 않아요. 강도·훈련량을 자동으로 늘리거나 메모 원문을 분석하지 않아요.
          새 계획을 시작하기 전에 몸 상태와 바뀐 내용을 다시 확인해 주세요.
        </p>
        </details>
        {frameComplete && hasPendingSuccessor ? (
          <>
            <button type="button" onClick={() => setShowActivationCheck(true)}>
              선택한 다음 계획 시작하기
            </button>
            {showActivationCheck && (
              <div
                className="plan-adaptation__panel"
                role="group"
                aria-label="다음 계획 시작 전 몸 상태 확인"
              >
                <strong>지금 몸 상태를 다시 확인해 주세요</strong>
                <button type="button" onClick={() => onActivateNextFrame("NO_KNOWN_RISK")}>
                  통증 없고 몸 상태는 평소와 같아요
                </button>
                <button type="button" onClick={() => onActivateNextFrame("REVIEW_REQUIRED")}>
                  통증·부상·몸 이상이 있거나 잘 모르겠어요
                </button>
              </div>
            )}
          </>
        ) : state.activePlan.selectionActor !== "SELF" ? (
          <p>이 계획은 지도자가 선택한 계획이에요. 연결된 지도자와 다음 계획을 확인해 주세요.</p>
        ) : (
          <button type="button" disabled={!frameComplete} onClick={onNextFrame}>
            {frameComplete ? "현재 기준으로 다음 계획안 만들기" : "현재 계획을 먼저 기록해 주세요"}
          </button>
        )}
      </div>
    </section>
  )
}

function cloudPersistenceLabel(state: PlanCloudPersistenceState): string {
  switch (state) {
    case "CHECKING":
      return "이 기기에 저장됨 · 계정 저장 상태 확인 중"
    case "SAVING":
      return "이 기기에 저장됨 · 계정에 저장 중"
    case "SAVED":
      return "이 기기와 로그인한 계정에 저장"
    case "FAILED":
      return "이 기기에 저장됨 · 계정에는 저장하지 못했어요"
    case "DEVICE_ONLY":
      return "이 기기에만 저장"
  }
}

function actionsForRole(
  role: "REST" | "EASY" | "QUALITY",
): readonly (typeof PROGRESS_ACTIONS)[number][] {
  if (role !== "REST") return PROGRESS_ACTIONS
  return PROGRESS_ACTIONS.filter(({ state }) => state !== "COMPLETED")
}

const SHORT_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const

function planDateRangeLabel(startDate: string, dayCount: number): string {
  if (!isValidIsoDate(startDate)) return `${dayCount}일 일정`
  return `${planDateLabel(startDate)} - ${planDateLabel(isoShift(startDate, dayCount - 1))}`
}

function planDateLabel(iso: string): string {
  const date = isoToDate(iso)
  return `${date.getMonth() + 1}월 ${date.getDate()}일(${SHORT_WEEKDAYS[date.getDay()]})`
}
