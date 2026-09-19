import { z } from "zod"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"

// Operational budgets, not physiological limits.
export const FILE_OBSERVATION_LIMITS = {
  bytes: 10 * 1024 * 1024,
  activities: 1000,
  points: 100000,
  laps: 1000,
} as const

const profiles = {
  tcx: "TCX_ACTIVITY_V1",
  csv: "CSV_COLUMNS_V1",
  json: "JSON_COLUMNS_V1",
  gpx: "GPX_TRACK_V1",
} as const
const sport = z.enum(["RUNNING", "WALKING", "CYCLING", "OTHER", "UNKNOWN"])
const durationMeaning = z.enum(["ELAPSED", "TIMER", "MOVING", "SOURCE_DEFINED", "UNKNOWN"])
const measurement = z.number().finite().nonnegative().nullable()
const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const startedAt = z.iso.datetime({ offset: true }).refine(value =>
  /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  && !value.startsWith("0000-") && !value.endsWith("-00:00") && Number.isFinite(Date.parse(value)),
)
const timeZone = z.string().min(1).max(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true } catch { return false }
})
const lap = z.strictObject({
  sourceIndex: z.number().int().nonnegative().max(FILE_OBSERVATION_LIMITS.laps - 1),
  distanceMeters: measurement,
  durationSeconds: measurement,
  durationMeaning,
  kind: z.enum(["WORK", "RECOVERY", "UNKNOWN"]),
})
const fields = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.literal("FILE_UPLOAD"),
  format: z.enum(["tcx", "csv", "json", "gpx"]),
  sourceProfile: z.enum(["TCX_ACTIVITY_V1", "CSV_COLUMNS_V1", "JSON_COLUMNS_V1", "GPX_TRACK_V1"]),
  parserVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u),
  sourceActivityId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,199}$/u).nullable(),
  date: z.iso.date().refine(value => !value.startsWith("0000-")),
  startedAt: startedAt.nullable(),
  timeZone: timeZone.nullable(),
  sport,
  distanceMeters: measurement,
  durationSeconds: measurement,
  durationMeaning,
  laps: z.array(lap).max(FILE_OBSERVATION_LIMITS.laps),
  completeness: z.strictObject({
    missingDistanceLaps: z.number().int().nonnegative().max(FILE_OBSERVATION_LIMITS.laps),
    missingDurationLaps: z.number().int().nonnegative().max(FILE_OBSERVATION_LIMITS.laps),
  }),
  confirmation: z.strictObject({
    durationMeaning: z.enum(["ELAPSED", "TIMER", "MOVING"]).nullable(),
    sport: sport.nullable(),
  }).nullable(),
})

type ObservationFields = z.infer<typeof fields>

/** A total is absent when any lap is missing, there are no laps, or the sum overflows. */
export function completeLapTotal(
  laps: readonly z.infer<typeof lap>[],
  field: "distanceMeters" | "durationSeconds",
): number | null {
  if (laps.length === 0 || laps.some(value => value[field] === null)) return null
  const total = laps.reduce((sum, value) => sum + (value[field] ?? 0), 0)
  return Number.isFinite(total) ? total : null
}

function completenessOf(laps: readonly z.infer<typeof lap>[]): ObservationFields["completeness"] {
  return {
    missingDistanceLaps: laps.filter(value => value.distanceMeters === null).length,
    missingDurationLaps: laps.filter(value => value.durationSeconds === null).length,
  }
}

function validFacts(value: ObservationFields): boolean {
  if (profiles[value.format] !== value.sourceProfile) return false
  if (value.laps.some((entry, index) => entry.sourceIndex !== index)) return false
  const missing = completenessOf(value.laps)
  if (missing.missingDistanceLaps !== value.completeness.missingDistanceLaps
    || missing.missingDurationLaps !== value.completeness.missingDurationLaps) return false
  if (value.format === "tcx" && (
    completeLapTotal(value.laps, "distanceMeters") !== value.distanceMeters
    || completeLapTotal(value.laps, "durationSeconds") !== value.durationSeconds
  )) return false
  if (value.startedAt !== null && value.timeZone !== null) {
    try {
      const parts = new Intl.DateTimeFormat("en", {
        timeZone: value.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date(value.startedAt))
      const part = (type: string) => parts.find(entry => entry.type === type)?.value
      if (`${part("year")?.padStart(4, "0")}-${part("month")}-${part("day")}` !== value.date) return false
    } catch { return false }
  }
  return true
}

function contentFingerprint(value: ObservationFields): string {
  // Explicit projection: processing metadata, identity and athlete confirmation are not facts.
  return canonicalJsonFingerprint("trainoracle.file-observation.content.v1", {
    schemaVersion: value.schemaVersion,
    date: value.date,
    startedAt: value.startedAt,
    timeZone: value.timeZone,
    sport: value.sport,
    distanceMeters: value.distanceMeters,
    durationSeconds: value.durationSeconds,
    durationMeaning: value.durationMeaning,
    laps: value.laps,
    completeness: value.completeness,
  })
}

function sourceKey(value: ObservationFields, sourceIdentityFingerprint: string): string {
  return canonicalJsonFingerprint("trainoracle.file-observation.source.v1", value.sourceActivityId === null
    ? {
      source: value.source,
      sourceProfile: value.sourceProfile,
      sourceIdentityFingerprint,
    }
    : { source: value.source, sourceProfile: value.sourceProfile, sourceActivityId: value.sourceActivityId })
}

export const fileObservationSchema = fields.extend({
  sourceIdentityFingerprint: fingerprint,
  sourceObservationKey: fingerprint,
  contentRevisionFingerprint: fingerprint,
}).refine(value => validFacts(value)
  && value.contentRevisionFingerprint === contentFingerprint(value)
  && value.sourceObservationKey === sourceKey(value, value.sourceIdentityFingerprint), {
  message: "INCONSISTENT_FILE_OBSERVATION",
})

export type FileObservationV1 = z.infer<typeof fileObservationSchema>
export type FileObservationInput = Omit<FileObservationV1,
  "schemaVersion" | "source" | "sourceObservationKey" | "contentRevisionFingerprint" | "completeness" | "sourceIdentityFingerprint"
> & { readonly sourceIdentityFingerprint?: string }

const buildFields = fields.omit({ completeness: true }).extend({
  sourceIdentityFingerprint: fingerprint.optional(),
})

/** Strict, offline validation. A valid digest is not provider authentication or merge authority. */
export function parseFileObservation(candidate: unknown): FileObservationV1 | null {
  const parsed = fileObservationSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/** Trusted adapters supply allowlisted fields; invalid input throws only a fixed safe code. */
export function buildFileObservation(input: FileObservationInput): FileObservationV1 {
  const parsed = buildFields.safeParse({ ...input, schemaVersion: 1, source: "FILE_UPLOAD" })
  if (!parsed.success) throw new Error("INVALID_FILE_OBSERVATION")
  const { sourceIdentityFingerprint: origin, ...facts } = parsed.data
  const value = { ...facts, completeness: completenessOf(facts.laps) }
  if (!validFacts(value)) throw new Error("INVALID_FILE_OBSERVATION")
  const contentRevisionFingerprint = contentFingerprint(value)
  const sourceIdentityFingerprint = origin ?? contentRevisionFingerprint
  return {
    ...value,
    sourceIdentityFingerprint,
    contentRevisionFingerprint,
    sourceObservationKey: sourceKey(value, sourceIdentityFingerprint),
  }
}

/** Compatibility projection only; this does not attest sport or analysis eligibility. */
export function toFileObservationSummary(observation: FileObservationV1): {
  distanceKm: string
  durationMin: string
  avgPace: string
} {
  const { distanceMeters, durationSeconds } = observation
  const meaning = observation.confirmation?.durationMeaning ?? observation.durationMeaning
  let avgPace = ""
  if (meaning !== "SOURCE_DEFINED" && meaning !== "UNKNOWN"
    && distanceMeters !== null && distanceMeters > 0 && durationSeconds !== null && durationSeconds > 0) {
    const seconds = Math.round(durationSeconds / (distanceMeters / 1000))
    if (Number.isFinite(seconds)) avgPace = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  }
  return {
    distanceKm: distanceMeters === null ? "" : String(distanceMeters / 1000),
    durationMin: durationSeconds === null ? "" : String(durationSeconds / 60),
    avgPace,
  }
}
