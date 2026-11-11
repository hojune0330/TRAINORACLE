import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useVisibleRefresh } from "../hooks/useVisibleRefresh"
import { refreshAccountJournalRecordsInBackground } from "../domain/account/account-journal-record-service"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { AppHeading } from "./AppHeading"
import { RecordAction, RecordChoice, RecordNotice, RecordStateList } from "./RecordUI"
import { GarminJournalComparison } from "./GarminJournalComparison"
import { GarminActivityDetail } from "./GarminActivityDetail"
import { activityDistance, activityDuration, importedSourceClock } from "./ImportedActivityMetrics"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { currentStorageConsentRevision } from "../domain/account/storage-consent-revision"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { clearGarminOperation, consumeGarminCallback, garminEndpoint, garminErrorMessage, garminIntegrationEnabled, hasGarminCallback,
  GARMIN_SAVE_CONSENT_VERSION, pendingGarminOperation, prepareGarminOperation, rememberGarminAttempt, requestGarminIntegration, safeGarminAuthorizationUrl,
  type GarminConfirmation, type GarminError, type GarminItem, type GarminRequest, type GarminStatus, type GarminTransport } from "../domain/account/garmin-integration"
import "./garmin-connection-panel.css"

export type GarminJournalOpenResult = "OPENED" | "UNAVAILABLE" | "DRAFT_REVIEW"
export type OpenGarminJournalRecord = (date: string, entryId: string, isCurrent: () => boolean) => Promise<GarminJournalOpenResult>
export type StorageConnectionReadiness = "checking" | "required" | "ready" | "unavailable"
export type GarminConnectionPanelProps = {
  readonly storageReadiness?: StorageConnectionReadiness
  readonly inlineSetup?: boolean
  readonly onOpenStorageSettings?: () => void
  readonly onSubviewChange?: (active: boolean) => void
  readonly ownerId: string | null
  readonly onOpenAccount?: () => void
  readonly onOpenJournalRecord?: OpenGarminJournalRecord
  readonly transport?: GarminTransport
  readonly configured?: boolean
  readonly featureEnabled?: boolean
  readonly navigate?: (url: string) => void
}
const sportLabel = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "기타 운동", UNKNOWN: "운동 종류 미확인" }
const meaningLabel = { TIMER: "타이머 시간", MOVING: "이동 시간", ELAPSED: "경과 시간", UNKNOWN: "종류 미확인" }
const rowState = { PENDING: "받은 기록 · 저장 전", CONFIRMED: "계정 저장 확인됨", DISMISSED: "목록에서 제외됨", DELETED: "Garmin에서 삭제된 기록", CONFLICT: "다른 수정본 확인 필요" }
const unknownResult = new Set<GarminError>(["UNAVAILABLE", "INVALID_RESPONSE", "STALE_RESPONSE", "OPERATIONS_PENDING", "JOURNAL_CONTRACT_UNAVAILABLE", "BUSY"])
function workoutStartLabel(item: GarminItem) {
  if (!item.observation) return "시작 시각 미확인"
  if (!item.clock) return importedSourceClock(item.observation.startedAt)
  const local = new Date(Date.parse(item.observation.startedAt) + item.clock.offsetSeconds * 1000)
  if (!Number.isFinite(local.getTime()) || local.toISOString().slice(0, 10) !== item.clock.localDate) return importedSourceClock(item.observation.startedAt)
  return `${item.clock.localDate} ${local.toISOString().slice(11, 16)} · 워치 시간`
}
function checkedAtLabel(timestamp: string) {
  const time = new Date(timestamp)
  return Number.isFinite(time.getTime()) ? time.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "시각 미확인"
}

/** A scope epoch key clears private rows synchronously, including an A → B → A switch. */
export function GarminConnectionPanel(props: GarminConnectionPanelProps) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <GarminConnectionSession key={`${props.ownerId ?? "guest"}:${generation}`} {...props} />
}
function GarminConnectionSession({ onSubviewChange, ownerId, onOpenAccount, onOpenJournalRecord, inlineSetup = false, onOpenStorageSettings, storageReadiness, transport = requestGarminIntegration,
  configured = garminEndpoint() !== null, featureEnabled = garminIntegrationEnabled() && accountJournalPreviewEnabled(), navigate = url => window.location.assign(url) }: GarminConnectionPanelProps) {
  const [authorizationPaused, setAuthorizationPaused] = useState(false)
  const [updatesAvailable, setUpdatesAvailable] = useState(false)
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null)
  const lastSaved = useRef<string | null>(null)
  const refreshing = useRef(false)
  const [status, setStatus] = useState<GarminStatus | null>(null)
  const [items, setItems] = useState<GarminItem[]>([]), [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<GarminError | null>(null)
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({})
  const [receipts, setReceipts] = useState<Record<string, GarminConfirmation>>({})
  const [openingJournal, setOpeningJournal] = useState<string | null>(null)
  const [journalOpenNotice, setJournalOpenNotice] = useState<{ inboxId: string; result: "UNAVAILABLE" | "DRAFT_REVIEW" } | null>(null)
  const [pending, setPending] = useState<Record<string, "confirm" | "dismiss">>({})
  const [message, setMessage] = useState<string | null>(null), [disconnectReview, setDisconnectReview] = useState(false)
  const [callbackAvailable, setCallbackAvailable] = useState(() => hasGarminCallback())
  const [connectReview, setConnectReview] = useState(false), [saveMode, setSaveMode] = useState<"AUTO" | "REVIEW">("AUTO")
  const [setupDeferred, setSetupDeferred] = useState(false)
  const [view, setView] = useState<"list" | "settings" | "review" | "saved">("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Read at response time: a user may enter review while a passive request is in flight.
  const passiveView = useRef({ view, selectedId, busy, connectReview, disconnectReview, reviewed, pending, items })
  passiveView.current = { view, selectedId, busy, connectReview, disconnectReview, reviewed, pending, items }
  const origin = useRef<{ label: string; scroll: number; view: typeof view; selectedId: string | null }[]>([])
  const heading = useRef<HTMLDivElement | null>(null)
  const connectTrigger = useRef<HTMLButtonElement | null>(null)
  const setupHeading = useRef<HTMLHeadingElement | null>(null)
  const openConnectReview = () => {
    setConnectReview(true)
    requestAnimationFrame(() => setupHeading.current?.focus())
  }
  const closeConnectReview = () => {
    setConnectReview(false)
    requestAnimationFrame(() => connectTrigger.current?.focus({ preventScroll: true }))
  }
  const enter = (next: typeof view, id: string | null = null) => {
    origin.current.push({ label: document.activeElement?.textContent ?? "", scroll: heading.current?.closest(".app-scroll-region")?.scrollTop ?? window.scrollY, view, selectedId })
    setView(next); setSelectedId(id)
    requestAnimationFrame(() => heading.current?.focus())
  }
  const back = () => {
    if (connectReview) { closeConnectReview(); return }
    const previous = origin.current.pop()
    setView(previous?.view ?? "list"); setSelectedId(previous?.selectedId ?? null); setConnectReview(false)
    requestAnimationFrame(() => {
      const target = [...(heading.current?.closest(".garmin-panel")?.querySelectorAll("button") ?? [])].find(button => button.textContent === previous?.label)
      ;(target ?? heading.current)?.focus({ preventScroll: true })
      if (previous) {
        const region = heading.current?.closest(".app-scroll-region")
        if (region) region.scrollTop = previous.scroll
        else window.scrollTo(0, previous.scroll)
      }
    })
  }
  useTaskFlowBack({ enabled: view !== "list" || connectReview, busy, onBack: back })
  useEffect(() => { onSubviewChange?.(view !== "list" || connectReview); return () => onSubviewChange?.(false) }, [view, connectReview, onSubviewChange])
  const callbackStarted = useRef(false)
  const live = useRef(true), operation = useRef<AbortController | null>(null)
  useEffect(() => { live.current = true; return () => { live.current = false; operation.current?.abort() } }, [])
  const begin = () => { operation.current?.abort(); const controller = new AbortController(); operation.current = controller; setBusy(true); setError(null); return controller }
  const current = (controller: AbortController) => live.current && operation.current === controller && !controller.signal.aborted
  const send = (request: GarminRequest, controller: AbortController) => transport(ownerId!, request, controller.signal, () => current(controller))
  const ready = configured && featureEnabled && status?.capability.enabled === true

  async function openJournal(inboxId: string, receipt: GarminConfirmation) {
    if (!onOpenJournalRecord || busy) return
    const controller = begin(); setOpeningJournal(inboxId); setJournalOpenNotice(null)
    try {
      const result = await onOpenJournalRecord(receipt.date, receipt.journalEntryId, () => current(controller))
      if (current(controller) && result !== "OPENED") setJournalOpenNotice({ inboxId, result })
    } catch {
      if (current(controller)) setJournalOpenNotice({ inboxId, result: "UNAVAILABLE" })
    } finally {
      if (current(controller)) { setBusy(false); setOpeningJournal(null) }
    }
  }

  async function load(next = false, background = false): Promise<boolean> {
    if (!ownerId || !configured || refreshing.current || background && busy) return true
    refreshing.current = true
    const controller = background ? new AbortController() : begin()
    if (background) operation.current = controller
    try {
      let canRead = ready && status?.connection.state === "ACTIVE"
      if (!next) {
        const result = await send({ action: "status", experience: true }, controller)
        if (!current(controller)) return false
        if (!result.ok) {
          setError(result.code)
          if (["AUTH_REQUIRED", "ACCESS_DENIED", "STORAGE_CONSENT_REQUIRED", "CONSENT_CHANGED"].includes(result.code)) {
            setStatus(null); setItems([]); setLoaded(false); setAuthorizationPaused(true)
          }
          return false
        }
        if (!("capability" in result.data)) { setError("INVALID_RESPONSE"); return false }
        setLastCheckedAt(new Date().toISOString()); setError(null); setAuthorizationPaused(false)
        const savedAt = result.data.experience?.lastSavedAt ?? null
        if (savedAt && savedAt !== lastSaved.current) {
          const refreshed = await refreshAccountJournalRecordsInBackground()
          if (!current(controller)) return false
          if (refreshed) lastSaved.current = savedAt
        }
        setStatus(result.data); canRead = featureEnabled && result.data.capability.enabled && result.data.connection.state === "ACTIVE"
        if (!canRead) { setItems([]); setCursor(null); setLoaded(false); return true }
      }
      if (!canRead) return true
      const result = await send({ action: "inbox", experience: true, ...(next && cursor ? { cursor } : {}) }, controller)
      if (!current(controller)) return false
      if (!result.ok) { setError(result.code); if (["AUTH_REQUIRED", "ACCESS_DENIED", "CONSENT_CHANGED", "STORAGE_CONSENT_REQUIRED"].includes(result.code)) { setStatus(null); setItems([]); setLoaded(false); setAuthorizationPaused(true) }; return false }
      if (!("items" in result.data)) { setError("INVALID_RESPONSE"); return false }
      const rows = result.data.items
      if (background) {
        const state = passiveView.current
        const changed = JSON.stringify(rows) !== JSON.stringify(state.items)
        const canApply = state.view === "list" && !state.selectedId && !state.busy && !state.connectReview && !state.disconnectReview
          && !Object.values(state.reviewed).some(Boolean) && Object.keys(state.pending).length === 0
          && ![...state.items, ...rows].some(row => pendingGarminOperation(ownerId, row.inboxId))
        if (canApply) {
          setItems(rows); setCursor(result.data.nextCursor); setLoaded(true); setUpdatesAvailable(false)
        } else if (changed) setUpdatesAvailable(true)
        return true
      }
      setUpdatesAvailable(false)
      setItems(previous => next ? [...previous.filter(item => !rows.some(row => row.inboxId === item.inboxId)), ...rows] : rows)
      // Changed revisions require a fresh explicit review.
      setReviewed({}); setReceipts({}); setJournalOpenNotice(null); setCursor(result.data.nextCursor); setLoaded(true)
      setPending(previous => ({ ...(next ? previous : {}), ...Object.fromEntries(rows.flatMap(item => {
        const saved = pendingGarminOperation(ownerId, item.inboxId)
        return saved ? [[item.inboxId, saved.action]] : []
      })) }))
      return true
    } catch { if (current(controller)) setError("UNAVAILABLE"); return false }
    finally { refreshing.current = false; if (current(controller) && !background) setBusy(false) }
  }
  useEffect(() => {
    if (inlineSetup && storageReadiness !== undefined && storageReadiness !== "ready") {
      operation.current?.abort(); operation.current = null; refreshing.current = false
      setBusy(false); setLoaded(false); setItems([]); setStatus(null); setError(null)
      return
    }
    void load()
  }, [storageReadiness, inlineSetup]) // keyed account scope and verified storage readiness own this request
  useVisibleRefresh(() => load(false, true), Boolean(ownerId && configured && featureEnabled && !authorizationPaused && (!inlineSetup || storageReadiness === undefined || storageReadiness === "ready")
    && (!status || status.connection.state === "ACTIVE" || status.connection.state === "PENDING")), ownerId,
    status?.connection.state === "ACTIVE" && !status.connection.lastSyncAt)
  async function connect() {
    if (!ownerId || !ready) return
    const controller = begin()
    try {
      const result = await send({ action: "connect", saveMode, consentVersion: GARMIN_SAVE_CONSENT_VERSION }, controller)
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); return }
      if (!("authorizationUrl" in result.data)) { setError("INVALID_RESPONSE"); return }
      const url = safeGarminAuthorizationUrl(result.data.authorizationUrl, result.data.state)
      if (!url || !rememberGarminAttempt(ownerId, result.data)) { setError("LOCAL_STATE_UNAVAILABLE"); return }
      navigate(url)
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }
  async function complete() {
    if (!ownerId || !featureEnabled) return
    const request = consumeGarminCallback(ownerId); setCallbackAvailable(false)
    if (!request || request === "invalid") { setError("OAUTH_RESTART_REQUIRED"); return }
    const controller = begin()
    try {
      const result = await send(request, controller)
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); return }
      if (!("connection" in result.data)) { setError("INVALID_RESPONSE"); return }
      setMessage(result.data.connection.state === "ACTIVE" ? "Garmin 계정이 연결됐어요. 새 운동이 도착하면 선택한 방식으로 일지에 반영해요." : "연결 결과를 다시 확인해 주세요.")
      await load()
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled && ownerId && configured && featureEnabled && callbackAvailable && !callbackStarted.current) {
        callbackStarted.current = true
        void complete()
      }
    })
    return () => { cancelled = true }
  }, [ownerId, configured, featureEnabled, callbackAvailable])
  async function changeSaveMode(mode: "AUTO" | "REVIEW") {
    if (!status?.experience || !status.connection.epoch || busy) return
    const controller = begin()
    try {
      const result = await send({ action: "preferences", saveMode: mode, consentVersion: GARMIN_SAVE_CONSENT_VERSION, epoch: status.connection.epoch, expectedPreferenceRevision: status.experience.preferenceRevision }, controller)
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); return }
      if (!("experience" in result.data) || !result.data.experience) { setError("INVALID_RESPONSE"); return }
      const experience = result.data.experience
      setStatus(previous => previous ? { ...previous, experience } : previous)
      setMessage(mode === "AUTO" ? "자동 저장에 동의했어요. 확인이 필요한 기록만 따로 알려드려요." : "앞으로 받은 운동은 확인 후 저장해요.")
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }
  async function mutate(item: GarminItem, action: "confirm" | "dismiss") {
    if (!ownerId || !ready || (!pending[item.inboxId] && !reviewed[`${item.inboxId}:${item.revision}`])) return
    const prepared = prepareGarminOperation(ownerId, item, action)
    if (!prepared) { setError("LOCAL_STATE_UNAVAILABLE"); return }
    const { consentRevision: _pinned, ...request } = prepared
    const controller = begin(); setPending(previous => ({ ...previous, [item.inboxId]: action })); setMessage(null)
    try {
      const result = await send(request, controller)
      if (!current(controller)) return
      if (!result.ok) {
        setError(result.code)
        if (!unknownResult.has(result.code)) {
          clearGarminOperation(ownerId, item.inboxId)
          setPending(previous => { const next = { ...previous }; delete next[item.inboxId]; return next })
          setReviewed(previous => ({ ...previous, [`${item.inboxId}:${item.revision}`]: false }))
        }
        return
      }
      if (!("kind" in result.data)) { setError("INVALID_RESPONSE"); return }
      if (result.data.kind === "dismissed") {
        setItems(previous => previous.map(row => row.inboxId === item.inboxId ? { ...row, state: "DISMISSED" } : row))
        setMessage("이 받은 기록을 목록에서 제외했어요. Garmin 원본과 이미 저장한 일지는 지우지 않아요.")
      } else {
        const receipt = result.data
        setReceipts(previous => ({ ...previous, [item.inboxId]: receipt }))
        setItems(previous => previous.map(row => row.inboxId === item.inboxId ? { ...row, state: "CONFIRMED", documentId: receipt.documentId } : row))
        setMessage(receipt.kind === "already_confirmed" ? "이미 저장된 일지의 결과를 확인했어요. 새 일지는 만들지 않았어요." : "계정 일지 저장을 확인했어요. 일지에서 저장된 기록을 다시 열 수 있어요.")
      }
      setStatus(previous => previous ? { ...previous, pendingCount: Math.max(0, previous.pendingCount - 1),
        experience: previous.experience ? { ...previous.experience, reviewRequiredCount: Math.max(0, previous.experience.reviewRequiredCount - (item.reviewRequired ? 1 : 0)) } : undefined } : previous)
      clearGarminOperation(ownerId, item.inboxId)
      setPending(previous => { const next = { ...previous }; delete next[item.inboxId]; return next })
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }
  async function disconnect() {
    if (!ownerId || !disconnectReview) return
    const controller = begin()
    try {
      const result = await send({ action: "disconnect" }, controller)
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); return }
      if (!("connection" in result.data)) { setError("INVALID_RESPONSE"); return }
      setItems([]); setReceipts({}); setPending({}); setLoaded(false); setDisconnectReview(false)
      const disconnected = result.data.connection
      setStatus(previous => previous ? { ...previous, connection: disconnected, pendingCount: 0 } : null)
      setMessage("remoteRevocationPending" in result.data && result.data.remoteRevocationPending
        ? "TrainOracle의 새 기록 수신을 중단했어요. Garmin 권한 해제는 확인되지 않아 다시 시도해야 해요. Garmin Connect의 계정 정보에서도 앱 권한을 직접 해제할 수 있어요." : "연결 해제를 확인했어요. 이미 저장된 일지는 그대로예요.")
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }

  const connection = status?.connection
  const needsReview = (item: GarminItem) => !!pending[item.inboxId] || item.state === "CONFLICT" || item.state === "PENDING" && (status?.experience?.saveMode !== "AUTO" || item.reviewRequired === true)
  const reviewCount = Math.max(status?.experience?.reviewRequiredCount ?? status?.pendingCount ?? 0, items.filter(needsReview).length)
  const overviewItems = [...items.filter(needsReview), ...items.filter(item => item.state === "CONFIRMED" && !needsReview(item))].slice(0, 3)
  const visibleItems = view === "list" ? overviewItems : selectedId ? items.filter(item => item.inboxId === selectedId) : items.filter(item => view === "saved" ? item.state === "CONFIRMED" : needsReview(item))
  const needsStorageSetup = inlineSetup && storageReadiness !== undefined && storageReadiness !== "ready"
  const canStartConnection = ready && !needsStorageSetup && connection?.state !== "ACTIVE" && !callbackAvailable
  const inlineConnectReview = inlineSetup && !setupDeferred && view === "list" && canStartConnection
  const showConnectReview = connectReview || inlineConnectReview
  const reconnectRequired = connection?.state === "REVOKED" || status?.experience?.reconnectRequired === true
  return <section className="garmin-panel" aria-labelledby={inlineConnectReview ? "garmin-connect-title" : "garmin-title"} aria-busy={busy || undefined}>
    {!inlineConnectReview && <div ref={heading} tabIndex={-1} className="garmin-panel__heading">
      {(view !== "list" || connectReview) && <RecordAction priority="secondary" disabled={busy} onClick={() => window.history.back()}>뒤로</RecordAction>}
      <AppHeading as="h3" variant="section" id="garmin-title">{view === "settings" ? "Garmin 설정" : view === "review" ? selectedId ? "기록 확인" : "확인이 필요한 기록" : view === "saved" ? "저장된 운동" : "Garmin"}</AppHeading>
      {view === "list" && ownerId && configured && !connectReview && <RecordAction priority="secondary" disabled={busy} onClick={() => enter("settings")}>{connection?.state === "ACTIVE" ? "Garmin 설정" : "연결 설정"}</RecordAction>}
    </div>}
    {!ownerId ? <RecordNotice kind="blocked" title="계정에서 연결을 관리해요">
        <p>로그인한 계정에 운동을 모아 둘 수 있어요.</p>
        {onOpenAccount && <RecordAction onClick={onOpenAccount}>로그인하고 연결</RecordAction>}</RecordNotice>
      : !configured ? <p>Garmin 자동 연결을 준비하고 있어요. 지금은 파일로 가져올 수 있어요.</p>
        : <>
          {updatesAvailable && <RecordNotice kind="pending" title="새 운동 또는 변경된 기록이 있어요"><RecordAction disabled={busy} onClick={() => void load()}>새 기록 확인</RecordAction></RecordNotice>}
          {lastCheckedAt && !inlineConnectReview && <p className="garmin-panel__receipt">최근 확인 · {checkedAtLabel(lastCheckedAt)}</p>}
          {view === "list" && !needsStorageSetup && !inlineConnectReview && <div className="garmin-panel__overview">
            <div className="garmin-panel__summary">
            <p>{error ? "상태 확인이 필요해요" : !status ? "연결 확인 중…" : connection?.state === "ACTIVE" ? "연결됨" : connection?.state === "PENDING" ? "연결을 마무리해 주세요" : reconnectRequired ? "다시 연결이 필요해요" : connection?.state === "ERROR" ? "연결 상태 확인이 필요해요" : "연결 안 됨"}</p>
            {connection?.state === "ACTIVE" && <>
              <p>{status?.experience ? status.experience.saveMode === "AUTO" ? "새 운동을 자동으로 일지에 저장해요." : "받은 운동을 확인 후 저장해요." : "저장 방식 확인이 필요해요."}</p>
              <p className="garmin-panel__receipt">{connection.lastSyncAt ? `마지막 수신 · ${checkedAtLabel(connection.lastSyncAt)}` : "워치 기록이 Garmin Connect에 올라오면 자동으로 받아요."}</p>
              {status?.experience?.lastSavedAt && <p className="garmin-panel__receipt">마지막 일지 저장 · {checkedAtLabel(status.experience.lastSavedAt)}</p>}
            </>}
            </div>
            {!showConnectReview && <div className="garmin-panel__actions">
              {canStartConnection && <RecordAction ref={connectTrigger} disabled={busy} onClick={openConnectReview}>{reconnectRequired ? "Garmin 다시 연결" : "Garmin 연결 시작"}</RecordAction>}
            </div>}
          </div>}
          {needsStorageSetup && <RecordNotice kind={storageReadiness === "checking" ? "pending" : "blocked"} title={storageReadiness === "checking" ? "기록 보관 상태를 확인하고 있어요" : storageReadiness === "required" ? "운동을 보관할 동의가 한 번 필요해요" : "기록 보관 상태 확인이 필요해요"}>
            {storageReadiness !== "checking" && <><p>{storageReadiness === "required" ? "연결한 운동을 내 계정에 보관하려면 선택 항목을 확인해 주세요. 저장한 뒤 연결을 이어갈 수 있어요." : "보관 설정에서 현재 상태를 확인해 주세요. 확인 전에는 연결을 시작하지 않아요."}</p>
              {onOpenStorageSettings && <RecordAction disabled={busy} onClick={onOpenStorageSettings}>기록 보관 설정 확인</RecordAction>}</>}
          </RecordNotice>}
          {(view === "list" || view === "settings") && callbackAvailable && <RecordNotice kind="pending" title="Garmin 연결을 확인하고 있어요"><p>잠시만 기다려 주세요.</p></RecordNotice>}
          {(view === "list" || view === "settings") && showConnectReview && canStartConnection && <section aria-label="Garmin 연결 및 저장 동의" className="garmin-panel__setup">
            <h4 ref={setupHeading} id="garmin-connect-title" tabIndex={-1}>{inlineConnectReview ? "Garmin 연결하고 자동으로 기록하기" : "운동을 어떻게 저장할까요?"}</h4>
            {inlineConnectReview && <p>{reconnectRequired ? "연결이 끊겼어요. 다시 연결하면 새 운동을 받아요." : "한 번 연결하면 매번 파일을 올리지 않아도 돼요."}</p>}
            <p>Garmin에서 허용한 운동과 세부 수치를 계정에 보관해요. AI 코칭 이용 동의는 포함하지 않아요.</p>
            <p>연결한 뒤 전달되는 운동부터 받아요. 연결 전 기록은 파일로 가져올 수 있어요.</p>
            <label><input type="radio" name="garmin-save" checked={saveMode === "AUTO"} onChange={() => setSaveMode("AUTO")} disabled={busy} />새 운동을 일지에 자동 저장 · 권장</label>
            <label><input type="radio" name="garmin-save" checked={saveMode === "REVIEW"} onChange={() => setSaveMode("REVIEW")} disabled={busy} />받은 운동을 확인 후 저장</label>
            <p>중복 가능성이나 수정 충돌이 있는 기록은 확인 후 저장해요. 저장 방식은 나중에 바꿀 수 있어요.</p>
            <div className="garmin-panel__actions"><RecordAction disabled={busy} onClick={() => void connect()}>동의하고 Garmin 연결</RecordAction><RecordAction priority="secondary" disabled={busy} onClick={() => { if (inlineConnectReview) setSetupDeferred(true); else closeConnectReview() }}>{inlineConnectReview ? "나중에 연결" : "취소"}</RecordAction></div>
            <details><summary>받을 수 있는 기록</summary><p>운동의 거리·원본 시간과 제공된 심박·구간·경로를 보여줘요. 시간 기준이나 세부 값이 없으면 확인되지 않은 상태로 표시해요.</p><p>수면·하루 심박·HRV·제조사 운동부하 자동 수집은 아직 준비 중이에요.</p></details>
          </section>}
          {view === "settings" && <div className="garmin-panel__settings">
          <RecordStateList label="Garmin 연결과 수신 상태" items={[
            { id: "connection", state: { phase: "connection", status: connection?.state === "ACTIVE" ? "connected" : connection?.state === "DISCONNECTED" || connection?.state === "REVOKED" ? "disconnected" : "unknown" },
              detail: connection?.state === "PENDING" ? "Garmin에서 허용한 뒤 앱으로 돌아와 연결을 마무리해 주세요." : reconnectRequired ? "Garmin 권한을 다시 확인해 주세요." : connection?.state === "ERROR" ? "연결 상태를 다시 확인해 주세요." : undefined },
            { id: "receipt", state: { phase: "receipt", status: connection ? connection.lastSyncAt ? "received" : "none" : "unknown" },
              detail: connection?.lastSyncAt ? `마지막 수신 확인: ${importedSourceClock(connection.lastSyncAt)}` : undefined },
          ]} />
          {!featureEnabled || status && !status.capability.enabled ? <p>새 연결과 기록 가져오기는 아직 사용할 수 없어요. 기존 연결 상태 확인과 해제는 할 수 있어요.</p> : null}
          <div className="garmin-panel__actions">
            <RecordAction priority="secondary" disabled={busy} onClick={() => void load()}>상태 새로고침</RecordAction>
            {canStartConnection && !connectReview && <RecordAction ref={connectTrigger} disabled={busy} onClick={openConnectReview}>{reconnectRequired ? "Garmin 다시 연결" : "Garmin 연결"}</RecordAction>}
          </div>
          {connection?.state === "ACTIVE" && status?.experience && <section aria-label="운동 저장 설정">
            <p>{status.experience.saveMode === "AUTO" ? "새 운동을 자동으로 일지에 저장해요." : "받은 운동을 확인 후 저장해요."}</p>
            <p>{status.experience.lastSavedAt ? "마지막 일지 반영: " + importedSourceClock(status.experience.lastSavedAt) : "아직 일지에 반영된 운동이 없어요."}</p>
            {status.experience.reviewRequiredCount > 0 && <p role="status">확인이 필요한 기록 {status.experience.reviewRequiredCount}개</p>}
            <details><summary>저장 방식 변경</summary><p>자동 저장은 받은 운동을 계정 일지에 반영해요. 기존에 작성한 내용은 덮어쓰지 않아요.</p>
              <RecordAction priority="secondary" disabled={busy || !ready} onClick={() => void changeSaveMode(status.experience!.saveMode === "AUTO" ? "REVIEW" : "AUTO")}>{status.experience.saveMode === "AUTO" ? "확인 후 저장으로 변경" : "동의하고 자동 저장으로 변경"}</RecordAction>
            </details>
          </section>}
          {loaded && <div className="garmin-panel__actions">
            <RecordAction priority="secondary" disabled={busy} onClick={() => enter("review")}>받은 기록 검토</RecordAction>
            <RecordAction priority="secondary" disabled={busy} onClick={() => enter("saved")}>저장된 운동 보기</RecordAction>
          </div>}
          </div>}
          {error && !needsStorageSetup && <RecordNotice kind="error" title="결과 확인이 필요해요" announce><p>{garminErrorMessage[error]}</p>
            {error === "AUTH_REQUIRED" && onOpenAccount && <RecordAction disabled={busy} onClick={onOpenAccount}>TrainOracle 로그인 확인</RecordAction>}
            {onOpenStorageSettings && ["STORAGE_CONSENT_REQUIRED", "CONSENT_CHANGED", "OPERATIONS_PENDING"].includes(error) && <RecordAction disabled={busy} onClick={onOpenStorageSettings}>기록 보관 설정 확인</RecordAction>}
            {view === "list" && <RecordAction priority={error === "AUTH_REQUIRED" && onOpenAccount || onOpenStorageSettings && ["STORAGE_CONSENT_REQUIRED", "CONSENT_CHANGED", "OPERATIONS_PENDING"].includes(error) ? "secondary" : "primary"} disabled={busy} onClick={() => void load()}>다시 확인</RecordAction>}</RecordNotice>}
          {message && <p className="garmin-panel__message" role="status">{message}</p>}
          {loaded && !needsStorageSetup && (view === "list" || view === "review" || view === "saved") && <section aria-label="Garmin 받은 기록">
            {view === "list" ? <h4 className="garmin-panel__inbox-title">받은 운동</h4> : <RecordAction priority="secondary" disabled={busy} onClick={() => void load()}>상태 새로고침</RecordAction>}
            {!selectedId && view !== "list" && <p>{view === "saved" ? "일지에 저장된 운동이에요." : "시작 시각과 수치를 확인해 주세요. 같은 날짜의 운동도 서로 다른 운동일 수 있어요."}</p>}
            {visibleItems.length === 0 && <RecordNotice kind={view === "list" && items.some(item => item.state === "PENDING") ? "pending" : "empty"} title={view === "list" ? items.some(item => item.state === "PENDING") ? "받은 운동의 일지 저장을 기다리고 있어요" : "아직 받은 운동이 없어요" : view === "saved" ? "이 목록에 저장된 운동이 없어요" : "이 목록에 확인할 기록이 없어요"}><p>{view === "list" && items.some(item => item.state === "PENDING") ? "저장이 확인되면 이곳에서 일지를 열 수 있어요." : "연결한 뒤 전달된 운동을 받아요. 이전 운동은 파일로 가져올 수 있어요."}</p>
              {view === "list" && connection?.state === "ACTIVE" && items.length === 0 && <>
                <a className="garmin-panel__provider-link" href="https://connect.garmin.com/modern/activities" target="_blank" rel="noopener noreferrer">Garmin Connect에서 확인<span className="sr-only"> · 새 탭</span></a>
                <p className="garmin-panel__receipt">운동이 있는 Garmin 계정인지 확인해 주세요. 앱이 열려 있으면 받은 기록을 자동으로 확인해요.</p>
              </>}
            </RecordNotice>}
            {visibleItems.map(item => {
              const observation = item.observation, key = `${item.inboxId}:${item.revision}`, receipt = receipts[item.inboxId] ?? (item.state === "CONFIRMED" && item.documentId && item.journalEntryId && (item.journalDate || item.clock) ? { schemaVersion: "GARMIN_INTEGRATION_V1" as const, kind: "already_confirmed" as const, documentId: item.documentId, journalEntryId: item.journalEntryId, revision: item.revision, date: item.journalDate ?? item.clock!.localDate } : undefined), retry = pending[item.inboxId]
              const pendingRequest = ownerId ? pendingGarminOperation(ownerId, item.inboxId) : null
              const retryChanged = !!pendingRequest && (pendingRequest.expectedRevision !== item.revision || pendingRequest.consentRevision !== currentStorageConsentRevision(ownerId!))
              return <article key={key} className="garmin-panel__record">
                <h4>{observation ? sportLabel[observation.sport] : "삭제된 운동"}</h4>
                <p>{item.savedAutomatically && item.state === "CONFIRMED" ? "일지에 자동 저장됨" : item.state === "PENDING" && item.reviewRequired ? "확인이 필요한 기록" : rowState[item.state]}</p>
                {!selectedId && observation && <>
                  <p>{workoutStartLabel(item)} · Garmin</p>
                  <p>{activityDistance(observation.distanceMeters)} · {meaningLabel[observation.durationMeaning]} {activityDuration(observation.durationSeconds)}</p>
                  {needsReview(item) && (view === "review" || view === "list") && <RecordAction disabled={busy} onClick={() => enter("review", item.inboxId)}>기록 확인</RecordAction>}
                </>}
                {selectedId && observation && <GarminActivityDetail ownerId={ownerId!} item={item} transport={transport} />}
                {selectedId && item.state === "PENDING" && item.clock && <GarminJournalComparison ownerId={ownerId!} date={item.clock.localDate} />}
                {selectedId && <>
                {retryChanged ? <RecordNotice kind="conflict" title="이전 요청 이후 원본이나 동의가 바뀌었어요"><p>이전 저장 결과와 현재 기록을 확인한 뒤, 바뀐 원본을 다시 검토해 주세요.</p>
                  <RecordAction priority="secondary" disabled={busy} onClick={() => { clearGarminOperation(ownerId!, item.inboxId); setPending(previous => { const next = { ...previous }; delete next[item.inboxId]; return next }); setReviewed(previous => ({ ...previous, [key]: false })) }}>변경된 원본 다시 검토</RecordAction></RecordNotice>
                  : retry ? <RecordNotice kind="pending" title="이 요청의 결과를 다시 확인해 주세요"><p>응답이 끊긴 요청은 같은 요청 번호로 확인해요. 새 저장 요청은 만들지 않아요.</p>
                  <RecordAction disabled={busy || !ready} onClick={() => void mutate(item, retry)}>{retry === "confirm" ? "같은 저장 요청 결과 확인" : "같은 제외 요청 결과 확인"}</RecordAction></RecordNotice>
                  : item.state === "PENDING" && (status?.experience?.saveMode !== "AUTO" || item.reviewRequired) && <>
                    <RecordChoice checked={reviewed[key] === true} onChange={checked => setReviewed(previous => ({ ...previous, [key]: checked }))}
                      title="이 운동의 시작 시각과 수치를 확인했어요" inputLabel="이 운동의 시작 시각과 수치를 확인했어요" density="row" disabled={busy} disabledReason="요청 결과를 확인 중이에요." />
                    <div className="garmin-panel__actions"><RecordAction disabled={busy || !ready || !reviewed[key]} onClick={() => void mutate(item, "confirm")}>일지에 저장</RecordAction>
                      <RecordAction priority="secondary" disabled={busy || !ready || !reviewed[key]} onClick={() => void mutate(item, "dismiss")}>이 받은 기록 제외</RecordAction></div>
                  </>}
                {item.state === "CONFLICT" && <p>다른 수정본이 있어 바로 덮어쓰지 않아요. 일지의 기존 기록과 Garmin 원본을 확인해 주세요.</p>}
                </>}
                {journalOpenNotice?.inboxId === item.inboxId && <RecordNotice kind="blocked"
                  title={journalOpenNotice.result === "DRAFT_REVIEW" ? "작성 중인 내용을 먼저 확인해 주세요" : "저장된 일지를 아직 열지 못했어요"}>
                  <p>{journalOpenNotice.result === "DRAFT_REVIEW" ? "이동 전에 작성 중인 내용의 저장 여부를 확인해 주세요. 일지를 다시 저장할 필요는 없어요."
                    : "계정의 해당 일지를 다시 불러오지 못했어요. 저장 확인 결과는 유지돼요. 연결 상태를 확인한 뒤 다시 열어 주세요."}</p>
                </RecordNotice>}
                {receipt && onOpenJournalRecord && <RecordAction priority="secondary" disabled={busy}
                  onClick={() => void openJournal(item.inboxId, receipt)}>{openingJournal === item.inboxId ? "일지 확인 중…" : journalOpenNotice?.inboxId === item.inboxId ? "저장한 일지 다시 열기" : "저장한 일지 열기"}</RecordAction>}
              </article>
            })}
            {view === "list" && (items.length > overviewItems.length || cursor) && <p className="garmin-panel__receipt">최근 받은 목록 중 {overviewItems.length}개를 보여줘요. 나머지는 아래 목록 버튼에서 볼 수 있어요.</p>}
            {view !== "list" && !selectedId && cursor && <RecordAction priority="secondary" disabled={busy} onClick={() => void load(true)}>받은 기록 20개 더 보기</RecordAction>}
          </section>}
          {view === "list" && loaded && !needsStorageSetup && !connectReview && (reviewCount > 0 || items.some(item => item.state === "CONFIRMED") || cursor) && <div className="garmin-panel__actions">
            {!!reviewCount && <RecordAction priority="secondary" disabled={busy} onClick={() => enter("review")}>확인이 필요한 기록 {reviewCount}개</RecordAction>}
            {(items.some(item => item.state === "CONFIRMED") || cursor) && <RecordAction priority="secondary" disabled={busy} onClick={() => enter("saved")}>저장된 운동 보기</RecordAction>}
          </div>}
          {view === "settings" && connection && connection.state !== "DISCONNECTED" && <details><summary>연결 해제</summary>
            <p>새 기록을 받지 않도록 연결을 해제해요. 이미 일지에 저장된 기록은 따로 삭제할 수 있어요.</p>
            <p>계정 보관 동의를 철회하거나 탈퇴해 연결 정보가 삭제된 경우에는 Garmin Connect의 계정 정보에서 앱 권한도 직접 해제해 주세요.</p>
            <label className="garmin-panel__disconnect"><input type="checkbox" checked={disconnectReview} disabled={busy} onChange={event => setDisconnectReview(event.target.checked)} />Garmin 연결을 해제할게요</label>
            <RecordAction priority="secondary" disabled={busy || !disconnectReview} onClick={() => void disconnect()}>연결 해제 확인</RecordAction></details>}
        </>}
  </section>
}
