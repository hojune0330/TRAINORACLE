import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { activePlanBetaStorageKey } from "./plan-beta-store"
import { accountScopedStorageKey, localAccountScopeSnapshot } from "./account/local-account-scope"
import { ADJUSTED_PLAN_ARCHIVE_KEY, parseAdjustedOriginalArchive } from "./adjusted-plan-archive"
import { readStoredAdjustedPlanState, RETAINED_ADJUSTED_PLAN_EVIDENCE } from "./adjusted-plan-storage-schema"
import { hasCanonicalJsonTree } from "./plan-beta-schema"
import type { RetainedAdjustedPlanEvidence } from "./selected-adjusted-plan-content"

const hash = (value: unknown) => canonicalJsonFingerprint("trainoracle.adjusted-plan-backup.v1", value)
const invalid = () => ({ kind: "invalid" as const })
const FORMAT = "trainoracle.adjusted-plan.personal-backup.v1"

/** A personal historical file, never a source of runtime authority or an active-plan restore. */
export function readAdjustedPlanBackup(raw: string, retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE,
  now = new Date()) {
  try {
    const value = JSON.parse(raw)
    if (!hasCanonicalJsonTree(value) || value?.format !== FORMAT || value.app !== "TRAINORACLE"
      || Reflect.ownKeys(value).length !== 6) return invalid()
    const exported = new Date(value.exportedAt)
    if (!Number.isFinite(exported.getTime()) || exported.toISOString() !== value.exportedAt || exported > now) return invalid()
    const active = readStoredAdjustedPlanState(value.active, retained, exported)
    const archive = parseAdjustedOriginalArchive(value.archive === null ? null : JSON.stringify(value.archive), retained, exported)
    if (active.kind !== "loaded" || archive.kind !== "loaded") return invalid()
    const content = { app: "TRAINORACLE", format: FORMAT, exportedAt: value.exportedAt, active: active.state, archive: value.archive }
    if (hash({ ...content, contentFingerprint: hash(content) }) !== hash(value)) return invalid()
    return { kind: "read_only" as const, exportedAt: value.exportedAt as string, active: active.state, entries: archive.entries,
      executionAuthority: "NONE" as const, storageState: "NOT_RESTORED" as const }
  } catch { return invalid() }
}

export function exportAdjustedPlanBackup(expectedFingerprint: string,
  retained: readonly RetainedAdjustedPlanEvidence[] = RETAINED_ADJUSTED_PLAN_EVIDENCE, now = new Date()) {
  try {
    const account = localAccountScopeSnapshot()
    const activeKey = activePlanBetaStorageKey()
    const archiveKey = accountScopedStorageKey(ADJUSTED_PLAN_ARCHIVE_KEY)
    const activeRaw = localStorage.getItem(activeKey)
    const archiveRaw = localStorage.getItem(archiveKey)
    const active = readStoredAdjustedPlanState(activeRaw === null ? null : JSON.parse(activeRaw), retained, now)
    if (active.kind !== "loaded" || active.state.contentFingerprint !== expectedFingerprint) return invalid()
    const content = { app: "TRAINORACLE", format: FORMAT, exportedAt: now.toISOString(),
      active: active.state, archive: archiveRaw === null ? null : JSON.parse(archiveRaw) }
    const raw = JSON.stringify({ ...content, contentFingerprint: hash(content) }, null, 2)
    const read = readAdjustedPlanBackup(raw, retained, now)
    if (read.kind !== "read_only" || account !== localAccountScopeSnapshot()
      || localStorage.getItem(activeKey) !== activeRaw || localStorage.getItem(archiveKey) !== archiveRaw) return invalid()
    return { kind: "exported" as const, raw, archivedCount: read.entries.length }
  } catch { return invalid() }
}
