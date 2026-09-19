import { z } from "zod"
import { buildFileObservation, FILE_OBSERVATION_LIMITS, toFileObservationSummary } from "./file-observation"
import type { FileObservationV1 } from "./file-observation"
import type { ActivityParseIssue, ActivityParseIssueCode, ActivityParseResult, ImportedActivity } from "./activity-file"

export type StructuredActivityParseOptions = { readonly observation?: boolean; readonly timeZone?: string }
const columns = new Set(["date", "name", "sport", "distanceKm", "durationMin", "durationMeaning", "sourceActivityId", "startedAt", "timeZone"])
const dateSchema = z.iso.date().refine(value => !value.startsWith("0000-"))
const timestampSchema = z.iso.datetime({ offset: true })
const localTimestampSchema = z.iso.datetime({ local: true })
const meanings = new Set<FileObservationV1["durationMeaning"]>(["ELAPSED", "TIMER", "MOVING", "SOURCE_DEFINED", "UNKNOWN"])

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}

export function activityFileTooLarge(source: string): boolean {
  return source.length > FILE_OBSERVATION_LIMITS.bytes || new TextEncoder().encode(source).byteLength > FILE_OBSERVATION_LIMITS.bytes
}

/** Shared lexical validation, also used for TCX values and signed GPX coordinates. */
export function parseFileNumber(input: unknown, signed = false): { value: number | null; issue: "MISSING" | "INVALID" | null } {
  if (input === undefined || input === null || (typeof input === "string" && input.trim() === "")) return { value: null, issue: "MISSING" }
  if (typeof input !== "number" && typeof input !== "string") return { value: null, issue: "INVALID" }
  const raw = String(input).trim()
  const grammar = signed ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u : /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u
  const value = Number(raw)
  if (!grammar.test(raw) || !Number.isFinite(value) || (!signed && (value < 0 || Object.is(input, -0)))
    || (value === 0 && /[1-9]/u.test(raw.split(/[eE]/u)[0] ?? ""))) return { value: null, issue: "INVALID" }
  return { value, issue: null }
}

function rejected(format: "csv" | "json", code: ActivityParseIssueCode, skipped = 0): ActivityParseResult {
  return { activities: [], skipped, format, issues: [{ code, activityIndex: null, count: 1 }] }
}

function sportOf(value: unknown): FileObservationV1["sport"] {
  switch (text(value).toUpperCase()) {
    case "RUNNING": return "RUNNING"
    case "WALKING": return "WALKING"
    case "BIKING": case "CYCLING": return "CYCLING"
    case "OTHER": return "OTHER"
    default: return "UNKNOWN"
  }
}

function rowObservation(row: Record<string, unknown>, format: "csv" | "json", options: StructuredActivityParseOptions,
  issue: (code: ActivityParseIssueCode) => void): FileObservationV1 | null {
  const date = text(row.date)
  if (!dateSchema.safeParse(date).success) { issue(date === "" ? "MISSING_DATE" : "INVALID_DATE"); return null }
  const measure = (raw: unknown, multiplier: number, missing: ActivityParseIssueCode, invalid: ActivityParseIssueCode) => {
    const parsed = parseFileNumber(raw)
    if (parsed.issue !== null) { issue(parsed.issue === "MISSING" ? missing : invalid); return null }
    const result = parsed.value! * multiplier
    if (!Number.isFinite(result)) { issue(invalid); return null }
    return result
  }
  const distanceMeters = measure(row.distanceKm, 1000, "MISSING_DISTANCE", "INVALID_DISTANCE")
  const durationSeconds = measure(row.durationMin, 60, "MISSING_DURATION", "INVALID_DURATION")
  if (distanceMeters === null && durationSeconds === null) { issue("NO_MEASUREMENTS"); return null }
  let durationMeaning: FileObservationV1["durationMeaning"] = durationSeconds === null ? "UNKNOWN" : "SOURCE_DEFINED"
  if (row.durationMeaning !== undefined && row.durationMeaning !== null && row.durationMeaning !== "") {
    if (typeof row.durationMeaning === "string" && meanings.has(row.durationMeaning as FileObservationV1["durationMeaning"])) durationMeaning = row.durationMeaning as FileObservationV1["durationMeaning"]
    else { issue("INVALID_DURATION_MEANING"); durationMeaning = "UNKNOWN" }
  }
  let timeZone: string | null = null
  let invalidDeclaredZone = false
  if (row.timeZone !== undefined && row.timeZone !== null && row.timeZone !== "") {
    try {
      if (typeof row.timeZone !== "string" || row.timeZone.length > 100 || row.timeZone.trim() !== row.timeZone) throw new Error()
      new Intl.DateTimeFormat("en", { timeZone: row.timeZone })
      timeZone = row.timeZone
    } catch { issue("INVALID_TIMEZONE"); invalidDeclaredZone = true }
  }
  let startedAt: string | null = null
  const start = text(row.startedAt)
  if (start !== "") {
    if (timestampSchema.safeParse(start).success && /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(start)
      && !start.startsWith("0000-") && !start.endsWith("-00:00") && Number.isFinite(Date.parse(start))) {
      const zone = timeZone ?? options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      try {
        if (invalidDeclaredZone) {
          if (start.slice(0, 10) === date) startedAt = start
          else issue("DATE_TIME_CONFLICT")
        } else {
          const parts = new Intl.DateTimeFormat("en", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(start))
          const part = (type: string) => parts.find(value => value.type === type)?.value
          if (`${part("year")?.padStart(4, "0")}-${part("month")}-${part("day")}` !== date) issue("DATE_TIME_CONFLICT")
          else { startedAt = start; timeZone = zone }
        }
      } catch { issue("INVALID_TIMEZONE") }
    } else if (localTimestampSchema.safeParse(start).success || (start.endsWith("-00:00") && timestampSchema.safeParse(start).success)) issue("TIMEZONE_REQUIRED")
    else issue("INVALID_TIMESTAMP")
  } else if (row.startedAt !== undefined && row.startedAt !== null && row.startedAt !== "") issue("INVALID_TIMESTAMP")
  let sourceActivityId: string | null = null
  if (row.sourceActivityId !== undefined && row.sourceActivityId !== null && row.sourceActivityId !== "") {
    const id = text(row.sourceActivityId)
    if (/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,199}$/u.test(id)
      && (typeof row.sourceActivityId === "string" || (typeof row.sourceActivityId === "number" && Number.isSafeInteger(row.sourceActivityId) && row.sourceActivityId >= 0))) sourceActivityId = id
    else issue("INVALID_SOURCE_ID")
  }
  return buildFileObservation({
    format, sourceProfile: format === "csv" ? "CSV_COLUMNS_V1" : "JSON_COLUMNS_V1", parserVersion: `${format}-observation-1`,
    sourceActivityId, date, startedAt, timeZone, sport: sportOf(row.sport),
    distanceMeters, durationSeconds, durationMeaning, laps: [], confirmation: null,
  })
}

function rowsResult(rows: readonly unknown[], format: "csv" | "json", options: StructuredActivityParseOptions): ActivityParseResult {
  if (rows.length > FILE_OBSERVATION_LIMITS.activities) return rejected(format, "ACTIVITY_LIMIT_EXCEEDED", rows.length)
  if (rows.length === 0) return rejected(format, "NO_MEASUREMENTS")
  const activities: ImportedActivity[] = []
  const issues: ActivityParseIssue[] = []
  let skipped = 0
  for (const [activityIndex, row] of rows.entries()) {
    const codes = new Map<ActivityParseIssueCode, number>()
    const issue = (code: ActivityParseIssueCode) => { codes.set(code, (codes.get(code) ?? 0) + 1) }
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      issues.push({ code: format === "csv" ? "CSV_COLUMN_COUNT" : "INVALID_ROW", activityIndex, count: 1 })
      skipped += 1
      continue
    }
    const fields = row as Record<string, unknown>
    const observation = rowObservation(fields, format, options, issue)
    for (const [code, count] of codes) issues.push({ code, activityIndex, count })
    if (observation === null) { skipped += 1; continue }
    activities.push({
      date: observation.date,
      name: options.observation === true ? observation.sport === "RUNNING" ? "가져온 달리기" : "가져온 활동" : text(fields.name) || "가져온 활동",
      sport: text(fields.sport) || "unknown",
      ...toFileObservationSummary(observation),
      ...(options.observation === true ? { observation } : {}),
    })
  }
  return { activities, skipped, format, ...(issues.length > 0 ? { issues } : {}) }
}

// Budget-only lexical scan before JSON.parse can allocate a large activity array.
// JSON.parse remains the syntax authority, including escaped property names and strings.
function jsonExceedsActivityLimit(source: string): boolean {
  let depth = 0
  let targetDepth = -1
  let count = 0
  let expectingValue = false
  let activitiesArrayAt = -1
  const nextNonspace = (from: number) => { let at = from; while (at < source.length && /\s/u.test(source[at] ?? "")) at += 1; return at }
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === undefined || /\s/u.test(character)) continue
    if (targetDepth === depth && expectingValue && character !== "]") {
      count += 1
      expectingValue = false
      if (count > FILE_OBSERVATION_LIMITS.activities) return true
    }
    if (character === '"') {
      const start = index
      for (index += 1; index < source.length; index += 1) {
        if (source[index] === "\\") index += 1
        else if (source[index] === '"') break
      }
      if (depth === 1 && source[nextNonspace(index + 1)] === ":") {
        try {
          if (JSON.parse(source.slice(start, index + 1)) === "activities") activitiesArrayAt = nextNonspace(nextNonspace(index + 1) + 1)
        } catch { return false }
      }
    } else if (character === "[" || character === "{") {
      if (character === "[" && (depth === 0 || index === activitiesArrayAt)) { targetDepth = depth + 1; count = 0; expectingValue = true }
      depth += 1
    } else if (character === "]" || character === "}") {
      if (depth === targetDepth) targetDepth = -1
      depth -= 1
    } else if (character === "," && depth === targetDepth) expectingValue = true
  }
  return false
}

export function parseJsonActivities(source: string, options: StructuredActivityParseOptions = {}): ActivityParseResult | null {
  if (activityFileTooLarge(source)) return rejected("json", "FILE_TOO_LARGE")
  if (jsonExceedsActivityLimit(source)) return rejected("json", "ACTIVITY_LIMIT_EXCEEDED")
  let parsed: unknown
  try { parsed = JSON.parse(source) } catch { return rejected("json", "INVALID_FILE") }
  const rows = Array.isArray(parsed) ? parsed : parsed !== null && typeof parsed === "object" && "activities" in parsed ? parsed.activities : null
  return Array.isArray(rows) ? rowsResult(rows, "json", options) : rejected("json", "INVALID_FILE")
}

export function parseCsvActivities(source: string, options: StructuredActivityParseOptions = {}): ActivityParseResult | null {
  if (activityFileTooLarge(source)) return rejected("csv", "FILE_TOO_LARGE")
  const rows: unknown[] = []
  const header: string[] = []
  const seenHeaders = new Set<string>()
  let haveHeader = false
  let fields: Record<string, string> = {}
  let column = 0
  let cell = ""
  let cellStarted = false
  let nonempty = false
  let quoted = false
  let closedQuote = false
  let error: ActivityParseIssueCode | null = null
  let unsupported = false
  const finishCell = () => {
    if (!haveHeader) {
      const key = cell.trim()
      if (key === "") error = "CSV_INVALID_HEADER"
      else if (seenHeaders.has(key)) error = "CSV_DUPLICATE_HEADER"
      seenHeaders.add(key)
      header.push(key)
    } else {
      const key = header[column]
      if (key !== undefined && columns.has(key)) fields[key] = cell
    }
    column += 1
    cell = ""
    cellStarted = false
    closedQuote = false
  }
  const finishRow = () => {
    if (!nonempty && column === 0 && cell.trim() === "") { cell = ""; cellStarted = false; closedQuote = false; return }
    finishCell()
    if (!haveHeader) {
      haveHeader = true
      unsupported = !seenHeaders.has("date") || (!seenHeaders.has("distanceKm") && !seenHeaders.has("durationMin"))
    } else if (rows.length >= FILE_OBSERVATION_LIMITS.activities) error = "ACTIVITY_LIMIT_EXCEEDED"
    else rows.push(column === header.length ? fields : null)
    fields = {}
    column = 0
    nonempty = false
  }
  const input = source.replace(/^\uFEFF/u, "")
  for (let index = 0; index < input.length && error === null && !unsupported; index += 1) {
    const character = input[index]!
    const capture = !haveHeader || columns.has(header[column] ?? "")
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { if (capture) cell += '"'; index += 1; nonempty = true }
        else { quoted = false; closedQuote = true }
      } else { if (capture) cell += character; if (character.trim() !== "") nonempty = true }
    } else if (character === ",") { finishCell(); nonempty = true }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1
      finishRow()
    } else if (character === '"' && !cellStarted && !closedQuote) { quoted = true; cellStarted = true; nonempty = true }
    else if (closedQuote || character === '"') error = "CSV_INVALID_QUOTES"
    else { if (capture) cell += character; cellStarted = true; if (character.trim() !== "") nonempty = true }
  }
  if (unsupported) return null
  if (quoted) error = "CSV_INVALID_QUOTES"
  if (error === null) finishRow()
  if (error !== null) return rejected("csv", error)
  if (unsupported) return null
  if (!haveHeader) return null
  if (rows.length === 0) return rejected("csv", "NO_MEASUREMENTS")
  return rowsResult(rows, "csv", options)
}
