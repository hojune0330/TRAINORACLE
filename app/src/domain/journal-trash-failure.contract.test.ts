// 휴지통 조작 중 저장이 실패했을 때의 계약 테스트.
//
// 왜 이 파일이 따로 있는가:
//  `journal-trash.contract.test.ts`는 성공 경로와 깨진 JSON을 다루지만
//  **쓰기 실패는 한 건도 없다**(`Storage.prototype` 스파이 0건). localStorage는
//  용량이 차면 `setItem`에서 던진다. 휴지통은 되돌리기의 유일한 근거이므로,
//  쓰기가 실패했을 때 함수가 "했다"고 거짓말하면 사용자는 복구할 수 있다고
//  믿고 원본을 잃는다.
//
//  성공 경로 테스트로는 이 계약이 지켜지는지 알 수 없다. 성공할 때는
//  실패 처리 코드가 아예 실행되지 않기 때문이다. 그래서 실패를 주입한다.
//
// 고정하는 계약:
//  T-1 `moveToTrash` 저장 실패 → `false`. 휴지통은 비어 있어야 한다
//      (넣은 척하면 되돌리기 버튼이 헛돈다).
//  T-2 `takeFromTrash` 저장 실패 → `null`, 항목은 휴지통에 **그대로 남는다**.
//      꺼낸 척하고 남겨 두면 되돌리기를 두 번 눌러 일지가 두 개 생긴다.
//  T-3 `dropFromTrash` 저장 실패 → `false`, 항목은 **살아남는다**.
//      영구 삭제에 실패했는데 성공이라 하면 사용자는 지워졌다고 오해한다.
//  T-4 `emptyTrash` 저장 실패 → `false`, 항목 전부 **살아남는다**.
//  T-5 `purgeExpiredTrash` 저장 실패 → `0`. 정리한 건수를 부풀리지 않는다.
//  T-6 꾸미기 정리(`pruneUnusedJournalDecorations`)는 **쓰기 성공 후에만**
//      돈다. 실패했는데 꾸미기를 지우면 휴지통에 남은 일지의 꾸미기가
//      사라져, 되돌렸을 때 겉모습이 달라진다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  dropFromTrash,
  emptyTrash,
  loadTrash,
  moveToTrash,
  purgeExpiredTrash,
  takeFromTrash,
} from "./journal-trash"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { saveEntry } from "./journal-store"

const TRASH_KEY = "trainoracle.journal.trash.v1"
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function recentDeletedAt(): string {
  return new Date(Date.now() - ONE_DAY_MS).toISOString()
}

function session(id: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: "2026-07-20T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "종아리가 조금 뻐근했다",
    // 메모가 비어 있으면 스키마가 memoPurpose를 요구한다. 빼면 픽스처가
    // 통째로 거부되어 테스트가 조용히 무의미해진다.
    memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    ...overrides,
  } as JournalEntry
}

/**
 * 픽스처를 스키마로 검증한다. **거부되면 즉시 던진다.**
 *
 * 이 가드가 없으면 테스트가 공허해진다: 스키마가 거부하면 저장이 0건이 되고,
 * 그 상태로 실패를 주입하면 "없는 것을 못 지웠다"가 되어 기대값이 우연히
 * 맞아버린다.
 */
function assertStorable(entry: JournalEntry): JournalEntry {
  const saved = saveEntry(entry)
  if (!saved.ok) throw new Error(`픽스처가 스키마에 거부됐다: ${entry.id}`)
  return entry
}

/**
 * 특정 키에 대한 쓰기만 실패시킨다.
 *
 * `window.localStorage`에 스파이를 걸면 jsdom에서는 가로채지지 않는다 —
 * 실제 호출이 프로토타입으로 내려가기 때문이다. `Storage.prototype`에 걸어야
 * 한다. 다른 키는 원본 동작을 통과시켜 "이 키만 꽉 찼다"를 재현한다.
 */
function failWritesTo(key: string): void {
  const real = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    candidate: string,
    value: string,
  ) {
    if (candidate === key) throw new Error("QuotaExceededError")
    return real.call(this, candidate, value)
  })
}

/** 휴지통에 직접 항목을 심는다 — 실패 주입 전 상태를 만들기 위해 */
function seedTrash(items: readonly { entry: JournalEntry; deletedAt: string }[]): void {
  window.localStorage.setItem(TRASH_KEY, JSON.stringify(items))
}

beforeEach(() => {
  // 이 파일의 픽스처 deletedAt은 "2026년 7월" 같은 절대 날짜였다. 휴지통은
  // 읽는 순간 30일이 지난 항목을 버리므로, 실제 시간이 흘러 deletedAt이
  // 30일 전보 오래되면 loadTrash()가 항목을 조용히 비워버려 T-2~T-4가
  // 2026-08-20부터 깨지기 시작했다(시간 경과로 썩는 테스트). 시계를
  // 고정하고 픽스처를 그 기준 상대값으로 계산해 재발을 막는다.
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-08-01T00:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("journal-trash — 쓰기 실패를 숨기지 않는다", () => {
  it("T-1 moveToTrash 저장이 실패하면 false를 주고 휴지통은 비어 있다", () => {
    const entry = assertStorable(session("a"))

    failWritesTo(TRASH_KEY)
    const moved = moveToTrash(entry, "2026-07-21T00:00:00.000Z")
    vi.restoreAllMocks()

    // 넣은 척하면 UI가 "휴지통에서 되돌릴 수 있어요"를 띄우고,
    // 사용자는 없는 안전망을 믿는다.
    expect(moved).toBe(false)
    expect(loadTrash()).toHaveLength(0)
  })

  it("T-2 takeFromTrash 저장이 실패하면 null을 주고 항목은 휴지통에 그대로 남는다", () => {
    const entry = assertStorable(session("a"))
    seedTrash([{ entry, deletedAt: recentDeletedAt() }])
    expect(loadTrash()).toHaveLength(1)

    failWritesTo(TRASH_KEY)
    const taken = takeFromTrash("a")
    vi.restoreAllMocks()

    // 꺼낸 척하고 휴지통에 남겨 두면 되돌리기를 두 번 눌러 일지가 두 개 생긴다.
    // 그래서 "꺼냈다"고 말하지 않는다.
    expect(taken).toBeNull()
    // 대신 항목은 잃지 않는다 — 다시 시도할 수 있어야 한다.
    expect(loadTrash()).toHaveLength(1)
    expect(loadTrash()[0]?.entry.id).toBe("a")
  })

  it("T-3 dropFromTrash 저장이 실패하면 false를 주고 항목은 살아남는다", () => {
    const entry = assertStorable(session("a"))
    seedTrash([{ entry, deletedAt: recentDeletedAt() }])

    failWritesTo(TRASH_KEY)
    const dropped = dropFromTrash("a")
    vi.restoreAllMocks()

    expect(dropped).toBe(false)
    // 영구 삭제가 안 됐는데 됐다고 하면, 사용자는 지워졌다고 믿는다.
    expect(loadTrash()).toHaveLength(1)
  })

  it("T-4 emptyTrash 저장이 실패하면 false를 주고 항목 전부 살아남는다", () => {
    const a = assertStorable(session("a"))
    const b = assertStorable(session("b", { id: "b" }))
    const recent = Date.now() - ONE_DAY_MS
    seedTrash([
      { entry: a, deletedAt: new Date(recent - 1000).toISOString() },
      { entry: b, deletedAt: new Date(recent).toISOString() },
    ])
    expect(loadTrash()).toHaveLength(2)

    failWritesTo(TRASH_KEY)
    const emptied = emptyTrash()
    vi.restoreAllMocks()

    expect(emptied).toBe(false)
    expect(loadTrash()).toHaveLength(2)
  })

  it("T-5 purgeExpiredTrash 저장이 실패하면 0을 준다 — 정리 건수를 부풀리지 않는다", () => {
    const fresh = assertStorable(session("fresh"))
    const old = assertStorable(session("old", { id: "old" }))
    const now = Date.parse("2026-08-01T00:00:00.000Z")
    seedTrash([
      // 31일 지남 → 만료 대상
      { entry: old, deletedAt: "2026-06-25T00:00:00.000Z" },
      { entry: fresh, deletedAt: "2026-07-30T00:00:00.000Z" },
    ])

    failWritesTo(TRASH_KEY)
    const purged = purgeExpiredTrash(now)
    vi.restoreAllMocks()

    // 실제로 저장소에서 지우지 못했으므로 "1건 정리했다"고 말하면 거짓이다.
    expect(purged).toBe(0)
  })

  it("T-6 저장 실패 시 꾸미기 정리를 돌리지 않는다 — 되돌린 일지의 겉모습이 달라지면 안 된다", () => {
    const entry = assertStorable(session("a"))
    seedTrash([{ entry, deletedAt: recentDeletedAt() }])
    expect(loadTrash()).toHaveLength(1)

    // 꾸미기 정리는 별도 키에 쓴다. 그 키에 쓰기가 일어났는지로
    // "정리가 돌았는가"를 관찰한다.
    const touched: string[] = []
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      candidate: string,
      value: string,
    ) {
      if (candidate === TRASH_KEY) throw new Error("QuotaExceededError")
      touched.push(candidate)
      return real.call(this, candidate, value)
    })

    const dropped = dropFromTrash("a")
    vi.restoreAllMocks()

    expect(dropped).toBe(false)
    // 휴지통 쓰기가 실패했으니 뒤따르는 부수효과도 없어야 한다.
    // 여기서 꾸미기를 지우면, 휴지통에 남아 있는 일지를 되돌렸을 때
    // 꾸미기만 사라진 상태가 된다.
    expect(touched).toHaveLength(0)
  })
})
