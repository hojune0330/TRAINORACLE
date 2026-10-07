import { z } from "zod"
import { isValidIsoDate } from "./dates"
import { accountScopedStorageKey } from "./account/local-account-scope"

export const DAILY_CONTEXT_STORAGE_KEY = "trainoracle.daily-context.v1"

function activeStorageKey(): string {
  return accountScopedStorageKey(DAILY_CONTEXT_STORAGE_KEY)
}

const dailyContextSchema = z.object({
  date: z.string(),
  mood: z.enum(["LOW", "OKAY", "GOOD"]).nullable(),
  body: z.enum(["TIRED", "NORMAL", "LIGHT"]).nullable(),
  weather: z.enum(["SUNNY", "CLOUDY", "RAINY", "COLD", "HOT"]).nullable(),
})
const dailyContextMapSchema = z.record(z.string(), dailyContextSchema)

export type DailyContext = z.infer<typeof dailyContextSchema>

export type DailyContextReadResult =
  | { readonly kind: "loaded"; readonly context: DailyContext | null }
  | { readonly kind: "unavailable" }

export type DailyContextUpdateResult =
  | { readonly kind: "saved"; readonly context: DailyContext }
  | { readonly kind: "read_unavailable" }
  | { readonly kind: "write_failed" }

type DailyContextMap = Record<string, DailyContext>

function loadMap(storageKey: string): DailyContextMap | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return {}
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = dailyContextMapSchema.safeParse(parsedJson)
    if (!parsed.success) return null
    if (Object.entries(parsed.data).some(([key, context]) => !isValidIsoDate(key) || context.date !== key)) return null
    return parsed.data
  } catch {
    return null
  }
}

export function readDailyContext(date: string): DailyContextReadResult {
  if (!isValidIsoDate(date) || typeof window === "undefined") return { kind: "unavailable" }
  try {
    const map = loadMap(activeStorageKey())
    return map === null
      ? { kind: "unavailable" }
      : { kind: "loaded", context: map[date] ?? null }
  } catch {
    return { kind: "unavailable" }
  }
}

/** Compatibility helper for callers that only need the value; use readDailyContext to handle failures. */
export function loadDailyContext(date: string): DailyContext | null {
  const result = readDailyContext(date)
  return result.kind === "loaded" ? result.context : null
}

export function saveDailyContext(context: DailyContext): boolean {
  if (typeof window === "undefined" || !isValidIsoDate(context.date)) return false
  const parsed = dailyContextSchema.safeParse(context)
  if (!parsed.success) return false
  try {
    const storageKey = activeStorageKey()
    const map = loadMap(storageKey)
    if (map === null) return false
    window.localStorage.setItem(storageKey, JSON.stringify({ ...map, [context.date]: parsed.data }))
    return true
  } catch {
    return false
  }
}

export function updateDailyContext(
  date: string,
  patch: Partial<Pick<DailyContext, "mood" | "body" | "weather">>,
): DailyContextUpdateResult {
  if (typeof window === "undefined" || !isValidIsoDate(date)) return { kind: "read_unavailable" }
  try {
    const storageKey = activeStorageKey()
    const map = loadMap(storageKey)
    if (map === null) return { kind: "read_unavailable" }

    const current = map[date] ?? { date, mood: null, body: null, weather: null }
    const parsed = dailyContextSchema.safeParse({ ...current, ...patch, date })
    if (!parsed.success) return { kind: "write_failed" }

    window.localStorage.setItem(storageKey, JSON.stringify({ ...map, [date]: parsed.data }))
    return { kind: "saved", context: parsed.data }
  } catch {
    return { kind: "write_failed" }
  }
}
