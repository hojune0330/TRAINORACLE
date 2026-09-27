export type WorkoutPreviewHistory<T> = {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}
export const WORKOUT_PREVIEW_HISTORY_LIMIT = 20
export const createWorkoutPreviewHistory = <T>(present: T): WorkoutPreviewHistory<T> => ({ past: [], present, future: [] })

export function pushWorkoutPreview<T>(history: WorkoutPreviewHistory<T>, present: T): WorkoutPreviewHistory<T> {
  return { past: [...history.past, history.present].slice(-WORKOUT_PREVIEW_HISTORY_LIMIT), present, future: [] }
}
export function undoWorkoutPreview<T>(history: WorkoutPreviewHistory<T>): WorkoutPreviewHistory<T> {
  if (!history.past.length) return history
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1]!,
    future: [history.present, ...history.future].slice(0, WORKOUT_PREVIEW_HISTORY_LIMIT) }
}
export function redoWorkoutPreview<T>(history: WorkoutPreviewHistory<T>): WorkoutPreviewHistory<T> {
  if (!history.future.length) return history
  return { past: [...history.past, history.present].slice(-WORKOUT_PREVIEW_HISTORY_LIMIT),
    present: history.future[0]!, future: history.future.slice(1) }
}
