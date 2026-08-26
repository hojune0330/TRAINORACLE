import { z } from "zod"
import {
  accountScopedStorageKey,
  accountScopedStorageKeyFor,
} from "./account/local-account-scope"

export const ATHLETE_RECORDS_STORAGE_KEY = "trainoracle.athlete-records.v1"

export function activeAthleteRecordsStorageKey(): string {
  return accountScopedStorageKey(ATHLETE_RECORDS_STORAGE_KEY)
}
export {
  SEASON_WINDOW_MONTHS,
  athleteRecordAuthorityCopy,
  elapsedSinceAchieved,
  formatRecordTime,
  recordPurposeLabel,
  seasonWindowLabel,
} from "./athlete-record-display"

export const RECORD_PURPOSES = [
  "PERSONAL_BEST",
  "SEASON_BEST",
  "RECENT_RESULT",
  "RACE_GOAL",
] as const

export type RecordPurpose = (typeof RECORD_PURPOSES)[number]
export type RecordEnteredBy = "ATHLETE" | "COACH" | "VERIFIED_IMPORT"
export type RecordVerificationState =
  | "VERIFIED"
  | "SELF_REPORTED"
  | "UNVERIFIED"

type AthleteRecordBase = {
  readonly schemaVersion: 1
  readonly id: string
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly enteredBy: RecordEnteredBy
  readonly verificationState: RecordVerificationState
  readonly sourceRef: string
  readonly savedAt: string
}

export type AthleteRecord =
  | AthleteRecordBase & {
      readonly purpose: "PERSONAL_BEST" | "RECENT_RESULT"
      readonly achievedOn: string
      readonly seasonId: null
    }
  | AthleteRecordBase & {
      readonly purpose: "SEASON_BEST"
      readonly achievedOn: string
      readonly seasonId: string
    }
  | AthleteRecordBase & {
      readonly purpose: "RACE_GOAL"
      readonly achievedOn: null
      readonly seasonId: null
    }

export type SelfReportedAthleteRecordInput = {
  readonly id: string
  readonly purpose: RecordPurpose
  readonly eventDistanceM: number
  readonly performanceSeconds: number
  readonly achievedOn: string | null
  readonly seasonId: string | null
}

export type SaveAthleteRecordResult = {
  readonly ok: boolean
  readonly total: number
}

export type AthleteRecordsReadResult =
  | { readonly kind: "loaded"; readonly records: AthleteRecord[] }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid" }
  | { readonly kind: "storage_error" }

const privateRecordIdToken = /(?:memo|note|symptom)/iu
export const athleteRecordIdSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
  .refine(
    (value) => !privateRecordIdToken.test(value),
    "record ID must not contain private-text field names",
  )
const enteredBySchema = z.enum(["ATHLETE", "COACH", "VERIFIED_IMPORT"])
const verificationSchema = z.enum(["VERIFIED", "SELF_REPORTED", "UNVERIFIED"])

function recordSchema(today: Date) {
  const achievedOnSchema = z.string().refine(
    isCalendarDate,
    "invalid calendar date",
  ).refine(
    (value) => compareCalendarDateToToday(value, today) <= 0,
    "future achieved date",
  )
  const base = {
    schemaVersion: z.literal(1),
    id: athleteRecordIdSchema,
    eventDistanceM: z.number().finite().min(60),
    performanceSeconds: z.number().finite().positive(),
    enteredBy: enteredBySchema,
    verificationState: verificationSchema,
    sourceRef: z.string().min(1).max(160),
    savedAt: z.string().datetime(),
  }
  return z.discriminatedUnion("purpose", [
    z.object({
      ...base,
      purpose: z.literal("PERSONAL_BEST"),
      achievedOn: achievedOnSchema,
      seasonId: z.null(),
    }).strict(),
    z.object({
      ...base,
      purpose: z.literal("RECENT_RESULT"),
      achievedOn: achievedOnSchema,
      seasonId: z.null(),
    }).strict(),
    z.object({
      ...base,
      purpose: z.literal("SEASON_BEST"),
      achievedOn: achievedOnSchema,
      seasonId: z.string().trim().min(1).max(80),
    }).strict(),
    z.object({
      ...base,
      purpose: z.literal("RACE_GOAL"),
      achievedOn: z.null(),
      seasonId: z.null(),
    }).strict(),
  ]).superRefine((record, context) => {
    if (record.sourceRef !== `athlete-record:${record.id}`) {
      context.addIssue({
        code: "custom",
        path: ["sourceRef"],
        message: "sourceRef must be the record's opaque local reference",
      })
    }
    if (record.enteredBy === "ATHLETE" && record.verificationState === "VERIFIED") {
      context.addIssue({
        code: "custom",
        path: ["verificationState"],
        message: "athlete self-entry cannot claim external verification",
      })
    }
    if (
      record.enteredBy === "VERIFIED_IMPORT"
      && record.verificationState !== "VERIFIED"
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationState"],
        message: "verified import must preserve its verified state",
      })
    }
  })
}

export function createSelfReportedAthleteRecord(
  input: SelfReportedAthleteRecordInput,
  now: Date,
): AthleteRecord | null {
  return parseAthleteRecord({
    ...input,
    schemaVersion: 1,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: `athlete-record:${input.id}`,
    savedAt: now.toISOString(),
  }, now)
}

export function loadAthleteRecords(today: Date = new Date()): AthleteRecord[] {
  return loadAthleteRecordsForAccount(undefined, today)
}

export function loadAthleteRecordsForAccount(
  accountScope: string | null | undefined,
  today: Date = new Date(),
): AthleteRecord[] {
  const result = readAthleteRecordsForAccount(accountScope, today)
  return result.kind === "loaded" ? result.records : []
}

export function readAthleteRecordsForAccount(
  accountScope: string | null | undefined,
  today: Date = new Date(),
): AthleteRecordsReadResult {
  const localStorage = getStorage()
  if (localStorage === null) return { kind: "storage_error" }
  const storageKey = accountScope === undefined
    ? activeAthleteRecordsStorageKey()
    : accountScopedStorageKeyFor(ATHLETE_RECORDS_STORAGE_KEY, accountScope)
  const result = readRecords(localStorage, storageKey, today)
  if (!result.ok) return { kind: "invalid" }
  return result.missing
    ? { kind: "missing" }
    : { kind: "loaded", records: result.records }
}

export function saveAthleteRecord(
  candidate: unknown,
  today: Date = new Date(),
): SaveAthleteRecordResult {
  const localStorage = getStorage()
  if (localStorage === null) return { ok: false, total: 0 }
  const storageKey = activeAthleteRecordsStorageKey()
  const current = readRecords(localStorage, storageKey, today)
  if (!current.ok) return { ok: false, total: 0 }
  const record = parseAthleteRecord(candidate, today)
  if (record === null || current.records.some((item) => item.id === record.id)) {
    return { ok: false, total: current.records.length }
  }
  const next = [...current.records, record]
  try {
    const serialized = JSON.stringify(next)
    const previous = localStorage.getItem(storageKey)
    localStorage.setItem(storageKey, serialized)
    if (localStorage.getItem(storageKey) === serialized) {
      return { ok: true, total: next.length }
    }
    previous === null ? localStorage.removeItem(storageKey) : localStorage.setItem(storageKey, previous)
    return { ok: false, total: current.records.length }
  } catch {
    return { ok: false, total: current.records.length }
  }
}

export function achievedDateError(
  value: string,
  today: Date,
): "INVALID_DATE" | "FUTURE_DATE" | null {
  if (!isCalendarDate(value)) return "INVALID_DATE"
  return compareCalendarDateToToday(value, today) > 0 ? "FUTURE_DATE" : null
}

function parseAthleteRecord(candidate: unknown, today: Date): AthleteRecord | null {
  const result = recordSchema(today).safeParse(candidate)
  return result.success ? result.data : null
}

function readRecords(
  localStorage: Storage,
  storageKey: string,
  today: Date,
): { readonly ok: boolean; readonly missing: boolean; readonly records: AthleteRecord[] } {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return { ok: true, missing: true, records: [] }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { ok: false, missing: false, records: [] }
    const records: AthleteRecord[] = []
    const ids = new Set<string>()
    for (const candidate of parsed) {
      const record = parseAthleteRecord(candidate, today)
      if (record === null || ids.has(record.id)) return { ok: false, missing: false, records: [] }
      ids.add(record.id)
      records.push(record)
    }
    return { ok: true, missing: false, records }
  } catch {
    return { ok: false, missing: false, records: [] }
  }
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function isCalendarDate(value: string): boolean {
  const parts = calendarParts(value)
  if (parts === null) return false
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return (
    date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
  )
}

function compareCalendarDateToToday(value: string, today: Date): number {
  const todayValue = (
    today.getFullYear() * 10_000
    + (today.getMonth() + 1) * 100
    + today.getDate()
  )
  const parts = calendarParts(value)
  if (parts === null) return 1
  return parts.year * 10_000 + parts.month * 100 + parts.day - todayValue
}

function calendarParts(
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
  if (match === null) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}
