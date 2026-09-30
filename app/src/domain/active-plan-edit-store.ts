import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { prepareActivePlanEdit, activePlanEditEvidenceFingerprint, type ActivePlanEditPreparation, type ActivePlanEditProposal, type ActivePlanEditAddress } from "./active-plan-edit"
import { activePlanEditFingerprint, activePlanEditDurationConsentRequired } from "./active-plan-edit-policy"
import { accountPlansEnabled, accountPlanService, ACCOUNT_PLAN_EVENT } from "./account/account-plan-service"
import { captureAccountPlanWrite, ensureAccountPlanHistory } from "./account/account-plan-domain"
import { currentConfirmedAccountJournalVersions } from "./account/account-journal-projection"
import { accountJournalDocumentId } from "./account/account-journal-record-service"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent, accountScopedStorageKey } from "./account/local-account-scope"
import { onLocalJournalScopeChange } from "./account/local-journal-ownership"
import { loadEntriesForPlanSafety, todayISO } from "./journal-store"
import { loadVersionedPlanBetaState, activePlanBetaStorageKey } from "./plan-beta-store"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { planBetaStateV3Schema, planHistoryListSchema, planHistorySchema, type PlanBetaStateV3 } from "./plan-beta-schema"
import { planHistorySnapshotContent } from "./plan-history-snapshot-content"
import { getPlanMutationLockManager, PLAN_BETA_MUTATION_LOCK_NAME } from "./plan-mutation-lock"
import { recheckStoredDetailedPrescriptionAuthority } from "./plan-session-schema"
import { planSessionAnchorsStillCurrent } from "./plan-anchor-reconfirmation"

export type ActivePlanEditSelection = {
  source: ActivePlanEditAddress; action: "DURATION" | "SWAP" | "CATALOG";
  target?: ActivePlanEditAddress; maximumMinutes?: number;
  catalogId?: string; inputs?: WorkoutCalculationInputs; acceptStronger?: boolean; acceptLonger?: boolean;
  unstartedConfirmed: boolean; noFixedFutureCommitments: boolean;
}
export type ActivePlanEditApplyResult = { kind: "applied"; state: PlanBetaStateV3 }
  | { kind: "blocked" | "uncertain"; message: string }
const unavailable = (message: string): ActivePlanEditPreparation => ({ kind: "blocked", reasonCode: "INVALID_INPUT", message, permittedTargets: [] })

/** Read fresh account/guest evidence; browsing and preparing never writes a plan. */
export async function prepareCurrentActivePlanEdit(selection: ActivePlanEditSelection): Promise<ActivePlanEditPreparation> {
  const scope = localAccountScopeSnapshot(), online = accountPlansEnabled()
  let changed = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  try {
    if (scope && !online) return unavailable("계정 저장에 연결한 뒤 다시 시도해 주세요.")
    if (online && !await ensureAccountPlanHistory()) return unavailable("계획과 기록을 불러온 뒤 다시 시도해 주세요.")
    const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety()
    if (state?.version !== 3 || read.status !== "complete") return unavailable("현재 계획과 기록을 다시 불러와 주세요.")
    const versions = online ? currentConfirmedAccountJournalVersions() : null
    if (online && (!scope || !versions || read.entries.some(e => !versions.some(v => v.entryId === e.id)))) return unavailable("기록 동기화가 끝난 뒤 수정할 수 있어요.")
    const journalGuard = versions && scope ? await Promise.all(versions.map(async v => ({ documentId: await accountJournalDocumentId(scope, v.entryId), revision: v.revision }))) : null
    if (changed || !localAccountScopeIsCurrent(scope)) return unavailable("계정이 바뀌었어요. 다시 열어 주세요.")
    let catalog: Pick<Parameters<typeof prepareActivePlanEdit>[0], "replacement" | "acceptedRpeMaximum" | "acceptedLongerDuration"> = {}
    if (selection.action === "CATALOG") {
      const old = state.activePlan.sessions.find(s => s.day === selection.source.day && s.slot === selection.source.slot)
      if (!old || old.prescription.kind !== "RPE_TIME_RANGE" || !selection.catalogId || !selection.inputs) return unavailable("바꿀 훈련과 구성을 선택해 주세요.")
      const replacement = bindCatalogSession(old, selection.catalogId, selection.inputs, selection.acceptLonger === true)
      if (!replacement || replacement.prescription.kind !== "RPE_TIME_RANGE") return unavailable("이 훈련의 목적과 조건에 맞는 구성을 골라 주세요.")
      const stronger = replacement.prescription.rpe.maximum > old.prescription.rpe.maximum
      const longer = activePlanEditDurationConsentRequired(old, replacement)
      if (stronger && !selection.acceptStronger || longer && !selection.acceptLonger) return unavailable("변경 전후 강도와 전체 시간을 확인해 주세요.")
      catalog = { replacement, acceptedRpeMaximum: stronger ? replacement.prescription.rpe.maximum : null, acceptedLongerDuration: longer }
    }
    return prepareActivePlanEdit({ state, entries: read.entries, source: selection.source, action: selection.action,
      target: selection.target, maximumMinutes: selection.maximumMinutes, ...catalog,
      unstartedConfirmed: selection.unstartedConfirmed, noFixedFutureCommitments: selection.noFixedFutureCommitments,
      today: todayISO(), now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      journalGuard: journalGuard?.sort((a, b) => a.documentId.localeCompare(b.documentId)) ?? null })
  } catch { return unavailable("변경안을 확인하지 못했어요. 원래 계획은 그대로예요.") }
  finally { unsubscribe() }
}

/** Archive first, then replace active: an interrupted tab can add an archive but cannot erase its source. */
function saveGuestReplacement(before: PlanBetaStateV3, after: PlanBetaStateV3, at: string, fresh: () => boolean): ActivePlanEditApplyResult {
  const key = activePlanBetaStorageKey(), historyKey = accountScopedStorageKey("trainoracle.plan-beta.history.v1")
  const oldRaw = localStorage.getItem(key), history = planHistoryListSchema.safeParse(JSON.parse(localStorage.getItem(historyKey) ?? "[]"))
  if (!history.success) return { kind: "blocked", message: "이전 계획 보관함을 확인해 주세요. 원본을 지우지 않았어요." }
  const archived = planHistorySchema.parse(planHistorySnapshotContent(before, at, "REPLAN"))
  const retained = history.data.some(row => "originalPlan" in row && activePlanEditFingerprint(row.originalPlan) === activePlanEditFingerprint(before))
  if (!retained && history.data.length >= 18) return { kind: "blocked", message: "이전 계획 보관함이 가득 찼어요. 원본은 그대로 두었어요." }
  const nextHistory = JSON.stringify(retained ? history.data : [archived, ...history.data]), next = JSON.stringify(after)
  if (!fresh()) return { kind: "blocked", message: "계획이나 기록이 바뀌었어요. 최신 내용으로 다시 확인해 주세요." }
  try {
    localStorage.setItem(historyKey, nextHistory)
    if (localStorage.getItem(historyKey) !== nextHistory) throw Error("history")
    if (!fresh()) return { kind: "blocked", message: "계획이나 계정이 바뀌었어요. 이전 계획만 보관했고 현재 계획은 바꾸지 않았어요." }
    localStorage.setItem(key, next)
    if (localStorage.getItem(key) !== next) throw Error("plan")
    return { kind: "applied", state: after }
  } catch {
    if (localStorage.getItem(key) === oldRaw) return { kind: "blocked", message: "저장하지 못했어요. 원래 계획과 기록은 남아 있어요." }
    return { kind: "uncertain", message: "저장 상태를 확인하지 못했어요. 다시 적용하지 말고 현재 일정을 확인해 주세요." }
  }
}

function permittedDetailedState(state: PlanBetaStateV3): boolean {
  const safety = evaluatePlanSafety("NO_KNOWN_RISK", new Date())
  return safety.kind === "passed" && !state.progress.some(p => p.state === "PAIN_CHECKIN")
    && planSessionAnchorsStillCurrent(state.activePlan.sessions, new Date())
    && state.activePlan.sessions.every(s => s.prescription.kind !== "PACE_TARGET"
      || recheckStoredDetailedPrescriptionAuthority({ operation: "START", prescription: s.prescription,
        evaluatedAt: new Date().toISOString(), safetyGate: safety.gate }).kind === "permitted")
}

export async function applyActivePlanEdit(proposal: ActivePlanEditProposal, confirmsNoKnownRisk: boolean): Promise<ActivePlanEditApplyResult> {
  const scope = localAccountScopeSnapshot(), locks = getPlanMutationLockManager()
  const blocked = (message: string): ActivePlanEditApplyResult => ({ kind: "blocked", message })
  if (scope && !accountPlansEnabled()) return blocked("계정 저장에 연결한 뒤 다시 시도해 주세요.")
  if (!locks || !confirmsNoKnownRisk) return blocked("지금 몸 상태를 확인한 뒤 적용해 주세요.")
  let changed = false, writeStarted = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  try {
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) return blocked("다른 저장이 진행 중이에요. 잠시 후 다시 눌러 주세요.")
      const after = planBetaStateV3Schema.safeParse(proposal.after)
      if (!after.success || !after.data.activePlanEdit) return blocked("변경안을 다시 확인해 주세요.")
      const receipt = after.data.activePlanEdit
      const fresh = () => {
        if (changed || !localAccountScopeIsCurrent(scope) || todayISO() !== receipt.today) return false
        const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety()
        return state?.version === 3 && read.status === "complete" && permittedDetailedState(after.data)
          && !state.progress.some(p => p.state === "PAIN_CHECKIN")
          && activePlanEditEvidenceFingerprint(read.entries) === receipt.evidenceFingerprint
          && activePlanEditFingerprint({ state, evidenceFingerprint: receipt.evidenceFingerprint, journalGuard: receipt.journalGuard,
            today: receipt.today, timeZone: receipt.timeZone }) === receipt.baseStateFingerprint
      }
      if (!fresh()) return blocked("기록·계획·몸 상태가 바뀌었어요. 최신 내용으로 다시 확인해 주세요.")
      const read = loadEntriesForPlanSafety()
      if (read.status !== "complete") return blocked("기록을 다시 불러와 주세요.")
      const rebuilt = prepareActivePlanEdit({ state: proposal.before, entries: read.entries, source: receipt.source,
        action: receipt.action, target: receipt.target ?? undefined, maximumMinutes: receipt.maximumMinutes ?? undefined,
        replacement: receipt.replacement ?? undefined, acceptedRpeMaximum: receipt.acceptedRpeMaximum,
        acceptedLongerDuration: receipt.acceptedLongerDuration, today: receipt.today, now: receipt.acceptedAt,
        timeZone: receipt.timeZone, unstartedConfirmed: receipt.unstartedConfirmed,
        noFixedFutureCommitments: receipt.noFixedFutureCommitments, journalGuard: receipt.journalGuard })
      if (rebuilt.kind !== "ready" || activePlanEditFingerprint(rebuilt.proposal.after) !== activePlanEditFingerprint(after.data)) return blocked("변경안이 달라졌어요. 다시 선택해 주세요.")
      if (accountPlansEnabled()) {
        const service = accountPlanService()
        if (!service || !("loadHistory" in service) || receipt.journalGuard === null) return blocked("계정 저장 준비가 필요해요. 원래 계획은 그대로예요.")
        const write = captureAccountPlanWrite(activePlanBetaStorageKey())
        writeStarted = write !== null
        const error = write ? await write.save(after.data, [], fresh) : "ACCOUNT_PLAN_STALE"
        if (error) return { kind: error === "ACCOUNT_PLAN_PENDING" ? "uncertain" : "blocked", message: error === "ACCOUNT_PLAN_PENDING"
          ? "서버 저장 확인을 기다리고 있어요. 다시 적용하지 말고 동기화 상태를 확인해 주세요."
          : "서버에서 변경을 확인하지 못했어요. 현재 계획과 동기화 상태를 확인해 주세요." }
      } else {
        writeStarted = true
        const saved = saveGuestReplacement(proposal.before, after.data, receipt.acceptedAt, fresh)
        if (saved.kind !== "applied") return saved
      }
      window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)); window.dispatchEvent(new Event("storage"))
      return { kind: "applied", state: after.data }
    })
  } catch {
    return writeStarted ? { kind: "uncertain", message: "저장 응답을 확인하지 못했어요. 다시 적용하지 말고 현재 계획을 확인해 주세요." }
      : blocked("변경안을 확인하지 못했어요. 다시 열어 주세요.")
  } finally { unsubscribe() }
}

/** Explicit new start, not a completed-frame successor. The original remains active until replacement is confirmed. */
export async function replaceActivePlanWithDraft(input: {
  before: PlanBetaStateV3; after: PlanBetaStateV3; evidenceFingerprint: string;
  confirmsNoKnownRisk: boolean; freshDraft: () => boolean;
}): Promise<ActivePlanEditApplyResult> {
  const scope = localAccountScopeSnapshot(), locks = getPlanMutationLockManager(), today = todayISO()
  let changed = false, writeStarted = false
  const unsubscribe = onLocalJournalScopeChange(() => { changed = true })
  const blocked = (message: string): ActivePlanEditApplyResult => ({ kind: "blocked", message })
  try {
    if (!locks || !input.confirmsNoKnownRisk || scope && !accountPlansEnabled()) return blocked("몸 상태와 저장 연결을 확인해 주세요.")
    if (accountPlansEnabled() && !await ensureAccountPlanHistory()) return blocked("이전 계획을 불러온 뒤 다시 적용해 주세요.")
    return await locks.request(PLAN_BETA_MUTATION_LOCK_NAME, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) return blocked("다른 저장이 진행 중이에요. 잠시 후 다시 시도해 주세요.")
      const parsed = planBetaStateV3Schema.safeParse(input.after)
      if (!parsed.success || input.after.activePlanEdit || input.after.executionReplan || input.after.progress.length) return blocked("새 계획안을 다시 확인해 주세요.")
      const fresh = () => {
        const state = loadVersionedPlanBetaState(), read = loadEntriesForPlanSafety()
        return !changed && localAccountScopeIsCurrent(scope) && todayISO() === today && input.freshDraft()
          && state?.version === 3 && activePlanEditFingerprint(state) === activePlanEditFingerprint(input.before)
          && !state.progress.some(progress => progress.state === "PAIN_CHECKIN")
          && read.status === "complete" && activePlanEditEvidenceFingerprint(read.entries) === input.evidenceFingerprint
          && permittedDetailedState(input.after)
      }
      if (!fresh()) return blocked("계획·기록·몸 상태가 바뀌었어요. 새 계획안을 다시 확인해 주세요.")
      if (accountPlansEnabled()) {
        const write = captureAccountPlanWrite(activePlanBetaStorageKey())
        writeStarted = write !== null
        const error = write ? await write.save(input.after, [], fresh) : "ACCOUNT_PLAN_STALE"
        if (error) return { kind: error === "ACCOUNT_PLAN_PENDING" ? "uncertain" : "blocked", message: "계정 저장을 확인하지 못했어요. 현재 계획과 동기화 상태를 확인해 주세요." }
      } else {
        writeStarted = true
        const saved = saveGuestReplacement(input.before, input.after, new Date().toISOString(), fresh)
        if (saved.kind !== "applied") return saved
      }
      window.dispatchEvent(new Event(ACCOUNT_PLAN_EVENT)); window.dispatchEvent(new Event("storage"))
      return { kind: "applied", state: input.after }
    })
  } catch { return writeStarted ? { kind: "uncertain", message: "저장 결과를 확인하지 못했어요. 현재 계획을 다시 열어 주세요." } : blocked("새 계획을 적용하지 못했어요. 기존 계획은 그대로예요.") }
  finally { unsubscribe() }
}
