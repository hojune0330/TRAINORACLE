import type { ReactNode } from "react"
import type { AppCategory } from "./CategoryCard"
import "../styles/category-cards.css"
import "../styles/source-ui.css"

/** Display-only adaptation of Umami MetricsBar/MetricCard (MIT), ec0ff503.
 * See scripts/ui-source-attributions.json. No default value, conversion, trend
 * judgement or animation: the existing domain supplies every value and period. */
export function MetricSummary({ items, label, category = "oracle" }: {
  readonly items: readonly { readonly id: string; readonly label: string; readonly value: ReactNode; readonly period?: string; readonly detail?: ReactNode }[]
  readonly label?: string
  readonly category?: AppCategory
}) {
  if (items.length === 0) return null
  return <dl className="metric-summary" aria-label={label} data-category={category}>
    {items.map(item => <div className="metric-summary__item" key={item.id}>
      <dt className="metric-summary__label">{item.label}{item.period && <span className="metric-summary__period">{item.period}</span>}</dt>
      <dd className="metric-summary__value">{item.value}</dd>
      {item.detail != null && <dd className="metric-summary__detail">{item.detail}</dd>}
    </div>)}
  </dl>
}
