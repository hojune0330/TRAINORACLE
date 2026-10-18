import * as RadioGroup from "@radix-ui/react-radio-group"
import { Check, type LucideIcon } from "lucide-react"
import { useId } from "react"
import type { AppCategory } from "./CategoryCard"
import "../styles/category-cards.css"
import "../styles/source-ui.css"

/** Adapted from Cal.diy SegmentedControl (MIT), commit 54343aa6.
 * See scripts/ui-source-attributions.json. Radix supplies group/keyboard semantics;
 * navigation, dates and drafts remain owned by the caller. */
export function ViewSwitcher<T extends string>({ label, category, value, onValueChange, options, className = "" }: {
  readonly label: string
  readonly category: AppCategory
  readonly value: T
  readonly onValueChange: (value: T) => void
  readonly options: readonly { readonly value: T; readonly label: string; readonly ariaLabel?: string; readonly icon?: LucideIcon }[]
  readonly className?: string
}) {
  const groupId = useId()
  return <RadioGroup.Root className={`view-switcher ${className}`.trim()} name={`view-${groupId}`}
    data-category={category} aria-label={label} value={value} orientation="horizontal"
    onValueChange={next => {
      const option = options.find(item => item.value === next)
      if (option) onValueChange(option.value)
    }}>
    {options.map(option => {
      const Icon = option.icon
      return <RadioGroup.Item key={option.value} id={`${groupId}-${option.value}`} value={option.value} aria-label={option.ariaLabel} className="view-switcher__item">
        {Icon && <Icon size={18} aria-hidden="true" />}
        <span className="view-switcher__label">{option.label}</span>
        <span className="view-switcher__mark" aria-hidden="true"><RadioGroup.Indicator><Check size={16} /></RadioGroup.Indicator></span>
      </RadioGroup.Item>
    })}
  </RadioGroup.Root>
}
