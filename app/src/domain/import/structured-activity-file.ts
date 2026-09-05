import { z } from "zod"
import { isValidIsoDate } from "../dates"
import type { ActivityParseResult, ImportedActivity } from "./activity-file"

const valueSchema = z.union([z.string(), z.number()])
const rowSchema = z.object({
  date: valueSchema,
  name: valueSchema.optional(),
  sport: valueSchema.optional(),
  distanceKm: valueSchema.optional(),
  durationMin: valueSchema.optional(),
})

function text(value: string | number | undefined): string {
  return value === undefined ? "" : String(value).trim()
}

function positive(value: string | number | undefined): number {
  const parsed = Number.parseFloat(text(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function paceOf(distanceKm: number, durationMin: number): string {
  if (distanceKm <= 0 || durationMin <= 0) return ""
  const totalSeconds = Math.round((durationMin * 60) / distanceKm)
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`
}

function toActivity(candidate: unknown): ImportedActivity | null {
  const parsed = rowSchema.safeParse(candidate)
  if (!parsed.success) return null
  const date = text(parsed.data.date)
  if (!isValidIsoDate(date)) return null
  const distanceKm = positive(parsed.data.distanceKm)
  const durationMin = positive(parsed.data.durationMin)
  if (distanceKm === 0 && durationMin === 0) return null
  return {
    date,
    name: text(parsed.data.name) || "가져온 활동",
    sport: text(parsed.data.sport) || "unknown",
    distanceKm: distanceKm > 0 ? distanceKm.toFixed(2) : "",
    durationMin: durationMin > 0 ? String(durationMin) : "",
    avgPace: paceOf(distanceKm, durationMin),
  }
}

function rowsResult(rows: readonly unknown[], format: "csv" | "json"): ActivityParseResult {
  const activities: ImportedActivity[] = []
  let skipped = 0
  for (const row of rows) {
    const activity = toActivity(row)
    if (activity === null) skipped += 1
    else activities.push(activity)
  }
  return { activities, skipped, format }
}

export function parseJsonActivities(source: string): ActivityParseResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
  if (Array.isArray(parsed)) return rowsResult(parsed, "json")
  const container = z.object({ activities: z.array(z.unknown()) }).safeParse(parsed)
  return container.success ? rowsResult(container.data.activities, "json") : null
}

function parseCsvRows(source: string): readonly (readonly string[])[] | null {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? ""
    const next = source[index + 1] ?? ""
    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === "," && !quoted) {
      row.push(cell)
      cell = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== "")) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += character
    }
  }
  if (quoted) return null
  row.push(cell)
  if (row.some((value) => value.trim() !== "")) rows.push(row)
  return rows
}

export function parseCsvActivities(source: string): ActivityParseResult | null {
  const rows = parseCsvRows(source)
  if (rows === null || rows.length < 2) return null
  const [header, ...values] = rows
  if (header === undefined) return null
  const keys = header.map((value) => value.trim())
  if (!keys.includes("date") || !keys.some((key) => key === "distanceKm" || key === "durationMin")) {
    return null
  }
  const objects = values.map((columns) => Object.fromEntries(
    keys.map((key, index) => [key, columns[index] ?? ""]),
  ))
  return rowsResult(objects, "csv")
}
