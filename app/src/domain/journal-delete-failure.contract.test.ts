// 삭제 도중 저장이 실패했을 때의 계약 테스트.
//
// 왜 이 파일이 따로 있는가:
//  `deleteEntry`는 저장소에 **세 번** 쓴다 — 삭제 기록(tombstone), 휴지통,
//  일지 본문. localStorage는 용량이 차면 `setItem`에서 던진다. 즉 세 번 중
//  아무 곳에서나 실패할 수 있고, 그때 남는 상태가 사용자에게 무엇을 의미하는지가
//  전부 다르다. 기존 계약 테스트(journal-trash / tombstone)는 성공 경로와
//  깨진 JSON만 다뤘고, **쓰기 실패 조합은 한 건도 없었다.**
//
//  이 순서는 PR #119에서 한 번 뒤집혔다(tombstone 기록을 쓰기보다 앞으로
//  옮기고 롤백을 추가). 순서를 바꾸는 변경은 성공 경로 테스트로는 회귀가
//  잡히지 않는다 — 성공할 때는 어느 순서든 결과가 같기 때문이다. 그래서
//  실패를 주입해 순서를 고정한다.
//
// 고정하는 계약:
//  F-1 휴지통 저장 실패 → 삭제는 **진행**하되 `trashed: false`로 사실을 알린다
//      (소유자 결정: 삭제권을 막지 않는다. UI는 이 값으로 문구를 바꾼다.)
//  F-2 본문 저장 실패 → 아무것도 지우지 않은 상태로 **완전히 되돌린다**
//      (일지·휴지통·삭제 기록 모두 원래대로. 부분 적용이 남으면 안 된다.)
//  F-3 삭제 기록 저장 실패 → **아무것도 지우지 않는다**(fail-closed).
//      기록 없이 지우면 다음 동기화에서 서버 사본이 되살아난다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deleteEntry, loadEntries, restoreDeletedEntry, saveEntry } from "./journal-store"
import { loadTombstones } from "./account/tombstone"
import { loadTrash } from "./journal-trash"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"

const JOURNAL_KEY = "trainoracle.journal.v1"
const TRASH_KEY = "trainoracle.journal.trash.v1"
const TOMBSTONE_KEY = "trainoracle.sync.tombstones.v1"

function makeEntry(id: string): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-07-20",
    savedAt: "2026-07-20T10:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "종아리가 뻐근",
    memoPurpose: MEMO_PURPOSE.privateSelfOnly,
  } as JournalEntry
}

/**
 * 픽스처를 저장한다. **스키마에 거부되면 즉시 던진다.**
 *
 * 이 가드가 없으면 테스트가 조용히 무의미해진다: 스키마는 `memoPurpose` 등
 * 필수 항목이 빠지면 `saveEntry`가 `ok: false`를 돌려주고 저장하지 않는데,
 * 그 상태로 `deleteEntry`를 부르면 "없는 일지를 지우려 했다"가 되어
 * 기대값이 우연히 맞아버린다. 실제로 이 파일을 쓰는 동안 그 함정에 한 번
 * 빠졌다(저장 0건인데 통과). 픽스처가 거부되면 테스트를 실패시킨다.
 */
function store(id: string): void {
  const result = saveEntry(makeEntry(id))
  if (!result.ok) throw new Error(`픽스처가 스키마에 거부됐다: ${id}`)
}

/**
 * 특정 키에 대한 쓰기만 실패시킨다.
 *
 * `window.localStorage`에 스파이를 걸면 jsdom에서는 가로채지지 않는다 —
 * 실제 호출이 프로토타입으로 내려가기 때문이다. `Storage.prototype`에 걸어야
 * 한다. 다른 키는 원본 동작을 그대로 통과시켜 "이 키만 꽉 찼다"를 재현한다.
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

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("deleteEntry — 저장 실패 시 남는 상태", () => {
  it("F-1 휴지통 저장이 실패해도 삭제는 진행하고, trashed: false로 사실을 알린다", () => {
    store("a")
    expect(loadEntries()).toHaveLength(1)

    failWritesTo(TRASH_KEY)
    const result = deleteEntry("a")
    vi.restoreAllMocks()

    // 삭제권을 막지 않는다 — 사용자는 지우기를 요청했다
    expect(result.ok).toBe(true)
    expect(loadEntries()).toHaveLength(0)
    // 되돌릴 수 없다는 사실을 숨기지 않는다. UI(LogDetail)는 이 값이 false면
    // "휴지통에 넣지 못했어요 — 되돌릴 수 없어요"로 문구를 바꾸고
    // 되돌리기 버튼을 띄우지 않는다. 있는데 없다고, 없는데 있다고 말하지 않기.
    expect(result.trashed).toBe(false)
    expect(loadTrash()).toHaveLength(0)
    // 삭제 기록은 남는다 — 안 남기면 동기화에서 서버 사본이 되살아난다
    expect(loadTombstones().map((t) => t.id)).toEqual(["a"])
  })

  it("F-2 본문 저장이 실패하면 일지·휴지통·삭제 기록을 모두 원래대로 되돌린다", () => {
    store("a")

    failWritesTo(JOURNAL_KEY)
    const result = deleteEntry("a")
    vi.restoreAllMocks()

    expect(result.ok).toBe(false)
    // 일지는 그대로 남아 있다
    expect(loadEntries().map((entry) => entry.id)).toEqual(["a"])
    // 휴지통에 사본이 남으면 되돌리기가 일지를 하나 더 만든다
    expect(loadTrash()).toHaveLength(0)
    // 삭제 기록이 남으면 지우지도 못한 일지가 다음 동기화에서 사라진다 —
    // 저장 실패보다 훨씬 나쁜 결과다
    expect(loadTombstones()).toHaveLength(0)
  })

  it("F-3 삭제 기록을 남기지 못하면 아무것도 지우지 않는다 (fail-closed)", () => {
    store("a")

    failWritesTo(TOMBSTONE_KEY)
    const result = deleteEntry("a")
    vi.restoreAllMocks()

    expect(result.ok).toBe(false)
    expect(result.trashed).toBe(false)
    // 기록 없이 지우면 다음 동기화에서 되살아난다. 지우지 않는 쪽이 맞다.
    expect(loadEntries().map((entry) => entry.id)).toEqual(["a"])
    expect(loadTrash()).toHaveLength(0)
    expect(loadTombstones()).toHaveLength(0)
  })

  it("존재하지 않는 id는 삭제 기록도 남기지 않는다", () => {
    store("a")
    const result = deleteEntry("does-not-exist")
    expect(result.ok).toBe(false)
    expect(loadEntries()).toHaveLength(1)
    // 지운 적 없는 id의 삭제 기록이 서버로 올라가면, 나중에 같은 id를 쓰는
    // 다른 기기의 일지가 말없이 사라질 수 있다
    expect(loadTombstones()).toHaveLength(0)
  })
})

describe("restoreDeletedEntry — 저장 실패 시 남는 상태", () => {
  it("R-1 되돌리기 저장이 실패하면 일지는 휴지통에 그대로 남는다", () => {
    store("a")
    expect(deleteEntry("a").trashed).toBe(true)
    expect(loadTrash()).toHaveLength(1)

    // 휴지통에서 꺼낸 뒤 본문 저장이 실패하는 상황
    failWritesTo(JOURNAL_KEY)
    const result = restoreDeletedEntry("a")
    vi.restoreAllMocks()

    expect(result.ok).toBe(false)
    expect(result.restoredId).toBeNull()
    // 꺼내 놓고 실패하면 일지가 어디에도 없게 된다 — 조용한 데이터 손실.
    // 휴지통에 되돌려 놓아야 사용자가 다시 시도할 수 있다.
    expect(loadTrash()).toHaveLength(1)
    expect(loadEntries()).toHaveLength(0)
  })

  it("R-2 되돌린 일지는 새 id를 받는다 — 삭제 기록과 충돌하지 않게", () => {
    store("a")
    deleteEntry("a")
    const result = restoreDeletedEntry("a")

    expect(result.ok).toBe(true)
    expect(result.restoredId).not.toBe("a")
    // 원래 id로 되살리면 서버 tombstone이 다음 동기화에서 또 지운다
    expect(loadTombstones().map((t) => t.id)).toContain("a")
    expect(loadEntries().map((entry) => entry.id)).toEqual([result.restoredId])
  })

  it("R-3 되돌린 일지는 local 상태로 — 서버에 있다고 표시하지 않는다", () => {
    store("a")
    deleteEntry("a")
    restoreDeletedEntry("a")
    // 새 id이므로 서버에는 이 일지가 없다. synced로 두면 백업된 척이 된다.
    expect(loadEntries().map((entry) => entry.syncState)).toEqual(["local"])
  })
})
