import React from "react"
import { ArrowLeft, FileUp } from "lucide-react"
import { readAdjustedPlanBackup } from "../../domain/adjusted-plan-backup"
import { importAdjustedPlanHistory } from "../../domain/adjusted-plan-import"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { readOperatingAdjustedEvidence } from "./AdjustedPlanNextFlow"
import type { RetainedAdjustedPlanEvidence } from "../../domain/selected-adjusted-plan-content"
import type { PlanMutationLockManager } from "../../domain/plan-mutation-lock"
import { readAdjustedPlanBackupV3, importAdjustedPlanHistoryV3 } from "../../domain/adjusted-plan-backup-v3"
import { RETAINED_ADJUSTED_PLAN_EVIDENCE_V3 } from "../../domain/adjusted-plan-storage-v5"
import type { RetainedAdjustedPlanEvidenceV3 } from "../../domain/selected-adjusted-plan-v3"
const operatingV3Evidence = () => RETAINED_ADJUSTED_PLAN_EVIDENCE_V3
import { readMultiAdjustedPlanBackupV3, importMultiAdjustedPlanHistoryV3 } from "../../domain/multi-adjusted-plan-backup-v3"
import { RETAINED_MULTI_ADJUSTED_EVIDENCE_V3 } from "../../domain/adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "../../domain/selected-multi-adjusted-plan-v3"
const operatingMultiV3Evidence = () => RETAINED_MULTI_ADJUSTED_EVIDENCE_V3

export function AdjustedPlanImport({ readEvidence = readOperatingAdjustedEvidence, readEvidenceV3 = operatingV3Evidence, readMultiEvidenceV3 = operatingMultiV3Evidence, onBack, locks }: {
  readonly readEvidence?: () => readonly RetainedAdjustedPlanEvidence[];
  readonly readEvidenceV3?: () => readonly RetainedAdjustedPlanEvidenceV3[];
  readonly readMultiEvidenceV3?: () => readonly RetainedMultiAdjustedEvidenceV3[];
  readonly onBack: () => void; readonly locks?: PlanMutationLockManager;
}) {
  const [account] = React.useState(localAccountScopeSnapshot)
  const [file, setFile] = React.useState<{ raw: string; count: number; format: "legacy" | "v3" | "multi-v3" } | null>(null)
  const [confirmed, setConfirmed] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const revision = React.useRef(0)
  React.useEffect(() => () => { revision.current += 1 }, [])
  return <section className="adjusted-next-flow" aria-labelledby="plan-import-title">
    <button type="button" onClick={() => { revision.current += 1; onBack() }}><ArrowLeft size={18} aria-hidden="true" />돌아가기</button>
    <h1 id="plan-import-title">계획 원본 불러오기</h1>
    <p>과거 계획을 보관함에 추가해 연결된 일지에서 확인할 수 있어요. 현재 훈련 일정은 바꾸지 않아요.</p>
    <label htmlFor="personal-plan-file">개인 보관용 계획 파일</label>
    <input id="personal-plan-file" type="file" accept=".json,application/json" disabled={busy} onChange={async event => {
      const selected = event.target.files?.[0]
      const ticket = ++revision.current
      setFile(null); setConfirmed(false); setMessage(null)
      if (!selected) return
      if (selected.size > 10 * 1024 * 1024) { setMessage("파일이 너무 커요. 10MB 이하의 계획 파일을 선택해 주세요."); return }
      try {
        const raw = await selected.text()
        if (ticket !== revision.current || account !== localAccountScopeSnapshot()) return
        const v3 = readAdjustedPlanBackupV3(raw, readEvidenceV3())
        const multi = readMultiAdjustedPlanBackupV3(raw, readMultiEvidenceV3())
        const read = multi.kind === "read_only" ? multi : v3.kind === "read_only" ? v3 : readAdjustedPlanBackup(raw, readEvidence())
        if (read.kind !== "read_only") { setMessage("계획 원본과 검토 자료를 확인하지 못했어요. 파일을 저장하지 않았어요."); return }
        setFile({ raw, format: multi.kind === "read_only" ? "multi-v3" : v3.kind === "read_only" ? "v3" : "legacy", count: new Set([...read.entries.map(item => item.state.selection.contentFingerprint), read.active.selection.contentFingerprint]).size })
      } catch { if (ticket === revision.current && account === localAccountScopeSnapshot()) setMessage("파일을 읽지 못했어요.") }
    }} />
    {file && <>
      <p>파일에 계획 원본 {file.count}개가 있어요. 이미 있는 원본은 현재 것을 유지해요. 보관 한도 18개를 넘으면 기존 자료를 지우지 않고 중단해요.</p>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />내 계획 파일이며 현재 사용자 보관함에 추가할게요</label>
      <button type="button" disabled={!confirmed || busy} onClick={async () => {
        const ticket = revision.current
        setBusy(true); setMessage(null)
        const request = { raw: file.raw, confirmsOwnFile: confirmed, locks,
          isCurrentRequest: () => ticket === revision.current && account === localAccountScopeSnapshot() }
        const result = file.format === "multi-v3" ? await importMultiAdjustedPlanHistoryV3({ ...request, readEvidence: readMultiEvidenceV3 })
          : file.format === "v3" ? await importAdjustedPlanHistoryV3({ ...request, readEvidence: readEvidenceV3 })
          : await importAdjustedPlanHistory({ ...request, readEvidence })
        if (ticket !== revision.current || account !== localAccountScopeSnapshot()) return
        setBusy(false)
        if (result.kind === "restored_history") {
          setMessage(`원본 ${result.added}개를 추가했어요. 중복 ${result.keptExisting}개는 현재 것을 유지했어요. 훈련 일정은 바뀌지 않았어요.`)
          setFile(null); setConfirmed(false)
        } else setMessage(result.code === "ARCHIVE_CAPACITY_EXCEEDED" ? "보관 한도 18개를 넘어 불러오지 않았어요. 기존 원본은 모두 유지했어요."
          : "원본을 불러오지 못했어요. 현재 자료를 다시 확인해 주세요.")
      }}><FileUp size={18} aria-hidden="true" />과거 원본 보관함에 추가</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
