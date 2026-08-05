// journal-local-storage 계약 테스트.
//
// 왜 이 파일이 필요한가:
//  이 모듈은 일지 저장의 **최하단 계층**이다. 6개 모듈이 여기를 거친다:
//    journal-store · journal-update · journal-decoration-lifecycle ·
//    account/private-note-sync · account/sync-run · restore/backup-file
//  그런데 전용 테스트가 없었다.
//
//  특히 `writeJournalEntries`는 "나만의 메모 평문을 디스크에 쓰지 않는다"는
//  **프라이버시 불변식의 마지막 관문**이다. 위 6개 경로 중 하나라도
//  평문을 들고 내려오면 여기서 막아야 한다. 이 한 줄이 조용히 사라져도
//  아무 테스트가 울리지 않는 상태였다.
//
//  `journalStorage()`는 localStorage를 쓸 수 있는지 실제 쓰기로 확인한다
//  (사파리 프라이빗 모드처럼 객체는 있는데 setItem이 던지는 환경이 있다).
//  여기가 무너지면 앱이 "저장했다"고 말하고 실제로는 아무것도 안 남는다.
//
// 고정하는 계약:
//  L-1 나만의 메모 평문이 섞이면 **쓰지 않고 false**를 낸다 (부분 저장 금지).
//  L-2 나만의 메모라도 본문이 비어 있으면(껍데기) 저장된다.
//  L-3 분석용 메모는 평문 그대로 저장된다 — 과잉 차단 금지.
//  L-4 쓰기가 던지면 false를 내고 예외를 밖으로 흘리지 않는다.
//  L-5 저장 가능 여부를 실제 쓰기로 확인한다 (setItem이 던지면 null).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  JOURNAL_STORAGE_KEY,
  journalStorage,
  writeJournalEntries,
} from "./journal-local-storage"
import { MEMO_PURPOSE } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"

const PRIVATE_TEXT = "PRIVATE-LUNA-731"

function postSession(
  id: string,
  memo: string,
  memoPurpose?: (typeof MEMO_PURPOSE)[keyof typeof MEMO_PURPOSE],
): JournalEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-05",
    savedAt: "2026-08-05T09:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "가벼운 조깅",
    distanceKm: "8",
    durationMin: "45",
    avgPace: "5:30",
    rpe: 4,
    memo,
    memoPurpose,
  }
}

function evening(
  id: string,
  note: string,
  memoPurpose?: (typeof MEMO_PURPOSE)[keyof typeof MEMO_PURPOSE],
): JournalEntry {
  return {
    id,
    kind: "evening",
    date: "2026-08-05",
    savedAt: "2026-08-05T21:00:00.000Z",
    syncState: "local",
    sleepH: 7,
    sleepQuality: 4,
    weightKg: "",
    restingHr: "",
    painParts: {},
    mood: 3,
    note,
    memoPurpose,
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe("writeJournalEntries — 나만의 메모 평문은 디스크에 닿지 않는다", () => {
  it("L-1 평문이 섞이면 쓰지 않고 false를 낸다", () => {
    const entries = [
      postSession("a", "8km 편하게", MEMO_PURPOSE.analyzableTrainingNote),
      postSession("b", PRIVATE_TEXT, MEMO_PURPOSE.privateSelfOnly),
    ]

    expect(writeJournalEntries(window.localStorage, entries)).toBe(false)

    // 부분 저장도 안 된다 — 정상 일지만 남기고 통과시키면
    // 호출자는 성공한 줄 알고 나머지를 잃는다.
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("L-1 저녁 일지(note 필드)의 평문도 똑같이 막는다", () => {
    // kind마다 본문 필드 이름이 다르다(memo / note). 한쪽만 막으면
    // 다른 쪽으로 평문이 샌다.
    const entries = [evening("e", PRIVATE_TEXT, MEMO_PURPOSE.privateSelfOnly)]

    expect(writeJournalEntries(window.localStorage, entries)).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBeNull()
  })

  it("L-1 저장소 어디에도 평문 조각이 남지 않는다", () => {
    writeJournalEntries(window.localStorage, [
      postSession("b", PRIVATE_TEXT, MEMO_PURPOSE.privateSelfOnly),
    ])

    // 키를 하나 찍어서 보는 게 아니라 전체를 훑는다 —
    // 다른 키에 흘렸을 가능성까지 확인한다.
    const everything = Object.keys(window.localStorage)
      .map((key) => window.localStorage.getItem(key) ?? "")
      .join("\u0000")
    expect(everything).not.toContain(PRIVATE_TEXT)
  })

  it("L-2 나만의 메모라도 본문이 비어 있으면 저장된다 (껍데기는 통과)", () => {
    // 평문을 금고로 옮기고 남은 껍데기는 반드시 저장돼야 한다.
    // 이걸 막으면 나만의 메모를 쓴 일지가 통째로 사라진다.
    const shell = postSession("b", "", MEMO_PURPOSE.privateSelfOnly)

    expect(writeJournalEntries(window.localStorage, [shell])).toBe(true)
    const stored = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    expect(stored).not.toBeNull()
    expect(stored).toContain("\"id\":\"b\"")
  })

  it("L-2 공백만 있는 본문도 껍데기로 본다", () => {
    const blank = postSession("b", "   \n\t ", MEMO_PURPOSE.privateSelfOnly)
    expect(writeJournalEntries(window.localStorage, [blank])).toBe(true)
  })

  it("L-3 분석용 메모는 평문 그대로 저장된다 — 과잉 차단 금지", () => {
    // 전부 막아버리면 "안전"해 보이지만 사용자가 남긴 훈련 메모가 사라진다.
    const entries = [postSession("a", "종아리가 뻐근했다", MEMO_PURPOSE.analyzableTrainingNote)]

    expect(writeJournalEntries(window.localStorage, entries)).toBe(true)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toContain("종아리가 뻐근했다")
  })

  it("L-3 목적이 지정되지 않은 메모도 저장된다", () => {
    const entries = [postSession("a", "가볍게 돌았다", undefined)]
    expect(writeJournalEntries(window.localStorage, entries)).toBe(true)
  })

  it("L-3 빈 목록도 정상 저장이다", () => {
    expect(writeJournalEntries(window.localStorage, [])).toBe(true)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe("[]")
  })

  it("L-4 쓰기가 던지면 예외를 흘리지 않고 false를 낸다", () => {
    // 용량 초과는 실제로 일어난다. 예외가 밖으로 나가면 저장 화면이
    // 통째로 죽어서 사용자가 방금 쓴 내용을 잃는다.
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === JOURNAL_STORAGE_KEY) throw new Error("QuotaExceededError")
      return real.call(this, key, value)
    })

    let threw = false
    let result = true
    try {
      result = writeJournalEntries(window.localStorage, [
        postSession("a", "8km", MEMO_PURPOSE.analyzableTrainingNote),
      ])
    } catch {
      threw = true
    }

    expect(threw).toBe(false)
    expect(result).toBe(false)
  })
})

describe("journalStorage — 쓸 수 있을 때만 저장소를 내준다", () => {
  it("L-5 정상 환경에서는 localStorage를 내주고 탐침 흔적을 남기지 않는다", () => {
    const storage = journalStorage()

    expect(storage).not.toBeNull()
    // 가용성 확인용으로 쓴 키가 남아 있으면 안 된다.
    expect(Object.keys(window.localStorage)).not.toContain("__to_probe__")
  })

  it("L-5 setItem이 던지는 환경에서는 null을 낸다", () => {
    // 사파리 프라이빗 모드처럼 객체는 있는데 쓰기가 막힌 환경.
    // 존재 여부만 보고 통과시키면 앱이 "저장했다"고 말하고
    // 실제로는 아무것도 안 남는다.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })

    expect(journalStorage()).toBeNull()
  })
})
