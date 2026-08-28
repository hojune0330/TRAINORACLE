import { TRAINING_CONTENT_CATALOG } from "./training-content-catalog"
import type { TrainingContentId } from "./training-content-catalog"

const STORAGE_KEY = "trainoracle.training-content.saved.v1"
const VALID_IDS = new Set<string>(TRAINING_CONTENT_CATALOG.map((article) => article.id))

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

export function loadSavedTrainingContent(): readonly TrainingContentId[] {
  const value = storage()?.getItem(STORAGE_KEY)
  if (value === null || value === undefined) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((id): id is TrainingContentId => (
      typeof id === "string" && VALID_IDS.has(id)
    )))]
  } catch {
    return []
  }
}

export function setTrainingContentSaved(id: TrainingContentId, saved: boolean): readonly TrainingContentId[] {
  const current = new Set(loadSavedTrainingContent())
  if (saved) current.add(id)
  else current.delete(id)
  const next = [...current]
  storage()?.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}
