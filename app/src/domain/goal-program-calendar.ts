import { isValidIsoDate, isoShift } from "./dates"

/** This calendar helper does not create ability records or session pace anchors. */
export const TEN_K_GOAL_MINUTES = [60, 50, 45, 40, 30] as const
export type TenKGoalMinutes = typeof TEN_K_GOAL_MINUTES[number]
export const GOAL_PROGRAM_HALF_DAYS = 57
export const GOAL_PROGRAM_CALENDAR_DAYS = 29

export function isTenKGoalMinutes(value: unknown): value is TenKGoalMinutes {
  return typeof value === "number" && TEN_K_GOAL_MINUTES.some(goal => goal === value)
}

/** Arithmetic explanation of a goal only. No session prescription is produced. */
export function tenKGoalPaceLabel(goal: TenKGoalMinutes): string {
  const seconds = goal * 6
  return `${Math.floor(seconds / 60)}분${seconds % 60 ? ` ${seconds % 60}초` : ""}/km`
}

export type GoalProgramDateChoice =
  | { readonly kind: "START"; readonly startDate: string }
  | { readonly kind: "DEADLINE"; readonly deadline: string }

export type GoalProgramHalfDay = Readonly<{
  offset: number
  date: string
  slot: "AM" | "PM"
  cycle: 1 | 2 | 3
  cycleHalfDay: number
}>

export type GoalProgramWindow = Readonly<{
  startDate: string
  endDate: string
  deadline: string | null
  halfDays: readonly GoalProgramHalfDay[]
}>

export type GoalProgramWindowResult =
  | { readonly kind: "ready"; readonly window: GoalProgramWindow }
  | { readonly kind: "invalid-date" }
  | { readonly kind: "start-in-past"; readonly requiredStartDate: string; readonly suggestedStartDate: string }

/** Calendar arithmetic only: does not authorize race placement, taper, or storage. */
export function resolveGoalProgramWindow(choice: GoalProgramDateChoice, today: string): GoalProgramWindowResult {
  const selected = choice.kind === "START" ? choice.startDate : choice.deadline
  if (!isValidIsoDate(today) || !isValidIsoDate(selected)) return { kind: "invalid-date" }
  const startDate = choice.kind === "START" ? selected : isoShift(selected, -(GOAL_PROGRAM_CALENDAR_DAYS - 1))
  const endDate = isoShift(startDate, GOAL_PROGRAM_CALENDAR_DAYS - 1)
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) return { kind: "invalid-date" }
  if (startDate < today) return { kind: "start-in-past", requiredStartDate: startDate, suggestedStartDate: today }
  const halfDays = Array.from({ length: GOAL_PROGRAM_HALF_DAYS }, (_, offset): GoalProgramHalfDay => ({
    offset, date: isoShift(startDate, Math.floor(offset / 2)), slot: offset % 2 === 0 ? "AM" : "PM",
    cycle: (Math.floor(offset / 19) + 1) as 1 | 2 | 3, cycleHalfDay: offset % 19,
  }))
  return { kind: "ready", window: { startDate, endDate,
    deadline: choice.kind === "DEADLINE" ? selected : null, halfDays } }
}

export type GoalProgramDay<T> = Readonly<{
  date: string
  cycle: 1 | 2 | 3
  halfDayOffset: number
  content: T
}>

/** A reviewed program supplies explicit rest/work entries. Missing days are not rest.
 * The global 57-half-day axis catches collisions at both 9.5-day boundaries.
 * No first-half preference is imposed: reviewed workouts may occupy AM or PM.
 */
export function projectGoalProgramDays<T>(window: GoalProgramWindow,
  entries: readonly Readonly<{ halfDayOffset: number; content: T }>[],
): { readonly kind: "ready"; readonly days: readonly GoalProgramDay<T>[] }
  | { readonly kind: "invalid-program"; readonly reason: "INVALID_OFFSET" | "DUPLICATE_DATE" | "MISSING_DATE" } {
  const byDate = new Map<string, GoalProgramDay<T>>()
  for (const entry of entries) {
    if (!Number.isInteger(entry.halfDayOffset) || entry.halfDayOffset < 0 || entry.halfDayOffset >= GOAL_PROGRAM_HALF_DAYS) {
      return { kind: "invalid-program", reason: "INVALID_OFFSET" }
    }
    const halfDay = window.halfDays[entry.halfDayOffset]
    if (!halfDay) return { kind: "invalid-program", reason: "INVALID_OFFSET" }
    if (byDate.has(halfDay.date)) return { kind: "invalid-program", reason: "DUPLICATE_DATE" }
    byDate.set(halfDay.date, { date: halfDay.date, cycle: halfDay.cycle, halfDayOffset: entry.halfDayOffset, content: entry.content })
  }
  if (byDate.size !== GOAL_PROGRAM_CALENDAR_DAYS) return { kind: "invalid-program", reason: "MISSING_DATE" }
  return { kind: "ready", days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}
