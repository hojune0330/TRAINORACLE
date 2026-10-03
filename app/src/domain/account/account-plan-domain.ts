import { accountPlanService, accountPlansEnabled } from "./account-plan-service"
import { accountPlanEntry, materializeAccountPlan, validateAccountPlanPacket, type AccountPlanPacket } from "./account-plan-document-schema"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { activeLocalAccount } from "./local-journal-ownership"
import { currentConfirmedAccountJournalVersions } from "./account-journal-projection"
import { accountJournalDocumentId } from "./account-journal-record-service"
import { captureAccountPlanPaceSource, accountPlanPaceSourceStillCurrent } from "./account-plan-pace-source"

/** Full-history consumers must explicitly wait; a current-only projection is not an empty archive. */
export async function ensureAccountPlanHistory(): Promise<boolean> {
  if (!accountPlansEnabled()) return true
  const service = accountPlanService()
  if (!service) return false
  const ready = "loadHistory" in service ? await service.loadHistory() : !!service.snapshot().confirmedDocument
  return ready && accountPlanService() === service && !!service.snapshot().confirmedDocument
}

/** Capture the account baseline before waiting for the existing domain mutation lock. */
export function captureAccountPlanWrite(activeKey: string) {
  if (!accountPlansEnabled()) return null
  const service = accountPlanService(), opening = service?.snapshot()
  const ownerId = activeLocalAccount()
  const ready = !!opening?.fingerprint && ["READY", "EMPTY"].includes(opening.status)
  const read = () => {
    const selected = service?.snapshot().currentPlan
    return selected?.kind === "read_only" ? JSON.stringify(selected.packet.state) : null
  }
  const raw = read()
  return {
    packet: opening?.currentPlan?.kind === "read_only" ? opening.currentPlan.packet : null,
    // Only a read facade, never an override of browser Storage or device keys.
    storage: { getItem: (key: string) => key === activeKey ? read() : null,
      setItem: () => { throw Error("Account plan requires CAS") }, removeItem: () => { throw Error("Account plan requires CAS") } },
    async save(state: unknown, retained: readonly NonNullable<AccountPlanPacket["evidence"]>[], freshReview?: () => boolean,
      context?: Extract<AccountPlanPacket, { evidence: null }>["context"]): Promise<`ACCOUNT_PLAN_${string}` | null> {
      if (!service || !ready || !opening?.fingerprint || read() !== raw
        || accountPlanService() !== service || activeLocalAccount() !== ownerId) return "ACCOUNT_PLAN_STALE"
      // Capture complete, confirmed revisions before hashing IDs or queued/auth work.
      const versions = freshReview ? currentConfirmedAccountJournalVersions() : undefined
      if (freshReview && (!("loadHistory" in service) || !ownerId || versions === null)) return "ACCOUNT_PLAN_REVIEW_REQUIRED"
      const packets = [null, ...retained].map(evidence => ({ state, evidence, ...(context ? { context } : {}) })).filter(validateAccountPlanPacket)
      if (packets.length !== 1) return "ACCOUNT_PLAN_EVIDENCE_REQUIRED"
      const packet = packets[0]!
      const paceSource = freshReview ? captureAccountPlanPaceSource(packet, ownerId) : { kind: "none" as const }
      if (paceSource.kind === "unavailable") return "ACCOUNT_PLAN_REVIEW_REQUIRED"
      const journalGuard = versions ? (await Promise.all(versions.map(async row => ({
        documentId: await accountJournalDocumentId(ownerId!, row.entryId), revision: row.revision,
      })))).sort((a, b) => a.documentId.localeCompare(b.documentId)) : undefined
      if (accountPlanService() !== service || activeLocalAccount() !== ownerId || read() !== raw) return "ACCOUNT_PLAN_STALE"
      if (freshReview && JSON.stringify(currentConfirmedAccountJournalVersions()) !== JSON.stringify(versions)) return "ACCOUNT_PLAN_REVIEW_REQUIRED"
      if (freshReview && !accountPlanPaceSourceStillCurrent(packet, ownerId, paceSource)) return "ACCOUNT_PLAN_REVIEW_REQUIRED"
      const result = await service.mutate(freshReview
        ? { kind: "SELECT", packet, confirmsSelection: true,
          freshReview: () => accountPlanPaceSourceStillCurrent(packet, ownerId, paceSource) && freshReview(), journalGuard,
          ...(paceSource.kind === "ready" ? { paceRecordGuard: paceSource.guard } : {}) }
        : { kind: "PROGRESS", packet }, opening.fingerprint)
      return result === "ACCOUNT" ? null : `ACCOUNT_PLAN_${result}`
    },
    async archive(): Promise<`ACCOUNT_PLAN_${string}` | null> {
      if (!service || !ready || !opening?.fingerprint || !opening.currentPlan || read() !== raw) return "ACCOUNT_PLAN_STALE"
      const result = await service.mutate({ kind: "ARCHIVE", planId: opening.currentPlan.planId }, opening.fingerprint)
      return result === "ACCOUNT" ? null : `ACCOUNT_PLAN_${result}`
    },
  }
}

export async function importAccountPlanHistory(states: readonly unknown[], retained: readonly NonNullable<AccountPlanPacket["evidence"]>[], current: () => boolean) {
  const reject = (code: string) => ({ kind: "rejected" as const, code })
  const service = accountPlanService()
  if (!await ensureAccountPlanHistory() || accountPlanService() !== service || !current()) return reject("ACCOUNT_PLAN_STALE")
  const view = service?.snapshot()
  if (!service || !view?.fingerprint || !current()) return reject("ACCOUNT_PLAN_STALE")
  const packets: AccountPlanPacket[] = []
  for (const state of states) {
    const candidates: unknown[] = retained.map(evidence => ({ state, evidence }))
    const matches = candidates.filter(validateAccountPlanPacket)
    if (matches.length !== 1) return reject("ACCOUNT_PLAN_EVIDENCE_REQUIRED")
    packets.push(matches[0]!)
  }
  const ids = new Set(view.document?.data.plans.map(p => p.planId))
  let added = 0, keptExisting = 0
  for (const packet of packets) {
    const id = accountPlanEntry(packet).planId
    if (ids.has(id)) keptExisting++
    else { ids.add(id); added++ }
  }
  const result = await service.importHistory(packets, view.fingerprint, current)
  return result === "ACCOUNT" ? { kind: "restored_history" as const, added, keptExisting, activePlanChanged: false as const }
    : reject(`ACCOUNT_PLAN_${result}`)
}

/** Existing personal-backup codecs read this projection, never the original device keys. */
export function accountPlanExportStorage(activeKey: string, archiveKey: string, version: 4 | 5 | 6) {
  if (!accountPlansEnabled()) return localStorage
  return { getItem(key: string): string | null {
    const view = accountPlanService()?.snapshot(), document = view?.confirmedDocument
    if (!document || ("historyLoaded" in view && !view.historyLoaded)) throw Error("Account plan history unavailable")
    if (key === activeKey) return view.currentPlan?.kind === "read_only" ? JSON.stringify(view.currentPlan.packet.state) : null
    if (key !== archiveKey) throw Error("Unexpected plan key")
    const entries = document.data.plans.filter(p => p.archivedAt && p.snapshot.state.version === version)
      .map(p => ({ archivedAt: p.archivedAt, state: materializeAccountPlan(p).state }))
    const content = { version: version === 4 ? 1 : 3, entries }
    const namespace = version === 4 ? "trainoracle.adjusted-original-archive.v1"
      : version === 5 ? "trainoracle.adjusted-original-archive.v3" : "trainoracle.multi-adjusted-original-archive.v3"
    return JSON.stringify({ ...content, contentFingerprint: canonicalJsonFingerprint(namespace, content) })
  } }
}
