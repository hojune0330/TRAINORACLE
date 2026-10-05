import React from "react"
import { ArrowLeft, Copy, RefreshCw, X } from "lucide-react"
import { ORACLE_AXES, ORACLE_QUESTIONS, type OracleQuestionId } from "../domain/oracle-profile-v2"
import type { OracleProfileRevision } from "../domain/oracle-profile-snapshot"
import { requestProfileComparison } from "../domain/account/oracle-profile-comparison-api"
import type { ProfileComparisonRequest, ProfileComparisonResponse } from "../domain/account/oracle-profile-comparison-contract"
import "./oracle-friend-comparison-v2.css"
import "./oracle-connected-comparison.css"

export interface OracleConnectedComparisonProps {
  ownerId: string
  documentId: string
  /** Server CAS revision, not the inner profile revision. */
  documentRevision: number
  ownProfile: OracleProfileRevision | null
  onBack: () => void
  /** Parent may forward a link fragment after login. Never accepted automatically. */
  invitationCode?: string
}

export function comparisonExpiry(preset: "today" | "week", now = Date.now()) {
  if (preset === "week") return new Date(now + 7 * 86400000).toISOString()
  const kst = new Date(now + 9 * 3600000)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1) - 9 * 3600000 - 1).toISOString()
}
const dateLabel = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " (한국시간)"
export function readComparisonInvitation(value: string) {
  if (/^[A-Za-z0-9_-]{43}$/u.test(value.trim())) return value.trim()
  try { return new URLSearchParams(new URL(value).hash.slice(1)).get("oracle-compare-invite") ?? "" } catch { return "" }
}
type Invitation = { comparisonId: string; expiresAt: string; accepted: boolean; code?: string }
type Stage = "start" | "receive" | "fields" | "review" | "waiting" | "ready" | "share" | "share-review"

export function OracleConnectedComparison(props: OracleConnectedComparisonProps) {
  return <ConnectedComparisonSession key={props.ownerId} {...props} />
}
function ConnectedComparisonSession({ ownerId, documentId, documentRevision, ownProfile, onBack, invitationCode }: OracleConnectedComparisonProps) {
  const initialCode = invitationCode ?? new URLSearchParams(window.location.hash.slice(1)).get("oracle-compare-invite") ?? ""
  const [stage, setStage] = React.useState<Stage>(initialCode ? "receive" : "start")
  const [code, setCode] = React.useState(initialCode)
  const [invitation, setInvitation] = React.useState<Invitation | null>(null)
  const [fields, setFields] = React.useState<OracleQuestionId[]>([])
  const [expires, setExpires] = React.useState(() => comparisonExpiry("today"))
  const [preset, setPreset] = React.useState<"today" | "week">("today")
  const [consent, setConsent] = React.useState(false)
  const [shareFields, setShareFields] = React.useState<OracleQuestionId[]>([])
  const [shareConsent, setShareConsent] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<ProfileComparisonResponse | null>(null)
  const [revoked, setRevoked] = React.useState(false)
  const [externalRevoked, setExternalRevoked] = React.useState(false)
  const live = React.useRef(true), operation = React.useRef(0)
  const source = JSON.stringify([ownerId, documentId, documentRevision, ownProfile?.revision])
  const sourceRef = React.useRef(source); sourceRef.current = source
  React.useEffect(() => { live.current = true; return () => { live.current = false; operation.current++ } }, [])
  React.useEffect(() => {
    operation.current++; setResult(null); setBusy(false); setConsent(false); setShareConsent(false)
  }, [source])
  React.useEffect(() => {
    const clear = () => { operation.current++; setResult(null); setBusy(false) }
    const hidden = () => { if (document.hidden) clear() }
    window.addEventListener("blur", clear); document.addEventListener("visibilitychange", hidden)
    return () => { window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", hidden) }
  }, [])
  React.useEffect(() => {
    if (!result || (result.kind !== "comparison" && result.kind !== "export")) return
    const timer = window.setTimeout(() => setResult(null), Math.max(0, Math.min(30_000, Date.parse(result.validUntil) - Date.now())))
    return () => window.clearTimeout(timer)
  }, [result])
  const clear = () => { operation.current++; setResult(null); setMessage(""); setBusy(false) }
  const send = async (request: ProfileComparisonRequest) => {
    const number = ++operation.current, captured = sourceRef.current
    setResult(null); setBusy(true); setMessage("")
    const current = () => live.current && number === operation.current && captured === sourceRef.current
    const response = await requestProfileComparison(ownerId, request, current)
    if (!current()) return
    setBusy(false)
    if (!response.ok) {
      setMessage(request.action === "revoke" || request.action === "revokeExternal"
        ? "화면의 결과는 지웠지만 서버 철회는 아직 확인하지 못했어요. 철회를 다시 시도해 주세요."
        : "서버에서 권한을 확인하지 못했어요. 초대 만료, 양측 동의와 저장된 프로필을 확인해 주세요.")
      return
    }
    const data = response.data
    if (data.kind === "invitation-created") {
      setInvitation({ comparisonId: data.comparisonId, expiresAt: data.expiresAt, accepted: false, code: data.invitationCode }); setStage("waiting")
    } else if (data.kind === "invitation") {
      setInvitation(previous => ({ comparisonId: data.comparisonId, expiresAt: data.expiresAt, accepted: data.accepted, code: previous?.code ?? readComparisonInvitation(code) }))
      setExpires(data.expiresAt); setConsent(false); setStage(data.accepted ? (fields.length ? "review" : "fields") : "waiting")
      setMessage(data.accepted ? "초대가 연결됐어요. 아직 비교에 동의한 것은 아니에요." : "상대가 초대를 받을 때까지 기다려 주세요.")
    } else if (data.kind === "consented") {
      setStage("ready"); setMessage("내 비교 동의를 등록했어요. 상대도 직접 동의해야 결과를 볼 수 있어요.")
    } else if (data.kind === "external-consented") {
      setStage("ready"); setMessage("내 외부 공유 동의를 등록했어요. 상대의 별도 동의도 필요해요.")
    } else if (data.kind === "revoked" || data.kind === "external-revoked") {
      setMessage(data.kind === "revoked" ? "서버에서 비교 철회를 확인했어요." : "서버에서 외부 공유 철회를 확인했어요.")
    } else { setResult(data) }
  }
  const withdraw = (external: boolean) => {
    if (!invitation) return
    clear(); setShareConsent(false); setExternalRevoked(true); setStage("ready")
    if (!external) { setRevoked(true); setConsent(false); setFields([]); setShareFields([]); setCode(""); setInvitation({ ...invitation, code: undefined }) }
    void send({ action: external ? "revokeExternal" : "revoke", comparisonId: invitation.comparisonId })
  }
  const submitConsent = () => {
    if (!invitation || !ownProfile || !consent) return
    void send({ action: "consent", comparisonId: invitation.comparisonId, documentId, documentRevision,
      profileRevision: ownProfile.revision, questionVersion: ownProfile.questionVersion, scoreVersion: ownProfile.scoreVersion, fields, expiresAt: invitation.expiresAt })
  }
  const selection = (sharing: boolean) => <fieldset disabled={busy || revoked}><legend>{sharing ? "외부 공유할 문항" : "비교할 내 문항"}</legend>
    {ORACLE_AXES.map(axis => {
      const questions = ORACLE_QUESTIONS.filter(q => q.axisId === axis.id && (sharing ? fields.includes(q.id) : typeof ownProfile?.answers[q.id] === "number"))
      return questions.length ? <details key={axis.id} open><summary>{axis.label}</summary>{questions.map(q => <label className="oracle-friend__permission" key={q.id}>
        <input type="checkbox" checked={(sharing ? shareFields : fields).includes(q.id)} onChange={event => {
          clear(); setConsent(false); setShareConsent(false)
          const selected = sharing ? shareFields : fields, next = event.target.checked ? [...selected, q.id] : selected.filter(f => f !== q.id)
          if (sharing) setShareFields(next); else { setFields(next); setShareFields([]) }
        }} /><span>{q.text}</span>
      </label>)}</details> : null
    })}
  </fieldset>
  const selectedList = (selected: OracleQuestionId[]) => <ul>{ORACLE_QUESTIONS.filter(q => selected.includes(q.id)).map(q => <li key={q.id}>{q.text}</li>)}</ul>
  const invitationLink = invitation?.code ? (() => { const link = new URL(window.location.href); link.hash = new URLSearchParams({ "oracle-compare-invite": invitation.code }).toString(); return link.toString() })() : ""
  const copyLink = () => {
    if (!navigator.clipboard) { setMessage("복사를 사용할 수 없어요. 아래 초대 코드를 전달해 주세요."); return }
    void navigator.clipboard.writeText(invitationLink).then(() => setMessage("초대 링크를 복사했어요."), () => setMessage("복사하지 못했어요. 아래 초대 코드를 전달해 주세요."))
  }
  return <section className="oracle-friend oracle-connected" aria-label="계정 친구 비교">
    <header className="oracle-friend__header"><button type="button" aria-label="친구 비교 닫기" title="닫기" onClick={() => { clear(); onBack() }}><ArrowLeft size={20} aria-hidden="true" /></button><span>오라클 · 친구 비교</span></header>
    <div className="oracle-friend__body">
      {!ownProfile && <p role="status">먼저 내 러닝 프로필을 계정에 저장해 주세요.</p>}
      {stage === "start" && <><h2>함께 답을 비교해 볼까요?</h2><div className="oracle-connected__actions">
        <button type="button" disabled={!ownProfile} onClick={() => setStage("fields")}>비교 초대 만들기</button>
        <button type="button" disabled={!ownProfile} onClick={() => setStage("receive")}>초대 받았어요</button>
      </div></>}
      {stage === "receive" && <><h2>받은 초대</h2><label className="oracle-friend__field">초대 링크 또는 코드<input autoComplete="off" value={code} onChange={e => setCode(e.target.value)} /></label>
        <p>내 계정으로 초대를 받을게요. 응답 비교와 외부 공유는 아직 허락하지 않아요.</p>
        <button type="button" disabled={busy || !ownProfile || !/^[A-Za-z0-9_-]{43}$/u.test(readComparisonInvitation(code))} onClick={() => { void send({ action: "acceptInvite", invitationCode: readComparisonInvitation(code) }) }}>이 계정으로 초대 받기</button>
      </>}
      {stage === "fields" && <><h2>비교할 문항 선택</h2>{selection(false)}
        {!invitation && <fieldset><legend>초대와 비교 기간</legend><div className="oracle-connected__presets">{(["today", "week"] as const).map(value => <label key={value}><input type="radio" name="comparison-expiry" checked={preset === value} onChange={() => { setPreset(value); setExpires(comparisonExpiry(value)) }} />{value === "today" ? "오늘까지" : "7일"}</label>)}</div></fieldset>}
        <p>{dateLabel(invitation?.expiresAt ?? expires)}까지</p>
        <button type="button" disabled={busy || !fields.length} onClick={() => { setConsent(false); setStage("review") }}>선택 확인</button>
      </>}
      {stage === "review" && <><h2>{invitation ? "내 비교 동의 확인" : "초대 내용 확인"}</h2>{selectedList(fields)}<p>{dateLabel(invitation?.expiresAt ?? expires)}까지</p>
        <p>같은 버전에서 두 사람이 모두 허락한 문항만 비교해요. 원문 메모와 능력·궁합 점수는 포함하지 않아요.</p>
        {invitation ? <><p>초대를 주고받은 상대가 맞는지 대화에서 확인해 주세요. 이 화면은 상대의 실명을 확인하지 않아요.</p>
          <label className="oracle-friend__permission"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>선택한 내 응답을 이 상대와 비교하는 데 동의해요.</span></label>
          <button type="button" disabled={busy || !consent || !fields.length || revoked} onClick={submitConsent}>비교에 동의하기</button></>
          : <><p>상대가 초대를 받은 뒤, 나와 상대가 각각 동의해야 비교할 수 있어요.</p><button type="button" disabled={busy || Date.parse(expires) <= Date.now()} onClick={() => { void send({ action: "createInvite", expiresAt: expires }) }}>초대 링크 만들기</button></>}
        <button type="button" disabled={busy} onClick={() => { setConsent(false); setStage("fields") }}>문항 다시 선택</button>
      </>}
      {stage === "waiting" && <><h2>친구에게 초대를 보내 주세요</h2><p>{dateLabel(invitation!.expiresAt)}까지</p>
        <p>링크는 믿을 수 있는 상대 한 명에게만 보내 주세요. 먼저 로그인해 받은 계정에 연결되며, 링크만으로 응답을 볼 수는 없어요.</p>
        <button type="button" onClick={copyLink}><Copy size={18} aria-hidden="true" />초대 링크 복사</button>
        <details><summary>코드로 전달하기</summary><p className="oracle-connected__code">{invitation?.code}</p></details>
        <button type="button" disabled={busy} onClick={() => { void send({ action: "invitationStatus", comparisonId: invitation!.comparisonId }) }}><RefreshCw size={18} aria-hidden="true" />초대 수락 확인</button>
      </>}
      {stage === "ready" && !revoked && <><h2>서로 허락한 응답</h2><p>{dateLabel(invitation!.expiresAt)}까지</p>
        <button type="button" disabled={busy} onClick={() => { void send({ action: "compare", comparisonId: invitation!.comparisonId }) }}><RefreshCw size={18} aria-hidden="true" />비교 확인</button>
        <details><summary>외부 공유</summary><p>비교 동의와 별개예요. 두 사람 모두 문항과 기간을 허락해야 공유할 내용을 볼 수 있어요. 이미 복사한 내용은 철회해도 회수할 수 없어요.</p>
          <button type="button" disabled={busy || externalRevoked} onClick={() => { clear(); setShareConsent(false); setStage("share") }}>공유할 문항 선택</button>
          <button type="button" disabled={busy || externalRevoked} onClick={() => { void send({ action: "export", comparisonId: invitation!.comparisonId }) }}>허용된 공유 사실 확인</button>
          <button type="button" onClick={() => withdraw(true)}>외부 공유 철회</button>
        </details>
      </>}
      {stage === "share" && <><h2>외부 공유할 문항</h2>{selection(true)}<button type="button" disabled={busy || !shareFields.length} onClick={() => setStage("share-review")}>공유 내용 확인</button></>}
      {stage === "share-review" && <><h2>외부 공유 동의 확인</h2>{selectedList(shareFields)}<p>{dateLabel(invitation!.expiresAt)}까지</p><p>위 문항의 같은 답·다른 답만 공유해요. 이미 외부에 복사한 내용은 회수할 수 없어요.</p>
        <label className="oracle-friend__permission"><input type="checkbox" checked={shareConsent} onChange={e => setShareConsent(e.target.checked)} /><span>선택한 비교 사실의 외부 공유에 별도로 동의해요.</span></label>
        <button type="button" disabled={busy || !shareConsent || externalRevoked} onClick={() => { void send({ action: "allowExternal", comparisonId: invitation!.comparisonId, fields: shareFields, expiresAt: invitation!.expiresAt }) }}>외부 공유에 동의하기</button>
        <button type="button" disabled={busy} onClick={() => { setShareConsent(false); setStage("ready") }}>취소</button>
      </>}
      <p role="status" aria-live="polite">{busy ? "확인 중이에요." : message}</p>
      {!revoked && result?.kind === "comparison" && <article aria-label="서버 확인 비교 결과"><h2>같은 답과 다른 답</h2><p>비교 가능한 숫자 응답 {result.comparedCount}개 중 같은 답 {result.matchingCount}개</p>
        <dl>{result.rows.map(row => <div key={row.questionId}><dt>{row.label}</dt><dd>{row.same ? "같은 답" : "다른 답"}</dd></div>)}</dl>
        <p>모름·상황별·경험 없음·건너뜀·미응답은 제외했어요.</p></article>}
      {!revoked && !externalRevoked && result?.kind === "export" && <div role="region" aria-label="서버 확인 공유 사실" className="oracle-friend__export">{result.text}</div>}
      {invitation && <div className="oracle-connected__withdraw"><button type="button" onClick={() => withdraw(false)}><X size={16} aria-hidden="true" />{revoked ? "비교 철회 다시 확인" : "초대·비교 철회"}</button></div>}
    </div>
  </section>
}
