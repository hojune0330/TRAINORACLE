import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import type { DecorationPlacementTransform, DecorationSlot, DecorationState } from "../../domain/decorations"

export function DecorationStudioPreview({
  date,
  today,
  state,
  previewName,
  hasEntries,
  onPreviousDate,
  onNextDate,
  onToday,
  editable = false,
  selectedSlot = null,
  motionDirection = "STAY",
  onSelectPlacement,
  onTransformPlacement,
}: {
  readonly date: string
  readonly today: string
  readonly state: DecorationState
  readonly previewName: string | null
  readonly hasEntries?: boolean
  readonly onPreviousDate?: () => void
  readonly onNextDate?: () => void
  readonly onToday?: () => void
  readonly editable?: boolean
  readonly selectedSlot?: DecorationSlot | null
  readonly motionDirection?: "BACKWARD" | "FORWARD" | "STAY"
  readonly onSelectPlacement?: (slot: DecorationSlot) => void
  readonly onTransformPlacement?: (slot: DecorationSlot, transform: DecorationPlacementTransform) => void
}) {
  return (
    <section className="decoration-studio-preview" role="region" aria-label="꾸미기 미리보기">
      <header>
        <span>꾸밀 날짜</span>
        <strong data-testid="decoration-date-current">{date}</strong>
        <strong>{previewName === null ? "현재 꾸미기" : `${previewName} 미리보기 중`}</strong>
      </header>
      {/* 감사 F5: 저장 가능 여부를 실패 후가 아니라 날짜 이동 시점에 미리 알려 준다. */}
      {hasEntries !== undefined && (
        <p
          className={`decoration-studio-preview__day-state${hasEntries ? "" : " decoration-studio-preview__day-state--empty"}`}
          data-testid="decoration-date-state"
        >
          {hasEntries
            ? "기록이 있는 날 · 스티커·도장·테이프를 저장할 수 있어요"
            : "기록이 없는 날 · 미리보기만 돼요"}
        </p>
      )}
      {onPreviousDate !== undefined && onNextDate !== undefined && onToday !== undefined && (
        <div className="decoration-studio-preview__targets" aria-label="꾸밀 날짜 선택">
          <button type="button" data-testid="decoration-date-previous" onClick={onPreviousDate}>이전 날짜</button>
          <button type="button" data-testid="decoration-date-today" aria-pressed={date === today} onClick={onToday}>오늘</button>
          <button type="button" data-testid="decoration-date-next" onClick={onNextDate}>다음 날짜</button>
        </div>
      )}
      <div
        key={date}
        className="decoration-studio-preview__canvas"
        data-motion-direction={motionDirection}
      >
        <DecoratedJournalPageFrame
          date={date}
          state={state}
          editable={editable}
          selectedSlot={selectedSlot}
          onSelectPlacement={onSelectPlacement}
          onTransformPlacement={onTransformPlacement}
        >
          <article className="decoration-studio-preview__page">
            <small>{date === today ? "오늘" : "선택한 날짜"}</small>
            <h3>{date === today ? "오늘의 훈련 일지" : "선택한 날짜의 훈련 일지"}</h3>
            <p>내 기록은 그대로 두고, 꾸미기만 먼저 시험해 봐요.</p>
            <div>
              <span>기분 · 차분함</span>
              <span>날씨 · 맑음</span>
            </div>
          </article>
        </DecoratedJournalPageFrame>
      </div>
    </section>
  )
}
