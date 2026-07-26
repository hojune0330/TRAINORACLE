// 전체 삭제 계약 테스트.
//
// 핵심 계약:
//  1) 일지·계획·계정 흔적이 모두 사라진다
//  2) **삭제 기록(tombstone)은 기본으로 남는다** — 안 남기면 다음 동기화에서
//     서버 사본이 되살아나 삭제가 무효가 된다
//  3) 명시적으로 요청하면 삭제 기록도 지운다
//  4) 실패를 숨기지 않는다
import { beforeEach, describe, expect, it } from "vitest"
import { eraseAllLocalData, erasableKeys } from "./erase-local-data"

const JOURNAL = "trainoracle.journal.v1"
const TOMBSTONES = "trainoracle.sync.tombstones.v1"
const AUTH = "trainoracle.auth.v1"
const PLAN = "trainoracle.plan-beta.v1"
const CONSENT = "trainoracle.sync.consent.v1"
const SYNC_OWNER = "trainoracle.sync.owner.v1"

beforeEach(() => {
  window.localStorage.clear()
})

function seed(): void {
  window.localStorage.setItem(JOURNAL, JSON.stringify([{ id: "a" }, { id: "b" }]))
  window.localStorage.setItem(PLAN, JSON.stringify({ picked: "x" }))
  window.localStorage.setItem(AUTH, JSON.stringify({ token: "secret" }))
  window.localStorage.setItem(CONSENT, JSON.stringify({ enabled: true }))
  window.localStorage.setItem(SYNC_OWNER, "athlete-a")
  window.localStorage.setItem(TOMBSTONES, JSON.stringify([{ id: "gone", deletedAt: "2026-07-20T00:00:00.000Z" }]))
}

describe("eraseAllLocalData", () => {
  it("일지와 계획을 지운다", () => {
    seed()
    const result = eraseAllLocalData()
    expect(result.ok).toBe(true)
    expect(window.localStorage.getItem(JOURNAL)).toBeNull()
    expect(window.localStorage.getItem(PLAN)).toBeNull()
  })

  it("로그인 토큰과 동기화 동의를 지운다 (기기 양도 대비)", () => {
    seed()
    eraseAllLocalData()
    expect(window.localStorage.getItem(AUTH)).toBeNull()
    expect(window.localStorage.getItem(CONSENT)).toBeNull()
  })

  it("삭제 기록은 기본으로 **남긴다** — 서버 사본 부활 방지", () => {
    seed()
    eraseAllLocalData()
    // 이게 사라지면 다음 동기화에서 지운 일지가 전부 되돌아온다
    expect(window.localStorage.getItem(TOMBSTONES)).not.toBeNull()
    expect(window.localStorage.getItem(SYNC_OWNER)).toBe("athlete-a")
  })

  it("명시적으로 요청하면 삭제 기록도 지운다", () => {
    seed()
    const result = eraseAllLocalData({ includeDeletionRecord: true })
    expect(result.ok).toBe(true)
    expect(window.localStorage.getItem(TOMBSTONES)).toBeNull()
    expect(window.localStorage.getItem(SYNC_OWNER)).toBeNull()
  })

  it("지운 개수를 정확히 보고한다", () => {
    window.localStorage.setItem(JOURNAL, "[]")
    window.localStorage.setItem(AUTH, "{}")
    const result = eraseAllLocalData()
    // 존재하던 2개만 센다 — 없던 키를 지웠다고 부풀리지 않는다
    expect(result.cleared).toBe(2)
    expect(result.failed).toEqual([])
  })

  it("아무것도 없어도 안전하게 동작한다", () => {
    const result = eraseAllLocalData()
    expect(result.ok).toBe(true)
    expect(result.cleared).toBe(0)
  })

  it("지워질 키 목록을 미리 보여줄 수 있다", () => {
    expect(erasableKeys()).toContain(JOURNAL)
    expect(erasableKeys()).not.toContain(TOMBSTONES)
    expect(erasableKeys()).not.toContain(SYNC_OWNER)
    expect(erasableKeys({ includeDeletionRecord: true })).toContain(TOMBSTONES)
    expect(erasableKeys({ includeDeletionRecord: true })).toContain(SYNC_OWNER)
  })

  it("전체 삭제 후 일지를 읽으면 비어 있다", () => {
    seed()
    eraseAllLocalData()
    const raw = window.localStorage.getItem(JOURNAL)
    expect(raw).toBeNull()
  })
  it("휴지통도 지운다 — 지운 일지의 메모 원문이 기기에 남으면 안 된다", () => {
    // 휴지통에는 되돌리기용으로 일지 원본(메모 포함)이 통째로 들어 있다.
    // 여기가 빠지면 "이 기기의 내 데이터 전부 지우기"가 거짓이 된다.
    const TRASH = "trainoracle.journal.trash.v1"
    window.localStorage.setItem(TRASH, JSON.stringify([
      { entry: { id: "a", kind: "post-session", memo: "사적인메모" }, deletedAt: "2026-07-20T00:00:00.000Z" },
    ]))
    expect(erasableKeys()).toContain(TRASH)
    const result = eraseAllLocalData()
    expect(result.ok).toBe(true)
    expect(window.localStorage.getItem(TRASH)).toBeNull()
  })
})
