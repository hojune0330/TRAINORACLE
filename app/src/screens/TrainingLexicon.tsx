import React from "react"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { ArrowLeft, ChevronRight, ExternalLink, Search } from "lucide-react"
import { useNavigationReturnFrame } from "../hooks/useNavigationReturnFrame"
import { captureReaderPosition, restoreReaderPosition, type ReaderPosition } from "../navigation/readerPosition"
import { AppHeading } from "../components/AppHeading"
import {
  GLOSSARY,
  GLOSSARY_ENTRIES,
  TERM_CATEGORY_LABELS,
  glossarySearchText,
  isTermId,
  type GlossaryEntry,
  type TermCategory,
  type TermId,
} from "../domain/glossary"

const CATEGORY_ORDER: readonly TermCategory[] = [
  "SCHEDULE_ROLE",
  "TRAINING_INTENT",
  "ENERGY_METABOLISM",
  "FUEL_AND_RESPONSE",
  "INTENSITY_AND_RECORD",
  "TRAINING_STRUCTURE",
  "PERIODIZATION",
  "APP_AND_SAFETY",
]

const FREQUENT_TERMS: readonly TermId[] = ["rpe", "base", "lt", "vo2", "gly", "atp", "training-notation"]

export function TrainingLexicon({
  initialTerm,
  active = true,
  standalone = false,
  directEntry = false,
  onBack,
  onNavigateTerm,
}: {
  readonly initialTerm?: TermId
  readonly active?: boolean
  readonly standalone?: boolean
  readonly directEntry?: boolean
  readonly onBack?: () => void
  readonly onNavigateTerm?: (term: TermId) => void
}) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<TermCategory | "ALL">("ALL")
  const [showAll, setShowAll] = React.useState(false)
  const [selectedTerm, setSelectedTerm] = React.useState<TermId | null>(initialTerm ?? null)
  const [termTrail, setTermTrail] = React.useState<readonly TermId[]>([])
  const [detailMode, setDetailMode] = React.useState<"EASY" | "PRO">("EASY")
  const topRef = React.useRef<HTMLElement>(null)
  const indexReturn = React.useRef<ReaderPosition | null>(null)
  const categoryReturn = React.useRef<ReaderPosition | null>(null)
  const pendingReturn = React.useRef<ReaderPosition | null>(null)
  const termPositions = React.useRef<ReaderPosition[]>([])
  const { schedule, invalidate } = useNavigationReturnFrame()
  const region = () => topRef.current?.closest<HTMLElement>(".app-scroll-region") ?? (document.scrollingElement as HTMLElement | null) ?? topRef.current

  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")
  const visibleEntries = GLOSSARY_ENTRIES.filter((entry) => (
    (normalizedQuery !== "" || category === "ALL" || entry.category === category)
    && (normalizedQuery === "" || glossarySearchText(entry.id, entry).includes(normalizedQuery))
  ))

  const openTerm = (term: TermId, opener?: HTMLElement) => {
    if (directEntry && onNavigateTerm !== undefined) {
      onNavigateTerm(term)
      return
    }
    if (selectedTerm !== null && selectedTerm !== term) {
      setTermTrail((trail) => [...trail, selectedTerm])
      termPositions.current.push(captureReaderPosition(region(), opener))
    } else if (selectedTerm === null) {
      indexReturn.current = captureReaderPosition(region(), opener)
    }
    setSelectedTerm(term)
    setDetailMode("EASY")
    if (standalone) {
      const url = new URL(window.location.href)
      url.searchParams.set("terms", "1")
      url.searchParams.set("term", term)
      window.history.pushState({}, "", url)
    }
  }

  const closeTerm = () => {
    const previous = termTrail.at(-1)
    if (previous !== undefined) {
      pendingReturn.current = termPositions.current.pop() ?? null
      setTermTrail((trail) => trail.slice(0, -1))
      setSelectedTerm(previous)
      if (standalone) {
        const url = new URL(window.location.href)
        url.searchParams.set("terms", "1")
        url.searchParams.set("term", previous)
        window.history.pushState({}, "", url)
      }
      return
    }
    if (directEntry && onBack !== undefined) {
      onBack()
      return
    }
    pendingReturn.current = indexReturn.current
    indexReturn.current = null
    setSelectedTerm(null)
    if (standalone) {
      const url = new URL(window.location.href)
      url.searchParams.set("terms", "1")
      url.searchParams.delete("term")
      window.history.pushState({}, "", url)
    }
  }
  const resetIndex = () => {
    const position = categoryReturn.current
    categoryReturn.current = null
    pendingReturn.current = position
    setQuery(""); setCategory("ALL"); setShowAll(false)
    // Clearing only a search does not change the category effect dependencies.
    if (active && category === "ALL" && !showAll) schedule(() => topRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }))
  }
  useTaskFlowBack({
    enabled: active && !standalone && !directEntry && (selectedTerm !== null || category !== "ALL" || showAll || normalizedQuery !== ""),
    onBack: () => selectedTerm !== null ? closeTerm() : resetIndex(),
  })

  React.useEffect(() => {
    if (!active) {
      invalidate()
      return
    }
    const position = pendingReturn.current
    pendingReturn.current = null
    schedule(() => {
      if (position) { restoreReaderPosition(region(), position); return }
      const target = topRef.current?.querySelector<HTMLElement>(selectedTerm === null && category === "ALL" && !showAll ? "h1" : selectedTerm === null ? ".training-lexicon__group h2" : ".training-term h2")
      if ((selectedTerm !== null || category !== "ALL" || showAll) && region()) region()!.scrollTop = 0
      if (target) target.tabIndex = -1
      target?.focus({ preventScroll: true })
    })
    return invalidate
  }, [active, selectedTerm, category, showAll, schedule, invalidate])

  React.useEffect(() => {
    if (!standalone) return
    const syncFromUrl = () => {
      const term = new URLSearchParams(window.location.search).get("term")
      setTermTrail([])
      termPositions.current = []
      if (!isTermId(term)) {
        pendingReturn.current = indexReturn.current
        indexReturn.current = null
      }
      setSelectedTerm(isTermId(term) ? term : null)
    }
    window.addEventListener("popstate", syncFromUrl)
    return () => window.removeEventListener("popstate", syncFromUrl)
  }, [standalone])

  const selectedEntry = selectedTerm === null ? null : GLOSSARY[selectedTerm]

  return (
    <section ref={topRef} className="training-lexicon" aria-labelledby="training-lexicon-title">
      <header className="training-lexicon__header">
        {(onBack !== undefined || standalone) && (
          <button
            type="button"
            className="training-lexicon__back"
            onClick={onBack ?? (() => { window.location.href = import.meta.env.BASE_URL || "./" })}
          >
            <ArrowLeft aria-hidden="true" size={18} />앱으로 돌아가기
          </button>
        )}
        <AppHeading accent tabIndex={-1} id="training-lexicon-title">훈련 용어집</AppHeading>
        {selectedEntry === null && <p>궁금한 용어를 골라 보세요.</p>}
      </header>

      {selectedEntry === null ? (
        <LexiconIndex
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={(value, opener) => { categoryReturn.current = captureReaderPosition(region(), opener); setCategory(value); setShowAll(false) }}
          showAll={showAll}
          onShowAll={(opener) => { categoryReturn.current = captureReaderPosition(region(), opener); setCategory("ALL"); setShowAll(true) }}
          onReset={resetIndex}
          visibleEntries={visibleEntries}
          onOpenTerm={openTerm}
        />
      ) : (
        <TermDetail
          term={selectedTerm!}
          entry={selectedEntry}
          mode={detailMode}
          onModeChange={setDetailMode}
          onBack={closeTerm}
          backLabel={termTrail.length > 0 ? "이전 용어" : directEntry ? "이전 화면" : "용어 목록"}
          onOpenTerm={openTerm}
        />
      )}
    </section>
  )
}

function LexiconIndex({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  showAll,
  onShowAll,
  onReset,
  visibleEntries,
  onOpenTerm,
}: {
  readonly query: string
  readonly onQueryChange: (value: string) => void
  readonly category: TermCategory | "ALL"
  readonly onCategoryChange: (value: TermCategory, opener: HTMLElement) => void
  readonly showAll: boolean
  readonly onShowAll: (opener: HTMLElement) => void
  readonly onReset: () => void
  readonly visibleEntries: typeof GLOSSARY_ENTRIES
  readonly onOpenTerm: (term: TermId, opener?: HTMLElement) => void
}) {
  const browsing = query.trim() === "" && category === "ALL" && !showAll
  return (
    <div className="training-lexicon__index">
      <div className="training-lexicon__tools" role="search">
        <label>
          <span>용어 검색</span>
          <span className="training-lexicon__search-field">
            <Search aria-hidden="true" size={18} />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="RPE, 젖산, 회복 시간…"
            />
          </span>
        </label>
      </div>

      {browsing && <>
        <section className="training-lexicon__frequent" aria-labelledby="frequent-terms-title">
          <h2 id="frequent-terms-title">자주 보는 용어</h2>
          <div className="app-choice-group">
            {FREQUENT_TERMS.map((term) => (
              <button className="app-choice-control" key={term} type="button" onClick={event => onOpenTerm(term, event.currentTarget)}>
                <strong>{GLOSSARY[term].label}</strong>
                {GLOSSARY[term].code !== undefined && <small>{GLOSSARY[term].code}</small>}
              </button>
            ))}
          </div>
        </section>
        <section className="training-lexicon__categories" aria-labelledby="term-categories-title">
          <h2 id="term-categories-title">분류로 찾기</h2>
          <div className="app-choice-group">
            {CATEGORY_ORDER.map((item) => <button className="app-choice-control" type="button" key={item} onClick={event => onCategoryChange(item, event.currentTarget)}>{TERM_CATEGORY_LABELS[item]}<ChevronRight aria-hidden="true" size={18} /></button>)}
          </div>
          <button className="training-lexicon__all app-choice-control" type="button" onClick={event => onShowAll(event.currentTarget)}>전체 용어 보기<ChevronRight aria-hidden="true" size={18} /></button>
        </section>
      </>}

      {!browsing && <button type="button" className="training-term__index-back" onClick={onReset}><ArrowLeft aria-hidden="true" size={18} />분류로 돌아가기</button>}

      {!browsing && (visibleEntries.length === 0 ? (
        <p className="training-lexicon__empty" role="status">일치하는 용어가 없어요. 다른 이름이나 영어 약자로 검색해 보세요.</p>
      ) : CATEGORY_ORDER.map((group) => {
        const entries = visibleEntries.filter((entry) => entry.category === group)
        if (entries.length === 0) return null
        return (
          <section key={group} className="training-lexicon__group" aria-labelledby={`term-category-${group}`}>
            <h2 id={`term-category-${group}`}>{TERM_CATEGORY_LABELS[group]}</h2>
            <ul className="app-choice-group">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button className="app-choice-control" type="button" onClick={event => onOpenTerm(entry.id, event.currentTarget)}>
                    <span>
                      <strong>{entry.label}</strong>
                      {entry.code !== undefined && <small>{entry.code}</small>}
                    </span>
                    <ChevronRight aria-hidden="true" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      }))}
    </div>
  )
}

function TermDetail({
  term,
  entry,
  mode,
  onModeChange,
  onBack,
  backLabel,
  onOpenTerm,
}: {
  readonly term: TermId
  readonly entry: GlossaryEntry
  readonly mode: "EASY" | "PRO"
  readonly onModeChange: (mode: "EASY" | "PRO") => void
  readonly onBack: () => void
  readonly backLabel: string
  readonly onOpenTerm: (term: TermId, opener?: HTMLElement) => void
}) {
  return (
    <article className="training-term" aria-labelledby={`training-term-${term}`}>
      <button type="button" className="training-term__index-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={18} />{backLabel}
      </button>
      <header>
        <span>{TERM_CATEGORY_LABELS[entry.category]}</span>
        <h2 tabIndex={-1} id={`training-term-${term}`}>{entry.label}{entry.code !== undefined && <small>{entry.code}</small>}</h2>
        <p>{entry.short}</p>
      </header>

      <div className="training-term__mode app-compact-tabs" aria-label="설명 수준">
        <button className="app-compact-tab" type="button" aria-pressed={mode === "EASY"} onClick={() => onModeChange("EASY")}><span>쉬운 설명</span></button>
        <button className="app-compact-tab" type="button" aria-pressed={mode === "PRO"} onClick={() => onModeChange("PRO")}><span>전문 설명</span></button>
      </div>

      <div className="training-term__sections">
        <TermSection title="왜 이런 이름인가요?" body={entry.namingOrigin} />
        <TermSection title="TrainOracle에서는" body={entry.trainOracleUsage} />
        <TermSection title="이 뜻은 아니에요" body={entry.notMeaning} caution={entry.safety} />
        {entry.examples !== undefined && <TermList title="표기 예시" items={entry.examples} />}
        {mode === "PRO" && (
          <>
            <TermSection title="전문 설명" body={entry.technicalDefinition} />
            <TermSection title="관련 에너지 경로" body={entry.pathwayContext} />
            <TermSection title="젖산과의 관계" body={entry.lactateContext} />
            <TermSection title="주로 쓰는 연료" body={entry.substrateContext} />
            {entry.aliases !== undefined && <TermList title="함께 쓰는 이름" items={entry.aliases} />}
            {entry.sourceRefs !== undefined && (
              <section className="training-term__section">
                <h3>검토한 근거</h3>
                <ul className="training-term__sources">
                  {entry.sourceRefs.map((source) => (
                    <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<ExternalLink aria-hidden="true" size={14} /></a></li>
                  ))}
                </ul>
                <small>연구 근거는 용어 설명에 사용하며 개인의 대사 기여도를 측정하거나 의료 판단을 내리지 않아요.</small>
              </section>
            )}
          </>
        )}
      </div>

      {entry.relatedTerms !== undefined && (
        <section className="training-term__related" aria-labelledby={`related-${term}`}>
          <h3 id={`related-${term}`}>함께 보면 좋은 용어</h3>
          <div className="app-choice-group">{entry.relatedTerms.map((related) => (
            <button className="app-choice-control" key={related} type="button" onClick={event => onOpenTerm(related, event.currentTarget)}>
              {GLOSSARY[related].label}{GLOSSARY[related].code !== undefined && <small>{GLOSSARY[related].code}</small>}
            </button>
          ))}</div>
        </section>
      )}
    </article>
  )
}

function TermSection({ title, body, caution = false }: { readonly title: string; readonly body?: string; readonly caution?: boolean }) {
  if (body === undefined) return null
  return <section className="training-term__section" data-caution={caution || undefined}><h3>{title}</h3><p>{body}</p></section>
}

function TermList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return <section className="training-term__section"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
}
