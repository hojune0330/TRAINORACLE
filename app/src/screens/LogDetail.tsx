// LogDetail — 하루를 펼친 일지 페이지. journal-page 미감.
// F0-d 실데이터화: 이 화면은 로컬 저장(journal-store)의 해당 날짜 실제 일지만 렌더한다.
//  - 데모 수치 혼입 금지. 예시 일지는 Guide 화면에만 존재.
//  - variant B(대시보드)는 디자인 워크스페이스 전용 데모 표면으로 유지 (앱 셸 미사용).
import type { ReactNode } from "react"
import { IndexCard, MoodStrip, PainDot, SectionLb } from "../components/JournalPrimitives"
import { TermHelp } from "../components/TermHelp"
import type { JournalEntry, PostSessionEntry, EveningEntry, RaceEntry } from "../domain/journal-store"
import { entriesForDate } from "../domain/journal-store"
import { cardDate, dowOf, seasonOf } from "../domain/dates"

export type LogDetailVariant = "A" | "B"

export function LogDetail({ date, onBack }: { date: string; variant?: LogDetailVariant; onBack?: () => void }) {
  return <LogDetailJournal date={date} onBack={onBack} />
}

const SYSTEM_META: Record<string, { c: string; n: string; cls: string }> = {
  base: { c: "BA", n: "Base", cls: "base" },
  lt:   { c: "LT", n: "Lactate", cls: "lt" },
  vo2:  { c: "V2", n: "VO2", cls: "vo2" },
  gly:  { c: "GL", n: "Glycolytic", cls: "gly" },
  atp:  { c: "AP", n: "ATP-PC", cls: "atp" },
  rest: { c: "RE", n: "Recovery", cls: "rest" },
}

function savedClock(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// ───────── A. Journal-page (실데이터) ─────────
function LogDetailJournal({ date, onBack }: { date: string; onBack?: (() => void) | undefined }) {
  const entries = entriesForDate(date)
  const sessions = entries.filter((e): e is PostSessionEntry => e.kind === "post-session")
  const evenings = entries.filter((e): e is EveningEntry => e.kind === "evening")
  const races = entries.filter((e): e is RaceEntry => e.kind === "race")

  return (
    <div style={{ paddingBottom: 40 }} className="paper-grid">
      <TopBar2 onBack={onBack}>일지</TopBar2>

      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={cardDate(date)} dow={dowOf(date)} season={seasonOf(date)} />
      </div>

      {entries.length === 0 && (
        <div style={{ padding: "40px 20px" }}>
          <div className="hand" style={{ fontSize: 22, color: "var(--pencil)", lineHeight: 1.35 }}>
            이 날의 일지는 아직 비어 있어요.
          </div>
          <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            오늘 일지는 홈 → 일지 쓰기에서 1분이면 남길 수 있어요.<br />
            어떤 모습으로 쌓이는지 궁금하면 가이드 탭의 예시 일지를 봐 주세요.
          </div>
        </div>
      )}

      {/* 훈련 세션 (실데이터) */}
      {sessions.map((s) => {
        const meta = SYSTEM_META[s.system] ?? { c: "??", n: s.system, cls: "rest" }
        return (
          <div key={s.id} style={{ padding: "24px 20px 0" }}>
            <SectionLb action={savedClock(s.savedAt)}>— TRAINING SESSION</SectionLb>
            <div style={{ background: "var(--surface)", border: "1px solid var(--ink)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className={`etag ${meta.cls}`}><span className="d"></span><span className="c">{meta.c}</span><span className="n">{meta.n}</span></span>
                <SyncChip state={s.syncState} />
              </div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 17, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                {s.title || "훈련 기록"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", marginTop: 12 }}>
                {([
                  ["거리", s.distanceKm || "—", "km"],
                  ["시간", s.durationMin || "—", "min"],
                  ["평균 페이스", s.avgPace || "—", "/km"],
                  ["RPE", String(s.rpe), "/10"],
                ] as const).map(([l, v, u], i, a) => (
                  <div key={i} style={{ padding: "10px 8px 10px 0", borderRight: i < a.length - 1 ? "1px solid var(--hair)" : 0, paddingLeft: i > 0 ? 8 : 0 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{l}{l === "RPE" && <TermHelp term="rpe" />}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 3, letterSpacing: "-0.01em" }}>{v}<span style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{u}</span></div>
                  </div>
                ))}
              </div>
              {s.memo && (
                <div className="hand" style={{ marginTop: 12, fontSize: 19, lineHeight: 1.45, color: "var(--ink-blue)", borderTop: "1px dashed var(--paper-edge)", paddingTop: 10 }}>
                  {s.memo}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* 경기 (실데이터) */}
      {races.map((r) => (
        <div key={r.id} style={{ padding: "24px 20px 0" }}>
          <SectionLb action={savedClock(r.savedAt)}>— RACE · {r.stage === "pre" ? "직전" : "직후"}</SectionLb>
          <div style={{ border: "2px solid var(--ink-blue)", background: "var(--paper)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-blue)", letterSpacing: "0.14em", textTransform: "uppercase" }}>RACE DAY</span>
              <SyncChip state={r.syncState} />
            </div>
            {r.record && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 8 }}>{r.record}</div>
            )}
            {(r.rank || r.result) && (
              <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em" }}>
                {[r.rank, r.result].filter(Boolean).join(" · ")}
              </div>
            )}
            {r.memo && (
              <div className="hand" style={{ marginTop: 12, fontSize: 18, lineHeight: 1.4, color: "var(--ink-blue)", borderTop: "1px dashed var(--paper-edge)", paddingTop: 10 }}>
                {r.memo}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 하루 마무리 (실데이터) */}
      {evenings.map((ev) => {
        const pains = Object.entries(ev.painParts ?? {}).filter(([, lv]) => lv > 0)
        return (
          <div key={ev.id} style={{ padding: "24px 20px 0" }}>
            <SectionLb action={savedClock(ev.savedAt)}>— EVENING CHECK-IN</SectionLb>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <CheckinRow lb="수면" v={`${ev.sleepH} h · ${["", "나쁨", "부족", "보통", "좋음", "최고"][ev.sleepQuality] ?? ev.sleepQuality}`} />
              {ev.weightKg && <CheckinRow lb="체중" v={`${ev.weightKg} kg`} />}
              {ev.restingHr && <CheckinRow lb="안정시 HR" v={`${ev.restingHr} bpm`} />}
              {pains.map(([part, lv]) => (
                <CheckinRow key={part} lb="통증" v={`${part} ${lv}/5`} right={<PainDot level={lv} size={10} />} />
              ))}
              <CheckinRow lb="감정" v="" right={<MoodStrip level={ev.mood} showLabel />} last={!ev.note} />
              {ev.note && (
                <div className="hand" style={{ padding: "12px 14px", fontSize: 17, lineHeight: 1.4, color: "var(--ink-blue)", borderTop: "1px dashed var(--hair)" }}>
                  {ev.note}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {entries.length > 0 && (
        <div style={{ padding: "24px 20px 8px", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", lineHeight: 1.6 }}>
          이 페이지는 이 기기에만 저장돼 있어요. 온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요.
        </div>
      )}
    </div>
  )
}

function SyncChip({ state }: { state: JournalEntry["syncState"] }) {
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.1em",
      color: state === "local" ? "var(--ink-4)" : "var(--brand)",
      border: "1px solid var(--hair)", padding: "2px 5px", whiteSpace: "nowrap",
    }}>{state === "local" ? "이 기기" : "동기화됨"}</span>
  )
}

function CheckinRow({ lb, v, right, last }: { lb: string; v: string; right?: ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "90px 1fr auto",
      gap: 12, padding: "11px 14px", alignItems: "center",
      borderBottom: last ? 0 : "1px dashed var(--hair)",
      fontFamily: "var(--mono)",
    }}>
      <span style={{ fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>{lb}</span>
      <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{v}</span>
      <span>{right}</span>
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
      <div style={{ width: 48 }}></div>
    </div>
  )
}
