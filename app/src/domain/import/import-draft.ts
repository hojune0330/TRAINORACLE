// 가져온 활동 → 일지 초안 변환 + 중복 감지 + 확인 저장 (IMP-2/IMP-4 일부).
//
// 원칙:
//  - 무단 자동 저장 없음: 항상 "초안 → 사용자 확인 → 저장".
//  - RPE·메모는 자동 대체 불가 — 초안에서 비워두고 사용자가 채운다(RPE 0 = 미입력).
//  - 출처 표기: fieldProvenance DERIVED(derivedFrom: ["import:activity-file"]).
//    등록된 파생 규칙이 아니므로 가져온 값은 통계·추이·훈련계획에서 제외된다.
//    일지에서는 그대로 보이고, 화면에는 "가져옴" 배지가 붙는다.
//  - 중복 감지: 같은 날짜에 비슷한 활동(거리 0.2km 이내, 없으면 시간 2분 이내)이
//    이미 있으면 초안에 표시한다. 자동 병합·자동 제외는 하지 않는다.
import type { ImportedActivity } from "./activity-file"
import type { FieldProvenanceMap } from "../field-provenance"
import type { JournalEntry, PostSessionEntry } from "../journal-schema"
import { legacyJournalWritesBlocked, loadEntries, newEntryId, saveEntry, updateEntryPreservingMemo } from "../journal-store"
import { canEditJournalEntry } from "../journal-edit-policy"
import type { AccountJournalWriteBase } from "../account/account-journal-record-service"
import { parseFileObservation, toFileObservationSummary, type FileObservationV1 } from "./file-observation"

/** 가져오기 파생 입력 토큰 — 일지 필드가 아니라 "파일에서 왔다"는 표시 */
export const IMPORT_DERIVED_FROM = ["import:activity-file"] as const

export type ImportFormat = "tcx" | "gpx" | "csv" | "json"

export type ImportIdentityCandidate = Pick<PostSessionEntry, "id" | "savedAt" | "activitySlot" | "title"> & {
  readonly kind: "REUSE" | "ATTACH" | "CORRECTION"
}

export type ImportDraft = {
  readonly accountWriteBases?: Readonly<Record<string, Pick<AccountJournalWriteBase, "revision" | "contentFingerprint">>>
  readonly sourceIndex?: number
  readonly activity: ImportedActivity
  /** 같은 날 비슷한 활동의 기존 일지 id — 있으면 UI가 "이미 있는 것 같아요" 표시 */
  readonly duplicateOf: string | null
  readonly reconciliationCandidates: readonly Pick<PostSessionEntry, "id" | "savedAt" | "activitySlot" | "title">[]
  readonly identityCandidates?: readonly ImportIdentityCandidate[]
  readonly requiresIdentityChoice?: boolean
  /** Review hint only; never a persisted source identity. */
  readonly batchDuplicateOf?: number
}

export type ImportSaveIntent =
  | { readonly kind: "SAVE_SEPARATE"; readonly confirmedSeparate?: true }
  | { readonly kind: "ADD_TO_EXISTING"; readonly entryId: string; readonly expectedSavedAt: string }
  | { readonly kind: "USE_EXISTING"; readonly entryId: string; readonly expectedSavedAt: string }
  | { readonly kind: "EXCLUDE" }

export type ImportDraftSelection = { readonly draft: ImportDraft; readonly intent: ImportSaveIntent }

export type ImportSaveResult = {
  readonly account?: number
  readonly pending?: number
  readonly saved: number
  readonly merged?: number
  readonly reused?: number
  readonly excluded?: number
  readonly conflicts?: number
  readonly failed: number
  readonly total: number
  readonly stopReason?: "ACCOUNT_UNAVAILABLE" | "SAVE_REJECTED"
}

function numeric(value: string): number | null {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Called only after the athlete confirms the import. It does not assert a time meaning. */
export function confirmedFileActivity(activity: ImportedActivity, format: ImportFormat): ImportedActivity | null {
  const parsed = parseFileObservation(activity.observation)
  if (!parsed || parsed.format !== format || parsed.date !== activity.date) return null
  const observation: FileObservationV1 = { ...parsed,
    confirmation: parsed.confirmation ?? { durationMeaning: null, sport: null } }
  return { ...activity, ...toFileObservationSummary(observation), observation }
}

/** 같은 활동으로 볼 만한지 — 거리 우선, 거리를 못 읽으면 시간으로 판단 */
function looksLikeSameActivity(existing: PostSessionEntry, activity: ImportedActivity): boolean {
  const existingKm = numeric(existing.distanceKm)
  const activityKm = numeric(activity.distanceKm)
  if (existingKm !== null && activityKm !== null) {
    return Math.abs(existingKm - activityKm) <= 0.2
  }

  const existingMin = numeric(existing.durationMin)
  const activityMin = numeric(activity.durationMin)
  if (existingMin !== null && activityMin !== null) {
    return Math.abs(existingMin - activityMin) <= 2
  }
  return false
}

export function sameFileObservation(left: FileObservationV1, right: FileObservationV1): boolean {
  const confirmation = (value: FileObservationV1) => value.confirmation ?? { durationMeaning: null, sport: null }
  return left.contentRevisionFingerprint === right.contentRevisionFingerprint
    && confirmation(left).durationMeaning === confirmation(right).durationMeaning
    && confirmation(left).sport === confirmation(right).sport
}

/** Candidates are hints, not merge authority. A fresh private revision is checked at save. */
export function fileImportCandidateKind(entry: JournalEntry, activity: ImportedActivity): ImportIdentityCandidate["kind"] | null {
  const observation = parseFileObservation(activity.observation)
  return observation ? identityCandidateKind(entry, activity, observation) : null
}

function identityCandidateKind(entry: JournalEntry, activity: ImportedActivity, observation: FileObservationV1): ImportIdentityCandidate["kind"] | null {
  if (entry.kind !== "post-session") return null
  const previous = entry.fileObservation
  if (previous) {
    const sameSource = previous.sourceObservationKey === observation.sourceObservationKey
    const noIdCandidate = observation.sourceActivityId === null && previous.sourceProfile === observation.sourceProfile
      && previous.contentRevisionFingerprint === observation.contentRevisionFingerprint
    return sameSource || noIdCandidate ? sameFileObservation(previous, observation) ? "REUSE" : "CORRECTION" : null
  }
  if (entry.date !== activity.date || entry.fieldProvenance === undefined || !looksLikeSameActivity(entry, activity)) return null
  const summary = toFileObservationSummary(observation)
  return (["distanceKm", "durationMin", "avgPace"] as const).every(field => {
    const provenance = entry.fieldProvenance?.[field]
    return entry[field] === "" || entry[field] === summary[field]
      || provenance?.provenance === "DERIVED" && provenance.derivedFrom.includes("import:activity-file")
  }) ? "ATTACH" : null
}

export function buildImportDrafts(
  activities: readonly ImportedActivity[],
  existing: readonly JournalEntry[] = loadEntries(),
): ImportDraft[] {
  const firstNoId = new Map<string, number>()
  const noIdCounts = new Map<string, number>()
  const entryCounts = new Map<string, number>()
  for (const entry of existing) entryCounts.set(entry.id, (entryCounts.get(entry.id) ?? 0) + 1)
  for (const activity of activities) {
    const observation = activity.observation
    if (observation?.sourceActivityId === null) noIdCounts.set(observation.sourceObservationKey,
      (noIdCounts.get(observation.sourceObservationKey) ?? 0) + 1)
  }
  return activities.map((activity, sourceIndex) => {
    const observation = parseFileObservation(activity.observation)
    const duplicate = existing.find(
      (entry): entry is PostSessionEntry =>
        entry.kind === "post-session"
        && entry.date === activity.date
        && looksLikeSameActivity(entry, activity),
    )
    // Capture depth is not identity. AM/PM candidates stay unselected until
    // the athlete chooses one exact entry and confirms its saved revision.
    const reconciliationCandidates = existing
      .filter((entry): entry is PostSessionEntry => isWaitingCandidate(entry, activity.date)
        && entryCounts.get(entry.id) === 1)
      .map(({ id, savedAt, activitySlot, title }) => ({ id, savedAt, activitySlot, title }))
    const identityCandidates: ImportIdentityCandidate[] = existing.flatMap(entry => {
      const kind = observation ? identityCandidateKind(entry, activity, observation) : null
      if (!kind || entry.kind !== "post-session" || entryCounts.get(entry.id) !== 1) return []
      const { id, savedAt, activitySlot, title } = entry
      return [{ id, savedAt, activitySlot, title, kind }]
    })
    const batchDuplicateOf = observation?.sourceActivityId === null ? firstNoId.get(observation.sourceObservationKey) : undefined
    if (observation?.sourceActivityId === null && batchDuplicateOf === undefined) firstNoId.set(observation.sourceObservationKey, sourceIndex)
    const requiresIdentityChoice = observation !== null && (observation.sourceActivityId === null
      ? duplicate !== undefined || identityCandidates.length > 0 || (noIdCounts.get(observation.sourceObservationKey) ?? 0) > 1
      : !identityCandidates.some(candidate => candidate.kind === "REUSE") && identityCandidates.some(candidate => candidate.kind === "ATTACH"))
    return { activity, duplicateOf: duplicate?.id ?? null, reconciliationCandidates,
      identityCandidates, requiresIdentityChoice, ...(batchDuplicateOf === undefined ? {} : { batchDuplicateOf }) }
  })
}

export function importedProvenance(activity: ImportedActivity, format: ImportFormat): FieldProvenanceMap {
  const ruleId = `import:${format}`
  const derived = (hasValue: boolean) =>
    hasValue
      ? {
          provenance: "DERIVED" as const,
          derivedFrom: [...IMPORT_DERIVED_FROM],
          derivationRuleId: ruleId,
        }
      : { provenance: "MISSING" as const }

  return {
    distanceKm: derived(activity.distanceKm !== ""),
    durationMin: derived(activity.durationMin !== ""),
    avgPace: derived(activity.avgPace !== ""),
    // RPE·주관 감각은 파일에 없다 — 사용자가 직접 채울 몫으로 비워 둔다.
    rpe: { provenance: "MISSING" },
  }
}

function hasObjectiveValue(entry: PostSessionEntry): boolean {
  return entry.distanceKm.trim() !== ""
    || entry.durationMin.trim() !== ""
    || entry.avgPace.trim() !== ""
}

export function isWaitingCandidate(entry: JournalEntry, date: string): entry is PostSessionEntry {
  return entry.kind === "post-session"
    && entry.date === date
    && canEditJournalEntry(entry)
    && (entry.activityOutcome === "COMPLETED" || entry.activityOutcome === "PARTIAL" || entry.activityOutcome === "LIGHT_ACTIVITY")
    && entry.objectiveDataState === "WAITING"
    && !hasObjectiveValue(entry)
}

export type ImportDraftConfirmationResult = ImportSaveResult & {
  readonly merged: number
  readonly conflicts: number
}

/**
 * Similarity is only a warning. Reconciliation requires a separate, explicit
 * target and revision; neither stale choices nor conflicts overwrite facts.
 */
export function confirmImportDrafts(
  selections: readonly ImportDraftSelection[],
  format: ImportFormat,
): ImportDraftConfirmationResult {
  if (legacyJournalWritesBlocked()) return { saved: 0, merged: 0, conflicts: 0, failed: selections.length, total: loadEntries().length }
  let saved = 0
  let merged = 0
  let conflicts = 0
  let failed = 0
  let excluded = 0
  let total = loadEntries().length

  for (const { draft, intent } of selections) {
    if (intent?.kind === "EXCLUDE") { excluded++; continue }
    if (intent?.kind === "SAVE_SEPARATE") {
      const result = saveImportedActivity(draft.activity, format)
      if (result.ok) saved += 1
      else failed += 1
      total = result.total
      continue
    }

    if (intent?.kind !== "ADD_TO_EXISTING") {
      failed += 1
      continue
    }
    const matches = loadEntries().filter((entry) => entry.id === intent.entryId)
    const current = matches[0]
    if (matches.length !== 1 || current === undefined
      || !isWaitingCandidate(current, draft.activity.date)
      || current.savedAt !== intent.expectedSavedAt) {
      conflicts += 1
      continue
    }

    const imported = importedProvenance(draft.activity, format)
    const next: PostSessionEntry = {
      ...current,
      savedAt: new Date(Math.max(Date.now(), Date.parse(current.savedAt) + 1)).toISOString(),
      objectiveDataState: "CONFIRMED",
      distanceKm: draft.activity.distanceKm,
      durationMin: draft.activity.durationMin,
      avgPace: draft.activity.avgPace,
      fieldProvenance: {
        ...(current.fieldProvenance ?? {}),
        distanceKm: imported.distanceKm ?? { provenance: "MISSING" },
        durationMin: imported.durationMin ?? { provenance: "MISSING" },
        avgPace: imported.avgPace ?? { provenance: "MISSING" },
      },
    }
    const result = updateEntryPreservingMemo(next, current.savedAt)
    if (result.ok) merged += 1
    else failed += 1
    total = result.total
  }

  return { saved, merged, conflicts, failed, total, ...(excluded ? { excluded } : {}) }
}

/** 가져온 활동 1건을 저장할 post-session 일지로 변환 (저장은 하지 않음) */
export function toImportedEntry(activity: ImportedActivity, format: ImportFormat,
  options: { readonly includeFileObservation?: boolean } = {}): PostSessionEntry {
  const confirmed = options.includeFileObservation ? confirmedFileActivity(activity, format) : null
  if (options.includeFileObservation && !confirmed) throw new Error("INVALID_FILE_OBSERVATION")
  const source = confirmed ?? activity
  return {
    id: newEntryId(),
    kind: "post-session",
    date: activity.date,
    savedAt: new Date().toISOString(),
    syncState: "local",
    system: confirmed ? "" : "base",
    title: confirmed ? (confirmed.observation?.sport === "RUNNING" ? "가져온 달리기" : "가져온 운동") : activity.name,
    distanceKm: source.distanceKm,
    durationMin: source.durationMin,
    avgPace: source.avgPace,
    rpe: 0,
    memo: "",
    fieldProvenance: importedProvenance(source, format),
    ...(confirmed?.observation ? { fileObservation: confirmed.observation } : {}),
  }
}

/** 사용자가 확인한 초안 1건을 post-session 일지로 저장 */
export function saveImportedActivity(
  activity: ImportedActivity,
  format: ImportFormat,
): { readonly ok: boolean; readonly total: number } {
  if (legacyJournalWritesBlocked()) return { ok: false, total: loadEntries().length }
  return saveEntry(toImportedEntry(activity, format))
}

/** 사용자가 확인한 초안 여러 건을 저장 — 실패 건수를 숨기지 않고 보고한다 */
export function saveImportedActivities(
  activities: readonly ImportedActivity[],
  format: ImportFormat,
): ImportSaveResult {
  let saved = 0
  let failed = 0
  let total = 0
  for (const activity of activities) {
    const result = saveImportedActivity(activity, format)
    if (result.ok) saved += 1
    else failed += 1
    total = result.total
  }
  return { saved, failed, total }
}
