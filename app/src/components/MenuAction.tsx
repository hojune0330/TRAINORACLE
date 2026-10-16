import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react"
import { useId } from "react"
import { CategoryIcon, type AppCategory } from "./CategoryCard"
import { ContextualIllustration, type ContextualIllustrationName } from "./ContextualIllustration"
import "../styles/menu-action.css"

type MenuActionCopy = {
  readonly icon: LucideIcon
  readonly category?: AppCategory
  readonly label: string
  readonly detail?: string
  readonly illustration?: ContextualIllustrationName
}

type MenuActionProps = MenuActionCopy & (
  | { readonly onClick: () => void; readonly href?: never; readonly target?: never }
  | { readonly href: string; readonly target?: "_blank"; readonly onClick?: never }
)

/** One named destination. Optional artwork never owns its label, action or return focus. */
export function MenuAction({ icon, category = "home", label, detail, illustration, ...action }: MenuActionProps) {
  const descriptionId = useId()
  const external = action.href !== undefined && action.target === "_blank"
  const className = `menu-action${illustration ? " menu-action--illustrated" : ""}`
  const copy = <>
    <CategoryIcon category={category} icon={icon} compact />
    <span className="menu-action__copy">
      <strong>{label}</strong>
      {detail && <small id={descriptionId}>{detail}</small>}
    </span>
    {illustration && <ContextualIllustration image={illustration} className="menu-action__illustration" />}
    {external ? <ArrowUpRight className="menu-action__arrow" size={18} aria-hidden="true" />
      : <ChevronRight className="menu-action__arrow" size={18} aria-hidden="true" />}
  </>
  const name = external ? `${label} (새 창)` : label
  if (action.href !== undefined) return <a className={className} data-category={category}
    href={action.href} target={action.target} rel={external ? "noreferrer" : undefined}
    aria-label={name} aria-describedby={detail ? descriptionId : undefined}>{copy}</a>
  return <button className={className} data-category={category} type="button"
    aria-label={name} aria-describedby={detail ? descriptionId : undefined}
    onClick={event => { event.currentTarget.focus({ preventScroll: true }); action.onClick() }}>{copy}</button>
}
