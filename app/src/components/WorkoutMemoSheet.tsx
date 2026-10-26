import type { WorkoutMemoPresentation } from "../domain/workout-memo-presentation"
import { memoDisplayLines, memoExplanationSources, memoLineEmphasis, memoVisibleBasis } from "../domain/workout-memo-presentation"
import { ChevronDown } from "lucide-react"
import type { MemoPaper } from "../domain/workout-memo-export"
import { companionStampUrl, type CompanionStamp } from "../domain/training-companions"
import "../styles/training-companions.css"

/** Read-only paper surface; commands and future decoration editing belong outside it. */
export function WorkoutMemoSheet({ memo, paper, stamp = null, hideDate = false, onExplanationToggle }: {
  readonly memo: WorkoutMemoPresentation; readonly paper: MemoPaper; readonly stamp?: CompanionStamp | null
  readonly hideDate?: boolean; readonly onExplanationToggle?: (open: boolean) => void
}) {
  return <article className="workout-memo-paper" data-paper={paper} data-layout={memo.layout} data-view={memo.view} data-wording={memo.wording} aria-label="훈련 메모 미리보기">
    {!hideDate && <header><strong>{memo.dateLabel}</strong><span>{memo.slotLabel}</span></header>}
    {memo.stateLabel && <p className="workout-memo-paper__state">{memo.stateLabel}</p>}
    <h3>{memo.title}</h3>
    {memo.totalDuration && <p className="workout-memo-paper__total" aria-label="계획된 전체 시간">{memo.totalDuration}</p>}
    <dl>{memoDisplayLines(memo).map((line, index) => <div key={index} data-emphasis={memoLineEmphasis(memo, index) || undefined}>
      <dt>{line.label}</dt><dd>{line.steps && line.steps.length > 1
        ? <ol className="workout-memo-paper__steps">{line.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol> : line.text}</dd>
    </div>)}</dl>
    {memoVisibleBasis(memo) && <p className="workout-memo-paper__basis">기준: {memoVisibleBasis(memo)}</p>}
    {memo.warnings.length > 0 && <aside className="workout-memo-paper__caution" aria-label="유의사항">
      <strong>유의사항</strong><ul className="workout-memo-paper__warnings">{memo.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    </aside>}
    {memo.layout === "full" && <details className="workout-memo-paper__reasons"
      open={onExplanationToggle ? memo.view === "explained" : undefined}>
      <summary onClick={event => {
        if (!onExplanationToggle) return
        event.preventDefault()
        onExplanationToggle(memo.view !== "explained")
      }}>이 훈련의 이유<ChevronDown size={18} aria-hidden="true" /></summary>
      {(memo.view === "explained" || !onExplanationToggle) && <WorkoutMemoExplanationView memo={memo} />}
    </details>}
    <footer className={stamp ? "workout-memo-paper__signature" : undefined}><span>TRAINORACLE</span>{stamp && <img src={companionStampUrl(stamp)} width={80} height={80} alt="선택한 동물 스티커" />}</footer>
  </article>
}

export function WorkoutMemoExplanationView({ memo }: { readonly memo: WorkoutMemoPresentation }) {
  return <section className="workout-memo-paper__explanation" aria-label="훈련 설명">
      <p>{memo.explanation.scope}</p>
      {memo.explanation.sections.map(section => <section key={section.label}><h4>{section.label}</h4><p>{section.text}</p></section>)}
      <details><summary>근거와 설명 버전</summary><ul>{memoExplanationSources(memo).map((source, index) => <li key={index}>{source.url
        ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} (새 탭)</a> : source.title}</li>)}</ul>
        <p>설명 버전 {memo.explanation.version}</p></details>
    </section>
}
