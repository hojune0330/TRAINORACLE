import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { loadSyncConsent, previewSync, saveSyncConsent, syncNow } from "../../domain/account/sync"
import type { SyncConsent, SyncOutcome, SyncPreviewOutcome } from "../../domain/account/sync"
import { localOnlyCount } from "../../domain/journal-store"
import { productFeatures } from "../../domain/product-features"
import { mono, primaryBtn } from "./styles"

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
  const [consent, setConsent] = React.useState<SyncConsent>(() => loadSyncConsent())
  const [message, setMessage] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [preview, setPreview] = React.useState<SyncPreviewOutcome | null>(null)

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
    setConsent(next)
    setPreview(null)
    saveSyncConsent(next)
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
        이 기기에 있는 일지 {localOnlyCount()}개를 계정에 백업하고 다른 기기의 일지와 합쳐요. 같은 일지는 더 최근에 저장한 쪽이 남아요.
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
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, minHeight: 44, opacity: consent.enabled ? 1 : 0.45 }}>
        <input
          type="checkbox"
          checked={consent.shareTrainingNotes}
          disabled={!consent.enabled}
          onChange={(event) => updateConsent({ ...consent, shareTrainingNotes: event.target.checked })}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <span style={{ fontFamily: "var(--sans)", fontSize: 13, lineHeight: 1.5 }}>
          {sharingEnabled ? "훈련 메모를 계정과 코치에게 공유" : "훈련 메모를 계정에 백업"}
          <br />
          <small style={{ ...mono, color: "var(--ink-4)" }}>
            {sharingEnabled
              ? "나만의 메모는 이 설정과 관계없이 원문을 보내지 않아요."
              : "코치 연결은 아직 열지 않았어요. 나만의 메모 원문은 보내지 않아요."}
          </small>
        </span>
      </label>
      {preview === null ? (
        <button type="button" style={primaryBtn} disabled={busy || !consent.enabled} onClick={() => void preparePreview()}>
          {busy ? "확인 중…" : "합칠 내용 미리보기"}
        </button>
      ) : (
        <>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            이 기기 {preview.localCount}개 · 계정 일지 {preview.remoteJournalCount}개 · 암호화된 나만의 메모 {preview.remotePrivateCount}개
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
