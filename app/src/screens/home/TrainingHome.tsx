import { BookOpen, CalendarPlus, ChartNoAxesCombined, CheckCircle2, ChevronRight, Ellipsis, NotebookPen, PencilLine, Plus } from "lucide-react"
import type { ReactNode } from "react"
import type { TrainingHomeViewModel } from "../../domain/home-view-model"
import { prescriptionLabel, sessionLabel, sessionSlotLabel } from "../plan-beta/labels"
import type { PlanSession } from "@impl/plan-generator/types"
import type { AdjustedCandidateSession } from "../../domain/adjusted-plan-candidate"
import { deriveSequenceTotals } from "@impl/prescription/sequence"
import type { LogEntryType } from "../log-entry/shared"
import { decorationCatalogItem } from "../../domain/decoration-catalog"
import { MINJI_JOURNAL_PAGES } from "../minji/minji-journal-data"
import { InfoDisclosure } from "../../components/InfoDisclosure"

const MINJI_HOME_PREVIEW = MINJI_JOURNAL_PAGES[0]
const MINJI_HOME_PREVIEW_DECORATION = MINJI_HOME_PREVIEW === undefined
  ? undefined
  : decorationCatalogItem(MINJI_HOME_PREVIEW.decorationPreset.placements[0]?.itemId ?? MINJI_HOME_PREVIEW.decorationPreset.themeId)

/** 홈 "다음 훈련" 카드용 축약 처방 라벨 — "거리·목표 페이스는 지정하지 않음" 같은
 * 저가치 단서는 카드에서 생략한다 (상세는 훈련 계획 화면에서 확인). */
export function nextTrainingPrescriptionLabel(session: import("../../domain/home-view-model").HomeSession): string {
  if (session.prescription.kind === "ADJUSTED_METHOD_V3") return "저장한 조정 구성 · 원본 확인"
  if (session.prescription.kind === "ADJUSTED_METHOD") {
    const totals = deriveSequenceTotals(session.prescription.snapshot.projection.sequence)
    return ["선택한 조정 구성",
      totals.totalRepetitions === null ? null : `본운동 ${totals.totalRepetitions}회`,
      totals.qualityDistanceM === null ? null : `${totals.qualityDistanceM}m`,
      "구간별 시간·회복 확인"].filter(Boolean).join(" · ")
  }
  return prescriptionLabel(session as PlanSession).replace(/\s*·\s*거리⁠·⁠목표\s페이스는 지정하지 않음$/u, "")
}

type TrainingHomeProps = {
  readonly model: TrainingHomeViewModel
  readonly onWriteLog?: (entryType?: LogEntryType) => void
  readonly onOpenArchive?: () => void
  readonly onOpenToday?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenTrends?: () => void
  readonly onOpenMore?: () => void
  readonly onOpenContent?: () => void
  /** 헤더 우측 계정 진입 버튼 슬롯 — 로그인 발견성 개선(2026-08-27). 계정 기능 OFF면 null. */
  readonly accountEntry?: ReactNode
  readonly todayContext?: ReactNode
  readonly recentJournal?: ReactNode
  readonly installSuggestion?: ReactNode
}

export function TrainingHome({
  model,
  onWriteLog,
  onOpenArchive,
  onOpenToday,
  onOpenGuide,
  onOpenPlan,
  onOpenTrends,
  onOpenMore,
  onOpenContent,
  accountEntry,
  todayContext,
  recentJournal,
  installSuggestion,
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
          <small className="training-home__next-meta">
            <span>{nextTrainingDateLabel(model.nextTraining.date)}</span>
            <span>{sessionSlotLabel(model.nextTraining.session.slot)}</span>
            <span>{nextTrainingPrescriptionLabel(model.nextTraining.session)}</span>
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
      {model.todayRecordCount > 0 ? (
        <div className="training-home__today-complete">
          <div className="training-home__today-complete-status">
            <CheckCircle2 aria-hidden="true" size={22} />
            <span>
              <strong>오늘 기록을 남겼어요.</strong>
              <small>오늘 남긴 기록 {model.todayRecordCount}개</small>
            </span>
          </div>
          {model.briefing !== "" && (
            <p className="training-home__briefing" aria-label="오늘 기록 요약">{model.briefing}</p>
          )}
          <div className="training-home__today-complete-actions">
            <button type="button" onClick={onOpenToday}>
              <span>오늘 기록 보기</span>
              <ChevronRight aria-hidden="true" size={17} />
            </button>
            <button type="button" onClick={() => onWriteLog?.()}>
              <Plus aria-hidden="true" size={16} />
              <span>기록 더 남기기</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <p>{model.todayMessage}</p>
          <button className="training-home__primary" type="button" onClick={() => onWriteLog?.("quick-session")}>
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
          {todayContext && <InfoDisclosure title="기분·몸 상태·날씨 남기기">{todayContext}</InfoDisclosure>}
          {model.briefing !== "" && (
            <p className="training-home__briefing" aria-label="아침 브리핑">{model.briefing}</p>
          )}
        </>
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
              <h1 id="training-home-title" className="training-home__welcome-title">오늘 운동을 기록해요</h1>
            </>
          ) : (
            <>
              <h1 id="training-home-title">{model.homeMode === "TRAINING" ? "오늘의 훈련" : "내 기록"}</h1>
            </>
          )}
        </section>

        {model.homeMode === "WELCOME" && (
          <>
            <div className="training-home__welcome-actions">
              <button className="training-home__primary" type="button" onClick={() => onWriteLog?.("quick-session")}>
                <PencilLine aria-hidden="true" size={19} />
                <span>오늘 기록 남기기</span>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          </>
        )}
        {model.homeMode === "TRAINING" && nextTrainingSection}
        {model.homeMode !== "WELCOME" && todaySection}
        <nav className="training-home__intents" aria-label="바로 시작하기">
          <button type="button" onClick={onOpenTrends}><ChartNoAxesCombined size={19} aria-hidden="true" /><span>내 훈련 분석</span></button>
          <button type="button" onClick={onOpenPlan}><CalendarPlus size={19} aria-hidden="true" /><span>훈련 계획 만들기</span></button>
          <button type="button" onClick={onOpenGuide}><NotebookPen size={19} aria-hidden="true" /><span>예시 훈련 보기</span></button>
          {onOpenContent && <button type="button" onClick={onOpenContent}><BookOpen size={19} aria-hidden="true" /><span>훈련 방법 배우기</span></button>}
        </nav>
        {model.homeMode === "WELCOME" && (
            <section
              className="training-home__example training-home__example--welcome"
              aria-labelledby="training-home-example"
            >
              <div id="training-home-example" className="training-home__label">일지 예시</div>
              <button type="button" onClick={onOpenGuide} aria-label="민지의 예시 일지 보기">
                {MINJI_HOME_PREVIEW !== undefined && (
                  <span className="training-home__example-preview" aria-hidden="true">
                    {MINJI_HOME_PREVIEW_DECORATION !== undefined
                      && MINJI_HOME_PREVIEW_DECORATION.category !== "EMOJI_STICKER" && (
                      <img
                        src={`${import.meta.env.BASE_URL}${MINJI_HOME_PREVIEW_DECORATION.assetPath}`}
                        alt=""
                        draggable="false"
                        loading="lazy"
                      />
                    )}
                    <small>{MINJI_HOME_PREVIEW.when}</small>
                    <strong>{MINJI_HOME_PREVIEW.title}</strong>
                    <span>{MINJI_HOME_PREVIEW.facts.slice(0, 2).join(" · ")}</span>
                  </span>
                )}
                <strong className="training-home__example-link">민지의 예시 일지 보기</strong>
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </section>
        )}
      </div>

      {model.homeMode !== "WELCOME" && recentJournal}

      {model.homeMode !== "WELCOME" && <nav className="training-home__services" aria-label="내 기록 살펴보기">
        <ServiceRow label="내 일지" detail={`${model.journalSummary} · 달력 · 하루 기록`} onClick={onOpenArchive} />
      </nav>}
      {installSuggestion}
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
