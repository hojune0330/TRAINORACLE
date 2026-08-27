import { Palette, X } from "lucide-react"
import React from "react"
import { loadDecorationState, readDecorationStateSerialized } from "../../domain/decorations"
import { loadEntries, todayISO } from "../../domain/journal-store"
import { DecorationStudio } from "./DecorationStudio"
import { DecorationStudioPreview } from "./DecorationStudioPreview"

export function DecorationShop({
  earnedPoints,
  hasEntriesForDate: hasEntriesForDateProp,
  showPreview = true,
  onSpentPointsChange,
}: {
  readonly earnedPoints: number
  readonly hasEntriesForDate?: (date: string) => boolean
  readonly showPreview?: boolean
  readonly onSpentPointsChange?: (spentPoints: number) => void
}) {
  const [state, setState] = React.useState(loadDecorationState)
  const [storageVersion, setStorageVersion] = React.useState(() => readDecorationStateSerialized())
  const [open, setOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [selectedDate, setSelectedDate] = React.useState(todayISO)
  const available = Math.max(0, earnedPoints - state.spentPoints)
  const today = todayISO()
  const isCompact = !open && !showPreview
  const defaultHasEntriesForDate = React.useCallback((date: string) => loadEntries().some((entry) => entry.date === date), [])
  const hasEntriesForDate = hasEntriesForDateProp ?? defaultHasEntriesForDate

  React.useEffect(() => {
    onSpentPointsChange?.(state.spentPoints)
  }, [onSpentPointsChange, state.spentPoints])

  const close = () => {
    setOpen(false)
    setNotice(null)
  }

  return (
    <section className="decoration-shop" aria-labelledby="decoration-shop-title">
      <header className={`decoration-shop__header${isCompact ? " decoration-shop__header--compact" : ""}`}>
        <span>
          <small>{open ? "꾸미기" : showPreview ? "보기" : "첫 기록 뒤 시작"}</small>
          <h3 id="decoration-shop-title">일지 꾸미기 · 사용 가능 {available}P</h3>
        </span>
        {open ? (
          <button type="button" onClick={close} aria-label="꾸미기 닫기" title="꾸미기 닫기">
            <X aria-hidden="true" size={18} />
          </button>
        ) : (
          <button type="button" onClick={() => setOpen(true)} aria-label="꾸미기 열기">
            <Palette aria-hidden="true" size={18} />
            꾸미기
          </button>
        )}
      </header>
      {(open || showPreview) && <p>베타 포인트는 꾸미기에만 써요. 현금으로 바꾸거나 다른 사람에게 보낼 수 없어요.</p>}
      {/*
        * 알림은 스튜디오(긴 목록) 위에 sticky 로 둔다.
        * 감사 F4: 목록 아래에 있으면 받기·사용 결과가 화면 밖에 렌더링돼 보이지 않았다.
        * 주의: 항상 렌더링하면 role="status" 가 저장 토스트와 겹쳐
        * Motion 계약 테스트(getByRole("status"))가 깨진다 — 조건부 렌더링 유지.
        */}
      {notice !== null && (
        <p role="status" aria-live="polite" className="decoration-shop__notice">
          {notice}
        </p>
      )}
      {open ? (
        <DecorationStudio
          date={selectedDate}
          today={today}
          earnedPoints={earnedPoints}
          state={state}
          onStateChange={setState}
          onNotice={setNotice}
          onDateChange={setSelectedDate}
          expectedSerialized={storageVersion}
          onStorageVersionChange={setStorageVersion}
          hasEntriesForDate={hasEntriesForDate}
        />
      ) : showPreview ? (
        <DecorationStudioPreview date={selectedDate} today={today} state={state} previewName={null} />
      ) : null}
    </section>
  )
}
