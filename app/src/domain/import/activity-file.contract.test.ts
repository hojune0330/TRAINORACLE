// TCX/GPX 파서 계약 테스트 — 기기 데이터 가져오기 (IMP-2).
//
// 계약:
//  - 파일에 있는 사실만 읽는다. 없는 값은 빈 문자열로 남기고 추정하지 않는다.
//  - 파생은 "거리·시간 둘 다 있을 때의 평균 페이스"만 허용한다.
//  - 파싱 실패는 조용히 삼키지 않고 skipped 개수로 보고한다 (fail-visible).
import { describe, expect, it } from "vitest"
import { parseActivityFile } from "./activity-file"
import { FILE_OBSERVATION_LIMITS, parseFileObservation, toFileObservationSummary } from "./file-observation"

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

const TCX_NEAR_MIDNIGHT_UTC = TCX_ONE_LAP.replaceAll(
  "2026-07-20T06:12:00.000Z",
  "2026-07-20T23:30:00.000Z",
)

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
  it("TCX 한 랩의 거리·시간을 읽고 시간 의미 확인 전 페이스를 보류한다", () => {
    const result = parseActivityFile(TCX_ONE_LAP)

    expect(result.format).toBe("tcx")
    expect(result.skipped).toBe(0)
    expect(result.activities).toMatchObject([{
      date: "2026-07-20",
      name: "가져온 달리기",
      sport: "Running",
      distanceKm: "10",
      durationMin: "50",
      avgPace: "",
    }])
  })

  it("여러 랩을 하나의 활동으로 합산한다", () => {
    const [activity] = parseActivityFile(TCX_TWO_LAPS).activities

    expect(activity?.distanceKm).toBe("6")
    expect(activity?.durationMin).toBe("30")
    expect(activity?.avgPace).toBe("")
  })

  it("UTC 자정 부근 활동을 사용자가 보는 현지 날짜로 저장한다", () => {
    const [activity] = parseActivityFile(TCX_NEAR_MIDNIGHT_UTC, "Asia/Seoul").activities

    expect(activity?.date).toBe("2026-07-21")
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

    expect(activity?.distanceKm).toBe("5")
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
        distanceKm: "8",
        durationMin: "36",
        avgPace: "",
      },
      {
        date: "2026-07-26",
        name: "회복 조깅",
        sport: "running",
        distanceKm: "5",
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
      distanceKm: "6",
      durationMin: "42",
      avgPace: "",
    }])
  })

  it("형식을 알 수 없거나 깨진 파일은 빈 결과를 돌려준다", () => {
    expect(parseActivityFile("not xml at all").activities).toEqual([])
    expect(parseActivityFile("<html><body>hi</body></html>").format).toBe("unknown")
    expect(parseActivityFile("").activities).toEqual([])
  })
})

const gpxPoint = (lat: string, lon: string, time: string | null) => `<trkpt lat="${lat}" lon="${lon}">${time === null ? "" : `<time>${time}</time>`}</trkpt>`
const gpxSegment = (points: string) => `<trkseg>${points}</trkseg>`
const gpx = (segments: string, extra = "") => `<gpx><trk><type>running</type>${extra}${segments}</trk></gpx>`
const parsePreciseGpx = (source: string, zone = "UTC") => parseActivityFile(source, zone, { observations: { gpx: true } })

describe("GPX precise observations", () => {
  it("attaches no observation by default or through another format's switch", () => {
    expect(parseActivityFile(GPX_TRACK).activities[0]?.observation).toBeUndefined()
    expect(parseActivityFile(GPX_TRACK, "UTC", { observations: { csv: true, json: true } }).activities[0]?.observation).toBeUndefined()
    expect(parsePreciseGpx(GPX_TRACK).activities[0]?.observation).toMatchObject({ sourceProfile: "GPX_TRACK_V1", durationMeaning: "ELAPSED", durationSeconds: 600, laps: [], confirmation: null })
  })

  it("does not bridge independent track segments or turn their time gaps into elapsed totals", () => {
    const source = gpx(
      gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00Z") + gpxPoint("0", "0.001", "2026-09-19T00:01:00Z"))
      + gpxSegment(gpxPoint("30", "30", "2026-09-19T01:00:00Z") + gpxPoint("30", "30.001", "2026-09-19T01:01:00Z")),
    )
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation?.distanceMeters).toBeGreaterThan(200)
    expect(result.activities[0]?.observation?.distanceMeters).toBeLessThan(210)
    expect(result.activities[0]?.observation?.durationSeconds).toBeNull()
    expect(result.activities[0]?.avgPace).toBe("")
    expect(result.issues).toContainEqual({ code: "TIME_GAP", activityIndex: 0, count: 1 })
  })

  it("allows contiguous segment timestamps without joining their coordinates", () => {
    const source = gpx(
      gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00Z") + gpxPoint("0", "0.001", "2026-09-19T00:01:00Z"))
      + gpxSegment(gpxPoint("30", "30", "2026-09-19T00:01:00Z") + gpxPoint("30", "30.001", "2026-09-19T00:02:00Z")),
    )
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation?.durationSeconds).toBe(120)
    expect(result.activities[0]?.observation?.distanceMeters).toBeLessThan(210)
    expect(result.issues).toBeUndefined()
  })

  it.each(["bad", "37m", "NaN", "Infinity", "91", "-91", "1e-999"])("invalid coordinate %s breaks distance coverage without destroying valid elapsed time", bad => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00Z")
      + gpxPoint(bad, "0.001", "2026-09-19T00:01:00Z") + gpxPoint("0", "0.002", "2026-09-19T00:02:00Z")))
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 120, durationMeaning: "ELAPSED" })
    expect(result.activities[0]?.distanceKm).toBe("")
    expect(result.issues).toContainEqual({ code: "INVALID_COORDINATE", activityIndex: 0, count: 1 })
  })

  it("accepts signed coordinates but rejects longitude outside its declared range", () => {
    const source = gpx(gpxSegment(gpxPoint("-30", "-120", "2026-09-19T00:00:00Z") + gpxPoint("-30.01", "-120", "2026-09-19T00:01:00Z")))
    expect(parsePreciseGpx(source).activities[0]?.observation?.distanceMeters).toBeGreaterThan(1000)
    expect(parsePreciseGpx(source.replaceAll('-120', '181')).activities[0]?.observation?.distanceMeters).toBeNull()
  })

  it.each([null, "private-sentinel", "2026-09-19T00:01:00", "2026-02-30T00:01:00Z"])("time gap %s restricts elapsed only, never bridging a missing instant", time => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00Z")
      + gpxPoint("0", "0.001", time) + gpxPoint("0", "0.002", "2026-09-19T00:02:00Z")))
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation?.distanceMeters).toBeGreaterThan(220)
    expect(result.activities[0]?.observation?.durationSeconds).toBeNull()
    expect(result.activities[0]?.avgPace).toBe("")
    expect(JSON.stringify(result)).not.toContain("private-sentinel")
  })

  it("rejects reversed timestamps rather than clamping them to zero", () => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:02:00Z") + gpxPoint("0", "0.001", "2026-09-19T00:01:00Z")))
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation?.durationSeconds).toBeNull()
    expect(result.issues).toContainEqual({ code: "NON_MONOTONIC_TIME", activityIndex: 0, count: 1 })
  })

  it("preserves fractional seconds finer than Date.parse milliseconds", () => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00.1234Z") + gpxPoint("0", "0.001", "2026-09-19T00:00:01.9876Z")))
    const observation = parsePreciseGpx(source).activities[0]?.observation
    expect(observation?.durationSeconds).toBeCloseTo(1.8642, 12)
    expect(observation?.startedAt).toBe("2026-09-19T00:00:00.1234Z")
    expect(parseFileObservation(observation)).not.toBeNull()
  })

  it("preserves local dates with no invented offset, while explicit zones reproject offset dates", () => {
    const local = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00") + gpxPoint("0", "0.001", "2026-09-19T00:01:00")))
    expect(parsePreciseGpx(local, "America/New_York").activities[0]?.observation).toMatchObject({ date: "2026-09-19", startedAt: null, timeZone: null, durationSeconds: null })
    const offset = local.replaceAll("2026-09-19T00:00:00", "2026-09-18T23:30:00Z").replaceAll("2026-09-19T00:01:00", "2026-09-18T23:31:00Z")
    expect(parsePreciseGpx(offset, "UTC").activities[0]?.date).toBe("2026-09-18")
    expect(parsePreciseGpx(offset, "Asia/Seoul").activities[0]?.date).toBe("2026-09-19")
  })

  it("never replaces an absent starting timestamp with a later point's instant", () => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", null) + gpxPoint("0", "0.001", "2026-09-19T00:01:00Z")))
    expect(parsePreciseGpx(source).activities[0]?.observation).toMatchObject({ startedAt: null, durationSeconds: null })
    expect(parsePreciseGpx(source).issues).toContainEqual({ code: "MISSING_TIMESTAMP", activityIndex: 0, count: 1 })
    expect(parsePreciseGpx(source.replace("<time>2026-09-19T00:01:00Z</time>", "")).skipped).toBe(1)
  })

  it("does not persist raw tracks, titles, notes or arbitrary track numbers as identities", () => {
    const source = gpx(gpxSegment(gpxPoint("37.123456789", "127", "2026-09-19T00:00:00Z") + gpxPoint("37.124456789", "127", "2026-09-19T00:01:00Z")))
    const clean = parsePreciseGpx(source).activities[0]?.observation
    const decorated = parsePreciseGpx(source.replace("<trk>", '<trk><name>private-sentinel</name><desc>private-sentinel</desc><number>99</number><extensions><confirmation>MOVING</confirmation></extensions>')).activities[0]!
    expect(decorated.observation).toEqual(clean)
    expect(decorated.observation).toMatchObject({ sourceActivityId: null, laps: [], confirmation: null })
    expect(JSON.stringify(decorated)).not.toContain("private-sentinel")
    expect(JSON.stringify(decorated.observation)).not.toContain("37.123456789")
  })

  it("supports standard prefixed GPX namespaces without promoting foreign tags", () => {
    const source = GPX_TRACK.replace(/<(\/?)([A-Za-z]+)/gu, "<$1g:$2").replace('<g:gpx version="1.1">', '<g:gpx version="1.1" xmlns:g="http://www.topografix.com/GPX/1/1">')
    expect(parsePreciseGpx(source).activities[0]?.observation?.durationSeconds).toBe(600)
    expect(parsePreciseGpx(source.replaceAll("<g:time>", '<x:time xmlns:x="urn:foreign">').replaceAll("</g:time>", "</x:time>")).activities).toEqual([])
  })

  it("accepts exactly 100000 GPX points and aggregates missing-time diagnostics", () => {
    const source = gpx(gpxSegment(gpxPoint("0", "0", "2026-09-19T00:00:00Z") + '<trkpt lat="0" lon="0"/>'.repeat(99999)))
    const result = parsePreciseGpx(source)
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: 0, durationSeconds: null })
    expect(result.issues).toContainEqual({ code: "MISSING_TIMESTAMP", activityIndex: 0, count: 99999 })
  }, 20000)
})

const tcx = (activities: string) => `<TrainingCenterDatabase><Activities>${activities}</Activities></TrainingCenterDatabase>`
const row = (laps: string, id = "2026-09-19T07:00:00+09:00", sport = "Running") =>
  `<Activity Sport="${sport}">${id === "" ? "" : `<Id>${id}</Id>`}${laps}</Activity>`
const lap = (distance: string | null = "5000.125", duration: string | null = "1500.75", extra = "") =>
  `<Lap StartTime="2026-09-19T07:00:00+09:00">${distance === null ? "" : `<DistanceMeters>${distance}</DistanceMeters>`}${duration === null ? "" : `<TotalTimeSeconds>${duration}</TotalTimeSeconds>`}${extra}</Lap>`

describe("TCX precise observations and safe diagnostics", () => {
  it("preserves seconds, meters, lap order and source semantics in a synchronous observation", () => {
    const result = parseActivityFile(tcx(row(lap() + lap("0", "12.25", "<Intensity>Rest</Intensity>"))), "Asia/Seoul")
    expect(result).not.toBeInstanceOf(Promise)
    const activity = result.activities[0]!
    const observation = activity.observation!
    expect(observation).toMatchObject({
      schemaVersion: 1, source: "FILE_UPLOAD", format: "tcx", sourceProfile: "TCX_ACTIVITY_V1",
      sourceActivityId: "2026-09-19T07:00:00+09:00", date: "2026-09-19",
      startedAt: "2026-09-19T07:00:00+09:00", timeZone: "Asia/Seoul", sport: "RUNNING",
      distanceMeters: 5000.125, durationSeconds: 1513, durationMeaning: "SOURCE_DEFINED", confirmation: null,
      laps: [
        { sourceIndex: 0, distanceMeters: 5000.125, durationSeconds: 1500.75, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" },
        { sourceIndex: 1, distanceMeters: 0, durationSeconds: 12.25, durationMeaning: "SOURCE_DEFINED", kind: "RECOVERY" },
      ],
      completeness: { missingDistanceLaps: 0, missingDurationLaps: 0 },
    })
    expect(parseFileObservation(observation)).toEqual(observation)
    expect(activity).toMatchObject(toFileObservationSummary(observation))
    expect(activity.distanceKm).toBe("5.000125")
    expect(result.issues).toBeUndefined()
  })

  it.each(["5 miles", "12abc", "1:30", "-1", "-0", "NaN", "Infinity", "0x12", "1,000", "1e999", "1e-999"])("rejects a whole invalid number %s without sacrificing independent facts", bad => {
    const result = parseActivityFile(tcx(row(lap(bad, "60")) + row(lap("1000", "300"))), "Asia/Seoul")
    expect(result.skipped).toBe(0)
    expect(result.activities).toHaveLength(2)
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 60, completeness: { missingDistanceLaps: 1, missingDurationLaps: 0 } })
    expect(result.activities[0]?.distanceKm).toBe("")
    expect(result.issues).toEqual([{ code: "INVALID_DISTANCE", activityIndex: 0, count: 1 }])
  })

  it("reports invalid duration separately from absent duration and row exclusion", () => {
    const result = parseActivityFile(tcx(row(lap("10", "12abc") + lap("20", null) + lap("30", "-1")) + row(lap("invalid", "invalid"))), "Asia/Seoul")
    expect(result.skipped).toBe(1)
    expect(result.activities).toHaveLength(1)
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: 60, durationSeconds: null, completeness: { missingDistanceLaps: 0, missingDurationLaps: 3 } })
    expect(result.issues).toEqual(expect.arrayContaining([
      { code: "INVALID_DURATION", activityIndex: 0, count: 2 },
      { code: "MISSING_DURATION", activityIndex: 0, count: 1 },
      { code: "NO_MEASUREMENTS", activityIndex: 1, count: 1 },
    ]))
  })

  it("never presents a partial lap sum as an activity total", () => {
    const result = parseActivityFile(tcx(row(lap("400", null) + lap(null, "120"))), "Asia/Seoul")
    expect(result.activities[0]).toMatchObject({ distanceKm: "", durationMin: "", avgPace: "", observation: {
      distanceMeters: null, durationSeconds: null,
      completeness: { missingDistanceLaps: 1, missingDurationLaps: 1 },
    } })
    expect(result.skipped).toBe(0)
  })

  it("does not substitute nested point distances or extension fields for missing lap totals", () => {
    const extra = '<Track><Trackpoint><DistanceMeters>9999</DistanceMeters></Trackpoint></Track><Extensions><TotalTimeSeconds>999</TotalTimeSeconds></Extensions>'
    const result = parseActivityFile(tcx(row(lap(null, "10", extra))), "Asia/Seoul")
    expect(result.activities[0]?.observation?.distanceMeters).toBeNull()
    const duplicate = parseActivityFile(tcx(row(lap("10", "30", "<DistanceMeters>20</DistanceMeters>"))), "Asia/Seoul")
    expect(duplicate.activities[0]?.observation?.distanceMeters).toBeNull()
    expect(duplicate.issues).toContainEqual({ code: "INVALID_DISTANCE", activityIndex: 0, count: 1 })
  })

  it("supports prefixed TCX namespaces and ignores foreign namespace lookalikes", () => {
    const source = tcx(row(lap("1000", "300")))
      .replace(/<(\/?)([A-Za-z]+)/gu, "<$1tcx:$2")
      .replace("<tcx:TrainingCenterDatabase>", '<tcx:TrainingCenterDatabase xmlns:tcx="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">')
    const result = parseActivityFile(source, "Asia/Seoul")
    expect(result.activities[0]?.observation?.distanceMeters).toBe(1000)
    const foreign = tcx(row(lap(null, "300", '<foreign:DistanceMeters xmlns:foreign="urn:other">1000</foreign:DistanceMeters>')))
    expect(parseActivityFile(foreign).activities[0]?.observation?.distanceMeters).toBeNull()
  })

  it("keeps notes, names, coordinates and free-form IDs out of observations and diagnostics", () => {
    const privateExtra = '<Notes>private-sentinel</Notes><Name>private-sentinel</Name><Track><Trackpoint><Position><LatitudeDegrees>37.123456789</LatitudeDegrees></Position></Trackpoint></Track>'
    const plain = parseActivityFile(tcx(row(lap())), "Asia/Seoul").activities[0]!
    const decorated = parseActivityFile(tcx(row(lap() + privateExtra)), "Asia/Seoul").activities[0]!
    expect(decorated).toEqual(plain)
    const badId = parseActivityFile(tcx(row(lap(), "private sentinel notes")), "Asia/Seoul")
    expect(badId.activities[0]?.observation?.sourceActivityId).toBeNull()
    expect(JSON.stringify(badId)).not.toContain("private sentinel")
    expect(JSON.stringify(decorated)).not.toContain("37.123456789")
  })

  it("preserves local dates and reports timezone ambiguity without creating an instant", () => {
    for (const id of ["2026-09-19", "2026-09-19T00:15:00", "2026-09-19T00:15:00-00:00"]) {
      for (const zone of ["UTC", "America/New_York", "Asia/Seoul"]) {
        const result = parseActivityFile(tcx(row(lap(), id)), zone)
        expect(result.activities[0]?.observation).toMatchObject({ date: "2026-09-19", startedAt: null, timeZone: null })
        expect(result.issues).toContainEqual({ code: "TIMEZONE_REQUIRED", activityIndex: 0, count: 1 })
      }
    }
  })

  it("uses an explicit timezone for offset timestamps and reports invalid timezone separately", () => {
    const source = tcx(row(lap(), "2026-09-18T23:30:00Z"))
    expect(parseActivityFile(source, "Asia/Seoul").activities[0]?.date).toBe("2026-09-19")
    expect(parseActivityFile(source, "UTC").activities[0]?.date).toBe("2026-09-18")
    const result = parseActivityFile(source, "invalid/private-sentinel")
    expect(result.activities[0]?.observation).toMatchObject({ date: "2026-09-18", startedAt: "2026-09-18T23:30:00Z", timeZone: null })
    expect(result.issues).toContainEqual({ code: "INVALID_TIMEZONE", activityIndex: 0, count: 1 })
    expect(JSON.stringify(result)).not.toContain("private-sentinel")
  })

  it.each(["2026-02-30T07:00:00Z", "2026-09-19T25:00:00Z", "2026-09-19T07:00:00+99:00", "09/19/2026"])("rejects invalid date %s without JS rollover", date => {
    const source = tcx(row(lap().replace('StartTime="2026-09-19T07:00:00+09:00"', `StartTime="${date}"`), date))
    expect(parseActivityFile(source).skipped).toBe(1)
    expect(parseActivityFile(source).issues).toContainEqual({ code: "INVALID_DATE", activityIndex: 0, count: 1 })
  })

  it("never merges duplicate candidates or uses the outer row order as identity", () => {
    const a = row(lap("5", "60"))
    const b = row(lap("6", "60"), "2026-09-19T08:00:00+09:00")
    const one = parseActivityFile(tcx(a + b + a), "Asia/Seoul")
    const two = parseActivityFile(tcx(b + a), "Asia/Seoul")
    expect(one.activities).toHaveLength(3)
    expect(one.activities[0]?.observation).toEqual(one.activities[2]?.observation)
    expect(one.activities[0]?.observation).toEqual(two.activities[1]?.observation)
    expect(parseActivityFile(tcx(row(lap("5.00", "60.0"))), "Asia/Seoul").activities[0]?.observation).toEqual(one.activities[0]?.observation)
    const corrected = parseActivityFile(tcx(row(lap("7", "60"))), "Asia/Seoul").activities[0]?.observation
    expect(corrected?.sourceObservationKey).toBe(one.activities[0]?.observation?.sourceObservationKey)
    expect(corrected?.contentRevisionFingerprint).not.toBe(one.activities[0]?.observation?.contentRevisionFingerprint)
  })

  it("retains no-ID candidates and only maps explicit sport and lap kind", () => {
    const result = parseActivityFile(tcx(row(lap("100", "30", "<Intensity>Active</Intensity>") + lap("50", "30"), "", "Mystery")), "Asia/Seoul")
    expect(result.activities[0]?.observation).toMatchObject({ sourceActivityId: null, sport: "UNKNOWN", laps: [{ kind: "WORK" }, { kind: "UNKNOWN" }] })
    expect(JSON.stringify(result)).not.toContain("BASE")
  })

  it("preserves safe numeric source IDs as strings without using them as dates", () => {
    const sourceActivityId = "9007199254740993123456789"
    const result = parseActivityFile(tcx(row(lap(), sourceActivityId)), "Asia/Seoul")
    expect(result.activities[0]?.observation).toMatchObject({ sourceActivityId, date: "2026-09-19", startedAt: "2026-09-19T07:00:00+09:00" })
    expect(result.issues).toBeUndefined()
  })

  it("reports overflowing all-lap totals without exposing Infinity or a partial sum", () => {
    const result = parseActivityFile(tcx(row(lap("1e308", "60") + lap("1e308", "60"))), "Asia/Seoul")
    expect(result.activities[0]?.observation).toMatchObject({ distanceMeters: null, durationSeconds: 120, completeness: { missingDistanceLaps: 0, missingDurationLaps: 0 } })
    expect(result.issues).toContainEqual({ code: "INVALID_DISTANCE_TOTAL", activityIndex: 0, count: 1 })
    expect(parseFileObservation(result.activities[0]?.observation)).not.toBeNull()
  })

  it("rejects XML entity declarations, broken XML and unsupported roots with fixed codes", () => {
    for (const source of ['<!DOCTYPE TrainingCenterDatabase [<!ENTITY secret "private-sentinel">]>' + tcx(row(lap())), "<TrainingCenterDatabase>"]) {
      expect(parseActivityFile(source).issues).toEqual([{ code: "INVALID_FILE", activityIndex: null, count: 1 }])
    }
    expect(parseActivityFile("<unrecognized/>").issues?.[0]?.code).toBe("UNSUPPORTED_FORMAT")
    expect(parseActivityFile(tcx("")).issues?.[0]?.code).toBe("NO_MEASUREMENTS")
  })

  it("handles short ISO years and rejects an out-of-schema timezone year without throwing", () => {
    expect(parseActivityFile(tcx(row(lap(), "0099-09-19T07:00:00Z")), "UTC").activities[0]?.date).toBe("0099-09-19")
    const result = parseActivityFile(tcx(row(lap(), "9999-12-31T23:30:00Z")), "Asia/Seoul")
    expect(result.activities).toEqual([])
    expect(result.issues?.[0]?.code).toBe("INVALID_DATE")
  })
})

describe("activity parser resource budgets", () => {
  it("measures the 10 MiB limit in UTF-8 bytes and allows the exact boundary", () => {
    const source = tcx(row(lap("5", "60")))
    const boundary = source + " ".repeat(FILE_OBSERVATION_LIMITS.bytes - source.length)
    expect(parseActivityFile(boundary, "Asia/Seoul").activities).toHaveLength(1)
    expect(parseActivityFile(boundary + " ").issues?.[0]?.code).toBe("FILE_TOO_LARGE")
    expect(parseActivityFile("\uAC00".repeat(Math.floor(FILE_OBSERVATION_LIMITS.bytes / 3) + 1)).issues?.[0]?.code).toBe("FILE_TOO_LARGE")
  })

  it("accepts 1000 TCX activities and rejects 1001 before processing rows", () => {
    const activity = row(lap("5", "60"))
    expect(parseActivityFile(tcx(activity.repeat(1000)), "Asia/Seoul").activities).toHaveLength(1000)
    const result = parseActivityFile(tcx(activity.repeat(1001)), "Asia/Seoul")
    expect(result.activities).toEqual([])
    expect(result.skipped).toBe(1001)
    expect(result.issues).toEqual([{ code: "ACTIVITY_LIMIT_EXCEEDED", activityIndex: null, count: 1 }])
  })

  it("rejects only a TCX row over 1000 laps and preserves the following valid row", () => {
    const oneLap = lap("5", "60")
    expect(parseActivityFile(tcx(row(oneLap.repeat(1000))), "Asia/Seoul").activities[0]?.observation?.laps).toHaveLength(1000)
    const result = parseActivityFile(tcx(row(oneLap.repeat(1001)) + row(oneLap)), "Asia/Seoul")
    expect(result.activities).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(result.issues).toEqual([{ code: "LAP_LIMIT_EXCEEDED", activityIndex: 0, count: 1 }])
  })

  it("counts TCX points across the entire file before extracting observations", () => {
    const track = `<Track>${"<Trackpoint/>".repeat(50001)}</Track>`
    const result = parseActivityFile(tcx(row(lap("5", "60", track)) + row(lap("5", "60", track))), "Asia/Seoul")
    expect(result.activities).toEqual([])
    expect(result.skipped).toBe(2)
    expect(result.issues).toEqual([{ code: "POINT_LIMIT_EXCEEDED", activityIndex: null, count: 1 }])
    const atLimit = `<Track>${"<Trackpoint/>".repeat(100000)}</Track>`
    expect(parseActivityFile(tcx(row(lap("5", "60", atLimit))), "Asia/Seoul").activities).toHaveLength(1)
  }, 15000)

  it("keeps legacy CSV/JSON/GPX parsing while bounding activities before row work", () => {
    const entry = { date: "2026-09-19", distanceKm: 5 }
    expect(parseActivityFile(JSON.stringify(Array(1001).fill(entry))).issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
    expect(parseActivityFile(JSON.stringify({ activities: Array(1001).fill(entry) })).issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
    const csv = 'date,name,distanceKm\r\n' + '2026-09-19,"line1\nline2",5\r\n'.repeat(1000)
    expect(parseActivityFile(csv).activities).toHaveLength(1000)
    expect(parseActivityFile(csv + "2026-09-19,last,5").issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
    expect(parseActivityFile(`<gpx>${"<trk/>".repeat(1001)}</gpx>`).issues?.[0]?.code).toBe("ACTIVITY_LIMIT_EXCEEDED")
    expect(parseActivityFile(GPX_TRACK).activities[0]?.observation).toBeUndefined()
    expect(parseActivityFile(CSV_ACTIVITIES).activities[0]?.observation).toBeUndefined()
  })

  it("rejects excessive GPX points before distance iteration", () => {
    const result = parseActivityFile(`<gpx><trk><trkseg>${"<trkpt/>".repeat(100001)}</trkseg></trk></gpx>`)
    expect(result.activities).toEqual([])
    expect(result.issues?.[0]?.code).toBe("POINT_LIMIT_EXCEEDED")
  }, 15000)
})
