import React from "react"
import { IndexCard, SectionLb } from "../components/JournalPrimitives"
import { TermHelp } from "../components/TermHelp"
import { thisWeekStats, lifetimeStats } from "../domain/aggregates"
import { cardDate, compactDate, dowOf, isoShift, seasonOf } from "../domain/dates"
import { loadEntries, todayISO } from "../domain/journal-store"
import type { JournalEntry } from "../domain/journal-store"
import { toAnalysisJournalEntry } from "../domain/safe-export"
import type { AnalysisJournalEntry } from "../domain/safe-export"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { DeviceJournal, SafeJournalExport } from "./home/DeviceJournal"
import { FirstPage } from "./home/FirstPage"

export type HomeProps = {
  readonly onWriteLog?: () => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenGuide?: () => void
}

export function Home({ onWriteLog, onOpenDay, onOpenGuide }: HomeProps) {
  const all = React.useMemo(() => loadEntries(), [])
  const analysisEntries = React.useMemo(() => {
    const projected: AnalysisJournalEntry[] = []
    for (const entry of all) {
      const analysisEntry = toAnalysisJournalEntry(entry)
      if (analysisEntry !== null) projected.push(analysisEntry)
    }
    return projected
  }, [all])
  const today = todayISO()
  const life = lifetimeStats(analysisEntries)
  const isEmpty = all.length === 0

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] mode=${isEmpty ? "empty" : "data"} total=${life.total} days=${life.days}`)
    }
  }, [isEmpty, life.total, life.days])

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ padding: "16px 18px 14px" }}>
        <IndexCard date={cardDate(today)} dow={dowOf(today)} season={seasonOf(today)} />
      </div>
      {isEmpty ? (
        <FirstPage onWriteLog={onWriteLog} onOpenGuide={onOpenGuide} />
      ) : (
        <DataHome all={all} analysisEntries={analysisEntries} onWriteLog={onWriteLog} onOpenDay={onOpenDay} onOpenGuide={onOpenGuide} />
      )}
    </div>
  )
}

type DataHomeProps = {
  readonly all: readonly JournalEntry[]
  readonly analysisEntries: readonly AnalysisJournalEntry[]
  readonly onWriteLog?: () => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenGuide?: () => void
}

function DataHome({ all, analysisEntries, onWriteLog, onOpenDay, onOpenGuide }: DataHomeProps) {
  const today = todayISO()
  const life = lifetimeStats([...analysisEntries])
  const weeklyStats = thisWeekStats([...analysisEntries])
  const hour = new Date().getHours()
  const greeting = hour < 11 ? "좋은 아침이에요." : hour < 18 ? "좋은 오후예요." : "오늘 하루 수고했어요."
  const wroteToday = all.some((entry) => entry.date === today)
  const painReviewDates = React.useMemo(() => {
    const from = isoShift(today, -6)
    const dates = all
      .filter((entry) => entry.kind === "evening" && entry.date >= from && painLevelsRequireReview(entry.painParts ?? {}))
      .map((entry) => entry.date)
    return [...new Set(dates)].sort().reverse()
  }, [all, today])

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) console.log(`[HOMEJ] painReview=${painReviewDates.length}`)
  }, [painReviewDates])

  return (
    <>
      <div style={{ padding: "6px 20px 0" }}>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500, lineHeight: 1.2, margin: 0 }}>{greeting}</h1>
        <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
          일지 <b style={{ color: "var(--ink)" }}>{life.total}</b>건 · <b style={{ color: "var(--ink)" }}>{life.days}</b>일의 기록
          {life.firstDate ? ` · ${compactDate(life.firstDate)}부터` : ""}
        </div>
      </div>

      {painReviewDates.length > 0 && (
        <div style={{ padding: "16px 20px 0" }}>
          <div data-testid="home-pain-review" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "11px 13px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--pain-5)", letterSpacing: "0.14em" }}>
              REVIEW · 최근 통증 4 이상 기록<TermHelp term="review" />
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {painReviewDates.map((date) => compactDate(date)).join(" · ")}에 강한 통증이 적혀 있어요.
              통증이 계속되면 훈련 전에 지도자·보호자와 꼭 상의해 주세요.
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "20px 20px 0" }}>
        <button type="button" onClick={onWriteLog} style={{
          width: "100%", padding: "16px 20px", background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0, fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        }}>
          <span>{wroteToday ? "오늘 일지 더 쓰기" : "오늘 일지 쓰기"}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: "0.14em" }}>훈련 후 · 회복/저녁 · 경기</span>
        </button>
      </div>

      <DeviceJournal onOpenDay={onOpenDay} />

      <div style={{ padding: "24px 0 0" }}>
        <SectionLb>— THIS WEEK</SectionLb>
        <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          <WeekCell label="거리 누적" value={weeklyStats.distanceKm > 0 ? String(weeklyStats.distanceKm) : "—"} unit="km" right border />
          <WeekCell label="세션" value={String(weeklyStats.sessions)} unit={`/ ${weeklyStats.daysLogged}d 기록`} border />
          <WeekCell label={<>RPE 평균<TermHelp term="rpe" /></>} value={weeklyStats.avgRpe !== null ? String(weeklyStats.avgRpe) : "—"} unit="/ 10" right />
          <WeekCell label="일지 쓴 날" value={String(weeklyStats.daysLogged)} unit="일" />
        </div>
        <div style={{ padding: "8px 20px 0", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)" }}>
          이번 주 월요일부터 · 이 기기에 저장된 일지 기준
        </div>
      </div>

      {life.days < 7 && (
        <div style={{ padding: "24px 20px 0" }}>
          <button type="button" onClick={onOpenGuide} style={{
            width: "100%", minHeight: 44, padding: "13px 16px", background: "transparent", color: "var(--ink-2)",
            border: "1px dashed var(--line-2)", borderRadius: 0, fontFamily: "var(--mono)", fontSize: 10.5,
            cursor: "pointer", textAlign: "left", lineHeight: 1.5,
          }}>
            쉰 날과 아픈 날도 기록이에요 · 쌓이면 어떤 모습인지 → <b style={{ color: "var(--ink)" }}>예시 보기</b>
          </button>
        </div>
      )}

      <SafeJournalExport />
    </>
  )
}

type WeekCellProps = {
  readonly label: React.ReactNode
  readonly value: string
  readonly unit: string
  readonly right?: boolean
  readonly border?: boolean
}

function WeekCell({ label, value, unit, right, border }: WeekCellProps) {
  return (
    <div style={{
      padding: right === true ? "12px 12px 12px 0" : "12px 0 12px 12px",
      borderRight: right === true ? "1px solid var(--hair)" : 0,
      borderBottom: border === true ? "1px solid var(--hair)" : 0,
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", marginTop: 4 }}>
        {value}<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}
