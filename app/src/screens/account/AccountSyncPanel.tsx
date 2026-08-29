import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { loadSyncConsent, previewSync, saveSyncConsent, syncNow } from "../../domain/account/sync"
import type { SyncConsent, SyncOutcome, SyncPreviewOutcome } from "../../domain/account/sync"
import { loadEntriesOwnedBy } from "../../domain/journal-store"
import { productFeatures } from "../../domain/product-features"
import { mono, primaryBtn } from "./styles"
import { TermHelp } from "../../components/TermHelp"

export function AccountSyncPanel({
  userId,
  enabled = productFeatures().sync,
  sharingEnabled = productFeatures().sharing,
  onPreview = previewSync,
  onSync = syncNow,
}: {
  readonly userId: string
  readonly enabled?: boolean
  readonly sharingEnabled?: boolean
  readonly onPreview?: (userId: string) => Promise<SyncPreviewOutcome>
  readonly onSync?: (userId: string) => Promise<SyncOutcome>
}) {
  const [consent, setConsent] = React.useState<SyncConsent>(() => loadSyncConsent(userId))
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [preview, setPreview] = React.useState<SyncPreviewOutcome | null>(null)

  React.useEffect(() => {
    setConsent(loadSyncConsent(userId))
    setPreview(null)
    setMessage(null)
  }, [userId])

  if (!enabled) {
    return (
      <div>
        <SectionLb>일지 동기화</SectionLb>
        <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
          동기화만 잠시 닫혀 있어요. 이 기기의 일지 쓰기와 보기는 그대로 사용할 수 있어요.
        </p>
      </div>
    )
  }

  const updateConsent = (next: SyncConsent) => {
    const structuredOnly = { ...next, shareTrainingNotes: false }
    setConsent(structuredOnly)
    setPreview(null)
    saveSyncConsent(structuredOnly, userId)
  }

  const synchronize = async () => {
    setBusy(true)
    setMessage(null)
    const outcome = await onSync(userId)
    setBusy(false)
    if (!outcome.ok) {
      setMessage(outcome.message)
      return
    }
    setPreview(null)
    const deletedPart = outcome.deleted > 0 ? ` · ${outcome.deleted}개 삭제 반영` : ""
    setMessage(`${outcome.message} (서버 ${outcome.pulled}개 확인 · ${outcome.pushed}개 백업${deletedPart} · 총 ${outcome.total}개)`)
  }

  const preparePreview = async () => {
    setBusy(true)
    setMessage(null)
    const outcome = await onPreview(userId)
    setBusy(false)
    setPreview(outcome.ok ? outcome : null)
    setMessage(outcome.ok ? null : outcome.message)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>일지 동기화</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
        이 계정에 연결된 이 기기 일지 {loadEntriesOwnedBy(userId).filter((entry) => entry.syncState === "local").length}개를 백업하고
        다른 기기의 일지와 합쳐요. 기록을 안전하게 남기려면 동기화를 켜 두는 걸 권해요. 연결하지 않은 기기 일지와 다른 계정의 일지는 보내지 않아요.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={consent.enabled}
          onChange={(event) => updateConsent({ ...consent, enabled: event.target.checked })}
          style={{ width: 20, height: 20 }}
        />
        <span style={{ fontFamily: "var(--sans)", fontSize: 14 }}>동기화 켜기</span>
      </label>
      <p style={{ ...mono, color: "var(--ink-4)", fontSize: 11, lineHeight: 1.6, margin: 0 }}>
        거리·시간·RPE<TermHelp term="rpe" /> 같은 입력값만 백업해요. 훈련 메모와 나만의 메모 원문은 보내지 않아요.
        {sharingEnabled ? " 코치 공유는 동기화와 따로 선택해요." : " 코치 연결은 아직 열지 않았어요."}
      </p>
      {preview === null ? (
        <button type="button" style={primaryBtn} disabled={busy || !consent.enabled} onClick={() => void preparePreview()}>
          {busy ? "확인 중…" : "합칠 내용 미리보기"}
        </button>
      ) : (
        <>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            이 기기 {preview.localCount}개 · 계정 일지 {preview.remoteJournalCount}개
          </p>
          <button type="button" style={primaryBtn} disabled={busy} onClick={() => void synchronize()}>
            {busy ? "합치는 중…" : "확인한 내용 합치기"}
          </button>
        </>
      )}
      {message !== null && <p role="status" style={{ ...mono, fontSize: 12, color: "var(--ink-2)", margin: 0 }}>{message}</p>}
    </div>
  )
}
