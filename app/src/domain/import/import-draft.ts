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
import { loadEntries, newEntryId, saveEntry } from "../journal-store"

/** 가져오기 파생 입력 토큰 — 일지 필드가 아니라 "파일에서 왔다"는 표시 */
export const IMPORT_DERIVED_FROM = ["import:activity-file"] as const

export type ImportFormat = "tcx" | "gpx"

export type ImportDraft = {
  readonly activity: ImportedActivity
  /** 같은 날 비슷한 활동의 기존 일지 id — 있으면 UI가 "이미 있는 것 같아요" 표시 */
  readonly duplicateOf: string | null
}

export type ImportSaveResult = {
  readonly saved: number
  readonly failed: number
  readonly total: number
}

function numeric(value: string): number | null {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
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

export function buildImportDrafts(
  activities: readonly ImportedActivity[],
  existing: readonly JournalEntry[] = loadEntries(),
): ImportDraft[] {
  return activities.map((activity) => {
    const duplicate = existing.find(
      (entry): entry is PostSessionEntry =>
        entry.kind === "post-session"
        && entry.date === activity.date
        && looksLikeSameActivity(entry, activity),
    )
    return { activity, duplicateOf: duplicate?.id ?? null }
  })
}

function importedProvenance(activity: ImportedActivity, format: ImportFormat): FieldProvenanceMap {
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

/** 가져온 활동 1건을 저장할 post-session 일지로 변환 (저장은 하지 않음) */
export function toImportedEntry(activity: ImportedActivity, format: ImportFormat): PostSessionEntry {
  return {
    id: newEntryId(),
    kind: "post-session",
    date: activity.date,
    savedAt: new Date().toISOString(),
    syncState: "local",
    system: "base",
    title: activity.name,
    distanceKm: activity.distanceKm,
    durationMin: activity.durationMin,
    avgPace: activity.avgPace,
    rpe: 0,
    memo: "",
    fieldProvenance: importedProvenance(activity, format),
  }
}

/** 사용자가 확인한 초안 1건을 post-session 일지로 저장 */
export function saveImportedActivity(
  activity: ImportedActivity,
  format: ImportFormat,
): { readonly ok: boolean; readonly total: number } {
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
