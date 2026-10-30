import React from "react"
import { Sparkles } from "lucide-react"
import { COACHING_PURPOSE_VERSION, coachingErrorMessage, requestSelfHostedCoaching, selfHostedCoachingEnabled,
  type CoachingConsent, type CoachingExplanation, type CoachingRequest, type CoachingStatus, type CoachingTransport } from "../domain/coaching-self-hosted"
import { onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { onAccountDeletionBoundaryChange } from "../domain/account/account-deletion-boundary"
import "./SelfHostedCoachingPanel.css"

export type CoachingJournalSource = { readonly documentId: string; readonly journalEntryId: string; readonly date: string }
export type SelfHostedCoachingPanelProps = {
  readonly ownerId: string | null
  readonly onReviewJournal: (source: CoachingJournalSource) => void
  readonly onReviewPlan: () => void
  readonly transport?: CoachingTransport
  readonly mode?: "coach" | "manage"
}

/** Account-keyed mount prevents a previous account's data appearing for even one render. */
export function SelfHostedCoachingPanel(props: SelfHostedCoachingPanelProps) {
  if (!selfHostedCoachingEnabled() && props.mode !== "manage") return null
  return <SelfHostedCoachingSession key={props.ownerId ?? "signed-out"} {...props} />
}

function SelfHostedCoachingSession({ ownerId, onReviewJournal, onReviewPlan, transport = requestSelfHostedCoaching, mode = "coach" }: SelfHostedCoachingPanelProps) {
  const titleId = React.useId()
  const [status, setStatus] = React.useState<CoachingStatus | null>(null)
  const [consent, setConsent] = React.useState<CoachingConsent | null>(null)
  const [selected, setSelected] = React.useState<string[]>([])
  const [accepted, setAccepted] = React.useState(false)
  const [result, setResult] = React.useState<CoachingExplanation | null>(null)
  const [busy, setBusy] = React.useState<"status" | "consent" | "infer" | "withdraw" | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [blocked, setBlocked] = React.useState(false)
  const operation = React.useRef(0)
  const controller = React.useRef<AbortController | null>(null)
  const mounted = React.useRef(true)
  const resultHeading = React.useRef<HTMLHeadingElement>(null)
  const sourceDetails = React.useRef<HTMLDetailsElement>(null)
  const sourceSummary = React.useRef<HTMLElement>(null)
  const stop = React.useCallback(() => {
    operation.current += 1
    controller.current?.abort()
    controller.current = null
  }, [])
  const begin = React.useCallback(() => {
    stop()
    const version = operation.current
    const next = new AbortController()
    controller.current = next
    return { signal: next.signal, current: () => mounted.current && operation.current === version && !next.signal.aborted }
  }, [stop])

  const refresh = React.useCallback(async () => {
    if (!ownerId) return
    const work = begin()
    setStatus(null); setResult(null); setAccepted(false); setSelected([]); setBlocked(false); setNotice(null); setBusy("status")
    try {
      const response = await transport(ownerId, { action: "status" }, work.signal, work.current)
      if (!work.current()) return
      if (response.ok && "records" in response.data) { setStatus(response.data); setConsent(response.data.consent) }
      else setNotice(response.ok ? coachingErrorMessage.INVALID_RESPONSE : coachingErrorMessage[response.code])
    } catch { if (work.current()) setNotice(coachingErrorMessage.UNAVAILABLE) }
    finally { if (work.current()) setBusy(null) }
  }, [begin, ownerId, transport])

  React.useEffect(() => {
    mounted.current = true
    void refresh()
    const clear = () => { stop(); setStatus(null); setResult(null); setConsent(null); setSelected([]); setAccepted(false); setBusy(null); setBlocked(true); setNotice("계정 상태가 바뀌었어요. 다시 열어 확인해 주세요.") }
    const scope = onLocalJournalScopeChange(clear)
    const deletion = onAccountDeletionBoundaryChange(id => { if (id === ownerId) clear() })
    return () => { mounted.current = false; stop(); scope(); deletion() }
  }, [ownerId, refresh, stop])
  React.useEffect(() => { if (result) resultHeading.current?.focus() }, [result])

  const explain = async () => {
    if (!ownerId || !status?.capability.enabled || !consent || !accepted || busy || blocked || selected.length === 0) return
    const documentIds = [...selected]
    const work = begin()
    setResult(null); setNotice(null); setBusy("consent")
    try {
      const granted = await transport(ownerId, { action: "consent", purposeVersion: COACHING_PURPOSE_VERSION,
        expectedConsentRevision: consent.revision, documentIds,
        documentRevisions: documentIds.map(documentId => ({ documentId, revision: status.records.find(record => record.documentId === documentId)!.revision })),
      }, work.signal, work.current)
      if (!work.current()) return
      if (!granted.ok || !("consent" in granted.data) || !granted.data.consent.active) {
        setNotice(granted.ok ? coachingErrorMessage.INVALID_RESPONSE : coachingErrorMessage[granted.code]); setBlocked(true); return
      }
      setConsent(granted.data.consent); setBusy("infer")
      const request: CoachingRequest = { action: "infer", documentIds, consentRevision: granted.data.consent.revision }
      const response = await transport(ownerId, request, work.signal, work.current)
      if (!work.current()) return
      if (response.ok && "kind" in response.data && response.data.kind === "explanation") setResult(response.data)
      else {
        setNotice(response.ok ? coachingErrorMessage.INVALID_RESPONSE : coachingErrorMessage[response.code])
        if (!response.ok && ["SOURCE_CHANGED", "CONSENT_CHANGED", "ACCESS_DENIED"].includes(response.code)) setBlocked(true)
      }
    } catch { if (work.current()) setNotice(coachingErrorMessage.UNAVAILABLE) }
    finally { if (work.current()) setBusy(null) }
  }

  const withdraw = async () => {
    if (!ownerId || !consent?.active || busy === "withdraw" || busy === "consent") return
    const work = begin()
    setBusy("withdraw"); setResult(null); setAccepted(false); setBlocked(true); setNotice(null)
    try {
      const response = await transport(ownerId, { action: "withdraw", expectedConsentRevision: consent.revision }, work.signal, work.current)
      if (!work.current()) return
      if (response.ok && "consent" in response.data && !response.data.consent.active) {
        setConsent(response.data.consent); setSelected([]); setBlocked(false); setNotice("AI 풀이 동의를 철회했어요. 이 화면의 풀이도 지웠어요.")
      } else setNotice(`철회 완료를 확인하지 못했어요. ${response.ok ? coachingErrorMessage.INVALID_RESPONSE : coachingErrorMessage[response.code]}`)
    } catch { if (work.current()) setNotice("철회 완료를 확인하지 못했어요. 서버 상태를 다시 확인해 주세요.") }
    finally { if (work.current()) setBusy(null) }
  }
  const cancel = () => { stop(); setBusy(null); setResult(null); setNotice("풀이 요청을 취소했어요. 동의는 아래에서 별도로 철회할 수 있어요.") }
  const ready = mode === "coach" && selfHostedCoachingEnabled() && status?.capability.enabled === true && !blocked
  const canExplain = ready && accepted && selected.length > 0 && busy === null
  const reason = (code: string) => code === "PROVIDER_APPROVAL_PENDING" ? "공급자 AI 사용 승인 대기"
    : code === "SOURCE_REVIEW_REQUIRED" ? "기록 출처 확인 필요" : "자체 AI 서비스 운영 준비 중"
  const reviewSource = (documentId: string) => {
    const record = status?.records.find(item => item.documentId === documentId)
    if (!result?.sourceDocumentIds.includes(documentId) || !record?.journalEntryId) return
    onReviewJournal({ documentId, journalEntryId: record.journalEntryId, date: record.date })
  }
  const reviewJournal = () => {
    if (result?.sourceDocumentIds.length === 1) { reviewSource(result.sourceDocumentIds[0]!); return }
    if (sourceDetails.current) sourceDetails.current.open = true
    sourceSummary.current?.focus()
  }

  return <section className="self-hosted-coaching" aria-labelledby={titleId} aria-busy={busy !== null}>
    <div className="self-hosted-coaching__heading"><Sparkles aria-hidden="true" size={22} /><h2 id={titleId}>내 기록 AI 풀이</h2></div>
    <p>선택한 기록을 회사가 관리하는 서버의 AI로 살펴봐요.</p>
    {!ownerId ? <p role="status">로그인 후 내 계정의 확인된 기록을 선택할 수 있어요.</p> : <>
      {busy === "status" && <p role="status">현재 계정의 동의와 기록 출처를 확인하고 있어요.</p>}
      {status && <>
        {!status.capability.enabled && <p className="self-hosted-coaching__notice" role="status">{reason(status.capability.reason)}. 아직 AI 풀이를 요청할 수 없어요.</p>}
        {mode === "coach" && <fieldset disabled={!ready || busy !== null}>
          <legend>풀이할 기록 <span>최대 20개</span></legend>
          {status.records.length === 0 ? <p>풀이할 수 있는 계정 기록이 아직 없어요.</p> : status.records.map(record => <label className="self-hosted-coaching__record" key={record.documentId}>
            <input type="checkbox" checked={selected.includes(record.documentId)} disabled={!record.eligible || record.reason !== "READY" || (selected.length === 20 && !selected.includes(record.documentId))}
              onChange={event => { setResult(null); setAccepted(false); setSelected(previous => event.target.checked ? [...previous, record.documentId] : previous.filter(id => id !== record.documentId)) }} />
            <span><strong>{record.date} · {record.label}</strong><small>출처: {record.provider} · 수정 {record.revision}</small>
              {(!record.eligible || record.reason !== "READY") && <small>{reason(record.reason)}</small>}</span>
          </label>)}
        </fieldset>}
        {mode === "coach" && <>
          <div className="self-hosted-coaching__purpose">
            <p>목적: 선택한 운동 기록의 사실 요약과 설명. 계정에 보관된 확인된 수치와 출처만 사용해요. 메모 원문·통증 내용은 AI 입력에서 제외해요.</p>
            <p>입력과 풀이는 이번 요청 처리에만 사용하며 모델 학습·평가·장기 AI 기억에 보관하지 않아요. 동의는 언제든 철회할 수 있어요.</p>
            <label className="self-hosted-coaching__consent"><input type="checkbox" checked={accepted} disabled={!ready || busy !== null || selected.length === 0}
              onChange={event => setAccepted(event.target.checked)} /><span>선택한 {selected.length}개 기록을 이 목적으로 AI 처리하는 데 동의해요.</span></label>
          </div>
          <button type="button" className="self-hosted-coaching__primary" disabled={!canExplain} onClick={() => void explain()}>
            {busy === "consent" ? "동의 확인 중…" : busy === "infer" ? "기록을 살펴보는 중…" : "선택한 기록 풀이 보기"}
          </button>
        </>}
      </>}
      {busy === "infer" && <button type="button" onClick={cancel}>풀이 요청 취소</button>}
      {consent?.active && <button type="button" disabled={busy === "withdraw" || busy === "consent"} onClick={() => void withdraw()}>{busy === "withdraw" ? "철회 확인 중…" : "AI 풀이 동의 철회"}</button>}
      {result && <div className="self-hosted-coaching__result">
        <h3 tabIndex={-1} ref={resultHeading}>선택한 기록의 AI 풀이</h3><p>{result.summary}</p>
        <dl>{result.facts.map(fact => <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value} {fact.unit}</dd>
          <small>근거: {fact.sourceDocumentIds.map(id => status?.records.find(record => record.documentId === id)?.date ?? "선택 기록").join(", ")}</small></div>)}</dl>
        <p className="self-hosted-coaching__boundary">훈련 계획과 몸 상태 판단은 바뀌지 않았어요. 다음 행동은 기존 화면에서 직접 확인해요.</p>
        {result.attribution.map(item => <p className="self-hosted-coaching__attribution" key={item}>{item}</p>)}
        <details ref={sourceDetails}><summary ref={sourceSummary} tabIndex={0}>이 풀이에 사용한 기록</summary><ul className="self-hosted-coaching__sources">{result.sourceDocumentIds.map(id => {
          const record = status?.records.find(item => item.documentId === id)
          return <li key={id}>{record ? <><span>{record.date} · {record.label} · {record.provider}</span>
            {record.journalEntryId ? <button type="button" onClick={() => reviewSource(id)} aria-label={`${record.date} ${record.label} 일지 열기`}>해당 일지 열기</button> : <small>원본 일지 위치를 확인하지 못했어요.</small>}</> : "선택 기록"}</li>
        })}</ul><p>이 화면의 풀이는 계정 기록이나 모델 기억에 저장하지 않아요.</p></details>
        <div className="self-hosted-coaching__actions">{result.actions.map(action => <button type="button" key={action.id}
          disabled={action.id === "REVIEW_JOURNAL" && !result.sourceDocumentIds.some(id => status?.records.find(record => record.documentId === id)?.journalEntryId)}
          onClick={action.id === "REVIEW_JOURNAL" ? reviewJournal : onReviewPlan}>{action.id === "REVIEW_JOURNAL" ? "일지에서 확인" : "기존 훈련 계획 확인"}</button>)}</div>
      </div>}
      {notice && <p className="self-hosted-coaching__notice" role="status">{notice}</p>}
      {busy === null && <button type="button" className="self-hosted-coaching__refresh" onClick={() => void refresh()}>현재 상태 다시 확인</button>}
    </>}
  </section>
}
