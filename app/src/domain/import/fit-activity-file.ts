import { Decoder, Stream, Profile } from "@garmin/fitsdk"
import type { ActivityParseIssue, ActivityParseIssueCode, ActivityParseResult, ImportedActivity } from "./activity-file"
import { buildFileObservation, FILE_OBSERVATION_LIMITS, toFileObservationSummary } from "./file-observation"
import type { FileObservationV1 } from "./file-observation"
import type { ActivityDetailMetric, ActivityDetailSample, ActivityDetailSummary, ActivityFileDetailV1 } from "./file-activity-detail"
import { declaredFileSource } from "./xml-activity-detail"

type Message = Record<string, unknown>
const RECORD_METRICS: ReadonlyArray<readonly [string, ActivityDetailMetric]> = [
  ["distance", "distanceMeters"], ["heartRate", "heartRateBpm"], ["cadence", "cadenceRpm"],
  ["fractionalCadence", "fractionalCadenceRpm"], ["power", "powerWatts"], ["altitude", "altitudeMeters"],
  ["enhancedAltitude", "enhancedAltitudeMeters"], ["speed", "speedMetersPerSecond"], ["enhancedSpeed", "enhancedSpeedMetersPerSecond"],
  ["temperature", "temperatureCelsius"], ["verticalOscillation", "verticalOscillationMillimeters"],
  ["verticalRatio", "verticalRatioPercent"], ["stanceTime", "groundContactTimeMilliseconds"],
  ["stanceTimeBalance", "groundContactBalancePercent"], ["stepLength", "stepLengthMillimeters"],
]
const SUMMARY_METRICS: ReadonlyArray<readonly [string, ActivityDetailMetric, ActivityDetailSummary[number]["statistic"]]> = [
  ["totalDistance", "distanceMeters", "TOTAL"], ["totalElapsedTime", "elapsedSeconds", "TOTAL"],
  ["totalTimerTime", "timerSeconds", "TOTAL"], ["totalMovingTime", "movingSeconds", "TOTAL"],
  ["totalCalories", "caloriesKcal", "TOTAL"], ["totalAscent", "ascentMeters", "TOTAL"], ["totalDescent", "descentMeters", "TOTAL"],
  ["avgHeartRate", "heartRateBpm", "AVERAGE"], ["maxHeartRate", "heartRateBpm", "MAXIMUM"], ["minHeartRate", "heartRateBpm", "MINIMUM"],
  ["avgCadence", "cadenceRpm", "AVERAGE"], ["maxCadence", "cadenceRpm", "MAXIMUM"],
  ["avgFractionalCadence", "fractionalCadenceRpm", "AVERAGE"], ["maxFractionalCadence", "fractionalCadenceRpm", "MAXIMUM"],
  ["avgPower", "powerWatts", "AVERAGE"], ["maxPower", "powerWatts", "MAXIMUM"],
  ["avgSpeed", "speedMetersPerSecond", "AVERAGE"], ["maxSpeed", "speedMetersPerSecond", "MAXIMUM"],
  ["enhancedAvgSpeed", "enhancedSpeedMetersPerSecond", "AVERAGE"], ["enhancedMaxSpeed", "enhancedSpeedMetersPerSecond", "MAXIMUM"],
  ["avgAltitude", "altitudeMeters", "AVERAGE"], ["maxAltitude", "altitudeMeters", "MAXIMUM"], ["minAltitude", "altitudeMeters", "MINIMUM"],
  ["enhancedAvgAltitude", "enhancedAltitudeMeters", "AVERAGE"], ["enhancedMaxAltitude", "enhancedAltitudeMeters", "MAXIMUM"],
  ["enhancedMinAltitude", "enhancedAltitudeMeters", "MINIMUM"],
  ["avgTemperature", "temperatureCelsius", "AVERAGE"], ["maxTemperature", "temperatureCelsius", "MAXIMUM"],
  ["avgVerticalOscillation", "verticalOscillationMillimeters", "AVERAGE"], ["avgVerticalRatio", "verticalRatioPercent", "AVERAGE"],
  ["avgStanceTime", "groundContactTimeMilliseconds", "AVERAGE"], ["avgStanceTimeBalance", "groundContactBalancePercent", "AVERAGE"],
  ["avgStepLength", "stepLengthMillimeters", "AVERAGE"],
]
function numeric(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null }
function nonnegative(value: unknown): number | null { const n = numeric(value); return n !== null && n >= 0 ? n : null }
function instant(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null
}
function sourceText(value: unknown): string | null {
  return (typeof value === "string" || typeof value === "number") && String(value).length <= 200 ? String(value) : null
}
function summary(message: Message): ActivityDetailSummary {
  return SUMMARY_METRICS.filter(([field]) => Object.hasOwn(message, field)).map(([field, metric, statistic]) => ({
    metric, statistic, value: numeric(message[field]), sourceField: field,
  }))
}
function sportOf(value: unknown): FileObservationV1["sport"] {
  return value === "running" ? "RUNNING" : value === "cycling" ? "CYCLING" : value === "walking" ? "WALKING" : typeof value === "string" ? "OTHER" : "UNKNOWN"
}
function duration(message: Message): { durationSeconds: number | null; durationMeaning: FileObservationV1["durationMeaning"] } {
  for (const [field, meaning] of [["totalTimerTime", "TIMER"], ["totalElapsedTime", "ELAPSED"], ["totalMovingTime", "MOVING"]] as const) {
    const value = nonnegative(message[field])
    if (value !== null) return { durationSeconds: value, durationMeaning: meaning }
  }
  return { durationSeconds: null, durationMeaning: "UNKNOWN" }
}

/** Official SDK, CRC checked, profile conversions only. No HR interpolation or memo/profile extraction. */
export function parseFitActivities(bytes: Uint8Array, timeZone: string): ActivityParseResult {
  const fail = (code: ActivityParseIssueCode): ActivityParseResult => ({ activities: [], skipped: 0, format: "fit", issues: [{ code, activityIndex: null, count: 1 }] })
  if (bytes.length > FILE_OBSERVATION_LIMITS.bytes) return fail("FILE_TOO_LARGE")
  const issues: ActivityParseIssue[] = []
  try {
    const decoder = new Decoder(Stream.fromByteArray(bytes))
    if (!decoder.isFIT() || !decoder.checkIntegrity()) return fail("INVALID_FILE")
    const counts = new Map<number, number>()
    let exceeded: ActivityParseIssueCode | null = null
    const decoded = decoder.read({
      applyScaleAndOffset: true, convertDateTimesToDates: true, convertTypesToStrings: true,
      expandSubFields: true, expandComponents: true, mergeHeartRates: false, decodeMemoGlobs: false, includeUnknownData: false,
      mesgListener: (num) => {
        const count = (counts.get(num) ?? 0) + 1
        counts.set(num, count)
        if (num === Profile.MesgNum.RECORD && count > FILE_OBSERVATION_LIMITS.points) exceeded = "POINT_LIMIT_EXCEEDED"
        if (num === Profile.MesgNum.LAP && count > FILE_OBSERVATION_LIMITS.laps) exceeded = "LAP_LIMIT_EXCEEDED"
        if (num === Profile.MesgNum.SESSION && count > FILE_OBSERVATION_LIMITS.activities) exceeded = "ACTIVITY_LIMIT_EXCEEDED"
        if (num === Profile.MesgNum.EVENT && count > FILE_OBSERVATION_LIMITS.points) exceeded = "POINT_LIMIT_EXCEEDED"
        if (exceeded) throw new Error("FIT_BUDGET_EXCEEDED")
      },
    })
    if (exceeded) return fail(exceeded)
    if (decoded.errors.length) return fail("INVALID_FILE")
    const messages = decoded.messages as unknown as Record<string, Message[] | undefined>
    const sessions = messages.sessionMesgs ?? [], records = messages.recordMesgs ?? [], laps = messages.lapMesgs ?? []
    const ids = messages.fileIdMesgs ?? []
    if (ids.length !== 1 || ids[0]!.type !== "activity" || !sessions.length) return fail("UNSUPPORTED_FORMAT")
    // Developer fields / standalone HR have no allowlisted display contract yet; omission is visible.
    const unsupported = (messages.fieldDescriptionMesgs?.length ?? 0) + (messages.hrMesgs?.length ?? 0)
    if (unsupported) issues.push({ code: "UNSUPPORTED_FIT_FIELDS", activityIndex: null, count: unsupported })
    const fileId = ids[0]!
    const source = declaredFileSource(sourceText(fileId.manufacturer), sourceText(fileId.garminProduct ?? fileId.product), "FIT")
    const activities: ImportedActivity[] = []
    const usedRecords = new Set<number>()
    let skipped = 0
    for (const [activityIndex, session] of sessions.entries()) {
      const issue = (code: ActivityParseIssueCode, count = 1) => issues.push({ code, activityIndex, count })
      const startedAt = instant(session.startTime)
      const end = instant(session.timestamp)
      if (!startedAt) { issue("MISSING_DATE"); skipped++; continue }
      let date: string, observationTimeZone: string | null = timeZone
      try {
        const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(startedAt))
        const part = (type: string) => parts.find(p => p.type === type)!.value
        date = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`
      } catch { issue("INVALID_TIMEZONE"); observationTimeZone = null; date = startedAt.slice(0, 10) }
      const within = (message: Message) => {
        if (sessions.length === 1) return true
        const time = instant(message.timestamp)
        return time !== null && end !== null && Date.parse(time) >= Date.parse(startedAt) && Date.parse(time) <= Date.parse(end)
      }
      const firstLap = nonnegative(session.firstLapIndex), numLaps = nonnegative(session.numLaps)
      const sessionLaps = firstLap !== null && numLaps !== null && Number.isInteger(firstLap) && Number.isInteger(numLaps)
        ? laps.slice(firstLap, firstLap + numLaps) : laps.filter(within)
      const detail: ActivityFileDetailV1 = { schemaVersion: 1, source, summary: summary(session), samples: [], events: [],
        laps: sessionLaps.map((lap, sourceIndex) => ({ sourceIndex, startTime: instant(lap.startTime), endTime: instant(lap.timestamp),
          trigger: sourceText(lap.lapTrigger), summary: summary(lap) })) }
      const events = (messages.eventMesgs ?? []).filter(event => event.event === "timer" && within(event))
      detail.events = events.map((event, sourceIndex) => ({ sourceIndex, timestamp: instant(event.timestamp),
        type: event.eventType === "start" ? "TIMER_START" : ["stop", "stopAll", "stopDisable", "stopDisableAll"].includes(String(event.eventType)) ? "TIMER_STOP" : "UNKNOWN" }))
      const stops = detail.events.filter(event => event.type === "TIMER_STOP" && event.timestamp !== null).map(event => Date.parse(event.timestamp!)).sort((a, b) => a - b)
      const crossesStop = (from: number, to: number) => {
        let lo = 0, hi = stops.length
        while (lo < hi) { const middle = (lo + hi) >>> 1; if (stops[middle]! < from) lo = middle + 1; else hi = middle }
        return lo < stops.length && stops[lo]! < to
      }
      const lapBounds = detail.laps.map(lap => ({ start: lap.startTime === null ? null : Date.parse(lap.startTime), end: lap.endTime === null ? null : Date.parse(lap.endTime) }))
      let segmentIndex = 0, previousTimestamp: string | null = null
      for (const [index, record] of records.entries()) {
        if (usedRecords.has(index) || !within(record)) continue
        usedRecords.add(index)
        const timestamp = instant(record.timestamp)
        if (!timestamp) issue("MISSING_TIMESTAMP")
        if (previousTimestamp !== null && timestamp !== null && (Date.parse(timestamp) < Date.parse(previousTimestamp)
          || crossesStop(Date.parse(previousTimestamp), Date.parse(timestamp)))) segmentIndex++
        if (previousTimestamp !== null && timestamp !== null && Date.parse(timestamp) < Date.parse(previousTimestamp)) issue("NON_MONOTONIC_TIME")
        const metrics: ActivityDetailSample["metrics"] = {}
        for (const [field, metric] of RECORD_METRICS) if (Object.hasOwn(record, field)) metrics[metric] = numeric(record[field])
        const lat = numeric(record.positionLat), lon = numeric(record.positionLong)
        // FIT profile position units are semicircles. This is unit conversion, not route inference.
        const latitudeDegrees = lat === null ? null : lat * (180 / 2147483648)
        const longitudeDegrees = lon === null ? null : lon * (180 / 2147483648)
        const position = latitudeDegrees !== null && longitudeDegrees !== null && Math.abs(latitudeDegrees) <= 90 && Math.abs(longitudeDegrees) <= 180
          ? { latitudeDegrees, longitudeDegrees } : null
        if ((lat !== null || lon !== null) && position === null) issue("INVALID_COORDINATE")
        const clock = timestamp === null ? null : Date.parse(timestamp)
        const lapIndex = clock === null ? -1 : lapBounds.findIndex((lap, index) => lap.start !== null && lap.end !== null
          && clock >= lap.start && (index === detail.laps.length - 1 ? clock <= lap.end : clock < lap.end))
        detail.samples.push({ sourceIndex: detail.samples.length, timestamp, segmentIndex, lapIndex: lapIndex < 0 ? null : lapIndex, metrics, position })
        previousTimestamp = timestamp
      }
      const distanceMeters = nonnegative(session.totalDistance), time = duration(session)
      if (distanceMeters === null && time.durationSeconds === null && detail.samples.length === 0) { issue("NO_MEASUREMENTS"); skipped++; continue }
      const sport = sportOf(session.sport)
      const observation = buildFileObservation({ format: "fit", sourceProfile: "FIT_ACTIVITY_V1", parserVersion: "fit-sdk-21.221.0-observation-1",
        sourceActivityId: `${startedAt}:${nonnegative(session.messageIndex) ?? activityIndex}`, date, startedAt, timeZone: observationTimeZone,
        sport, distanceMeters, ...time,
        laps: sessionLaps.map((lap, sourceIndex) => ({ sourceIndex, distanceMeters: nonnegative(lap.totalDistance), ...duration(lap), kind: "UNKNOWN" })),
        confirmation: null, detail,
      })
      activities.push({ date, name: sport === "RUNNING" ? "가져온 달리기" : "가져온 활동", sport,
        ...toFileObservationSummary(observation), observation })
    }
    if (usedRecords.size !== records.length) issues.push({ code: "UNASSIGNED_FIT_RECORD", activityIndex: null, count: records.length - usedRecords.size })
    return { activities, skipped, format: "fit", ...(issues.length ? { issues } : {}) }
  } catch { return fail("INVALID_FILE") }
}
