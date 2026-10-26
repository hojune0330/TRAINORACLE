import { useSyncExternalStore } from "react"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import type { WorkoutMemoGroup } from "../domain/workout-memo-presentation"
import type { WorkoutNotationStyle } from "../domain/workout-notation"

export type WorkoutReadingPreferences = {
  readonly wording: WorkoutNotationStyle
  readonly group: WorkoutMemoGroup
}
export const DEFAULT_WORKOUT_READING: WorkoutReadingPreferences = { wording: "PLAIN", group: "brief" }
let generation = -1
let current = DEFAULT_WORKOUT_READING
const listeners = new Set<() => void>()
function snapshot() {
  const next = localJournalScopeGeneration()
  if (next !== generation) { generation = next; current = DEFAULT_WORKOUT_READING }
  return current
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  const unsubscribe = onLocalJournalScopeChange(() => { snapshot(); listener() })
  return () => { listeners.delete(listener); unsubscribe() }
}
export function useWorkoutReadingPreferences() {
  const preferences = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_WORKOUT_READING)
  const update = (value: WorkoutReadingPreferences) => { snapshot(); current = value; listeners.forEach(listener => listener()) }
  return [preferences, update] as const
}
