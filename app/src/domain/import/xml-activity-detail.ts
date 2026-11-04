import { z } from "zod"
import { parseFileNumber } from "./structured-activity-file"
import type { ActivityDetailMetric, ActivityDetailSample, ActivityDetailSummary, ActivityFileDetailV1 } from "./file-activity-detail"

type Issue = (code: "INVALID_SENSOR_VALUE" | "AMBIGUOUS_SENSOR_FIELD" | "INVALID_TIMESTAMP" | "MISSING_TIMESTAMP" | "TIMEZONE_REQUIRED" | "INVALID_COORDINATE") => void
const ACTIVITY_EXTENSION = "http://www.garmin.com/xmlschemas/ActivityExtension/v2"
const TRACKPOINT_EXTENSIONS = ["http://www.garmin.com/xmlschemas/TrackPointExtension/v1", "http://www.garmin.com/xmlschemas/TrackPointExtension/v2"]

export function xmlChildren(parent: Element, name: string, namespace = parent.namespaceURI): Element[] {
  // Indexing a live HTMLCollection can become quadratic for 100k-point tracks.
  const matches: Element[] = []
  for (let child = parent.firstElementChild; child !== null; child = child.nextElementSibling) {
    if (child.localName === name && child.namespaceURI === namespace) matches.push(child)
  }
  return matches
}
function single(parent: Element, name: string, namespace = parent.namespaceURI): Element | null {
  const matches = xmlChildren(parent, name, namespace)
  return matches.length === 1 ? matches[0]! : null
}
function text(node: Element | null): string | null {
  return node !== null && node.children.length === 0 ? (node.textContent ?? "").trim() : null
}
function safeText(value: string | null): string | null {
  return value && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value) ? value : null
}
export function declaredFileSource(name: string | null, product: string | null, namespace: string | null): ActivityFileDetailV1["source"] {
  const clean = safeText(name)
  const brands = (["GARMIN", "COROS", "APPLE", "SAMSUNG", "WHOOP"] as const).filter(brand => new RegExp(`\\b${brand}\\b`, "iu").test(clean ?? ""))
  return { originProvider: brands.length === 1 ? brands[0]! : "UNKNOWN", evidence: "FILE_METADATA",
    manufacturer: brands.length === 1 ? brands[0]! : clean, product: safeText(product), namespace }
}

export function detailTime(raw: string | null): { timestamp: string | null; localTimestamp?: string } {
  if (raw && !raw.startsWith("0000-") && !raw.endsWith("-00:00")
    && z.iso.datetime({ offset: true }).safeParse(raw).success && Number.isFinite(Date.parse(raw))) return { timestamp: raw }
  if (raw && !raw.startsWith("0000-") && (z.iso.datetime({ local: true }).safeParse(raw).success
    || (raw.endsWith("-00:00") && z.iso.datetime({ offset: true }).safeParse(raw).success))) return { timestamp: null, localTimestamp: raw }
  return { timestamp: null }
}

function numeric(node: Element, name: string, issue: Issue, namespace = node.namespaceURI, signed = false): { present: boolean; value: number | null } {
  const matches = xmlChildren(node, name, namespace)
  if (!matches.length) return { present: false, value: null }
  if (matches.length !== 1 || matches[0]!.children.length > 0) { issue("AMBIGUOUS_SENSOR_FIELD"); return { present: true, value: null } }
  const parsed = parseFileNumber(text(matches[0]!), signed)
  if (parsed.issue) issue("INVALID_SENSOR_VALUE")
  return { present: true, value: parsed.value }
}
function sensor(target: ActivityDetailSample["metrics"], node: Element, field: string, metric: ActivityDetailMetric, issue: Issue, namespace = node.namespaceURI, signed = false) {
  const result = numeric(node, field, issue, namespace, signed)
  if (result.present) target[metric] = result.value
}
function summaryField(target: ActivityDetailSummary, node: Element, field: string, metric: ActivityDetailMetric, statistic: ActivityDetailSummary[number]["statistic"], issue: Issue, namespace = node.namespaceURI, prefix = "") {
  const result = numeric(node, field, issue, namespace, metric === "altitudeMeters" || metric === "temperatureCelsius")
  if (result.present) target.push({ metric, statistic, value: result.value, sourceField: `${prefix}${field}` })
}
function heartRate(node: Element, field: string, issue: Issue): { present: boolean; value: number | null } {
  const parents = xmlChildren(node, field)
  if (!parents.length) return { present: false, value: null }
  if (parents.length !== 1) { issue("AMBIGUOUS_SENSOR_FIELD"); return { present: true, value: null } }
  const result = numeric(parents[0]!, "Value", issue)
  return { present: true, value: result.value }
}
function position(node: Element, issue: Issue): ActivityDetailSample["position"] {
  const parents = xmlChildren(node, "Position")
  if (!parents.length) return null
  if (parents.length !== 1) { issue("AMBIGUOUS_SENSOR_FIELD"); return null }
  const lat = numeric(parents[0]!, "LatitudeDegrees", issue, node.namespaceURI, true).value
  const lon = numeric(parents[0]!, "LongitudeDegrees", issue, node.namespaceURI, true).value
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { issue("INVALID_COORDINATE"); return null }
  return { latitudeDegrees: lat, longitudeDegrees: lon }
}
function extension(node: Element, name: string, namespaces: readonly string[], issue: Issue): Element | null {
  const containers = xmlChildren(node, "Extensions").concat(xmlChildren(node, "extensions"))
  const matches = containers.flatMap(parent => namespaces.flatMap(ns => xmlChildren(parent, name, ns)))
  if (matches.length > 1) { issue("AMBIGUOUS_SENSOR_FIELD"); return null }
  return matches[0] ?? null
}

export function tcxActivityDetail(activity: Element, issue: Issue): ActivityFileDetailV1 {
  const creator = single(activity, "Creator")
  const deviceName = creator ? text(single(creator, "Name")) : null
  const detail: ActivityFileDetailV1 = {
    schemaVersion: 1, source: declaredFileSource(deviceName, deviceName, activity.namespaceURI),
    summary: [], samples: [], laps: [], events: [],
  }
  let segmentIndex = 0
  for (const [lapIndex, lap] of xmlChildren(activity, "Lap").entries()) {
    const summary: ActivityDetailSummary = []
    // The canonical lap parser already emits distance/time diagnostics once.
    summaryField(summary, lap, "DistanceMeters", "distanceMeters", "TOTAL", () => {})
    summaryField(summary, lap, "TotalTimeSeconds", "sourceDurationSeconds", "TOTAL", () => {})
    summaryField(summary, lap, "Calories", "caloriesKcal", "TOTAL", issue)
    summaryField(summary, lap, "MaximumSpeed", "speedMetersPerSecond", "MAXIMUM", issue)
    summaryField(summary, lap, "Cadence", "cadenceRpm", "AVERAGE", issue)
    for (const [field, statistic] of [["AverageHeartRateBpm", "AVERAGE"], ["MaximumHeartRateBpm", "MAXIMUM"]] as const) {
      const hr = heartRate(lap, field, issue)
      if (hr.present) summary.push({ metric: "heartRateBpm", statistic, value: hr.value, sourceField: `${field}/Value` })
    }
    const lx = extension(lap, "LX", [ACTIVITY_EXTENSION], issue)
    if (lx) for (const [field, metric, statistic] of [
      ["AvgSpeed", "speedMetersPerSecond", "AVERAGE"], ["MaxBikeCadence", "cadenceRpm", "MAXIMUM"],
      ["AvgRunCadence", "runCadence", "AVERAGE"], ["MaxRunCadence", "runCadence", "MAXIMUM"],
      ["AvgWatts", "powerWatts", "AVERAGE"], ["MaxWatts", "powerWatts", "MAXIMUM"],
    ] as const) summaryField(summary, lx, field, metric, statistic, issue, ACTIVITY_EXTENSION, "LX/")
    const start = detailTime(lap.getAttribute("StartTime"))
    detail.laps.push({ sourceIndex: lapIndex, startTime: start.timestamp, endTime: null,
      ...(start.localTimestamp ? { localStartTime: start.localTimestamp } : {}),
      trigger: safeText(text(single(lap, "TriggerMethod"))), summary })
    for (const track of xmlChildren(lap, "Track")) {
      for (const point of xmlChildren(track, "Trackpoint")) {
        const rawTime = text(single(point, "Time"))
        const time = detailTime(rawTime)
        if (!time.timestamp) issue(time.localTimestamp ? "TIMEZONE_REQUIRED" : rawTime ? "INVALID_TIMESTAMP" : "MISSING_TIMESTAMP")
        const metrics: ActivityDetailSample["metrics"] = {}
        sensor(metrics, point, "DistanceMeters", "distanceMeters", issue)
        sensor(metrics, point, "AltitudeMeters", "altitudeMeters", issue, point.namespaceURI, true)
        sensor(metrics, point, "Cadence", "cadenceRpm", issue)
        const hr = heartRate(point, "HeartRateBpm", issue)
        if (hr.present) metrics.heartRateBpm = hr.value
        const tpx = extension(point, "TPX", [ACTIVITY_EXTENSION], issue)
        if (tpx) {
          sensor(metrics, tpx, "Speed", "speedMetersPerSecond", issue, ACTIVITY_EXTENSION)
          sensor(metrics, tpx, "RunCadence", "runCadence", issue, ACTIVITY_EXTENSION)
          sensor(metrics, tpx, "Watts", "powerWatts", issue, ACTIVITY_EXTENSION)
        }
        detail.samples.push({ sourceIndex: detail.samples.length, ...time, segmentIndex, lapIndex, metrics, position: position(point, issue) })
      }
      segmentIndex += 1
    }
  }
  return detail
}

export function gpxTrackDetail(track: Element, creator: string | null, issue: Issue): ActivityFileDetailV1 {
  const detail: ActivityFileDetailV1 = { schemaVersion: 1, source: declaredFileSource(creator, null, track.namespaceURI), summary: [], samples: [], laps: [], events: [] }
  for (const [segmentIndex, segment] of xmlChildren(track, "trkseg").entries()) {
    for (const point of xmlChildren(segment, "trkpt")) {
      const time = detailTime(text(single(point, "time")))
      const metrics: ActivityDetailSample["metrics"] = {}
      sensor(metrics, point, "ele", "altitudeMeters", issue, point.namespaceURI, true)
      const ext = extension(point, "TrackPointExtension", TRACKPOINT_EXTENSIONS, issue)
      if (ext) {
        sensor(metrics, ext, "hr", "heartRateBpm", issue)
        sensor(metrics, ext, "cad", "cadenceRpm", issue)
        sensor(metrics, ext, "atemp", "temperatureCelsius", issue, ext.namespaceURI, true)
      }
      const lat = parseFileNumber(point.getAttribute("lat"), true).value
      const lon = parseFileNumber(point.getAttribute("lon"), true).value
      detail.samples.push({ sourceIndex: detail.samples.length, ...time, segmentIndex, lapIndex: null, metrics,
        position: lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitudeDegrees: lat, longitudeDegrees: lon } : null })
    }
  }
  return detail
}
