import React from "react"
import { IndexCard, MoodStrip, PainDot, SectionLb } from "../components/JournalPrimitives"
import { JournalConfirmationDialog } from "../components/JournalConfirmationDialog"
import { TermHelp } from "../components/TermHelp"
import type { JournalEntry, PostSessionEntry, EveningEntry, RaceEntry } from "../domain/journal-store"
import { entriesForDate, deleteEntry, restoreDeletedEntry } from "../domain/journal-store"
import { TRASH_RETENTION_DAYS } from "../domain/journal-trash"
import { hasImportedField } from "../domain/field-provenance"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { cardDate, dowOf, seasonOf } from "../domain/dates"
import { RaceSelfCheckSummary, SavedMemo } from "./log-entry/SavedEntryContext"
import { CheckinRow, EntryDeleteRow, ImportedChip, SyncChip, TopBar2 } from "./journal-detail-primitives"
import { JournalDetailActions } from "./journal-detail-actions"
import { JournalDecorationSurface } from "./journal/JournalDecorationSurface"

export type LogDetailVariant = "A" | "B"

export type LogDetailProps = {
  readonly date: string
  readonly variant?: LogDetailVariant
  readonly onBack?: () => void
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
  readonly readerControls?: React.ReactNode
}

export function LogDetail(props: LogDetailProps) {
  return <LogDetailJournal {...props} />
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
function LogDetailJournal({ date, onBack, onAddEntry, onEditEntry, readerControls }: LogDetailProps) {
  const [rev, setRev] = React.useState(0)
  // 방금 지운 것 — 되돌리기 버튼을 그 자리에서 띄우기 위해 들고 있는다.
  // 휴지통(30일)에 남아 있으므로 이 상태가 사라져도 복구는 가능하다.
  const [justDeleted, setJustDeleted] = React.useState<
    { readonly id: string; readonly label: string; readonly trashed: boolean } | null
  >(null)
  const [pendingDelete, setPendingDelete] = React.useState<
    { readonly id: string; readonly label: string } | null
  >(null)
  const undoRef = React.useRef<HTMLButtonElement>(null)
  const entries = React.useMemo(() => entriesForDate(date), [date, rev])
  const remove = (): boolean => {
    if (!pendingDelete) return false
    const { id, label } = pendingDelete
    const r = deleteEntry(id)
    if (window.location.search.includes("uitest")) {
      console.log(`[JDEL] ok=${r.ok} remain=${r.total} trashed=${r.trashed}`)
    }
    if (!r.ok) {
      window.alert("지우지 못했어요. 잠시 후 다시 시도해 주세요.")
      return false
    }
    setPendingDelete(null)
    setJustDeleted({ id, label, trashed: r.trashed })
    setRev(v => v + 1)
    return true
  }
  React.useEffect(() => {
    if (justDeleted?.trashed) undoRef.current?.focus()
  }, [justDeleted])
  const undoRemove = (id: string) => {
    const r = restoreDeletedEntry(id)
    if (window.location.search.includes("uitest")) console.log(`[JUNDO] ok=${r.ok}`)
    if (!r.ok) {
      window.alert("되돌리지 못했어요. 휴지통에서 다시 시도해 주세요.")
      return
    }
    setJustDeleted(null)
    setRev(v => v + 1)
  }
  const sessions = entries.filter((e): e is PostSessionEntry => e.kind === "post-session")
  const evenings = entries.filter((e): e is EveningEntry => e.kind === "evening")
  const races = entries.filter((e): e is RaceEntry => e.kind === "race")

  return (
    <div style={{ paddingBottom: 40 }} className="paper-grid">
      <TopBar2 onBack={onBack}>일지</TopBar2>
      {readerControls}
      <JournalDecorationSurface key={date} date={date} hasEntries={entries.length > 0}>

      <div style={{ padding: "14px 20px 0" }}>
        <IndexCard date={cardDate(date)} dow={dowOf(date)} season={seasonOf(date)} />
      </div>
      <JournalDetailActions date={date} entries={entries} onAddEntry={onAddEntry} onEditEntry={onEditEntry} />

      {justDeleted && (
        <div data-testid="delete-undo" style={{
          margin: "14px 20px 0", padding: "11px 13px",
          border: "1px solid var(--ink)", background: "var(--surface)",
          display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", lineHeight: 1.6 }}>
            {justDeleted.label} 일지를 지웠어요.
            {justDeleted.trashed
              ? ` 휴지통에 ${TRASH_RETENTION_DAYS}일 동안 남아 있어요.`
              : " 이 기기에 자리가 없어 휴지통에 넣지 못했어요 — 되돌릴 수 없어요."}
          </div>
          {justDeleted.trashed && (
            <button
              ref={undoRef}
              type="button"
              data-testid="delete-undo-button"
              aria-label={`${justDeleted.label} 일지 되돌리기`}
              onClick={() => undoRemove(justDeleted.id)}
              style={{
                minHeight: 44, padding: "0 12px",
                border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)",
                fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >되돌리기</button>
          )}
        </div>
      )}

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
      {sessions.map((s, index) => {
        const meta = SYSTEM_META[s.system] ?? { c: "??", n: s.system, cls: "rest" }
        return (
          <div key={`post-session-${s.id}-${index}`} style={{ padding: "24px 20px 0" }}>
            <SectionLb action={savedClock(s.savedAt)}>— TRAINING SESSION</SectionLb>
            <div style={{ background: "var(--surface)", border: "1px solid var(--ink)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className={`etag ${meta.cls}`}><span className="d"></span><span className="c">{meta.c}</span><span className="n">{meta.n}</span></span>
                <SyncChip />
                {hasImportedField(s.fieldProvenance) && <ImportedChip />}
              </div>
              <div style={{ fontFamily: "var(--sans)", fontSize: 17, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.005em" }}>
                {s.title || "훈련 기록"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--ink)", borderBottom: "1px solid var(--ink)", marginTop: 12 }}>
                {([
                  ["거리", s.distanceKm || "—", "km"],
                  ["시간", s.durationMin || "—", "min"],
                  ["평균 페이스", s.avgPace || "—", "/km"],
                  ["RPE", s.rpe > 0 ? String(s.rpe) : "—", "/10"],
                ] as const).map(([l, v, u], i, a) => (
                  <div key={i} style={{ padding: "10px 8px 10px 0", borderRight: i < a.length - 1 ? "1px solid var(--hair)" : 0, paddingLeft: i > 0 ? 8 : 0 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{l}{l === "RPE" && <TermHelp term="rpe" />}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 500, color: "var(--ink)", marginTop: 3, letterSpacing: "-0.01em" }}>{v}<span style={{ fontSize: 9, color: "var(--ink-3)", fontWeight: 400, marginLeft: 2 }}>{u}</span></div>
                  </div>
                ))}
              </div>
              <SavedMemo entry={s} text={s.memo} fontSize={19} />
              <EntryDeleteRow entryId={s.id} onDelete={() => setPendingDelete({ id: s.id, label: "훈련" })} />
            </div>
          </div>
        )
      })}

      {/* 경기 (실데이터) */}
      {races.map((r, index) => (
        <div key={`race-${r.id}-${index}`} style={{ padding: "24px 20px 0" }}>
          <SectionLb action={savedClock(r.savedAt)}>— RACE · {r.stage === "pre" ? "직전" : "직후"}</SectionLb>
          <div style={{ border: "2px solid var(--ink-blue)", background: "var(--paper)", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-blue)", letterSpacing: "0.14em", textTransform: "uppercase" }}>RACE DAY</span>
              <SyncChip />
            </div>
            {r.record && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.02em", marginTop: 8 }}>{r.record}</div>
            )}
            {(r.rank || r.result) && (
              <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.04em" }}>
                {[r.rank, r.result].filter(Boolean).join(" · ")}
              </div>
            )}
            <RaceSelfCheckSummary entry={r} />
            <SavedMemo entry={r} text={r.memo} fontSize={18} />
            <EntryDeleteRow entryId={r.id} onDelete={() => setPendingDelete({ id: r.id, label: "경기" })} />
          </div>
        </div>
      ))}

      {/* 하루 마무리 (실데이터) */}
      {evenings.map((ev, index) => {
        const pains = Object.entries(ev.painParts ?? {}).filter(([, lv]) => lv > 0)
        const needsReview = painLevelsRequireReview(ev.painParts ?? {})
        return (
          <div key={`evening-${ev.id}-${index}`} style={{ padding: "24px 20px 0" }}>
            <SectionLb action={savedClock(ev.savedAt)}>— EVENING CHECK-IN</SectionLb>
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <CheckinRow lb="수면" v={ev.sleepH > 0 ? `${ev.sleepH} h · ${["", "나쁨", "부족", "보통", "좋음", "최고"][ev.sleepQuality] ?? "—"}` : "미기록"} />
              {ev.weightKg && <CheckinRow lb="체중" v={`${ev.weightKg} kg`} />}
              {ev.restingHr && <CheckinRow lb="안정시 HR" v={`${ev.restingHr} bpm`} />}
              {pains.map(([part, lv]) => (
                <CheckinRow key={part} lb="통증" v={`${part} ${lv}/5`} right={<PainDot level={lv} size={10} />} />
              ))}
              <CheckinRow lb="감정" v={ev.mood > 0 ? "" : "미기록"} right={ev.mood > 0 ? <MoodStrip level={ev.mood} showLabel /> : undefined} last={!ev.note} />
              <div style={{ padding: ev.note ? "0 14px" : 0 }}>
                <SavedMemo entry={ev} text={ev.note} fontSize={17} />
              </div>
              <div style={{ padding: "0 14px" }}>
                <EntryDeleteRow entryId={ev.id} onDelete={() => setPendingDelete({ id: ev.id, label: "하루 마무리" })} />
              </div>
            </div>
            {needsReview && (
              <div data-testid="pain-review-persist" style={{
                marginTop: 10, padding: "11px 13px",
                border: "1px solid var(--pain-5)", background: "var(--surface)",
              }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600, color: "var(--pain-5)", letterSpacing: "0.14em" }}>
                  REVIEW · 통증 4 이상 기록됨<TermHelp term="review" />
                </div>
                <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.03em", lineHeight: 1.6 }}>
                  이 날 강한 통증이 적혀 있어요. 통증이 계속되면 훈련 전에 지도자·보호자와 꼭 상의해 주세요. 기록은 그대로 보관돼요.
                </div>
              </div>
            )}
          </div>
        )
      })}

      {entries.length > 0 && (
        <div style={{ padding: "24px 20px 8px", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-4)", letterSpacing: "0.06em", lineHeight: 1.6 }}>
          이 페이지는 이 기기에만 저장돼 있어요. 온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요.
        </div>
      )}

      {pendingDelete && (
        <JournalConfirmationDialog
          title={`${pendingDelete.label} 일지를 지울까요?`}
          description={`${TRASH_RETENTION_DAYS}일 안에는 휴지통에서 되돌릴 수 있어요. 이후에는 완전히 삭제돼요.`}
          confirmLabel="휴지통으로 이동"
          returnFocusTo={() => document.getElementById(`journal-delete-${pendingDelete.id}`)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={remove}
        />
      )}
      </JournalDecorationSurface>
    </div>
  )
}
