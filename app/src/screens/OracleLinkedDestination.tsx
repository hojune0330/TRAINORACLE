import React from "react"
import { ArrowLeft, RefreshCw } from "lucide-react"
import type { OracleDestination } from "../domain/oracle-content-catalog"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { AthleteRecords } from "./AthleteRecords"
import { TrainingContent } from "./TrainingContent"
import { MonthCalendar } from "../components/MonthCalendar"
import { CalendarJournalBadge, CalendarJournalDetails, calendarJournalDescription } from "../components/CalendarJournalDetails"
import { useCalendarSnapshot } from "../hooks/useCalendarEntries"
import { isValidIsoDate } from "../domain/dates"
import { LogDetail } from "./LogDetail"
import { AccountPlanHistoricalView } from "./plan-beta/AccountPlanHistoricalView"
import { AccountPlanStorageControls } from "./plan-beta/AccountPlanStorageControls"
import { ACCOUNT_PLAN_EVENT, accountPlansEnabled, accountPlanService, readAccountPlanEntry, type AccountPlanStatus } from "../domain/account/account-plan-service"
import { createAccountPlanCollectionClient } from "../domain/account/account-plan-collection-api"
import { validateAccountPlanCollectionEntry } from "../domain/account/account-plan-collection-schema"
import { readPlanBetaStateForAccount } from "../domain/plan-beta-store"
import { validateAccountPlanPacket, type AccountPlanPacket } from "../domain/account/account-plan-document-schema"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE } from "../domain/adjusted-plan-storage-schema"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "../domain/adjusted-plan-storage-v5-schema"
import { RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "../domain/adjusted-plan-storage-v6-schema"

export type OracleEmbeddedDestination = Extract<OracleDestination, "METHODS" | "RECORDS" | "JOURNAL" | "CALENDAR" | "PLAN_REVIEW">
export type OracleLinkedDestinationProps = {
  readonly destination: OracleDestination
  readonly onBack: () => void
  readonly today: string
}

export function canEmbedOracleDestination(destination: OracleDestination): destination is OracleEmbeddedDestination {
  return ["METHODS", "RECORDS", "JOURNAL", "CALENDAR", "PLAN_REVIEW"].includes(destination)
}

/** Content for the caller's Reader. Existing screens retain their own date validation and account guards. */
export function OracleLinkedDestination({ destination, onBack, today }: OracleLinkedDestinationProps) {
  const scope = React.useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  if (destination === "METHODS") return <TrainingContent key={`methods-${scope}`} onBack={onBack} />
  // No onSaved navigation: a confirmed or pending save remains visible until the user explicitly goes back.
  if (destination === "RECORDS") return <AthleteRecords key={`records-${scope}`} onBack={onBack} backLabel="풀이로 돌아가기" />
  if (destination === "JOURNAL" || destination === "CALENDAR") return <LinkedJournal key={`${destination}-${scope}`} today={today} onBack={onBack} />
  if (destination === "PLAN_REVIEW") return <LinkedPlan key={`plan-${scope}`} onBack={onBack} />
  return <section aria-label="연결된 내용">
    <p role="status">이 내용은 현재 풀이 안에서 열 수 없어요.</p>
    <button type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />풀이로 돌아가기</button>
  </section>
}

function LinkedJournal({ today, onBack }: Pick<OracleLinkedDestinationProps, "today" | "onBack">) {
  const snapshot = useCalendarSnapshot()
  const latest = snapshot.entries.map(entry => entry.date).filter(date => isValidIsoDate(date) && date <= today).sort().at(-1)
  const [date, setDate] = React.useState(latest ?? today)
  const [month, setMonth] = React.useState(date.slice(0, 7))
  const [original, setOriginal] = React.useState(false)
  const anchored = React.useRef(Boolean(latest))
  const selectDate = (value: string) => { anchored.current = true; setDate(value); setMonth(value.slice(0, 7)); setOriginal(false) }
  const ready = snapshot.status === "READY"
  React.useEffect(() => {
    if (anchored.current || !ready) return
    anchored.current = true
    if (latest) { setDate(latest); setMonth(latest.slice(0, 7)) }
  }, [ready, latest])
  const readable = ready || snapshot.entries.length > 0
  return <section aria-label="일지와 달력 조회">
    <button type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />풀이로 돌아가기</button>
    <p role="status">{ready ? snapshot.owner ? "현재 계정 범위의 저장된 일지 조회" : "이 기기에 저장된 일지 조회"
      : snapshot.status === "LOADING" ? "일지를 불러오고 있어요."
        : snapshot.status === "STALE" ? "저장된 일지를 보고 있어요. 최신 기록은 아직 확인하지 못했어요."
          : "일지를 불러오지 못했어요. 기록이 없는 것은 아니에요."}</p>
    {readable && isValidIsoDate(today) && <>
      <MonthCalendar month={month} today={today} selectedDate={date} onMonthChange={value => { anchored.current = true; setMonth(value); setOriginal(false) }}
        onSelectDate={selectDate} onToday={selectDate} trainingColors
        dayDescription={value => calendarJournalDescription(snapshot.entries, value)}
        renderDay={value => <CalendarJournalBadge entries={snapshot.entries} date={value} />} />
      {latest && <button type="button" onClick={() => selectDate(latest)}>최근 일지 · {latest}</button>}
      {!ready && !snapshot.entries.some(entry => entry.date === date) ? <p role="status">이 날짜의 기록은 아직 확인하지 못했어요.</p>
        : original ? <LogDetail key={date} date={date} entries={snapshot.entries} readOnly
        onBack={() => setOriginal(false)} />
        : <CalendarJournalDetails date={date} entries={snapshot.entries} onOpenDay={() => setOriginal(true)} />}
    </>}
    {!isValidIsoDate(today) && <p role="alert">조회 날짜를 확인해 주세요.</p>}
  </section>
}

type PlanRead = { status: AccountPlanStatus; packet: AccountPlanPacket | null; evidenceRequired: boolean; archived: number }
const emptyRead: PlanRead = { status: "LOADING", packet: null, evidenceRequired: false, archived: 0 }
function guestPlan(): PlanRead {
  const read = readPlanBetaStateForAccount(null)
  if (read.kind === "missing") return { ...emptyRead, status: "EMPTY" }
  if (read.kind === "invalid" || read.kind === "storage_error") return { ...emptyRead, status: read.kind === "invalid" ? "INVALID" : "FAILED" }
  // Retain the exact stored state. Attaching independently retained evidence grants display only.
  const candidates: unknown[] = [null, ...RETAINED_ADJUSTED_PLAN_EVIDENCE, ...RETAINED_ADJUSTED_PLAN_EVIDENCE_V3, ...RETAINED_MULTI_ADJUSTED_EVIDENCE_V3]
    .map(evidence => ({ state: read.state, evidence }))
  const packets = candidates.filter(validateAccountPlanPacket)
  return packets.length === 1 ? { ...emptyRead, status: "READY", packet: packets[0]! } : { ...emptyRead, status: "INVALID" }
}

function LinkedPlan({ onBack }: Pick<OracleLinkedDestinationProps, "onBack">) {
  const owner = activeLocalAccount(), epoch = localJournalScopeGeneration()
  const [view, setView] = React.useState<PlanRead>(emptyRead)
  const [revision, refresh] = React.useReducer(value => value + 1, 0)
  const [accountStatus, setAccountStatus] = React.useState<AccountPlanStatus | null>(null)
  React.useEffect(() => {
    let active = true
    const current = () => active && activeLocalAccount() === owner && localJournalScopeGeneration() === epoch
    const controller = new AbortController()
    const syncStatus = () => { if (current()) setAccountStatus(owner ? accountPlanService()?.snapshot().status ?? null : null) }
    syncStatus()
    window.addEventListener(ACCOUNT_PLAN_EVENT, syncStatus)
    const read = async () => {
      setView(emptyRead)
      if (!owner) { setView(guestPlan()); return }
      if (!accountPlansEnabled()) { setView({ ...emptyRead, status: "AUTH_REQUIRED" }); return }
      // Deliberately do not hydrate/retry the write service: opening a reader must not flush its outbox.
      const client = createAccountPlanCollectionClient(owner, current)
      const remote = await client.readIndex()
      if (!current()) return
      let entry
      let archived = 0
      if (remote) {
        archived = remote.index.plans.filter(plan => plan.planId !== remote.index.currentPlanId).length
        const ref = remote.index.plans.find(plan => plan.planId === remote.index.currentPlanId)
        if (ref) {
          const snapshot = await client.readPart(owner, "PLAN_SNAPSHOT", ref.snapshotId, controller.signal)
          if (!current()) return
          const progress = await client.readPart(owner, "PLAN_PROGRESS", ref.progressId, controller.signal)
          if (!current()) return
          entry = validateAccountPlanCollectionEntry(remote.index, snapshot, progress)
          if (!entry || entry.planId !== ref.planId) throw Error("INVALID")
        }
      } else {
        const legacy = await client.readLegacy()
        if (!current()) return
        entry = legacy?.document.data.plans.find(plan => plan.planId === legacy.document.data.currentPlanId)
        archived = legacy?.document.data.plans.filter(plan => plan.planId !== legacy.document.data.currentPlanId).length ?? 0
      }
      if (!entry) { setView({ ...emptyRead, status: "EMPTY", archived }); return }
      const result = readAccountPlanEntry(entry)
      if (result.kind === "invalid") throw Error("INVALID")
      setView({ status: "READY", packet: result.packet, evidenceRequired: result.kind === "evidence_required", archived })
    }
    void read().catch(error => {
      if (!current()) return
      const code = error instanceof Error ? error.message : "FAILED"
      setView({ ...emptyRead, status: code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : code === "INVALID" ? "INVALID" : "FAILED" })
    })
    return () => { active = false; controller.abort(); window.removeEventListener(ACCOUNT_PLAN_EVENT, syncStatus) }
  }, [owner, epoch, revision])
  const pending = accountStatus && ["PENDING", "CONFLICT", "REJECTED"].includes(accountStatus)
  return <section aria-label="저장한 계획 조회">
    <button type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />풀이로 돌아가기</button>
    {owner ? <AccountPlanStorageControls status={(view.status === "READY" || view.status === "EMPTY") && pending ? accountStatus
      : view.status === "EMPTY" && view.archived > 0 ? "READY" : view.status}
      evidenceRequired={view.evidenceRequired} retryAvailable={false} onRetry={refresh} />
      : <p role={view.status === "INVALID" || view.status === "FAILED" ? "alert" : "status"}>
        {view.status === "READY" ? "이 기기에 저장된 계획 원본" : view.status === "EMPTY" ? "이 기기에 저장된 현재 계획이 없어요."
          : view.status === "LOADING" ? "계획을 불러오고 있어요." : "저장된 계획을 확인하지 못했어요. 원본은 변경하지 않았어요."}</p>}
    {view.status === "EMPTY" && owner && <p>현재 선택된 계획이 없어요.{view.archived > 0 ? ` 보관된 과거 계획 ${view.archived}개는 그대로 남아 있어요.` : ""}</p>}
    {pending && view.packet && <p>서버에서 읽은 원본만 표시해요. 기기의 대기·충돌 중인 수정본은 변경하지 않았어요.</p>}
    {view.packet && <><p>저장 당시 원본 조회예요. 현재 안전 상태 확인이나 훈련 실행 승인이 아니에요.</p>
      <AccountPlanHistoricalView packet={view.packet} verificationPending={view.evidenceRequired} /></>}
    <button type="button" onClick={refresh} disabled={view.status === "LOADING"}><RefreshCw size={18} aria-hidden="true" />계획 다시 불러오기</button>
  </section>
}
