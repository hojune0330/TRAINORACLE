import type { ReactNode } from "react"
import type { CalendarTrainingMarkData } from "../domain/calendar-training-presentation"
import { Flag, Target, Footprints, Leaf, Moon, MoveUpRight, NotebookPen, Activity } from "lucide-react"

const ROLE_ICONS = { race: Flag, main: Target, base: Footprints, recovery: Leaf, off: Moon, neural: MoveUpRight, journal: NotebookPen, unknown: Activity }

export function CalendarRoleIcon({ tone }: Pick<CalendarTrainingMarkData, "tone">) {
  const Icon = ROLE_ICONS[tone]
  return <Icon size={16} aria-hidden="true" className="calendar-role-icon" />
}

export function CalendarTrainingMark({ tone, label, slot, componentCue, children }: CalendarTrainingMarkData & { readonly children?: ReactNode }) {
  return <span className="calendar-training-mark" data-tone={tone}>
    <CalendarRoleIcon tone={tone} />
    {slot && <span className="calendar-training-mark__slot">{slot}</span>}
    <span className="calendar-training-mark__label">{label}{children}</span>
    {componentCue && <span className="calendar-training-mark__cue">{componentCue}</span>}
  </span>
}
