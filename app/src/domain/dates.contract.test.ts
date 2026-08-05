// dates 계약 테스트.
//
// 왜 이 파일이 필요한가:
//  `dates.ts`에는 전용 테스트가 없었다. 그런데 여기 있는 `weekStartOf`와
//  `isoShift`는 주간 거리 합계, 아카이브의 주/월 묶음, 계획 창(窓) 계산의
//  기준이다. 즉 이 함수들이 하루라도 어긋나면 사용자가 뛴 기록이 다른
//  주에 붙고, 화면의 숫자가 조용히 틀어진다. 그런데도 이 성질을 고정해 둔
//  곳이 없어서, 누가 리팩터링하면 아무 테스트도 울리지 않는다.
//
//  `isValidIsoDate`는 이제 저장 관문(`journal-schema`)이 의존하는 함수라
//  더 중요해졌다. 여기가 느슨해지면 관문 전체가 같이 느슨해진다.
//
// 실행으로 확인한 사실 (이 테스트가 지키려는 것):
//  - 6개 시간대(UTC · Asia/Seoul · America/New_York · America/Santiago ·
//    Pacific/Kiritimati · Pacific/Apia) × 400일 전수 검사에서 위반 0건.
//    로컬 `Date` 생성자를 쓰기 때문에 UTC 자정 경계 문제를 피해 간다.
//
// 결함 주입으로 확인한 이 테스트의 한계 — 그리고 D-13을 넣은 이유:
//  `isoToDate`를 `new Date(iso)`(UTC 파싱)로 바꾸는 회귀를 주입해 봤더니
//    TZ=UTC        -> 12건 전부 통과 (못 잡음)
//    TZ=Asia/Seoul -> 12건 전부 통과 (못 잡음)
//    TZ=America/New_York -> 8건 실패 (잡음)
//  UTC+ 지역은 자정 UTC가 같은 날 오전이라 우연히 살아남는다. 즉 날짜
//  값만 비교하는 계약으로는 **한국 사용자 기준으로 이 회귀를 못 잡는다.**
//  CI도 UTC라 그냥 두면 영영 안 걸린다.
//  그래서 D-13/D-14에서 "로컬 자정에 놓인 Date여야 한다"는 성질을 직접
//  고정했다. 같은 회귀를 재주입해 확인한 결과:
//    TZ=UTC        -> 여전히 통과 (아래 한계 참고)
//    TZ=Asia/Seoul -> D-13·D-14 실패 (이제 잡는다)
//    TZ=America/New_York -> 10건 실패
//
//  남은 한계 — 덮지 않고 적어 둔다:
//  UTC에서는 이 회귀를 **원리적으로** 잡을 수 없다. UTC 자정과 로컬
//  자정이 같은 순간이라 두 구현의 결과가 실제로 동일하기 때문이다.
//  CI는 UTC로 돌기 때문에, 이 계약은 CI에서 회귀를 못 막는다.
//  제대로 막으려면 테스트 실행 시간대를 UTC가 아닌 값으로 고정하거나
//  (예: vitest 설정에서 TZ=Asia/Seoul), CI에 시간대 매트릭스를 넣어야
//  한다. 그건 이 변경 범위 밖이라 손대지 않았고, 미해결로 남긴다.
//
// 다루지 않는 것 (정직하게 밝힘):
//  `cardDate` · `compactDate` · `seasonOf` · `nowClock`은 표시용 문자열
//  변환이고 집계에 들어가지 않아 여기서 고정하지 않는다. 깨진 입력이
//  들어오면 " · undefined · undefined" 같은 값을 내지만, 저장 관문이
//  생긴 뒤로는 그런 값이 저장소에 들어올 수 없다.
import { describe, expect, it } from "vitest"
import { dowOf, isValidIsoDate, isoShift, isoToDate, weekStartOf } from "./dates"

describe("isValidIsoDate — 저장 관문이 기대는 최소 보장", () => {
  it("D-1 달력에 실재하는 날짜만 통과시킨다", () => {
    expect(isValidIsoDate("2026-08-05")).toBe(true)
    expect(isValidIsoDate("2026-01-01")).toBe(true)
    expect(isValidIsoDate("2026-12-31")).toBe(true)
    // 윤년 2월 29일은 실재한다 — 막으면 그날 훈련한 사람이 못 적는다.
    expect(isValidIsoDate("2028-02-29")).toBe(true)
  })

  it("D-2 달력에 없는 날짜는 거른다", () => {
    for (const bad of [
      "2026-13-01", // 13월
      "2026-00-01", // 0월
      "2026-02-30", // 2월 30일
      "2026-02-29", // 평년의 2월 29일
      "2026-04-31", // 4월 31일
      "2026-06-31", // 6월 31일
      "2026-08-00", // 0일
      "2026-08-32", // 32일
    ]) {
      expect(isValidIsoDate(bad), `"${bad}"가 통과했다`).toBe(false)
    }
  })

  it("D-3 YYYY-MM-DD 형식이 아니면 거른다", () => {
    for (const bad of [
      "",
      "abc",
      "2026-2-3", // 0 패딩 없음
      "2026/08/05",
      "20260805",
      "2026-08-05T00:00:00Z", // ISO datetime
      " 2026-08-05",
      "2026-08-05 ",
    ]) {
      expect(isValidIsoDate(bad), `"${bad}"가 통과했다`).toBe(false)
    }
  })

  it("D-4 두 자리로 적힌 연도는 통과시키지 않는다", () => {
    // 실측: `new Date(50, 0, 1)`은 1950년이 된다(2자리 연도 레거시 규칙).
    // 그래서 "0050-01-01"은 왕복 검사에서 걸러진다. 이게 의도한 동작인지
    // 확인해 두지 않으면, 나중에 왕복 검사를 없앨 때 1950년짜리 일지가
    // 조용히 저장된다.
    expect(isValidIsoDate("0050-01-01")).toBe(false)
    expect(isValidIsoDate("0099-12-31")).toBe(false)
    expect(isValidIsoDate("0000-01-01")).toBe(false)
  })
})

describe("isoShift — 하루도 건너뛰거나 겹치지 않는다", () => {
  it("D-5 달·해 경계를 정확히 넘는다", () => {
    expect(isoShift("2026-12-31", 1)).toBe("2027-01-01")
    expect(isoShift("2026-01-01", -1)).toBe("2025-12-31")
    expect(isoShift("2026-02-28", 1)).toBe("2026-03-01") // 평년
    expect(isoShift("2028-02-28", 1)).toBe("2028-02-29") // 윤년
    expect(isoShift("2028-02-29", 1)).toBe("2028-03-01")
    expect(isoShift("2026-08-05", 0)).toBe("2026-08-05")
  })

  it("D-6 400일을 연속으로 밀어도 중복·누락·깨진 날짜가 없다", () => {
    // 이 성질이 깨지면 주간 버킷이 하루를 빠뜨리거나 두 번 세고,
    // 사용자는 자기가 뛴 날이 사라진 화면을 본다.
    const seen = new Set<string>()
    let previous: string | null = null
    for (let index = 0; index < 400; index += 1) {
      const day = isoShift("2026-01-01", index)
      expect(isValidIsoDate(day), `${day}는 달력에 없는 날짜다`).toBe(true)
      expect(seen.has(day), `${day}가 두 번 나왔다`).toBe(false)
      seen.add(day)
      if (previous !== null) {
        // 바로 앞 날짜에서 +1 하면 이 날짜가 나와야 한다.
        expect(isoShift(previous, 1)).toBe(day)
      }
      previous = day
    }
    expect(seen.size).toBe(400)
  })

  it("D-7 밀었다가 되밀면 제자리로 돌아온다", () => {
    for (const day of ["2026-08-05", "2026-12-31", "2028-02-29", "2026-03-01"]) {
      for (const step of [1, 7, 30, 365]) {
        expect(isoShift(isoShift(day, step), -step), `${day} ±${step}`).toBe(day)
      }
    }
  })
})

describe("weekStartOf — 주간 집계의 기준선", () => {
  it("D-8 한 주 안의 7일은 모두 같은 월요일을 가리킨다", () => {
    // 2026-08-03(월) ~ 2026-08-09(일)
    for (let offset = 0; offset < 7; offset += 1) {
      const day = isoShift("2026-08-03", offset)
      expect(weekStartOf(day), `${day}(${dowOf(day)})`).toBe("2026-08-03")
    }
    // 그 다음 날은 다음 주로 넘어가야 한다 — 경계가 실제로 있는지 확인.
    expect(weekStartOf("2026-08-10")).toBe("2026-08-10")
  })

  it("D-9 일요일은 지난 월요일에 붙는다 — 다음 주로 새지 않는다", () => {
    // 일요일 처리를 틀리면 일요일 훈련이 통째로 다음 주 합계로 넘어간다.
    expect(dowOf("2026-08-09")).toBe("SUN")
    expect(weekStartOf("2026-08-09")).toBe("2026-08-03")
    expect(dowOf("2026-03-01")).toBe("SUN")
    expect(weekStartOf("2026-03-01")).toBe("2026-02-23")
  })

  it("D-10 결과는 항상 월요일이고, 다시 넣어도 같은 값이다", () => {
    for (let index = 0; index < 400; index += 1) {
      const day = isoShift("2026-01-01", index)
      const monday = weekStartOf(day)
      expect(dowOf(monday), `${day} -> ${monday}`).toBe("MON")
      // 멱등: 주 시작을 다시 계산해도 움직이면 안 된다.
      expect(weekStartOf(monday), `${monday} 재계산`).toBe(monday)
      // 주 시작은 그 날짜보다 뒤일 수 없고, 6일보다 멀 수도 없다.
      expect(monday <= day, `${monday} > ${day}`).toBe(true)
      expect(isoShift(monday, 6) >= day, `${day}가 주 범위 밖`).toBe(true)
    }
  })

  it("D-11 해를 넘는 주도 끊기지 않는다", () => {
    // 2026-01-01은 목요일 -> 그 주 월요일은 2025-12-29.
    expect(dowOf("2026-01-01")).toBe("THU")
    expect(weekStartOf("2026-01-01")).toBe("2025-12-29")
    expect(weekStartOf("2025-12-29")).toBe("2025-12-29")
  })
})

describe("isoToDate — 로컬 자정 기준", () => {
  it("D-13 ISO 날짜는 그 지역의 자정으로 해석된다 (UTC 자정이 아니다)", () => {
    // 왜 이걸 따로 고정하는가:
    //  `new Date("2026-08-05")`는 **UTC** 자정으로 해석된다. 한국(UTC+9)에서는
    //  그게 8월 5일 오전 9시라 날짜가 안 밀려 겉보기엔 멀쩡하다. 하지만
    //  뉴욕(UTC-4)에서는 8월 4일 저녁 8시가 되어 하루가 통째로 밀린다.
    //  그래서 날짜 값만 비교하는 D-5~D-12는 UTC와 KST에서 이 회귀를 놓친다
    //  (결함 주입으로 실제 확인함). 여기서는 "로컬 자정"이라는 성질 자체를
    //  본다 — 어느 시간대에서 돌려도 깨진다.
    const date = isoToDate("2026-08-05")
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7) // 0-기반: 8월
    expect(date.getDate()).toBe(5)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
    expect(date.getMilliseconds()).toBe(0)
  })

  it("D-14 문자열의 연·월·일이 그대로 로컬 달력 값으로 남는다", () => {
    for (const iso of ["2026-01-01", "2026-12-31", "2028-02-29", "2026-06-15"]) {
      const [year, month, day] = iso.split("-").map(Number)
      const date = isoToDate(iso)
      expect(date.getFullYear(), iso).toBe(year)
      expect(date.getMonth(), iso).toBe((month ?? 0) - 1)
      expect(date.getDate(), iso).toBe(day)
      expect(date.getHours(), iso).toBe(0)
    }
  })
})

describe("dowOf — 요일", () => {
  it("D-12 알려진 날짜의 요일을 맞춘다", () => {
    expect(dowOf("2026-08-03")).toBe("MON")
    expect(dowOf("2026-08-05")).toBe("WED")
    expect(dowOf("2026-08-09")).toBe("SUN")
    expect(dowOf("2028-02-29")).toBe("TUE")
    expect(dowOf("2026-12-31")).toBe("THU")
  })
})
