// LogDetail — 하루를 펼친 일지 페이지. journal-page 미감.
// v3 JSX 포팅 + 매트릭스 반영:
//  - CONFLICT C5: IndexCard cycleDay → CycleDayLabel typed object
//  - CONFLICT C1 계열: variant B의 bare "R-7" 규칙 언급 → RuleIdLabel typed object로 백킹
//  - 사진 표시: GAP_SPEC_MISSING(미디어 계약) 수용 전 — 파일명 미표시 데모 표면 유지
import type { ReactNode } from "react"
import { IndexCard, MoodStrip, PainDot, Delta, SectionLb } from "../components/JournalPrimitives"
import { cycleDay, ruleId, formatRuleIdLabel } from "../domain/display-label"

export type LogDetailVariant = "A" | "B"

export function LogDetail({ variant = "A", onBack }: { variant?: LogDetailVariant; onBack?: () => void }) {
  if (variant === "B") return <LogDetailDashboard onBack={onBack} />
  return <LogDetailJournal onBack={onBack} />
}

// ───────── A. Journal-page (paper-feel) ─────────
function LogDetailJournal({ onBack }: { onBack?: (() => void) | undefined }) {
  return (
    <div style={{ paddingBottom: 40 }} className="paper-grid">
      <TopBar2 onBack={onBack}>일지</TopBar2>

      {/* Index card — C5: typed object + 부가 표기는 suffix로 분리 */}
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date="2026·06·21" dow="SUN · 16°C 맑음"
          cycleDay={cycleDay("D-5", { cycleNumber: 7 })} cycleSuffix="★ MAIN"
          season="2026 spring" />
      </div>

      {/* Big handwritten title */}
      <div style={{ padding: "20px 20px 0" }}>
        <div className="hand" style={{
          fontSize: 28, color: "var(--ink-blue)", lineHeight: 1.15,
        }}>드디어 사이클의 정점,<br/>그날.</div>
      </div>

      {/* Session block */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb action="편집">— TRAINING SESSION</SectionLb>
        <div style={{ background: "var(--surface)", border: "1px solid var(--ink)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className="etag vo2"><span className="d"></span><span className="c">V2</span><span className="n">VO2-Long</span></span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink)", fontWeight: 600 }}>※ MAIN</span>
          </div>
          <div style={{ fontFamily: "var(--sans)", fontSize: 17, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>
            6 × 1000m @ 3'20"
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", marginTop: 12 }}>
            {([
              ["거리", "10.4", "km"],
              ["시간", "62", "min"],
              ["평균 페이스", "3'24", "/km"],
              ["Avg HR", "182", "bpm"],
            ] as const).map(([l, v, u], i, a) => (
              <div key={i} style={{ padding: "10px 8px 10px 0", borderRight: i < a.length - 1 ? "1px solid var(--hair)" : 0, paddingLeft: i > 0 ? 8 : 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{l}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 3, letterSpacing: "-0.01em" }}>{v}<span style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{u}</span></div>
              </div>
            ))}
          </div>

          {/* Rep breakdown */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>REP × 6</div>
            <div style={{ borderTop: "1px solid var(--ink)" }}>
              {([
                ["1", "3'18\"", "178", false],
                ["2", "3'19\"", "180", false],
                ["3", "3'20\"", "182", false],
                ["4", "3'21\"", "184", false],
                ["5", "3'25\"", "186", true],
                ["6", "3'26\"", "186", true],
              ] as const).map(([n, p, h, slow], i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 1fr",
                  padding: "7px 0", borderBottom: "1px dashed var(--hair)",
                  background: slow ? "rgba(180,83,12,0.06)" : "transparent",
                  fontFamily: "var(--mono)", fontSize: 11,
                  alignItems: "baseline",
                }}>
                  <span style={{ color: "var(--ink-3)", letterSpacing: "0.06em" }}>{n}</span>
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{p}<span style={{ color: "var(--ink-3)", marginLeft: 6, fontSize: 9.5 }}>/km</span></span>
                  <span style={{ color: "var(--ink)", textAlign: "right" }}>HR {h}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--warn)", letterSpacing: "0.04em" }}>드리프트 +8" — 마지막 2 rep</div>
          </div>
        </div>
      </div>

      {/* Handwritten memo (highlighted) */}
      <div style={{ padding: "20px 20px 0" }}>
        <SectionLb>— MEMO</SectionLb>
        <div className="paper-grid" style={{ padding: "16px 18px", border: "1px solid var(--line-2)" }}>
          <div className="hand" style={{ fontSize: 19, lineHeight: 1.45, color: "var(--ink-blue)" }}>
            마지막 두 <span className="hl">rep 페이스 5초씩 떨어짐.</span> 다리 무거웠음. 햇볕 직사로 32도까지 올라간 게 컸던 듯. 4번째까지 호흡은 안정적이었는데 다리가 먼저 끊김.
          </div>
          <div className="hand-pencil" style={{ marginTop: 14, fontSize: 14, color: "var(--pencil)", borderTop: "1px dashed var(--paper-edge)", paddingTop: 10 }}>
            다음엔 PM 늦은 시간으로 옮길 것. 워밍업 5분 더.
          </div>
        </div>
      </div>

      {/* Photos with tape — 미디어 계약(ORDER_003 Task 1) 수용 전: 파일명 비노출 */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— PHOTOS</SectionLb>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { lb: "시계 화면", bg: "var(--surface-2)" },
            { lb: "트랙 사진", bg: "var(--paper-2)" },
            { lb: "랩 차트", bg: "var(--surface-2)" },
          ].map((p, i) => (
            <div key={i} style={{ flex: 1, position: "relative", paddingTop: 12 }}>
              <span className={`tape ${i % 2 ? "sage" : ""}`} style={{ top: 4, left: "30%", width: 32 }}></span>
              <div style={{
                aspectRatio: "1", background: p.bg, border: "1px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)",
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}>{p.lb}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Evening checkin row */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— EVENING CHECK-IN</SectionLb>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          {([
            ["수면", "7.5 h · 좋음", null],
            ["체중", "53.9 kg", { v: "-0.1", invert: true }],
            ["안정시 HR", "49 bpm", { v: "0", invert: true }],
            ["통증", "오른 무릎 2/5", { dot: 2 }],
            ["감정", null, { mood: 3 }],
          ] as [string, string | null, { v?: string; invert?: boolean; dot?: number; mood?: number } | null][]).map(([l, v, extra], i, a) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "90px 1fr auto",
              gap: 12, padding: "11px 14px", alignItems: "center",
              borderBottom: i < a.length - 1 ? "1px dashed var(--hair)" : 0,
              fontFamily: "var(--mono)",
            }}>
              <span style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{l}</span>
              <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{v}</span>
              <span>
                {extra?.v != null && <Delta value={extra.v} suffix="kg" invert={extra.invert ?? false} />}
                {extra?.dot && <PainDot level={extra.dot} size={10} />}
                {extra?.mood && <MoodStrip level={extra.mood} showLabel />}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer print actions */}
      <div style={{ padding: "24px 20px 8px", display: "flex", gap: 8 }}>
        <button style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid var(--ink)", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", borderRadius: 0 }}>이 페이지 인쇄</button>
        <button style={{ flex: 1, padding: 12, background: "transparent", border: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", color: "var(--ink-2)", borderRadius: 0 }}>공유</button>
      </div>
    </div>
  )
}

// ───────── B. Dashboard-style (data-first) ─────────
function LogDetailDashboard({ onBack }: { onBack?: (() => void) | undefined }) {
  // C1 계열 수정: 규칙 언급은 RULE_SPEC_D1_D9 typed object로 백킹.
  // 이 표기는 표시 전용 경고이며 어떤 안전 판정도 해제·대체하지 않는다.
  const driftRule = ruleId("R-7")
  return (
    <div style={{ paddingBottom: 30 }}>
      <TopBar2 onBack={onBack}>일지 · 데이터 뷰</TopBar2>
      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date="2026·06·21" dow="SUN"
          cycleDay={cycleDay("D-5", { cycleNumber: 7 })} cycleSuffix="★" />
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {([
            ["DISTANCE", "10.4", "km", null],
            ["DURATION", "62", "min", null],
            ["AVG HR", "182", "bpm", { delta: 4 }],
            ["RPE", "8", "/10", { delta: 1, invert: true }],
            ["DRIFT", "+8", '"', { warn: true }],
            ["TSS", "124", "", { delta: 12 }],
          ] as [string, string, string, { delta?: number; invert?: boolean; warn?: boolean } | null][]).map(([l, v, u, ex], i, a) => (
            <div key={i} style={{
              padding: "12px 12px", borderRight: i % 2 === 0 ? "1px solid var(--hair)" : 0,
              borderBottom: i < a.length - 2 ? "1px solid var(--hair)" : 0,
            }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em" }}>{l}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: ex?.warn ? "var(--warn)" : "var(--ink)", letterSpacing: "-0.02em", marginTop: 4 }}>
                {v}<span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{u}</span>
              </div>
              {ex?.delta != null && <Delta value={ex.delta} suffix={u} invert={ex.invert ?? false} />}
            </div>
          ))}
        </div>
      </div>

      {/* Rep mini chart */}
      <div style={{ padding: "24px 20px 0" }}>
        <SectionLb>— 6 × 1000m · PACE PER REP</SectionLb>
        <div style={{ borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
            {[200, 201, 200, 201, 205, 206].map((p, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  width: "100%", background: i >= 4 ? "var(--warn)" : "var(--ink)",
                  height: `${(p - 195) * 8}px`, minHeight: 8,
                }}></div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)", marginTop: 4 }}>{i + 1}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink)", fontWeight: 500 }}>3'{p % 100 < 10 ? "0" + (p % 100) : p % 100}"</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.5, padding: 12, background: "var(--surface-2)" }}>
          <b style={{ color: "var(--ink)" }}>드리프트</b> rep 4→5에서 +4", 5→6에서 +1". 권고 ±3" 초과 — <b style={{ color: "var(--warn)" }}>{formatRuleIdLabel(driftRule)} 경고</b>.
        </div>
      </div>
    </div>
  )
}

function TopBar2({ onBack, children }: { onBack?: (() => void) | undefined; children: ReactNode }) {
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
      <div style={{ width: 48, textAlign: "right" }}>
        <button style={{
          background: "transparent", border: 0, cursor: "pointer",
          fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)",
          letterSpacing: "0.06em", padding: 4,
        }}>···</button>
      </div>
    </div>
  )
}
