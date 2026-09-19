// 원칙:
//  - 파일에 실제로 있는 사실만 읽는다. 없는 값은 계산 가능한 경우(총거리/총시간
//    → 평균 페이스)에만 파생하고, 그 외 추정·날조 없음.
//  - 파싱 실패는 조용히 스킵이 아니라 결과에 개수로 보고 (fail-visible).
//  - 외부 의존성 없음 — 브라우저/jsdom 내장 DOMParser 사용.

import { z } from "zod"
import { activityFileTooLarge, parseCsvActivities, parseFileNumber, parseJsonActivities } from "./structured-activity-file"
import { buildFileObservation, completeLapTotal, FILE_OBSERVATION_LIMITS, toFileObservationSummary } from "./file-observation"
import type { FileObservationV1 } from "./file-observation"

export type ImportedActivity = {
  readonly date: string
  readonly name: string
  readonly sport: string
  /** km, available numeric precision without display rounding */
  readonly distanceKm: string
  /** 분, 원본 소수 정밀도 유지 */
  readonly durationMin: string
  /** m:ss/km 표현 — 거리·시간 둘 다 있을 때만 파생, 아니면 "" */
  readonly avgPace: string
  readonly observation?: FileObservationV1
}

export type ActivityParseIssueCode =
  | "FILE_TOO_LARGE" | "ACTIVITY_LIMIT_EXCEEDED" | "POINT_LIMIT_EXCEEDED" | "LAP_LIMIT_EXCEEDED"
  | "INVALID_FILE" | "UNSUPPORTED_FORMAT" | "MISSING_DATE" | "INVALID_DATE"
  | "TIMEZONE_REQUIRED" | "INVALID_TIMEZONE" | "INVALID_SOURCE_ID" | "NO_MEASUREMENTS"
  | "INVALID_DISTANCE" | "INVALID_DURATION" | "MISSING_DISTANCE" | "MISSING_DURATION"
  | "INVALID_DISTANCE_TOTAL" | "INVALID_DURATION_TOTAL"
  | "INVALID_ROW" | "INVALID_DURATION_MEANING" | "INVALID_TIMESTAMP" | "MISSING_TIMESTAMP"
  | "DATE_TIME_CONFLICT" | "INVALID_COORDINATE" | "TIME_GAP" | "NON_MONOTONIC_TIME"
  | "CSV_INVALID_HEADER" | "CSV_DUPLICATE_HEADER" | "CSV_COLUMN_COUNT" | "CSV_INVALID_QUOTES"

export type ActivityParseIssue = {
  readonly code: ActivityParseIssueCode
  /** Diagnostic location only, never observation identity. null means the whole file. */
  readonly activityIndex: number | null
  readonly count: number
}

export type ActivityParseResult = {
  readonly activities: readonly ImportedActivity[]
  readonly skipped: number
  readonly format: "tcx" | "gpx" | "csv" | "json" | "unknown"
  readonly issues?: readonly ActivityParseIssue[]
}

export type ActivityFileParseOptions = {
  /** Independent preparation switches, all off by default. Not account-write authority. */
  readonly observations?: { readonly csv?: boolean; readonly json?: boolean; readonly gpx?: boolean }
}

function rejected(code: ActivityParseIssueCode, format: ActivityParseResult["format"] = "unknown", skipped = 0): ActivityParseResult {
  return { activities: [], skipped, format, issues: [{ code, activityIndex: null, count: 1 }] }
}

function localDatePart(iso: string, timeZone: string): string | null {
  const instant = new Date(iso.trim())
  if (Number.isNaN(instant.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant)
    const year = parts.find((part) => part.type === "year")?.value
    const month = parts.find((part) => part.type === "month")?.value
    const day = parts.find((part) => part.type === "day")?.value
    return year === undefined || month === undefined || day === undefined
      ? null
      : `${year.padStart(4, "0")}-${month}-${day}`
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

function childrenOf(parent: Element, tag: string): Element[] {
  const children: Element[] = []
  for (let child = parent.firstElementChild; child !== null; child = child.nextElementSibling) {
    if (child.localName === tag && child.namespaceURI === parent.namespaceURI) children.push(child)
  }
  return children
}

function fieldText(parent: Element, tag: string): string | null {
  const fields = childrenOf(parent, tag)
  const field = fields[0]
  if (fields.length === 0) return ""
  if (fields.length !== 1 || field === undefined || field.children.length !== 0) return null
  return (field.textContent ?? "").trim()
}

const isoDate = z.iso.date().refine(value => !value.startsWith("0000-"))
const offsetTimestamp = z.iso.datetime({ offset: true })
const localTimestamp = z.iso.datetime({ local: true })

function isOffsetTimestamp(value: string): boolean {
  return /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && !value.startsWith("0000-") && !value.endsWith("-00:00")
    && offsetTimestamp.safeParse(value).success && Number.isFinite(Date.parse(value))
}

function isLocalTimestamp(value: string): boolean {
  return !value.startsWith("0000-") && (
    (/T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(value) && localTimestamp.safeParse(value).success)
    || (value.endsWith("-00:00") && offsetTimestamp.safeParse(value).success)
  )
}

function tcxSport(value: string | null): FileObservationV1["sport"] {
  switch (value?.toLowerCase()) {
    case "running": return "RUNNING"
    case "walking": return "WALKING"
    case "biking": case "cycling": return "CYCLING"
    case "other": return "OTHER"
    default: return "UNKNOWN"
  }
}

function parseTcx(doc: Document, timeZone: string): ActivityParseResult {
  const allNodes = doc.getElementsByTagNameNS("*", "Activity")
  if (allNodes.length > FILE_OBSERVATION_LIMITS.activities) return rejected("ACTIVITY_LIMIT_EXCEEDED", "tcx", allNodes.length)
  if (doc.getElementsByTagNameNS("*", "Trackpoint").length > FILE_OBSERVATION_LIMITS.points) {
    return rejected("POINT_LIMIT_EXCEEDED", "tcx", allNodes.length)
  }
  const containers = childrenOf(doc.documentElement, "Activities")
  const nodes = containers.flatMap(container => childrenOf(container, "Activity"))
  if (nodes.length === 0) return rejected("NO_MEASUREMENTS", "tcx")
  const activities: ImportedActivity[] = []
  const issues: ActivityParseIssue[] = []
  let skipped = 0
  for (const [activityIndex, node] of nodes.entries()) {
    const rowIssues = new Map<ActivityParseIssueCode, number>()
    const issue = (code: ActivityParseIssueCode) => rowIssues.set(code, (rowIssues.get(code) ?? 0) + 1)
    const finishIssues = () => {
      for (const [code, count] of rowIssues) issues.push({ code, activityIndex, count })
    }
    // Check before allocating or visiting lap/point observations.
    if (node.getElementsByTagNameNS("*", "Lap").length > FILE_OBSERVATION_LIMITS.laps) {
      skipped += 1
      issue("LAP_LIMIT_EXCEEDED")
      finishIssues()
      continue
    }
    const lapNodes = childrenOf(node, "Lap")
    const id = fieldText(node, "Id")
    const timestampId = id !== null && id.length <= 200 && (isOffsetTimestamp(id) || isLocalTimestamp(id))
    const validId = timestampId || (id !== null && /^\d{1,200}$/u.test(id))
    if (id === null || (id !== "" && !validId)) issue("INVALID_SOURCE_ID")
    const start = timestampId || (id !== null && isoDate.safeParse(id).success)
      ? id! : (lapNodes[0]?.getAttribute("StartTime")?.trim() ?? "")
    let date: string | null = null
    let startedAt: string | null = null
    let observationTimeZone: string | null = null
    if (isOffsetTimestamp(start)) {
      startedAt = start
      date = localDatePart(start, timeZone)
      if (date === null) {
        issue("INVALID_TIMEZONE")
        date = start.slice(0, 10)
      } else observationTimeZone = timeZone
    } else if (isLocalTimestamp(start) || isoDate.safeParse(start).success) {
      date = start.slice(0, 10)
      issue("TIMEZONE_REQUIRED")
    } else issue(start === "" ? "MISSING_DATE" : "INVALID_DATE")
    if (date === null) {
      skipped += 1
      finishIssues()
      continue
    }
    if (!isoDate.safeParse(date).success) {
      skipped += 1
      issue("INVALID_DATE")
      finishIssues()
      continue
    }
    const numberOf = (parent: Element, tag: string, invalid: ActivityParseIssueCode, missing: ActivityParseIssueCode): number | null => {
      const text = fieldText(parent, tag)
      if (text === null) { issue(invalid); return null }
      const parsed = parseFileNumber(text)
      if (parsed.issue !== null) issue(parsed.issue === "MISSING" ? missing : invalid)
      return parsed.value
    }
    const laps: FileObservationV1["laps"] = lapNodes.map((lap, sourceIndex) => ({
      sourceIndex,
      distanceMeters: numberOf(lap, "DistanceMeters", "INVALID_DISTANCE", "MISSING_DISTANCE"),
      durationSeconds: numberOf(lap, "TotalTimeSeconds", "INVALID_DURATION", "MISSING_DURATION"),
      durationMeaning: "SOURCE_DEFINED",
      kind: fieldText(lap, "Intensity") === "Active" ? "WORK" : fieldText(lap, "Intensity") === "Rest" ? "RECOVERY" : "UNKNOWN",
    }))
    const distanceMeters = completeLapTotal(laps, "distanceMeters")
    const durationSeconds = completeLapTotal(laps, "durationSeconds")
    if (laps.length > 0 && distanceMeters === null && laps.every(lap => lap.distanceMeters !== null)) issue("INVALID_DISTANCE_TOTAL")
    if (laps.length > 0 && durationSeconds === null && laps.every(lap => lap.durationSeconds !== null)) issue("INVALID_DURATION_TOTAL")
    if (!laps.some(lap => (lap.distanceMeters ?? 0) > 0 || (lap.durationSeconds ?? 0) > 0)) {
      skipped += 1
      issue("NO_MEASUREMENTS")
      finishIssues()
      continue
    }
    const sport = tcxSport(node.getAttribute("Sport"))
    const observation = buildFileObservation({
      format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-observation-1",
      sourceActivityId: validId ? id : null,
      date, startedAt, timeZone: observationTimeZone, sport,
      distanceMeters, durationSeconds, durationMeaning: "SOURCE_DEFINED", laps, confirmation: null,
    })
    activities.push({
      date,
      name: sport === "RUNNING" ? "가져온 달리기" : "가져온 활동",
      sport: sport === "RUNNING" ? "Running" : sport === "CYCLING" ? "Biking" : sport === "WALKING" ? "Walking" : sport === "OTHER" ? "Other" : "unknown",
      ...toFileObservationSummary(observation),
      observation,
    })
    finishIssues()
  }
  return { activities, skipped, format: "tcx", ...(issues.length > 0 ? { issues } : {}) }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

function elapsedSeconds(first: string, last: string): number {
  const parts = (value: string) => {
    const fraction = /\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/u.exec(value)
    return { whole: Date.parse(value.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}$)/u, "")), fraction: fraction === null ? 0 : Number(`0.${fraction[1]}`) }
  }
  const from = parts(first)
  const to = parts(last)
  return (to.whole - from.whole) / 1000 + to.fraction - from.fraction
}

function parseGpx(doc: Document, timeZone: string, includeObservation: boolean): ActivityParseResult {
  const trackCount = doc.getElementsByTagNameNS("*", "trk").length
  if (trackCount > FILE_OBSERVATION_LIMITS.activities) return rejected("ACTIVITY_LIMIT_EXCEEDED", "gpx", trackCount)
  if (doc.getElementsByTagNameNS("*", "trkpt").length > FILE_OBSERVATION_LIMITS.points) {
    return rejected("POINT_LIMIT_EXCEEDED", "gpx", trackCount)
  }
  const tracks = childrenOf(doc.documentElement, "trk")
  if (tracks.length === 0) return rejected("NO_MEASUREMENTS", "gpx")
  const activities: ImportedActivity[] = []
  const issues: ActivityParseIssue[] = []
  let skipped = 0
  for (const [activityIndex, trk] of tracks.entries()) {
    const codes = new Map<ActivityParseIssueCode, number>()
    const issue = (code: ActivityParseIssueCode) => { codes.set(code, (codes.get(code) ?? 0) + 1) }
    const segments = childrenOf(trk, "trkseg")
    let meters = 0
    let distanceComplete = segments.length > 0
    let timeComplete = segments.length > 0
    let firstTime: string | null = null
    let previousTime: string | null = null
    let dateSource: string | null = null
    let pointCount = 0
    for (const segment of segments) {
      let prev: { lat: number; lon: number } | null = null
      let segmentPoints = 0
      // Sibling traversal avoids repeatedly indexing a live, potentially 100k-item collection.
      for (let pt = segment.firstElementChild; pt !== null; pt = pt.nextElementSibling) {
        if (pt.localName !== "trkpt" || pt.namespaceURI !== segment.namespaceURI) continue
        const lat = parseFileNumber(pt.getAttribute("lat"), true).value
        const lon = parseFileNumber(pt.getAttribute("lon"), true).value
        if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          issue("INVALID_COORDINATE")
          distanceComplete = false
          prev = null
        } else {
          if (prev !== null) meters += haversineMeters(prev.lat, prev.lon, lat, lon)
          prev = { lat, lon }
        }
        const time = fieldText(pt, "time")
        const offsetTime = time !== null && isOffsetTimestamp(time)
        if (time !== null && dateSource === null && (offsetTime || isLocalTimestamp(time) || isoDate.safeParse(time).success)) dateSource = time
        if (!offsetTime) {
          issue(time === "" ? "MISSING_TIMESTAMP" : time !== null && (isLocalTimestamp(time) || isoDate.safeParse(time).success) ? "TIMEZONE_REQUIRED" : "INVALID_TIMESTAMP")
          timeComplete = false
          previousTime = null
        } else {
          if (pointCount === 0) firstTime = time
          if (previousTime !== null) {
            const difference = elapsedSeconds(previousTime, time)
            if (difference < 0) { issue("NON_MONOTONIC_TIME"); timeComplete = false }
            else if (segmentPoints === 0 && difference !== 0) { issue("TIME_GAP"); timeComplete = false }
          }
          previousTime = time
        }
        segmentPoints += 1
        pointCount += 1
      }
      if (segmentPoints < 2) {
        distanceComplete = false
        timeComplete = false
        issue("MISSING_DISTANCE")
        issue("MISSING_DURATION")
      }
    }
    const distanceMeters = distanceComplete ? meters : null
    const durationSeconds = timeComplete && pointCount >= 2 && firstTime !== null && previousTime !== null ? elapsedSeconds(firstTime, previousTime) : null
    let date: string | null = null
    let observationZone: string | null = null
    if (dateSource !== null) {
      if (isOffsetTimestamp(dateSource)) {
        date = localDatePart(dateSource, timeZone)
        if (date === null) { date = dateSource.slice(0, 10); issue("INVALID_TIMEZONE") }
        else observationZone = timeZone
      } else date = dateSource.slice(0, 10)
    }
    if (date === null || !isoDate.safeParse(date).success) { issue(date === null ? "MISSING_DATE" : "INVALID_DATE"); skipped += 1 }
    else if (distanceMeters === null && durationSeconds === null) { issue("NO_MEASUREMENTS"); skipped += 1 }
    else {
      const sport = tcxSport(fieldText(trk, "type"))
      const observation = buildFileObservation({
        format: "gpx", sourceProfile: "GPX_TRACK_V1", parserVersion: "gpx-observation-1", sourceActivityId: null,
        date, startedAt: firstTime, timeZone: observationZone, sport, distanceMeters, durationSeconds,
        durationMeaning: "ELAPSED", laps: [], confirmation: null,
      })
      activities.push({
        date, name: includeObservation ? sport === "RUNNING" ? "가져온 달리기" : "가져온 활동" : fieldText(trk, "name") || "가져온 활동",
        sport: fieldText(trk, "type") || "unknown", ...toFileObservationSummary(observation),
        ...(includeObservation ? { observation } : {}),
      })
    }
    for (const [code, count] of codes) issues.push({ code, activityIndex, count })
  }
  return { activities, skipped, format: "gpx", ...(issues.length > 0 ? { issues } : {}) }
}

export function parseActivityFile(
  text: string,
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  options: ActivityFileParseOptions = {},
): ActivityParseResult {
  if (activityFileTooLarge(text)) {
    return rejected("FILE_TOO_LARGE")
  }
  const trimmed = text.trimStart()
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJsonActivities(text, { observation: options.observations?.json === true, timeZone }) ?? rejected("INVALID_FILE", "json")
  }
  if (!trimmed.startsWith("<")) {
    return parseCsvActivities(text, { observation: options.observations?.csv === true, timeZone }) ?? rejected("UNSUPPORTED_FORMAT")
  }
  // Do not expand entities or accept document types from uploaded files.
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) return rejected("INVALID_FILE")
  if (typeof DOMParser === "undefined") return rejected("INVALID_FILE")
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text, "application/xml")
  } catch {
    return rejected("INVALID_FILE")
  }
  if (doc.getElementsByTagNameNS("*", "parsererror").length > 0) return rejected("INVALID_FILE")
  const root = doc.documentElement?.localName ?? ""
  if (root === "TrainingCenterDatabase" && [null, "", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v1", "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"].includes(doc.documentElement.namespaceURI)) return parseTcx(doc, timeZone)
  if (root === "gpx" && [null, "", "http://www.topografix.com/GPX/1/0", "http://www.topografix.com/GPX/1/1"].includes(doc.documentElement.namespaceURI)) return parseGpx(doc, timeZone, options.observations?.gpx === true)
  return rejected("UNSUPPORTED_FORMAT")
}
