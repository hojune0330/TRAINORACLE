// Q1 화면 계약 — 추이에 반영되지 않은 일지를 화면이 실제로 말하는지.
//
// 도메인 계약(`analysis-exclusion-summary.contract.test.ts`)은 **개수가 맞는지**만
// 고정한다. 개수를 맞게 세고도 화면에 안 그리면 사용자 문제는 그대로 남는다.
// 이 프로젝트에서 이미 겪은 실수(P-1: 도메인만 보고 화면을 보지 않음)를
// 반대 방향에서 막는다.
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { JournalEntry } from "../../domain/journal-store"
import { todayISO } from "../../domain/journal-store"
import type { FieldProvenance } from "../../domain/field-provenance"
import { Trends } from "../Trends"

const STORAGE_KEY = "trainoracle.journal.v1"

const IMPORTED: FieldProvenance = {
  provenance: "DERIVED",
  derivedFrom: ["import:activity-file"],
  derivationRuleId: "import:activity-file",
}
const WRITTEN: FieldProvenance = { provenance: "EXPLICIT" }
const BLANK: FieldProvenance = { provenance: "MISSING" }

function session(id: string, provenance?: Record<string, FieldProvenance>): JournalEntry {
  const today = todayISO()
  return {
    id,
    kind: "post-session",
    date: today,
    savedAt: `${today}T08:00:00.000Z`,
    syncState: "local",
    system: "base",
    title: "이지런",
    distanceKm: "8",
    durationMin: "40",
    avgPace: "5:00",
    rpe: 4,
    memo: "",
    ...(provenance === undefined ? {} : { fieldProvenance: provenance }),
  } as JournalEntry
}

function seed(entries: readonly JournalEntry[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

afterEach(cleanup)

describe("추이 화면 · 반영되지 않은 일지 안내", () => {
  beforeEach(() => { window.localStorage.clear() })

  /**
   * 가장 중요한 케이스. 가져오기만 쓴 사용자는 반영되는 일지가 0개여서
   * **빈 화면**을 본다. 예전에는 여기서 "기록이 생기면 볼 수 있어요"라고만
   * 말했다 — 이미 기록을 넣은 사람에게 안 넣었다고 안내하던 자리다.
   */
  it("가져온 일지만 있으면 빈 화면에서도 이유를 말한다", () => {
    seed([session("imported", {
      distanceKm: IMPORTED, durationMin: IMPORTED, avgPace: IMPORTED, rpe: BLANK,
    })])

    render(<Trends />)

    const notice = screen.getByTestId("trends-excluded-imported")
    expect(notice.textContent).toContain("가져온 일지 1개")
    // 일지가 사라진 게 아니라는 사실을 반드시 함께 말한다
    expect(notice.textContent).toContain("일지에는 그대로 남아 있어요")
  })

  it("출처 정보가 없어 빠진 일지는 **다른 문구로** 알린다", () => {
    seed([session("legacy")])

    render(<Trends />)

    const notice = screen.getByTestId("trends-excluded-no-provenance")
    expect(notice.textContent).toContain("일지 1개")
    // 사용자가 할 수 없는 일을 요구하면 안 된다
    expect(notice.textContent).not.toContain("직접 적어 주세요")
    expect(notice.textContent).toContain("앱이 고쳐야 할 부분")
    // 원인이 다르므로 가져오기 안내는 뜨지 않아야 한다
    expect(screen.queryByTestId("trends-excluded-imported")).toBeNull()
  })

  it("원인이 둘 다 있으면 둘 다 따로 말한다", () => {
    seed([
      session("imported", {
        distanceKm: IMPORTED, durationMin: IMPORTED, avgPace: IMPORTED, rpe: BLANK,
      }),
      session("legacy"),
    ])

    render(<Trends />)

    expect(screen.getByTestId("trends-excluded-imported")).toBeTruthy()
    expect(screen.getByTestId("trends-excluded-no-provenance")).toBeTruthy()
  })

  /**
   * 없는 문제를 알리지 않는다. 손으로 적은 일지만 있는 사용자에게 이 안내가
   * 뜨면, 잘 반영되고 있는데도 무언가 빠졌다고 걱정하게 만든다.
   */
  it("전부 손으로 적었으면 안내를 띄우지 않는다", () => {
    seed([session("written", {
      distanceKm: WRITTEN, durationMin: WRITTEN, avgPace: WRITTEN, rpe: WRITTEN,
    })])

    render(<Trends />)

    expect(screen.queryByTestId("trends-analysis-exclusion")).toBeNull()
  })

  it("일지가 아예 없으면 안내를 띄우지 않는다", () => {
    render(<Trends />)

    expect(screen.queryByTestId("trends-analysis-exclusion")).toBeNull()
  })

  /**
   * "거리를 적으면 그래프가 그려져요"는 아직 안 적은 사람에게만 맞는 말이다.
   * 가져오기로 채운 사람은 이미 적었으므로 그 문구가 거짓이 된다.
   */
  it("이미 적은 사람에게 '거리를 적으면'이라고 말하지 않는다", () => {
    seed([session("imported", {
      distanceKm: IMPORTED, durationMin: IMPORTED, avgPace: IMPORTED, rpe: BLANK,
    })])

    render(<Trends />)

    expect(document.body.textContent).not.toContain("거리를 적으면 여기에 주간 그래프가 그려져요")
  })

  /**
   * 아직 훈련 후 일지를 안 쓴 사람에게 **없는 문제를 알리면 안 된다.**
   *
   * 이 상태를 만드는 방법: 하루 마무리 일지만 쓴 사용자 — 화면은 비어 있지
   * 않지만(감정 기록이 있다) 주간 거리 그래프에 넣을 훈련 기록이 아직 없다.
   * 거리를 아직 안 적은 것은 "빠진 것"이 아니라 "없는 것"이므로 침묵해야 한다.
   *
   * (원래 이 테스트는 "거리를 적으면 그래프가 그려져요" 문구가 남아 있는지도
   *  검사했다. main이 추이 화면을 재작성하면서 그 문구를 없애서, 그 단정은
   *  **더 이상 존재하지 않는 사실을 검사하는 낡은 테스트**가 되었다.
   *  문구 문자열 대신 여전히 유효한 성질 — 안내를 띄우지 않는다 — 만 남긴다.)
   */
  it("아직 훈련 후 일지를 안 쓴 사람에게는 제외 안내를 띄우지 않는다", () => {
    const today = todayISO()
    seed([{
      id: "evening-only",
      kind: "evening",
      date: today,
      savedAt: `${today}T20:00:00.000Z`,
      syncState: "local",
      sleepH: 8,
      sleepQuality: 4,
      weightKg: "",
      restingHr: "",
      painParts: {},
      mood: 4,
      note: "",
      fieldProvenance: {
        sleepH: WRITTEN, sleepQuality: WRITTEN, weightKg: BLANK,
        restingHr: BLANK, painParts: BLANK, mood: WRITTEN,
      },
    } as JournalEntry])

    render(<Trends />)

    expect(screen.queryByTestId("trends-analysis-exclusion")).toBeNull()
    // 저녁 일지를 손으로 적었으므로 "가져왔다"거나 "출처가 없다"고 말해서는 안 된다.
    expect(document.body.textContent).not.toContain("가져온 일지")
    expect(document.body.textContent).not.toContain("추이에 넣지 못했어요")
  })
})
