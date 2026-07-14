// aggregates — 로컬 일지 실데이터 집계 (홈 THIS WEEK · 추이 화면용, F0-d).
// 원칙:
//  - 입력은 journal-store의 로컬 엔트리뿐. 서버·데모 수치 혼입 금지.
//  - 표시 전용 계산 — 어떤 안전 판정에도 쓰지 않는다.
//  - 숫자 파싱 실패(빈 입력 등)는 0이 아니라 "제외"로 처리해 평균이 왜곡되지 않게 한다.

import { loadAnalysisEntries, todayISO } from "./journal-store"
import type { AnalysisJournalEntry, AnalysisPostSessionEntry } from "./safe-export"
import { isoShift, weekStartOf } from "./dates"

export interface WeekStats {
  /** 이번 주(월요일 시작) 훈련 세션 수 */
  sessions: number
  /** 거리 합 (km) — 파싱 가능한 값만 */
  distanceKm: number
  /** RPE 평균 — 훈련 후 일지 기준, 소수 1자리 */
  avgRpe: number | null
  /** 일지를 쓴 날짜 수 (종류 무관, 유니크 날짜) */
  daysLogged: number
}

function num(v: string): number | null {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

function isPostSession(entry: AnalysisJournalEntry): entry is AnalysisPostSessionEntry {
  return entry.kind === "post-session"
}

/** [fromISO, toISO] 폐구간의 엔트리 */
export function entriesBetween(fromISO: string, toISO: string, all?: AnalysisJournalEntry[]): AnalysisJournalEntry[] {
  const src = all ?? loadAnalysisEntries()
  return src.filter((e) => e.date >= fromISO && e.date <= toISO)
}

/** 이번 주(월~오늘) 통계 */
export function thisWeekStats(all?: AnalysisJournalEntry[]): WeekStats {
  const today = todayISO()
  const start = weekStartOf(today)
  const wk = entriesBetween(start, today, all)
  const sessions = wk.filter(isPostSession)
  let dist = 0
  let rpeSum = 0
  let rpeN = 0
  for (const s of sessions) {
    const d = num(s.distanceKm)
    if (d !== null) dist += d
    if (Number.isFinite(s.rpe) && s.rpe > 0) { rpeSum += s.rpe; rpeN += 1 }
  }
  return {
    sessions: sessions.length,
    distanceKm: Math.round(dist * 10) / 10,
    avgRpe: rpeN > 0 ? Math.round((rpeSum / rpeN) * 10) / 10 : null,
    daysLogged: new Set(wk.map((e) => e.date)).size,
  }
}

/** 전체 누적: 총 일지 수·유니크 날짜 수·첫 기록일 */
export function lifetimeStats(all?: AnalysisJournalEntry[]): { total: number; days: number; firstDate: string | null } {
  const src = all ?? loadAnalysisEntries()
  const dates = [...new Set(src.map((e) => e.date))].sort()
  return { total: src.length, days: dates.length, firstDate: dates[0] ?? null }
}

/** 최근 n일 일자별 거리(km) — 스파크라인용. 데이터 없는 날은 0. */
export function dailyDistance(nDays: number, all?: AnalysisJournalEntry[]): { labels: string[]; values: number[] } {
  const src = (all ?? loadAnalysisEntries()).filter(isPostSession)
  const today = todayISO()
  const labels: string[] = []
  const values: number[] = []
  for (let i = nDays - 1; i >= 0; i--) {
    const day = isoShift(today, -i)
    labels.push(day.slice(5).replace("-", "·"))
    let v = 0
    for (const s of src) {
      if (s.date === day) {
        const d = num(s.distanceKm)
        if (d !== null) v += d
      }
    }
    values.push(Math.round(v * 10) / 10)
  }
  return { labels, values }
}
