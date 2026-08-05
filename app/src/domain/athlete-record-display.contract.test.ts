// 선수 기록 "표시" 계층 계약 고정.
//
// 스펙 출처 (AGENTS.md §2 라우팅 표에 따라 착수 전 열람):
//   - WORK_ORDER_P1_ATHLETE_RECORDS.md §5 경과·시즌 표시, §7.2 표시·날짜
//   - PRODUCT_NORTH_STAR.md §3 (오래된기록: 침묵하고_계산하지_말_것_반드시_명시)
//
// 이 파일은 새 규칙을 발명하지 않는다. 스펙 §7.2가 이미 today=2026-07-27
// 기준 기대값 표를 적어 뒀고, 그 표를 그대로 테스트로 옮긴 것이다.
//
// 왜 이 모듈이 안전 문제인가:
//   기록은 날짜 때문에 자동 폐기되지 않는다(§5). 대신 "얼마나 오래된
//   기록인지"를 항상 표시해서, 3년 전 PB를 오늘의 실력으로 착각하지 않게
//   한다. 경과 라벨이 틀리면 오래된 기록이 최신처럼 보이고, 그 위에서
//   훈련 강도가 처방되면 부상으로 이어진다. 라벨은 장식이 아니라 안전장치다.
//
// 스펙이 명시한 테스트 방식 두 가지를 그대로 지킨다:
//   - "가짜 시계는 사용하지 않는다. today 주입만 사용한다." (§7.2)
//   - "함수 안에서 new Date()를 호출하지 않음" (§5)

import { describe, expect, it } from "vitest"

import type { AthleteRecord } from "./athlete-records"
import {
  SEASON_WINDOW_MONTHS,
  athleteRecordAuthorityCopy,
  elapsedSinceAchieved,
  formatRecordTime,
  recordPurposeLabel,
  seasonWindowLabel,
} from "./athlete-record-display"

// 스펙 §7.2가 지정한 기준일. 이 값을 바꾸면 아래 기대값 표가 전부 무의미해진다.
const TODAY = new Date(2026, 6, 27) // 2026-07-27 (로컬 자정)

type Achieved = { readonly purpose: "PERSONAL_BEST" | "RECENT_RESULT"; readonly achievedOn: string }

function base(): Omit<AthleteRecord, "purpose" | "achievedOn" | "seasonId"> {
  return {
    schemaVersion: 1,
    id: "rec-1",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:rec-1",
    savedAt: "2026-07-27T00:00:00.000Z",
  }
}

function achievedRecord(over: Achieved): AthleteRecord {
  return { ...base(), purpose: over.purpose, achievedOn: over.achievedOn, seasonId: null }
}

function seasonBest(achievedOn: string): Extract<AthleteRecord, { readonly purpose: "SEASON_BEST" }> {
  return { ...base(), purpose: "SEASON_BEST", achievedOn, seasonId: "2026" }
}

function raceGoal(): AthleteRecord {
  return { ...base(), purpose: "RACE_GOAL", achievedOn: null, seasonId: null }
}

describe("athlete-record-display / 경과 계산 (스펙 §7.2 표)", () => {
  // A-1. 스펙 §7.2의 기대값 표를 그대로 옮긴 것.
  it.each([
    { achievedOn: "2026-07-03", months: 0, label: "이번 달" },
    { achievedOn: "2026-03-27", months: 4, label: "4개월 전" },
    { achievedOn: "2023-05-10", months: 38, label: "3년 2개월 전" },
  ])("A-1 $achievedOn 은 $label 로 표시된다", ({ achievedOn, months, label }) => {
    const elapsed = elapsedSinceAchieved(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn }),
      TODAY,
    )

    expect(elapsed).not.toBeNull()
    expect(elapsed?.months).toBe(months)
    expect(elapsed?.label).toBe(label)
  })

  // A-2. 스펙 §5: "오늘 일 < 달성 일이면 months - 1".
  // 이 한 줄이 빠지면 "아직 한 달이 안 됐는데 1개월 전"이라고 말하게 된다.
  // 경계에서만 드러나므로 하루 차이로 고정한다.
  it("A-2 달성일이 오늘 일자보다 뒤면 개월 수를 한 달 깎는다", () => {
    // 2026-06-28 -> 오늘(27일)이 달성일(28일)보다 앞이므로 아직 1개월 미만
    const notYet = elapsedSinceAchieved(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2026-06-28" }),
      TODAY,
    )
    // 2026-06-27 -> 정확히 1개월
    const exactly = elapsedSinceAchieved(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2026-06-27" }),
      TODAY,
    )

    expect(notYet?.months).toBe(0)
    expect(notYet?.label).toBe("이번 달")
    expect(exactly?.months).toBe(1)
    expect(exactly?.label).toBe("1개월 전")
  })

  // A-3. 스펙 §5: 12개월 단위 라벨. 나머지가 0이면 "N년 전", 아니면 "N년 M개월 전".
  it.each([
    { achievedOn: "2025-07-27", label: "12개월 전은 1년 전", expected: "1년 전" },
    { achievedOn: "2024-07-27", label: "24개월 전은 2년 전", expected: "2년 전" },
    { achievedOn: "2025-06-27", label: "13개월 전은 1년 1개월 전", expected: "1년 1개월 전" },
    { achievedOn: "2025-08-27", label: "11개월 전은 연 단위로 넘어가지 않는다", expected: "11개월 전" },
  ])("A-3 $label", ({ achievedOn, expected }) => {
    const elapsed = elapsedSinceAchieved(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn }),
      TODAY,
    )

    expect(elapsed?.label).toBe(expected)
  })

  // A-4. 스펙 §5: "RACE_GOAL처럼 achievedOn === null이면 null".
  // 목표 기록에 경과 라벨이 붙으면 달성한 사실처럼 읽힌다.
  it("A-4 목표 기록에는 경과 라벨이 없다", () => {
    expect(elapsedSinceAchieved(raceGoal(), TODAY)).toBeNull()
  })

  // A-5. 깨진 날짜에 숫자를 지어내지 않는다. North Star §3 폴백 원칙:
  // 실패하면 덜 보여준다. 잘못된 경과를 보여주느니 아무것도 안 보여준다.
  it.each(["", "2026-7-3", "20260703", "2026/07/03", "not-a-date"])(
    "A-5 형식이 깨진 달성일(%s)에는 경과를 추정하지 않고 null을 준다",
    (achievedOn) => {
      expect(
        elapsedSinceAchieved(achievedRecord({ purpose: "PERSONAL_BEST", achievedOn }), TODAY),
      ).toBeNull()
    },
  )

  // A-6. 미래 날짜는 저장 단계에서 거부되지만(스펙 §5), 표시 계층이 방어를
  // 포기해도 된다는 뜻은 아니다. 저장소에 이미 들어온 값이나 스키마 우회가
  // 있어도 음수 개월("-3개월 전")이 화면에 나오면 안 된다.
  it("A-6 미래 달성일이 흘러들어와도 음수 개월을 표시하지 않는다", () => {
    const future = elapsedSinceAchieved(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2027-01-27" }),
      TODAY,
    )

    expect(future?.months).toBe(0)
    expect(future?.label).toBe("이번 달")
    expect(future?.months).toBeGreaterThanOrEqual(0)
  })

  // A-7. 스펙 §5: "함수 안에서 new Date()를 호출하지 않음".
  // 주입한 today만으로 결과가 결정돼야 한다. 같은 인자로 두 번 부르면
  // 같은 값이 나오고, today를 바꾸면 결과도 따라 바뀌어야 한다.
  it("A-7 결과는 주입된 today에만 의존한다", () => {
    const record = achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2026-03-27" })

    expect(elapsedSinceAchieved(record, TODAY)).toEqual(elapsedSinceAchieved(record, TODAY))
    expect(elapsedSinceAchieved(record, new Date(2027, 6, 27))?.months).toBe(16)
  })
})

describe("athlete-record-display / 시즌 창 (스펙 §5)", () => {
  // A-8. 스펙 §7.2 표: 2025-01-27 SB는 정확히 18개월이며 창 안.
  //      2024-12-27 SB는 19개월이며 창 밖. 경계값 그대로 고정한다.
  it("A-8 정확히 18개월은 창 안, 19개월부터 창 밖", () => {
    const exactly18 = seasonWindowLabel(seasonBest("2025-01-27"), TODAY)
    const at19 = seasonWindowLabel(seasonBest("2024-12-27"), TODAY)

    expect(SEASON_WINDOW_MONTHS).toBe(18)
    expect(exactly18.withinWindow).toBe(true)
    expect(exactly18.label).toBe("시즌 범위 안 (1년 6개월 전)")
    expect(at19.withinWindow).toBe(false)
    expect(at19.label).toBe("시즌 범위 밖 (1년 7개월 전)")
  })

  // A-9. 스펙 §5: "저장, 선택, 계산 가능 여부를 반환하지 않는다."
  // 18개월은 화면 분류용 제품 정책이지 과학적 안전 임계값이 아니다.
  // 창 밖이어도 기록 자체는 살아 있어야 한다 — 반환값은 라벨 두 개뿐이다.
  it("A-9 시즌 창은 라벨만 반환하고 사용 가능 여부를 판정하지 않는다", () => {
    const outside = seasonWindowLabel(seasonBest("2020-01-27"), TODAY)

    expect(Object.keys(outside).sort()).toEqual(["label", "withinWindow"])
    // 창 밖이어도 경과 라벨은 여전히 계산돼 기록이 살아 있음을 보여준다
    expect(outside.label).toContain("6년")
  })

  // A-10. 날짜가 깨졌을 때 조용히 "창 안"으로 처리하면, 검증 불가한 기록이
  // 현재 시즌 기록으로 둔갑한다. 반드시 창 밖 + 확인 요구 문구여야 한다.
  it("A-10 달성일을 읽을 수 없으면 창 안으로 처리하지 않고 확인을 요구한다", () => {
    const broken = seasonWindowLabel(seasonBest("2025-13-99"), TODAY)

    expect(broken.withinWindow).toBe(false)
    expect(broken.label).toBe("시즌 범위 밖 (날짜 확인 필요)")
  })
})

describe("athlete-record-display / 권위 문구 (스펙 §4.2, §6)", () => {
  // A-11. 스펙 §4.2: RACE_GOAL은 "현재 실력 또는 오늘 처방으로 사용 금지".
  // 이 문구가 사라지면 목표 기록이 실제 경기력으로 읽힌다. North Star §5
  // 사례 2가 다룬 GOAL_ANCHOR 오해의 표시 계층 대응물이다.
  it("A-11 목표 기록은 현재 경기력이 아님을 문구로 밝힌다", () => {
    const copy = athleteRecordAuthorityCopy(raceGoal())

    expect(copy).toBe("직접 입력한 목표 · 현재 경기력 기록이 아님")
    expect(copy).toContain("현재 경기력 기록이 아님")
  })

  // A-12. 목표 기록은 입력자·검증 상태와 무관하게 항상 목표로 표시돼야 한다.
  // 코치가 입력했다고 해서 "코치가 입력한 기록"이 되면 실측처럼 보인다.
  it("A-12 목표 기록의 문구는 입력자·검증 상태에 흔들리지 않는다", () => {
    const coachGoal: AthleteRecord = {
      ...raceGoal(),
      enteredBy: "COACH",
      verificationState: "VERIFIED",
    }

    expect(athleteRecordAuthorityCopy(coachGoal)).toBe(
      "직접 입력한 목표 · 현재 경기력 기록이 아님",
    )
  })

  // A-13. 스펙 §6: 입력자와 검증 상태를 이해하기 쉬운 문구로 표시한다.
  // 어떤 조합이든 빈 문자열이 나오면 화면에서 출처가 사라진다.
  it.each([
    { enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", expected: "직접 입력한 기록" },
    { enteredBy: "COACH", verificationState: "VERIFIED", expected: "코치가 입력한 기록" },
    { enteredBy: "VERIFIED_IMPORT", verificationState: "VERIFIED", expected: "확인된 가져오기 기록" },
    // 선수 입력인데 자기신고가 아닌 조합은 상태를 단정하지 않는다
    { enteredBy: "ATHLETE", verificationState: "UNVERIFIED", expected: "검증 상태를 확인할 기록" },
  ] as const)(
    "A-13 $enteredBy/$verificationState 는 '$expected'",
    ({ enteredBy, verificationState, expected }) => {
      const record: AthleteRecord = {
        ...achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2026-03-27" }),
        enteredBy,
        verificationState,
      }

      expect(athleteRecordAuthorityCopy(record)).toBe(expected)
    },
  )

  // A-14. 선수가 직접 넣은 기록이 "확인된" 것처럼 보이면 안 된다.
  // 스펙 §7.1: "현재 화면이 VERIFIED 또는 VERIFIED_IMPORT를 허위 생성하지
  // 않는지 확인". 그 표시 계층 대응물.
  it("A-14 선수 자기신고 기록에 '확인된' 표현을 붙이지 않는다", () => {
    const copy = athleteRecordAuthorityCopy(
      achievedRecord({ purpose: "PERSONAL_BEST", achievedOn: "2026-03-27" }),
    )

    expect(copy).not.toContain("확인된")
    expect(copy).not.toContain("코치")
  })
})

describe("athlete-record-display / 기록 표기", () => {
  // A-15. 스펙 §6 예시: "5000m · 18분 30초 · 개인 최고".
  // 초가 0일 때 "18분 0초"를 빠뜨리거나 60초로 넘기면 기록이 달라진다.
  it.each([
    { seconds: 1110, expected: "18분 30초" },
    { seconds: 1080, expected: "18분 0초" },
    { seconds: 59, expected: "0분 59초" },
    { seconds: 3600, expected: "60분 0초" },
    // 소수 기록(계시)이 부동소수점 잔여로 깨지지 않아야 한다
    { seconds: 1110.53, expected: "18분 30.53초" },
  ])("A-15 $seconds 초는 '$expected'", ({ seconds, expected }) => {
    expect(formatRecordTime(seconds)).toBe(expected)
  })

  // A-16. 스펙 §6: 역할(PB, SB, 최근 결과, 경기 목표)을 화면에 표시한다.
  // 라벨이 겹치면 서로 다른 권위의 기록이 같은 것으로 보인다.
  it("A-16 네 가지 역할 라벨은 서로 구별된다", () => {
    const labels = [
      recordPurposeLabel("PERSONAL_BEST"),
      recordPurposeLabel("SEASON_BEST"),
      recordPurposeLabel("RECENT_RESULT"),
      recordPurposeLabel("RACE_GOAL"),
    ]

    expect(labels).toEqual(["개인 최고", "시즌 최고", "최근 경기", "경기 목표"])
    expect(new Set(labels).size).toBe(4)
  })
})
