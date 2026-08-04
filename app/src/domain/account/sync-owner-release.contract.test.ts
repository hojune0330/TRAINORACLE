// 계정 잠금 해제(releaseSyncOwner) 계약 테스트 — Q4 도메인 층.
//
// 왜 이 파일이 필요한가:
//   claimSyncOwner는 기기 하나를 계정 하나에 묶는다. 그 잠금 자체는 옳다
//   (없으면 내 일지가 남의 계정으로 올라간다). 문제는 잠금을 푸는 유일한
//   수단이 **전체 삭제**였다는 것이다. 계정만 바꾸려는 사람에게
//   "일지를 다 지우세요"는 과한 요구다.
//
//   releaseSyncOwner는 그 과한 요구를 없앤다. 그런데 이 함수가 조용히
//   실수하면 피해가 크다:
//     - 일지까지 지우면 → 사용자 기록 소실 (전체 삭제와 같아짐, 존재 의미 없음)
//     - 삭제 기록까지 지우면 → 지웠던 일지가 새 계정에서 되살아남 (삭제권 위반)
//     - 실제로 안 풀렸는데 성공이라 하면 → 동기화 눌렀다가 또 막힘 (fail-visible 위반)
//     - 잠금이 안 풀리면 → 애초에 아무 문제도 해결하지 못함
//   네 가지를 각각 **실행으로** 고정한다. 주석으로 약속하는 것은 검증이 아니다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { currentSyncOwner, releaseSyncOwner } from "./sync-local"
import { loadTombstones, recordTombstone } from "./tombstone"
import { loadEntries, saveEntry } from "../journal-store"
import type { PostSessionEntry } from "../journal-schema"

const OWNER_KEY = "trainoracle.sync.owner.v1"
const PLAN_KEY = "trainoracle.plan-beta.v1"

function post(id: string): PostSessionEntry {
  return {
    id, kind: "post-session", date: "2026-07-20",
    savedAt: "2026-07-20T10:00:00.000Z", syncState: "local",
    system: "base", title: "이지런", distanceKm: "8",
    durationMin: "45", avgPace: "5:30", rpe: 4, memo: "",
  }
}

/**
 * 픽스처가 스키마에 거부되면 **테스트가 조용히 무의미해진다** (P-3).
 * 저장이 실패한 채로 "일지가 살아 있다"를 검사하면 0개를 0개와 비교하는
 * 공허한 통과가 된다. 그래서 저장 실패는 즉시 터뜨린다.
 */
function store(entry: PostSessionEntry): void {
  const result = saveEntry(entry)
  if (!result.ok) throw new Error(`픽스처가 스키마에 거부됐다: ${entry.id}`)
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("currentSyncOwner", () => {
  it("묶인 계정이 없으면 null", () => {
    expect(currentSyncOwner()).toBeNull()
  })

  it("묶여 있으면 그 userId를 그대로 보여준다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    expect(currentSyncOwner()).toBe("user-1")
  })
})

describe("releaseSyncOwner — 잠금은 풀고 데이터는 지키기", () => {
  it("계정 잠금을 실제로 푼다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")

    const result = releaseSyncOwner()

    expect(result.ok).toBe(true)
    // 메시지만 바뀌고 키가 남아 있으면 아무것도 해결되지 않는다.
    expect(window.localStorage.getItem(OWNER_KEY)).toBeNull()
    expect(currentSyncOwner()).toBeNull()
  })

  it("일지를 지우지 않는다 — 이 함수의 존재 이유", () => {
    store(post("A"))
    store(post("B"))
    window.localStorage.setItem(OWNER_KEY, "user-1")

    expect(releaseSyncOwner().ok).toBe(true)

    expect(loadEntries().map((entry) => entry.id).sort()).toEqual(["A", "B"])
  })

  it("삭제 기록을 지우지 않는다 — 지운 일지가 새 계정에서 되살아나면 안 된다", () => {
    recordTombstone("gone", "2026-07-21T00:00:00.000Z")
    window.localStorage.setItem(OWNER_KEY, "user-1")

    expect(releaseSyncOwner().ok).toBe(true)

    // tombstone이 사라지면 다음 동기화에서 서버 사본이 되살아난다.
    expect(loadTombstones().map((item) => item.id)).toEqual(["gone"])
  })

  it("계획 등 다른 로컬 데이터도 건드리지 않는다", () => {
    window.localStorage.setItem(PLAN_KEY, "{\"kept\":true}")
    window.localStorage.setItem(OWNER_KEY, "user-1")

    expect(releaseSyncOwner().ok).toBe(true)

    expect(window.localStorage.getItem(PLAN_KEY)).toBe("{\"kept\":true}")
  })

  it("풀린 뒤에는 다른 계정이 이 기기를 가져갈 수 있다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    releaseSyncOwner()

    // 잠금이 비었으므로 새 주인이 잡을 수 있다. (claimSyncOwner는 비공개이므로
    // 관측 가능한 결과 — 키가 비었다는 사실 — 로 확인한다.)
    expect(currentSyncOwner()).toBeNull()
    window.localStorage.setItem(OWNER_KEY, "user-2")
    expect(currentSyncOwner()).toBe("user-2")
  })

  it("이미 풀려 있으면 실패가 아니라 성공으로 알린다", () => {
    // 원했던 상태에 이미 도달해 있다. 여기서 실패라고 하면 사용자는
    // 고칠 것이 없는 문제를 고치려 든다.
    const result = releaseSyncOwner()

    expect(result.ok).toBe(true)
    expect(result.message).toContain("이미")
  })

  it("성공 메시지는 일지가 남아 있다는 사실을 말한다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")

    const result = releaseSyncOwner()

    // "연결을 끊었어요"만 보면 일지도 날아갔다고 겁먹는다. 화면이 아니라
    // 도메인 메시지에 이 문장이 있어야 어느 호출자든 같은 안심을 준다.
    expect(result.message).toContain("일지는 그대로 있어요")
  })
})

describe("releaseSyncOwner — 실패를 숨기지 않는다", () => {
  it("삭제가 먹히지 않으면 성공이라고 말하지 않는다", () => {
    // jsdom에서는 window.localStorage에 직접 spyOn이 걸리지 않는다.
    // Storage.prototype을 가로채야 실제로 개입된다 (이전 세션의 교훈).
    window.localStorage.setItem(OWNER_KEY, "user-1")
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      // 조용히 아무것도 하지 않는 저장소 — 최악의 실패 모양.
    })

    const result = releaseSyncOwner()

    expect(result.ok).toBe(false)
    expect(result.message).toContain("끊지 못했어요")
    // 실패했어도 일지는 안전하다고 말해야 한다.
    expect(result.message).toContain("일지는 그대로 있어요")
  })

  it("삭제가 예외를 던져도 앱을 깨뜨리지 않고 실패로 알린다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    const result = releaseSyncOwner()

    expect(result.ok).toBe(false)
    expect(result.message).toContain("일지는 그대로 있어요")
  })

  it("실패 메시지는 빠져나갈 길을 알려 준다", () => {
    window.localStorage.setItem(OWNER_KEY, "user-1")
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {})

    // "안 된다"만 남기면 사용자는 갇힌다. 브라우저 설정이라는 최후 수단을 준다.
    expect(releaseSyncOwner().message).toContain("브라우저")
  })
})
