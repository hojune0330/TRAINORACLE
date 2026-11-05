import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useTaskFlowBack } from "../hooks/useTaskFlowBack"
import { AppHeading } from "./AppHeading"
import { RecordAction, RecordChoice, RecordNotice, RecordStateList } from "./RecordUI"
import { GarminJournalComparison } from "./GarminJournalComparison"
import { GarminActivityDetail } from "./GarminActivityDetail"
import { importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { currentStorageConsentRevision } from "../domain/account/storage-consent-revision"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { clearGarminOperation, consumeGarminCallback, garminEndpoint, garminErrorMessage, garminIntegrationEnabled, hasGarminCallback,
  GARMIN_SAVE_CONSENT_VERSION, pendingGarminOperation, prepareGarminOperation, rememberGarminAttempt, requestGarminIntegration, safeGarminAuthorizationUrl,
  type GarminConfirmation, type GarminError, type GarminItem, type GarminRequest, type GarminStatus, type GarminTransport } from "../domain/account/garmin-integration"
import "./garmin-connection-panel.css"

export type GarminJournalOpenResult = "OPENED" | "UNAVAILABLE" | "DRAFT_REVIEW"
export type OpenGarminJournalRecord = (date: string, entryId: string, isCurrent: () => boolean) => Promise<GarminJournalOpenResult>
export type GarminConnectionPanelProps = {
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

/** A scope epoch key clears private rows synchronously, including an A → B → A switch. */
export function GarminConnectionPanel(props: GarminConnectionPanelProps) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <GarminConnectionSession key={`${props.ownerId ?? "guest"}:${generation}`} {...props} />
}
function GarminConnectionSession({ onSubviewChange, ownerId, onOpenAccount, onOpenJournalRecord, transport = requestGarminIntegration,
  configured = garminEndpoint() !== null, featureEnabled = garminIntegrationEnabled() && accountJournalPreviewEnabled(), navigate = url => window.location.assign(url) }: GarminConnectionPanelProps) {
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
  const [view, setView] = useState<"list" | "settings" | "review" | "saved">("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
    origin.current.push({ label: document.activeElement?.textContent ?? "", scroll: window.scrollY, view, selectedId })
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
      if (previous) window.scrollTo(0, previous.scroll)
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

  async function load(next = false) {
    if (!ownerId || !configured) return
    const controller = begin()
    try {
      let canRead = ready && status?.connection.state === "ACTIVE"
      if (!next) {
        const result = await send({ action: "status", experience: true }, controller)
        if (!current(controller)) return
        if (!result.ok) { setError(result.code); setStatus(null); setItems([]); setLoaded(false); return }
        if (!("capability" in result.data)) { setError("INVALID_RESPONSE"); return }
        setStatus(result.data); canRead = featureEnabled && result.data.capability.enabled && result.data.connection.state === "ACTIVE"
        if (!canRead) { setItems([]); setCursor(null); setLoaded(false); return }
      }
      if (!canRead) return
      const result = await send({ action: "inbox", experience: true, ...(next && cursor ? { cursor } : {}) }, controller)
      if (!current(controller)) return
      if (!result.ok) { setError(result.code); if (!next) { setItems([]); setLoaded(false) }; return }
      if (!("items" in result.data)) { setError("INVALID_RESPONSE"); return }
      const rows = result.data.items
      setItems(previous => next ? [...previous.filter(item => !rows.some(row => row.inboxId === item.inboxId)), ...rows] : rows)
      // A fresh read requires a fresh explicit review; no checkbox promotes a revised row.
      setReviewed({}); setReceipts({}); setJournalOpenNotice(null); setCursor(result.data.nextCursor); setLoaded(true)
      setPending(previous => ({ ...(next ? previous : {}), ...Object.fromEntries(rows.flatMap(item => {
        const saved = pendingGarminOperation(ownerId, item.inboxId)
        return saved ? [[item.inboxId, saved.action]] : []
      })) }))
    } catch { if (current(controller)) setError("UNAVAILABLE") }
    finally { if (current(controller)) setBusy(false) }
  }
  useEffect(() => { void load() }, []) // the keyed session pins owner/transport for its lifetime

  useEffect(() => {
    if (status?.experience?.saveMode !== "AUTO" || status.connection.state !== "ACTIVE" || busy || selectedId || Object.values(reviewed).some(Boolean)) return
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load() }, 30000)
    return () => window.clearInterval(timer)
  }, [status?.experience?.saveMode, status?.connection.state, busy, reviewed, selectedId])
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
  const visibleItems = selectedId ? items.filter(item => item.inboxId === selectedId) : items.filter(item => view === "saved" ? item.state === "CONFIRMED" : needsReview(item))
  const canStartConnection = ready && connection?.state !== "ACTIVE" && !callbackAvailable
  const reconnectRequired = connection?.state === "REVOKED" || connection?.state === "ERROR"
  return <section className="garmin-panel" aria-labelledby="garmin-title" aria-busy={busy || undefined}>
    <div ref={heading} tabIndex={-1} className="garmin-panel__heading">
      {(view !== "list" || connectReview) && <RecordAction priority="secondary" disabled={busy} onClick={() => window.history.back()}>뒤로</RecordAction>}
      <AppHeading as="h3" variant="section" id="garmin-title">{view === "settings" ? "Garmin 설정" : view === "review" ? selectedId ? "기록 확인" : "확인이 필요한 기록" : view === "saved" ? "저장된 운동" : "Garmin"}</AppHeading>
    </div>
    {!ownerId ? <RecordNotice kind="blocked" title="계정에서 연결을 관리해요">
        <p>로그인과 계정 기록 보관 설정을 확인한 뒤 Garmin 연결을 시작할 수 있어요.</p>
        {onOpenAccount && <RecordAction onClick={onOpenAccount}>로그인하고 연결</RecordAction>}</RecordNotice>
      : !configured ? <p>Garmin 자동 연결을 준비하고 있어요. 지금은 파일로 가져올 수 있어요.</p>
        : <>
          {view === "list" && <div className="garmin-panel__overview">
            <div className="garmin-panel__summary">
            <p>{error ? "상태 확인이 필요해요" : !status ? "연결 확인 중…" : connection?.state === "ACTIVE" ? "연결됨" : connection?.state === "PENDING" ? "연결을 마무리해 주세요" : connection?.state === "ERROR" || connection?.state === "REVOKED" ? "다시 연결이 필요해요" : "연결 안 됨"}</p>
            {connection?.state === "ACTIVE" && <>
              <p>{status?.experience ? status.experience.saveMode === "AUTO" ? "새 운동을 자동으로 일지에 저장해요." : "받은 운동을 확인 후 저장해요." : "저장 방식 확인이 필요해요."}</p>
              <p className="garmin-panel__receipt">{connection.lastSyncAt ? `마지막 수신 확인: ${importedSourceClock(connection.lastSyncAt)}` : "아직 받은 기록 없음"}</p>
            </>}
            </div>
            {!connectReview && <div className="garmin-panel__actions">
              {canStartConnection && <RecordAction ref={connectTrigger} disabled={busy} onClick={openConnectReview}>{reconnectRequired ? "Garmin 다시 연결" : "Garmin 연결 시작"}</RecordAction>}
              {loaded && !!reviewCount && <RecordAction disabled={busy} onClick={() => enter("review")}>확인이 필요한 기록 {reviewCount}개</RecordAction>}
              {loaded && <RecordAction priority={reviewCount ? "secondary" : "primary"} disabled={busy} onClick={() => enter("saved")}>저장된 운동 보기</RecordAction>}
              <RecordAction priority="secondary" disabled={busy} onClick={() => enter("settings")}>{connection?.state === "ACTIVE" ? "Garmin 설정" : "연결 설정"}</RecordAction>
            </div>}
          </div>}
          {(view === "list" || view === "settings") && callbackAvailable && <RecordNotice kind="pending" title="Garmin 연결을 확인하고 있어요"><p>잠시만 기다려 주세요.</p></RecordNotice>}
          {(view === "list" || view === "settings") && connectReview && canStartConnection && <section aria-label="Garmin 연결 및 저장 동의" className="garmin-panel__setup">
            <h4 ref={setupHeading} tabIndex={-1}>운동을 어떻게 저장할까요?</h4>
            <p>Garmin에서 허용한 운동과 세부 수치를 계정에 보관해요. AI 코칭 이용 동의는 포함하지 않아요.</p>
            <label><input type="radio" name="garmin-save" checked={saveMode === "AUTO"} onChange={() => setSaveMode("AUTO")} disabled={busy} />새 운동을 일지에 자동 저장 · 권장</label>
            <label><input type="radio" name="garmin-save" checked={saveMode === "REVIEW"} onChange={() => setSaveMode("REVIEW")} disabled={busy} />받은 운동을 확인 후 저장</label>
            <p>중복 가능성이나 수정 충돌이 있는 기록은 확인 후 저장해요. 저장 방식은 나중에 바꿀 수 있어요.</p>
            <div className="garmin-panel__actions"><RecordAction disabled={busy} onClick={() => void connect()}>동의하고 Garmin 연결</RecordAction><RecordAction priority="secondary" disabled={busy} onClick={closeConnectReview}>취소</RecordAction></div>
          </section>}
          {view === "settings" && <div className="garmin-panel__settings">
          <RecordStateList label="Garmin 연결과 수신 상태" items={[
            { id: "connection", state: { phase: "connection", status: connection?.state === "ACTIVE" ? "connected" : connection?.state === "DISCONNECTED" || connection?.state === "REVOKED" ? "disconnected" : "unknown" },
              detail: connection?.state === "PENDING" ? "Garmin에서 허용한 뒤 앱으로 돌아와 연결을 마무리해 주세요." : connection?.state === "ERROR" ? "다시 연결해야 해요." : undefined },
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
          {error && <RecordNotice kind="error" title="결과 확인이 필요해요" announce><p>{garminErrorMessage[error]}</p></RecordNotice>}
          {message && <p className="garmin-panel__message" role="status">{message}</p>}
          {loaded && (view === "review" || view === "saved") && <section aria-label="Garmin 받은 기록">
            <RecordAction priority="secondary" disabled={busy} onClick={() => void load()}>상태 새로고침</RecordAction>
            {!selectedId && <p>{view === "saved" ? "일지에 저장된 운동이에요." : "시작 시각과 수치를 확인해 주세요. 같은 날짜의 운동도 서로 다른 운동일 수 있어요."}</p>}
            {visibleItems.length === 0 && <RecordNotice kind="empty" title={view === "saved" ? "이 목록에 저장된 운동이 없어요" : "이 목록에 확인할 기록이 없어요"}><p>현재 자동 연결은 연결 이후 전달된 기록을 받아요. 과거 기록은 파일로 가져올 수 있어요.</p></RecordNotice>}
            {visibleItems.map(item => {
              const observation = item.observation, key = `${item.inboxId}:${item.revision}`, receipt = receipts[item.inboxId] ?? (item.state === "CONFIRMED" && item.documentId && item.journalEntryId && (item.journalDate || item.clock) ? { schemaVersion: "GARMIN_INTEGRATION_V1" as const, kind: "already_confirmed" as const, documentId: item.documentId, journalEntryId: item.journalEntryId, revision: item.revision, date: item.journalDate ?? item.clock!.localDate } : undefined), retry = pending[item.inboxId]
              const pendingRequest = ownerId ? pendingGarminOperation(ownerId, item.inboxId) : null
              const retryChanged = !!pendingRequest && (pendingRequest.expectedRevision !== item.revision || pendingRequest.consentRevision !== currentStorageConsentRevision(ownerId!))
              return <article key={key} className="garmin-panel__record">
                <h4>{observation ? sportLabel[observation.sport] : "삭제된 운동"}</h4>
                <p>{item.savedAutomatically && item.state === "CONFIRMED" ? "일지에 자동 저장됨" : item.state === "PENDING" && item.reviewRequired ? "확인이 필요한 기록" : rowState[item.state]}</p>
                {!selectedId && observation && <>
                  <p>{importedSourceClock(observation.startedAt)} · Garmin</p>
                  <p>{originalQuantity(observation.distanceMeters, "m")} · {meaningLabel[observation.durationMeaning]} {originalQuantity(observation.durationSeconds, "s")}</p>
                  {view === "review" && <RecordAction priority="secondary" disabled={busy} onClick={() => enter("review", item.inboxId)}>기록 확인</RecordAction>}
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
            {!selectedId && cursor && <RecordAction priority="secondary" disabled={busy} onClick={() => void load(true)}>받은 기록 20개 더 보기</RecordAction>}
          </section>}
          {view === "settings" && connection && connection.state !== "DISCONNECTED" && <details><summary>연결 해제</summary>
            <p>새 기록을 받지 않도록 연결을 해제해요. 이미 일지에 저장된 기록은 따로 삭제할 수 있어요.</p>
            <p>계정 보관 동의를 철회하거나 탈퇴해 연결 정보가 삭제된 경우에는 Garmin Connect의 계정 정보에서 앱 권한도 직접 해제해 주세요.</p>
            <label className="garmin-panel__disconnect"><input type="checkbox" checked={disconnectReview} disabled={busy} onChange={event => setDisconnectReview(event.target.checked)} />Garmin 연결을 해제할게요</label>
            <RecordAction priority="secondary" disabled={busy || !disconnectReview} onClick={() => void disconnect()}>연결 해제 확인</RecordAction></details>}
        </>}
  </section>
}
