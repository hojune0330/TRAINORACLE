import type { PostSessionEntry } from "./journal-schema"
import type { PlanBetaState, StoredPlanProgress } from "./plan-beta-schema"
import { resolveCurrentPlannedSession } from "./planned-session-link"
import { loadEntriesForPlanSafety } from "./journal-store"
import { loadVersionedPlanBetaState, savePlanProgressWithLock } from "./plan-beta-store"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "./account/local-account-scope"
import { painLevelsRequireReview } from "../safety/memo-safety"

export function journalResultLabel(entry: PostSessionEntry): string {
  if (entry.painCheckStatus === "SIGNAL_REPORTED" || painLevelsRequireReview(entry.painParts ?? {})) return "몸 상태 확인 기록 있음"
  if (entry.activityOutcome === "PARTIAL") return "일부 수행·변경 기록 있음"
  if (entry.activityOutcome === "LIGHT_ACTIVITY") return "가벼운 운동 기록 있음"
  if (entry.activityOutcome === "RESTED") return "휴식 기록 있음"
  if (entry.activityOutcome === "SKIPPED") return "건너뛴 기록 있음"
  if (entry.activityOutcome === "COMPLETED") return "수행 기록 있음"
  return "연결된 일지 있음"
}

/** A journal result is never silently converted into a plan progress mark. */
export function journalProgressAction(state: PlanBetaState, entry: Pick<PostSessionEntry,
  "plannedSessionLink" | "date" | "fieldProvenance" | "painCheckStatus" | "painParts" | "activityOutcome" | "activitySlot"
>): StoredPlanProgress | null {
  if (state.version !== 3 || !entry.plannedSessionLink || entry.date !== entry.plannedSessionLink.plannedDate
    || entry.fieldProvenance?.activityOutcome?.provenance !== "EXPLICIT") return null
  const session = resolveCurrentPlannedSession(state, entry.plannedSessionLink)
  if (!session || state.progress.some(p => p.sessionDay === session.day && p.sessionSlot === session.slot)) return null
  const address = { sessionDay: session.day, sessionSlot: session.slot }
  if (entry.painCheckStatus === "SIGNAL_REPORTED" || painLevelsRequireReview(entry.painParts ?? {}))
    return { ...address, state: "PAIN_CHECKIN" }
  if (entry.activityOutcome === "RESTED" || entry.activityOutcome === "SKIPPED") return { ...address, state: entry.activityOutcome }
  if (entry.activityOutcome === "COMPLETED" && entry.activitySlot === session.slot
    && entry.fieldProvenance?.activitySlot?.provenance === "EXPLICIT"
    && entry.painCheckStatus === "NO_SIGNAL_REPORTED"
    && entry.fieldProvenance?.painCheckStatus?.provenance === "EXPLICIT") return { ...address, state: "COMPLETED" }
  return null
}

export async function reflectSavedJournalProgress(entry: PostSessionEntry): Promise<{ ok: boolean; message: string }> {
  const scope = localAccountScopeSnapshot()
  const state = loadVersionedPlanBetaState()
  const progress = state && journalProgressAction(state, entry)
  const failure = { ok: false, message: "일지는 저장돼 있어요. 계획이나 기록이 바뀌었는지 계획 화면에서 확인해 주세요." }
  if (!state || !progress) return failure
  const fresh = () => {
    if (!localAccountScopeIsCurrent(scope)) return false
    const read = loadEntriesForPlanSafety(), current = loadVersionedPlanBetaState()
    if (read.status !== "complete" || !current || current.activePlan.candidateId !== state.activePlan.candidateId) return false
    const sameId = read.entries.filter(e => e.id === entry.id)
    const linked = read.entries.filter(e => e.kind === "post-session"
      && e.plannedSessionLink?.plannedSessionId === entry.plannedSessionLink?.plannedSessionId)
    if (sameId.length !== 1 || linked.length !== 1) return false
    const saved = sameId[0]?.savedAt === entry.savedAt ? sameId[0] : undefined
    return saved?.kind === "post-session" && JSON.stringify(journalProgressAction(current, saved)) === JSON.stringify(progress)
  }
  if (!fresh()) return failure
  const result = await savePlanProgressWithLock(state.activePlan.candidateId, progress, fresh)
  if (result.kind !== "saved") return failure
  window.dispatchEvent(new Event("storage"))
  return { ok: true, message: progress.state === "PAIN_CHECKIN" ? "계획에 몸 상태 확인이 필요하다고 표시했어요."
    : "일지의 결과를 계획에도 반영했어요." }
}
