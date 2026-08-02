// TCX/GPX 파서 계약 테스트 — 기기 데이터 가져오기 (IMP-2).
//
// 계약:
//  - 파일에 있는 사실만 읽는다. 없는 값은 빈 문자열로 남기고 추정하지 않는다.
//  - 파생은 "거리·시간 둘 다 있을 때의 평균 페이스"만 허용한다.
//  - 파싱 실패는 조용히 삼키지 않고 skipped 개수로 보고한다 (fail-visible).
import { describe, expect, it } from "vitest"
import { parseActivityFile } from "./activity-file"

const TCX_ONE_LAP = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-20T06:12:00.000Z</Id>
      <Lap StartTime="2026-07-20T06:12:00.000Z">
        <TotalTimeSeconds>3000</TotalTimeSeconds>
        <DistanceMeters>10000</DistanceMeters>
      </Lap>
      <Notes>아침 조깅</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

const TCX_TWO_LAPS = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-21T06:00:00.000Z</Id>
      <Lap StartTime="2026-07-21T06:00:00.000Z">
        <TotalTimeSeconds>900</TotalTimeSeconds>
        <DistanceMeters>3000</DistanceMeters>
      </Lap>
      <Lap StartTime="2026-07-21T06:15:00.000Z">
        <TotalTimeSeconds>900</TotalTimeSeconds>
        <DistanceMeters>3000</DistanceMeters>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

const TCX_NO_TIMESTAMP = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Lap>
        <TotalTimeSeconds>1200</TotalTimeSeconds>
        <DistanceMeters>4000</DistanceMeters>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

const TCX_EMPTY_VALUES = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-22T06:00:00.000Z</Id>
      <Lap StartTime="2026-07-22T06:00:00.000Z">
        <TotalTimeSeconds>0</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

const TCX_DISTANCE_ONLY = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-07-23T06:00:00.000Z</Id>
      <Lap StartTime="2026-07-23T06:00:00.000Z">
        <DistanceMeters>5000</DistanceMeters>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`

const GPX_TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>강변 러닝</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="37.500000" lon="127.000000"><time>2026-07-24T06:00:00Z</time></trkpt>
      <trkpt lat="37.509000" lon="127.000000"><time>2026-07-24T06:05:00Z</time></trkpt>
      <trkpt lat="37.518000" lon="127.000000"><time>2026-07-24T06:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

const CSV_ACTIVITIES = `date,name,sport,distanceKm,durationMin
2026-07-25,템포 러닝,running,8,36
2026-07-26,회복 조깅,running,5,`

const JSON_ACTIVITIES = JSON.stringify([
  { date: "2026-07-27", name: "언덕 반복", sport: "running", distanceKm: 6, durationMin: 42 },
  { date: "bad-date", name: "날짜 오류", sport: "running", distanceKm: 5, durationMin: 30 },
])

describe("activity file parser", () => {
  it("TCX 한 랩의 거리·시간을 읽고 평균 페이스를 파생한다", () => {
    const result = parseActivityFile(TCX_ONE_LAP)

    expect(result.format).toBe("tcx")
    expect(result.skipped).toBe(0)
    expect(result.activities).toEqual([{
      date: "2026-07-20",
      name: "아침 조깅",
      sport: "Running",
      distanceKm: "10.00",
      durationMin: "50",
      avgPace: "5:00",
    }])
  })

  it("여러 랩을 하나의 활동으로 합산한다", () => {
    const [activity] = parseActivityFile(TCX_TWO_LAPS).activities

    expect(activity?.distanceKm).toBe("6.00")
    expect(activity?.durationMin).toBe("30")
    expect(activity?.avgPace).toBe("5:00")
  })

  it("날짜를 읽을 수 없는 활동은 날조하지 않고 skipped로 보고한다", () => {
    const result = parseActivityFile(TCX_NO_TIMESTAMP)

    expect(result.activities).toEqual([])
    expect(result.skipped).toBe(1)
  })

  it("거리·시간이 모두 비어 있으면 빈 일지를 만들지 않는다", () => {
    const result = parseActivityFile(TCX_EMPTY_VALUES)

    expect(result.activities).toEqual([])
    expect(result.skipped).toBe(1)
  })

  it("거리만 있으면 시간·페이스를 비워 둔다 — 추정 금지", () => {
    const [activity] = parseActivityFile(TCX_DISTANCE_ONLY).activities

    expect(activity?.distanceKm).toBe("5.00")
    expect(activity?.durationMin).toBe("")
    expect(activity?.avgPace).toBe("")
  })

  it("GPX 트랙 좌표로 거리를, 타임스탬프로 시간을 계산한다", () => {
    const result = parseActivityFile(GPX_TRACK)

    expect(result.format).toBe("gpx")
    expect(result.skipped).toBe(0)
    const [activity] = result.activities
    expect(activity?.date).toBe("2026-07-24")
    expect(activity?.name).toBe("강변 러닝")
    expect(activity?.durationMin).toBe("10")
    // 위도 0.018° ≈ 2.0km — 반올림 오차 범위로만 검증한다
    expect(Number.parseFloat(activity?.distanceKm ?? "0")).toBeCloseTo(2.0, 1)
  })

  it("CSV 활동을 미리보기용 구조화 기록으로 읽는다", () => {
    const result = parseActivityFile(CSV_ACTIVITIES)

    expect(result.format).toBe("csv")
    expect(result.skipped).toBe(0)
    expect(result.activities).toEqual([
      {
        date: "2026-07-25",
        name: "템포 러닝",
        sport: "running",
        distanceKm: "8.00",
        durationMin: "36",
        avgPace: "4:30",
      },
      {
        date: "2026-07-26",
        name: "회복 조깅",
        sport: "running",
        distanceKm: "5.00",
        durationMin: "",
        avgPace: "",
      },
    ])
  })

  it("JSON 활동은 잘못된 행을 제외하고 개수를 알린다", () => {
    const result = parseActivityFile(JSON_ACTIVITIES)

    expect(result.format).toBe("json")
    expect(result.skipped).toBe(1)
    expect(result.activities).toEqual([{
      date: "2026-07-27",
      name: "언덕 반복",
      sport: "running",
      distanceKm: "6.00",
      durationMin: "42",
      avgPace: "7:00",
    }])
  })

  it("형식을 알 수 없거나 깨진 파일은 빈 결과를 돌려준다", () => {
    expect(parseActivityFile("not xml at all").activities).toEqual([])
    expect(parseActivityFile("<html><body>hi</body></html>").format).toBe("unknown")
    expect(parseActivityFile("").activities).toEqual([])
  })
})
