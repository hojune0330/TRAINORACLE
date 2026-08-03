import React from "react"
import { ChevronRight, X } from "lucide-react"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import { JournalPageNavigator } from "../../components/JournalPageNavigator"
import { decorationCatalogItem } from "../../domain/decoration-catalog"
import { MINJI_JOURNAL_PAGES, minjiDecorationState } from "./minji-journal-data"
import type { MinjiJournalPage } from "./minji-journal-data"

export function MinjiJournal({ onWriteLog }: { readonly onWriteLog?: () => void }) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const openerIndexRef = React.useRef<number | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    if (selectedIndex === null) return
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const appScrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    if (appScrollRegion !== null) appScrollRegion.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
  }, [selectedIndex])

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
        key={page.id}
        page={page}
        position={selectedIndex + 1}
        headingRef={headingRef}
        onClose={closePage}
        onPrevious={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined}
        onNext={selectedIndex < MINJI_JOURNAL_PAGES.length - 1 ? () => setSelectedIndex(selectedIndex + 1) : undefined}
        onWriteLog={onWriteLog}
      />
    )
  }

  return (
    <section className="minji-index" aria-labelledby="minji-index-title">
      <div className="minji-index__eyebrow">가상 기록 · 예시 꾸미기</div>
      <h1 id="minji-index-title">민지의 일지</h1>
      <p>처음의 짧은 기록부터, 쉬는 날과 다시 보는 날까지. 여섯 장의 예시를 펼쳐 보세요.</p>
      <MinjiIndexPreview />
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
            <span><strong>{page.title}</strong><small>{page.preview}</small></span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>
    </section>
  )
}

function MinjiIndexPreview() {
  const previewPages = MINJI_JOURNAL_PAGES.filter((_, index) => index === 0 || index === 3 || index === 5)
  return (
    <div className="minji-showcase-preview" aria-label="민지의 꾸며진 일지 미리보기">
      {previewPages.map((page) => (
        <DecoratedJournalPageFrame key={page.id} date={page.date} state={minjiDecorationState(page)}>
          <span>{page.when}</span>
          <strong>{page.title}</strong>
          <small>{page.mood} · {page.weather}</small>
        </DecoratedJournalPageFrame>
      ))}
    </div>
  )
}

type MinjiPageProps = {
  readonly page: MinjiJournalPage
  readonly position: number
  readonly headingRef: React.RefObject<HTMLHeadingElement>
  readonly onClose: () => void
  readonly onPrevious: (() => void) | undefined
  readonly onNext: (() => void) | undefined
  readonly onWriteLog: (() => void) | undefined
}

function MinjiPage({ page, position, headingRef, onClose, onPrevious, onNext, onWriteLog }: MinjiPageProps) {
  const [notationOpen, setNotationOpen] = React.useState(false)
  const [questionOpen, setQuestionOpen] = React.useState(false)
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
    <article className="minji-page" aria-labelledby="minji-page-title">
      <header className="minji-page__header">
        <div><span>가상 기록 · 예시 꾸미기</span><small>{position} / {MINJI_JOURNAL_PAGES.length}</small></div>
        <button type="button" onClick={onClose} aria-label="민지의 일지 닫기" title="닫기"><X aria-hidden="true" size={20} /></button>
      </header>
      <DecoratedJournalPageFrame date={page.date} state={state}>
        <div className="minji-page__body">
          <div className="minji-page__when">{page.date} · {page.when}</div>
          <h1 id="minji-page-title" ref={headingRef} tabIndex={-1}>{page.title}</h1>
          <div className="minji-page__vibe" aria-label="이날의 분위기">
            <span>기분 <strong>{page.mood}</strong></span>
            <span>몸 상태 <strong>{page.bodyCondition}</strong></span>
            <span>날씨 <strong>{page.weather}</strong></span>
          </div>
          <p className="minji-page__situation">{page.situation}</p>
          <blockquote>{page.quote}</blockquote>
          <ul aria-label="오늘 적은 기록">{page.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          {page.notation !== undefined && (
            <div className="minji-page__notation">
              <code>{page.notation.raw}</code>
              <p className="minji-page__notation-warning">민지의 가상 예시이며 따라 하는 훈련계획이 아니에요.</p>
              <button type="button" aria-expanded={notationOpen} aria-controls={`minji-notation-${page.id}`} onClick={() => setNotationOpen((open) => !open)}>훈련 표시 쉽게 보기</button>
              {notationOpen && <div id={`minji-notation-${page.id}`}>{page.notation.lines.map((line) => <p key={line}>{line}</p>)}</div>}
            </div>
          )}
          <section className="minji-page__decorations" aria-labelledby={`minji-decorations-${page.id}`}>
            <h2 id={`minji-decorations-${page.id}`}>이 페이지에 쓴 꾸미기</h2>
            <p>{page.decorationPreset.name}</p>
            <div>{decorationNames.map((name) => <span key={name}>{name}</span>)}</div>
          </section>
          <section className="minji-page__discovery" aria-label="나중에 보인 것">
            <strong>나중에 보인 것</strong><p>{page.discovery}</p>
            {page.supportingText !== undefined && <small>{page.supportingText}</small>}
            {page.caution !== undefined && <small>{page.caution}</small>}
          </section>
          {page.question !== undefined && (
            <div className="minji-page__question">
              <button type="button" aria-expanded={questionOpen} onClick={() => setQuestionOpen((open) => !open)}>{page.question.label}</button>
              {questionOpen && <p>{page.question.answer}</p>}
            </div>
          )}
        </div>
      </DecoratedJournalPageFrame>
      <JournalPageNavigator position={position} total={MINJI_JOURNAL_PAGES.length} onPrevious={onPrevious} onNext={onNext} />
      {onNext === undefined && <button type="button" className="minji-page__write" onClick={onWriteLog}>내 첫 페이지 적기</button>}
    </article>
  )
}
