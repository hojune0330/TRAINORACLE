import { canonicalPaceDistance, PACE_EVENT_METERS, roundedPaceSeconds } from "@impl/prescription/record-pace"
import type { AthleteRecord } from "./athlete-records"

export const PACE_TOOL_VERSION = "pace-tools-v1"
export const SPLIT_ROW_LIMIT = 2000
export const SPLIT_PAGE_SIZE = 50
export const PACE_TOOL_STAGES = ["event", "input", "result", "reference", "splits", "table", "track", "evidence"] as const
export type PaceToolStage = typeof PACE_TOOL_STAGES[number]
export const isPaceToolStage = (value: unknown): value is PaceToolStage => PACE_TOOL_STAGES.some(stage => stage === value)

export interface PaceToolRequest {
  readonly record?: AthleteRecord
  readonly allowedEvents?: readonly number[]
  readonly selectionLabel?: string
  readonly calculationModel?: "RACE_AVERAGE_V1" | "FIVE_K_THRESHOLD_V1"
  readonly onSelectRecord?: (record: AthleteRecord) => boolean | void
}

export type ClockInputResult = { kind: "empty" | "incomplete" | "invalid"; message: string } | { kind: "valid"; seconds: number }
export function parsePaceClock(hours: string, minutes: string, seconds: string): ClockInputResult {
  if (![hours, minutes, seconds].some(value => value.trim())) return { kind: "empty", message: "경기 기록을 입력해 주세요." }
  if (!minutes.trim() || !seconds.trim()) return { kind: "incomplete", message: "분과 초를 입력해 주세요." }
  const h = hours.trim() || "0", m = minutes.trim(), s = seconds.trim()
  if (!/^\d+$/.test(h) || !/^\d+$/.test(m) || !/^\d+(?:\.\d+)?$/.test(s)) return { kind: "invalid", message: "0 이상의 숫자를 입력해 주세요." }
  const total = Number(h) * 3600 + Number(m) * 60 + Number(s)
  if (Number(m) >= 60 || Number(s) >= 60 || !Number.isFinite(total) || total <= 0 || total > 86400) {
    return { kind: "invalid", message: "분과 초는 60 미만, 전체 기록은 0초 초과 24시간 이내로 입력해 주세요." }
  }
  return { kind: "valid", seconds: total }
}

export function paceClock(seconds: number, decimals: 0 | 1 = 1): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—"
  const rounded = roundedPaceSeconds(seconds, decimals)
  const hours = Math.floor(rounded / 3600), minutes = Math.floor(rounded / 60) % 60
  const remainder = (rounded % 60).toFixed(decimals).replace(/\.0$/, "")
  return `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : Math.floor(rounded / 60)}:${remainder.padStart(remainder.includes(".") ? 4 : 2, "0")}`
}

export const paceEventLabel = (metres: number) => canonicalPaceDistance(metres) === 21097.5 ? "하프" : metres === 42195 ? "마라톤" : metres >= 10000 ? `${metres / 1000}km` : `${metres}m`
export function directPaceSeconds(sourceSeconds: number, sourceMetres: number, targetMetres: number): number | null {
  const event = canonicalPaceDistance(sourceMetres)
  if (!PACE_EVENT_METERS.some(value => value === event) || !Number.isFinite(sourceSeconds) || sourceSeconds <= 0 || sourceSeconds > 86400
    || !Number.isFinite(targetMetres) || targetMetres < 60) return null
  const result = sourceSeconds * targetMetres / event
  return Number.isFinite(result) ? result : null
}

export function primaryPaceDistances(sourceMetres: number): readonly number[] {
  const event = canonicalPaceDistance(sourceMetres)
  return [...new Set([...(event <= 3000 ? [200, 400] : [400, 1000]), event])]
}

export interface PaceSplitInput { readonly metres: number; readonly weight?: number; readonly fixedSeconds?: number }
export interface PaceSplit { readonly metres: number; readonly cumulativeMetres: number; readonly seconds: number; readonly cumulativeSeconds: number; readonly fixed: boolean }
export type PaceSplitResult = { readonly kind: "invalid"; readonly message: string } | { readonly kind: "ready"; readonly rows: readonly PaceSplit[] }

export function calculatePaceSplits(totalSeconds: number, segments: readonly PaceSplitInput[]): PaceSplitResult {
  const invalid = (message: string): PaceSplitResult => ({ kind: "invalid", message })
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0 || totalSeconds > 86400 || !segments.length || segments.length > SPLIT_ROW_LIMIT) return invalid("구간 수와 전체 시간을 확인해 주세요.")
  if (segments.some(row => !Number.isFinite(row.metres) || row.metres <= 0 || !Number.isFinite(row.weight ?? 1) || (row.weight ?? 1) <= 0
    || row.fixedSeconds !== undefined && (!Number.isFinite(row.fixedSeconds) || row.fixedSeconds <= 0))) return invalid("거리, 가중치와 고정 시간은 0보다 커야 해요.")
  const fixedTotal = segments.reduce((sum, row) => sum + (row.fixedSeconds ?? 0), 0)
  const weights = segments.reduce((sum, row) => sum + (row.fixedSeconds === undefined ? row.metres * (row.weight ?? 1) : 0), 0)
  if (!Number.isFinite(weights) || fixedTotal > totalSeconds || weights === 0 && Math.abs(fixedTotal - totalSeconds) > 1e-8
    || weights > 0 && fixedTotal >= totalSeconds) return invalid("고정한 구간 시간을 합치면 전체 시간에 맞출 수 없어요.")
  let distance = 0, cumulative = 0, displayed = 0
  const rows = segments.map((row, index): PaceSplit => {
    distance += row.metres
    cumulative += row.fixedSeconds ?? (totalSeconds - fixedTotal) * row.metres * (row.weight ?? 1) / weights
    const next = roundedPaceSeconds(index === segments.length - 1 ? totalSeconds : cumulative, 1)
    const seconds = roundedPaceSeconds(next - displayed, 1)
    displayed = next
    return { metres: row.metres, cumulativeMetres: distance, seconds, cumulativeSeconds: next, fixed: row.fixedSeconds !== undefined }
  })
  return { kind: "ready", rows }
}

export function equalDistanceSplits(sourceSeconds: number, sourceMetres: number, unitMetres: number, trend: "even" | "faster" | "slower" = "even", fixedSeconds: Readonly<Record<number, number>> = {}): PaceSplitResult {
  const event = canonicalPaceDistance(sourceMetres)
  if (!PACE_EVENT_METERS.some(value => value === event) || !Number.isFinite(unitMetres) || unitMetres < 60) return { kind: "invalid", message: "구간 거리는 60m 이상으로 입력해 주세요." }
  const count = Math.ceil(event / unitMetres)
  if (count > SPLIT_ROW_LIMIT) return { kind: "invalid", message: `한 번에 ${SPLIT_ROW_LIMIT}구간까지 계산해요.` }
  return calculatePaceSplits(sourceSeconds, Array.from({ length: count }, (_, index) => ({
    metres: Math.min(unitMetres, event - index * unitMetres),
    weight: trend === "even" ? 1 : 1 + (trend === "faster" ? -1 : 1) * 0.08 * (count === 1 ? 0 : index / (count - 1) * 2 - 1),
    ...(fixedSeconds[index] !== undefined ? { fixedSeconds: fixedSeconds[index] } : {}),
  })))
}

export function nearbyPaceTable(sourceSeconds: number, sourceMetres: number) {
  const pace = directPaceSeconds(sourceSeconds, sourceMetres, 1000)
  if (pace === null) return []
  return [-10, -5, 0, 5, 10].filter(offset => pace + offset > 0).map(offset => ({
    secondsPerKm: pace + offset, offset,
    seconds200: (pace + offset) / 5, seconds400: (pace + offset) * .4,
    eventSeconds: (pace + offset) * canonicalPaceDistance(sourceMetres) / 1000,
  }))
}
