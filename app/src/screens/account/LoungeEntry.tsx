import React from "react"
import { ChevronDown } from "lucide-react"
import "../../components/InfoDisclosure.css"
import { onAuthChange } from "../../domain/account/auth"
import { createTrainOracleLoungeClient, type LoungeStatus } from "../../domain/lounge/adapter"
import { loungeConfig } from "../../domain/lounge/config"
import { clearPendingLoungeLink, loungeEntryIntent } from "../../domain/lounge/entry-intent"
import { runDraftSafeNavigation } from "../../domain/unsaved-draft-navigation"
import { primaryBtn, secondaryBtn } from "./styles"

export function LoungeEntry({ userId, requested = false, onNavigate = url => window.location.assign(url) }: {
  readonly userId: string
  readonly requested?: boolean
  readonly onNavigate?: (url: string) => void
}) {
  const [config] = React.useState(loungeConfig)
  const [expanded, setExpanded] = React.useState(requested)
  const [linkToken, setLinkToken] = React.useState(() => loungeEntryIntent().linkToken)
  const [accepted, setAccepted] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState(false)
  const [status, setStatus] = React.useState<LoungeStatus | null>(null)
  const [notice, setNotice] = React.useState<string | null>(() => {
    const intent = loungeEntryIntent()
    return intent.linkRequested && !intent.linkToken
      ? "로그인을 마친 뒤 라운지의 ‘계정 연결’에서 다시 시작해 주세요. 연결 정보는 로그인 이동 중 보관하지 않아요." : null
  })
  const [busy, setBusy] = React.useState(false)
  const [blocked, setBlocked] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const generation = React.useRef(0)
  const noticeVersion = React.useRef<string | null>(null)
  const request = React.useRef<AbortController | null>(null)
  const client = React.useMemo(() => config ? createTrainOracleLoungeClient({ config, expectedUserId: userId }) : null, [config, userId])

  React.useEffect(() => {
    clearPendingLoungeLink()
    const unsubscribe = onAuthChange(next => {
      if (next?.id === userId) {
        // A refresh of the same account does not lose an unsubmitted link or
        // explicit choices. Cancel only an outstanding request and re-read state.
        if (request.current) {
          generation.current++
          request.current.abort()
          setBusy(false)
          setRetry(value => value + 1)
        }
        return
      }
      generation.current++
      request.current?.abort()
      setBusy(false)
      setAccepted(false)
      setConfirmed(false)
      setLinkToken(null)
      clearPendingLoungeLink()
      setBlocked(true)
      setNotice("로그인 계정이 바뀌었어요. 내 계정에서 다시 열어 주세요.")
    }, { ignoreInitialSession: true })
    return () => { generation.current++; request.current?.abort(); unsubscribe() }
  }, [userId])

  React.useEffect(() => {
    if (!client || !expanded || blocked) return
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    const epoch = ++generation.current
    setStatus(null)
    void client.status(controller.signal).then(value => {
      if (generation.current === epoch && !controller.signal.aborted) {
        if (noticeVersion.current !== null && noticeVersion.current !== value.noticeVersion) setAccepted(false)
        noticeVersion.current = value.noticeVersion
        setStatus(value)
      }
    }).catch(() => {
      if (generation.current === epoch && !controller.signal.aborted) setNotice("라운지 상태를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.")
    }).finally(() => {
      if (request.current === controller) request.current = null
    })
    return () => { controller.abort() }
  }, [client, expanded, blocked, retry])

  const act = async (kind: "enter" | "link") => {
    if (!client || !status?.prepared || blocked || busy || kind === "enter" && !accepted || kind === "link" && (!confirmed || !linkToken)) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const epoch = ++generation.current
    setBusy(true)
    setNotice(null)
    try {
      if (kind === "link" && linkToken) {
        await client.link({ token: linkToken, confirmed, signal: controller.signal })
        if (generation.current !== epoch || controller.signal.aborted) return
        setLinkToken(null)
        setConfirmed(false)
        setAccepted(false)
        setNotice("계정 연결을 마쳤어요. 입장 안내를 확인하고 라운지를 열어 주세요.")
      } else {
        const destination = await client.enter({ noticeVersion: status.noticeVersion, accepted, signal: controller.signal })
        if (generation.current !== epoch || controller.signal.aborted) return
        if (!runDraftSafeNavigation(() => onNavigate(destination))) setNotice("작성 중인 내용을 먼저 확인해 주세요.")
      }
    } catch {
      if (generation.current === epoch && !controller.signal.aborted) setNotice("처리 결과를 확인하지 못했어요. 잠시 후 상태를 다시 확인해 주세요.")
    } finally {
      if (generation.current === epoch && !controller.signal.aborted) setBusy(false)
      if (request.current === controller) request.current = null
    }
  }

  if (!config) return null
  return (
    <section aria-labelledby="lounge-entry-heading" style={{ border: "1px solid var(--line)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <h2 id="lounge-entry-heading" style={{ fontFamily: "var(--sans)", fontSize: "var(--fs-body)", margin: 0 }}>함께 이야기하는 라운지</h2>
      {!expanded ? <button type="button" style={secondaryBtn} onClick={() => setExpanded(true)}>라운지 입장 안내</button> : (
        <>
          <p style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6, wordBreak: "keep-all" }}>공개 대화에서는 계속 사용하는 라운지 닉네임이 보여요. 익명 게시판이 아니며, 입장만으로 계정이 서로 연결되지 않아요. 일지와 건강 정보는 라운지에 보내지 않아요.</p>
          <details className="info-disclosure">
            <summary tabIndex={0}><span>계정 연결·정보 보관 안내</span><ChevronDown className="info-disclosure__chevron" size={16} aria-hidden="true" /></summary>
            <div className="info-disclosure__content">
              <p>TrainOracle 로그인 계정의 식별값과 참여 가능 여부를 공용 라운지에 전달해요. 이름·이메일·생년월일·일지·건강 정보는 추가로 보내지 않아요. 다른 서비스에서도 같은 라운지 프로필을 사용하는 계정 연결은 따로 확인받아요. 이미 다른 프로필에 연결돼 있다면 자동으로 합치지 않아요.</p>
              <p>TrainOracle에는 라운지 전용 입장 증명의 해시와 세션 연결에 필요한 최소 근거를 보관해요. 만료된 증명은 다음으로 성공한 일별 정리에서 지우고, 로그아웃이나 계정 삭제 시 해당 세션·계정과 함께 제거해요.</p>
            </div>
          </details>
          {notice && <p role="status" style={{ margin: 0, fontSize: "var(--fs-caption)", lineHeight: 1.6 }}>{notice}</p>}
          {!status && !notice && <p role="status">라운지 상태를 확인하고 있어요.</p>}
          {status && !status.prepared && <p role="status">라운지를 준비 중이에요. 잠시 후 다시 확인해 주세요.</p>}
          {status?.prepared && !blocked && (linkToken ? (
            <>
              <label style={{ minHeight: 44, display: "flex", alignItems: "center", gap: "var(--space-2)" }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />현재 로그인한 TrainOracle 계정을 라운지 계정에 연결할게요.</label>
              <button type="button" style={primaryBtn} disabled={busy || !confirmed} onClick={() => void act("link")}>{busy ? "연결 확인 중..." : "확인하고 계정 연결"}</button>
            </>
          ) : (
            <>
              <label style={{ minHeight: 44, display: "flex", alignItems: "center", gap: "var(--space-2)" }}><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} />닉네임이 보이는 공개 대화라는 안내를 확인했어요.</label>
              <button type="button" style={primaryBtn} disabled={busy || !accepted} onClick={() => void act("enter")}>{busy ? "입장 확인 중..." : "확인하고 라운지 열기"}</button>
            </>
          ))}
          {!blocked && <button type="button" style={secondaryBtn} disabled={busy} onClick={() => { setNotice(null); setAccepted(false); setConfirmed(false); setRetry(value => value + 1) }}>상태 다시 확인</button>}
        </>
      )}
    </section>
  )
}
