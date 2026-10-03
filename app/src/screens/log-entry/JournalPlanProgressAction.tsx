import React from "react"
import type { PostSessionEntry } from "../../domain/journal-schema"
import { loadVersionedPlanBetaState } from "../../domain/plan-beta-store"
import { journalProgressAction, journalResultLabel, reflectSavedJournalProgress } from "../../domain/journal-plan-progress"

export function JournalPlanProgressAction({ entry }: { readonly entry: PostSessionEntry }) {
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null)
  const identity = `${entry.id}:${entry.savedAt}`
  const revision = React.useRef(0)
  React.useEffect(() => { revision.current++; setResult(null); setBusy(false); return () => { revision.current++ } }, [identity])
  if (!entry.plannedSessionLink) return null
  const state = loadVersionedPlanBetaState()
  const action = state && journalProgressAction(state, entry)
  return <div aria-label="계획에 수행 결과 반영">
    <p role="status">{result?.message ?? journalResultLabel(entry)}</p>
    {action && !result?.ok && <button type="button" className="quick-log__secondary" disabled={busy} onClick={async () => {
      if (busy) return
      const request = revision.current
      setBusy(true)
      try { const next = await reflectSavedJournalProgress(entry); if (request === revision.current) setResult(next) }
      catch { if (request === revision.current) setResult({ ok: false, message: "일지는 저장돼 있어요. 계획 반영은 다시 확인해 주세요." }) }
      finally { if (request === revision.current) setBusy(false) }
    }}>{busy ? "계획에 반영 중" : action.state === "PAIN_CHECKIN" ? "계획에 몸 상태 확인 표시" : "이 결과를 계획에도 반영"}</button>}
  </div>
}
