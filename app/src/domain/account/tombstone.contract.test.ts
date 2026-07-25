// 삭제 기록(tombstone) 계약 — "지운 일지는 되살아나지 않는다"를 잠근다.
//
// 이 테스트가 막는 실제 결함:
//  기기A에서 일지를 동기화한 뒤 삭제하면, 다음 동기화에서 서버 사본이
//  "한쪽에만 있는 항목"으로 판정되어 되살아났다. 사용자가 지우고 싶어서
//  지운 기록이 말없이 돌아오는 것은 삭제권 위반이다.
import { beforeEach, describe, expect, it } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { deleteEntry, loadEntries, saveEntry } from "../journal-store"
import { mergeEntries } from "./sync"
import {
  TOMBSTONE_LIMIT, clearTombstones, loadTombstones, recordTombstone, tombstonedIds,
} from "./tombstone"

const TOMBSTONE_KEY = "trainoracle.sync.tombstones.v1"

function post(id: string, savedAt: string, overrides: Partial<PostSessionEntry> = {}): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt,
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

beforeEach(() => {
  window.localStorage.clear()
})

describe("삭제 부활 방지 — 이 기능의 존재 이유", () => {
  it("지운 일지는 서버 사본이 남아 있어도 되살아나지 않는다", () => {
    // Given — 서버에는 사본이 있고, 사용자는 로컬에서 지웠다
    const remote = [post("a", "2026-07-20T10:00:00.000Z")]
    recordTombstone("a", "2026-07-20T11:00:00.000Z")

    // When
    const merged = mergeEntries([], remote)

    // Then
    expect(merged).toHaveLength(0)
  })

  it("서버 사본이 더 최신이어도 삭제가 이긴다 (LWW의 예외)", () => {
    // Given — 서버판이 삭제 시각보다 나중에 저장된 것으로 보이는 경우
    const remote = [post("a", "2026-09-01T10:00:00.000Z", { title: "서버판" })]
    recordTombstone("a", "2026-07-20T11:00:00.000Z")

    // When
    const merged = mergeEntries([], remote)

    // Then — 시각 비교로 부활시키지 않는다. 되살리려면 새로 쓰면 된다(새 id).
    expect(merged).toHaveLength(0)
  })

  it("지우지 않은 일지는 그대로 병합된다", () => {
    // Given
    const remote = [post("a", "2026-07-20T10:00:00.000Z"), post("b", "2026-07-20T11:00:00.000Z")]
    recordTombstone("a")

    // When
    const merged = mergeEntries([], remote)

    // Then
    expect(merged.map((entry) => entry.id)).toEqual(["b"])
  })

  it("삭제 기록이 없으면 기존 LWW 동작을 그대로 유지한다", () => {
    // Given
    const local = [post("a", "2026-07-20T10:00:00.000Z", { title: "로컬판" })]
    const remote = [post("a", "2026-07-21T10:00:00.000Z", { title: "서버판" })]

    // When
    const merged = mergeEntries(local, remote)

    // Then
    expect(merged).toHaveLength(1)
    expect((merged[0] as PostSessionEntry).title).toBe("서버판")
  })
})

describe("deleteEntry 연동", () => {
  it("일지를 지우면 삭제 기록이 함께 남는다", () => {
    // Given
    const saved = saveEntry(post("target", "2026-07-20T10:00:00.000Z"))
    expect(saved.ok).toBe(true)

    // When
    const result = deleteEntry("target")

    // Then
    expect(result.ok).toBe(true)
    expect(loadEntries()).toHaveLength(0)
    expect(tombstonedIds().has("target")).toBe(true)
  })

  it("삭제한 일지는 동기화 병합에서도 돌아오지 않는다 (실제 사용 흐름)", () => {
    // Given — 저장 → (서버로 올라갔다고 가정) → 사용자가 삭제
    saveEntry(post("target", "2026-07-20T10:00:00.000Z"))
    const serverCopy = [post("target", "2026-07-20T10:00:00.000Z")]
    deleteEntry("target")

    // When — 다음 동기화 병합
    const merged = mergeEntries(loadEntries(), serverCopy)

    // Then
    expect(merged).toHaveLength(0)
  })

  it("존재하지 않는 id를 지워도 다른 일지를 지우지 않는다", () => {
    // Given
    saveEntry(post("keep", "2026-07-20T10:00:00.000Z"))

    // When
    deleteEntry("ghost")

    // Then
    expect(loadEntries().map((entry) => entry.id)).toEqual(["keep"])
    const merged = mergeEntries(loadEntries(), [post("keep", "2026-07-20T10:00:00.000Z")])
    expect(merged.map((entry) => entry.id)).toEqual(["keep"])
  })
})

describe("삭제 기록의 최소 수집", () => {
  it("id와 삭제 시각만 담고 날짜·수치·메모는 담지 않는다", () => {
    // Given
    saveEntry(post("target", "2026-07-20T10:00:00.000Z", {
      memo: "오늘 무릎이 아팠다",
      memoPurpose: "PRIVATE_SELF_ONLY",
      distanceKm: "12.5",
    }))

    // When
    deleteEntry("target")

    // Then — 무엇을 지웠는지가 아니라 "이 id는 지워졌다"만 남는다
    const raw = window.localStorage.getItem(TOMBSTONE_KEY) ?? ""
    expect(raw).not.toContain("무릎")
    expect(raw).not.toContain("12.5")
    expect(raw).not.toContain("2026-07-20\"")
    const [tombstone] = loadTombstones()
    expect(Object.keys(tombstone ?? {}).sort()).toEqual(["deletedAt", "id"])
  })
})

describe("삭제 기록 저장의 견고함", () => {
  it("같은 id를 두 번 지우면 기록이 중복되지 않는다", () => {
    // Given / When
    recordTombstone("a", "2026-07-20T10:00:00.000Z")
    recordTombstone("a", "2026-07-21T10:00:00.000Z")

    // Then
    const tombstones = loadTombstones()
    expect(tombstones).toHaveLength(1)
    expect(tombstones[0]?.deletedAt).toBe("2026-07-21T10:00:00.000Z")
  })

  it("깨진 저장값에서도 빈 목록으로 안전하게 시작한다", () => {
    // Given
    window.localStorage.setItem(TOMBSTONE_KEY, "{ not json")

    // When / Then
    expect(loadTombstones()).toEqual([])
    expect(tombstonedIds().size).toBe(0)
  })

  it("형식이 어긋난 항목은 버리고 유효한 항목만 남긴다", () => {
    // Given
    window.localStorage.setItem(TOMBSTONE_KEY, JSON.stringify([
      { id: "good", deletedAt: "2026-07-20T10:00:00.000Z" },
      { id: "", deletedAt: "2026-07-20T10:00:00.000Z" },
      { id: "no-time" },
      "문자열",
      null,
    ]))

    // When / Then
    expect(loadTombstones().map((tombstone) => tombstone.id)).toEqual(["good"])
  })

  it("상한을 넘으면 오래된 삭제 기록부터 잘라낸다", () => {
    // Given — 상한 + 5개
    for (let index = 0; index < TOMBSTONE_LIMIT + 5; index += 1) {
      const stamp = String(index).padStart(4, "0")
      recordTombstone(`id-${stamp}`, `2026-01-01T00:00:${stamp}.000Z`)
    }

    // Then
    const tombstones = loadTombstones()
    expect(tombstones).toHaveLength(TOMBSTONE_LIMIT)
    expect(tombstones[0]?.id).toBe("id-0005")
    expect(tombstones.at(-1)?.id).toBe(`id-${String(TOMBSTONE_LIMIT + 4).padStart(4, "0")}`)
  })

  it("빈 id는 기록하지 않는다", () => {
    // When / Then
    expect(recordTombstone("")).toBe(false)
    expect(loadTombstones()).toEqual([])
  })

  it("기록을 비울 수 있다", () => {
    // Given
    recordTombstone("a")

    // When
    expect(clearTombstones()).toBe(true)

    // Then
    expect(loadTombstones()).toEqual([])
  })
})
