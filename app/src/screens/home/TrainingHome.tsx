import { CalendarPlus, ChevronRight, Ellipsis, PencilLine } from "lucide-react"
import type { ReactNode } from "react"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { prescriptionLabel, sessionLabel, sessionSlotLabel } from "../plan-beta/labels"
import type { PlanSession } from "@impl/plan-generator/types"
import type { JournalEntryType } from "../log-entry/shared"

/** 홈 "다음 훈련" 카드용 축약 처방 라벨 — "거리·목표 페이스는 지정하지 않음" 같은
 * 저가치 단서는 카드에서 생략한다 (상세는 훈련 계획 화면에서 확인). */
export function nextTrainingPrescriptionLabel(session: PlanSession): string {
  return prescriptionLabel(session).replace(/\s*·\s*거리⁠·⁠목표\s페이스는 지정하지 않음$/u, "")
}

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
  /** 헤더 우측 계정 진입 버튼 슬롯 — 로그인 발견성 개선(2026-08-27). 계정 기능 OFF면 null. */
  readonly accountEntry?: ReactNode
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
  accountEntry,
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
        aria-label={`다음 훈련 · ${sessionLabel(model.nextTraining.session)} · ${nextTrainingDateLabel(model.nextTraining.date)} · ${sessionSlotLabel(model.nextTraining.session.slot)} · ${nextTrainingPrescriptionLabel(model.nextTraining.session)}${laterSameDaySession === null ? "" : ` · 같은 날 ${sessionSlotLabel(laterSameDaySession.slot)} ${sessionLabel(laterSameDaySession)}도 예정`}`}
      >
        <span>
          <strong>{sessionLabel(model.nextTraining.session)}</strong>
          <small>
            {nextTrainingDateLabel(model.nextTraining.date)} · {sessionSlotLabel(model.nextTraining.session.slot)} · {nextTrainingPrescriptionLabel(model.nextTraining.session)}
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
          <div className="training-home__header-actions">
            {accountEntry}
            <button className="training-home__more" type="button" onClick={onOpenMore} aria-label="더보기" title="더보기">
              <Ellipsis aria-hidden="true" size={21} />
            </button>
          </div>
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
              <h1 id="training-home-title">{model.homeMode === "TRAINING" ? "오늘의 훈련" : "내 기록"}</h1>
              <p>{model.homeMode === "TRAINING" ? "계획된 훈련을 확인하고, 오늘의 상태를 남겨요." : "오늘을 남기고, 필요할 때 훈련을 더 자세히 봐요."}</p>
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
              {/* 최종 폴리시 D1: 한 화면 한 주행동. "일지 먼저" 철학에 따라
               * 기록 CTA만 필 프라이머리, 계획 CTA는 아웃라인 세컨더리로 위계를 준다. */}
              <button className="training-home__secondary" type="button" onClick={onOpenPlan}>
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
      {model.homeMode !== "WELCOME" && recentJournal}

      <nav className="training-home__services" aria-label="내 기록 살펴보기">
        <ServiceRow label="내 일지" detail={`${model.journalSummary} · 달력 · 하루 기록`} onClick={onOpenArchive} />
        <ServiceRow label="훈련 계획" detail={model.planSummary} onClick={onOpenPlan} />
        <ServiceRow label="분석" detail={model.analysisSummary} onClick={onOpenTrends} />
      </nav>
    </>
  )
}

function nextTrainingDateLabel(iso: string): string {
  const [, month, day] = iso.split("-")
  const base = `${Number(month)}월 ${Number(day)}일`
  const today = new Date()
  const target = new Date(`${iso}T00:00:00`)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((target.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays === 0) return `오늘(${base})`
  if (diffDays === 1) return `내일(${base})`
  return base
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
