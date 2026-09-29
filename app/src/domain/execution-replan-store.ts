import { prepareExecutionReplan, replanFingerprint, executionReplanEvidence, type ExecutionReplanProposal, type ReplanPreparation } from "./execution-replan"
import { accountPlansEnabled, accountPlanService, ACCOUNT_PLAN_EVENT } from "./account/account-plan-service"
import { captureAccountPlanWrite, ensureAccountPlanHistory } from "./account/account-plan-domain"
import { currentConfirmedAccountJournalVersions } from "./account/account-journal-projection"
import { accountJournalDocumentId } from "./account/account-journal-record-service"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent, accountScopedStorageKey } from "./account/local-account-scope"
import { onLocalJournalScopeChange } from "./account/local-journal-ownership"
import { loadEntriesForPlanSafety, todayISO } from "./journal-store"
import { loadVersionedPlanBetaState, activePlanBetaStorageKey } from "./plan-beta-store"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { planHistoryListSchema, planHistorySchema } from "./plan-beta-schema"
import { planHistorySnapshotContent } from "./plan-history-snapshot-content"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import { recheckStoredDetailedPrescriptionAuthority } from "./plan-session-schema"

export async function prepareCurrentExecutionReplan(entryId: string, today: string, noFixedFutureCommitments: boolean): Promise<ReplanPreparation> {
  const scope = localAccountScopeSnapshot(), online = accountPlansEnabled()
  let changed = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  try {
    if (scope && !online) return { kind: "blocked", message: "계정 저장 연결이 필요해요. 기기 저장으로 바꾸지 않아요." }
    if (online && !await ensureAccountPlanHistory()) return { kind: "blocked", message: "계정의 계획과 기록을 불러온 뒤 다시 시도해 주세요." }
    const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety()
    if (evaluatePlanSafety("NO_KNOWN_RISK", new Date()).kind === "blocked") return { kind: "blocked", message: "몸 상태나 기록 확인이 먼저예요. 통증 확인 절차를 진행해 주세요." }
    if (state?.version !== 3) return { kind: "blocked", message: "이 계획은 별도 조정 형식이에요. 기존 상세 훈련을 보존하기 위해 자동 일정 변경은 아직 지원하지 않아요." }
    if (read.status !== "complete") return { kind: "blocked", message: "아직 불러오지 못한 기록이 있어요. 기록 동기화 후 다시 확인해 주세요." }
    const versions = online ? currentConfirmedAccountJournalVersions() : null
    if (online && (!scope || !versions || read.entries.some(e => !versions.some(v => v.entryId === e.id)))) return { kind: "blocked", message: "계정에 저장된 최신 기록인지 확인이 필요해요." }
    const journalGuard = versions && scope ? await Promise.all(versions.map(async v => ({ documentId: await accountJournalDocumentId(scope, v.entryId), revision: v.revision }))) : null
    if (changed || !localAccountScopeIsCurrent(scope)) return { kind: "blocked", message: "계정이 바뀌었어요. 다시 열어 주세요." }
    return prepareExecutionReplan({ state, entries: read.entries, entryId, today, now: new Date().toISOString(),
      journalGuard: journalGuard?.sort((a,b) => a.documentId.localeCompare(b.documentId)) ?? null, noFixedFutureCommitments })
  } finally { unsubscribe() }
}

export type ExecutionReplanApplyResult = { kind: "applied" } | { kind: "blocked" | "uncertain"; message: string }
export async function applyExecutionReplan(proposal: ExecutionReplanProposal, today: string, confirmsNoKnownRisk: boolean): Promise<ExecutionReplanApplyResult> {
  const scope = localAccountScopeSnapshot(), locks = getPlanMutationLockManager()
  const blocked = (message: string): ExecutionReplanApplyResult => ({ kind: "blocked", message })
  if (scope && !accountPlansEnabled()) return blocked("계정 저장에 연결한 뒤 다시 시도해 주세요.")
  if (!locks || !confirmsNoKnownRisk) return blocked("지금 몸 상태를 확인한 뒤 적용해 주세요.")
  let scopeChanged = false
  let writeStarted = false
  const unsubscribe = onLocalJournalScopeChange(() => { scopeChanged = true })
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) return blocked("다른 저장이 진행 중이에요. 잠시 후 다시 눌러 주세요.")
      const receipt = proposal.after.executionReplan
      if (!receipt || receipt.today !== today) return blocked("날짜가 바뀌었어요. 변경안을 다시 확인해 주세요.")
      const fresh = () => {
        if (scopeChanged || !localAccountScopeIsCurrent(scope) || todayISO() !== today) return false
        const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety(), safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date())
        if (state?.version !== 3 || read.status !== "complete" || safety.kind !== "passed"
          || state.progress.some(p => p.state === "PAIN_CHECKIN")
          || replanFingerprint(state) !== receipt.baseStateFingerprint
          || replanFingerprint(executionReplanEvidence(read.entries)) !== receipt.evidenceFingerprint) return false
        return proposal.after.activePlan.sessions.every(s => s.prescription.kind !== "PACE_TARGET"
          || recheckStoredDetailedPrescriptionAuthority({ operation: "START", prescription: s.prescription,
            evaluatedAt: new Date().toISOString(), safetyGate: safety.gate }).kind !== "blocked")
      }
      if (!fresh()) return blocked("기록·계획·몸 상태가 바뀌었어요. 최신 내용으로 다시 확인해 주세요.")
      const read = loadEntriesForPlanSafety()
      if (read.status !== "complete") return blocked("기록을 다시 불러와 주세요.")
      const rebuilt = prepareExecutionReplan({ state: proposal.before, entries: read.entries, entryId: receipt.sourceJournalId,
        today, now: receipt.acceptedAt, noFixedFutureCommitments: receipt.noFixedFutureCommitments, journalGuard: receipt.journalGuard })
      if (rebuilt.kind !== "ready" || !rebuilt.proposals.some(p => p.id === proposal.id && replanFingerprint(p.after) === replanFingerprint(proposal.after))) return blocked("변경안이 달라졌어요. 다시 선택해 주세요.")
      if (accountPlansEnabled()) {
        const service = accountPlanService()
        if (!service || !("loadHistory" in service) || !receipt.journalGuard) return blocked("계정 저장 준비가 필요해요. 원래 계획은 그대로 있어요.")
        const write = captureAccountPlanWrite(activePlanBetaStorageKey())
        writeStarted = write !== null
        const error = write ? await write.save(proposal.after, [], fresh) : "ACCOUNT_PLAN_STALE"
        if (error) return { kind: error === "ACCOUNT_PLAN_PENDING" ? "uncertain" : "blocked",
          message: error === "ACCOUNT_PLAN_PENDING" ? "서버 저장 확인을 기다리고 있어요. 다시 적용하지 말고 동기화 상태를 확인해 주세요."
            : "서버에서 변경을 확인하지 못했어요. 현재 일정과 동기화 상태를 확인해 주세요." }
      } else {
        const key = activePlanBetaStorageKey(), historyKey = accountScopedStorageKey("trainoracle.plan-beta.history.v1")
        const oldRaw = localStorage.getItem(key), oldHistory = localStorage.getItem(historyKey)
        const history = planHistoryListSchema.safeParse(oldHistory ? JSON.parse(oldHistory) : [])
        if (!history.success) return blocked("이전 계획 보관함을 확인해 주세요. 원본을 지우지 않고 변경을 멈췄어요.")
        const archived = planHistorySchema.parse(planHistorySnapshotContent(proposal.before, receipt.acceptedAt, "REPLAN"))
        const retained = history.data.some(row => "originalPlan" in row && replanFingerprint(row.originalPlan) === receipt.baseStateFingerprint)
        if (!retained && history.data.length >= 18) return blocked("이전 계획 보관함이 가득 찼어요. 원본은 지우지 않고 변경을 멈췄어요.")
        const nextHistory = JSON.stringify(retained ? history.data : [archived, ...history.data]), next = JSON.stringify(proposal.after)
        if (!fresh()) return blocked("기록이 바뀌었어요. 변경안을 다시 확인해 주세요.")
        // Archive first: a lost tab can leave an extra archive, never lose the original.
        try {
          writeStarted = true
          localStorage.setItem(historyKey, nextHistory)
          if (localStorage.getItem(historyKey) !== nextHistory) throw Error("history")
          localStorage.setItem(key, next)
          if (localStorage.getItem(key) !== next) throw Error("plan")
        } catch {
          // Never roll back after the new plan is already visible.
          if (localStorage.getItem(key) === next) return { kind: "uncertain", message: "저장 상태를 다시 확인해 주세요. 변경을 반복 적용하지 마세요." }
          if (localStorage.getItem(key) === oldRaw) return blocked("기기에 저장하지 못했어요. 원래 계획과 기록은 남아 있어요.")
          return { kind: "uncertain", message: "저장 상태를 확인하지 못했어요. 현재 일정을 다시 열어 주세요." }
        }
      }
      window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT))
      window.dispatchEvent(new Event("storage"))
      return { kind: "applied" }
    })
  } catch {
    return writeStarted ? { kind: "uncertain", message: "저장 응답을 확인하지 못했어요. 다시 적용하지 말고 현재 일정을 확인해 주세요." }
      : blocked("변경안을 확인하지 못했어요. 다시 열어 주세요.")
  }
  finally { unsubscribe() }
}
