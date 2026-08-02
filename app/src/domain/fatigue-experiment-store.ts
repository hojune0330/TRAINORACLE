import { z } from "zod"
import { fatigueVector } from "./fatigue-vector"
import type { FatigueVector } from "./fatigue-vector"

const STORAGE_KEY = "trainoracle.fatigue-experiment.v1"
const stateSchema = z.object({
  optedIn: z.boolean(),
  vector: z.object({
    neural: z.number().min(0).max(10),
    metabolic: z.number().min(0).max(10),
    muscular: z.number().min(0).max(10),
    impact: z.number().min(0).max(10),
    subjective: z.number().min(0).max(10),
  }),
})

export type FatigueExperimentState = {
  readonly optedIn: boolean
  readonly vector: FatigueVector
}

const DEFAULT_STATE: FatigueExperimentState = {
  optedIn: false,
  vector: fatigueVector({ neural: 5, metabolic: 5, muscular: 5, impact: 5, subjective: 5 }),
}

export function loadFatigueExperiment(): FatigueExperimentState {
  if (typeof window === "undefined") return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_STATE
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = stateSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : DEFAULT_STATE
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data))
    return true
  } catch {
    return false
  }
}
