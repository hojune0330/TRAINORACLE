// 주간 집계가 "달력에 없는 날짜" 때문에 부풀지 않는지 고정한다.
//
// 스펙 확인 (AGENTS.md §2 라우팅 표를 따라 착수 전 열람):
//   `aggregates.ts`를 관장하는 문서는 METRIC_ALGORITHM_CONTRACT.md와
//   ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md인데, 둘 다
//   `status: DRAFT_FOR_REVIEW` / `canonical_promotion_allowed: false`인
//   **초안**이다. 따라서 이 초안을 근거로 런타임 동작을 바꾸지 않았다
//   (AGENTS.md §2의 status 판정표). 이 파일은 동작을 바꾸지 않고,
//   **이미 확정된 저장 관문의 효과**만 회귀로 고정한다.
//
// ── 왜 이 테스트가 필요한가 ────────────────────────────────────
// `entriesBetween`은 날짜를 **문자열로만** 비교한다(`e.date >= from`).
// `isValidIsoDate`를 거치지 않는다. 그래서 "2026-02-30"처럼 달력에 없는
// 날짜가 저장소에 들어오면 창 [2026-02-23, 2026-03-01] 안에 사전순으로
// 들어가 합계에 그대로 섞인다.
//
// 실측한 피해 (기준일 2026-03-01, 8km 일지 하나 + 50km 깨진 날짜 하나):
//   깨진 항목 없을 때 -> 1세션 /  8km / 1일
//   깨진 항목 있을 때 -> 2세션 / 58km / 2일
//
// 게다가 `journal-archive`·`home-view-model`·`plan-beta-flow`는
// `isValidIsoDate`로 걸러낸다. 즉 같은 일지가 주간 합계에는 있고
// 아카이브에는 없어서 **화면마다 다른 숫자**를 보게 된다.
//
// ── 왜 aggregates.ts에 필터를 더 붙이지 않았는가 ───────────────
// 저장 관문(`journal-schema.ts`의 `journalDateSchema`)이 이미 막는다.
// 실측으로 확인했다:
//   2026-02-30 -> 거부   2026-13-01 -> 거부   2027-02-29(평년) -> 거부
//   2026-02-28 -> 저장   2028-02-29(윤년)    -> 저장
// 관문이 막는데 화면마다 필터를 덧대는 건 근본 수정이 아니고(빼먹는 화면이
// 또 생긴다) 코드만 늘린다. 그래서 **동작은 그대로 두고**, 관문이 무너지면
// 집계가 조용히 부푼다는 사실을 이 테스트로 붙잡아 둔다.
//
// 즉 이 파일은 `aggregates`의 방어를 주장하지 않는다.
// **저장 관문이 집계까지 실제로 지켜준다는 연결을 고정**하는 것이다.

import { describe, expect, it } from "vitest"

import { thisWeekStats } from "./aggregates"
import { parseJournalEntry } from "./journal-schema"
import type { AnalysisJournalEntry, AnalysisPostSessionEntry } from "./safe-export"

const REFERENCE_DATE = "2026-03-01" // 일요일. 주 창은 [2026-02-23, 2026-03-01]

function rawEntry(date: string, distanceKm: string): Record<string, unknown> {
  return {
    id: `session-${date}`,
    kind: "post-session",
    date,
    savedAt: "2026-03-01T00:00:00.000Z",
    syncState: "local",
    system: "easy",
    title: "조깅",
    distanceKm,
    durationMin: "40",
    avgPace: "5:00",
    rpe: 5,
    memo: "",
  }
}

function analysisEntry(date: string, distanceKm: string): AnalysisPostSessionEntry {
  return rawEntry(date, distanceKm) as unknown as AnalysisPostSessionEntry
}

describe("aggregates 날짜 무결성 — 저장 관문이 집계를 지켜준다", () => {
  // G-1. 관문이 실제로 막는지부터 확인한다. 이게 무너지면 G-2의 전제가
  // 사라지므로 함께 고정한다.
  it.each([
    { date: "2026-02-30", reason: "2월 30일은 존재하지 않는다" },
    { date: "2026-13-01", reason: "13월은 존재하지 않는다" },
    { date: "2026-04-31", reason: "4월은 30일까지다" },
    { date: "2027-02-29", reason: "2027은 평년이다" },
  ])("G-1 달력에 없는 날짜($date)는 저장 단계에서 거부된다 — $reason", ({ date }) => {
    expect(parseJournalEntry(rawEntry(date, "50"))).toBeNull()
  })

  // G-2. 정상 날짜는 계속 저장돼야 한다. 과잉 차단은 사용자의 실제 기록을
  // 잃게 만든다 — 이쪽이 더 큰 피해다.
  it.each(["2026-02-28", "2028-02-29", "2026-03-01"])(
    "G-2 실재하는 날짜(%s)는 정상 저장된다",
    (date) => {
      expect(parseJournalEntry(rawEntry(date, "8"))).not.toBeNull()
    },
  )

  // G-3. 관문을 통과한 정상 데이터만으로는 합계가 정확하다.
  it("G-3 정상 일지만 있으면 주간 합계가 실제 값과 같다", () => {
    const stats = thisWeekStats(
      [analysisEntry("2026-02-28", "8"), analysisEntry("2026-02-25", "12")],
      REFERENCE_DATE,
    )

    expect(stats.sessions).toBe(2)
    expect(stats.distanceKm).toBe(20)
    expect(stats.daysLogged).toBe(2)
  })

  // G-4. 이게 이 파일의 핵심이다.
  // 관문이 뚫렸다고 가정하고 깨진 날짜를 집계에 직접 먹이면, aggregates는
  // 스스로 막지 못하고 합계가 부푼다. 이 사실 자체를 고정해 둔다.
  //
  // 이 테스트는 "aggregates가 안전하다"고 주장하지 않는다. 정반대로
  // **aggregates에는 방어가 없으니 저장 관문을 절대 약화시키지 말라**는
  // 경고를 실행 가능한 형태로 남기는 것이다. 관문을 없애려는 변경이
  // 있으면 G-1이 먼저 실패해서 이 연결을 상기시킨다.
  it("G-4 관문이 뚫리면 집계가 조용히 부푼다 — aggregates에는 자체 방어가 없다", () => {
    const cleanOnly = thisWeekStats([analysisEntry("2026-02-28", "8")], REFERENCE_DATE)
    const withBroken = thisWeekStats(
      [analysisEntry("2026-02-28", "8"), analysisEntry("2026-02-30", "50")],
      REFERENCE_DATE,
    )

    expect(cleanOnly.distanceKm).toBe(8)
    // 8km 일지 하나뿐인데 58km가 된다 — 실측된 피해 그대로
    expect(withBroken.distanceKm).toBe(58)
    expect(withBroken.sessions).toBe(2)
    expect(withBroken.daysLogged).toBe(2)
  })

  // G-5. 사전순 비교의 성질상 "13월"은 어떤 실제 월보다 문자열이 크므로
  // 주간 창에 걸리지 않는다. 즉 우연히 합계를 오염시키지 않는다.
  // 이 사실을 적어 두는 이유: 우연히 안전한 것을 설계된 방어로 착각하면
  // 안 되기 때문이다. 그래서 G-1이 13월도 저장 단계에서 막는 것을 함께
  // 고정한다.
  it("G-5 13월은 사전순으로 창 밖이라 합계를 오염시키지 않는다(우연이지 방어가 아니다)", () => {
    const stats = thisWeekStats(
      [analysisEntry("2026-02-28", "8"), analysisEntry("2026-13-01", "50")],
      REFERENCE_DATE,
    )

    expect(stats.distanceKm).toBe(8)
    expect(stats.sessions).toBe(1)
  })

  // G-6. 빈 날짜도 창 밖(사전순 최소)이라 합계에 안 섞인다.
  // 역시 우연이므로 저장 단계 차단(G-1)과 함께 봐야 한다.
  it("G-6 빈 날짜는 창 밖이라 합계에 섞이지 않는다", () => {
    const stats = thisWeekStats(
      [analysisEntry("2026-02-28", "8"), analysisEntry("", "50")],
      REFERENCE_DATE,
    )

    expect(stats.distanceKm).toBe(8)
    expect(stats.sessions).toBe(1)
  })

  // G-7. 주 경계 자체가 정확해야 한다. 월요일 시작(weekStartOf)이 흔들리면
  // 지난주 훈련이 이번 주에 붙어 주간 부하가 과대평가된다.
  it("G-7 주 창은 월요일부터 기준일까지이며 그 밖은 제외한다", () => {
    const all: AnalysisJournalEntry[] = [
      analysisEntry("2026-02-22", "100"), // 일요일 — 지난 주
      analysisEntry("2026-02-23", "5"), // 월요일 — 이번 주 시작
      analysisEntry("2026-03-01", "7"), // 기준일 당일 — 포함
      analysisEntry("2026-03-02", "100"), // 기준일 다음 날 — 제외
    ]

    const stats = thisWeekStats(all, REFERENCE_DATE)

    expect(stats.distanceKm).toBe(12)
    expect(stats.sessions).toBe(2)
  })
})
