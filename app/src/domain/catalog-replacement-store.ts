import { prepareCatalogReplacement, type CatalogReplacementProposal, type CatalogReplacementPreparation } from "./catalog-replacement"
import { executionReplanEvidence, replanFingerprint } from "./execution-replan"
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

type Selection = Pick<Parameters<typeof prepareCatalogReplacement>[0], "address" | "catalogId" | "inputs" | "acceptStronger" | "acceptLonger">
export async function prepareCurrentCatalogReplacement(selection: Selection): Promise<CatalogReplacementPreparation> {
  const scope = localAccountScopeSnapshot(), online = accountPlansEnabled()
  let changed = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  const blocked = (message: string): CatalogReplacementPreparation => ({ kind: "blocked", message })
  try {
    if (scope && !online) return blocked("계정 저장에 연결한 뒤 다시 시도해 주세요.")
    if (online && !await ensureAccountPlanHistory()) return blocked("계획과 기록을 불러온 뒤 다시 시도해 주세요.")
    const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety()
    if (state?.version !== 3 || read.status !== "complete") return blocked("현재 계획과 기록을 다시 불러와 주세요.")
    const versions = online ? currentConfirmedAccountJournalVersions() : null
    if (online && (!scope || !versions || read.entries.some(e => !versions.some(v => v.entryId === e.id)))) return blocked("기록 동기화가 끝난 뒤 바꿀 수 있어요.")
    const journalGuard = versions && scope ? await Promise.all(versions.map(async v => ({ documentId: await accountJournalDocumentId(scope, v.entryId), revision: v.revision }))) : null
    if (changed || !localAccountScopeIsCurrent(scope)) return blocked("계정이 바뀌었어요. 다시 열어 주세요.")
    return prepareCatalogReplacement({ ...selection, state, entries: read.entries, today: todayISO(), now: new Date().toISOString(),
      journalGuard: journalGuard?.sort((a, b) => a.documentId.localeCompare(b.documentId)) ?? null })
  } finally { unsubscribe() }
}

export type CatalogReplacementApplyResult = { kind: "applied" } | { kind: "blocked" | "uncertain"; message: string }
export async function applyCatalogReplacement(proposal: CatalogReplacementProposal, confirmsNoKnownRisk: boolean): Promise<CatalogReplacementApplyResult> {
  const scope = localAccountScopeSnapshot(), locks = getPlanMutationLockManager()
  const blocked = (message: string): CatalogReplacementApplyResult => ({ kind: "blocked", message })
  if (scope && !accountPlansEnabled()) return blocked("계정 저장에 연결한 뒤 다시 시도해 주세요.")
  if (!locks || !confirmsNoKnownRisk) return blocked("지금 몸 상태를 확인한 뒤 적용해 주세요.")
  let changed = false, writeStarted = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) return blocked("다른 저장이 진행 중이에요. 잠시 후 다시 눌러 주세요.")
      const r = proposal.after.catalogReplacement
      if (!r || r.replacement.prescription.kind !== "RPE_TIME_RANGE" || !r.replacement.prescription.catalogWorkout) return blocked("변경안을 다시 확인해 주세요.")
      const binding = r.replacement.prescription.catalogWorkout
      const fresh = () => {
        if (changed || !localAccountScopeIsCurrent(scope) || todayISO() !== r.today) return false
        const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety(), safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date())
        if (state?.version !== 3 || read.status !== "complete" || safety.kind !== "passed"
          || state.progress.some(p => p.state === "PAIN_CHECKIN") || replanFingerprint(state) !== r.baseStateFingerprint
          || replanFingerprint(executionReplanEvidence(read.entries)) !== r.evidenceFingerprint) return false
        return proposal.after.activePlan.sessions.every(s => s.prescription.kind !== "PACE_TARGET"
          || recheckStoredDetailedPrescriptionAuthority({ operation: "START", prescription: s.prescription,
            evaluatedAt: new Date().toISOString(), safetyGate: safety.gate }).kind !== "blocked")
      }
      if (!fresh()) return blocked("기록·계획·몸 상태가 바뀌었어요. 최신 내용으로 다시 확인해 주세요.")
      const read = loadEntriesForPlanSafety()
      if (read.status !== "complete") return blocked("기록을 다시 불러와 주세요.")
      const rebuilt = prepareCatalogReplacement({ state: proposal.before, entries: read.entries, today: r.today, now: r.acceptedAt,
        timeZone: r.timeZone,
        address: r.source, catalogId: binding.catalogId, inputs: binding.inputs, acceptStronger: r.acceptedRpeMaximum !== null,
        acceptLonger: binding.acceptedDurationSeconds !== undefined || r.acceptedLongerDuration, journalGuard: r.journalGuard })
      if (rebuilt.kind !== "ready" || replanFingerprint(rebuilt.proposal.after) !== replanFingerprint(proposal.after)) return blocked("변경안이 달라졌어요. 다시 선택해 주세요.")
      if (accountPlansEnabled()) {
        const service = accountPlanService()
        if (!service || !("loadHistory" in service) || !r.journalGuard) return blocked("계정 저장 준비가 필요해요. 원래 계획은 그대로 있어요.")
        const write = captureAccountPlanWrite(activePlanBetaStorageKey())
        writeStarted = write !== null
        const error = write ? await write.save(proposal.after, [], fresh) : "ACCOUNT_PLAN_STALE"
        if (error) return { kind: error === "ACCOUNT_PLAN_PENDING" ? "uncertain" : "blocked", message: error === "ACCOUNT_PLAN_PENDING"
          ? "서버 저장 확인을 기다리고 있어요. 다시 적용하지 말고 동기화 상태를 확인해 주세요."
          : "서버에서 변경을 확인하지 못했어요. 현재 일정과 동기화 상태를 확인해 주세요." }
      } else {
        const key = activePlanBetaStorageKey(), historyKey = accountScopedStorageKey("trainoracle.plan-beta.history.v1")
        const oldRaw = localStorage.getItem(key), history = planHistoryListSchema.safeParse(JSON.parse(localStorage.getItem(historyKey) ?? "[]"))
        if (!history.success) return blocked("이전 계획 보관함을 확인해 주세요. 원본을 지우지 않았어요.")
        const archived = planHistorySchema.parse(planHistorySnapshotContent(proposal.before, r.acceptedAt, "REPLAN"))
        const retained = history.data.some(row => "originalPlan" in row && replanFingerprint(row.originalPlan) === r.baseStateFingerprint)
        if (!retained && history.data.length >= 18) return blocked("이전 계획 보관함이 가득 찼어요. 원본을 지우지 않았어요.")
        const nextHistory = JSON.stringify(retained ? history.data : [archived, ...history.data]), next = JSON.stringify(proposal.after)
        if (!fresh()) return blocked("기록이 바뀌었어요. 변경안을 다시 확인해 주세요.")
        try {
          writeStarted = true
          localStorage.setItem(historyKey, nextHistory)
          if (localStorage.getItem(historyKey) !== nextHistory) throw Error("history")
          localStorage.setItem(key, next)
          if (localStorage.getItem(key) !== next) throw Error("plan")
        } catch {
          if (localStorage.getItem(key) === oldRaw) return blocked("저장하지 못했어요. 원래 계획과 기록은 남아 있어요.")
          return { kind: "uncertain", message: "저장 상태를 확인하지 못했어요. 다시 적용하지 말고 현재 일정을 확인해 주세요." }
        }
      }
      window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)); window.dispatchEvent(new Event("storage"))
      return { kind: "applied" }
    })
  } catch {
    return writeStarted ? { kind: "uncertain", message: "저장 응답을 확인하지 못했어요. 다시 적용하지 말고 현재 일정을 확인해 주세요." }
      : blocked("변경안을 확인하지 못했어요. 다시 열어 주세요.")
  } finally { unsubscribe() }
}
