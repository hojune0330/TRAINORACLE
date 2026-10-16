import type { LucideIcon } from "lucide-react"
import type { CSSProperties } from "react"
import { CategoryIcon, type AppCategory } from "./CategoryCard"
import "../styles/category-shortcuts.css"

export type CategoryShortcutItem = {
  readonly id: string
  readonly category: AppCategory
  readonly icon?: LucideIcon
  readonly label: string
  readonly accessibleLabel: string
  readonly onClick: () => void
}

/** Compact destinations, not summaries or selections. Each tile is one native button. */
export function CategoryShortcuts({ label, items, className = "" }: {
  readonly label: string
  readonly items: readonly CategoryShortcutItem[]
  readonly className?: string
}) {
  if (items.length === 0) return null
  return <nav className={`category-shortcuts ${className}`.trim()} aria-label={label}
    style={{ "--shortcut-columns": Math.min(items.length, 4) } as CSSProperties}>
    {items.map(item => <button key={item.id} type="button" className="category-shortcut"
      data-category={item.category} aria-label={item.accessibleLabel} onClick={item.onClick}>
      <CategoryIcon category={item.category} icon={item.icon} />
      <span className="category-shortcut__label">{item.label}</span>
    </button>)}
  </nav>
}
