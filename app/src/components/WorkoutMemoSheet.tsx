import type { WorkoutMemoPresentation } from "../domain/workout-memo-presentation"
import { memoDisplayLines, memoExecutionOrder, memoExplanationSources, memoLineEmphasis } from "../domain/workout-memo-presentation"
import type { MemoPaper } from "../domain/workout-memo-export"

/** Read-only paper surface; commands and future decoration editing belong outside it. */
export function WorkoutMemoSheet({ memo, paper }: { readonly memo: WorkoutMemoPresentation; readonly paper: MemoPaper }) {
  return <article className="workout-memo-paper" data-paper={paper} data-layout={memo.layout} data-view={memo.view} data-wording={memo.wording} aria-label="훈련 메모 미리보기">
    <header><strong>{memo.dateLabel}</strong><span>{memo.slotLabel}</span></header>
    <p className="workout-memo-paper__state">{memo.stateLabel}</p>
    <h3>{memo.title}</h3>
    {memo.layout === "full" && <p className="workout-memo-paper__order">{memoExecutionOrder(memo)}</p>}
    <dl>{memoDisplayLines(memo).map((line, index) => <div key={index} data-emphasis={memoLineEmphasis(memo, index) || undefined}>
      <dt>{line.label}</dt><dd>{line.text}</dd>
    </div>)}</dl>
    {memo.basis && <p className="workout-memo-paper__basis">기준: {memo.basis}</p>}
    {memo.warnings.length > 0 && (memo.view === "core" ? <p className="workout-memo-paper__warnings workout-memo-paper__stop-line">{memo.warnings.join(" · ")}</p>
      : <ul className="workout-memo-paper__warnings">{memo.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>)}
    {memo.view === "explained" && <section className="workout-memo-paper__explanation" aria-label="훈련 설명">
      <p>{memo.explanation.scope}</p>
      {memo.explanation.sections.map(section => <section key={section.label}><h4>{section.label}</h4><p>{section.text}</p></section>)}
      <section><h4>근거</h4><ul>{memoExplanationSources(memo).map((source, index) => <li key={index}>{source.url
        ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} (새 탭)</a> : source.title}</li>)}</ul>
        <p>설명 버전 {memo.explanation.version}</p></section>
    </section>}
    <footer>TRAINORACLE</footer>
  </article>
}
