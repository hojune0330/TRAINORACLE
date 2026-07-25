// 백업 복원 계약 — "백업을 권했으니 되돌릴 수 있어야 한다"를 잠근다.
//
// 잠그는 안전 약속:
//  1. 복원이 기존 일지를 날리지 않는다 (기본은 기존 것 유지).
//  2. 사용자가 지운 일지는 백업 파일로도 되살아나지 않는다.
//  3. 형식을 인식하지 못한 파일은 추측해서 복원하지 않는다.
//  4. 읽지 못한 항목 수를 숨기지 않는다.
//  5. 복원도 기존 쓰기 검증을 통과해야 한다 (우회 없음).
//  6. 겹치는 항목을 바꿀 때 같은 id가 두 개 생기지 않는다.
import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { exportEntriesJSON, deleteEntry, loadEntries, saveEntry } from "../journal-store"
import {
  FULL_FORMAT, SAFE_FORMAT, buildRestorePlan, readBackupFile, restoreEntries,
} from "./backup-file"

function post(id: string, overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: "2026-07-20T10:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "",
    ...overrides,
  }
}

function backupOf(entries: readonly unknown[], format: string = SAFE_FORMAT): string {
  return JSON.stringify({
    app: "TRAINORACLE",
    format,
    exportedAt: "2026-07-21T00:00:00.000Z",
    entries,
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("파일 읽기 — 인식하지 못하면 추측하지 않는다", () => {
  it("앱이 내보낸 안전 백업을 그대로 읽는다 (실제 왕복)", () => {
    // Given — 앱의 실제 내보내기 출력을 쓴다
    saveEntry(post("a"))
    const exported = exportEntriesJSON()

    // When
    const result = readBackupFile(exported)

    // Then
    expect(result.recognized).toBe(true)
    expect(result.kind).toBe("safe")
    expect(result.entries.map((entry) => entry.id)).toEqual(["a"])
    expect(result.skipped).toBe(0)
  })

  it("메모 포함 백업도 그대로 읽고 종류를 구분한다 (실제 왕복)", () => {
    // Given
    saveEntry(post("a", { memo: "오늘 좋았다", memoPurpose: "ANALYZABLE_TRAINING_NOTE" }))
    const exported = exportEntriesJSON({ includeRawMemos: true })

    // When
    const result = readBackupFile(exported)

    // Then
    expect(result.kind).toBe("full")
    expect((result.entries[0] as PostSessionEntry | undefined)?.memo).toBe("오늘 좋았다")
  })

  it("JSON이 아니면 인식하지 않는다", () => {
    expect(readBackupFile("not json at all").recognized).toBe(false)
  })

  it("다른 앱의 JSON은 인식하지 않는다", () => {
    const foreign = JSON.stringify({ app: "SOMETHING_ELSE", entries: [post("a")] })
    expect(readBackupFile(foreign).recognized).toBe(false)
  })

  it("형식 문자열이 다르면 인식하지 않는다", () => {
    expect(readBackupFile(backupOf([post("a")], "trainoracle.unknown.v9")).recognized).toBe(false)
  })

  it("읽지 못한 항목 수를 숨기지 않는다", () => {
    // Given — 유효 1건 + 깨진 2건
    const mixed = backupOf([post("a"), { id: "broken" }, "문자열"])

    // When
    const result = readBackupFile(mixed)

    // Then
    expect(result.entries).toHaveLength(1)
    expect(result.skipped).toBe(2)
  })
})

describe("복원 계획 — 저장 전에 결과를 보여준다", () => {
  it("새 항목·겹치는 항목·지운 항목을 구분해 센다", () => {
    // Given — 'keep'은 이미 있고, 'gone'은 지운 적 있다
    saveEntry(post("keep"))
    saveEntry(post("gone"))
    deleteEntry("gone")

    // When
    const plan = buildRestorePlan([post("keep"), post("gone"), post("new")])

    // Then
    expect(plan.conflicts).toBe(1)
    expect(plan.blockedByDeletion).toBe(1)
    expect(plan.fresh).toBe(1)
  })
})

describe("복원 실행 — 기존 데이터를 날리지 않는다", () => {
  it("기본값은 기존 일지를 지키고 새 항목만 넣는다", () => {
    // Given
    saveEntry(post("keep", { title: "지금 있는 것" }))
    const plan = buildRestorePlan([post("keep", { title: "백업판" }), post("new")])

    // When
    const outcome = restoreEntries(plan)

    // Then
    expect(outcome.restored).toBe(1)
    expect(outcome.keptExisting).toBe(1)
    const stored = loadEntries()
    expect(stored).toHaveLength(2)
    expect((stored.find((entry) => entry.id === "keep") as PostSessionEntry).title).toBe("지금 있는 것")
  })

  it("명시적으로 선택하면 겹치는 항목을 백업판으로 바꾼다", () => {
    // Given
    saveEntry(post("keep", { title: "지금 있는 것" }))
    const plan = buildRestorePlan([post("keep", { title: "백업판" })])

    // When
    const outcome = restoreEntries(plan, "overwrite-conflicts")

    // Then
    expect(outcome.restored).toBe(1)
    const stored = loadEntries()
    expect(stored).toHaveLength(1) // 같은 id가 두 개 생기지 않는다
    expect((stored[0] as PostSessionEntry).title).toBe("백업판")
  })

  it("지운 일지는 백업 파일로도 되살아나지 않는다", () => {
    // Given
    saveEntry(post("gone"))
    deleteEntry("gone")
    const plan = buildRestorePlan([post("gone")])

    // When — 덮어쓰기를 골라도 마찬가지다
    const outcome = restoreEntries(plan, "overwrite-conflicts")

    // Then
    expect(outcome.restored).toBe(0)
    expect(outcome.blockedByDeletion).toBe(1)
    expect(loadEntries()).toHaveLength(0)
  })

  it("복원한 일지는 이 기기 소유(local)로 되돌아간다", () => {
    // Given — 서버에 있었던 것처럼 표시된 백업
    const plan = buildRestorePlan([post("a", { syncState: "synced" } as Partial<PostSessionEntry>)])

    // When
    restoreEntries(plan)

    // Then
    expect(loadEntries()[0]?.syncState).toBe("local")
  })

  it("쓰기 검증을 통과하지 못한 항목은 실패로 세고 나머지는 저장한다", () => {
    // Given — 목적 없는 메모는 쓰기 검증에서 막힌다(기존 규칙)
    const plan = buildRestorePlan([
      post("ok"),
      post("bad", { memo: "목적 없는 메모", memoPurpose: undefined }),
    ])

    // When
    const outcome = restoreEntries(plan)

    // Then
    expect(outcome.restored).toBe(1)
    expect(outcome.failed).toBe(1)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["ok"])
  })

  it("빈 백업을 복원해도 기존 일지는 그대로 있다", () => {
    // Given
    saveEntry(post("keep"))

    // When
    const outcome = restoreEntries(buildRestorePlan([]))

    // Then
    expect(outcome.total).toBe(0)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
  })
})

describe("전체 왕복 — 내보내고 지우고 되돌린다", () => {
  it("메모 포함 백업으로 브라우저 초기화 상황을 복구할 수 있다", () => {
    // Given — 일지 2건을 쓰고 메모 포함 백업을 받아둔다
    saveEntry(post("a", { memo: "월요일 메모", memoPurpose: "ANALYZABLE_TRAINING_NOTE" }))
    saveEntry(post("b", { date: "2026-07-21" }))
    const backup = exportEntriesJSON({ includeRawMemos: true })

    // When — 브라우저 데이터가 날아갔다 (localStorage 전체 초기화)
    window.localStorage.clear()
    expect(loadEntries()).toHaveLength(0)

    const read = readBackupFile(backup)
    const outcome = restoreEntries(buildRestorePlan(read.entries))

    // Then
    expect(read.kind).toBe("full")
    expect(outcome.restored).toBe(2)
    const restored = loadEntries()
    expect(restored.map((entry) => entry.id).sort()).toEqual(["a", "b"])
    expect((restored.find((entry) => entry.id === "a") as PostSessionEntry).memo).toBe("월요일 메모")
  })

  it("안전 백업 복원은 메모가 없는 상태로 되돌아간다 (파일에 없으니 만들지 않는다)", () => {
    // Given
    saveEntry(post("a", { memo: "비밀 메모", memoPurpose: "PRIVATE_SELF_ONLY" }))
    const safeBackup = exportEntriesJSON()

    // When
    window.localStorage.clear()
    const read = readBackupFile(safeBackup)
    restoreEntries(buildRestorePlan(read.entries))

    // Then — 없는 값을 채워 넣지 않는다
    const restored = loadEntries()[0] as PostSessionEntry
    expect(restored.memo).toBe("")
    expect(restored.memoPurpose).toBeUndefined()
  })

  it("메모 포함 백업 형식 상수가 내보내기 출력과 일치한다", () => {
    // Given / When
    saveEntry(post("a"))

    // Then — 상수와 실제 출력이 갈라지면 복원이 조용히 깨진다
    expect(exportEntriesJSON()).toContain(SAFE_FORMAT)
    expect(exportEntriesJSON({ includeRawMemos: true })).toContain(FULL_FORMAT)
  })
})
