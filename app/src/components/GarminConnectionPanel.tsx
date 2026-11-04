import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AppHeading } from "./AppHeading"
import { RecordAction, RecordChoice, RecordNotice, RecordSource, RecordStateList } from "./RecordUI"
import { GarminActivityDetail } from "./GarminActivityDetail"
import { importedSourceClock, originalQuantity } from "./ImportedActivityMetrics"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { currentStorageConsentRevision } from "../domain/account/storage-consent-revision"
import { accountJournalPreviewEnabled } from "../domain/account/account-journal-api"
import { clearGarminOperation, consumeGarminCallback, garminEndpoint, garminErrorMessage, garminIntegrationEnabled, hasGarminCallback,
  pendingGarminOperation, prepareGarminOperation, rememberGarminAttempt, requestGarminIntegration, safeGarminAuthorizationUrl,
  type GarminConfirmation, type GarminError, type GarminItem, type GarminRequest, type GarminStatus, type GarminTransport } from "../domain/account/garmin-integration"
import "./garmin-connection-panel.css"

export type GarminJournalOpenResult = "OPENED" | "UNAVAILABLE" | "DRAFT_REVIEW"
export type OpenGarminJournalRecord = (date: string, entryId: string, isCurrent: () => boolean) => Promise<GarminJournalOpenResult>
export type GarminConnectionPanelProps = {
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

function OriginalProviderLaps({ item }: { readonly item: GarminItem }) {
  const [count, setCount] = useState(20), laps = item.observation?.laps ?? []
  if (!laps.length) return null
  return <details><summary>원본 구간 보기 · {laps.length}개</summary>
    <ol className="garmin-panel__laps">{laps.slice(0, count).map((lap, index) => <li key={index}>{index + 1}구간 · {originalQuantity(lap.distanceMeters, "m")} · {meaningLabel[lap.durationMeaning]} {originalQuantity(lap.durationSeconds, "s")}</li>)}</ol>
    {count < laps.length && <RecordAction priority="secondary" onClick={() => setCount(value => value + 20)}>구간 20개 더 보기</RecordAction>}
  </details>
}

/** A scope epoch key clears private rows synchronously, including an A → B → A switch. */
export function GarminConnectionPanel(props: GarminConnectionPanelProps) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <GarminConnectionSession key={`${props.ownerId ?? "guest"}:${generation}`} {...props} />
}
function GarminConnectionSession({ ownerId, onOpenAccount, onOpenJournalRecord, transport = requestGarminIntegration,
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
        const result = await send({ action: "status" }, controller)
        if (!current(controller)) return
        if (!result.ok) { setError(result.code); setStatus(null); setItems([]); setLoaded(false); return }
        if (!("capability" in result.data)) { setError("INVALID_RESPONSE"); return }
        setStatus(result.data); canRead = featureEnabled && result.data.capability.enabled && result.data.connection.state === "ACTIVE"
        if (!canRead) { setItems([]); setCursor(null); setLoaded(false); return }
      }
      if (!canRead) return
      const result = await send({ action: "inbox", ...(next && cursor ? { cursor } : {}) }, controller)
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

  async function connect() {
    if (!ownerId || !ready) return
    const controller = begin()
    try {
      const result = await send({ action: "connect" }, controller)
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
      setMessage(result.data.connection.state === "ACTIVE" ? "Garmin 계정 연결을 확인했어요. 받은 기록을 검토한 뒤 일지에 저장해 주세요." : "연결 결과를 다시 확인해 주세요.")
      await load()
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
  return <section className="garmin-panel" aria-labelledby="garmin-title" aria-busy={busy || undefined}>
    <AppHeading as="h3" variant="section" id="garmin-title">Garmin</AppHeading>
    {!configured ? <p>Garmin 자동 연결을 준비하고 있어요. 지금은 파일로 가져올 수 있어요.</p>
      : !ownerId ? <RecordNotice kind="blocked" title="계정에서 연결을 관리해요" action={onOpenAccount ? { label: "로그인·계정 설정", onClick: onOpenAccount } : undefined}>
        <p>로그인과 계정 기록 보관 설정을 확인한 뒤 Garmin 연결을 시작할 수 있어요.</p></RecordNotice>
        : <>
          <RecordStateList label="Garmin 연결과 수신 상태" items={[
            { id: "connection", state: { phase: "connection", status: connection?.state === "ACTIVE" ? "connected" : connection?.state === "DISCONNECTED" || connection?.state === "REVOKED" ? "disconnected" : "unknown" },
              detail: connection?.state === "PENDING" ? "Garmin에서 허용한 뒤 앱으로 돌아와 연결을 마무리해 주세요." : connection?.state === "ERROR" ? "다시 연결해야 해요." : undefined },
            { id: "receipt", state: { phase: "receipt", status: connection ? connection.lastSyncAt ? "received" : "none" : "unknown" },
              detail: connection?.lastSyncAt ? `마지막 수신 확인: ${importedSourceClock(connection.lastSyncAt)}` : undefined },
          ]} />
          {!featureEnabled || status && !status.capability.enabled ? <p>새 연결과 기록 가져오기는 아직 사용할 수 없어요. 기존 연결 상태 확인과 해제는 할 수 있어요.</p> : null}
          {callbackAvailable && <RecordNotice kind="pending" title="Garmin에서 돌아왔어요"><p>현재 로그인한 계정으로 연결을 마무리해 주세요.</p>
            <RecordAction disabled={busy || !featureEnabled} onClick={() => void complete()}>연결 마무리</RecordAction></RecordNotice>}
          <div className="garmin-panel__actions">
            <RecordAction priority="secondary" disabled={busy} onClick={() => void load()}>현재 상태 다시 확인</RecordAction>
            {ready && connection?.state !== "ACTIVE" && !callbackAvailable && <RecordAction disabled={busy} onClick={() => void connect()}>{connection?.state === "REVOKED" || connection?.state === "ERROR" ? "Garmin 다시 연결" : "Garmin 연결"}</RecordAction>}
          </div>
          {error && <RecordNotice kind="error" title="결과 확인이 필요해요" announce><p>{garminErrorMessage[error]}</p></RecordNotice>}
          {message && <p className="garmin-panel__message" role="status">{message}</p>}
          {loaded && <section aria-label="Garmin 받은 기록">
            <AppHeading as="h3" variant="section">받은 기록 검토</AppHeading>
            <p>시작 시각과 운동 수치를 확인한 뒤 일지에 저장해요. 받은 것만으로 저장되거나 계획에 반영되지는 않아요.</p>
            {items.length === 0 && <RecordNotice kind="empty" title="아직 받은 기록이 없어요"><p>현재 자동 연결은 연결 이후 전달된 기록을 받아요. 과거 기록은 파일로 가져올 수 있어요.</p></RecordNotice>}
            {items.map(item => {
              const observation = item.observation, key = `${item.inboxId}:${item.revision}`, receipt = receipts[item.inboxId], retry = pending[item.inboxId]
              const pendingRequest = ownerId ? pendingGarminOperation(ownerId, item.inboxId) : null
              const retryChanged = !!pendingRequest && (pendingRequest.expectedRevision !== item.revision || pendingRequest.consentRevision !== currentStorageConsentRevision(ownerId!))
              return <article key={key} className="garmin-panel__record">
                <h4>{observation ? sportLabel[observation.sport] : "삭제된 운동"}</h4>
                <p>{rowState[item.state]}</p>
                {item.source?.manual && <p>Garmin에서 수동 입력된 운동이에요. 기기의 자동 측정 기록과 구분해 확인해 주세요.</p>}
                {(item.source?.parent.isParent || item.source?.parent.parentSummaryId) && <p>{item.source.parent.isParent ? "여러 운동을 묶은 상위 기록이에요." : "복합운동에 포함된 하위 기록이에요."} 상위·하위 기록을 함께 저장하면 운동량이 중복될 수 있어요. 저장할 범위를 확인해 주세요.</p>}
                {observation && <>
                  <RecordSource source="Garmin 계정에서 받음" originalTimeMeaning={meaningLabel[observation.durationMeaning]} dateBasis={observation.timeZone} />
                  <dl className="garmin-panel__facts">
                    <div><dt>운동 시작</dt><dd>{importedSourceClock(observation.startedAt)}</dd></div>
                    {item.clock && <div><dt>기기 표시 날짜</dt><dd>{item.clock.localDate} · 기기에 설정된 시차 {item.clock.offsetSeconds}초</dd></div>}
                    <div><dt>거리</dt><dd>{originalQuantity(observation.distanceMeters, "m")}</dd></div>
                    <div><dt>{meaningLabel[observation.durationMeaning]}</dt><dd>{originalQuantity(observation.durationSeconds, "s")}</dd></div>
                    <div><dt>원본 구간</dt><dd>{observation.laps.length}개</dd></div>
                  </dl>
                  {observation.durationMeaning === "UNKNOWN" && <p>시간 종류가 확인되지 않아 페이스로 바꾸지 않아요.</p>}
                  <OriginalProviderLaps item={item} />
                  <details><summary>보관된 수치·센서 상세</summary><GarminActivityDetail ownerId={ownerId!} item={item} transport={transport} /></details>
                </>}
                {retryChanged ? <RecordNotice kind="conflict" title="이전 요청 이후 원본이나 동의가 바뀌었어요"><p>이전 저장 결과와 현재 기록을 확인한 뒤, 바뀐 원본을 다시 검토해 주세요.</p>
                  <RecordAction priority="secondary" disabled={busy} onClick={() => { clearGarminOperation(ownerId!, item.inboxId); setPending(previous => { const next = { ...previous }; delete next[item.inboxId]; return next }); setReviewed(previous => ({ ...previous, [key]: false })) }}>변경된 원본 다시 검토</RecordAction></RecordNotice>
                  : retry ? <RecordNotice kind="pending" title="이 요청의 결과를 다시 확인해 주세요"><p>응답이 끊긴 요청은 같은 요청 번호로 확인해요. 새 저장 요청은 만들지 않아요.</p>
                  <RecordAction disabled={busy || !ready} onClick={() => void mutate(item, retry)}>{retry === "confirm" ? "같은 저장 요청 결과 확인" : "같은 제외 요청 결과 확인"}</RecordAction></RecordNotice>
                  : item.state === "PENDING" && <>
                    <RecordChoice checked={reviewed[key] === true} onChange={checked => setReviewed(previous => ({ ...previous, [key]: checked }))}
                      title="이 운동의 시작 시각과 수치를 확인했어요" inputLabel="이 운동의 시작 시각과 수치를 확인했어요" density="row" disabled={busy} disabledReason="요청 결과를 확인 중이에요." />
                    <div className="garmin-panel__actions"><RecordAction disabled={busy || !ready || !reviewed[key]} onClick={() => void mutate(item, "confirm")}>일지에 저장</RecordAction>
                      <RecordAction priority="secondary" disabled={busy || !ready || !reviewed[key]} onClick={() => void mutate(item, "dismiss")}>이 받은 기록 제외</RecordAction></div>
                  </>}
                {item.state === "CONFLICT" && <p>다른 수정본이 있어 바로 덮어쓰지 않아요. 일지의 기존 기록과 Garmin 원본을 확인해 주세요.</p>}
                {journalOpenNotice?.inboxId === item.inboxId && <RecordNotice kind="blocked"
                  title={journalOpenNotice.result === "DRAFT_REVIEW" ? "작성 중인 내용을 먼저 확인해 주세요" : "저장된 일지를 아직 열지 못했어요"}>
                  <p>{journalOpenNotice.result === "DRAFT_REVIEW" ? "이동 전에 작성 중인 내용의 저장 여부를 확인해 주세요. 일지를 다시 저장할 필요는 없어요."
                    : "계정의 해당 일지를 다시 불러오지 못했어요. 저장 확인 결과는 유지돼요. 연결 상태를 확인한 뒤 다시 열어 주세요."}</p>
                </RecordNotice>}
                {receipt && onOpenJournalRecord && <RecordAction priority="secondary" disabled={busy}
                  onClick={() => void openJournal(item.inboxId, receipt)}>{openingJournal === item.inboxId ? "일지 확인 중…" : journalOpenNotice?.inboxId === item.inboxId ? "저장한 일지 다시 열기" : "저장한 일지 열기"}</RecordAction>}
              </article>
            })}
            {cursor && <RecordAction priority="secondary" disabled={busy} onClick={() => void load(true)}>받은 기록 20개 더 보기</RecordAction>}
          </section>}
          {connection && connection.state !== "DISCONNECTED" && <details><summary>연결 해제</summary>
            <p>새 기록을 받지 않도록 연결을 해제해요. 이미 일지에 저장된 기록은 따로 삭제할 수 있어요.</p>
            <p>계정 보관 동의를 철회하거나 탈퇴해 연결 정보가 삭제된 경우에는 Garmin Connect의 계정 정보에서 앱 권한도 직접 해제해 주세요.</p>
            <label className="garmin-panel__disconnect"><input type="checkbox" checked={disconnectReview} disabled={busy} onChange={event => setDisconnectReview(event.target.checked)} />Garmin 연결을 해제할게요</label>
            <RecordAction priority="secondary" disabled={busy || !disconnectReview} onClick={() => void disconnect()}>연결 해제 확인</RecordAction></details>}
        </>}
  </section>
}
