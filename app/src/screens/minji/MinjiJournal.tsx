import React from "react"
import { ArrowLeft, ArrowRight, ChevronRight, X } from "lucide-react"
import { MINJI_JOURNAL_PAGES } from "./minji-journal-data"
import type { MinjiJournalPage } from "./minji-journal-data"

export function MinjiJournal({ onWriteLog }: { readonly onWriteLog?: () => void }) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null)
  const [questionOpen, setQuestionOpen] = React.useState(false)
  const openerIndexRef = React.useRef<number | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    if (selectedIndex !== null) headingRef.current?.focus()
  }, [selectedIndex])

  const openPage = (index: number) => {
    openerIndexRef.current = index
    setQuestionOpen(false)
    setSelectedIndex(index)
  }
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
        pageNumber={selectedIndex + 1}
        headingRef={headingRef}
        questionOpen={questionOpen}
        onToggleQuestion={() => setQuestionOpen((open) => !open)}
        onClose={closePage}
        onPrevious={selectedIndex === 0 ? undefined : () => {
          setQuestionOpen(false)
          openerIndexRef.current = selectedIndex - 1
          setSelectedIndex(selectedIndex - 1)
        }}
        onNext={selectedIndex === MINJI_JOURNAL_PAGES.length - 1 ? undefined : () => {
          setQuestionOpen(false)
          openerIndexRef.current = selectedIndex + 1
          setSelectedIndex(selectedIndex + 1)
        }}
        onWriteLog={onWriteLog}
      />
    )
  }

  return (
    <section className="minji-index" aria-labelledby="minji-index-title">
      <div className="minji-index__eyebrow">가상의 기록 · 예시</div>
      <h1 id="minji-index-title">민지의 일지</h1>
      <p>처음에는 한 줄뿐이었어요. 그 한 줄이 쌓이면서 무엇이 보였는지 구경해 보세요.</p>
      <div className="minji-index__stack">
        {MINJI_JOURNAL_PAGES.map((page, index) => (
          <button key={page.id} type="button" data-minji-index={index} onClick={() => openPage(index)}>
            <span className="minji-index__when">{page.when}</span>
            <span><strong>{page.title}</strong><small>{page.preview}</small></span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>
    </section>
  )
}

type MinjiPageProps = {
  readonly page: MinjiJournalPage
  readonly pageNumber: number
  readonly headingRef: React.RefObject<HTMLHeadingElement>
  readonly questionOpen: boolean
  readonly onToggleQuestion: () => void
  readonly onClose: () => void
  readonly onPrevious?: () => void
  readonly onNext?: () => void
  readonly onWriteLog?: () => void
}

function MinjiPage({ page, pageNumber, headingRef, questionOpen, onToggleQuestion, onClose, onPrevious, onNext, onWriteLog }: MinjiPageProps) {
  const [notationOpen, setNotationOpen] = React.useState(false)
  return (
    <article className="minji-page" aria-labelledby="minji-page-title">
      <header className="minji-page__header">
        <div><span>민지의 일지 · 예시</span><small>{pageNumber} / {MINJI_JOURNAL_PAGES.length}</small></div>
        <button type="button" onClick={onClose} aria-label="민지의 일지 닫기" title="닫기"><X aria-hidden="true" size={20} /></button>
      </header>
      <div className="minji-page__body">
        <div className="minji-page__when">{page.when}</div>
        <h1 id="minji-page-title" ref={headingRef} tabIndex={-1}>{page.title}</h1>
        <p className="minji-page__situation">{page.situation}</p>
        <blockquote>{page.quote}</blockquote>
        <ul aria-label="함께 적은 기록">{page.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        {page.notation !== undefined && (
          <div className="minji-page__notation">
            <code>{page.notation.raw}</code>
            <p className="minji-page__notation-warning">민지의 가상 예시이며 따라 하는 훈련계획이 아니에요.</p>
            <button type="button" aria-expanded={notationOpen} aria-controls={`minji-notation-${page.id}`} onClick={() => setNotationOpen((open) => !open)}>훈련 표시 쉽게 보기</button>
            {notationOpen && <div id={`minji-notation-${page.id}`}>{page.notation.lines.map((line) => <p key={line}>{line}</p>)}</div>}
          </div>
        )}
        <section className="minji-page__discovery" aria-label="나중에 보인 것">
          <strong>나중에 보인 것</strong><p>{page.discovery}</p>
          {page.caution !== undefined && <small>{page.caution}</small>}
        </section>
        {page.question !== undefined && (
          <div className="minji-page__question">
            <button type="button" aria-expanded={questionOpen} onClick={onToggleQuestion}>{page.question.label}</button>
            {questionOpen && <p>{page.question.answer}</p>}
          </div>
        )}
      </div>
      <footer className="minji-page__footer">
        <button type="button" onClick={onPrevious} disabled={onPrevious === undefined}><ArrowLeft aria-hidden="true" size={18} /><span>이전</span></button>
        {onNext !== undefined
          ? <button type="button" onClick={onNext}><span>다음</span><ArrowRight aria-hidden="true" size={18} /></button>
          : <button type="button" onClick={onWriteLog}><span>오늘 기록 남기기</span><ArrowRight aria-hidden="true" size={18} /></button>}
      </footer>
    </article>
  )
}
