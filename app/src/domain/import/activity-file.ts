// 원칙:
//  - 파일에 실제로 있는 사실만 읽는다. 없는 값은 계산 가능한 경우(총거리/총시간
//    → 평균 페이스)에만 파생하고, 그 외 추정·날조 없음.
//  - 파싱 실패는 조용히 스킵이 아니라 결과에 개수로 보고 (fail-visible).
//  - 외부 의존성 없음 — 브라우저/jsdom 내장 DOMParser 사용.

export type ImportedActivity = {
  /** YYYY-MM-DD (활동 시작 로컬 기준 — 파일의 ISO 타임스탬프에서 날짜부) */
  readonly date: string
  readonly name: string
  readonly sport: string
  /** km, 소수 2자리 문자열 (기존 일지 필드와 동일 표현) */
  readonly distanceKm: string
  /** 분, 정수 문자열 */
  readonly durationMin: string
  /** m:ss/km 표현 — 거리·시간 둘 다 있을 때만 파생, 아니면 "" */
  readonly avgPace: string
}

export type ActivityParseResult = {
  readonly activities: readonly ImportedActivity[]
  readonly skipped: number
  readonly format: "tcx" | "gpx" | "csv" | "json" | "unknown"
}

import { parseCsvActivities, parseJsonActivities } from "./structured-activity-file"

const EMPTY: ActivityParseResult = { activities: [], skipped: 0, format: "unknown" }

function isoDatePart(iso: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(iso.trim())
  return match?.[1] ?? null
}

function paceOf(distanceMeters: number, seconds: number): string {
  if (distanceMeters <= 0 || seconds <= 0) return ""
  const secPerKm = seconds / (distanceMeters / 1000)
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  const s = sec === 60 ? 0 : sec
  const m = sec === 60 ? min + 1 : min
  return `${m}:${String(s).padStart(2, "0")}`
}

function toActivity(
  startIso: string | null,
  name: string,
  sport: string,
  distanceMeters: number,
  seconds: number,
): ImportedActivity | null {
  const date = startIso === null ? null : isoDatePart(startIso)
  if (date === null) return null
  if (!(distanceMeters > 0) && !(seconds > 0)) return null
  return {
    date,
    name: name.trim() || "가져온 활동",
    sport: sport.trim() || "unknown",
    distanceKm: distanceMeters > 0 ? (distanceMeters / 1000).toFixed(2) : "",
    durationMin: seconds > 0 ? String(Math.round(seconds / 60)) : "",
    avgPace: paceOf(distanceMeters, seconds),
  }
}

function textOf(parent: Element, tag: string): string {
  const el = parent.getElementsByTagName(tag)[0]
  return el?.textContent ?? ""
}

function numOf(parent: Element, tag: string): number {
  const n = Number.parseFloat(textOf(parent, tag))
  return Number.isFinite(n) ? n : 0
}

function parseTcx(doc: Document): ActivityParseResult {
  const nodes = [...doc.getElementsByTagName("Activity")]
  const activities: ImportedActivity[] = []
  let skipped = 0
  for (const node of nodes) {
    const laps = [...node.getElementsByTagName("Lap")]
    let meters = 0
    let seconds = 0
    for (const lap of laps) {
      meters += numOf(lap, "DistanceMeters")
      seconds += numOf(lap, "TotalTimeSeconds")
    }
    const startIso = textOf(node, "Id") || laps[0]?.getAttribute("StartTime") || null
    const activity = toActivity(
      startIso,
      textOf(node, "Notes"),
      node.getAttribute("Sport") ?? "",
      meters,
      seconds,
    )
    if (activity === null) skipped += 1
    else activities.push(activity)
  }
  return { activities, skipped, format: "tcx" }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function parseGpx(doc: Document): ActivityParseResult {
  const tracks = [...doc.getElementsByTagName("trk")]
  const activities: ImportedActivity[] = []
  let skipped = 0
  for (const trk of tracks) {
    const points = [...trk.getElementsByTagName("trkpt")]
    let meters = 0
    let firstTime: string | null = null
    let lastTime: string | null = null
    let prev: { lat: number; lon: number } | null = null
    for (const pt of points) {
      const lat = Number.parseFloat(pt.getAttribute("lat") ?? "")
      const lon = Number.parseFloat(pt.getAttribute("lon") ?? "")
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      if (prev !== null) meters += haversineMeters(prev.lat, prev.lon, lat, lon)
      prev = { lat, lon }
      const t = textOf(pt, "time")
      if (t !== "") {
        if (firstTime === null) firstTime = t
        lastTime = t
      }
    }
    const seconds =
      firstTime !== null && lastTime !== null
        ? Math.max(0, (Date.parse(lastTime) - Date.parse(firstTime)) / 1000)
        : 0
    const activity = toActivity(
      firstTime,
      textOf(trk, "name"),
      textOf(trk, "type"),
      meters,
      seconds,
    )
    if (activity === null) skipped += 1
    else activities.push(activity)
  }
  return { activities, skipped, format: "gpx" }
}

export function parseActivityFile(text: string): ActivityParseResult {
  const trimmed = text.trimStart()
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJsonActivities(text) ?? EMPTY
  }
  const csv = parseCsvActivities(text)
  if (csv !== null) return csv
  if (typeof DOMParser === "undefined") return EMPTY
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(text, "application/xml")
  } catch {
    return EMPTY
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return EMPTY
  const root = doc.documentElement?.tagName ?? ""
  if (root === "TrainingCenterDatabase") return parseTcx(doc)
  if (root === "gpx") return parseGpx(doc)
  return EMPTY
}
