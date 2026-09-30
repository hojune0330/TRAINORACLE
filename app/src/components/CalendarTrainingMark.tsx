import type { ReactNode } from "react"
import type { CalendarTrainingMarkData } from "../domain/calendar-training-presentation"

export function CalendarTrainingMark({ tone, label, slot, componentCue, children }: CalendarTrainingMarkData & { readonly children?: ReactNode }) {
  return <span className="calendar-training-mark" data-tone={tone}>
    {slot && <span className="calendar-training-mark__slot">{slot}</span>}
    <span className="calendar-training-mark__label">{label}{children}</span>
    {componentCue && <span className="calendar-training-mark__cue">{componentCue}</span>}
  </span>
}
