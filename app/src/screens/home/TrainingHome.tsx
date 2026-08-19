import { CalendarPlus, ChevronRight, Ellipsis, PencilLine } from "lucide-react"
import type { ReactNode } from "react"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { prescriptionLabel, sessionLabel, sessionSlotLabel } from "../plan-beta/labels"
import type { JournalEntryType } from "../log-entry/shared"

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
  readonly todayContext?: ReactNode
  readonly recentJournal?: ReactNode
}

export function TrainingHome({
  model,
  onWriteLog,
  onOpenArchive,
  onOpenGuide,
  onOpenPlan,
  onOpenTrends,
  onOpenMore,
  todayContext,
  recentJournal,
}: TrainingHomeProps) {
  const laterSameDaySession = model.nextTraining?.laterSameDaySession ?? null
  const nextTrainingSection = model.nextTraining === null ? null : (
    <section className="training-home__next" aria-labelledby="training-home-next">
      <div id="training-home-next" className="training-home__label">다음 훈련</div>
      <button
        className="training-home__next-button"
        type="button"
        onClick={onOpenPlan}
        aria-label={`다음 훈련 · ${sessionLabel(model.nextTraining.session)} · ${nextTrainingDateLabel(model.nextTraining.date)} · ${sessionSlotLabel(model.nextTraining.session.slot)} · ${prescriptionLabel(model.nextTraining.session)}${laterSameDaySession === null ? "" : ` · 같은 날 ${sessionSlotLabel(laterSameDaySession.slot)} ${sessionLabel(laterSameDaySession)}도 예정`}`}
      >
        <span>
          <strong>{sessionLabel(model.nextTraining.session)}</strong>
          <small>
            {nextTrainingDateLabel(model.nextTraining.date)} · {sessionSlotLabel(model.nextTraining.session.slot)} · {prescriptionLabel(model.nextTraining.session)}
          </small>
          {laterSameDaySession !== null && (
            <small className="training-home__next-follow-up">
              같은 날 {sessionSlotLabel(laterSameDaySession.slot)} · {sessionLabel(laterSameDaySession)}도 예정
            </small>
          )}
        </span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </section>
  )
  const todaySection = (
    <section className="training-home__today" aria-labelledby="training-home-today">
      <div id="training-home-today" className="training-home__label">오늘</div>
      <p>{model.todayMessage}</p>
      <button className="training-home__primary" type="button" onClick={() => onWriteLog?.("post-session")}>
        <PencilLine aria-hidden="true" size={19} />
        <span>오늘 기록하기</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button
        className="training-home__rest-entry"
        type="button"
        onClick={() => onWriteLog?.("evening")}
      >
        하루 마무리 기록하기
      </button>
      {todayContext}
      {model.briefing !== "" && (
        <p className="training-home__briefing" aria-label="아침 브리핑">{model.briefing}</p>
      )}
    </section>
  )

  return (
    <>
      <div className={model.homeMode === "WELCOME" ? "training-home__welcome-fold" : undefined}>
        <header className="training-home__header">
          <div className="training-home__brand">TRAINORACLE</div>
          <button className="training-home__more" type="button" onClick={onOpenMore} aria-label="더보기" title="더보기">
            <Ellipsis aria-hidden="true" size={21} />
          </button>
        </header>

        <section className="training-home__intro" aria-labelledby="training-home-title">
          {model.homeMode === "WELCOME" ? (
            <>
              <h1 id="training-home-title" className="training-home__welcome-title">
                <span className="training-home__welcome-title-phrase">달리기 일지를</span>{" "}
                <span className="training-home__welcome-title-phrase">남기고,</span>{" "}
                <span className="training-home__welcome-title-phrase">내 기록으로</span>{" "}
                <span className="training-home__welcome-title-phrase">훈련 계획을 받아요.</span>
              </h1>
              <p className="training-home__trust">모든 데이터는 이 기기에만 저장돼요.</p>
            </>
          ) : (
            <>
              <h1 id="training-home-title">내 기록</h1>
              <p>오늘을 남기고, 필요할 때 훈련을 더 자세히 봐요.</p>
            </>
          )}
        </section>

        {model.homeMode === "WELCOME" && (
          <>
            <div className="training-home__welcome-actions">
              <button className="training-home__primary" type="button" onClick={() => onWriteLog?.("post-session")}>
                <PencilLine aria-hidden="true" size={19} />
                <span>오늘 기록 남기기</span>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
              <button className="training-home__primary" type="button" onClick={onOpenPlan}>
                <CalendarPlus aria-hidden="true" size={19} />
                <span>훈련 계획 만들기</span>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
            <section
              className="training-home__example training-home__example--welcome"
              aria-labelledby="training-home-example"
            >
              <div id="training-home-example" className="training-home__label">이렇게 쓰여요</div>
              <button type="button" onClick={onOpenGuide}>
                <strong>민지의 예시 일지 보기</strong>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </section>
          </>
        )}
      </div>

      {model.homeMode === "TRAINING" && nextTrainingSection}
      {model.homeMode !== "WELCOME" && todaySection}
      {model.homeMode === "JOURNAL" && nextTrainingSection}
      {model.homeMode !== "WELCOME" && recentJournal}

      <nav className="training-home__services" aria-label="내 기록 살펴보기">
        <ServiceRow label="내 일지" detail={`${model.journalSummary} · 달력 · 9.5일 · 하루 기록`} onClick={onOpenArchive} />
        <ServiceRow label="훈련 계획" detail={model.planSummary} onClick={onOpenPlan} />
        <ServiceRow label="분석" detail={model.analysisSummary} onClick={onOpenTrends} />
      </nav>
    </>
  )
}

function nextTrainingDateLabel(iso: string): string {
  const [, month, day] = iso.split("-")
  return `${Number(month)}월 ${Number(day)}일`
}

function ServiceRow({ label, detail, onClick }: {
  readonly label: string
  readonly detail: string
  readonly onClick?: () => void
}) {
  return (
    <button className="training-home__service" type="button" onClick={onClick}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </button>
  )
}
