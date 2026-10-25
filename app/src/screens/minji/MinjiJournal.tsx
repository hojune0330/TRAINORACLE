import React from "react"
import { ChevronRight, Palette, PenLine, X } from "lucide-react"
import { AppHeading } from "../../components/AppHeading"
import { JournalShareTool } from "../../components/JournalShareTool"
import type { JournalShareCard } from "../../domain/journal-share-card"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import { JournalPageNavigator } from "../../components/JournalPageNavigator"
import { decorationCatalogItem } from "../../domain/decoration-catalog"
import { useActiveContentScroll } from "../../hooks/useActiveContentScroll"
import { useJournalPageTurn } from "../../hooks/useJournalPageTurn"
import { MINJI_JOURNAL_PAGES, minjiDecorationState } from "./minji-journal-data"
import type { MinjiJournalPage } from "./minji-journal-data"

export function MinjiJournal({ onWriteLog, onOpenDecorations }: { readonly onWriteLog?: () => void; readonly onOpenDecorations?: () => void }) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const openerIndexRef = React.useRef<number | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  const closePage = React.useCallback(() => {
    setSelectedIndex(null)
    window.setTimeout(() => {
      const index = openerIndexRef.current
      if (index === null) return
      document.querySelector<HTMLButtonElement>(`[data-minji-index="${index}"]`)?.focus()
    }, 0)
  }, [])

  React.useEffect(() => {
    if (selectedIndex === null) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePage()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [closePage, selectedIndex])

  if (selectedIndex !== null) {
    const page = MINJI_JOURNAL_PAGES[selectedIndex]
    if (page === undefined) return null
    return (
      <MinjiPage
        page={page}
        position={selectedIndex + 1}
        headingRef={headingRef}
        onClose={closePage}
        onPrevious={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined}
        onNext={selectedIndex < MINJI_JOURNAL_PAGES.length - 1 ? () => setSelectedIndex(selectedIndex + 1) : undefined}
        onWriteLog={onWriteLog}
        onOpenDecorations={onOpenDecorations}
      />
    )
  }

  return (
    <section className="minji-index" aria-labelledby="minji-index-title">
      <div className="minji-index__eyebrow">가상 기록 · 예시 꾸미기</div>
      <AppHeading id="minji-index-title">민지의 일지</AppHeading>
      <p>짧게 남긴 오늘도, 간직하고 싶은 한 장이 돼요.</p>
      <JournalShareTool card={exampleShareCard(MINJI_JOURNAL_PAGES[0]!)} label="예시 꾸미고 공유해 보기" showPreview
        primaryAction={onWriteLog && <button type="button" className="minji-primary" onClick={onWriteLog}><PenLine size={18} aria-hidden="true" />내 일지 쓰기</button>} />
      <DecorationGuide onOpenDecorations={onOpenDecorations} />
      <AppHeading as="h2" variant="section">다른 날은 어떻게 적었을까?</AppHeading>
      <div className="minji-index__stack" aria-label="민지의 예시 일지 목록">
        {MINJI_JOURNAL_PAGES.map((page, index) => (
          <button
            key={page.id}
            type="button"
            data-minji-index={index}
            onClick={() => {
              openerIndexRef.current = index
              setSelectedIndex(index)
            }}
          >
            <span className="minji-index__when">{page.when}</span>
            <span className="minji-index__copy">
              <strong>{page.title}</strong>
            </span>
            <MinjiIndexDecorationThumbnail page={page} />
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>
    </section>
  )
}

export function MinjiIndexDecorationThumbnail({ page }: { readonly page: MinjiJournalPage }) {
  const itemId = page.decorationPreset.placements[0]?.itemId ?? page.decorationPreset.themeId
  const item = decorationCatalogItem(itemId)
  if (item === undefined) return null
  return (
    <span className="minji-index__decoration" aria-label={`${item.name} 꾸미기`}>
      {item.category === "EMOJI_STICKER" && item.emoji !== undefined ? (
        <span className="minji-index__emoji" aria-hidden="true">{item.emoji}</span>
      ) : (
        <img src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" loading="lazy" />
      )}
    </span>
  )
}

function exampleShareCard(page: MinjiJournalPage): JournalShareCard {
  return { example: true, date: page.date, title: "오늘을 남긴 한 페이지", source: "민지의 가상 일지 · 실제 기록 아님", metrics: page.id === "DAY_ONE"
    ? [{ label: "거리", value: "4.6 km" }, { label: "시간", value: "30분" }]
    : [{ label: "일지", value: "한 페이지" }] }
}

function DecorationGuide({ onOpenDecorations }: { readonly onOpenDecorations?: () => void }) {
  return <details className="minji-decoration-guide">
    <summary><Palette size={18} aria-hidden="true" />내 일지도 이렇게 꾸밀 수 있나요?</summary>
    <ol><li>일지를 저장하고 <strong>꾸미기</strong>를 열어요.</li><li>종이·그림·글 스티커를 고르고, 끌어서 위치와 크기를 바꿔요.</li><li><strong>공유 카드 만들기</strong>에서는 숫자만 골라 담은 이미지를 저장해요.</li></ol>
    <p>일지 꾸미기와 공유 카드 꾸미기는 별개예요. 예시를 바꿔도 내 일지나 포인트는 바뀌지 않아요. 일부 재료는 포인트가 필요해요.</p>
    {onOpenDecorations && <button type="button" onClick={onOpenDecorations}><Palette size={18} aria-hidden="true" />내 꾸미기 열기</button>}
  </details>
}

type MinjiPageProps = {
  readonly page: MinjiJournalPage
  readonly position: number
  readonly headingRef: React.RefObject<HTMLHeadingElement>
  readonly onClose: () => void
  readonly onPrevious: (() => void) | undefined
  readonly onNext: (() => void) | undefined
  readonly onWriteLog: (() => void) | undefined
  readonly onOpenDecorations: (() => void) | undefined
}

function MinjiPage({ page, position, headingRef, onClose, onPrevious, onNext, onWriteLog, onOpenDecorations }: MinjiPageProps) {
  const [openNotationPageId, setOpenNotationPageId] = React.useState<MinjiJournalPage["id"] | null>(null)
  const [openQuestionPageId, setOpenQuestionPageId] = React.useState<MinjiJournalPage["id"] | null>(null)
  const paperTopRef = React.useRef<HTMLElement>(null)
  const notationOpen = openNotationPageId === page.id
  const questionOpen = openQuestionPageId === page.id
  const pageTurn = useJournalPageTurn({ onPrevious, onNext })
  useActiveContentScroll(page.id, paperTopRef, headingRef)

  React.useEffect(() => {
    setOpenNotationPageId(null)
    setOpenQuestionPageId(null)
  }, [page.id])

  const state = minjiDecorationState(page)
  const decorationNames = [
    state.equipped.themeId,
    state.equipped.inkId,
    ...page.decorationPreset.placements.map((placement) => placement.itemId),
    ...(state.equipped.avatarId === null ? [] : [state.equipped.avatarId]),
  ].flatMap((id) => {
    const item = decorationCatalogItem(id)
    return item === undefined ? [] : [item.name]
  })

  return (
    <article
      className="minji-page journal-page-turn-surface"
      aria-labelledby="minji-page-title"
      aria-roledescription="좌우로 넘길 수 있는 예시 일지"
      data-page-turn-direction={pageTurn.direction}
      data-swipe-active={pageTurn.isDragging ? "true" : undefined}
      style={{ "--journal-swipe-offset": `${pageTurn.dragOffset}px` } as React.CSSProperties}
      {...pageTurn.touchHandlers}
    >
      <header className="minji-page__header">
        <div><span>가상 기록 · 예시 꾸미기</span><small>{position} / {MINJI_JOURNAL_PAGES.length}</small></div>
        <button type="button" onClick={onClose} aria-label="민지의 일지 닫기" title="닫기"><X aria-hidden="true" size={14} /></button>
      </header>
      <DecoratedJournalPageFrame date={page.date} state={state} frameTopRef={paperTopRef}>
        <div className="minji-page__body">
          <div className="minji-page__when">{page.date} · {page.when}</div>
          <h1 id="minji-page-title" ref={headingRef} tabIndex={-1}>{page.title}</h1>
          <ul aria-label="오늘 적은 기록">{page.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          <blockquote>{page.quote}</blockquote>
          <details className="minji-page__context"><summary>그날의 기분과 상황</summary><div className="minji-page__vibe" aria-label="기분, 몸 상태, 날씨">
            <span>기분 <strong>{page.mood}</strong></span>
            <span>몸 상태 <strong>{page.bodyCondition}</strong></span>
            <span>날씨 <strong>{page.weather}</strong></span>
          </div>
          <p className="minji-page__situation">{page.situation}</p></details>
          {page.notation !== undefined && (
            <div className="minji-page__notation">
              <code>{page.notation.raw}</code>
              <p className="minji-page__notation-warning">민지의 가상 예시이며 따라 하는 훈련계획이 아니에요.</p>
              <button type="button" aria-expanded={notationOpen} aria-controls={`minji-notation-${page.id}`} onClick={() => setOpenNotationPageId((openPageId) => openPageId === page.id ? null : page.id)}>훈련 표시 쉽게 보기</button>
              {notationOpen && <div id={`minji-notation-${page.id}`}>{page.notation.lines.map((line) => <p key={line}>{line}</p>)}</div>}
            </div>
          )}
          <details className="minji-page__decorations">
            <summary>이 페이지에 쓴 꾸미기</summary>
            <p>{page.decorationPreset.name}</p>
            <div>{decorationNames.map((name) => <span key={name}>{name}</span>)}</div>
          </details>
          <section className="minji-page__discovery" aria-label="기록에서 확인한 점">
            <strong>기록에서 확인한 점</strong><p>{page.discovery}</p>
            {page.supportingText !== undefined && <small>{page.supportingText}</small>}
            {page.caution !== undefined && <small>{page.caution}</small>}
          </section>
          {page.question !== undefined && (
            <div className="minji-page__question">
              <button type="button" aria-expanded={questionOpen} onClick={() => setOpenQuestionPageId((openPageId) => openPageId === page.id ? null : page.id)}>{page.question.label}</button>
              {questionOpen && <p>{page.question.answer}</p>}
            </div>
          )}
        </div>
      </DecoratedJournalPageFrame>
      <JournalPageNavigator
        position={position}
        total={MINJI_JOURNAL_PAGES.length}
        onPrevious={onPrevious === undefined ? undefined : pageTurn.goPrevious}
        onNext={onNext === undefined ? undefined : pageTurn.goNext}
      />
      <div className="minji-page__next-actions">
        {onWriteLog && <button type="button" className="minji-primary" onClick={onWriteLog}><PenLine size={18} aria-hidden="true" />내 일지 쓰기</button>}
        <JournalShareTool key={page.id} card={exampleShareCard(page)} label="이 예시로 공유 카드 만들기" />
        <DecorationGuide onOpenDecorations={onOpenDecorations} />
      </div>
    </article>
  )
}
