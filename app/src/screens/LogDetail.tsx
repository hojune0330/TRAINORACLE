import React from "react"
import { ChevronDown } from "lucide-react"
import { accountJournalRecordsEnabled, deleteAccountJournalRecord, undoAccountJournalDeletion } from "../domain/account/account-journal-record-service"
import { readAccountJournalPrivateEntry } from "../domain/account/account-journal-projection"
import { activeLocalAccount } from "../domain/account/local-journal-ownership"
import { canEditJournalEntry } from "../domain/journal-edit-policy"
import { AccountJournalHistory } from "./account/AccountJournalHistory"
import { IndexCard, MoodStrip, PainDot } from "../components/JournalPrimitives"
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

function compactSummary(parts: readonly (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" · ") || "세부 내용 펼쳐보기"
}

function sessionSummary(entry: PostSessionEntry): string {
  const shownRpe = journalRpeLabel(entry)
  return compactSummary([
    entry.distanceKm ? `${entry.distanceKm} km` : null,
    entry.durationMin ? `${entry.durationMin}분` : null,
    entry.avgPace ? `${entry.avgPace}/km` : null,
    shownRpe === null ? null : `RPE ${shownRpe}`,
  ])
}

function raceSummary(entry: RaceEntry): string {
  return compactSummary([
    entry.stage === "pre" ? "경기 전" : "경기 후",
    entry.record || null,
    entry.rank || null,
    entry.result || null,
  ])
}

function eveningSummary(entry: EveningEntry): string {
  const mood = ["", "흐림", "무덤덤", "보통", "좋음", "최고"][entry.mood] ?? ""
  const pain = Object.entries(entry.painParts ?? {}).reduce<{ part: string; level: number } | null>((highest, [part, level]) => (
    level > (highest?.level ?? 0) ? { part, level } : highest
  ), null)
  return compactSummary([
    entry.sleepH > 0 ? `수면 ${entry.sleepH}h` : null,
    mood ? `기분 ${mood}` : null,
    pain === null ? "통증 기록 없음" : `${pain.part} 통증 ${pain.level}/5`,
  ])
}

function journalEntryViewKey(entry: JournalEntry, sourceIndex: number): string {
  return `${entry.kind}:${entry.id}:${sourceIndex}`
}

function JournalEntryDisclosure({
  panelId,
  kindLabel,
  title,
  summary,
  savedAt,
  position,
  open,
  standalone = false,
  imported = false,
  attention,
  onToggle,
  children,
}: {
  readonly panelId: string
  readonly kindLabel: string
  readonly title: string
  readonly summary: string
  readonly savedAt: string
  readonly position: number
  readonly open: boolean
  readonly standalone?: boolean
  readonly imported?: boolean
  readonly attention?: string
  readonly onToggle: () => void
  readonly children: React.ReactNode
}) {
  if (standalone) {
    return (
      <section
        className="journal-entry-section"
        data-open="true"
        data-single="true"
        aria-label={compactSummary([kindLabel, title, savedClock(savedAt), imported ? "가져온 기록" : null, attention])}
      >
        <header className="journal-entry-single-meta">
          <strong>{kindLabel}</strong>
          {imported && <span>가져옴</span>}
          {attention !== undefined && <span data-attention="true">{attention}</span>}
          <time dateTime={savedAt}>{savedClock(savedAt)}</time>
        </header>
        <div id={panelId} className="journal-entry-disclosure__body">
          {children}
        </div>
      </section>
    )
  }

  return (
    <section className="journal-entry-section" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="journal-entry-summary"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={compactSummary([
          `${position}번째 기록`,
          kindLabel,
          title,
          summary,
          savedClock(savedAt),
          imported ? "가져온 기록" : null,
          attention,
          open ? "접기" : "펼쳐보기",
        ])}
        onClick={onToggle}
      >
        <span className="journal-entry-summary__kind">{kindLabel}</span>
        <span className="journal-entry-summary__copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span className="journal-entry-summary__aside">
          {(imported || attention !== undefined) && (
            <span className="journal-entry-summary__flags">
              {imported && <span>가져옴</span>}
              {attention !== undefined && <span data-attention="true">{attention}</span>}
            </span>
          )}
          <time dateTime={savedAt}>{savedClock(savedAt)}</time>
          <ChevronDown aria-hidden="true" size={18} />
        </span>
      </button>
      <div id={panelId} className="journal-entry-disclosure__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
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
  const orderedEntries = React.useMemo(() => entries
    .map((entry, sourceIndex) => ({ entry, sourceIndex }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.entry.savedAt)
      const rightTime = Date.parse(right.entry.savedAt)
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime) || leftTime === rightTime) {
        return left.sourceIndex - right.sourceIndex
      }
      return leftTime - rightTime
    }), [entries])
  const entryKeys = orderedEntries.map(({ entry, sourceIndex }) => journalEntryViewKey(entry, sourceIndex))
  const entrySignature = entryKeys.join("|")
  const [expandedEntryKeys, setExpandedEntryKeys] = React.useState<ReadonlySet<string>>(
    () => new Set(entryKeys.length <= 1 ? entryKeys : []),
  )
  React.useEffect(() => {
    setExpandedEntryKeys(new Set(entryKeys.length <= 1 ? entryKeys : []))
  // entrySignature intentionally represents identity/order, not edited field values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, entrySignature])
  const allEntriesExpanded = entryKeys.length > 0 && entryKeys.every((key) => expandedEntryKeys.has(key))
  const toggleEntry = (key: string) => setExpandedEntryKeys((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const toggleAllEntries = () => setExpandedEntryKeys(allEntriesExpanded ? new Set() : new Set(entryKeys))
  const entryCounts = entries.reduce((counts, entry) => ({
    ...counts,
    [entry.kind]: counts[entry.kind] + 1,
  }), { "post-session": 0, race: 0, evening: 0 })
  const countSummary = compactSummary([
    entryCounts["post-session"] > 0 ? `훈련 ${entryCounts["post-session"]}` : null,
    entryCounts.race > 0 ? `경기 ${entryCounts.race}` : null,
    entryCounts.evening > 0 ? `하루 마무리 ${entryCounts.evening}` : null,
  ])

  return (
    <div className="paper-grid journal-detail-page">
      {readerControls === undefined ? <TopBar2 onBack={onBack}>일지</TopBar2> : readerControls}
      <JournalDecorationSurface key={date} date={date} hasEntries={entries.length > 0} pageTopRef={pageTopRef}>

      <div className="journal-detail-page__date">
        <IndexCard date={cardDate(date)} dow={dowOf(date)} season={seasonOf(date)} />
      </div>

      {entries.length > 0 && (
        <div className="journal-day-overview" aria-label={`${countSummary} 기록`}>
          <div>
            <span>오늘의 기록</span>
            <strong>{entries.length}개</strong>
            <small>{countSummary}</small>
          </div>
          {entries.length > 1 && (
            <button
              type="button"
              aria-pressed={allEntriesExpanded}
              onClick={toggleAllEntries}
            >{allEntriesExpanded ? "간단히 보기" : "모두 펼쳐보기"}</button>
          )}
        </div>
      )}

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
        <div className="journal-empty-state">
          <div className="hand" style={{ fontSize: 22, color: "var(--pencil)", lineHeight: 1.35 }}>
            이 날의 일지는 아직 비어 있어요.
          </div>
          <div style={{ marginTop: 12, fontFamily: "var(--mono)", fontSize: "var(--fs-mono-sm)", color: "var(--ink-3)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            오늘 일지는 홈 → 일지 쓰기에서 1분이면 남길 수 있어요.<br />
            어떤 모습으로 쌓이는지 궁금하면 가이드 탭의 예시 일지를 봐 주세요.
          </div>
          {onAddEntry !== undefined && (
            <button type="button" className="journal-empty-state__add" onClick={() => onAddEntry(date)}>
              첫 일지 쓰기
            </button>
          )}
        </div>
      )}

      {orderedEntries.map(({ entry, sourceIndex }, displayIndex) => {
        const viewKey = journalEntryViewKey(entry, sourceIndex)
        const panelId = `journal-entry-panel-${displayIndex}`
        const open = expandedEntryKeys.has(viewKey)

        if (entry.kind === "post-session") {
          const meta = entry.system === ""
            ? { c: "LOG", n: "빠른 기록", cls: "rest", term: null }
            : SYSTEM_META[entry.system] ?? { c: "??", n: entry.system, cls: "rest", term: null }
          const shownRpe = journalRpeLabel(entry)
          const imported = hasImportedField(entry.fieldProvenance)
          return (
            <JournalEntryDisclosure
              key={viewKey}
              panelId={panelId}
              kindLabel="훈련"
              title={entry.title || "훈련 기록"}
              summary={sessionSummary(entry)}
              savedAt={entry.savedAt}
              position={displayIndex + 1}
              open={open}
              standalone={entries.length === 1}
              imported={imported}
              onToggle={() => toggleEntry(viewKey)}
            >
              <div className="journal-entry-card journal-entry-card--session">
                <div className="journal-entry-card__meta">
                  <span className={`etag ${meta.cls}`}><span className="d"></span><span className="c">{meta.c}</span><span className="n">{meta.n}</span></span>
                  {meta.term !== null && <TermHelp term={meta.term} />}
                  <SyncChip />
                  {imported && <ImportedChip />}
                </div>
                <div className="journal-entry-card__title">{entry.title || "훈련 기록"}</div>
                <div className="journal-entry-metrics">
                  {([
                    ["거리", entry.distanceKm || "—", "km"],
                    ["시간", entry.durationMin || "—", "min"],
                    ["평균 페이스", entry.avgPace || "—", "/km"],
                    ["RPE", shownRpe ?? "—", shownRpe === null ? "" : "/10"],
                  ] as const).map(([label, value, unit], metricIndex, metrics) => (
                    <div key={label} className="journal-entry-metric" data-last={metricIndex === metrics.length - 1 ? "true" : undefined}>
                      <div className="journal-entry-metric__label">{label}{label === "RPE" && <TermHelp term="rpe" />}</div>
                      <div className="journal-entry-metric__value">
                        <span className="journal-entry-metric__number">{value}</span>
                        <span className="journal-entry-metric__unit">{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <SavedMemo entry={entry} text={entry.memo} fontSize={19} />
                <JournalOriginalPlan entry={entry} />
                <EntryDeleteRow entryId={entry.id} onDelete={() => setPendingDelete({ id: entry.id, label: "훈련" })} />
                <AccountJournalHistory entryId={entry.id} />
              </div>
            </JournalEntryDisclosure>
          )
        }

        if (entry.kind === "race") {
          return (
            <JournalEntryDisclosure
              key={viewKey}
              panelId={panelId}
              kindLabel="경기"
              title={entry.record || entry.result || "경기 기록"}
              summary={raceSummary(entry)}
              savedAt={entry.savedAt}
              position={displayIndex + 1}
              open={open}
              standalone={entries.length === 1}
              onToggle={() => toggleEntry(viewKey)}
            >
              <div className="journal-entry-card journal-entry-card--race">
                <div className="journal-entry-card__meta journal-entry-card__meta--apart">
                  <span className="journal-entry-card__eyebrow">RACE DAY · {entry.stage === "pre" ? "직전" : "직후"}</span>
                  <SyncChip />
                </div>
                {entry.record && <div className="journal-entry-card__record">{entry.record}</div>}
                {(entry.rank || entry.result) && (
                  <div className="journal-entry-card__result">{[entry.rank, entry.result].filter(Boolean).join(" · ")}</div>
                )}
                <RaceSelfCheckSummary entry={entry} />
                <SavedMemo entry={entry} text={entry.memo} fontSize={18} />
                <EntryDeleteRow entryId={entry.id} onDelete={() => setPendingDelete({ id: entry.id, label: "경기" })} />
                <AccountJournalHistory entryId={entry.id} />
              </div>
            </JournalEntryDisclosure>
          )
        }

        const pains = Object.entries(entry.painParts ?? {}).filter(([, level]) => level > 0)
        const needsReview = painLevelsRequireReview(entry.painParts ?? {})
        return (
          <JournalEntryDisclosure
            key={viewKey}
            panelId={panelId}
            kindLabel="하루 마무리"
            title={entry.note.trim().slice(0, 40) || "몸과 마음 기록"}
            summary={eveningSummary(entry)}
            savedAt={entry.savedAt}
            position={displayIndex + 1}
            open={open}
            standalone={entries.length === 1}
            attention={needsReview ? "통증 확인" : undefined}
            onToggle={() => toggleEntry(viewKey)}
          >
            <div className="journal-entry-card journal-entry-card--checkin">
              <CheckinRow lb="수면" v={entry.sleepH > 0 ? `${entry.sleepH} h · ${["", "나쁨", "부족", "보통", "좋음", "최고"][entry.sleepQuality] ?? "—"}` : "미기록"} />
              {entry.weightKg && <CheckinRow lb="체중" v={`${entry.weightKg} kg`} />}
              {entry.restingHr && <CheckinRow lb="안정시 HR" v={`${entry.restingHr} bpm`} />}
              {pains.map(([part, level]) => (
                <CheckinRow key={part} lb="통증" v={`${part} ${level}/5`} right={<PainDot level={level} size={10} />} />
              ))}
              <CheckinRow lb="감정" v={entry.mood > 0 ? "" : "미기록"} right={entry.mood > 0 ? <MoodStrip level={entry.mood} showLabel /> : undefined} last={!entry.note} />
              <div style={{ padding: entry.note ? "0 14px" : 0 }}>
                <SavedMemo entry={entry} text={entry.note} fontSize={17} />
              </div>
              <div style={{ padding: "0 14px" }}>
                <EntryDeleteRow entryId={entry.id} onDelete={() => setPendingDelete({ id: entry.id, label: "하루 마무리" })} />
                <AccountJournalHistory entryId={entry.id} />
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
          </JournalEntryDisclosure>
        )
      })}

      {entries.length > 0 && (
        <>
          <div className="journal-detail-page__storage-note">
            이 페이지는 이 기기에만 저장돼 있어요. 온라인 보관·기기 이동은 계정 연동 후에 할 수 있어요.
          </div>
          <div className="journal-day-end" data-testid="journal-day-end" aria-hidden="true"><span>오늘 기록 끝</span></div>
          <JournalDetailActions
            date={date}
            entries={actionEntries}
            onAddEntry={onAddEntry}
            onEditEntry={onEditEntry ? edit : undefined}
          />
        </>
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
