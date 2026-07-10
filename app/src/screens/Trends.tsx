// Trends — 누적 데이터 추이. 주/월/시즌/연도 토글. v3 JSX 포팅.
import React from "react"
import type { ReactNode } from "react"
import { IntensityStack, Sparkline, Delta, Stamp, SectionLb } from "../components/JournalPrimitives"
import { TermHelp } from "../components/TermHelp"
import { BalanceMarker, DemoBasisBadge } from "../components/BalanceMarker"
import { intensityBalance, distanceRampBalance, type TrendRange } from "../domain/balance"

export type TrendsVariant = "A" | "B"

export function Trends({ variant = "A", onBack }: { variant?: TrendsVariant; onBack?: () => void }) {
  if (variant === "B") return <TrendsTabbed onBack={onBack} />
  return <TrendsScroll onBack={onBack} />
}

// ───────── A. Single scroll (all metrics in one page) ─────────
function TrendsScroll({ onBack }: { onBack?: (() => void) | undefined }) {
  const [range, setRange] = React.useState<TrendRange>("month")

  // 균형 피드백 (참고 표시 전용 — 안전 판정 아님; 기준은 데모)
  const weeklyKm = [42, 38, 51, 53]
  const weekLabels = ["W22", "W23", "W24", "W25"]
  const rampHint = distanceRampBalance(weeklyKm, weekLabels, range)

  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar3 onBack={onBack}>추이</TopBar3>

      {/* Range switcher */}
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid var(--ink)" }}>
          {([
            ["week", "주"],
            ["month", "월"],
            ["season", "시즌"],
            ["year", "연도"],
          ] as const).map(([id, l], i) => (
            <button key={id} onClick={() => setRange(id)} style={{
              padding: "10px 0",
              background: range === id ? "var(--ink)" : "transparent",
              color: range === id ? "var(--bg)" : "var(--ink-2)",
              border: 0, borderRight: i < 3 ? "1px solid var(--ink)" : 0,
              fontFamily: "var(--mono)", fontSize: 11, fontWeight: 500,
              letterSpacing: "0.08em", cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em", marginTop: 8 }}>
          {range === "month" ? "2026 · 06 · 1 → 22 (오늘)" : range === "week" ? "2026 · w25 (06·16 → 06·22)" : range === "season" ? "2026 spring · 03·01 → 06·22" : "2026 (Jan → Jun)"}
        </div>
      </div>

      {/* Volume — line chart */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb action="펼치기">— DISTANCE<DemoBasisBadge /></SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.025em" }}>184.2<span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 400, marginLeft: 3 }}>km · 22 days</span></span>
            <span style={{ display: "inline-flex", alignItems: "center" }}>
              <Delta value={18.4} suffix="km vs 5월" />
              <BalanceMarker hint={rampHint} />
            </span>
          </div>
          <BarChart data={weeklyKm} labels={weekLabels} />
        </div>
      </div>

      {/* Intensity stack */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— INTENSITY DISTRIBUTION<DemoBasisBadge /></SectionLb>
        <div style={{ paddingTop: 4 }}>
          <IntensityStack data={{ base: 102, lt: 32, vo2: 28, gly: 6, rest: 16 }} height={18} />
        </div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 14px" }}>
          {([
            ["base", "BA · Base", 102, "#4A8FC7", 55],
            ["lt",   "LT · Lactate", 32, "#B8A024", 17],
            ["vo2",  "V2 · VO2", 28, "#C7761C", 15],
            ["rest", "RE · Recovery", 16, "#7A7A70", 9],
          ] as const).map(([k, n, v, c, pct]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c }}></span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.04em" }}>{n}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink)", fontWeight: 500, display: "inline-flex", alignItems: "center" }}>
                <span>{v}<span style={{ color: "var(--ink-3)", fontSize: 9, marginLeft: 2 }}>km · {pct}%</span></span>
                <BalanceMarker hint={intensityBalance(k, pct, range)} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Condition multi-line */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— CONDITION</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {[
            { lb: "Sleep", v: "7.4", u: "h avg", data: [7.2, 7.0, 7.8, 7.5, 7.4, 8.0, 7.4], delta: "+0.2", invert: false, color: "var(--info)" },
            { lb: "Resting HR", v: "49", u: "bpm", data: [50, 49, 48, 49, 50, 49, 49], delta: "-1", invert: true, color: "var(--ink)" },
            { lb: "RPE avg", v: "5.8", u: "/10", data: [5.2, 5.6, 5.8, 6.0, 5.8, 6.2, 5.8], delta: "+0.4", invert: true, color: "var(--warn)" },
            { lb: "체중", v: "53.7", u: "kg", data: [54.2, 54.0, 53.8, 53.9, 54.1, 53.8, 53.7], delta: "-0.5", invert: false, color: "var(--ink-3)" },
          ].map((r, i, a) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: 14, padding: "12px 0", alignItems: "center",
              borderBottom: i < a.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{r.lb}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>
                  {r.v}<span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{r.u}</span>
                </div>
              </div>
              <Sparkline data={r.data} width={84} height={28} color={r.color} showLast />
              <Delta value={r.delta} invert={r.invert} />
            </div>
          ))}
        </div>
      </div>

      {/* PB / SB cumulative */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— PB<TermHelp term="pb" /> · SB<TermHelp term="sb" /></SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {([
            { evt: "5000m", pb: "16:10.44", pbDate: "2025·06·22", sb: "16:14.20", sbDate: "2026·05·12", stamp: "PB · 1 YR" },
            { evt: "3000m", pb: "9:12.86",  pbDate: "2024·09·18", sb: "9:18.04",  sbDate: "2026·04·08" },
            { evt: "1500m", pb: "4:21.55",  pbDate: "2023·08·30", sb: "4:24.10",  sbDate: "2026·03·22" },
          ] as { evt: string; pb: string; pbDate: string; sb: string; sbDate: string; stamp?: string }[]).map((r, i, a) => (
            <div key={i} style={{
              padding: "14px 0",
              borderBottom: i < a.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--ink)", letterSpacing: "0.08em" }}>{r.evt}</span>
                {r.stamp && <Stamp kind="pb">{r.stamp}</Stamp>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.14em" }}>PB · ALL TIME</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 500, color: "var(--ink)", marginTop: 2 }}>{r.pb}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>{r.pbDate}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.14em" }}>SB · 2026</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 500, color: "var(--ink-2)", marginTop: 2 }}>{r.sb}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)" }}>{r.sbDate}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Injury frequency */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— INJURY · 3 MONTHS</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "14px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const lvl = i === 3 ? 1 : i === 5 ? 2 : i === 6 ? 3 : i === 7 ? 2 : i === 8 ? 1 : 0
              return (
                <div key={i} style={{
                  aspectRatio: "1",
                  background: lvl ? `var(--pain-${lvl})` : "var(--surface-2)",
                  border: lvl ? 0 : "1px solid var(--hair)",
                }} title={`W${i + 14} · ${lvl || "없음"}`}></div>
              )
            })}
          </div>
          <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
            오른 무릎 · 5주 누적 · 평균 1.8/5 · <b style={{ color: "var(--ink)" }}>2주 전부터 안정</b>
          </div>
        </div>
      </div>

      {/* Mood timeline */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— MOOD · 28 DAYS</SectionLb>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(28, 1fr)", gap: 1, padding: "10px 0" }}>
          {Array.from({ length: 28 }, (_, i) => {
            const lvls = [3, 4, 4, 3, 2, 3, 4, 4, 5, 4, 3, 3, 4, 3, 2, 2, 3, 4, 4, 4, 5, 4, 3, 4, 4, 3, 4, 3]
            const lvl = lvls[i] ?? 3
            return (
              <div key={i} style={{
                height: 28, position: "relative",
                background: "var(--surface-2)",
              }}>
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  height: `${lvl * 20}%`,
                  background: `var(--mood-${lvl})`,
                }}></div>
              </div>
            )
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
          <span>5월 25</span><span>6월 22 (오늘)</span>
        </div>
      </div>

      {/* Race results */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— RACES · 2026</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {([
            { d: "06·22", t: "전국체전 5000m", r: "16:08.24", rank: "2위", stamp: "PB" },
            { d: "05·12", t: "KAAF 5000m",    r: "16:14.20", rank: "3위" },
            { d: "04·08", t: "서울개막 3000m", r: "9:18.04",  rank: "4위" },
            { d: "03·22", t: "시즌개막 1500m", r: "4:24.10",  rank: "5위" },
          ] as { d: string; t: string; r: string; rank: string; stamp?: string }[]).map((r, i, a) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "50px 1fr auto auto",
              gap: 10, padding: "12px 0", alignItems: "baseline",
              borderBottom: i < a.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.04em" }}>{r.d}</span>
              <div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.005em" }}>{r.t}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.04em", marginTop: 2 }}>{r.rank}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{r.r}</span>
              {r.stamp && <Stamp kind="pb">{r.stamp}</Stamp>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────── B. Tab-toggle (one metric at a time) ─────────
function TrendsTabbed({ onBack }: { onBack?: (() => void) | undefined }) {
  const [tab, setTab] = React.useState("volume")
  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar3 onBack={onBack}>추이 · 탭 뷰</TopBar3>
      <div style={{ padding: "14px 16px 0", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--ink)" }}>
          {([
            ["volume", "거리"],
            ["intensity", "강도"],
            ["condition", "컨디션"],
            ["records", "기록"],
            ["mood", "감정"],
          ] as const).map(([id, l], i, a) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "10px 16px", whiteSpace: "nowrap",
              background: tab === id ? "var(--ink)" : "transparent",
              color: tab === id ? "var(--bg)" : "var(--ink-2)",
              border: 0, borderRight: i < a.length - 1 ? "1px solid var(--ink)" : 0,
              fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.08em",
              cursor: "pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "24px 20px 0", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textAlign: "center" }}>
        — 탭 별 상세 뷰. 단일 메트릭에 풀 스크린 할당. —
      </div>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em" }}>{tab === "volume" ? "184.2 km" : tab === "intensity" ? "55% Base" : tab === "condition" ? "7.4 h sleep" : tab === "records" ? "16:08 PB" : "평균 좋음"}</div>
      </div>
      <div style={{ padding: "20px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.06em" }}>
        Variant B 예시 화면 — 탭 클릭하여 다른 메트릭 확인.
      </div>
    </div>
  )
}

function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data)
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 80, padding: "0 8px" }}>
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
