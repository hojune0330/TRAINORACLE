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

function loadMap(): Record<string, DailyContext> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(activeStorageKey())
    if (raw === null) return {}
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = dailyContextMapSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : {}
  } catch (error) {
    if (error instanceof SyntaxError) return {}
    throw error
  }
}

export function loadDailyContext(date: string): DailyContext | null {
  if (!isValidIsoDate(date)) return null
  return loadMap()[date] ?? null
}

export function saveDailyContext(context: DailyContext): boolean {
  if (typeof window === "undefined" || !isValidIsoDate(context.date)) return false
  const parsed = dailyContextSchema.safeParse(context)
  if (!parsed.success) return false
  try {
    window.localStorage.setItem(activeStorageKey(), JSON.stringify({ ...loadMap(), [context.date]: parsed.data }))
    return true
  } catch {
    return false
  }
}
