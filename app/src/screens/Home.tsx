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
import { DataSafetyNotice } from "../components/DataSafetyNotice"
import { DeviceJournal, SafeJournalExport } from "./home/DeviceJournal"
import { TrashBin } from "./home/TrashBin"
import { EngagementStrip } from "./home/EngagementStrip"
import { EmptyJournalHome, FirstPage } from "./home/FirstPage"
import type { JournalEntryType } from "./log-entry/shared"
import { engagementSummary } from "../domain/engagement"
import { DailyContextTags } from "./home/DailyContextTags"
import { WeekCell } from "./home/WeekCell"

export type HomeProps = {
  readonly onWriteLog?: (entryType?: JournalEntryType) => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  /** 계정 기능 flag ON일 때만 전달됨 — 없으면 버튼 미노출 */
  readonly onOpenAccount?: () => void
  /** 내려받은 백업 되돌리기 — 계정 불필요, 모든 상황에서 열림 */
  readonly onOpenRestore?: () => void
  readonly firstVisitActive?: boolean
  readonly onDismissFirstVisit?: () => void
}

export function Home({
  onWriteLog,
  onOpenDay,
  onOpenArchive,
  onOpenGuide,
  onOpenPlan,
  onOpenAccount,
  onOpenRestore,
  firstVisitActive = true,
  onDismissFirstVisit,
}: HomeProps) {
  // 휴지통에서 되돌리면 일지가 늘어난다. rev 없이 `useMemo(…, [])`로 두면
  // 되돌렸는데 홈 목록·통계가 그대로여서 "안 돌아왔다"로 보인다(e2e에서 확인).
  const [rev, setRev] = React.useState(0)
  const all = React.useMemo(() => loadEntries(), [rev])
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
  const engagement = engagementSummary(
    all.map((entry) => ({ date: entry.date, kind: entry.kind })),
    today,
  )

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] mode=${isEmpty ? "empty" : "data"} total=${life.total} days=${life.days}`)
    }
  }, [isEmpty, life.total, life.days])

  return (
    <div
      className={isEmpty && firstVisitActive ? "home-screen--first-visit" : undefined}
      style={{ paddingBottom: isEmpty ? 0 : 90 }}
    >
      {!(isEmpty && firstVisitActive) && (
        <div style={{ padding: "16px 18px 14px", position: "relative" }}>
          <IndexCard date={cardDate(today)} dow={dowOf(today)} season={seasonOf(today)} />
          {onOpenAccount && (
            <button
              type="button"
              onClick={onOpenAccount}
              aria-label="계정과 백업"
              style={{
                position: "absolute", top: 16, right: 18,
                minWidth: 44, minHeight: 44, padding: "0 10px",
                fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.08em",
                color: "var(--ink-2)", background: "transparent",
                border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer",
              }}
            >
              계정
            </button>
          )}
        </div>
      )}
      {!(isEmpty && firstVisitActive) && <DailyContextTags date={today} />}
      {isEmpty ? (
        firstVisitActive ? (
          <FirstPage
            onWriteLog={onWriteLog}
            onOpenPlan={onOpenPlan}
            onDismiss={onDismissFirstVisit}
            oraclePoints={engagement.points}
          />
        ) : (
          <EmptyJournalHome
            onWriteLog={onWriteLog}
            onOpenPlan={onOpenPlan}
            onOpenRestore={onOpenRestore}
            oraclePoints={engagement.points}
          />
        )
      ) : (
        <DataHome
          all={all}
          analysisEntries={analysisEntries}
          onWriteLog={onWriteLog}
          onOpenDay={onOpenDay}
          onOpenArchive={onOpenArchive}
          onOpenGuide={onOpenGuide}
          onOpenPlan={onOpenPlan}
          onOpenAccount={onOpenAccount}
          onOpenRestore={onOpenRestore}
          engagement={engagement}
        />
      )}

      {/*
        휴지통은 빈 화면/데이터 화면 **양쪽 바깥**에 둔다.
        e2e에서 실제 결함을 잡았다: DataHome 안에 두면 마지막 일지를 지운 순간
        홈이 "빈 화면" 분기로 넘어가 휴지통이 사라진다. 되돌리기가 가장 필요한
        상황(하나 남은 일지를 실수로 지움)에서 정확히 닿을 수 없게 된다.
        분기 조건을 붙이지 않는다: `TrashBin`은 휴지통이 비어 있으면 스스로
        아무것도 렌더하지 않으므로, "비어 있을 땐 감춘다"는 판단이 이미 안에 있다.
        여기서 화면 상태로 한 번 더 가드를 걸면(첫 방문 등) 휴지통에 항목이
        있는데도 닿을 수 없는 경우가 생긴다 — e2e에서 실제로 그렇게 실패했다.
      */}
      <div style={{ paddingBottom: isEmpty ? 40 : 0 }}>
        <TrashBin onChanged={() => setRev((value) => value + 1)} />
      </div>
    </div>
  )
}

type DataHomeProps = {
  readonly all: readonly JournalEntry[]
  readonly analysisEntries: readonly AnalysisJournalEntry[]
  readonly onWriteLog?: () => void
  readonly onOpenDay?: (date: string) => void
  readonly onOpenArchive?: () => void
  readonly onOpenGuide?: () => void
  readonly onOpenPlan?: () => void
  readonly onOpenAccount?: () => void
  readonly onOpenRestore?: () => void
  readonly engagement: ReturnType<typeof engagementSummary>
}

function DataHome({ all, analysisEntries, onWriteLog, onOpenDay, onOpenArchive, onOpenGuide, onOpenPlan, onOpenAccount, onOpenRestore, engagement }: DataHomeProps) {
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

      <div className="home-plan-entry">
        <button
          className="home-plan-action"
          type="button"
          onClick={onOpenPlan}
        >
          <span>훈련계획 후보 만들기</span>
          <small>일지가 적어도 시작 가능 · 기본은 9일과 10일을 번갈아 쓰는 9.5일 틀</small>
        </button>
      </div>

      <EngagementStrip summary={engagement} />

      <DataSafetyNotice onOpenAccount={onOpenAccount} />

      <DeviceJournal onOpenDay={onOpenDay} onOpenArchive={onOpenArchive} />

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

      <SafeJournalExport onOpenRestore={onOpenRestore} />
    </>
  )
}
