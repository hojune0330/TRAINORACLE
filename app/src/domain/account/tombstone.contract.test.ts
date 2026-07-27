// 삭제 기록(tombstone) 계약 — "지운 일지는 되살아나지 않는다"를 잠근다.
//
// 이 테스트가 막는 실제 결함:
//  기기A에서 일지를 동기화한 뒤 삭제하면, 다음 동기화에서 서버 사본이
//  "한쪽에만 있는 항목"으로 판정되어 되살아났다. 사용자가 지우고 싶어서
//  지운 기록이 말없이 돌아오는 것은 삭제권 위반이다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PostSessionEntry } from "../journal-schema"
import { deleteEntry, loadEntries, saveEntry } from "../journal-store"
import { mergeEntries } from "./sync"
import {
  TOMBSTONE_LIMIT, clearTombstones, loadTombstones, mergeTombstones, recordTombstone,
  saveTombstones, tombstonedIds,
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

afterEach(() => {
  vi.restoreAllMocks()
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

  it("삭제 기록을 저장하지 못하면 본문을 지우지 않는다", () => {
    saveEntry(post("protected", "2026-07-20T10:00:00.000Z"))
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "trainoracle.sync.tombstones.v1") throw new Error("quota")
      original.call(this, key, value)
    })

    const result = deleteEntry("protected")

    expect(result.ok).toBe(false)
    expect(loadEntries().map((entry) => entry.id)).toEqual(["protected"])
  })
})

describe("삭제 기록의 최소 수집", () => {
  // 시계를 고정한다. deleteEntry는 deletedAt에 실제 현재 시각을 넣는데,
  // 그 ISO 문자열이 우연히 "12.5"를 포함할 수 있다(예: ...T08:53:12.500Z).
  // 그러면 아래 not.toContain("12.5")가 삭제 기록에 거리값이 샌 것으로
  // 오판해 실패한다. 실제로 CI에서 이 우연으로 한 번 실패했다.
  // 초·밀리초를 고정하면 검사 대상이 "우리가 넣은 12.5"만으로 좁혀진다.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-21T09:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

// ── 기기 간 삭제 전파 ────────────────────────────────────────────────
//
// 공격형 검증에서 확인한 결함: tombstone이 기기 로컬에만 있으면 A기기에서
// 지운 일지를 B기기가 자기 사본으로 다시 밀어 올려 되살린다. 서버 tombstone
// 테이블을 pull해 합쳐야 삭제가 기기 사이로 전파된다.
describe("기기 간 삭제 전파", () => {
  beforeEach(() => { window.localStorage.clear() })

  it("다른 기기에서 지운 id를 받아오면 이 기기에서도 되살리지 않는다", () => {
    // B기기: 로컬에 X가 있고 tombstone은 없다 (A에서 지웠으므로)
    const localB = [post("X", "2026-07-20T10:00:00.000Z")]
    const fromServer = [{ id: "X", deletedAt: "2026-07-21T00:00:00.000Z" }]

    const merged = mergeTombstones(loadTombstones(), fromServer)
    saveTombstones(merged)

    // 서버 사본이 없어도, 로컬 사본이 밀려 올라가면 안 된다
    expect(mergeEntries(localB, [], tombstonedIds(merged))).toEqual([])
  })

  it("합집합을 쓴다 — 한쪽에만 있는 삭제도 유효하다", () => {
    const local = [{ id: "a", deletedAt: "2026-07-20T00:00:00.000Z" }]
    const remote = [{ id: "b", deletedAt: "2026-07-21T00:00:00.000Z" }]
    expect(mergeTombstones(local, remote).map((t) => t.id).sort()).toEqual(["a", "b"])
  })

  it("같은 id는 더 이른 삭제 시각을 남긴다 (부활 틈 차단)", () => {
    const local = [{ id: "a", deletedAt: "2026-07-25T00:00:00.000Z" }]
    const remote = [{ id: "a", deletedAt: "2026-07-20T00:00:00.000Z" }]
    const merged = mergeTombstones(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.deletedAt).toBe("2026-07-20T00:00:00.000Z")
  })

  it("합칠 때도 상한을 지킨다", () => {
    const local = Array.from({ length: TOMBSTONE_LIMIT }, (_, i) => ({
      id: `L${i}`, deletedAt: `2026-07-20T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
    }))
    const remote = Array.from({ length: 50 }, (_, i) => ({
      id: `R${i}`, deletedAt: `2026-07-25T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
    }))
    expect(mergeTombstones(local, remote)).toHaveLength(TOMBSTONE_LIMIT)
  })

  it("서버에 올리는 내용에는 본문·날짜·수치가 없다 (최소 수집)", () => {
    saveEntry(post("secret", "2026-07-20T10:00:00.000Z", { memo: "무릎 통증" }))
    deleteEntry("secret")
    const merged = mergeTombstones(loadTombstones(), [])
    for (const tombstone of merged) {
      expect(Object.keys(tombstone).sort()).toEqual(["deletedAt", "id"])
    }
    expect(JSON.stringify(merged)).not.toContain("무릎")
  })
})
