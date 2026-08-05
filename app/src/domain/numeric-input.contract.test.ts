// 숫자 입력 파싱 계약 테스트.
//
// 왜 이 파일이 필요한가:
//  `numeric-input.ts`에는 테스트가 **한 건도 없었다.** 그런데 이 모듈은
//  일지의 거리·시간·페이스를 숫자로 바꾸는 유일한 관문이고, 그 결과가
//  주간 합계와 추이 그래프에 그대로 들어간다.
//
//  실행으로 확인한 실제 동작(수정 전):
//    parseDecimalString("999999999") -> 999999999
//    parseDecimalString("-5")        -> -5
//  그래서 `thisWeekStats`가 이런 값을 냈다:
//    거리 8km 일지 + 오타 "999999999" -> distanceKm: 1000000007
//    거리 8km 일지 + "-100"           -> distanceKm: -92
//
//  이건 "꾸며낸 값을 분석에 넣지 않는다"는 원칙을 정면으로 어긴다.
//  사용자는 자기가 8km를 뛰었는데 화면이 10억 km라고 말하는 것을 본다.
//  숫자 하나 잘못 눌러서 생기는 일이므로 드문 사고가 아니다.
//
// 고정하는 계약:
//  N-1 사람이 달릴 수 있는 범위를 벗어난 값은 **받지 않는다**(null).
//      받아서 조용히 잘라내면(clamp) 사용자가 적지 않은 값을 앱이 만든 것이 된다.
//  N-2 음수 거리·시간은 받지 않는다.
//  N-3 경계값은 정확히 지킨다 — 상한 자체는 받고, 그보다 크면 거부.
//  N-4 정상 범위 값은 그대로 통과한다(과잉 차단 금지).
//  N-5 페이스도 같은 원칙 — 사람 범위를 벗어나면 거부.
import { describe, expect, it } from "vitest"
import {
  MAX_DISTANCE_KM,
  MAX_DURATION_MIN,
  MAX_PACE_SECONDS_PER_KM,
  parseDecimalString,
  parseDistanceKm,
  parseDurationMin,
  parsePaceText,
} from "./numeric-input"

describe("parseDecimalString — 형식만 본다 (범위 판단은 호출자 몫)", () => {
  it("N-4 정상 값은 그대로 통과한다", () => {
    expect(parseDecimalString("8")).toBe(8)
    expect(parseDecimalString("42.195")).toBe(42.195)
    expect(parseDecimalString("0.5")).toBe(0.5)
    expect(parseDecimalString(" 12 ")).toBe(12)
  })

  it("형식이 아니면 null", () => {
    expect(parseDecimalString("")).toBeNull()
    expect(parseDecimalString("8km")).toBeNull()
    expect(parseDecimalString("1e30")).toBeNull()
    expect(parseDecimalString("abc")).toBeNull()
  })
})

describe("parseDistanceKm — 사람이 달릴 수 있는 범위만 받는다", () => {
  it("N-1 터무니없이 큰 값은 받지 않는다 — 조용히 잘라내지도 않는다", () => {
    // 잘라내면(예: 1000으로 clamp) 사용자가 적지 않은 숫자를 앱이 만들어낸 것이 된다.
    // 받지 않고 null을 주면, 화면은 "이 값은 분석에 못 넣었어요"라고 말할 수 있다.
    expect(parseDistanceKm("999999999")).toBeNull()
    expect(parseDistanceKm("42195000")).toBeNull()
  })

  it("N-2 음수 거리는 받지 않는다", () => {
    expect(parseDistanceKm("-5")).toBeNull()
    expect(parseDistanceKm("-0.1")).toBeNull()
  })

  it("0은 받지 않는다 — 0km를 뛴 훈련은 거리 기록이 아니다", () => {
    expect(parseDistanceKm("0")).toBeNull()
  })

  it("N-3 상한 경계를 정확히 지킨다", () => {
    expect(parseDistanceKm(String(MAX_DISTANCE_KM))).toBe(MAX_DISTANCE_KM)
    expect(parseDistanceKm(String(MAX_DISTANCE_KM + 1))).toBeNull()
  })

  it("N-4 실제 사람이 적는 값은 전부 통과한다", () => {
    // 울트라마라톤·100마일(약 161km)까지는 정상 기록이다.
    for (const value of ["3", "8", "21.0975", "42.195", "100", "161", "250"]) {
      expect(parseDistanceKm(value)).not.toBeNull()
    }
  })
})

describe("parseDurationMin — 시간도 같은 원칙", () => {
  it("N-1 터무니없이 긴 시간은 받지 않는다", () => {
    expect(parseDurationMin("999999")).toBeNull()
  })

  it("N-2 음수 시간은 받지 않는다", () => {
    expect(parseDurationMin("-30")).toBeNull()
  })

  it("N-3 상한 경계를 정확히 지킨다", () => {
    expect(parseDurationMin(String(MAX_DURATION_MIN))).toBe(MAX_DURATION_MIN)
    expect(parseDurationMin(String(MAX_DURATION_MIN + 1))).toBeNull()
  })

  it("N-4 실제 값은 통과한다 — 100마일 완주는 24시간을 넘기도 한다", () => {
    for (const value of ["20", "45", "180", "600", "1440"]) {
      expect(parseDurationMin(value)).not.toBeNull()
    }
  })
})

describe("parsePaceText — 사람 범위를 벗어난 페이스는 거부", () => {
  it("N-4 정상 페이스는 통과한다", () => {
    expect(parsePaceText("5:30")).toBe(330)
    expect(parsePaceText("3:00")).toBe(180)
    expect(parsePaceText("12:00")).toBe(720)
  })

  it("N-5 터무니없이 느린 페이스는 받지 않는다", () => {
    // 500:00/km는 1km에 8시간이다 — 기록 실수이지 훈련이 아니다.
    expect(parsePaceText("500:00")).toBeNull()
    expect(parsePaceText("9999:59")).toBeNull()
  })

  it("N-3 상한 경계를 정확히 지킨다", () => {
    const minutes = Math.floor(MAX_PACE_SECONDS_PER_KM / 60)
    const seconds = MAX_PACE_SECONDS_PER_KM % 60
    const atLimit = `${minutes}:${String(seconds).padStart(2, "0")}`
    expect(parsePaceText(atLimit)).toBe(MAX_PACE_SECONDS_PER_KM)
    const overMinutes = Math.floor((MAX_PACE_SECONDS_PER_KM + 60) / 60)
    expect(parsePaceText(`${overMinutes}:00`)).toBeNull()
  })

  it("초가 60 이상이면 받지 않는다 (기존 계약 유지)", () => {
    expect(parsePaceText("5:60")).toBeNull()
    expect(parsePaceText("5:99")).toBeNull()
  })

  it("형식이 아니면 null (기존 계약 유지)", () => {
    expect(parsePaceText("5분30초")).toBeNull()
    expect(parsePaceText("330")).toBeNull()
    expect(parsePaceText("0:00")).toBeNull()
  })
})
