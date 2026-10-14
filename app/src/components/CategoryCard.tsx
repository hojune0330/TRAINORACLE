import { BookOpen, CalendarDays, ChevronDown, ChevronRight, HeartPulse, House, PencilLine, TrendingUp, type LucideIcon } from "lucide-react"
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react"
import "../styles/category-cards.css"

export type AppCategory = "home" | "training" | "journal" | "oracle" | "body" | "record"

const ICONS: Record<AppCategory, LucideIcon> = {
  home: House, training: CalendarDays, journal: BookOpen, oracle: TrendingUp, body: HeartPulse, record: PencilLine,
}

export function CategoryIcon({ category, icon, compact = false }: {
  readonly category: AppCategory; readonly icon?: LucideIcon; readonly compact?: boolean
}) {
  const Icon = icon ?? ICONS[category]
  return <span className={`category-icon${compact ? " category-icon--compact" : ""}`} data-category={category} aria-hidden="true"><Icon size={20} /></span>
}

type CardCopy = {
  readonly category: AppCategory
  readonly icon?: LucideIcon
  readonly title: ReactNode
  readonly label?: string
  readonly description?: ReactNode
  readonly titleId?: string
  readonly headingLevel?: 2 | 3
}

function CategoryCardCopy({ category, icon, title, label, description, titleId, headingLevel }: CardCopy) {
  return <><CategoryIcon category={category} icon={icon} />
    <span className="category-card__copy">
      {label && <span className="category-card__label">{label}</span>}
      <span className="category-card__title" id={titleId} role={headingLevel ? "heading" : undefined} aria-level={headingLevel}>{title}</span>
      {description && <span className="category-card__description">{description}</span>}
    </span></>
}

/** One destination, one native button. No nested actions or persistence. */
export const CategoryCard = forwardRef<HTMLButtonElement, CardCopy & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "children">>(function CategoryCard({ category, icon, title, label, description, titleId, headingLevel, className = "", ...button }, ref) {
  return <button {...button} ref={ref} type="button" className={`category-card ${className}`.trim()} data-category={category}>
    <CategoryCardCopy {...{ category, icon, title, label, description, titleId, headingLevel }} />
    <ChevronRight className="category-card__chevron" size={18} aria-hidden="true" />
  </button>
})

/** Native disclosure keeps keyboard operation and does not create a new route. */
export function CategoryDisclosure({ category, icon, title, label, description, titleId, headingLevel, children, className = "", defaultOpen = false }: CardCopy & { readonly children: ReactNode; readonly className?: string; readonly defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return <details open={open} className={`category-disclosure ${className}`.trim()} data-category={category} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary role="button" aria-expanded={open}>
      <CategoryCardCopy {...{ category, icon, title, label, description, titleId, headingLevel }} />
      <ChevronDown className="category-card__chevron" size={18} aria-hidden="true" />
    </summary>
    <div className="category-disclosure__content">{children}</div>
  </details>
}
