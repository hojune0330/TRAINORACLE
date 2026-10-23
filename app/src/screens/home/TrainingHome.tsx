import { BookOpen, CalendarDays, ChartColumn, CheckCircle2, ChevronRight, LayoutGrid, NotebookPen, PencilLine } from "lucide-react"
import { useId, useRef, type ReactNode } from "react"
import { CategoryCard, type AppCategory } from "../../components/CategoryCard"
import { CategoryShortcuts, type CategoryShortcutItem } from "../../components/CategoryShortcuts"
import type { HomeSession, TrainingHomeViewModel } from "../../domain/home-view-model"
import { AppHeading } from "../../components/AppHeading"
import type { OracleTopicId } from "../../domain/oracle-exploration"
import { sessionWorkoutNotation } from "../../domain/workout-notation"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { CALENDAR_TRAINING_LABELS, plannedCalendarTone } from "../../domain/calendar-training-presentation"
import { formatTrainingSeconds, sessionLabel, sessionSlotLabel } from "../plan-beta/labels"
import type { LogEntryType } from "../log-entry/shared"
import type { CalendarReadiness } from "../../domain/calendar-context"
import { HomeIdentityArtwork, HomeIntroduction, useHomeIntroduction } from "./HomeIntroduction"
import "../../styles/home-hub.css"

export function nextTrainingPrescriptionLabel(session: HomeSession): string {
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
  readonly onOpenMinigame?: () => void
  readonly onOpenPaceCalculator?: () => void
  readonly onOpenContent?: () => void
  readonly onOpenRewards?: () => void
  readonly onOpenNextTraining?: () => void
  readonly safetyNotice?: ReactNode
  readonly announcement?: ReactNode
  readonly oraclePreview?: ReactNode
  readonly oraclePreviewLabel?: string
  readonly recordStart?: ReactNode
  readonly accountEntry?: ReactNode
  readonly recentJournal?: ReactNode
  readonly installSuggestion?: ReactNode
  readonly journalReadiness?: CalendarReadiness
  readonly introductionAllowed?: boolean
  readonly introductionReady?: boolean
}

export function TrainingHome({
  model, onWriteLog, onOpenArchive, onOpenToday, onOpenGuide, onOpenPlan, onOpenTrends,
  onOpenOracle, onOpenMore, onOpenMinigame, onOpenPaceCalculator, onOpenContent, onOpenRewards, onOpenNextTraining,
  safetyNotice, announcement, oraclePreview, recordStart, accountEntry, recentJournal, installSuggestion,
  journalReadiness = "READY", introductionAllowed = true, introductionReady = true,
}: TrainingHomeProps) {
  const next = model.nextTraining
  const nextAction = onOpenNextTraining ?? onOpenPlan
  // The model requests the first-record example only when no dated journal is visible.
  const hasJournalHistory = !model.showMinjiPrompt
  const welcome = model.homeMode === "WELCOME"
  const introduction = useHomeIntroduction(introductionAllowed && introductionReady && journalReadiness === "READY")
  const title = useRef<HTMLHeadingElement>(null)
  const analysisEntry = oraclePreview ? oraclePreview
    : onOpenOracle && <section className="home-hub__oracle"><CategoryCard category="oracle" title="오라클 결과 보기" onClick={() => onOpenOracle("level")} /></section>
  const shortcuts: CategoryShortcutItem[] = []
  const featuredShortcuts: CategoryShortcutItem[] = []
  if (onOpenMinigame) featuredShortcuts.push({ id: "games", category: "home", illustration: "running-game-announcement", label: "게임", accessibleLabel: "게임 라운지", onClick: onOpenMinigame })
  if (onOpenPaceCalculator) featuredShortcuts.push({ id: "pace", category: "training", illustration: "pace-calculator-announcement", label: "페이스 계산기", accessibleLabel: "페이스 계산기", onClick: onOpenPaceCalculator })
  if (onOpenMore) featuredShortcuts.push({ id: "more", category: "home", icon: LayoutGrid, label: "더보기", accessibleLabel: "더보기 전체 메뉴", onClick: onOpenMore })
  if (onOpenTrends) shortcuts.push({ id: "trends", category: "oracle", icon: ChartColumn, label: "훈련량", accessibleLabel: "훈련량·변화 보기", onClick: onOpenTrends })
  if (onOpenGuide) shortcuts.push({ id: "example", category: "journal", label: "일지 예시", accessibleLabel: "일지 예시 보기", onClick: onOpenGuide })
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
        <AppHeading ref={title} tabIndex={-1} id="home-hub-title" variant="hero" accent>{welcome ? "운동 분석과 훈련 계획" : model.homeMode === "TRAINING" ? "훈련과 기록" : "내 기록"}</AppHeading>
      </section>

      {welcome ? <WelcomeToday onWriteLog={onWriteLog} onOpenPlan={onOpenPlan} analysisEntry={analysisEntry} /> : <>
        {next !== null && <NextTrainingCard next={next} onOpen={nextAction} />}
        <TodaySection model={model} readiness={journalReadiness} onWriteLog={onWriteLog} onOpenToday={onOpenToday} />
      </>}

      <CategoryShortcuts className="home-hub__featured" label="게임·계산기·더보기" items={featuredShortcuts} />
      {installSuggestion}

      {introduction.expanded && <HomeIntroduction onDismiss={() => {
        introduction.dismiss()
        const actions = title.current?.closest(".home-hub")?.querySelectorAll<HTMLButtonElement>(".home-hub__today button")
        actions?.[actions.length - 1]?.focus({ preventScroll: true })
      }} />}

      {model.homeMode !== "WELCOME" && hasJournalHistory && <section className="home-hub__summary">
        {!recentJournal && <div className="home-hub__section-heading">
          <AppHeading as="h2" variant="section" id="home-hub-summary-title">최근 하루 기록</AppHeading>
          {onOpenArchive && <button type="button" onClick={onOpenArchive}>전체 기록 보기<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>}
        {recentJournal}
        {!recentJournal && <SummaryRow category="journal" label="최근 기록" detail={model.journalSummary} onClick={onOpenArchive} />}
      </section>}

      {!welcome && analysisEntry}
      {recordStart && journalReadiness === "READY" && recordStart}

      <CategoryShortcuts className="home-hub__shortcuts" label="홈 바로가기" items={shortcuts} />

      {announcement && <div className="home-hub__announcement">{announcement}</div>}

    </div>
  )
}

function WelcomeToday({ onWriteLog, onOpenPlan, analysisEntry }: { onWriteLog?: (entryType?: LogEntryType) => void; onOpenPlan?: () => void; analysisEntry: ReactNode }) {
  return <section className="home-hub__today home-hub__today--welcome" aria-label="오늘의 활동">
    <nav aria-label="훈련 계획과 운동 분석">
      <button className="home-hub__primary home-hub__primary--plan" type="button" onClick={onOpenPlan}><CalendarDays aria-hidden="true" size={20} /><span>훈련 계획 받기</span><ChevronRight aria-hidden="true" size={18} /></button>
      {analysisEntry}
    </nav>
    <div className="home-hub__welcome-record"><CategoryCard category="record" title="오늘 운동 기록 쓰기" onClick={() => onWriteLog?.("quick-session")} /></div>
    <OptionalDailyEntries onWriteLog={onWriteLog} />
  </section>
}

function NextTrainingCard({ next, onOpen }: { next: NonNullable<TrainingHomeViewModel["nextTraining"]>; onOpen?: () => void }) {
  const descriptionId = useId()
  const role = CALENDAR_TRAINING_LABELS[plannedCalendarTone(next.session)]
  const prescription = nextTrainingPreview(next.session)
  const accessibleName = `다음 훈련 · ${sessionLabel(next.session)} · ${nextTrainingDateLabel(next.date)} · ${sessionSlotLabel(next.session.slot)} · ${role}`
  return <section className="home-hub__next" aria-labelledby="home-hub-next">
    <div className="home-hub__next-heading">
      <AppHeading as="h2" variant="section" id="home-hub-next" className="home-hub__section-label">다음 훈련</AppHeading>
      <time dateTime={next.date}>{nextTrainingDateLabel(next.date, true)}</time>
    </div>
    <CategoryCard category="training" title={sessionLabel(next.session)}
      description={<span id={descriptionId} className="home-hub__next-prescription">{next.session.role === "QUALITY" && <span className="home-hub__next-role">{role} · </span>}{prescription}</span>}
      onClick={onOpen} aria-label={accessibleName} aria-describedby={descriptionId} />
  </section>
}

/** Home is a destination preview, not the execution instructions. Read the
 * verified full-session total; never substitute an old envelope for a broken
 * binding or guess the missing time of distance-based work. */
function nextTrainingPreview(session: HomeSession): string {
  const prescription = session.prescription
  if (prescription.kind === "RPE_TIME_RANGE") {
    if (prescription.catalogWorkout) {
      const workout = resolveCatalogBinding(prescription.catalogWorkout)
      if (!workout) return "훈련 내용 확인 필요"
      const total = workout.totals.seconds
      if (!total) return "시간 확인 필요"
      return `총 ${formatTrainingSeconds(total.minimum)}${total.minimum === total.maximum ? "" : `–${formatTrainingSeconds(total.maximum)}`}`
    }
    // Legacy quality envelopes are not a continuous-work prescription. Keep
    // their existing instructions until the full structure can be verified.
    if (session.role === "QUALITY") return nextTrainingPrescriptionLabel(session)
    const { minimum, maximum } = prescription.durationMinutes
    return `총 ${minimum}${minimum === maximum ? "" : `–${maximum}`}분`
  }
  return nextTrainingPrescriptionLabel(session)
}

function TodaySection({ model, readiness, onWriteLog, onOpenToday }: { model: TrainingHomeViewModel; readiness: CalendarReadiness; onWriteLog?: (entryType?: LogEntryType) => void; onOpenToday?: () => void }) {
  const confirmedTodayRecordCount = readiness === "READY" ? model.todayRecordCount : 0
  const confirmedBriefing = readiness === "READY" ? model.briefing : ""
  return <section className={`home-hub__today${confirmedTodayRecordCount === 0 ? " home-hub__today--record-action" : ""}`} aria-label="오늘">
    {confirmedTodayRecordCount > 0 ? <div className="home-hub__today-complete">
      <div className="home-hub__status"><CheckCircle2 aria-hidden="true" size={21} /><strong>오늘 남긴 기록 {confirmedTodayRecordCount}개</strong></div>
      {confirmedBriefing !== "" && <p className="home-hub__briefing" aria-label="오늘 기록 요약">{confirmedBriefing}</p>}
      <div className="home-hub__today-actions"><button className="home-hub__text-action" type="button" onClick={onOpenToday}>오늘 기록 보기<ChevronRight aria-hidden="true" size={17} /></button><button className="home-hub__text-action" type="button" onClick={() => onWriteLog?.()}>기록 더 남기기<ChevronRight aria-hidden="true" size={17} /></button></div>
    </div> : <><button className="home-hub__primary" type="button" onClick={() => onWriteLog?.("quick-session")}><PencilLine aria-hidden="true" size={19} /><span>오늘 운동 기록 쓰기</span><ChevronRight aria-hidden="true" size={18} /></button>{confirmedBriefing !== "" && <p className="home-hub__briefing" aria-label="아침 브리핑">{confirmedBriefing}</p>}</>}
    <OptionalDailyEntries onWriteLog={onWriteLog} />
  </section>
}

function OptionalDailyEntries({ onWriteLog }: { onWriteLog?: (entryType?: LogEntryType) => void }) {
  if (!onWriteLog) return null
  return <div className="home-hub__optional-records" role="group" aria-label="선택해서 남기는 기록">
    <CategoryCard variant="row" category="body" title="컨디션·메모" onClick={() => onWriteLog("evening")} />
  </div>
}

function SummaryRow({ category, label, detail, onClick }: { category: AppCategory; label: string; detail?: string; onClick?: () => void }) {
  const descriptionId = useId()
  return <CategoryCard variant="row" category={category} title={label}
    description={detail ? <span id={descriptionId}>{detail}</span> : undefined}
    onClick={onClick} aria-label={label} aria-describedby={detail ? descriptionId : undefined} />
}

function nextTrainingDateLabel(iso: string, compact = false): string {
  const [year, month, day] = iso.split("-")
  const base = `${Number(month)}월 ${Number(day)}일`
  const today = new Date(); const target = new Date(`${iso}T00:00:00`); const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((target.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays === 0) return compact ? "오늘" : `오늘(${base})`
  if (diffDays === 1) return compact ? "내일" : `내일(${base})`
  return Number(year) === today.getFullYear() ? base : `${year}년 ${base}`
}
