// 휴지통 계약 테스트 — "30일 안에는 되돌릴 수 있다"와
// "되돌린 일지는 동기화에서 다시 지워지지 않는다"를 지킨다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TRASH_LIMIT,
  TRASH_RETENTION_DAYS,
  daysLeftInTrash,
  dropFromTrash,
  emptyTrash,
  loadTrash,
  moveToTrash,
  purgeExpiredTrash,
  takeFromTrash,
} from "./journal-trash"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { deleteEntry, loadEntries, restoreDeletedEntry, saveEntry } from "./journal-store"
import { mergeEntries } from "./account/sync"
import { loadTombstones, tombstonedIds } from "./account/tombstone"

const TRASH_KEY = "trainoracle.journal.trash.v1"
const JOURNAL_KEY = "trainoracle.journal.v1"
const TOMBSTONE_KEY = "trainoracle.sync.tombstones.v1"

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
    // 메모가 비어 있지 않으면 스키마가 memoPurpose를 요구한다.
    // 빼면 픽스처가 통째로 거부되어 테스트가 조용히 무의미해진다.
    memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
    ...overrides,
  } as JournalEntry
}

/** 픽스처가 스키마를 통과하는지 먼저 확인한다 — 공허한 통과 방지 */
function assertStorable(entry: JournalEntry): JournalEntry {
  const saved = saveEntry(entry)
  if (!saved.ok) throw new Error(`fixture rejected by schema: ${entry.id}`)
  return entry
}

/** 수치 없이 메모만 있는 일지 — 안전 백업에서 빠지는 종류 */
function memoOnly(id: string): JournalEntry {
  return session(id, {
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo: "오늘은 마음이 무거웠다",
  } as Partial<JournalEntry>)
}

/**
 * 이 파일의 기준 "오늘". 픽스처가 쓰는 삭제 시각(2026-07-20 전후)과 같은 주로
 * 맞춘다.
 *
 * 왜 시계를 고정하는가 — 이 파일은 **시한폭탄이었다.**
 *  픽스처는 삭제 시각을 `2026-07-20`처럼 고정해 두고, 검증은 `loadTrash()`를
 *  인자 없이 불렀다. 인자가 없으면 `now = Date.now()`(실제 현재 시각)가 쓰인다.
 *  휴지통은 `TRASH_RETENTION_DAYS`(30일)가 지난 항목을 빼고 돌려주므로,
 *  실제 날짜가 2026-08-19를 지나면 픽스처가 **조용히 만료되어** 사라지고
 *  "정렬 순서", "복원", "개수" 같은 무관한 검증까지 줄줄이 깨진다.
 *  코드를 한 줄도 바꾸지 않았는데 어느 날 갑자기 CI가 빨간불이 되는 종류다.
 *  (실제로 `2026-07-01` 픽스처를 쓰던 한 건은 이미 터진 상태로 발견했다.)
 *
 *  보관 기간 자체를 검증하는 그룹은 원래부터 기준 시각을 명시해 두었다.
 *  나머지 그룹도 같은 방식으로 시간에 독립적으로 만든다. 보관 기간을 다루지
 *  않는 테스트가 달력에 좌우될 이유가 없다.
 */
const TEST_NOW = new Date("2026-07-21T00:00:00.000Z")

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(TEST_NOW)
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe("휴지통 보관", () => {
  it("지운 일지를 보관하고 다시 읽어온다", () => {
    expect(moveToTrash(session("a"), "2026-07-20T10:00:00.000Z")).toBe(true)
    const items = loadTrash()
    expect(items).toHaveLength(1)
    expect(items[0]?.entry.id).toBe("a")
    expect(items[0]?.deletedAt).toBe("2026-07-20T10:00:00.000Z")
  })

  it("메모 원문을 그대로 보관한다 — 되돌리면 내용이 온전해야 한다", () => {
    moveToTrash(session("a", { memo: "지우면 안 되는 메모" } as Partial<JournalEntry>))
    const restored = loadTrash()[0]?.entry
    expect(restored?.kind).toBe("post-session")
    if (restored?.kind === "post-session") expect(restored.memo).toBe("지우면 안 되는 메모")
  })

  it("같은 id를 두 번 넣어도 한 건만 남는다", () => {
    moveToTrash(session("a"), "2026-07-20T10:00:00.000Z")
    moveToTrash(session("a"), "2026-07-21T10:00:00.000Z")
    const items = loadTrash()
    expect(items).toHaveLength(1)
    expect(items[0]?.deletedAt).toBe("2026-07-21T10:00:00.000Z")
  })

  /**
   * 시각을 주입한다 — 이 테스트는 **시한폭탄이었다.**
   *
   * 원래는 `2026-07-01`에 지운 항목을 넣고 `loadTrash()`를 인자 없이 불렀다.
   * 인자가 없으면 `now = Date.now()`(실제 현재 시각)가 쓰이므로,
   * 실제 날짜가 2026-07-31을 지나는 순간 그 항목이 30일 보관 기간(
   * `TRASH_RETENTION_DAYS`)을 넘겨 **조용히 사라지고** 정렬 검증이 깨진다.
   * 코드를 한 줄도 바꾸지 않았는데 CI가 빨간불이 되는 종류의 실패다.
   *
   * 정렬 순서를 확인하려는 테스트가 보관 기간에 얽매일 이유가 없다. 같은 파일의
   * "30일 보관 기간" 그룹처럼 기준 시각을 명시해 시간에 독립적으로 만든다.
   */
  it("최근에 지운 것이 먼저 온다", () => {
    const now = Date.now()
    moveToTrash(session("old"), new Date(now - 2000).toISOString())
    moveToTrash(session("new"), new Date(now - 1000).toISOString())
    expect(loadTrash(now).map((item) => item.entry.id)).toEqual(["new", "old"])
  })

  it("깨진 항목은 조용히 버리고 나머지는 살린다", () => {
    window.localStorage.setItem(TRASH_KEY, JSON.stringify([
      { entry: session("good"), deletedAt: "2026-07-20T00:00:00.000Z" },
      { entry: { id: "broken" }, deletedAt: "2026-07-20T00:00:00.000Z" },
      { entry: session("no-time") },
      "문자열",
      null,
    ]))
    expect(loadTrash().map((item) => item.entry.id)).toEqual(["good"])
  })

  it("저장소에 배열이 아닌 값이 있으면 빈 배열을 준다", () => {
    window.localStorage.setItem(TRASH_KEY, JSON.stringify({ nope: true }))
    expect(loadTrash()).toEqual([])
  })

  it("상한을 넘으면 오래된 것부터 버린다", () => {
    // 각 항목에 서로 다른 시각을 주되 만료되지 않도록 최근 시각을 쓴다.
    const base = Date.now() - 60 * 1000
    for (let index = 0; index < TRASH_LIMIT + 5; index += 1) {
      moveToTrash(session(`e${index}`), new Date(base + index * 1000).toISOString())
    }
    const items = loadTrash()
    // 공허한 통과 방지: 실제로 상한만큼 차 있는지 확인한다
    expect(items).toHaveLength(TRASH_LIMIT)
    // 가장 오래된 5건(e0~e4)이 밀려나야 한다
    const ids = new Set(items.map((item) => item.entry.id))
    expect(ids.has("e0")).toBe(false)
    expect(ids.has("e4")).toBe(false)
    expect(ids.has(`e${TRASH_LIMIT + 4}`)).toBe(true)
  })
})

describe("30일 보관 기간", () => {
  const base = Date.parse("2026-07-20T00:00:00.000Z")

  it("29일 지난 항목은 남아 있다", () => {
    moveToTrash(session("a"), new Date(base).toISOString())
    const now = base + 29 * 24 * 60 * 60 * 1000
    expect(loadTrash(now)).toHaveLength(1)
  })

  it("31일 지난 항목은 사라진다", () => {
    moveToTrash(session("a"), new Date(base).toISOString())
    const now = base + 31 * 24 * 60 * 60 * 1000
    expect(loadTrash(now)).toHaveLength(0)
  })

  it("만료 항목을 purge하면 저장소에서도 실제로 없어진다", () => {
    moveToTrash(session("old"), new Date(base).toISOString())
    moveToTrash(session("fresh"), new Date(base + 29 * 24 * 60 * 60 * 1000).toISOString())
    const now = base + 31 * 24 * 60 * 60 * 1000
    expect(purgeExpiredTrash(now)).toBe(1)
    const raw = window.localStorage.getItem(TRASH_KEY) ?? "[]"
    const stored: unknown = JSON.parse(raw)
    expect(Array.isArray(stored) ? stored.length : -1).toBe(1)
  })

  it("남은 일수를 정확히 센다", () => {
    const deletedAt = new Date(base).toISOString()
    expect(daysLeftInTrash(deletedAt, base)).toBe(TRASH_RETENTION_DAYS)
    expect(daysLeftInTrash(deletedAt, base + 10 * 24 * 60 * 60 * 1000)).toBe(TRASH_RETENTION_DAYS - 10)
    expect(daysLeftInTrash(deletedAt, base + 40 * 24 * 60 * 60 * 1000)).toBe(0)
  })

  it("삭제 시각을 못 읽으면 만료로 보지 않는다 — 못 읽었다고 복구를 막지 않는다", () => {
    window.localStorage.setItem(TRASH_KEY, JSON.stringify([
      { entry: session("a"), deletedAt: "not-a-date" },
    ]))
    expect(loadTrash(Date.now())).toHaveLength(1)
  })
})

describe("deleteEntry → 휴지통", () => {
  it("지우면 일지에서 사라지고 휴지통에 들어간다", () => {
    assertStorable(session("a"))
    const result = deleteEntry("a")
    expect(result.ok).toBe(true)
    expect(result.trashed).toBe(true)
    expect(loadEntries()).toHaveLength(0)
    expect(loadTrash().map((item) => item.entry.id)).toEqual(["a"])
  })

  it("휴지통에 있어도 일지 목록·분석에는 보이지 않는다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    // 본문 키에 남아 있으면 안 된다 — 휴지통은 별도 키다
    const raw = window.localStorage.getItem(JOURNAL_KEY) ?? "[]"
    expect(raw).not.toContain("종아리가 조금 뻐근했다")
    expect(loadEntries()).toHaveLength(0)
  })

  it("삭제 기록(tombstone)은 휴지통이 있어도 그대로 남는다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    expect(loadTombstones().map((t) => t.id)).toEqual(["a"])
  })

  it("없는 id를 지우면 휴지통에 아무것도 안 들어간다", () => {
    assertStorable(session("a"))
    const result = deleteEntry("nope")
    expect(result.trashed).toBe(false)
    expect(loadTrash()).toHaveLength(0)
  })

  it("메모만 있는 일지도 휴지통에 온전히 들어간다", () => {
    assertStorable(memoOnly("m"))
    deleteEntry("m")
    const restored = loadTrash()[0]?.entry
    expect(restored?.id).toBe("m")
    if (restored?.kind === "post-session") expect(restored.memo).toBe("오늘은 마음이 무거웠다")
  })
})

describe("되돌리기", () => {
  it("되돌리면 일지가 돌아오고 휴지통에서 빠진다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    const result = restoreDeletedEntry("a")
    expect(result.ok).toBe(true)
    expect(loadEntries()).toHaveLength(1)
    expect(loadTrash()).toHaveLength(0)
  })

  it("되돌린 일지의 내용은 지우기 전과 같다", () => {
    assertStorable(session("a", { memo: "이 메모가 살아야 한다" } as Partial<JournalEntry>))
    deleteEntry("a")
    restoreDeletedEntry("a")
    const entry = loadEntries()[0]
    expect(entry?.date).toBe("2026-07-20")
    if (entry?.kind === "post-session") {
      expect(entry.memo).toBe("이 메모가 살아야 한다")
      expect(entry.distanceKm).toBe("8")
      expect(entry.rpe).toBe(4)
    }
  })

  it("되돌린 일지는 새 id를 받는다 — 삭제 기록과 충돌하지 않기 위해", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    const result = restoreDeletedEntry("a")
    expect(result.restoredId).not.toBe("a")
    expect(result.restoredId).not.toBeNull()
    expect(loadEntries()[0]?.id).toBe(result.restoredId)
  })

  it("되돌려도 원래 id의 삭제 기록은 남는다 — 서버 사본이 되살아나면 안 된다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    restoreDeletedEntry("a")
    expect(loadTombstones().map((t) => t.id)).toEqual(["a"])
  })

  it("휴지통에 없는 id를 되돌리면 실패한다", () => {
    expect(restoreDeletedEntry("nope").ok).toBe(false)
  })

  it("두 번 되돌려도 일지가 하나만 생긴다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    expect(restoreDeletedEntry("a").ok).toBe(true)
    expect(restoreDeletedEntry("a").ok).toBe(false)
    expect(loadEntries()).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────
// 공격형 검증 — 되돌린 일지가 동기화 왕복에서 살아남는가.
//
// 이게 이 기능의 진짜 위험 지점이다. tombstone은 머지에서 항상 이기므로,
// 원래 id로 복구했다면 다음 동기화가 복구본을 조용히 다시 지운다.
// 사용자에게는 "되돌렸는데 또 사라졌다"로 보인다.
// ─────────────────────────────────────────────────────────────
describe("동기화 왕복 공격 — 되돌린 일지가 다시 지워지는가", () => {
  it("서버에 삭제 기록이 남은 상태로 머지해도 복구본은 살아남는다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    const restoredId = restoreDeletedEntry("a").restoredId
    expect(restoredId).not.toBeNull()

    // 다른 기기/서버에서 내려온 삭제 기록 — 원래 id "a"가 지워졌다고 말한다
    const deletedIds = tombstonedIds(loadTombstones())
    expect(deletedIds.has("a")).toBe(true)

    const merged = mergeEntries(loadEntries(), [], deletedIds)
    // 복구본이 살아 있어야 한다
    expect(merged.map((entry) => entry.id)).toEqual([restoredId])
  })

  it("서버에 남은 옛 사본(id=a)은 머지에서 계속 배제된다 — 중복이 생기지 않는다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    const restoredId = restoreDeletedEntry("a").restoredId

    // 서버에는 아직 지우기 전 사본이 남아 있는 상황
    const serverCopy = session("a", { savedAt: "2026-07-25T00:00:00.000Z" } as Partial<JournalEntry>)
    const merged = mergeEntries(loadEntries(), [serverCopy], tombstonedIds(loadTombstones()))

    // 옛 사본은 배제되고 복구본만 남는다 — 같은 날짜 일지가 두 개 보이면 안 된다
    expect(merged.map((entry) => entry.id)).toEqual([restoredId])
  })

  it("되돌린 뒤 다시 지우면, 두 id 모두 삭제 기록에 남는다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    const restoredId = restoreDeletedEntry("a").restoredId ?? ""
    deleteEntry(restoredId)
    const ids = loadTombstones().map((t) => t.id).sort()
    expect(ids).toEqual(["a", restoredId].sort())
    expect(loadEntries()).toHaveLength(0)
    // 두 번째 삭제분은 다시 되돌릴 수 있어야 한다
    expect(loadTrash().map((item) => item.entry.id)).toEqual([restoredId])
  })

  it("tombstone 저장소가 비어 있어도 복구본은 정상 동작한다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    window.localStorage.removeItem(TOMBSTONE_KEY)
    const result = restoreDeletedEntry("a")
    expect(result.ok).toBe(true)
    expect(loadEntries()).toHaveLength(1)
  })
})

describe("휴지통에서 완전히 지우기", () => {
  it("완전히 지우면 되돌릴 수 없다", () => {
    assertStorable(session("a"))
    deleteEntry("a")
    expect(dropFromTrash("a")).toBe(true)
    expect(loadTrash()).toHaveLength(0)
    expect(restoreDeletedEntry("a").ok).toBe(false)
  })

  it("없는 id를 완전 삭제하면 false", () => {
    expect(dropFromTrash("nope")).toBe(false)
  })

  it("휴지통 비우기는 전부 지운다", () => {
    assertStorable(session("a"))
    assertStorable(session("b"))
    deleteEntry("a")
    deleteEntry("b")
    expect(loadTrash()).toHaveLength(2)
    expect(emptyTrash()).toBe(true)
    expect(loadTrash()).toHaveLength(0)
  })

  it("takeFromTrash는 꺼낸 항목을 휴지통에서 제거한다", () => {
    moveToTrash(session("a"))
    expect(takeFromTrash("a")?.entry.id).toBe("a")
    expect(loadTrash()).toHaveLength(0)
    expect(takeFromTrash("a")).toBeNull()
  })
})
