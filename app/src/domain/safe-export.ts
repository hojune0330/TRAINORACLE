import type {
  EveningEntry,
  JournalEntry,
  PostSessionEntry,
  RaceEntry,
} from "./journal-schema"
import { isEligibleForAnalysis } from "./field-provenance"

export type SafePostSessionEntry = Omit<PostSessionEntry, "memo" | "memoPurpose">
export type SafeEveningEntry = Omit<EveningEntry, "note" | "memoPurpose">
export type SafeRaceEntry = Omit<RaceEntry, "memo" | "memoPurpose">

export type SafeJournalEntry = SafePostSessionEntry | SafeEveningEntry | SafeRaceEntry

export type AnalysisPostSessionEntry = SafePostSessionEntry
export type AnalysisEveningEntry = SafeEveningEntry
export type AnalysisRaceEntry = Omit<SafeRaceEntry, "tension" | "condition" | "mood" | "goalPace">
export type AnalysisJournalEntry = AnalysisPostSessionEntry | AnalysisEveningEntry | AnalysisRaceEntry

function unreachableEntry(entry: never): never {
  throw new TypeError(`Unsupported journal entry: ${String(entry)}`)
}

/**
 * 출처(fieldProvenance)는 안전 투영에서도 보존한다.
 *
 * 왜 보존해야 하는가 (공격형 검증에서 드러난 결함):
 *  출처를 빼면 복원·동기화 왕복 뒤 `isEligibleForAnalysis`가 전부 false가
 *  되어 **분석에서 조용히 사라진다**. 기기A에서 통계에 잡히던 일지가 기기B에서
 *  사라지고, 안전 백업을 복원하면 통계가 비는 식이다. 사용자에게는 아무 경고도
 *  뜨지 않는다 — 조용한 데이터 손실이다.
 *
 *  출처 자체에는 메모 원문도 개인 식별 정보도 없다. `{provenance, derivationRuleId,
 *  derivedFrom}` 뿐이며, 오히려 "이 값이 직접 쓴 것인지 가져온 것인지"를 지켜
 *  파생값이 분석에 섞이는 것을 막는 **안전 장치**다. 빼는 쪽이 위험하다.
 *
 *  타입 정의(`Omit<PostSessionEntry, "memo" | "memoPurpose">`)도 원래 메모만
 *  제거하도록 되어 있었다. 구현이 타입 의도보다 더 많이 지우고 있었다.
 */
function toSafeJournalEntry(entry: JournalEntry): SafeJournalEntry {
  const provenance = entry.fieldProvenance === undefined
    ? {}
    : { fieldProvenance: entry.fieldProvenance }
  switch (entry.kind) {
    case "post-session":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        system: entry.system,
        title: entry.title,
        distanceKm: entry.distanceKm,
        durationMin: entry.durationMin,
        avgPace: entry.avgPace,
        rpe: entry.rpe,
        ...provenance,
        ...(entry.intensityAssessment === undefined ? {} : { intensityAssessment: entry.intensityAssessment }),
      }
    case "evening":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        sleepH: entry.sleepH,
        sleepQuality: entry.sleepQuality,
        weightKg: entry.weightKg,
        restingHr: entry.restingHr,
        painParts: entry.painParts,
        mood: entry.mood,
        ...provenance,
      }
    case "race":
      return {
        id: entry.id,
        kind: entry.kind,
        date: entry.date,
        savedAt: entry.savedAt,
        syncState: "local",
        stage: entry.stage,
        record: entry.record,
        rank: entry.rank,
        result: entry.result,
        tension: entry.tension,
        condition: entry.condition,
        mood: entry.mood,
        goalPace: entry.goalPace,
        ...provenance,
      }
    default:
      return unreachableEntry(entry)
  }
}

function hasEligibleAnalysisField(entry: PostSessionEntry | EveningEntry): boolean {
  if (entry.kind === "post-session") {
    const hasIntensity = entry.intensityAssessment !== undefined
      && ((entry.intensityAssessment.plannedRpe !== undefined
          && isEligibleForAnalysis("plannedRpe", entry.fieldProvenance))
        || (entry.intensityAssessment.objectiveComponents.length > 0
          && isEligibleForAnalysis("objectiveComponents", entry.fieldProvenance)))
    return hasIntensity
      || ["distanceKm", "durationMin", "avgPace", "rpe"]
        .some((fieldName) => isEligibleForAnalysis(fieldName, entry.fieldProvenance))
  }
  return ["sleepH", "sleepQuality", "weightKg", "restingHr", "painParts", "mood"]
    .some((fieldName) => isEligibleForAnalysis(fieldName, entry.fieldProvenance))
}

/**
 * 이 일지에 **값이 있는데도 분석에 들어가지 못한 수치**가 있는지.
 *
 * 왜 필요한가 (Q1):
 *  `toAnalysisPostSessionEntry`는 분석 부적격 필드를 `""`/`0`으로 비운다.
 *  그 판단 자체는 옳다 — 기계가 계산한 값과 사람이 적은 값을 같은 줄에
 *  섞으면 분석이 오염된다. 문제는 **비운다는 사실을 화면이 말하지 않는다**는
 *  것이다. 워치 기록 10건을 가져온 사용자가 추이 화면을 열면 주간 거리가
 *  0 km로 나오고, 화면은 "거리를 적으면 그래프가 그려져요"라고 안내한다.
 *  사용자는 방금 적었는데 안 적었다고 안내받는다 — 정상 동작인데 고장으로 보인다.
 *
 *  안전 백업이 같은 상황에서 택한 답(`safeExportSummary`)과 같다: 몰래 빼지
 *  않고 **빠지는 개수를 세어 알린다.**
 *
 * "값이 없어서 빠진 것"은 세지 않는다. 안 적은 칸이 그래프에 없는 것은
 * 당연하고, 그걸 알리면 안내가 소음이 된다. 오직 **적었는데 빠진 것**만 센다.
 */
export function hasValueExcludedFromAnalysis(entry: JournalEntry): boolean {
  // 대회 기록은 출처 판정을 쓰지 않는다(`toAnalysisJournalEntry` 참고).
  if (entry.kind === "race") return false

  const excluded = (hasValue: boolean, fieldName: string) =>
    hasValue && !isEligibleForAnalysis(fieldName, entry.fieldProvenance)

  if (entry.kind === "post-session") {
    return excluded(entry.distanceKm.trim() !== "", "distanceKm")
      || excluded(entry.durationMin.trim() !== "", "durationMin")
      || excluded(entry.avgPace.trim() !== "", "avgPace")
      || excluded(entry.rpe > 0, "rpe")
      || excluded(entry.intensityAssessment?.plannedRpe !== undefined, "plannedRpe")
      || excluded((entry.intensityAssessment?.objectiveComponents.length ?? 0) > 0, "objectiveComponents")
  }
  return excluded(entry.sleepH > 0, "sleepH")
    || excluded(entry.sleepQuality > 0, "sleepQuality")
    || excluded(entry.weightKg.trim() !== "", "weightKg")
    || excluded(entry.restingHr.trim() !== "", "restingHr")
    || excluded(Object.values(entry.painParts).some((level) => level > 0), "painParts")
    || excluded(entry.mood > 0, "mood")
}

function toAnalysisPostSessionEntry(entry: PostSessionEntry): AnalysisPostSessionEntry {
  const plannedRpe = isEligibleForAnalysis("plannedRpe", entry.fieldProvenance)
    ? entry.intensityAssessment?.plannedRpe
    : undefined
  const objectiveComponents = isEligibleForAnalysis("objectiveComponents", entry.fieldProvenance)
    ? (entry.intensityAssessment?.objectiveComponents ?? [])
    : []
  const intensityAssessment = plannedRpe === undefined && objectiveComponents.length === 0
    ? undefined
    : {
        schemaVersion: 1 as const,
        ...(plannedRpe === undefined ? {} : { plannedRpe }),
        objectiveComponents,
      }
  return {
    id: entry.id,
    kind: entry.kind,
    date: entry.date,
    savedAt: entry.savedAt,
    syncState: "local",
    system: entry.system,
    title: entry.title,
    distanceKm: isEligibleForAnalysis("distanceKm", entry.fieldProvenance) ? entry.distanceKm : "",
    durationMin: isEligibleForAnalysis("durationMin", entry.fieldProvenance) ? entry.durationMin : "",
    avgPace: isEligibleForAnalysis("avgPace", entry.fieldProvenance) ? entry.avgPace : "",
    rpe: isEligibleForAnalysis("rpe", entry.fieldProvenance) ? entry.rpe : 0,
    ...(intensityAssessment === undefined ? {} : { intensityAssessment }),
  }
}

function toAnalysisEveningEntry(entry: EveningEntry): AnalysisEveningEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    date: entry.date,
    savedAt: entry.savedAt,
    syncState: "local",
    sleepH: isEligibleForAnalysis("sleepH", entry.fieldProvenance) ? entry.sleepH : 0,
    sleepQuality: isEligibleForAnalysis("sleepQuality", entry.fieldProvenance) ? entry.sleepQuality : 0,
    weightKg: isEligibleForAnalysis("weightKg", entry.fieldProvenance) ? entry.weightKg : "",
    restingHr: isEligibleForAnalysis("restingHr", entry.fieldProvenance) ? entry.restingHr : "",
    painParts: isEligibleForAnalysis("painParts", entry.fieldProvenance) ? entry.painParts : {},
    mood: isEligibleForAnalysis("mood", entry.fieldProvenance) ? entry.mood : 0,
  }
}

export function toExportJournalEntry(entry: JournalEntry): SafeJournalEntry | null {
  if (!hasExportableStructuredSignal(entry)) return null
  return toSafeJournalEntry(entry)
}

export function toAnalysisJournalEntry(entry: JournalEntry): AnalysisJournalEntry | null {
  if (entry.kind === "race") {
    if (!hasApprovedAnalysisSignal(entry)) return null
    return {
      id: entry.id,
      kind: entry.kind,
      date: entry.date,
      savedAt: entry.savedAt,
      syncState: "local",
      stage: entry.stage,
      record: entry.record,
      rank: entry.rank,
      result: entry.result,
    }
  }
  if (!hasEligibleAnalysisField(entry)) return null
  return entry.kind === "post-session"
    ? toAnalysisPostSessionEntry(entry)
    : toAnalysisEveningEntry(entry)
}

function hasExportableStructuredSignal(entry: JournalEntry): boolean {
  if (entry.kind === "post-session") {
    return entry.title.trim() !== ""
      || entry.distanceKm.trim() !== ""
      || entry.durationMin.trim() !== ""
      || entry.avgPace.trim() !== ""
      || entry.rpe > 0
      || entry.intensityAssessment?.plannedRpe !== undefined
      || (entry.intensityAssessment?.objectiveComponents.length ?? 0) > 0
  }
  if (entry.kind === "evening") {
    return entry.sleepH > 0
      || entry.sleepQuality > 0
      || entry.weightKg.trim() !== ""
      || entry.restingHr.trim() !== ""
      || Object.values(entry.painParts).some((level) => level > 0)
      || entry.mood > 0
  }
  return entry.record.trim() !== ""
    || entry.rank.trim() !== ""
    || entry.result.trim() !== ""
    || entry.tension !== undefined
    || entry.condition !== undefined
    || entry.mood !== undefined
    || entry.goalPace !== undefined
}

function hasApprovedAnalysisSignal(entry: JournalEntry): boolean {
  if (entry.kind !== "race") return hasExportableStructuredSignal(entry)
  return entry.record.trim() !== ""
    || entry.rank.trim() !== ""
    || entry.result.trim() !== ""
}
