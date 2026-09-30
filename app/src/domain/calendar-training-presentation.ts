import type { JournalEntry } from "./journal-schema"
import { ENERGY_SYSTEM_META, journalSystemToEnergySystem } from "./energy-system-taxonomy"

export type CalendarTrainingTone = "race" | "main" | "neural" | "base" | "recovery" | "off" | "unknown" | "journal"
export type CalendarTrainingMarkData = {
  readonly tone: CalendarTrainingTone
  readonly label: string
  readonly slot?: string
  readonly componentCue?: string
}

/** Display existing roles only; do not infer training intensity from energy intent. */
export function plannedCalendarTone(session: { readonly role: string; readonly plannedEnergyIntent?: string }): CalendarTrainingTone {
  if (session.role === "REST" || session.role === "OFF") return "off"
  if (session.role === "QUALITY" || session.role === "MAIN") return "main"
  if (session.role === "REC" || (session.role === "EASY" && session.plannedEnergyIntent === "RECOVERY_INTENT")) return "recovery"
  if (session.role === "BASE" || (session.role === "EASY" && session.plannedEnergyIntent === "BASE_INTENT")) return "base"
  return "unknown"
}

export const CALENDAR_TRAINING_LABELS: Readonly<Record<CalendarTrainingTone, string>> = {
  race: "경기", main: "주요", neural: "플라이오", base: "기본", recovery: "회복",
  off: "휴식", unknown: "훈련", journal: "일상",
}

/** No title, memo, health value, or planned-session link is read by this projection. */
export function journalCalendarMarks(entry: JournalEntry): readonly CalendarTrainingMarkData[] {
  if (entry.kind === "race") return [{ tone: "race", label: entry.stage === "pre" ? "경기 전" : "경기 결과" }]
  if (entry.kind === "evening") return [{ tone: "journal", label: "일상" }]
  if (entry.activityOutcome === "RESTED") return [{ tone: "off", label: "휴식 기록" }]
  if (entry.activityOutcome === "SKIPPED") return [{ tone: "unknown", label: "건너뜀" }]
  const slot = entry.activitySlot === "AM" ? "오전" : entry.activitySlot === "PM" ? "오후" : undefined
  const components = [
    ...(entry.exerciseLog?.components ?? []),
    ...(entry.fieldProvenance?.objectiveComponents?.provenance === "EXPLICIT" ? entry.intensityAssessment?.objectiveComponents ?? [] : []),
  ]
  const hasPlyometric = components.some(component => component.kind === "PLYOMETRIC")
  const onlyPlyometric = hasPlyometric && components.every(component => component.kind === "PLYOMETRIC")
  const system = entry.fieldProvenance?.system?.provenance === "EXPLICIT" ? journalSystemToEnergySystem(entry.system) : null
  // One journal entry is one visual record, even when it contains several activities.
  if (system !== null) {
    return [{ tone: system === "BASE" ? "base" : system === "RECOVERY" ? "recovery" : "unknown",
      label: system === "BASE" ? "기본" : system === "RECOVERY" ? "회복" : ENERGY_SYSTEM_META[system].code,
      slot, ...(hasPlyometric ? { componentCue: "플라이오 포함" } : {}) }]
  }
  if (onlyPlyometric) return [{ tone: "neural", label: "플라이오", slot }]
  return [{ tone: "unknown", label: "훈련", slot, ...(hasPlyometric ? { componentCue: "플라이오 포함" } : {}) }]
}

export function calendarMarksDescription(marks: readonly CalendarTrainingMarkData[]): string {
  return marks.map(mark => [mark.slot, mark.label, mark.componentCue].filter(Boolean).join(" ")).join(" · ")
}
