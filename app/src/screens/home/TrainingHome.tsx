import { ChevronRight, Ellipsis, PencilLine } from "lucide-react"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import type { JournalEntryType } from "../log-entry/shared"

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenArchive?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
}

export function TrainingHome({
  model,
  onWriteLog,
  onOpenArchive,
  onOpenPlan,
  onOpenTrends,
  onOpenMore,
}: TrainingHomeProps) {
  return (
    <>
      <header className="training-home__header">
        <div className="training-home__brand">TRAINORACLE</div>
        <button className="training-home__more" type="button" onClick={onOpenMore} aria-label="더보기" title="더보기">
          <Ellipsis aria-hidden="true" size={21} />
        </button>
      </header>

      <section className="training-home__intro" aria-labelledby="training-home-title">
        <h1 id="training-home-title">내 기록</h1>
        <p>오늘을 남기고, 필요할 때 훈련을 더 자세히 봐요.</p>
      </section>

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
        {model.briefing !== "" && (
          <p className="training-home__briefing" aria-label="아침 브리핑">{model.briefing}</p>
        )}
      </section>

      <nav className="training-home__services" aria-label="내 기록 살펴보기">
        <ServiceRow label="내 일지" detail={`${model.journalSummary} · 달력 · 9.5일 · 하루 기록`} onClick={onOpenArchive} />
        <ServiceRow label="훈련 계획" detail={model.planSummary} onClick={onOpenPlan} />
        <ServiceRow label="분석" detail={model.analysisSummary} onClick={onOpenTrends} />
      </nav>
    </>
  )
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
