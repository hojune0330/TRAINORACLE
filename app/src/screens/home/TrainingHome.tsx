import { BookOpen, CheckCircle2, ChevronRight, Ellipsis, NotebookPen, PencilLine } from "lucide-react"
import { useId, type ReactNode } from "react"
import type { HomeSession, TrainingHomeViewModel } from "../../domain/home-view-model"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { OracleTopicId } from "../../domain/oracle-exploration"
import { sessionWorkoutNotation } from "../../domain/workout-notation"
import { sessionLabel, sessionSlotLabel } from "../plan-beta/labels"
import type { LogEntryType } from "../log-entry/shared"
import "../../styles/home-hub.css"

export function nextTrainingPrescriptionLabel(session: HomeSession): string {
  return sessionWorkoutNotation(session)
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
  readonly safetyNotice?: ReactNode
  readonly oraclePreview?: ReactNode
  readonly accountEntry?: ReactNode
  readonly todayContext?: ReactNode
  readonly recentJournal?: ReactNode
  readonly installSuggestion?: ReactNode
}

export function TrainingHome({
  model, onWriteLog, onOpenArchive, onOpenToday, onOpenGuide, onOpenPlan, onOpenTrends,
  onOpenOracle, onOpenMore, onOpenContent, onOpenRewards, onOpenNextTraining,
  safetyNotice, oraclePreview, accountEntry, todayContext, recentJournal, installSuggestion,
}: TrainingHomeProps) {
  const next = model.nextTraining
  const nextAction = onOpenNextTraining ?? onOpenPlan

  return (
    <div className="home-hub">
      <header className="home-hub__header">
        <div className="home-hub__brand">TRAINORACLE</div>
        <div className="home-hub__header-actions">
          {accountEntry}
          <button className="home-hub__more" data-install-shortcut-return="home" type="button" onClick={onOpenMore} aria-label="더보기" title="전체 메뉴">
            <span>더보기</span><Ellipsis aria-hidden="true" size={20} />
          </button>
        </div>
      </header>
      {safetyNotice}

      <section className="home-hub__intro" aria-labelledby="home-hub-title">
        <p className="home-hub__eyebrow">{model.homeMode === "WELCOME" ? "처음 기록하기" : model.homeMode === "TRAINING" ? "오늘 할 일" : "최근 기록"}</p>
        <h1 id="home-hub-title">{model.homeMode === "WELCOME" ? "오늘 운동을 기록해요" : model.homeMode === "TRAINING" ? "오늘의 훈련" : "내 기록"}</h1>
      </section>

      {oraclePreview ?? (onOpenOracle && <section className="home-hub__oracle-fallback" aria-label="오라클">
        <p>오라클에서 결과를 살펴볼 수 있어요.</p>
        <button className="home-hub__text-action" type="button" onClick={() => onOpenOracle("level")}>오라클 결과 보기<ChevronRight aria-hidden="true" size={17} /></button>
      </section>)}

      {model.homeMode === "WELCOME" ? <WelcomeToday model={model} onWriteLog={onWriteLog} onOpenPlan={onOpenPlan} onOpenGuide={onOpenGuide} /> : <>
        {next !== null && <NextTrainingCard next={next} onOpen={nextAction} />}
        <TodaySection model={model} onWriteLog={onWriteLog} onOpenToday={onOpenToday} todayContext={todayContext} />
      </>}

      {model.homeMode !== "WELCOME" && <section className="home-hub__summary">
        <div className="home-hub__section-heading">
          <h2 id="home-hub-summary-title">최근 하루 기록</h2>
          {onOpenArchive && <button type="button" onClick={onOpenArchive}>전체 기록 보기<ChevronRight aria-hidden="true" size={16} /></button>}
        </div>
        {recentJournal}
        {!recentJournal && <SummaryRow label="최근 기록" detail={model.journalSummary} onClick={onOpenArchive} />}
      </section>}

      {model.homeMode !== "WELCOME" && onOpenTrends && <section className="home-hub__summary" aria-label="훈련 기록 분석">
        <SummaryRow label="훈련 기록 살펴보기" detail={model.analysisSummary} onClick={onOpenTrends} />
      </section>}

      {installSuggestion}

      <nav className="home-hub__explore" aria-label="훈련 도움말과 일지 꾸미기">
        {onOpenContent && <button type="button" onClick={onOpenContent}><BookOpen aria-hidden="true" size={18} /><span>훈련 배우기</span></button>}
        {onOpenRewards && <button type="button" onClick={onOpenRewards}><NotebookPen aria-hidden="true" size={18} /><span>일지 꾸미기</span></button>}
      </nav>
    </div>
  )
}

function WelcomeToday({ model, onWriteLog, onOpenPlan, onOpenGuide }: { model: TrainingHomeViewModel; onWriteLog?: (entryType?: LogEntryType) => void; onOpenPlan?: () => void; onOpenGuide?: () => void }) {
  return <section className="home-hub__today home-hub__today--welcome" aria-labelledby="home-hub-today">
    <div id="home-hub-today" className="home-hub__section-label">오늘</div>
    <p>{model.todayMessage}</p>
    <nav aria-label="오늘 기록 또는 계획 만들기">
    <button className="home-hub__primary" type="button" onClick={() => onWriteLog?.("quick-session")}><PencilLine aria-hidden="true" size={19} /><span>오늘 기록 남기기</span><ChevronRight aria-hidden="true" size={18} /></button>
    <button className="home-hub__text-action" type="button" onClick={onOpenPlan}>훈련 계획 만들기<ChevronRight aria-hidden="true" size={17} /></button>
    {onOpenGuide && <button className="home-hub__text-action" type="button" onClick={onOpenGuide}>일지 예시 보기<ChevronRight aria-hidden="true" size={17} /></button>}
    </nav>
  </section>
}

function NextTrainingCard({ next, onOpen }: { next: NonNullable<TrainingHomeViewModel["nextTraining"]>; onOpen?: () => void }) {
  const later = next.laterSameDaySession
  const accessibleName = `다음 훈련 · ${sessionLabel(next.session)} · ${nextTrainingDateLabel(next.date)} · ${sessionSlotLabel(next.session.slot)} · ${nextTrainingPrescriptionLabel(next.session)}${later === null ? "" : ` · 같은 날 ${sessionSlotLabel(later.slot)} ${sessionLabel(later)}도 예정`}`
  return <section className="home-hub__next" aria-labelledby="home-hub-next">
    <div id="home-hub-next" className="home-hub__section-label">다음 훈련</div>
    <button className="home-hub__next-card" type="button" onClick={onOpen} aria-label={accessibleName}>
      <span><strong>{sessionLabel(next.session)}</strong><small><span>{nextTrainingDateLabel(next.date)}</span><span>{sessionSlotLabel(next.session.slot)}</span><span>{nextTrainingPrescriptionLabel(next.session)}</span></small>{later !== null && <small>같은 날 {sessionSlotLabel(later.slot)} · {sessionLabel(later)}도 예정</small>}</span>
      <ChevronRight aria-hidden="true" size={19} />
    </button>
  </section>
}

function TodaySection({ model, onWriteLog, onOpenToday, todayContext }: { model: TrainingHomeViewModel; onWriteLog?: (entryType?: LogEntryType) => void; onOpenToday?: () => void; todayContext?: ReactNode }) {
  return <section className="home-hub__today" aria-labelledby="home-hub-today">
    <div id="home-hub-today" className="home-hub__section-label">오늘</div>
    {model.todayRecordCount > 0 ? <div className="home-hub__today-complete">
      <div className="home-hub__status"><CheckCircle2 aria-hidden="true" size={21} /><span><strong>오늘 기록을 남겼어요.</strong><small>오늘 남긴 기록 {model.todayRecordCount}개</small></span></div>
      {model.briefing !== "" && <p className="home-hub__briefing" aria-label="오늘 기록 요약">{model.briefing}</p>}
      <div className="home-hub__today-actions"><button className="home-hub__text-action" type="button" onClick={onOpenToday}>오늘 기록 보기<ChevronRight aria-hidden="true" size={17} /></button><button className="home-hub__text-action" type="button" onClick={() => onWriteLog?.()}>기록 더 남기기<ChevronRight aria-hidden="true" size={17} /></button></div>
    </div> : <><p>{model.todayMessage}</p><button className="home-hub__primary" type="button" onClick={() => onWriteLog?.("quick-session")}><PencilLine aria-hidden="true" size={19} /><span>오늘 기록하기</span><ChevronRight aria-hidden="true" size={18} /></button><button className="home-hub__text-action" type="button" onClick={() => onWriteLog?.("evening")}>하루 마무리 기록하기<ChevronRight aria-hidden="true" size={17} /></button>{todayContext && <InfoDisclosure title="기분·몸 상태·날씨 남기기">{todayContext}</InfoDisclosure>}{model.briefing !== "" && <p className="home-hub__briefing" aria-label="아침 브리핑">{model.briefing}</p>}</>}
  </section>
}

function SummaryRow({ label, detail, onClick }: { label: string; detail: string; onClick?: () => void }) {
  const descriptionId = useId()
  return <button className="home-hub__summary-row" type="button" onClick={onClick} aria-label={label} aria-describedby={descriptionId}><span className="home-hub__summary-copy"><strong>{label}</strong><small id={descriptionId}>{detail}</small></span><ChevronRight aria-hidden="true" size={18} /></button>
}

function nextTrainingDateLabel(iso: string): string {
  const [, month, day] = iso.split("-")
  const base = `${Number(month)}월 ${Number(day)}일`
  const today = new Date(); const target = new Date(`${iso}T00:00:00`); const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((target.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays === 0) return `오늘(${base})`; if (diffDays === 1) return `내일(${base})`; return base
}
