import { parseAccountJournalRecord } from "./account/account-journal-record-schema"
import { isEligibleForAnalysis } from "./field-provenance"
import { buildFileAnalysisReport, projectFileObservation } from "./import/file-analysis"
import type { FileAnalysisFormat } from "./import/file-analysis-policy"
import type { FileObservationV1 } from "./import/file-observation"
import { parseProviderDataLineage, type ProviderDataField, type ProviderDataLineage } from "./provider-data-rights"

const prepared = new WeakSet<object>()
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u
export type CoachingRecordEvidence = {
  readonly documentId: string
  readonly revision: number
  readonly journalEntryId: string
  readonly date: string
  readonly provider: string
  readonly requiredFields: readonly ProviderDataField[]
  readonly lineage: ProviderDataLineage
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly fileObservation?: FileObservationV1
}
export type CoachingEvidenceFact = {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly unit: string
  readonly sourceDocumentIds: readonly string[]
}

function numeric(value: string): number | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function freezeEvidence<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) freezeEvidence(child)
    Object.freeze(value)
  }
  return value
}

/** Shared canonical projection. Caller independently checks owner, revision, consent and provider rights.
 * A browser EXPLICIT flag is not a provider grant. Private text never enters the returned evidence. */
export function prepareCoachingRecordEvidence(input: {
  readonly documentId: string
  readonly revision: number
  readonly document: unknown
  readonly lineage: unknown
  readonly allowedFormats?: readonly FileAnalysisFormat[]
}): CoachingRecordEvidence | null {
  if (!uuid.test(input.documentId) || !Number.isSafeInteger(input.revision) || input.revision < 1) return null
  const record = parseAccountJournalRecord(input.document)
  const lineage = parseProviderDataLineage(input.lineage)
  if (!record || !lineage || record.entry.kind !== "post-session") return null
  const entry = record.entry
  if (entry.memoPurpose === "PRIVATE_SELF_ONLY"
    || ["WAITING", "REVIEW_REQUIRED", "CONFLICT"].includes(entry.objectiveDataState ?? "")) return null
  let distanceKm: number | null, durationMin: number | null
  let requiredFields: ProviderDataField[]
  let fileObservation: FileObservationV1 | undefined
  if (entry.fileObservation) {
    const projection = projectFileObservation(entry, { formats: input.allowedFormats ?? [], sourceContext: "ACCOUNT_CONFIRMED" })
    if (projection.status !== "ACCEPTED") return null
    fileObservation = entry.fileObservation
    // A verified registry can resolve UNKNOWN origins, but cannot erase a known embedded provider.
    if (fileObservation.dataLineage?.sources.some(source => source.originProvider !== "UNKNOWN"
      && !lineage.sources.some(trusted => trusted.originProvider === source.originProvider))) return null
    if (lineage.sources.some(source => source.transport !== "FILE_UPLOAD")) return null
    distanceKm = projection.observation.distanceMeters === null ? null : projection.observation.distanceMeters / 1000
    durationMin = projection.observation.durationSeconds === null ? null : projection.observation.durationSeconds / 60
    requiredFields = ["sport", ...(distanceKm === null ? [] : ["distanceMeters" as const]),
      ...(durationMin === null ? [] : ["durationSeconds" as const, "durationMeaning" as const])]
  } else {
    distanceKm = isEligibleForAnalysis("distanceKm", entry.fieldProvenance) ? numeric(entry.distanceKm) : null
    durationMin = isEligibleForAnalysis("durationMin", entry.fieldProvenance) ? numeric(entry.durationMin) : null
    requiredFields = [...(distanceKm === null ? [] : ["distanceKm" as const]), ...(durationMin === null ? [] : ["durationMin" as const])]
  }
  if (distanceKm === null && durationMin === null || requiredFields.some(field => !lineage.fieldSources[field]?.length)) return null
  const value: CoachingRecordEvidence = freezeEvidence({ documentId: input.documentId, revision: input.revision,
    journalEntryId: entry.id, date: entry.date, provider: [...new Set(lineage.sources.map(source => source.originProvider))].sort().join("+"),
    requiredFields, lineage, distanceKm, durationMin, ...(fileObservation ? { fileObservation } : {}) })
  prepared.add(value)
  return value
}

const sportLabels = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "기타 종목", UNKNOWN: "종목 미확인" } as const
const timeLabels = { TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "전체 경과 시간", SOURCE_DEFINED: "원천 정의 시간", UNKNOWN: "의미 미확인 시간" } as const
const round = (number: number) => Math.round(number * 1_000_000) / 1_000_000

/** Descriptive facts only. No physiological thresholds, training capacity or safety verdicts. */
export function buildCoachingEvidenceFacts(records: readonly CoachingRecordEvidence[], options: {
  /** Set only after a separate grant check for derived avgPace and every original dependency. */
  readonly includePace?: boolean
} = {}): {
  readonly facts: readonly CoachingEvidenceFact[]
  readonly summaryIds: readonly string[]
  readonly reviewReasons: readonly string[]
  readonly sourceDocumentIds: readonly string[]
} | null {
  if (records.length === 0 || records.length > 20 || records.some(record => !prepared.has(record))
    || new Set(records.map(record => record.documentId)).size !== records.length) return null
  const facts: CoachingEvidenceFact[] = []
  const reviewReasons = new Set<string>()
  const meanings = new Set<string>()
  const add = (label: string, value: number | null, unit: string, sourceDocumentIds: readonly string[]) => {
    if (value === null || !Number.isFinite(value) || sourceDocumentIds.length === 0 || facts.length >= 40) return
    facts.push({ id: `F${facts.length + 1}`, label, value: round(value), unit, sourceDocumentIds: [...new Set(sourceDocumentIds)] })
  }
  // Direct entries have no source-attested sport/time semantics: show each record without inventing a group.
  for (const record of records.filter(value => !value.fileObservation)) {
    meanings.add("USER_REPORTED")
    add("직접 입력한 한 기록의 거리", record.distanceKm, "km", [record.documentId])
    add("직접 입력한 한 기록의 시간 · 시간 의미 미확인", record.durationMin, "min", [record.documentId])
    reviewReasons.add("DIRECT_TIME_MEANING_UNSPECIFIED")
    if (record.distanceKm === null || record.durationMin === null) reviewReasons.add("MISSING_VALUES")
  }
  const files = records.filter(record => record.fileObservation)
  if (files.length > 0) {
    const dates = files.map(record => record.date).sort()
    const report = buildFileAnalysisReport(files.map(record => ({ id: record.documentId, kind: "post-session", date: record.date,
      fileObservation: record.fileObservation })), { formats: ["tcx", "csv", "json", "gpx"], sourceContext: "ACCOUNT_CONFIRMED",
      startDate: dates[0]!, endDate: dates[dates.length - 1]! })
    if (report.duplicateSourceCount > 0) reviewReasons.add("DUPLICATE_SOURCE")
    if (report.conflictingSourceCount > 0) reviewReasons.add("CONFLICTING_SOURCE")
    if (report.excludedSourceCount > 0) reviewReasons.add("EXCLUDED_SOURCE")
    if (report.sports.length > 1) reviewReasons.add("SEPARATE_SPORTS")
    for (const sport of report.sports) {
      const observations = report.observations.filter(value => value.sport === sport.sport)
      add(`${sportLabels[sport.sport]} 기록의 거리 합계`, sport.distanceMeters.value === null ? null : sport.distanceMeters.value / 1000,
        "km", observations.filter(value => value.distanceMeters !== null).map(value => value.journalEntryId))
      if (sport.distanceMeters.excludedCount > 0) reviewReasons.add("MISSING_VALUES")
      for (const time of sport.timeSummaries) {
        const same = observations.filter(value => value.durationMeaning === time.durationMeaning)
        meanings.add(time.durationMeaning)
        if (time.referenceOnly) {
          reviewReasons.add("TIME_MEANING_UNCONFIRMED")
          for (const observation of same) add(`${sportLabels[sport.sport]} 한 기록의 ${timeLabels[time.durationMeaning]} · 참고값`,
            observation.durationSeconds === null ? null : observation.durationSeconds / 60, "min", [observation.journalEntryId])
        } else add(`${sportLabels[sport.sport]} · ${timeLabels[time.durationMeaning]} 합계`,
          time.durationSeconds.value === null ? null : time.durationSeconds.value / 60, "min",
          same.filter(value => value.durationSeconds !== null).map(value => value.journalEntryId))
        if (same.some(value => value.durationSeconds === null)) reviewReasons.add("MISSING_VALUES")
      }
    }
    // Optional pace is the existing accepted algorithm, only where both fields and identical time meaning qualify.
    for (const sport of options.includePace ? report.sports : []) for (const time of sport.timeSummaries) {
      const paired = report.observations.filter(value => value.sport === sport.sport && value.durationMeaning === time.durationMeaning
        && value.distanceMeters !== null && value.distanceMeters > 0 && value.durationSeconds !== null && value.durationSeconds > 0)
      if (!time.referenceOnly) add(`${sportLabels[sport.sport]} · ${timeLabels[time.durationMeaning]} 기준 평균 페이스`,
        time.paceSecondsPerKm.value, "sec/km", paired.map(value => value.journalEntryId))
    }
  }
  if (meanings.size > 1) reviewReasons.add("SEPARATE_TIME_BASIS")
  const summaryIds = ["REVIEW_LIMITS"]
  if (facts.length) summaryIds.push("OBSERVED_TOTALS")
  if (reviewReasons.has("SEPARATE_TIME_BASIS") || reviewReasons.has("SEPARATE_SPORTS")) summaryIds.push("SEPARATE_TIME_BASIS")
  if (reviewReasons.has("MISSING_VALUES") || reviewReasons.has("TIME_MEANING_UNCONFIRMED") || reviewReasons.has("DIRECT_TIME_MEANING_UNSPECIFIED")) summaryIds.push("MISSING_DATA")
  if (reviewReasons.has("DUPLICATE_SOURCE") || reviewReasons.has("CONFLICTING_SOURCE")) summaryIds.push("DUPLICATE_SOURCE")
  return { facts, summaryIds, reviewReasons: [...reviewReasons].sort(), sourceDocumentIds: records.map(record => record.documentId) }
}
