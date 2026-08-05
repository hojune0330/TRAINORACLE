// 일지 날짜 유효성 계약 테스트.
//
// 왜 이 파일이 필요한가:
//  일지 스키마는 날짜를 `z.string().min(1)`로만 검사했다. 즉 **존재하지
//  않는 날짜가 저장됐다.** 실행으로 확인한 수정 전 동작:
//    saveEntry(date: "2026-13-01") -> ok: true   (13월)
//    saveEntry(date: "2026-02-30") -> ok: true   (2월 30일)
//
//  이게 왜 문제인가 — 실측한 피해 (2026-02-30 · 50km 일지 하나를 심고
//  기준일 2026-03-01, 즉 주간 창 [2026-02-23, 2026-03-01]):
//    thisWeekStats  -> 2세션 / 58km / 2일
//    그 일지 없을 때 -> 1세션 /  8km / 1일
//  `aggregates.entriesBetween`은 날짜를 문자열로만 비교하므로
//  "2026-02-30"이 사전순으로 창 안에 들어가 합계에 섞인다.
//
//  그런데 `journal-archive.projectJournalArchive`, `home-view-model`,
//  `plan-beta-flow`는 `isValidIsoDate`로 걸러낸다. 그래서 같은 일지가
//  주간 합계에는 잡히고 아카이브에는 안 잡힌다 — 사용자는 화면마다
//  다른 숫자를 본다. "있는데 없다고, 없는데 있다고 말하지 않기"를 어긴다.
//
//  근본 수정은 저장 관문에서 막는 것이다. 걸러내기로 덮으면 저장소에는
//  계속 쌓이고, 걸러내기를 빼먹은 화면이 또 생긴다.
//
//  검증하면서 내가 처음 적었던 설명 중 틀린 것을 실행으로 잡았으니
//  기록해 둔다: `journal-archive`는 걸러**낸다**(207행). 그리고
//  "2026-13-01"(13월)은 사전순으로 실제 월보다 크므로 주간 창에
//  걸리지 않아 합계를 오염시키지 않았다. 우연히 안전했을 뿐이라
//  저장은 그대로 막는다.
//
// 고정하는 계약:
//  D-1 달력에 없는 날짜(13월, 2월 30일 등)는 **저장되지 않는다**.
//  D-2 형식이 어긋난 날짜(빈 값, "abc", "2026-2-3")는 저장되지 않는다.
//  D-3 정상 날짜는 그대로 저장된다 — 윤년 2월 29일 포함(과잉 차단 금지).
//  D-4 이미 저장돼 있던 깨진 날짜는 읽을 때 **버린다**.
//      (이 계약 이전에 저장된 데이터가 남아 있을 수 있다.)
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { loadEntries, saveEntry } from "./journal-store"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"

const JOURNAL_KEY = "trainoracle.journal.v1"

function session(id: string, date: string): JournalEntry {
  return {
    id,
    kind: "post-session",
    date,
    savedAt: "2026-08-05T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo: "종아리가 뻐근",
    memoPurpose: MEMO_PURPOSE.analyzableTrainingNote,
  } as JournalEntry
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe("일지 저장 — 달력에 없는 날짜는 받지 않는다", () => {
  it("D-1 13월은 저장되지 않는다", () => {
    expect(saveEntry(session("a", "2026-13-01")).ok).toBe(false)
    expect(loadEntries()).toHaveLength(0)
  })

  it("D-1 2월 30일은 저장되지 않는다", () => {
    // 받아들이면 주간 합계에 섞인다 — 실측: 8km 주간이 58km가 됐다.
    expect(saveEntry(session("b", "2026-02-30")).ok).toBe(false)
    expect(loadEntries()).toHaveLength(0)
  })

  it("D-1 4월 31일·6월 31일처럼 그 달에 없는 날은 저장되지 않는다", () => {
    expect(saveEntry(session("c", "2026-04-31")).ok).toBe(false)
    expect(saveEntry(session("d", "2026-06-31")).ok).toBe(false)
    expect(loadEntries()).toHaveLength(0)
  })

  it("D-1 평년의 2월 29일은 저장되지 않는다", () => {
    // 2026년은 평년이다.
    expect(saveEntry(session("e", "2026-02-29")).ok).toBe(false)
    expect(loadEntries()).toHaveLength(0)
  })

  it("D-2 형식이 어긋난 날짜는 저장되지 않는다", () => {
    for (const bad of ["", "abc", "2026-2-3", "2026/08/05", "20260805", "2026-08-05T00:00:00Z"]) {
      const result = saveEntry(session(`bad-${bad}`, bad))
      expect(result.ok, `"${bad}"가 저장됐다`).toBe(false)
    }
    expect(loadEntries()).toHaveLength(0)
  })

  it("D-3 정상 날짜는 그대로 저장된다 — 과잉 차단 금지", () => {
    expect(saveEntry(session("ok1", "2026-08-05")).ok).toBe(true)
    expect(saveEntry(session("ok2", "2026-01-01")).ok).toBe(true)
    expect(saveEntry(session("ok3", "2026-12-31")).ok).toBe(true)
    // 윤년 2월 29일은 실재하는 날짜다 — 막으면 그날 훈련한 사람이 못 적는다.
    expect(saveEntry(session("ok4", "2028-02-29")).ok).toBe(true)
    expect(loadEntries()).toHaveLength(4)
  })

  it("D-4 이 계약 이전에 저장된 깨진 날짜는 읽을 때 버린다", () => {
    // 스키마 검사를 우회해 직접 심는다 — 실제 사용자 저장소에 이미
    // 이런 값이 있을 수 있다.
    const good = session("good", "2026-08-05")
    const broken = session("broken", "2026-13-01")
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify([good, broken]))

    const loaded = loadEntries()
    // 깨진 것만 사라지고 정상 일지는 살아남는다 — 하나가 깨졌다고
    // 전부 버리면 사용자가 일지를 통째로 잃는다.
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.id).toBe("good")
  })
})
