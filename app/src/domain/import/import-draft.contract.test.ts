// 가져오기 초안·저장 계약 테스트 (IMP-2).
//
// 계약:
//  - 가져온 값은 저장에 성공한다 (스키마가 외부 출처 토큰을 받아들인다).
//  - 가져온 값은 일지에서는 보이지만 분석·추이·주간 통계에서는 제외된다.
//  - RPE는 절대 자동 생성하지 않는다 (0 = 미입력, MISSING).
//  - 같은 날 비슷한 활동이 있으면 중복으로 표시하되 자동 병합·자동 제외는 없다.
import { beforeEach, describe, expect, it } from "vitest"
import { lifetimeStats, thisWeekStats } from "../aggregates"
import { hasImportedField, isImportedField } from "../field-provenance"
import { loadAnalysisEntries, loadEntries, saveEntry, updateEntry } from "../journal-store"
import type { PostSessionEntry } from "../journal-store"
import type { ImportedActivity } from "./activity-file"
import {
  buildImportDrafts,
  confirmImportDrafts,
  saveImportedActivities,
  saveImportedActivity,
  toImportedEntry,
} from "./import-draft"

function activity(overrides: Partial<ImportedActivity> = {}): ImportedActivity {
  return {
    date: "2026-07-20",
    name: "아침 조깅",
    sport: "Running",
    distanceKm: "10.00",
    durationMin: "50",
    avgPace: "5:00",
    ...overrides,
  }
}

function existingSession(overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id: "existing-1",
    kind: "post-session",
    date: "2026-07-20",
    savedAt: "2026-07-20T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "직접 쓴 일지",
    distanceKm: "10.10",
    durationMin: "51",
    avgPace: "5:03",
    rpe: 5,
    memo: "",
    ...overrides,
  }
}

describe("imported activity save", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("가져온 활동을 실제로 저장한다", () => {
    const result = saveImportedActivity(activity(), "tcx")

    expect(result.ok).toBe(true)
    const stored = loadEntries()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      kind: "post-session",
      date: "2026-07-20",
      title: "아침 조깅",
      distanceKm: "10.00",
      durationMin: "50",
      avgPace: "5:00",
      syncState: "local",
    })
  })

  it("RPE를 자동으로 만들지 않는다 — 미입력(MISSING)으로 남긴다", () => {
    saveImportedActivity(activity(), "tcx")
    const [stored] = loadEntries()

    expect(stored).toMatchObject({ kind: "post-session", rpe: 0 })
    expect(stored?.fieldProvenance?.rpe).toEqual({ provenance: "MISSING" })
  })

  it("가져온 값에 외부 출처를 남긴다", () => {
    const entry = toImportedEntry(activity(), "gpx")

    expect(entry.fieldProvenance?.distanceKm).toEqual({
      provenance: "DERIVED",
      derivedFrom: ["import:activity-file"],
      derivationRuleId: "import:gpx",
    })
    expect(isImportedField("distanceKm", entry.fieldProvenance)).toBe(true)
    expect(isImportedField("rpe", entry.fieldProvenance)).toBe(false)
    expect(hasImportedField(entry.fieldProvenance)).toBe(true)
  })

  it("CSV와 JSON 출처를 서로 구분한다", () => {
    const csv = toImportedEntry(activity(), "csv")
    const json = toImportedEntry(activity(), "json")

    expect(csv.fieldProvenance?.distanceKm).toMatchObject({ derivationRuleId: "import:csv" })
    expect(json.fieldProvenance?.distanceKm).toMatchObject({ derivationRuleId: "import:json" })
  })

  it("파일에 없던 값은 MISSING으로 남기고 출처를 붙이지 않는다", () => {
    const entry = toImportedEntry(activity({ durationMin: "", avgPace: "" }), "tcx")

    expect(entry.fieldProvenance?.durationMin).toEqual({ provenance: "MISSING" })
    expect(entry.fieldProvenance?.avgPace).toEqual({ provenance: "MISSING" })
    expect(isImportedField("durationMin", entry.fieldProvenance)).toBe(false)
  })

  it("가져온 일지는 보이지만 분석·주간 통계에는 들어가지 않는다", () => {
    expect(saveImportedActivity(activity(), "tcx").ok).toBe(true)

    expect(loadEntries()).toHaveLength(1)
    expect(loadAnalysisEntries()).toEqual([])
    expect(lifetimeStats()).toEqual({ total: 0, days: 0, firstDate: null })
    expect(thisWeekStats()).toEqual({ sessions: 0, distanceKm: 0, avgRpe: null, daysLogged: 0 })
  })

  it("여러 건 저장 결과를 성공·실패로 나눠 보고한다", () => {
    const result = saveImportedActivities(
      [activity(), activity({ date: "2026-07-21", name: "저녁 러닝" })],
      "tcx",
    )

    expect(result).toMatchObject({ saved: 2, failed: 0 })
    expect(loadEntries()).toHaveLength(2)
  })
})

describe("import duplicate detection", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("같은 날 비슷한 거리의 기존 일지를 중복으로 표시한다", () => {
    const [draft] = buildImportDrafts([activity()], [existingSession()])

    expect(draft?.duplicateOf).toBe("existing-1")
  })

  it("거리가 충분히 다르면 중복으로 보지 않는다", () => {
    const [draft] = buildImportDrafts([activity()], [existingSession({ distanceKm: "5.00" })])

    expect(draft?.duplicateOf).toBeNull()
  })

  it("날짜가 다르면 중복으로 보지 않는다", () => {
    const [draft] = buildImportDrafts([activity({ date: "2026-07-19" })], [existingSession()])

    expect(draft?.duplicateOf).toBeNull()
  })

  it("거리를 못 읽으면 소요 시간으로 중복을 판단한다", () => {
    const [draft] = buildImportDrafts(
      [activity({ distanceKm: "" })],
      [existingSession({ distanceKm: "" })],
    )

    expect(draft?.duplicateOf).toBe("existing-1")
  })

  it("중복이어도 저장 자체를 막지 않는다 — 판단은 사용자 몫", () => {
    expect(saveEntry(existingSession()).ok).toBe(true)
    const [draft] = buildImportDrafts([activity()])
    expect(draft?.duplicateOf).toBe("existing-1")

    expect(saveImportedActivity(activity(), "tcx").ok).toBe(true)
    expect(loadEntries()).toHaveLength(2)
  })

  it("사용자가 확인한 파일 기록은 같은 빠른 일지의 객관값을 보완한다", () => {
    const quick = existingSession({
      id: "quick-1",
      captureDepth: "QUICK",
      activityOutcome: "COMPLETED",
      activitySlot: "AM",
      objectiveDataState: "WAITING",
      planExecutionRelation: "NOT_APPLICABLE",
      painCheckStatus: "NO_SIGNAL_REPORTED",
      system: "",
      title: "훈련 완료",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" },
        activitySlot: { provenance: "EXPLICIT" },
        plannedSessionLink: { provenance: "MISSING" },
        planExecutionRelation: {
          provenance: "DERIVED",
          derivedFrom: ["activityOutcome", "plannedSessionLink"],
          derivationRuleId: "QUICK_PLAN_EXECUTION_RELATION_V2",
        },
        painCheckStatus: { provenance: "EXPLICIT" },
        painParts: { provenance: "MISSING" },
        distanceKm: { provenance: "MISSING" },
        durationMin: { provenance: "MISSING" },
        avgPace: { provenance: "MISSING" },
        rpe: { provenance: "MISSING" },
      },
    })
    expect(saveEntry(quick).ok).toBe(true)
    const [draft] = buildImportDrafts([activity()], [quick])
    if (draft === undefined) throw new Error("missing draft")

    const result = confirmImportDrafts([draft], "tcx")

    expect(result).toMatchObject({ saved: 0, merged: 1, conflicts: 0, failed: 0 })
    expect(loadEntries()).toHaveLength(1)
    expect(loadEntries()[0]).toMatchObject({
      id: "quick-1",
      objectiveDataState: "CONFIRMED",
      distanceKm: "10.00",
      durationMin: "50",
      avgPace: "5:00",
      rpe: 0,
    })

    const merged = loadEntries()[0]
    if (merged?.kind !== "post-session") throw new Error("missing merged entry")
    const updated = {
      ...merged,
      savedAt: new Date(Date.parse(merged.savedAt) + 1).toISOString(),
      rpe: 6,
      fieldProvenance: {
        ...(merged.fieldProvenance ?? {}),
        rpe: { provenance: "EXPLICIT" as const },
      },
    }
    expect(updateEntry(updated, merged.savedAt).ok).toBe(true)
    expect(loadEntries()[0]).toMatchObject({ id: "quick-1", distanceKm: "10.00", rpe: 6 })
  })

  it("휴식과 건너뜀 빠른 기록은 기기 활동 병합 후보가 아니다", () => {
    const rest = existingSession({
      id: "rest-1",
      captureDepth: "QUICK",
      activityOutcome: "RESTED",
      activitySlot: undefined,
      objectiveDataState: "NONE",
      planExecutionRelation: "NOT_APPLICABLE",
      system: "",
      title: "휴식",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      fieldProvenance: {
        activityOutcome: { provenance: "EXPLICIT" },
        planExecutionRelation: { provenance: "EXPLICIT" },
        rpe: { provenance: "MISSING" },
      },
    })

    const [draft] = buildImportDrafts([activity()], [rest])
    expect(draft?.duplicateOf).toBeNull()
  })

  it("기존 객관값이 있으면 가져온 값으로 덮어쓰지 않는다", () => {
    const existing = existingSession({ distanceKm: "5.00", durationMin: "25" })
    expect(saveEntry(existing).ok).toBe(true)
    const [draft] = buildImportDrafts([activity({ distanceKm: "5.10", durationMin: "26" })], [existing])
    if (draft === undefined) throw new Error("missing draft")

    const result = confirmImportDrafts([draft], "tcx")

    expect(result).toMatchObject({ merged: 0, conflicts: 1, failed: 0 })
    expect(loadEntries()[0]).toMatchObject({ distanceKm: "5.00", durationMin: "25" })
  })
})
