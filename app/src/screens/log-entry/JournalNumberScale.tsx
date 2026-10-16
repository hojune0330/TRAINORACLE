import "./journal-answer-controls.css"

/** Display-only choice surface. Callers keep their own missing/toggle semantics. */
export function JournalNumberScale({ label, length = 10, selected, onSelect }: {
  readonly label?: string
  readonly length?: number
  readonly selected: number | null
  readonly onSelect: (value: number) => void
}) {
  return <div className="journal-answer-scale app-choice-group" role={label ? "group" : undefined} aria-label={label}>
    {Array.from({ length }, (_, index) => index + 1).map(value => <button key={value} type="button"
      className="app-choice-control journal-answer-scale__option"
      aria-label={label ? `${label} ${value}` : undefined} aria-pressed={selected === value}
      onClick={() => onSelect(value)}>{value}</button>)}
  </div>
}
