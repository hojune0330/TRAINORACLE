import React from "react"
import { accountJournalRecordsEnabled, deleteAccountJournalRecord, undoAccountJournalDeletion } from "../domain/account/account-journal-record-service"
import { readAccountJournalPrivateEntry } from "../domain/account/account-journal-projection"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { canEditJournalEntry } from "../domain/journal-edit-policy"
import { AccountJournalHistory } from "./account/AccountJournalHistory"
import { IndexCard, MoodStrip, PainDot, SectionLb } from "../components/JournalPrimitives"
import { JournalConfirmationDialog } from "../components/JournalConfirmationDialog"
import { TermHelp } from "../components/TermHelp"
import type { TermId } from "../domain/glossary"
import { ENERGY_SYSTEM_META, type EnergySystemKey } from "../domain/energy-system-taxonomy"
import type { JournalEntry, PostSessionEntry, EveningEntry, RaceEntry } from "../domain/journal-store"
import { journalRpeLabel } from "../domain/quick-journal"
import { entriesForDate, deleteEntry, restoreDeletedEntry } from "../domain/journal-store"
import { TRASH_RETENTION_DAYS } from "../domain/journal-trash"
import { hasImportedField } from "../domain/field-provenance"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { cardDate, dowOf, seasonOf } from "../domain/dates"
import { RaceSelfCheckSummary, SavedMemo } from "./log-entry/SavedEntryContext"
import { CheckinRow, EntryDeleteRow, ImportedChip, SyncChip, TopBar2 } from "./journal-detail-primitives"
import { JournalDetailActions } from "./journal-detail-actions"
import { JournalDecorationSurface } from "./journal/JournalDecorationSurface"
import { JournalOriginalPlan } from "./journal/JournalOriginalPlan"

export type LogDetailVariant = "A" | "B"

export type LogDetailProps = {
  readonly date: string
  readonly variant?: LogDetailVariant
  readonly onBack?: () => void
  readonly onAddEntry?: (date: string) => void
  readonly onEditEntry?: (entry: JournalEntry) => void
  readonly readerControls?: React.ReactNode
  readonly pageTopRef?: React.RefObject<HTMLDivElement>
}

export function LogDetail(props: LogDetailProps) {
  return <LogDetailJournal {...props} />
}

const SYSTEM_TERM: Readonly<Record<EnergySystemKey, TermId>> = {
  RECOVERY: "rec",
  BASE: "base",
  LT: "lt",
  VO2: "vo2",
  GLY: "gly",
  ATP_PC: "atp",
  MIXED_UNALLOCATED: "mix",
}

const SYSTEM_META = Object.fromEntries(
  (Object.entries(ENERGY_SYSTEM_META) as [EnergySystemKey, (typeof ENERGY_SYSTEM_META)[EnergySystemKey]][])
    .map(([key, meta]) => [meta.journalValue, {
      c: meta.code,
      n: meta.shortLabel,
      cls: key === "RECOVERY" || key === "MIXED_UNALLOCATED"
        ? "rest"
        : key.toLowerCase().replace("_pc", ""),
      term: SYSTEM_TERM[key],
    }]),
) as Record<string, { c: string; n: string; cls: string; term: TermId }>

function savedClock(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// ───────── A. Journal-page (실데이터) ─────────
function LogDetailJournal({ date, onBack, onAddEntry, onEditEntry, readerControls, pageTopRef }: LogDetailProps) {
  const [rev, setRev] = React.useState(0)
  // 방금 지운 것 — 되돌리기 버튼을 그 자리에서 띄우기 위해 들고 있는다.
  // 휴지통(30일)에 남아 있으므로 이 상태가 사라져도 복구는 가능하다.
  const [justDeleted, setJustDeleted] = React.useState<
    { readonly id: string; readonly label: string; readonly trashed: boolean; readonly account?: boolean } | null
  >(null)
  const [pendingDelete, setPendingDelete] = React.useState<
    { readonly id: string; readonly label: string } | null
  >(null)
  const undoRef = React.useRef<HTMLButtonElement>(null)
  const entries = React.useMemo(() => entriesForDate(date).map(entry => readAccountJournalPrivateEntry(entry.id) ?? entry), [date, rev])
  const renderedOwner = activeLocalAccount()
  // ACK is presentation state; only current-account records get a local policy copy.
  const actionEntries = entries.map(entry => accountJournalRecordsEnabled() && readAccountJournalPrivateEntry(entry.id)
    ? { ...entry, syncState: "local" as const } : entry)
  const edit = (candidate: JournalEntry) => {
    if (renderedOwner !== activeLocalAccount()) return
    const original = entries.find(entry => entry.id === candidate.id)
    if (!original) return
    const accountEntry = accountJournalRecordsEnabled() ? readAccountJournalPrivateEntry(candidate.id) : null
    if (accountEntry && accountEntry.savedAt !== original.savedAt) return
    if (!canEditJournalEntry(accountEntry ? { ...accountEntry, syncState: "local" } : original)) return
    onEditEntry?.(accountEntry ?? original)
  }
  React.useEffect(() => {
    const refresh = () => setRev(value => value + 1)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    return () => window.removeEventListener("trainoracle:account-journals-changed", refresh)
  }, [])
  const remove = async (): Promise<boolean> => {
    if (!pendingDelete) return false
    const { id, label } = pendingDelete
    const account = readAccountJournalPrivateEntry(id) !== null
    const accountDeleted = account ? await deleteAccountJournalRecord(id) : false
    const r = account ? { ok: accountDeleted, total: entriesForDate(date).length, trashed: accountDeleted } : deleteEntry(id)
    if (window.location.search.includes("uitest")) {
      console.log(`[JDEL] ok=${r.ok} remain=${r.total} trashed=${r.trashed}`)
    }
    if (!r.ok) {
      window.alert("지우지 못했어요. 잠시 후 다시 시도해 주세요.")
      return false
    }
    setPendingDelete(null)
    setJustDeleted({ id, label, trashed: r.trashed, account })
    setRev(v => v + 1)
    return true
  }
  React.useEffect(() => {
    if (justDeleted?.trashed) undoRef.current?.focus()
  }, [justDeleted])
  const undoRemove = async (id: string) => {
    const r = justDeleted?.account ? { ok: await undoAccountJournalDeletion(id) } : restoreDeletedEntry(id)
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
    <div className="paper-grid journal-detail-page">
      <TopBar2 onBack={onBack}>일지</TopBar2>
      {readerControls}
      <JournalDecorationSurface key={date} date={date} hasEntries={entries.length > 0} pageTopRef={pageTopRef}>

      <div className="journal-detail-page__date">
        <IndexCard date={cardDate(date)} dow={dowOf(date)} season={seasonOf(date)} />
      </div>
      <JournalDetailActions date={date} entries={actionEntries} onAddEntry={onAddEntry} onEditEntry={onEditEntry ? edit : undefined} />

      {justDeleted && (
        <div data-testid="delete-undo" style={{
          margin: "14px 20px 0", padding: "11px 13px",
          border: "1px solid var(--ink)", background: "var(--surface)",
          display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center",
        }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-mono-xs)", color: "var(--ink-2)", lineHeight: 1.6 }}>
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
                fontFamily: "var(--mono)", fontSize: "var(--fs-mono-sm)", fontWeight: 600, cursor: "pointer",
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
          <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: "var(--fs-mono-sm)", color: "var(--ink-3)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            오늘 일지는 홈 → 일지 쓰기에서 1분이면 남길 수 있어요.<br />
            어떤 모습으로 쌓이는지 궁금하면 가이드 탭의 예시 일지를 봐 주세요.
          </div>
        </div>
      )}

      {/* 훈련 세션 (실데이터) */}
      {sessions.map((s, index) => {
        const meta = s.system === ""
          ? { c: "LOG", n: "빠른 기록", cls: "rest", term: null }
          : SYSTEM_META[s.system] ?? { c: "??", n: s.system, cls: "rest", term: null }
        const shownRpe = journalRpeLabel(s)
        return (
          <section key={`post-session-${s.id}-${index}`} className="journal-entry-section">
            <SectionLb action={savedClock(s.savedAt)}>— TRAINING SESSION</SectionLb>
            <div className="journal-entry-card journal-entry-card--session">
              <div className="journal-entry-card__meta">
                <span className={`etag ${meta.cls}`}><span className="d"></span><span className="c">{meta.c}</span><span className="n">{meta.n}</span></span>
                {meta.term !== null && <TermHelp term={meta.term} />}
                <SyncChip />
                {hasImportedField(s.fieldProvenance) && <ImportedChip />}
              </div>
              <div className="journal-entry-card__title">
                {s.title || "훈련 기록"}
              </div>
              <div className="journal-entry-metrics">
                {([
                  ["거리", s.distanceKm || "—", "km"],
                  ["시간", s.durationMin || "—", "min"],
                  ["평균 페이스", s.avgPace || "—", "/km"],
                  ["RPE", shownRpe ?? "—", shownRpe === null ? "" : "/10"],
                ] as const).map(([l, v, u], i, a) => (
                  <div key={i} className="journal-entry-metric" data-last={i === a.length - 1 ? "true" : undefined}>
                    <div className="journal-entry-metric__label">{l}{l === "RPE" && <TermHelp term="rpe" />}</div>
                    <div className="journal-entry-metric__value">{v}<span>{u}</span></div>
                  </div>
                ))}
              </div>
              <SavedMemo entry={s} text={s.memo} fontSize={19} />
              <JournalOriginalPlan entry={s} />
              <EntryDeleteRow entryId={s.id} onDelete={() => setPendingDelete({ id: s.id, label: "훈련" })} />
              <AccountJournalHistory entryId={s.id} />
            </div>
          </section>
        )
      })}

      {/* 경기 (실데이터) */}
      {races.map((r, index) => (
        <section key={`race-${r.id}-${index}`} className="journal-entry-section">
          <SectionLb action={savedClock(r.savedAt)}>— RACE · {r.stage === "pre" ? "직전" : "직후"}</SectionLb>
          <div className="journal-entry-card journal-entry-card--race">
            <div className="journal-entry-card__meta journal-entry-card__meta--apart">
              <span className="journal-entry-card__eyebrow">RACE DAY</span>
              <SyncChip />
            </div>
            {r.record && (
              <div className="journal-entry-card__record">{r.record}</div>
            )}
            {(r.rank || r.result) && (
              <div className="journal-entry-card__result">
                {[r.rank, r.result].filter(Boolean).join(" · ")}
              </div>
            )}
            <RaceSelfCheckSummary entry={r} />
            <SavedMemo entry={r} text={r.memo} fontSize={18} />
            <EntryDeleteRow entryId={r.id} onDelete={() => setPendingDelete({ id: r.id, label: "경기" })} />
            <AccountJournalHistory entryId={r.id} />
          </div>
        </section>
      ))}

      {/* 하루 마무리 (실데이터) */}
      {evenings.map((ev, index) => {
        const pains = Object.entries(ev.painParts ?? {}).filter(([, lv]) => lv > 0)
        const needsReview = painLevelsRequireReview(ev.painParts ?? {})
        return (
          <section key={`evening-${ev.id}-${index}`} className="journal-entry-section">
            <SectionLb action={savedClock(ev.savedAt)}>— EVENING CHECK-IN</SectionLb>
            <div className="journal-entry-card journal-entry-card--checkin">
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
                <AccountJournalHistory entryId={ev.id} />
              </div>
            </div>
            {needsReview && (
              <div className="journal-entry-review" data-testid="pain-review-persist">
                <div className="journal-entry-review__title">
                  REVIEW · 통증 4 이상 기록됨<TermHelp term="review" />
                </div>
                <div className="journal-entry-review__copy">
                  이 날 강한 통증이 적혀 있어요. 통증이 계속되면 훈련 전에 지도자·보호자와 꼭 상의해 주세요. 기록은 그대로 보관돼요.
                </div>
              </div>
            )}
          </section>
        )
      })}

      {entries.length > 0 && (
        <div className="journal-detail-page__storage-note">
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
