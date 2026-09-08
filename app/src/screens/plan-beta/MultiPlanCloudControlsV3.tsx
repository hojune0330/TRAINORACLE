import React from "react"
import { CloudDownload, CloudUpload } from "lucide-react"
import { activeLocalAccount } from "../../domain/account/local-journal-ownership"
import { planCloudBackupEnabled } from "../../domain/account/plan-cloud-backup"
import { backupMultiPlanSnapshotV3, loadLatestMultiPlanSnapshotV3, restoreMultiPlanServerHistoryV3 } from "../../domain/account/multi-plan-cloud-backup-v3"
import type { RetainedMultiAdjustedEvidenceV3 } from "../../domain/selected-multi-adjusted-plan-v3"
import { restoreMultiPlanAsCurrentV3 } from "../../domain/multi-plan-active-restore-v3"
import type { MultiAdjustedLiveReviewV3, StoredMultiAdjustedPlanStateV6 } from "../../domain/adjusted-plan-storage-v6"
import type { PlanCurrentCheck } from "../../domain/plan-beta-flow"

export function MultiPlanCloudControlsV3({ fingerprint, readEvidence, readRestoreReview, onCurrentRestored }: {
  readonly fingerprint: string | null; readonly readEvidence: () => readonly RetainedMultiAdjustedEvidenceV3[];
  readonly readRestoreReview?: (state: StoredMultiAdjustedPlanStateV6) => MultiAdjustedLiveReviewV3;
  readonly onCurrentRestored?: () => void;
}) {
  const [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState<string | null>(null)
  const [snapshot, setSnapshot] = React.useState<Extract<Awaited<ReturnType<typeof loadLatestMultiPlanSnapshotV3>>, { kind: "read_only" }> | null>(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [restoreConfirmed, setRestoreConfirmed] = React.useState(false)
  const [check, setCheck] = React.useState<PlanCurrentCheck | null>(null)
  const mounted = React.useRef(false), pending = React.useRef(false)
  const latest = React.useRef({ fingerprint, owner: activeLocalAccount() })
  latest.current = { fingerprint, owner: activeLocalAccount() }
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  React.useEffect(() => { setSnapshot(null); setConfirmed(false); setRestoreConfirmed(false); setCheck(null); setMessage(null) }, [fingerprint])
  const run = async (action: (current: () => boolean) => Promise<void>) => {
    if (pending.current) return
    const opened = latest.current
    const current = () => mounted.current && latest.current.fingerprint === opened.fingerprint
      && latest.current.owner === opened.owner && activeLocalAccount() === opened.owner && planCloudBackupEnabled()
    pending.current = true; setBusy(true); setMessage(null)
    try { await action(current) }
    catch { if (current()) setMessage("서버 요청을 마치지 못했어요. 이 기기의 계획은 그대로예요.") }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  if (!planCloudBackupEnabled()) return null
  return <section aria-label="서버 계획 보관">
    <p>개인 계획과 진행 상태를 내 계정에 보관해요. 원본 불러오기는 현재 일정을 바꾸지 않아요.</p>
    {fingerprint !== null && <button type="button" disabled={busy} onClick={() => void run(async current => {
      const result = await backupMultiPlanSnapshotV3(fingerprint, readEvidence)
      if (current()) setMessage(result.kind === "saved" ? "이 계획을 내 계정에 보관했어요." : "서버 보관을 확인하지 못했어요. 이 기기의 계획은 그대로예요.")
    })}><CloudUpload size={18} aria-hidden="true" />내 계정에 계획 보관</button>}
    <button type="button" disabled={busy} onClick={() => void run(async current => {
      setSnapshot(null); setConfirmed(false); setRestoreConfirmed(false); setCheck(null)
      const result = await loadLatestMultiPlanSnapshotV3(readEvidence)
      if (!current()) return
      if (result.kind === "read_only") setSnapshot(result)
      else if (result.kind === "conflict") setMessage("같은 시각에 저장된 계획이 둘 이상이에요. 최근 계획을 임의로 고르지 않았어요. 원래 사용한 기기의 일정을 확인해 주세요.")
      else setMessage("불러올 수 있는 서버 계획을 확인하지 못했어요.")
    })}><CloudDownload size={18} aria-hidden="true" />서버의 최근 원본 확인</button>
    {snapshot && <div>
      <p>{snapshot.state.selection.intake.startDate} 시작 · 진행 기록 {snapshot.state.progress.length}건</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />현재 일정은 유지하고 이 원본을 보관함에 추가해요.</label>
      <button type="button" disabled={busy || !confirmed} onClick={() => void run(async current => {
        const result = await restoreMultiPlanServerHistoryV3({ snapshot, confirmsRestore: confirmed, readEvidence, isCurrentRequest: current })
        if (!current()) return
        setMessage(result.kind === "restored_history" ? "원본을 보관함에 추가했어요. 현재 일정은 그대로예요." : "원본을 복원하지 못했어요. 현재 일정은 그대로예요.")
        if (result.kind === "restored_history") { setSnapshot(null); setConfirmed(false) }
      })}>원본 보관함에 추가</button>
      {fingerprint === null && <>
        <fieldset><legend>지금 몸 상태는 어떤가요?</legend>
          <label><input type="radio" name="restore-current-check" disabled={busy} checked={check === "NO_KNOWN_RISK"} onChange={() => setCheck("NO_KNOWN_RISK")} />알고 있는 통증이나 이상이 없어요</label>
          <label><input type="radio" name="restore-current-check" disabled={busy} checked={check === "REVIEW_REQUIRED"} onChange={() => setCheck("REVIEW_REQUIRED")} />통증·이상이 있거나 잘 모르겠어요</label>
        </fieldset>
        <label><input type="checkbox" disabled={busy} checked={restoreConfirmed} onChange={e => setRestoreConfirmed(e.target.checked)} />원래 날짜와 진행 기록을 유지해 현재 일정으로 불러와요.</label>
        <button type="button" disabled={busy || !restoreConfirmed || check === null || !readRestoreReview} onClick={() => void run(async current => {
          if (check === null || !readRestoreReview) return
          const result = await restoreMultiPlanAsCurrentV3({ ownerId: snapshot.ownerId, state: snapshot.state,
            confirmsRestore: restoreConfirmed, currentCheck: check, isCurrentRequest: current,
            readReview: () => readRestoreReview(snapshot.state) })
          if (!current()) return
          if (result.kind === "restored_current") { setMessage("현재 일정으로 불러왔어요."); onCurrentRestored?.() }
          else setMessage("현재 일정으로 복구하지 못했어요. 몸 상태·훈련 근거·이 기기의 다른 일정을 확인해 주세요.")
        })}>현재 일정으로 불러오기</button>
        {!readRestoreReview && <p>현재 훈련 근거를 다시 확인하는 연결을 준비 중이에요. 원본 보관함 복원은 사용할 수 있어요.</p>}
      </>}
    </div>}
    {message && <p role="status">{message}</p>}
  </section>
}
