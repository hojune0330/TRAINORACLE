// Home — 모바일 메인. "오늘 일지 쓰기 CTA + 어제 요약" 우선.
// 3 variants: A. Index-card top, B. Sparkline-heavy, C. Recall-strong
//
// CONFLICT C5 수정: cycleDay prop은 bare string이 아닌 CycleDayLabel typed object.
// 매트릭스 권고: "namespace: CYCLE_DAY, value: D-5, isRuleId: false" 백킹 후
// 짧은 표시 라벨은 최종 UI 계층에서만 렌더.
import { IndexCard, MoodStrip, IntensityDots, IntensityStack, Stamp, PainDot, Sparkline, Delta, SectionLb } from "../components/JournalPrimitives"
import { cycleDay } from "../domain/display-label"
import type { EnergyDist } from "../components/JournalPrimitives"

export type HomeVariant = "A" | "B" | "C"
export type Encoding = "dot-code" | "chip" | "glyph"

export interface HomeProps {
  variant?: HomeVariant
  encoding?: Encoding
  showAI?: boolean
  onWriteLog?: () => void
  onOpenDay?: (date: string) => void
}

export function Home({ variant = "A", showAI = true, onWriteLog, onOpenDay }: HomeProps) {
  if (variant === "B") return <HomeSparkline onWriteLog={onWriteLog} onOpenDay={onOpenDay} />
  if (variant === "C") return <HomeRecall onWriteLog={onWriteLog} onOpenDay={onOpenDay} />
  return <HomeIndexCard onWriteLog={onWriteLog} onOpenDay={onOpenDay} showAI={showAI} />
}

type SubProps = {
  onWriteLog?: (() => void) | undefined
  onOpenDay?: ((date: string) => void) | undefined
  showAI?: boolean
}

// ───────── A. Index Card top (most journal-like) ─────────
function HomeIndexCard({ onWriteLog, onOpenDay, showAI }: SubProps) {
  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Index card header — C5: typed CycleDayLabel */}
      <div style={{ padding: "16px 18px 14px" }}>
        <IndexCard
          date="2026 · 06 · 22"
          dow="MON · 15°C 흐림"
          cycleDay={cycleDay("D-6", { cycleNumber: 7, cycleLength: 9.5 })}
          season="2026 spring"
        />
      </div>

      {/* Greeting + write CTA */}
      <div style={{ padding: "6px 20px 0" }}>
        <h1 style={{
          fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500,
          letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0,
        }}>민지, 좋은 아침이에요.</h1>
        <div style={{
          marginTop: 4, fontFamily: "var(--mono)", fontSize: 10.5,
          color: "var(--ink-3)", letterSpacing: "0.06em",
        }}>오늘로 <b style={{ color: "var(--ink)" }}>184</b>일째 · 마지막 일지 어제</div>
      </div>

      {/* Yesterday recap card */}
      <div style={{ padding: "20px 20px 0" }}>
        <SectionLb action="펼치기" onAction={() => onOpenDay?.("2026-06-21")}>— 어제 · 06·21 SUN</SectionLb>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div className="paper-grid" style={{
          border: "1px solid var(--line)",
          padding: 14, position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="etag vo2"><span className="d"></span><span className="c">V2</span></span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink)", fontWeight: 600 }}>※ MAIN</span>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)" }}>62 min · 10.4km</span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>
            6 × 1000m @ 3'20"
          </div>
          <div className="hand" style={{
            marginTop: 10, fontSize: 18, lineHeight: 1.35,
            color: "var(--ink-blue)", borderTop: "1px dashed var(--paper-edge)", paddingTop: 8,
          }}>
            마지막 두 rep 페이스 5초씩 떨어짐. 다리 무거웠음.
          </div>
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--paper-edge)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)",
          }}>
            <span>RPE <b style={{ color: "var(--ink)" }}>8</b></span>
            <span>HR <b style={{ color: "var(--ink)" }}>182</b></span>
            <MoodStrip level={3} showLabel />
          </div>
        </div>
      </div>

      {/* Write today CTA */}
      <div style={{ padding: "24px 20px 0" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "16px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0,
          fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500,
          letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}>
          <span>오늘 일지 쓰기</span>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)",
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>훈련 후 · 저녁 · 경기</span>
        </button>
      </div>

      {/* Weekly mini summary */}
      <div style={{ padding: "24px 0 0" }}>
        <SectionLb action="이번 주">— THIS WEEK</SectionLb>
        <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>거리 누적</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 4 }}>42.8<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>km</span></div>
            <Delta value={4.2} suffix="km vs 지난주" />
          </div>
          <div style={{ padding: "12px 0 12px 12px", borderBottom: "1px solid var(--hair)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>세션</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 4 }}>5<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>/ 7d</span></div>
            <Delta value={1} suffix=" vs 지난주" />
          </div>
          <div style={{ padding: "12px 12px 12px 0", borderRight: "1px solid var(--hair)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>RPE 평균</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 4 }}>5.8<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>/ 10</span></div>
            <Delta value="-0.2" suffix=" vs 지난주" invert />
          </div>
          <div style={{ padding: "12px 0 12px 12px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>강도 분포</div>
            <div style={{ marginTop: 8 }}>
              <IntensityStack data={{ base: 58, lt: 18, vo2: 14, rest: 10 }} height={10} />
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.06em" }}>BA 58 · LT 18 · V2 14</div>
          </div>
        </div>
      </div>

      {/* AI insight (optional) — GAP_UI 대응: 출처·불확실성 표기 유지 */}
      {showAI && (
        <div style={{ padding: "24px 20px 0" }}>
          <SectionLb>— THIS WEEK · PATTERN</SectionLb>
          <div style={{ padding: "0 0 0 12px", borderLeft: "2px solid var(--brand)" }}>
            <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5, letterSpacing: "-0.005em" }}>
              월·화 연속 강도 세션 후 <span className="hl">수요일 RPE 평균 +1.2</span>. 지난 3주 동일 패턴.
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.04em" }}>
              장호준 AI · 신뢰도 78% · 3주 데이터
            </div>
          </div>
        </div>
      )}

      {/* 1년 전 오늘 */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— 1 YEAR AGO TODAY</SectionLb>
        <div onClick={() => onOpenDay?.("2025-06-22")} style={{
          padding: 12, border: "1px dashed var(--line-2)",
          background: "var(--paper-2)",
          cursor: "pointer",
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em" }}>2025·06·22 SUN</div>
          <div className="hand" style={{ marginTop: 6, fontSize: 16, color: "var(--ink-blue)", lineHeight: 1.3 }}>
            처음 16분대 깬 날. 5000m 16:42.
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Stamp kind="pb">PB · 5000m</Stamp>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink)", fontWeight: 600 }}>16:42.18</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────── B. Sparkline-heavy (data first) ─────────
function HomeSparkline({ onWriteLog, onOpenDay }: SubProps) {
  const wk = [38.2, 42.1, 40.5, 45.8, 43.2, 38.6, 42.8]
  const rpe = [5.2, 5.8, 6.1, 5.6, 5.9, 6.4, 5.8]
  const wt = [54.2, 54.0, 53.8, 53.9, 54.1, 53.8, 53.7]
  const rows: { lb: string; v: string; u: string; data: number[]; d: number; dsuf: string; invert?: boolean }[] = [
    { lb: "주간 거리", v: "42.8", u: "km", data: wk, d: 4.2, dsuf: "km" },
    { lb: "RPE 평균", v: "5.8", u: "/10", data: rpe, d: -0.2, dsuf: "", invert: true },
    { lb: "체중", v: "53.7", u: "kg", data: wt, d: -0.5, dsuf: "kg", invert: false },
  ]
  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <span style={{ display: "inline-block", width: 5, height: 5, background: "var(--brand)", borderRadius: "50%", marginRight: 6 }}></span>
          {/* C3/C5 계열 수정: bare "D-184" 표기 제거 — 네임스페이스 없는 D-*는 금지.
              의미(연속 기록 일수)를 그대로 명시적 라벨로 표기 */}
          2026·06·22 MON · DAY 184
        </div>
        <h1 style={{ fontFamily: "var(--sans)", fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", margin: "4px 0 0" }}>민지</h1>
      </div>

      {/* Trend strip */}
      <div style={{ padding: "20px 0 0" }}>
        <SectionLb action="자세히 →">— 7-DAY TRENDS</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", margin: "0 20px" }}>
          {rows.map((r, i, arr) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              gap: 14, padding: "14px 0", alignItems: "center",
              borderBottom: i < arr.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{r.lb}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 2 }}>
                  {r.v}<span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{r.u}</span>
                </div>
              </div>
              <Sparkline data={r.data} width={92} height={28} showLast />
              <Delta value={r.d} suffix={r.dsuf} invert={r.invert ?? false} />
            </div>
          ))}
        </div>
      </div>

      {/* Yesterday compact */}
      <div style={{ padding: "20px 20px 0" }}>
        <SectionLb action="펼치기" onAction={() => onOpenDay?.("2026-06-21")}>— 어제</SectionLb>
        <div style={{ padding: 12, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="etag vo2"><span className="d"></span><span className="c">V2</span></span>
              <span style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 500 }}>6 × 1000m @ 3'20"</span>
            </span>
            <MoodStrip level={3} />
          </div>
        </div>
      </div>

      {/* Write CTA */}
      <div style={{ padding: "24px 20px 0" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "16px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer",
        }}>
          오늘 일지 쓰기 <span style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.7, letterSpacing: "0.14em" }}>NEW</span>
        </button>
      </div>
    </div>
  )
}

// ───────── C. Recall-strong (history surfaces first) ─────────
function HomeRecall({ onWriteLog, onOpenDay }: SubProps) {
  const memories: { y: string; date: string; t: string; stamp?: string; pain?: number; dist?: EnergyDist }[] = [
    { y: "1년 전", date: "2025·06·22", t: "5000m 처음 16분대 — 16:42", stamp: "PB", dist: { vo2: 1 } },
    { y: "2년 전", date: "2024·06·22", t: "오른 무릎 통증 시작. Z2로 전환", pain: 3 },
    { y: "3년 전", date: "2023·06·22", t: "첫 트랙 미팅 출전 — 1500m", stamp: "DEBUT" },
  ]
  return (
    <div style={{ paddingBottom: 90 }}>
      <div className="paper-lines" style={{ padding: "20px 20px 16px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          2026·06·22 MON
        </div>
        <div className="hand" style={{
          marginTop: 12, fontSize: 28, color: "var(--ink-blue)", lineHeight: 1.2,
        }}>안녕, 민지.</div>
        <div className="hand-pencil" style={{
          marginTop: 4, fontSize: 16, color: "var(--pencil)",
        }}>오늘은 어떤 하루였나요?</div>
      </div>

      {/* Big CTA */}
      <div style={{ padding: "20px" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "22px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, fontFamily: "var(--sans)", fontSize: 17, fontWeight: 500,
          letterSpacing: "-0.005em",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
          cursor: "pointer",
        }}>
          <span>일지 펼치기</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "rgba(255,255,255,.65)", letterSpacing: "0.06em", fontWeight: 400 }}>훈련 후 · 하루 마무리 · 경기 직전/직후</span>
        </button>
      </div>

      {/* Memory rows */}
      <SectionLb>— ON THIS DAY</SectionLb>
      <div style={{ padding: "0 20px" }}>
        {memories.map((m, i) => (
          <div key={i} onClick={() => onOpenDay?.(m.date)} style={{
            padding: "14px 0",
            borderBottom: "1px dashed var(--hair)",
            cursor: "pointer",
          }}>
            <div style={{
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)",
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4,
            }}>{m.y} · {m.date}</div>
            <div className="hand" style={{ fontSize: 17, color: "var(--ink-blue)", lineHeight: 1.25 }}>{m.t}</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              {m.stamp && <Stamp kind={m.stamp === "PB" ? "pb" : "sb"}>{m.stamp}</Stamp>}
              {m.pain && <><PainDot level={m.pain} /> <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>통증 {m.pain}/5</span></>}
              {m.dist && <IntensityDots dist={m.dist} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
