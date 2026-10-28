import { BookOpen, ChevronRight, LayoutGrid, NotebookPen } from "lucide-react"
import { useId, useRef, type ReactNode } from "react"
import { CategoryCard } from "../../components/CategoryCard"
import { CalendarRoleIcon } from "../../components/CalendarTrainingMark"
import { CategoryShortcuts, type CategoryShortcutItem } from "../../components/CategoryShortcuts"
import type { HomeSession, TrainingHomeViewModel } from "../../domain/home-view-model"
import { AppHeading } from "../../components/AppHeading"
import type { OracleTopicId } from "../../domain/oracle-exploration"
import { sessionWorkoutNotation } from "../../domain/workout-notation"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { CALENDAR_TRAINING_LABELS, plannedCalendarTone } from "../../domain/calendar-training-presentation"
import { sessionLabel, sessionSlotLabel, PROGRESS_LABELS } from "../plan-beta/labels"
import type { LogEntryType } from "../log-entry/shared"
import type { CalendarReadiness } from "../../domain/calendar-context"
import { HomeIdentityArtwork } from "./HomeIntroduction"
import type { AccountPlanStatus } from "../../domain/account/account-plan-service"
import "../../styles/home-hub.css"

export function nextTrainingPrescriptionLabel(session: HomeSession): string {
  const p = session.prescription
  if (p.kind === "RPE_TIME_RANGE" && p.catalogWorkout && !resolveCatalogBinding(p.catalogWorkout)) return "훈련 내용 확인 필요"
  return sessionWorkoutNotation(session, "PLAIN")
}

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: (entryType?: LogEntryType) => void
  readonly onOpenArchive?: () => void
  readonly onOpenToday?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenOracle?: (topic: OracleTopicId) => void
  readonly onOpenMore?: () => void
  readonly onOpenContent?: () => void
  readonly onOpenRewards?: () => void
  readonly onOpenNextTraining?: () => void
  readonly onOpenTrainingSession?: (session: HomeSession) => void
  readonly safetyNotice?: ReactNode
  readonly announcement?: ReactNode
  readonly oraclePreview?: ReactNode
  readonly oraclePreviewLabel?: string
  readonly recordStart?: ReactNode
  readonly accountEntry?: ReactNode
  readonly recentJournal?: ReactNode
  readonly installSuggestion?: ReactNode
  readonly inlineMemo?: ReactNode
  readonly planReadiness?: AccountPlanStatus | "ERROR" | "EVIDENCE_REQUIRED"
  readonly journalReadiness?: CalendarReadiness
  readonly introductionAllowed?: boolean
  readonly introductionReady?: boolean
}

export function TrainingHome({
  model, onWriteLog, onOpenArchive, onOpenToday, onOpenPlan,
  onOpenOracle, onOpenMore, onOpenContent, onOpenRewards, onOpenTrainingSession,
  safetyNotice, announcement, accountEntry, recentJournal, installSuggestion, inlineMemo, planReadiness = "READY",
  journalReadiness = "READY",
}: TrainingHomeProps) {
  // The model requests the first-record example only when no dated journal is visible.
  const hasJournalHistory = !model.showMinjiPrompt
  const welcome = model.homeMode === "WELCOME"
  const title = useRef<HTMLHeadingElement>(null)
  const analysisEntry = onOpenOracle && <section className="home-hub__oracle"><CategoryCard variant="row" category="oracle" title="내 기록 분석" onClick={() => onOpenOracle("level")} /></section>
  const shortcuts: CategoryShortcutItem[] = []
  if (onOpenContent) shortcuts.push({ id: "training-guide", category: "training", icon: BookOpen, label: "훈련법", accessibleLabel: "훈련법 읽기", onClick: onOpenContent })
  if (onOpenRewards) shortcuts.push({ id: "decoration", category: "journal", icon: NotebookPen, label: "꾸미기", accessibleLabel: "일지 꾸미기", onClick: onOpenRewards })

  return (
    <div className="home-hub">
      <header className="home-hub__header">
        <div className="home-hub__identity"><HomeIdentityArtwork /><div className="home-hub__identity-copy">
          <div className="home-hub__brand">TRAINORACLE</div>
          {!welcome && <span className="home-hub__purpose">운동 분석 · 훈련 계획</span>}
        </div>
        </div>
        <div className="home-hub__header-actions">
          {accountEntry}
          <button className="home-hub__more" data-install-shortcut-return="home" type="button" onClick={onOpenMore} aria-label="더보기" title="전체 메뉴">
            <LayoutGrid aria-hidden="true" size={18} /><span>더보기</span>
          </button>
        </div>
      </header>
      {safetyNotice}

      <section className="home-hub__intro" aria-labelledby="home-hub-title">
        <AppHeading ref={title} tabIndex={-1} id="home-hub-title" variant="hero" accent>훈련과 기록</AppHeading>
      </section>

      <DatedTraining model={model} readiness={planReadiness} onOpenPlan={onOpenPlan} onOpenSession={onOpenTrainingSession} />
      <section className="home-hub__work-area" aria-labelledby="home-record-title">
        <div className="home-hub__section-heading"><AppHeading as="h2" variant="section" id="home-record-title">오늘의 기록</AppHeading>
          {journalReadiness === "READY" && model.todayRecordCount > 0 && <button type="button" onClick={onOpenToday}>남긴 기록 {model.todayRecordCount}개<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>
        {journalReadiness === "READY" && model.briefing !== "" && <p className="home-hub__briefing" aria-label="오늘 기록 요약">{model.briefing}</p>}
        {inlineMemo}
        {onWriteLog && <div className="home-hub__workout-entry"><CategoryCard variant="row" category="record" title="운동 내용도 기록하기" onClick={() => onWriteLog("quick-session")} /></div>}
      </section>

      {model.homeMode !== "WELCOME" && hasJournalHistory && <section className="home-hub__summary">
        {!recentJournal && <div className="home-hub__section-heading">
          <AppHeading as="h2" variant="section" id="home-hub-summary-title">최근 하루 기록</AppHeading>
          {onOpenArchive && <button type="button" onClick={onOpenArchive}>전체 기록 보기<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>}
        {recentJournal}
        {!recentJournal && <CategoryCard variant="row" category="journal" title="최근 기록" description={model.journalSummary} onClick={onOpenArchive} />}
      </section>}

      {analysisEntry}

      <CategoryShortcuts className="home-hub__shortcuts" label="홈 바로가기" items={shortcuts} />

      {(announcement || installSuggestion) && <aside className="home-hub__announcements" aria-label="소식과 설치 안내">{announcement}{installSuggestion}</aside>}

    </div>
  )
}

function DatedTraining({ model, readiness, onOpenPlan, onOpenSession }: { model: TrainingHomeViewModel; readiness: NonNullable<TrainingHomeProps["planReadiness"]>; onOpenPlan?: () => void; onOpenSession?: ((session: HomeSession) => void) | undefined }) {
  const id = useId()
  const notices: Partial<Record<NonNullable<TrainingHomeProps["planReadiness"]>, string>> = {
    EVIDENCE_REQUIRED: "보관한 계획의 출처 확인이 필요해요. 원본과 진행 기록을 먼저 확인해 주세요.",
    IDLE: "훈련 계획을 확인하고 있어요.", LOADING: "훈련 계획을 확인하고 있어요.",
    PENDING: "계획의 계정 저장을 기다리고 있어요. 아직 계정 저장이 완료되지 않았어요.",
    CONFLICT: "다른 기기의 계획 수정과 겹쳤어요. 계획에서 사용할 내용을 확인해 주세요.",
    AUTH_REQUIRED: "계획을 확인하려면 다시 로그인해 주세요.",
    INVALID: "보관한 계획을 확인할 수 없어요. 계획에서 원본을 확인해 주세요.",
    REJECTED: "계정에 계획을 저장하지 못했어요. 계획에서 보관 상태를 확인해 주세요.",
    FAILED: "훈련 계획을 읽지 못했어요. 계획에서 다시 확인해 주세요.",
    ERROR: "훈련 계획을 읽지 못했어요. 계획에서 다시 확인해 주세요.",
  }
  return <section className="home-hub__training" aria-labelledby={`${id}-heading`}>
    <div className="home-hub__section-heading"><AppHeading as="h2" variant="section" id={`${id}-heading`}>오늘과 내일 훈련</AppHeading>
      {onOpenPlan && <button type="button" onClick={onOpenPlan}>전체 계획<ChevronRight aria-hidden="true" size={16} /></button>}
    </div>
    {readiness !== "READY" && readiness !== "EMPTY" ? <p role={readiness === "IDLE" || readiness === "LOADING" || readiness === "PENDING" || readiness === "EVIDENCE_REQUIRED" ? "status" : "alert"}>{notices[readiness]}</p>
      : model.hasPlan === false ? <button type="button" className="home-hub__text-action" onClick={onOpenPlan}>훈련 계획 만들기<ChevronRight size={16} aria-hidden="true" /></button>
      : <div className="home-hub__training-days">{model.trainingDays?.map((day, index) => <article className="home-hub__training-day" key={day.date} aria-label={`${index === 0 ? "오늘" : "내일"} 훈련`}>
        <h3>{index === 0 ? "오늘" : "내일"}<time dateTime={day.date}>{Number(day.date.slice(5, 7))}월 {Number(day.date.slice(8))}일</time></h3>
        {day.sessions.length === 0 ? <p className="home-hub__training-empty">예정된 훈련이 없어요.</p> : day.sessions.map(({ session, progress }) => <div className={`home-hub__training-slot${session.role === "REST" ? " home-hub__training-slot--rest" : ""}`} key={`${session.day}:${session.slot}`}>
          <div className="home-hub__training-meta"><span className="home-hub__training-role" data-tone={plannedCalendarTone(session)}><CalendarRoleIcon tone={plannedCalendarTone(session)} />{sessionSlotLabel(session.slot)} · {CALENDAR_TRAINING_LABELS[plannedCalendarTone(session)]}</span>{progress !== null && <strong>{PROGRESS_LABELS[progress as keyof typeof PROGRESS_LABELS] ?? `진행 상태 · ${progress}`}</strong>}</div>
          {session.role !== "REST" && <><h4>{sessionLabel(session)}</h4><p className="home-hub__training-main">{nextTrainingPrescriptionLabel(session)}</p></>}
          {session.role !== "REST" && onOpenSession && <button type="button" className="home-hub__text-action" aria-label={`${day.date} ${sessionSlotLabel(session.slot)} 훈련 상세`} onClick={() => onOpenSession(session)}>훈련 상세<ChevronRight size={16} aria-hidden="true" /></button>}
        </div>)}
      </article>)}</div>}
  </section>
}
