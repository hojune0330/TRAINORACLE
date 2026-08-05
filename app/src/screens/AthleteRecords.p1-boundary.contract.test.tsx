// WORK_ORDER_P1 §7.3 경계 회귀 — 선수 기록이 넘지 말아야 할 선
//
// 근거 문서: WORK_ORDER_P1_ATHLETE_RECORDS.md
//   revision: SOL_CONTRACT_CORRECTION_2026-07-28
//   status:   READY_FOR_IMPLEMENTATION
//   §7.3에 다섯 가지 경계가 적혀 있고, 그중 런타임으로 확인 가능한 네 가지를
//   여기서 고정한다.
//
// 이 파일은 런타임 코드를 한 줄도 바꾸지 않는다. §7.1(스키마·저장)과
// §7.2(표시·날짜)는 이미 각각 athlete-records.contract.test.ts와
// athlete-record-display.contract.test.ts가 덮고 있다. 비어 있던 것은 §7.3뿐이다.
//
// §7.3 항목과 이 파일의 대응:
//   1. 기록 날짜로 freshnessState를 자동 생성하는 코드가 없음  → B-1, B-2
//   2. 오래된 기록을 숨기거나 비활성화하는 코드가 없음          → B-3, B-4
//   3. 페이스 숫자를 계산하거나 표시하는 코드가 없음            → B-5
//   4. 새 저장 구조에 자유 텍스트 필드가 없음                   → B-6, B-7
//   5. impl/, specs/, journal-schema.ts, journal-store.ts 변경 없음
//        → 이것은 런타임 불변식이 아니라 변경 범위 규칙이다. 테스트가 아니라
//          git diff로 확인해야 하며, 여기서 확인한 척하지 않는다.
//
// B-2의 범위를 좁혀서 적는다:
//   `freshnessState`는 P1 시점에는 앱에 존재하지 않았고, 이후 P3(개인 페이스)에서
//   사용자가 직접 고르는 값으로 들어왔다. P3의 스펙(DECISION_BRIEFING_PERSONAL_PACE)은
//   아직 오너 결정 대기 상태이므로, 이 파일은 P3의 설계가 옳다고 승인하지 않는다.
//   오직 P1 §7.3이 금지한 것 하나만 고정한다 — "날짜에서 현재성을 유도하지 않는다".
//   즉 주입된 값이 그대로 나오는지만 본다. 값의 의미나 UI 흐름은 다루지 않는다.

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  createSelfReportedAthleteRecord,
  loadAthleteRecords,
  saveAthleteRecord,
} from "../domain/athlete-records"
import type { AthleteRecord } from "../domain/athlete-records"
import { toCurrentSnapshot, toRuntimeAnchor } from "../domain/pace-target-evidence"
import { AthleteRecords } from "./AthleteRecords"

const TODAY = new Date(2026, 6, 27, 12)

// 계약 §4의 저장 구조가 허용하는 키 전체. 이 목록 밖의 키는 존재하면 안 된다.
const CONTRACT_KEYS = [
  "achievedOn",
  "enteredBy",
  "eventDistanceM",
  "id",
  "performanceSeconds",
  "purpose",
  "savedAt",
  "schemaVersion",
  "seasonId",
  "sourceRef",
  "verificationState",
] as const

function record(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: 1,
    id: "pb-5000",
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2024-03-10",
    seasonId: null,
    enteredBy: "ATHLETE",
    verificationState: "SELF_REPORTED",
    sourceRef: "athlete-record:pb-5000",
    savedAt: "2026-07-27T03:00:00.000Z",
    ...overrides,
  }
}

/** 저장까지 성공시키고 파싱된 기록을 돌려준다. 실패하면 테스트를 세운다. */
function persisted(overrides: Record<string, unknown> = {}): AthleteRecord {
  expect(saveAthleteRecord(record(overrides), TODAY).ok).toBe(true)
  const loaded = loadAthleteRecords(TODAY)
  const found = loaded.find((item) => item.id === (overrides.id ?? "pb-5000"))
  expect(found).toBeDefined()
  if (found === undefined) throw new Error("unreachable")
  return found
}

beforeEach(() => window.localStorage.clear())

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("P1 §7.3-1·2 현재성은 날짜에서 만들어지지 않는다", () => {
  // B-1: 저장 구조 자체가 현재성을 담지 않는다.
  //      저장된 값에 freshnessState가 있으면, 그 순간부터 "언제 저장했는지"가
  //      "지금 실력인지"로 굳어 버린다. 계약 §4.2가 "이 표는 freshnessState를
  //      결정하지 않는다"고 못 박은 이유다.
  it("B-1 저장한 기록 어디에도 현재성 상태가 붙지 않는다", () => {
    persisted({ id: "fresh-5000", achievedOn: "2026-07-26", sourceRef: "athlete-record:fresh-5000" })
    persisted({ id: "old-5000", achievedOn: "2016-05-10", sourceRef: "athlete-record:old-5000" })

    const raw = window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY) ?? ""
    expect(raw).not.toMatch(/freshness/iu)
    expect(raw).not.toMatch(/"(CURRENT|STALE|UNKNOWN)"/u)

    for (const item of loadAthleteRecords(TODAY)) {
      expect(Object.keys(item)).not.toContain("freshnessState")
    }
  })

  // B-2: 엔진 앵커로 넘길 때도 날짜가 현재성을 뒤집지 못한다.
  //      10년 된 기록에 CURRENT를 주면 CURRENT로 남고(자동 강등 금지),
  //      어제 기록에 UNKNOWN을 주면 UNKNOWN으로 남는다(자동 승격 금지).
  //      두 방향을 모두 봐야 "날짜와 무관"이 증명된다. 한 방향만 보면
  //      단순히 보수적인 구현도 통과해 버린다.
  it.each([
    ["10년 된 기록 + CURRENT", "2016-05-10", "CURRENT"],
    ["10년 된 기록 + STALE", "2016-05-10", "STALE"],
    ["어제 기록 + UNKNOWN", "2026-07-26", "UNKNOWN"],
    ["어제 기록 + STALE", "2026-07-26", "STALE"],
  ] as const)(
    "B-2 주입한 현재성이 그대로 유지된다: %s",
    (_label, achievedOn, freshness) => {
      const anchor = toRuntimeAnchor(persisted({ achievedOn }), freshness)
      expect(anchor.freshnessState).toBe(freshness)
      expect(anchor.achievedAt).toBe(achievedOn)
    },
  )

  it("B-2 현재성 확인 없이는 오래된 기록도 최신 기록도 근거 스냅샷을 얻지 못한다", () => {
    const old = persisted({ achievedOn: "2016-05-10" })
    const fresh = persisted({
      id: "fresh-5000",
      achievedOn: "2026-07-26",
      sourceRef: "athlete-record:fresh-5000",
    })

    // 날짜가 어제라도 UNKNOWN이면 근거가 만들어지지 않는다.
    expect(toCurrentSnapshot(fresh, "UNKNOWN", TODAY)).toBeNull()
    expect(toCurrentSnapshot(fresh, "STALE", TODAY)).toBeNull()
    // 날짜가 10년 전이라도 CURRENT를 명시하면 근거가 만들어진다.
    expect(toCurrentSnapshot(old, "CURRENT", TODAY)).not.toBeNull()
  })
})

describe("P1 §7.3-2 오래된 기록을 숨기거나 비활성화하지 않는다", () => {
  // B-3: 계약 §5 첫 문장 — "기록은 날짜 때문에 자동 폐기되지 않는다."
  //      10년 된 기록이 목록에서 사라지면 선수는 자기 PB가 지워졌다고 느낀다.
  it("B-3 10년 전 기록도 목록에 그대로 남는다", () => {
    persisted({ achievedOn: "2016-05-10" })

    expect(loadAthleteRecords(TODAY)).toHaveLength(1)
    expect(loadAthleteRecords(TODAY)[0]?.achievedOn).toBe("2016-05-10")
  })

  // B-4: 화면에서도 마찬가지다. 오래된 기록과 최근 기록을 함께 저장했을 때
  //      둘 다 보이고, 오래된 쪽에도 경과 라벨이 붙는다(숨김이 아니라 표시).
  //      실제 시계로 렌더링되므로 정확한 개월 수가 아니라 "경과가 표시된다"만
  //      확인한다. 날짜가 바뀌면 깨지는 기대값은 두지 않는다.
  it("B-4 화면에 오래된 기록과 최근 기록이 모두 보인다", () => {
    const now = new Date()
    for (const input of [
      { id: "old-5000", achievedOn: "2016-05-10", performanceSeconds: 1110 },
      { id: "recent-5000", achievedOn: "2026-07-20", performanceSeconds: 1140 },
    ]) {
      const created = createSelfReportedAthleteRecord({
        id: input.id,
        purpose: "PERSONAL_BEST",
        eventDistanceM: 5000,
        performanceSeconds: input.performanceSeconds,
        achievedOn: input.achievedOn,
        seasonId: null,
      }, now)
      expect(created).not.toBeNull()
      expect(saveAthleteRecord(created, now).ok).toBe(true)
    }

    render(<AthleteRecords onBack={() => undefined} />)

    const list = screen.getByRole("region", { name: "저장한 경기 기록" })
    expect(list).toHaveTextContent("2016-05-10")
    expect(list).toHaveTextContent("2026-07-20")
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    // 오래된 항목이 흐려지거나 잠기지 않는다.
    expect(list.querySelector("[disabled]")).toBeNull()
    expect(list.querySelector('[aria-disabled="true"]')).toBeNull()
    // 두 항목 모두 경과 라벨을 가진다.
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.textContent ?? "").toMatch(/이번 달|개월 전|년 전|년 \d+개월 전/u)
    }
  })
})

describe("P1 §7.3-3 이 화면은 페이스를 계산하지도 표시하지도 않는다", () => {
  // B-5: 금지어 검색 범위는 §7.3 마지막 문단대로 이 화면 출력으로만 한정한다.
  //      저장소 전체를 뒤져서 다른 화면의 기존 문구를 P1의 실패로 오인하지 않는다.
  //      "18분 30초"는 경기 기록이지 페이스가 아니다. 금지 대상은 km당 환산이다.
  it("B-5 저장·목록 화면 어디에도 km당 페이스 표기가 없다", () => {
    const now = new Date()
    const created = createSelfReportedAthleteRecord({
      id: "pb-5000",
      purpose: "PERSONAL_BEST",
      eventDistanceM: 5000,
      performanceSeconds: 1110,
      achievedOn: "2024-03-10",
      seasonId: null,
    }, now)
    expect(created).not.toBeNull()
    expect(saveAthleteRecord(created, now).ok).toBe(true)

    const { container } = render(<AthleteRecords onBack={() => undefined} />)
    const text = container.textContent ?? ""

    expect(text).toMatch(/5000m/u) // 화면이 실제로 그려졌는지 먼저 확인
    expect(text).not.toMatch(/페이스/u)
    expect(text).not.toMatch(/\/\s*km/iu)
    expect(text).not.toMatch(/킬로/u)
    expect(text).not.toMatch(/분\s*\/\s*㎞/u)
  })
})

describe("P1 §7.3-4 저장 구조에 자유 텍스트가 들어오지 못한다", () => {
  // B-6과 B-7은 겹쳐 보이지만 서로 다른 구멍을 막는다. 결함 주입으로 확인했다:
  //   `.strict()`를 네 곳에서 제거   → B-7만 실패, B-6은 통과
  //   스키마에 note 필드를 추가       → B-6과 B-7(note)만 실패
  // 즉 B-7은 "밖에서 밀어 넣는 값"을, B-6은 "안에서 열어 준 칸"을 잡는다.
  // 한쪽만 남기면 다른 쪽 구멍이 그대로 열린다.

  // B-6: 계약 §4의 키 집합이 전부다. 메모 한 칸이 열리면 증상 문장과 경기
  //      소감이 흘러들어오고, 그 순간 이 저장소는 North Star §3이 서버 전송을
  //      금지한 일지 원문과 같은 성격의 데이터를 갖게 된다.
  it("B-6 저장된 기록의 키는 계약이 정한 것뿐이다", () => {
    persisted()
    const stored = loadAthleteRecords(TODAY)[0]
    expect(stored).toBeDefined()
    expect(Object.keys(stored ?? {}).sort()).toEqual([...CONTRACT_KEYS])
  })

  it.each([
    ["note", "무릎이 아팠다"],
    ["memo", "바람이 심했다"],
    ["comment", "다음엔 더 잘할 수 있다"],
    ["athleteName", "홍길동"],
    ["freshnessState", "CURRENT"],
  ])("B-7 계약에 없는 필드 %s 는 저장이 거부된다", (field, value) => {
    expect(saveAthleteRecord(record({ [field]: value }), TODAY).ok).toBe(false)
    expect(loadAthleteRecords(TODAY)).toEqual([])
  })
})
