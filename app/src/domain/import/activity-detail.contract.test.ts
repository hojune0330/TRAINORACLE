import { describe, expect, it } from "vitest"
import { Encoder, Profile } from "@garmin/fitsdk"
import type { FileIdMesg, RecordMesg, EventMesg, LapMesg, SessionMesg } from "@garmin/fitsdk"
import { parseActivityFile, parseActivityFileBytes } from "./activity-file"
import { activityDetailSeries, activityFileDetailSchema } from "./file-activity-detail"
import { buildFileObservation, parseFileObservation } from "./file-observation"
import { evaluateProviderDataUse } from "../provider-data-rights"

const tcx = (points: string, creator = "Garmin Forerunner") => `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ae="http://www.garmin.com/xmlschemas/ActivityExtension/v2" xmlns:evil="urn:untrusted"><Activities><Activity Sport="Running"><Id>2026-11-01T08:00:00Z</Id><Creator><Name>${creator}</Name><UnitId>NEVER-KEEP-SERIAL</UnitId></Creator><Lap StartTime="2026-11-01T08:00:00Z"><TotalTimeSeconds>120</TotalTimeSeconds><DistanceMeters>400</DistanceMeters><AverageHeartRateBpm><Value>145</Value></AverageHeartRateBpm><TriggerMethod>Manual</TriggerMethod><Track>${points}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`
const point = `<Trackpoint><Time>2026-11-01T08:00:00Z</Time><Position><LatitudeDegrees>37</LatitudeDegrees><LongitudeDegrees>127</LongitudeDegrees></Position><AltitudeMeters>-4.25</AltitudeMeters><HeartRateBpm><Value>140</Value></HeartRateBpm><Cadence>88</Cadence><Extensions><ae:TPX><ae:Speed>3.125</ae:Speed><ae:RunCadence>89</ae:RunCadence><ae:Watts>240</ae:Watts></ae:TPX></Extensions></Trackpoint>`

function syntheticFit() {
  const encoder = new Encoder()
  // The SDK base Mesg intentionally has no field index signature; validate against its concrete messages.
  const write = (number: number, message: FileIdMesg | RecordMesg | EventMesg | LapMesg | SessionMesg) => encoder.onMesg(number, message)
  const start = new Date("2026-11-01T08:00:00Z")
  write(Profile.MesgNum.FILE_ID!, { type: "activity", manufacturer: "garmin", product: 1, serialNumber: 9999, timeCreated: start })
  write(Profile.MesgNum.RECORD!, { timestamp: start, distance: 0, heartRate: 140, cadence: 88, power: 240, altitude: -4.2,
    positionLat: Math.round(37 * 2147483648 / 180), positionLong: Math.round(127 * 2147483648 / 180), verticalOscillation: 70.5, stanceTime: 245, stepLength: 1100 })
  write(Profile.MesgNum.EVENT!, { timestamp: new Date("2026-11-01T08:01:00Z"), event: "timer", eventType: "stopAll" })
  write(Profile.MesgNum.EVENT!, { timestamp: new Date("2026-11-01T08:01:30Z"), event: "timer", eventType: "start" })
  write(Profile.MesgNum.RECORD!, { timestamp: new Date("2026-11-01T08:02:30Z"), distance: 400, heartRate: 150, enhancedSpeed: 3.25 })
  write(Profile.MesgNum.LAP!, { messageIndex: 0, startTime: start, timestamp: new Date("2026-11-01T08:02:30Z"), totalDistance: 400, totalTimerTime: 120, totalElapsedTime: 150, lapTrigger: "manual", avgHeartRate: 145 })
  write(Profile.MesgNum.SESSION!, { messageIndex: 0, startTime: start, timestamp: new Date("2026-11-01T08:02:30Z"), sport: "running", totalDistance: 400,
    totalTimerTime: 120, totalElapsedTime: 150, firstLapIndex: 0, numLaps: 1, avgHeartRate: 145, maxHeartRate: 150 })
  return encoder.close()
}

describe("versioned source file detail preservation", () => {
  it("preserves actual TCX sensor units, position and explicit lap start, without inventing end or time meaning", () => {
    const observation = parseActivityFile(tcx(point), "UTC").activities[0]!.observation!
    expect(observation.detail!.samples[0]).toMatchObject({ timestamp: "2026-11-01T08:00:00Z", lapIndex: 0,
      metrics: { heartRateBpm: 140, cadenceRpm: 88, runCadence: 89, powerWatts: 240, speedMetersPerSecond: 3.125, altitudeMeters: -4.25 },
      position: { latitudeDegrees: 37, longitudeDegrees: 127 } })
    expect(observation.detail!.laps[0]).toMatchObject({ startTime: "2026-11-01T08:00:00Z", endTime: null, trigger: "Manual" })
    expect(observation.durationMeaning).toBe("SOURCE_DEFINED")
    expect(parseActivityFile(tcx(point)).activities[0]!.avgPace).toBe("")
    expect(JSON.stringify(observation)).not.toContain("NEVER-KEEP-SERIAL")
    expect(parseFileObservation(JSON.parse(JSON.stringify(observation)))).toEqual(observation)
    expect(evaluateProviderDataUse({ lineage: observation.dataLineage, requestedFields: ["distanceMeters"], purpose: "SELF_HOSTED_INFERENCE",
      hosting: "COMPANY_SELF_HOSTED", consentActive: true, grants: [], now: "2026-11-04T00:00:00Z" }).allowed).toBe(false)
  })

  it("retains source order and unresolved local time; missing/invalid sensor values are gaps, never zero", () => {
    const second = `<Trackpoint><Time>2026-11-01T08:00:10</Time><HeartRateBpm><Value>bad</Value></HeartRateBpm></Trackpoint>`
    const detail = parseActivityFile(tcx(point + second + "<Trackpoint/>"), "UTC").activities[0]!.observation!.detail!
    expect(detail.samples[1]).toMatchObject({ sourceIndex: 1, timestamp: null, localTimestamp: "2026-11-01T08:00:10", metrics: { heartRateBpm: null }, position: null })
    expect(activityDetailSeries(detail).find(series => series.metric === "heartRateBpm")!.samples.map(sample => sample.value)).toEqual([140, null, null])
    expect(detail.samples).toHaveLength(3)
  })

  it("ignores foreign XML lookalikes and rejects duplicate legitimate extension fields", () => {
    const payload = `<Trackpoint><Time>2026-11-01T08:00:00Z</Time><evil:HeartRateBpm><evil:Value>999</evil:Value></evil:HeartRateBpm><Extensions><evil:TPX><evil:Watts>999</evil:Watts></evil:TPX><ae:TPX><ae:Watts>200</ae:Watts><ae:Watts>300</ae:Watts></ae:TPX></Extensions></Trackpoint>`
    const result = parseActivityFile(tcx(payload), "UTC")
    expect(result.activities[0]!.observation!.detail!.samples[0]!.metrics).toEqual({ powerWatts: null })
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "AMBIGUOUS_SENSOR_FIELD" })]))
  })

  it("uses declarations only for origin, keeps provider/device identities separate and detects detail mutation", () => {
    const garmin = parseActivityFile(tcx(point), "UTC").activities[0]!.observation!
    const coros = parseActivityFile(tcx(point, "COROS PACE"), "UTC").activities[0]!.observation!
    const unknown = parseActivityFile(tcx(point, "Unidentified"), "UTC").activities[0]!.observation!
    expect(garmin.detail!.source.originProvider).toBe("GARMIN")
    expect(coros.detail!.source.originProvider).toBe("COROS")
    expect(unknown.detail!.source.originProvider).toBe("UNKNOWN")
    expect(garmin.sourceObservationKey).not.toBe(coros.sourceObservationKey)
    const corrupted = structuredClone(garmin)
    corrupted.detail!.samples[0]!.metrics.heartRateBpm = 199
    expect(parseFileObservation(corrupted)).toBeNull()
    expect(activityFileDetailSchema.safeParse({ ...garmin.detail, schemaVersion: 2 }).success).toBe(false)
    const { detail: _detail, schemaVersion: _version, source: _source, sourceObservationKey: _key,
      contentRevisionFingerprint: _revision, completeness: _complete, ...legacy } = garmin
    const rebuilt = buildFileObservation(legacy)
    expect(rebuilt.detail).toBeUndefined()
    expect(parseFileObservation(rebuilt)).toEqual(rebuilt)
  })

  it("keeps GPX track segment breaks, raw GPS and allowlisted HR/cadence/temperature", () => {
    const xml = `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:t="http://www.garmin.com/xmlschemas/TrackPointExtension/v1" creator="COROS"><trk><type>running</type><trkseg><trkpt lat="37" lon="127"><time>2026-11-01T08:00:00Z</time><ele>-4</ele><extensions><t:TrackPointExtension><t:hr>144</t:hr><t:cad>90</t:cad><t:atemp>-3</t:atemp></t:TrackPointExtension></extensions></trkpt></trkseg><trkseg><trkpt lat="37.1" lon="127.1"><time>2026-11-01T08:05:00Z</time></trkpt></trkseg></trk></gpx>`
    const observation = parseActivityFile(xml, "UTC", { observations: { gpx: true } }).activities[0]!.observation!
    expect(observation.detail!.samples.map(sample => sample.segmentIndex)).toEqual([0, 1])
    expect(observation.detail!.samples[0]!.metrics).toEqual({ altitudeMeters: -4, heartRateBpm: 144, cadenceRpm: 90, temperatureCelsius: -3 })
    expect(observation.distanceMeters).toBeNull()
    expect(observation.durationSeconds).toBeNull()
  })
})

describe("official FIT decoding boundary", () => {
  it("decodes CRC-valid synthetic activity preserving timer/elapsed, source metrics, lap bounds and actual timer gaps", () => {
    const result = parseActivityFileBytes(syntheticFit(), "UTC")
    expect(result.issues).toBeUndefined()
    expect(result.format).toBe("fit")
    expect(result.activities).toHaveLength(1)
    const observation = result.activities[0]!.observation!
    expect(observation).toMatchObject({ format: "fit", distanceMeters: 400, durationSeconds: 120, durationMeaning: "TIMER" })
    expect(observation.detail!.summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "elapsedSeconds", value: 150 }), expect.objectContaining({ metric: "timerSeconds", value: 120 }),
    ]))
    expect(observation.detail!.samples[0]!.metrics).toMatchObject({ heartRateBpm: 140, cadenceRpm: 88, powerWatts: 240, verticalOscillationMillimeters: 70.5, groundContactTimeMilliseconds: 245, stepLengthMillimeters: 1100 })
    expect(observation.detail!.samples[0]!.position!.latitudeDegrees).toBeCloseTo(37, 5)
    expect(observation.detail!.samples.map(sample => sample.segmentIndex)).toEqual([0, 1])
    expect(observation.detail!.laps[0]).toMatchObject({ startTime: "2026-11-01T08:00:00.000Z", endTime: "2026-11-01T08:02:30.000Z" })
    expect(JSON.stringify(observation)).not.toContain("serialNumber")
    expect(parseFileObservation(JSON.parse(JSON.stringify(observation)))).toEqual(observation)
  })
  it("rejects corrupted/truncated FIT before retaining any partial activity", () => {
    const bytes = syntheticFit()
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1
    expect(parseActivityFileBytes(bytes, "UTC")).toMatchObject({ activities: [], format: "fit", issues: [{ code: "INVALID_FILE" }] })
    expect(parseActivityFileBytes(bytes.slice(0, 30), "UTC").activities).toEqual([])
  })
  it("routes UTF8 XML bytes through the same canonical parser", () => {
    expect(parseActivityFileBytes(new TextEncoder().encode(tcx(point)), "UTC")).toEqual(parseActivityFile(tcx(point), "UTC"))
  })
})
