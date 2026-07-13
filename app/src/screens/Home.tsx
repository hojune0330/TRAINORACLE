// Home — 모바일 메인. 실데이터 전용 (F0-d).
//  - 이 화면의 모든 숫자·문장은 로컬 저장(journal-store) 실데이터에서만 나온다.
//  - 데모 인물·데모 수치 금지. 예시는 Guide 화면에만 존재.
//  - 일지가 하나도 없으면 "첫 페이지" 온보딩을 보여준다 (흥미 유발, 강요 없음).
import React from "react"
import { IndexCard, SectionLb } from "../components/JournalPrimitives"
import { TermHelp } from "../components/TermHelp"
import type { JournalEntry } from "../domain/journal-store"
import { recentEntries, loadEntries, exportEntriesJSON } from "../domain/journal-store"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { isoShift } from "../domain/dates"
import { thisWeekStats, lifetimeStats } from "../domain/aggregates"
import { cardDate, dowOf, seasonOf, compactDate } from "../domain/dates"
import { todayISO } from "../domain/journal-store"

export interface HomeProps {
  onWriteLog?: () => void
  onOpenDay?: (date: string) => void
  onOpenGuide?: () => void
}

export function Home({ onWriteLog, onOpenDay, onOpenGuide }: HomeProps) {
  const all = React.useMemo(() => loadEntries(), [])
  const today = todayISO()
  const life = lifetimeStats(all)
  const isEmpty = life.total === 0

  // ?uitest 런타임 증거: 홈이 실데이터 기준으로 무엇을 렌더했는지
  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] mode=${isEmpty ? "empty" : "data"} total=${life.total} days=${life.days}`)
    }
  }, [isEmpty, life.total, life.days])

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Index card header — 실제 오늘 날짜 */}
      <div style={{ padding: "16px 18px 14px" }}>
        <IndexCard date={cardDate(today)} dow={dowOf(today)} season={seasonOf(today)} />
      </div>

      {isEmpty ? (
        <FirstPage onWriteLog={onWriteLog} onOpenGuide={onOpenGuide} />
      ) : (
        <DataHome all={all} onWriteLog={onWriteLog} onOpenDay={onOpenDay} onOpenGuide={onOpenGuide} />
      )}
    </div>
  )
}

// ───────── 첫 페이지 (일지 0건) — 초대장 ─────────
function FirstPage({ onWriteLog, onOpenGuide }: { onWriteLog?: (() => void) | undefined; onOpenGuide?: (() => void) | undefined }) {
  return (
    <>
      <div className="paper-lines" style={{ padding: "26px 20px 22px", margin: "6px 20px 0", border: "1px solid var(--line)" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          PAGE 1 · 아직 아무것도 없는
        </div>
        <div className="hand" style={{ marginTop: 12, fontSize: 27, color: "var(--ink-blue)", lineHeight: 1.25 }}>
          여기는 당신의<br />첫 페이지예요.
        </div>
        <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65, letterSpacing: "-0.005em" }}>
          오늘 뛴 것, 잔 시간, 기분 한 줄 — 뭐든 1분이면 적혀요.
          하루하루는 짧은 메모지만, 계속 쌓이면 <b style={{ color: "var(--ink)" }}>나만 아는 나의 기록</b>이 됩니다.
        </div>
        <div className="hand-pencil" style={{ marginTop: 12, fontSize: 15, color: "var(--pencil)" }}>
          1년 뒤 오늘, 이 페이지를 다시 펼치게 될 거예요.
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "18px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0,
          fontFamily: "var(--sans)", fontSize: 16, fontWeight: 500,
          letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}>
          <span>첫 일지 쓰기</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>~ 1분</span>
        </button>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <button onClick={onOpenGuide} style={{
          width: "100%", padding: "13px 16px",
          background: "transparent", color: "var(--ink-2)",
          border: "1px dashed var(--line-2)", borderRadius: 0,
          fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.06em",
          cursor: "pointer", textAlign: "left",
        }}>
          일지가 쌓이면 어떤 모습이 되나요? → <b style={{ color: "var(--ink)" }}>예시 보기</b>
        </button>
      </div>

      <div style={{ padding: "26px 20px 0" }}>
        <SectionLb>— 세 가지 일지</SectionLb>
        <div style={{ margin: "0 0", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          {[
            { mark: "↻", t: "훈련 후", d: "방금 끝낸 세션 · 거리·페이스·한 줄 메모", m: "~1분" },
            { mark: "☾", t: "하루 마무리", d: "수면·체중·기분·통증 체크", m: "~2분" },
            { mark: "▲", t: "경기", d: "직전 긴장도 · 직후 기록과 감정", m: "~30초" },
          ].map((o, i, a) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "30px 1fr auto", gap: 12,
              padding: "13px 4px", alignItems: "center",
              borderBottom: i < a.length - 1 ? "1px dashed var(--hair)" : 0,
            }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 19, color: "var(--brand)", lineHeight: 1 }}>{o.mark}</span>
              <div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{o.t}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.03em", marginTop: 2 }}>{o.d}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.1em" }}>{o.m}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          회원가입 없이 시작돼요. 일지는 이 기기에 저장됩니다.
        </div>
      </div>
    </>
  )
}

// ───────── 데이터 홈 (일지 1건 이상) ─────────
function DataHome({ all, onWriteLog, onOpenDay, onOpenGuide }: {
  all: JournalEntry[]
  onWriteLog?: (() => void) | undefined
  onOpenDay?: ((date: string) => void) | undefined
  onOpenGuide?: (() => void) | undefined
}) {
  const today = todayISO()
  const life = lifetimeStats(all)
  const wk = thisWeekStats(all)
  const hour = new Date().getHours()
  const greet = hour < 11 ? "좋은 아침이에요." : hour < 18 ? "좋은 오후예요." : "오늘 하루 수고했어요."
  const wroteToday = all.some((e) => e.date === today)
  // 최근 7일 내 통증 4~5 기록 — 저장 후에도 놓치지 않도록 홈에서 지속 표시
  const painReviewDates = React.useMemo(() => {
    const from = isoShift(today, -6)
    const dates = all
      .filter((e) => e.kind === "evening" && e.date >= from && painLevelsRequireReview(e.painParts ?? {}))
      .map((e) => e.date)
    return [...new Set(dates)].sort().reverse()
  }, [all, today])
  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] painReview=${painReviewDates.length}`)
    }
  }, [painReviewDates])

  return (
    <>
      {/* Greeting — 실데이터 누적만 언급 */}
      <div style={{ padding: "6px 20px 0" }}>
        <h1 style={{
          fontFamily: "var(--sans)", fontSize: 22, fontWeight: 500,
          letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0,
        }}>{greet}</h1>
        <div style={{
          marginTop: 4, fontFamily: "var(--mono)", fontSize: 10.5,
          color: "var(--ink-3)", letterSpacing: "0.06em",
        }}>
          일지 <b style={{ color: "var(--ink)" }}>{life.total}</b>건 · <b style={{ color: "var(--ink)" }}>{life.days}</b>일의 기록
          {life.firstDate ? ` · ${compactDate(life.firstDate)}부터` : ""}
        </div>
      </div>

      {/* 통증 REVIEW 지속 표시 — 최근 7일 */}
      {painReviewDates.length > 0 && (
        <div style={{ padding: "16px 20px 0" }}>
          <div data-testid="home-pain-review" style={{ border: "1px solid var(--pain-5)", background: "var(--surface)", padding: "11px 13px" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--pain-5)", letterSpacing: "0.14em" }}>
              REVIEW · 최근 통증 4 이상 기록<TermHelp term="review" />
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.03em", lineHeight: 1.6 }}>
              {painReviewDates.map((d) => compactDate(d)).join(" · ")}에 강한 통증이 적혀 있어요.
              통증이 계속되면 훈련 전에 지도자·보호자와 꼭 상의해 주세요.
            </div>
          </div>
        </div>
      )}

      {/* Write today CTA */}
      <div style={{ padding: "20px 20px 0" }}>
        <button onClick={onWriteLog} style={{
          width: "100%", padding: "16px 20px",
          background: "var(--ink)", color: "var(--bg)",
          border: 0, borderRadius: 0,
          fontFamily: "var(--sans)", fontSize: 15, fontWeight: 500,
          letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}>
          <span>{wroteToday ? "오늘 일지 더 쓰기" : "오늘 일지 쓰기"}</span>
          <span style={{
            fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,.7)",
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>훈련 후 · 저녁 · 경기</span>
        </button>
      </div>

      {/* 이 기기의 일지 — 로컬 실데이터 */}
      <MyDeviceJournal onOpenDay={onOpenDay} />

      {/* THIS WEEK — 실데이터 집계 */}
      <div style={{ padding: "24px 0 0" }}>
        <SectionLb>— THIS WEEK</SectionLb>
        <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
          <WeekCell lb="거리 누적" v={wk.distanceKm > 0 ? String(wk.distanceKm) : "—"} u="km" right border />
          <WeekCell lb="세션" v={String(wk.sessions)} u={`/ ${wk.daysLogged}d 기록`} border />
          <WeekCell lb={<>RPE 평균<TermHelp term="rpe" /></>} v={wk.avgRpe !== null ? String(wk.avgRpe) : "—"} u="/ 10" right />
          <WeekCell lb="일지 쓴 날" v={String(wk.daysLogged)} u="일" />
        </div>
        <div style={{ padding: "8px 20px 0", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.05em" }}>
          이번 주 월요일부터 · 이 기기에 저장된 일지 기준
        </div>
      </div>

      {/* Guide nudge — 데이터가 적을 때만 */}
      {life.days < 7 && (
        <div style={{ padding: "24px 20px 0" }}>
          <button onClick={onOpenGuide} style={{
            width: "100%", padding: "13px 16px",
            background: "transparent", color: "var(--ink-2)",
            border: "1px dashed var(--line-2)", borderRadius: 0,
            fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.05em",
            cursor: "pointer", textAlign: "left", lineHeight: 1.5,
          }}>
            {7 - life.days}일만 더 쓰면 한 주가 채워져요 · 쌓이면 어떤 모습인지 → <b style={{ color: "var(--ink)" }}>예시 보기</b>
          </button>
        </div>
      )}

      {/* 내 데이터 통제 — 내보내기 (파일 다운로드, 기기 밖 전송 없음) */}
      <div style={{ padding: "28px 20px 0" }}>
        <button onClick={downloadJournalExport} style={{
          background: "transparent", border: 0, cursor: "pointer", padding: 0,
          fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)",
          letterSpacing: "0.08em", textDecoration: "underline", textUnderlineOffset: 3,
        }}>내 일지 데이터 내려받기 (JSON)</button>
        <div style={{ marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.04em" }}>
          파일이 이 기기에만 저장돼요 · 어디로도 전송되지 않아요
        </div>
      </div>
    </>
  )
}

function downloadJournalExport() {
  try {
    // F0-f-3 (R-privacy-001): 메모 원문은 기본 제외. 포함은 명시적 선택 + 경고.
    const includeMemo = window.confirm(
      "일기 메모 원문도 파일에 포함할까요?\n\n" +
      "[확인] 포함 — 파일을 다른 사람과 공유하면 메모 내용이 그대로 보여요.\n" +
      "[취소] 제외(권장) — 훈련 수치만 내보내요.",
    )
    const blob = new Blob([exportEntriesJSON({ includeMemo })], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trainoracle-journal-${todayISO()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    if (window.location.search.includes("uitest")) console.log(`[JEXPORT] ok=true memoIncluded=${includeMemo}`)
  } catch {
    if (window.location.search.includes("uitest")) console.log("[JEXPORT] ok=false")
    window.alert("내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.")
  }
}

function WeekCell({ lb, v, u, right, border }: { lb: React.ReactNode; v: string; u: string; right?: boolean; border?: boolean }) {
  return (
    <div style={{
      padding: right ? "12px 12px 12px 0" : "12px 0 12px 12px",
      borderRight: right ? "1px solid var(--hair)" : 0,
      borderBottom: border ? "1px solid var(--hair)" : 0,
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{lb}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 4 }}>
        {v}<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{u}</span>
      </div>
    </div>
  )
}

// ───────── 이 기기의 일지 (로컬 실데이터) ─────────
const KIND_META: Record<JournalEntry["kind"], { label: string; mark: string }> = {
  "post-session": { label: "훈련 후", mark: "↻" },
  "evening": { label: "하루 마무리", mark: "☾" },
  "race": { label: "경기", mark: "▲" },
}

function entryHeadline(e: JournalEntry): string {
  if (e.kind === "post-session") return e.title || "훈련 기록"
  if (e.kind === "race") return e.record ? `기록 ${e.record}` : "경기 기록"
  return e.note || [e.sleepH > 0 ? `수면 ${e.sleepH}h` : null, e.mood > 0 ? `기분 ${e.mood}/5` : null].filter(Boolean).join(" · ") || "하루 마무리"
}

function entrySub(e: JournalEntry): string {
  if (e.kind === "post-session") return [e.distanceKm ? `${e.distanceKm}km` : null, e.durationMin ? `${e.durationMin}min` : null, e.rpe > 0 ? `RPE ${e.rpe}` : null].filter(Boolean).join(" · ") || "훈련 후"
  if (e.kind === "race") return [e.rank, e.result].filter(Boolean).join(" · ")
  return [e.weightKg ? `체중 ${e.weightKg}kg` : null, e.restingHr ? `안정시 HR ${e.restingHr}` : null].filter(Boolean).join(" · ")
}

function MyDeviceJournal({ onOpenDay }: { onOpenDay?: ((date: string) => void) | undefined }) {
  const entries = React.useMemo(() => recentEntries(5), [])
  // ?uitest 런타임 증거: 홈 실데이터 섹션의 실제 렌더 건수
  React.useEffect(() => {
    if (window.location.search.includes("uitest")) {
      console.log(`[HOMEJ] rendered=${entries.length} kinds=${entries.map((e) => e.kind).join(",") || "-"}`)
    }
  }, [entries])
  if (entries.length === 0) return null
  return (
    <div style={{ padding: "24px 0 0" }}>
      <SectionLb>— 이 기기의 일지 · 최근 {entries.length}건</SectionLb>
      <div style={{ margin: "0 20px", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)" }}>
        {entries.map((e, i) => {
          const meta = KIND_META[e.kind]
          // F0-f-5b (R-a11y-002): 시맨틱 button — 키보드 포커스·Enter/Space 기본 제공
          return (
            <button
              key={e.id}
              onClick={() => onOpenDay?.(e.date)}
              aria-label={`${compactDate(e.date)} ${meta.label} 일지 열기 — ${entryHeadline(e)}`}
              style={{
                width: "100%", textAlign: "left", background: "transparent",
                border: 0, borderRadius: 0, padding: "12px 0",
                borderBottom: i < entries.length - 1 ? "1px dashed var(--hair)" : 0,
                display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10,
                alignItems: "baseline", cursor: "pointer", font: "inherit",
              }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--brand)", lineHeight: 1 }}>{meta.mark}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>{compactDate(e.date)}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.08em" }}>{meta.label}</span>
                </div>
                <div style={{
                  fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500, color: "var(--ink)",
                  letterSpacing: "-0.005em", marginTop: 3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{entryHeadline(e)}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.04em", marginTop: 2 }}>{entrySub(e)}</div>
              </div>
              <span style={{
                fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em",
                color: e.syncState === "local" ? "var(--ink-4)" : "var(--brand)",
                border: "1px solid var(--hair)", padding: "2px 5px", whiteSpace: "nowrap",
              }}>{e.syncState === "local" ? "이 기기" : "동기화됨"}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
