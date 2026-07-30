// 전체 삭제 계약 테스트.
//
// 핵심 계약:
//  1) 일지·계획·계정 흔적이 모두 사라진다
//  2) **삭제 기록(tombstone)은 기본으로 남는다** — 안 남기면 다음 동기화에서
//     서버 사본이 되살아나 삭제가 무효가 된다
//  3) 명시적으로 요청하면 삭제 기록도 지운다
//  4) 실패를 숨기지 않는다
import { beforeEach, describe, expect, it } from "vitest"
import { ATHLETE_RECORDS_STORAGE_KEY } from "./athlete-records"
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
  window.localStorage.setItem(
    ATHLETE_RECORDS_STORAGE_KEY,
    JSON.stringify([{ id: "pb-5000" }]),
  )
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

  it("구조화 선수 기록도 지운다", () => {
    seed()
    const result = eraseAllLocalData()
    expect(result.ok).toBe(true)
    expect(erasableKeys()).toContain(ATHLETE_RECORDS_STORAGE_KEY)
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
  })

  it("로그인 토큰과 동기화 동의를 지운다 (기기 양도 대비)", () => {
    seed()
    eraseAllLocalData()
    expect(window.localStorage.getItem(AUTH)).toBeNull()
    expect(window.localStorage.getItem(CONSENT)).toBeNull()
  })

  // 회귀 A-1: 이 키에는 계정 userId가 평문으로 들어 있다. 예전에는 삭제
  // 기록과 한 묶음이라 기본 삭제에서 빠졌고, 이 파일의 테스트가
  // `toBe("athlete-a")`로 그 상태를 **정상이라고 고정**하고 있었다. 화면은
  // "일지·계획·로그인 정보를 모두 지워요"라고 말하므로 그 상태는 거짓이었다.
  it("동기화 소유자 userId를 지운다 — 화면이 약속한 '로그인 정보 전부'에 포함된다", () => {
    seed()
    eraseAllLocalData()
    expect(window.localStorage.getItem(SYNC_OWNER)).toBeNull()
  })

  // 회귀 A-2: claimSyncOwner는 owner 키가 있으면 다른 userId의 동기화를
  // 영구히 막는다("다른 계정과 연결되어 있어요"). 기기를 넘겨받은 사람이
  // 전부 지웠는데도 자기 계정을 쓸 수 없으면 안 된다 — 화면에 이를 푸는
  // 수단이 없기 때문에 전체 삭제가 유일한 탈출구다.
  it("전체 삭제 후에는 다른 계정도 이 기기를 쓸 수 있다 (소유자 잠금이 풀린다)", () => {
    seed()
    eraseAllLocalData()
    // owner 키가 비어 있어야 claimSyncOwner가 새 userId를 받아들인다
    expect(window.localStorage.getItem(SYNC_OWNER)).toBeNull()
  })

  it("삭제 기록은 기본으로 **남긴다** — 서버 사본 부활 방지", () => {
    seed()
    eraseAllLocalData()
    // 이게 사라지면 다음 동기화에서 지운 일지가 전부 되돌아온다.
    // 부활 방지 근거가 실제로 적용되는 키는 이것 하나뿐이다.
    expect(window.localStorage.getItem(TOMBSTONES)).not.toBeNull()
  })

  it("명시적으로 요청하면 삭제 기록도 지운다", () => {
    seed()
    const result = eraseAllLocalData({ includeDeletionRecord: true })
    expect(result.ok).toBe(true)
    expect(window.localStorage.getItem(TOMBSTONES)).toBeNull()
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
    // owner userId는 기본 목록에 **들어간다** — 화면이 지운다고 말하는 대상이다
    expect(erasableKeys()).toContain(SYNC_OWNER)
    // 삭제 기록만 기본에서 빠진다(부활 방지)
    expect(erasableKeys()).not.toContain(TOMBSTONES)
    expect(erasableKeys({ includeDeletionRecord: true })).toContain(TOMBSTONES)
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
