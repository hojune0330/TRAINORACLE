import { z } from "zod"
import { fatigueEvidenceSchema, fatigueVector, fatigueVectorSchema } from "./fatigue-vector"
import type { FatigueEvidence, FatigueVector } from "./fatigue-vector"
import { accountScopedStorageKey } from "./account/local-account-scope"

export const FATIGUE_EXPERIMENT_STORAGE_KEY = "trainoracle.fatigue-experiment.v1"

function activeStorageKey(): string {
  return accountScopedStorageKey(FATIGUE_EXPERIMENT_STORAGE_KEY)
}
const stateSchema = z.object({
  optedIn: z.boolean(),
  vector: fatigueVectorSchema,
  evidence: fatigueEvidenceSchema.nullable(),
})
const legacyStateSchema = z.object({
  optedIn: z.boolean(),
  vector: fatigueVectorSchema,
})
const storedStateSchema = z.union([stateSchema, legacyStateSchema])

export type FatigueExperimentState = {
  readonly optedIn: boolean
  readonly vector: FatigueVector
  readonly evidence: FatigueEvidence | null
}

const DEFAULT_STATE: FatigueExperimentState = {
  optedIn: false,
  vector: fatigueVector({ neural: 5, metabolic: 5, muscular: 5, impact: 5, subjective: 5 }),
  evidence: null,
}

export function loadFatigueExperiment(): FatigueExperimentState {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(activeStorageKey())
    if (raw === null) return DEFAULT_STATE
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = storedStateSchema.safeParse(parsedJson)
    if (!parsed.success) return DEFAULT_STATE
    return "evidence" in parsed.data
      ? parsed.data
      : { ...parsed.data, evidence: null }
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_STATE
    throw error
  }
}

export function saveFatigueExperiment(state: FatigueExperimentState): boolean {
  if (typeof window === "undefined") return false
  const parsed = stateSchema.safeParse(state)
  if (!parsed.success) return false
  try {
    window.localStorage.setItem(activeStorageKey(), JSON.stringify(parsed.data))
    return true
  } catch (error) {
    if (error instanceof DOMException) return false
    throw error
  }
}
