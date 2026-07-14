// Trends — 누적 데이터 추이. 실데이터 전용 (F0-d).
//  - 모든 수치는 로컬 저장(journal-store) 실데이터 집계 (aggregates.ts).
//  - 데모 수치 금지. 데이터가 부족하면 부족하다고 정직하게 보여준다.
//  - 균형 피드백은 주간 거리 4주 이상 쌓인 뒤에만 표시 (표시 전용, 안전 판정 아님).
import React from "react"
import type { ReactNode } from "react"
import { SectionLb } from "../components/JournalPrimitives"
import { BalanceMarker } from "../components/BalanceMarker"
import { distanceRampBalance } from "../domain/balance"
import { loadAnalysisEntries, todayISO } from "../domain/journal-store"
import type { AnalysisEveningEntry, AnalysisJournalEntry, AnalysisPostSessionEntry } from "../domain/safe-export"
import { isoShift, weekStartOf, compactDate } from "../domain/dates"
import { AccessibleTrendTable } from "./trends/AccessibleTrendTable"

export function Trends({ onBack }: { onBack?: () => void }) {
  const all = React.useMemo(() => loadAnalysisEntries(), [])
  const sessions = all.filter((entry): entry is AnalysisPostSessionEntry => entry.kind === "post-session")
  const evenings = all.filter((entry): entry is AnalysisEveningEntry => entry.kind === "evening")

  // 주간 거리 (최근 4주, 월요일 시작)
  const today = todayISO()
  const thisMon = weekStartOf(today)
  const weeks = [3, 2, 1, 0].map((back) => {
    const start = isoShift(thisMon, -7 * back)
    const end = isoShift(start, 6)
    let km = 0
    let n = 0
    for (const s of sessions) {
      if (s.date >= start && s.date <= end) {
        const d = parseFloat(s.distanceKm)
        if (Number.isFinite(d)) km += d
        n += 1
      }
    }
    return { start, km: Math.round(km * 10) / 10, sessions: n }
  })
  const weekLabels = weeks.map((w) => `${w.start.slice(5, 7)}·${w.start.slice(8)}~`)
  const weeksWithData = weeks.filter((w) => w.sessions > 0).length
  const rampHint = weeksWithData >= 4 ? distanceRampBalance(weeks.map((w) => w.km), weekLabels, "month") : null

  const totalKm = Math.round(sessions.reduce((a, s) => {
    const d = parseFloat(s.distanceKm)
    return a + (Number.isFinite(d) ? d : 0)
  }, 0) * 10) / 10

  // 감정 타임라인 (최근 28일, 하루 마무리 기준)
  const moodByDate = new Map<string, number>()
  for (const ev of evenings) moodByDate.set(ev.date, ev.mood)
  const moodDays = Array.from({ length: 28 }, (_, i) => {
    const d = isoShift(today, -(27 - i))
    return { date: d, mood: moodByDate.get(d) ?? 0 }
  })
  const moodCount = moodDays.filter((d) => d.mood > 0).length

  // 통증 (최근 12주, 하루 마무리 painParts 최대값)
  const painWeeks = Array.from({ length: 12 }, (_, i) => {
    const start = isoShift(thisMon, -7 * (11 - i))
    const end = isoShift(start, 6)
    let max = 0
    for (const ev of evenings) {
      if (ev.date >= start && ev.date <= end) {
        for (const lv of Object.values(ev.painParts ?? {})) if (lv > max) max = lv
      }
    }
    return { start, max }
  })
  const painAny = painWeeks.some((w) => w.max > 0)

  const isEmpty = all.length === 0

  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[TRENDS] mode=${isEmpty ? "empty" : "data"} sessions=${sessions.length} weeks=${weeksWithData} moodDays=${moodCount}`)
    }
  }, [isEmpty, sessions.length, weeksWithData, moodCount])

  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar3 onBack={onBack}>추이</TopBar3>

      {isEmpty ? (
        <div style={{ padding: "40px 20px" }}>
          <div className="hand" style={{ fontSize: 22, color: "var(--pencil)", lineHeight: 1.35 }}>
            추이는 일지가 쌓여야<br />그려지기 시작해요.
          </div>
          <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", lineHeight: 1.7 }}>
            훈련 후 일지 → 주간 거리 그래프<br />
            하루 마무리 → 감정·통증 타임라인<br /><br />
            일주일만 써도 첫 그래프가 생겨요.
          </div>
        </div>
      ) : (
        <>
          {/* 주간 거리 */}
          <div style={{ padding: "24px 20px 0" }}>
            <SectionLb>— DISTANCE · 최근 4주</SectionLb>
            <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0 10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.025em" }}>
                  {totalKm}<span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 400, marginLeft: 3 }}>km · 전체 누적</span>
                </span>
                <BalanceMarker hint={rampHint} />
              </div>
              {weeksWithData > 0 ? (
                <>
                  <BarChart data={weeks.map((week) => week.km)} labels={weekLabels} />
                  <AccessibleTrendTable
                    caption="주간 거리 (km)"
                    rows={weeks.map((week, index) => ({
                      key: week.start,
                      label: weekLabels[index] ?? week.start,
                      value: `${week.km} km`,
                    }))}
                  />
                </>
              ) : (
                <ThinNote>훈련 후 일지에 거리를 적으면 여기에 주간 그래프가 그려져요.</ThinNote>
              )}
            </div>
          </div>

          {/* 감정 타임라인 */}
          <div style={{ padding: "24px 20px 0" }}>
            <SectionLb>— MOOD · 28 DAYS {moodCount > 0 ? `(${moodCount}일 기록)` : ""}</SectionLb>
            {moodCount > 0 ? (
              <>
                <div
                  role="img"
                  aria-label={`최근 28일 감정 기록 ${moodCount}일. 자세한 값은 아래 표로 볼 수 있어요.`}
                  style={{ display: "grid", gridTemplateColumns: "repeat(28, 1fr)", gap: 1, padding: "10px 0" }}
                >
                  {moodDays.map((d, i) => (
                    <div key={i} title={`${compactDate(d.date)} · ${d.mood > 0 ? `기분 ${d.mood}/5` : "기록 없음"}`} style={{ height: 28, position: "relative", background: "var(--surface-2)" }}>
                      {d.mood > 0 && (
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${d.mood * 20}%`, background: `var(--mood-${d.mood})` }}></div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
                  <span>{compactDate(isoShift(today, -27)).slice(5)}</span><span>{compactDate(today).slice(5)} (오늘)</span>
                </div>
                <AccessibleTrendTable
                  caption="최근 28일 감정 기록"
                  rows={moodDays
                    .filter((day) => day.mood > 0)
                    .map((day) => ({ key: day.date, label: compactDate(day.date), value: `기분 ${day.mood}/5` }))}
                />
              </>
            ) : (
              <ThinNote>하루 마무리 일지의 감정 체크가 여기에 색으로 쌓여요.</ThinNote>
            )}
          </div>

          {/* 통증 12주 */}
          <div style={{ padding: "24px 20px 0" }}>
            <SectionLb>— PAIN · 12 WEEKS</SectionLb>
            {painAny ? (
              <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0" }}>
                <div
                  role="img"
                  aria-label="최근 12주 주간 최대 통증. 자세한 값은 아래 표로 볼 수 있어요."
                  style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2 }}
                >
                  {painWeeks.map((w, i) => (
                    <div key={i} title={`${compactDate(w.start)}~ · ${w.max > 0 ? `최대 ${w.max}/5` : "없음"}`} style={{
                      aspectRatio: "1",
                      background: w.max ? `var(--pain-${Math.min(w.max, 5)})` : "var(--surface-2)",
                      border: w.max ? 0 : "1px solid var(--hair)",
                    }}></div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
                  주 단위 최대 통증 · 참고 표시 전용
                </div>
                <AccessibleTrendTable
                  caption="최근 12주 주간 최대 통증"
                  rows={painWeeks.map((week) => ({
                    key: week.start,
                    label: `${compactDate(week.start)}~`,
                    value: week.max > 0 ? `최대 ${week.max}/5` : "없음",
                  }))}
                />
              </div>
            ) : (
              <ThinNote>통증 기록이 생기면 여기서 추이를 볼 수 있어요.</ThinNote>
            )}
          </div>

          <div style={{ padding: "24px 20px 0", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.05em", lineHeight: 1.6 }}>
            이 화면의 모든 수치는 이 기기에 저장된 일지에서만 계산돼요. 어떤 안전 판정에도 쓰이지 않아요.
          </div>
        </>
      )}
    </div>
  )
}

function ThinNote({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: "16px 14px", border: "1px dashed var(--line-2)", background: "var(--paper-2)",
      fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.03em", lineHeight: 1.6,
    }}>{children}</div>
  )
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1)
  return (
    <div
      role="img"
      aria-label={`최근 4주 거리: ${data.map((distance, index) => `${labels[index] ?? "기간"} ${distance}km`).join(", ")}. 자세한 값은 아래 표로 볼 수 있어요.`}
      style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 80, padding: "0 8px" }}
    >
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            width: "100%", background: i === data.length - 1 ? "var(--ink)" : "var(--ink-3)",
            height: `${(d / max) * 100}%`, minHeight: 4,
          }}></div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", marginTop: 5, letterSpacing: "0.06em" }}>{labels[i]}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink)", fontWeight: 500 }}>{d}<span style={{ fontSize: 8, color: "var(--ink-3)", marginLeft: 1 }}>km</span></div>
        </div>
      ))}
    </div>
  )
}

function TopBar3({ onBack, children }: { onBack?: (() => void) | undefined; children: ReactNode }) {
  return (
    <div style={{
      padding: "12px 16px", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", gap: 14,
      background: "var(--bg)",
    }}>
      <button onClick={onBack} style={{
        background: "transparent", border: 0, cursor: "pointer",
        padding: 4, marginLeft: -4,
        fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)",
        letterSpacing: "0.06em",
      }}>← 뒤로</button>
      <div style={{
        flex: 1, fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
        color: "var(--ink)", letterSpacing: "0.14em", textTransform: "uppercase",
        textAlign: "center",
      }}>{children}</div>
      <div style={{ width: 48 }}></div>
    </div>
  )
}

// 사용되지 않는 JournalEntry 타입 참조 방지용 (집계 입력 타입 문서화)
export type TrendsInput = AnalysisJournalEntry[]
