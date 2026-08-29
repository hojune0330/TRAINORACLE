import React from "react"
import { ArrowLeft, BookOpenCheck, ExternalLink, Search } from "lucide-react"
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
  standalone = false,
  onBack,
}: {
  readonly initialTerm?: TermId
  readonly standalone?: boolean
  readonly onBack?: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<TermCategory | "ALL">("ALL")
  const [selectedTerm, setSelectedTerm] = React.useState<TermId | null>(initialTerm ?? null)
  const [detailMode, setDetailMode] = React.useState<"EASY" | "PRO">("EASY")
  const topRef = React.useRef<HTMLElement>(null)

  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR")
  const visibleEntries = GLOSSARY_ENTRIES.filter((entry) => (
    (category === "ALL" || entry.category === category)
    && (normalizedQuery === "" || glossarySearchText(entry.id, entry).includes(normalizedQuery))
  ))

  const openTerm = (term: TermId) => {
    setSelectedTerm(term)
    setDetailMode("EASY")
    if (standalone) {
      const url = new URL(window.location.href)
      url.searchParams.set("terms", "1")
      url.searchParams.set("term", term)
      window.history.pushState({}, "", url)
    }
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
      const target = topRef.current
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
      }
    })
  }

  const closeTerm = () => {
    setSelectedTerm(null)
    if (standalone) {
      const url = new URL(window.location.href)
      url.searchParams.set("terms", "1")
      url.searchParams.delete("term")
      window.history.pushState({}, "", url)
    }
  }

  React.useEffect(() => {
    if (!standalone) return
    const syncFromUrl = () => {
      const term = new URLSearchParams(window.location.search).get("term")
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
        <span className="training-lexicon__eyebrow"><BookOpenCheck aria-hidden="true" size={17} />TRAINORACLE</span>
        <h1 id="training-lexicon-title">훈련 용어집</h1>
        <p>처음에는 쉬운 뜻만 보고, 궁금할 때 이름의 이유와 생리학적 맥락까지 확인하세요.</p>
      </header>

      {selectedEntry === null ? (
        <LexiconIndex
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
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
  visibleEntries,
  onOpenTerm,
}: {
  readonly query: string
  readonly onQueryChange: (value: string) => void
  readonly category: TermCategory | "ALL"
  readonly onCategoryChange: (value: TermCategory | "ALL") => void
  readonly visibleEntries: typeof GLOSSARY_ENTRIES
  readonly onOpenTerm: (term: TermId) => void
}) {
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
        <label>
          <span>분류</span>
          <select value={category} onChange={(event) => onCategoryChange(event.target.value as TermCategory | "ALL")}>
            <option value="ALL">전체 용어</option>
            {CATEGORY_ORDER.map((item) => <option key={item} value={item}>{TERM_CATEGORY_LABELS[item]}</option>)}
          </select>
        </label>
      </div>

      {query === "" && category === "ALL" && (
        <section className="training-lexicon__frequent" aria-labelledby="frequent-terms-title">
          <h2 id="frequent-terms-title">자주 보는 용어</h2>
          <div>
            {FREQUENT_TERMS.map((term) => (
              <button key={term} type="button" onClick={() => onOpenTerm(term)}>
                <strong>{GLOSSARY[term].label}</strong>
                {GLOSSARY[term].code !== undefined && <small>{GLOSSARY[term].code}</small>}
              </button>
            ))}
          </div>
        </section>
      )}

      {visibleEntries.length === 0 ? (
        <p className="training-lexicon__empty" role="status">일치하는 용어가 없어요. 다른 이름이나 영어 약자로 검색해 보세요.</p>
      ) : CATEGORY_ORDER.map((group) => {
        const entries = visibleEntries.filter((entry) => entry.category === group)
        if (entries.length === 0) return null
        return (
          <section key={group} className="training-lexicon__group" aria-labelledby={`term-category-${group}`}>
            <h2 id={`term-category-${group}`}>{TERM_CATEGORY_LABELS[group]}</h2>
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button type="button" onClick={() => onOpenTerm(entry.id)}>
                    <span>
                      <strong>{entry.label}</strong>
                      {entry.code !== undefined && <small>{entry.code}</small>}
                    </span>
                    <p>{entry.short}</p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function TermDetail({
  term,
  entry,
  mode,
  onModeChange,
  onBack,
  onOpenTerm,
}: {
  readonly term: TermId
  readonly entry: GlossaryEntry
  readonly mode: "EASY" | "PRO"
  readonly onModeChange: (mode: "EASY" | "PRO") => void
  readonly onBack: () => void
  readonly onOpenTerm: (term: TermId) => void
}) {
  return (
    <article className="training-term" aria-labelledby={`training-term-${term}`}>
      <button type="button" className="training-term__index-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={18} />용어 목록
      </button>
      <header>
        <span>{TERM_CATEGORY_LABELS[entry.category]}</span>
        <h2 id={`training-term-${term}`}>{entry.label}{entry.code !== undefined && <small>{entry.code}</small>}</h2>
        <p>{entry.short}</p>
      </header>

      <div className="training-term__mode" aria-label="설명 수준">
        <button type="button" aria-pressed={mode === "EASY"} onClick={() => onModeChange("EASY")}>쉬운 설명</button>
        <button type="button" aria-pressed={mode === "PRO"} onClick={() => onModeChange("PRO")}>전문 설명</button>
      </div>

      <div className="training-term__sections">
        <TermSection title="왜 이런 이름인가요?" body={entry.namingOrigin} />
        <TermSection title="TrainOracle에서는" body={entry.trainOracleUsage} />
        <TermSection title="이 뜻은 아니에요" body={entry.notMeaning} caution={entry.safety} />
        {entry.examples !== undefined && <TermList title="표기 예시" items={entry.examples} />}
        {mode === "PRO" && (
          <>
            <TermSection title="전문 설명" body={entry.technicalDefinition} />
            <TermSection title="에너지 경로 맥락" body={entry.pathwayContext} />
            <TermSection title="젖산 맥락" body={entry.lactateContext} />
            <TermSection title="사용 연료 맥락" body={entry.substrateContext} />
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
          <div>{entry.relatedTerms.map((related) => (
            <button key={related} type="button" onClick={() => onOpenTerm(related)}>
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
