import { ChevronRight, Ellipsis, PencilLine } from "lucide-react"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: () => void
  readonly onOpenArchive?: () => void
  readonly onOpenCycle?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
}

export function TrainingHome({
  model,
  onWriteLog,
  onOpenArchive,
  onOpenCycle,
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
        <h1 id="training-home-title">내 훈련</h1>
        <p>기록이 계획으로 이어지는 훈련 일지</p>
      </section>

      <section className="training-home__today" aria-labelledby="training-home-today">
        <div id="training-home-today" className="training-home__label">오늘</div>
        <p>{model.todayMessage}</p>
        <button className="training-home__primary" type="button" onClick={() => onWriteLog?.()}>
          <PencilLine aria-hidden="true" size={19} />
          <span>오늘 기록하기</span>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
        <small className="training-home__rest-note">쉰 날도 짧게 기록할 수 있어요.</small>
      </section>

      <nav className="training-home__services" aria-label="내 훈련 서비스">
        <ServiceRow label="내 일지" detail={model.journalSummary} onClick={onOpenArchive} />
        <ServiceRow label="훈련 흐름" detail={model.flowSummary} onClick={onOpenCycle} />
        <ServiceRow label="훈련계획" detail={model.planSummary} onClick={onOpenPlan} />
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
