import React from "react"
import { loadAccountStorageConsent, saveAccountStorageConsent, STORAGE_CONSENT_VERSION } from "../../domain/account/storage-consent"
import type { StorageConsent } from "../../domain/account/storage-consent"
import { requestVerifiedAccountScopeRefresh } from "../../domain/account/verified-account-scope"
import { primaryBtn, secondaryBtn } from "./styles"
import { isStorageTransmissionHeld } from "../../domain/account/storage-transmission-hold"

export function StorageConsentPanel({ userId, load = loadAccountStorageConsent, save = saveAccountStorageConsent }: {
  readonly userId: string
  readonly load?: typeof loadAccountStorageConsent
  readonly save?: typeof saveAccountStorageConsent
}) {
  const [receipt, setReceipt] = React.useState<StorageConsent | null>(null)
  const [health, setHealth] = React.useState(false)
  const [text, setText] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [retry, setRetry] = React.useState(0)
  const currentOwner = React.useRef(userId)
  currentOwner.current = userId
  React.useEffect(() => {
    let active = true
    setReceipt(null); setHealth(false); setText(false); setBusy(true)
    void load(userId).then(result => {
      if (!active) return
      setBusy(false)
      if (!result.ok) { setNotice(result.message); return }
      setReceipt(result.consent)
      setHealth(result.consent.healthStorage); setText(result.consent.journalTextStorage)
      setNotice(isStorageTransmissionHeld(userId) ? "철회 결과를 확인하지 못해 이 기기의 전송은 멈춰 있어요. 서버 동의 철회를 다시 요청해 주세요." : !result.consent.operationsReady ? "온라인 보관은 운영 확인 전이라 열려 있지 않아요. 기기 기록과 내 자료 내려받기는 사용할 수 있어요." : result.consent.healthStorage && result.consent.journalTextStorage
        ? "선택한 범위로 온라인 보관을 사용할 수 있어요."
        : "온라인 보관은 꺼져 있어요. 기기 일지와 훈련 기능은 계속 사용할 수 있어요.")
    }).catch(() => { if (active) { setBusy(false); setNotice("동의 상태를 확인하지 못했어요. 다시 확인해 주세요.") } })
    return () => { active = false }
  }, [userId, load, retry])
  async function update(withdraw: boolean) {
    if (!receipt || busy) return
    setBusy(true)
    const result = await save(receipt, withdraw ? false : health, withdraw ? false : text)
      .catch(() => ({ ok: false as const, message: "서버의 변경 결과를 확인하지 못했어요. 다시 확인해 주세요." }))
    if (currentOwner.current !== userId) return
    setBusy(false)
    requestVerifiedAccountScopeRefresh()
    if (!result.ok) { setReceipt(null); setNotice(result.message); return }
    setReceipt(result.consent); setHealth(result.consent.healthStorage); setText(result.consent.journalTextStorage)
    setNotice(withdraw || !result.consent.healthStorage || !result.consent.journalTextStorage
      ? "서버에서 온라인 처리를 중단했어요. 기존 자료를 지우려면 아래 계정 삭제를 별도로 요청해 주세요."
      : "선택한 목적의 동의를 저장했어요. 기존 기기 기록은 별도로 선택해야 계정으로 옮겨져요.")
  }
  return <section className="account-panel" aria-busy={busy} aria-label="온라인 보관 동의">
    <h2 style={{ margin: 0, fontSize: "var(--fs-body)" }}>온라인 보관 · 선택 동의</h2>
    <p className="account-panel__body">기기 기록을 계정으로 보관·복구하려면 아래 두 목적을 각각 확인해 주세요. 동의하지 않아도 가입과 기기 일지·훈련 분석을 사용할 수 있어요.</p>
    <label className="account-panel__check" style={{ minHeight: 44 }}>
      <input type="checkbox" checked={health} disabled={busy || !receipt} onChange={event => setHealth(event.target.checked)} />
      <span>건강정보의 계정 보관·복구에 동의해요 (선택)</span>
    </label>
    <p className="account-panel__privacy">항목: 통증 부위·정도, 수면, 안정 시 심박, 체중, 회복·몸 상태와 관련 훈련 기록. 목적: 본인 기록 보관, 기기 간 복구와 본인이 요청한 기록 조회.</p>
    <label className="account-panel__check" style={{ minHeight: 44 }}>
      <input type="checkbox" checked={text} disabled={busy || !receipt} onChange={event => setText(event.target.checked)} />
      <span>메모·글의 계정 보관·복구에 동의해요 (선택)</span>
    </label>
    <p className="account-panel__privacy">항목: 일반·비밀 메모, 초안, 글 스티커 등 직접 작성한 글. 서버에서 암호화하며 서비스는 복구를 위해 복호화할 수 있어요. 비밀 글은 분석·공유에서 제외하고, 원문을 외부 AI에 보내지 않아요.</p>
    <p className="account-panel__privacy">하나의 일지에 두 종류가 함께 들어갈 수 있어 둘 다 동의한 때만 온라인 보관을 시작해요. 동의 버전 {STORAGE_CONSENT_VERSION}과 선택·시각을 서버에 기록해요. 현재 기록은 사용자가 삭제하거나 탈퇴 정리가 완료될 때까지, 교체본·휴지통은 서버 반영 시각부터 30일 보관해요. 철회는 온라인 처리 중단이며 즉시 삭제와 달라요. 삭제·백업 보유 조건은 개인정보처리방침에서 확인할 수 있어요.</p>
    <div className="account-panel__actions">
      <button type="button" style={primaryBtn} disabled={busy || !receipt?.operationsReady || !health || !text} onClick={() => void update(false)}>선택한 동의 저장</button>
      <button type="button" style={secondaryBtn} disabled={busy || !receipt} onClick={() => void update(true)}>온라인 보관 동의 철회</button>
      {!receipt && !busy && <button type="button" style={secondaryBtn} onClick={() => setRetry(value => value + 1)}>현재 상태 다시 확인</button>}
    </div>
    {notice && <p role="status" className="account-panel__status">{notice}</p>}
  </section>
}
