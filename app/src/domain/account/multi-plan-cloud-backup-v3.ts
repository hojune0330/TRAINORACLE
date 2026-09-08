import { readStoredMultiAdjustedPlanV6 } from "../adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "../selected-multi-adjusted-plan-v3"
import { activePlanBetaStorageKey } from "../plan-beta-store"
import { activeLocalAccount } from "./local-journal-ownership"
import { planCloudBackupEnabled } from "./plan-cloud-backup"
import { supabase } from "./supabase-client"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { importMultiAdjustedPlanHistoryV3 } from "../multi-adjusted-plan-backup-v3"
import type { PlanMutationLockManager } from "../plan-mutation-lock"

type Dependencies = { readonly enabled: () => boolean; readonly client: typeof supabase }
const operating: Dependencies = { enabled: planCloudBackupEnabled, client: supabase }

export async function restoreMultiPlanServerHistoryV3(input: {
  readonly snapshot: Extract<Awaited<ReturnType<typeof loadLatestMultiPlanSnapshotV3>>, { kind: "read_only" }>;
  readonly confirmsRestore: boolean; readonly isCurrentRequest: () => boolean;
  readonly readEvidence: () => readonly RetainedMultiAdjustedEvidenceV3[];
  readonly locks?: PlanMutationLockManager | null;
}) {
  const owner = activeLocalAccount()
  if (owner === null || input.snapshot.ownerId !== owner || input.confirmsRestore !== true)
    return { kind: "rejected" as const, code: "OWNER_RESTORE_CONFIRMATION_REQUIRED" }
  const content = { app: "TRAINORACLE", format: "trainoracle.multi-adjusted-plan.personal-backup.v3",
    exportedAt: new Date().toISOString(), active: input.snapshot.state, archive: null }
  const raw = JSON.stringify({ ...content, contentFingerprint: canonicalJsonFingerprint("trainoracle.multi-adjusted-plan-backup.v3", content) })
  return importMultiAdjustedPlanHistoryV3({ raw, confirmsOwnFile: true, readEvidence: input.readEvidence, locks: input.locks,
    isCurrentRequest: () => activeLocalAccount() === owner && input.confirmsRestore === true && input.isCurrentRequest() })
}

/** Reads a private historical snapshot only; caller must separately request restoration. */
export async function loadLatestMultiPlanSnapshotV3(
  readEvidence: () => readonly RetainedMultiAdjustedEvidenceV3[], dependencies: Dependencies = operating) {
  const unavailable = () => ({ kind: "unavailable" as const })
  try {
    const owner = activeLocalAccount()
    if (owner === null || !dependencies.enabled()) return unavailable()
    const current = () => owner === activeLocalAccount() && dependencies.enabled()
    const client = await dependencies.client()
    if (!client || !current()) return unavailable()
    const session = await client.auth.getSession()
    if (session.error || session.data.session?.user.id !== owner || !current()) return unavailable()
    const { data, error } = await client.from("saved_training_plans")
      .select("user_id, plan_id, schema_version, plan_payload, saved_at")
      .eq("user_id", owner).eq("schema_version", 6).is("archived_at", null)
      .order("saved_at", { ascending: false }).order("plan_id", { ascending: false }).limit(2)
    if (!current()) return { kind: "stale_response" as const }
    if (error) return { kind: "failed" as const }
    if (!Array.isArray(data)) return { kind: "invalid" as const }
    if (!data.length) return unavailable()
    const row = data[0]!
    if (data.length > 1 && Date.parse(row.saved_at) === Date.parse(data[1]!.saved_at))
      return { kind: "conflict" as const }
    if (row.user_id !== owner || row.schema_version !== 6) return { kind: "invalid" as const }
    const read = readStoredMultiAdjustedPlanV6(row.plan_payload, readEvidence())
    if (read.kind !== "loaded" || row.plan_id !== `multi-v6:${read.state.contentFingerprint}`
      || typeof row.saved_at !== "string" || !Number.isFinite(Date.parse(row.saved_at))
      || Date.parse(row.saved_at) !== Date.parse(read.state.updatedAt)) return { kind: "invalid" as const }
    if (!current()) return { kind: "stale_response" as const }
    return { kind: "read_only" as const, ownerId: owner, state: read.state,
      executionAuthority: "NONE" as const, storageState: "NOT_RESTORED" as const }
  } catch { return { kind: "failed" as const } }
}

/** An immutable server snapshot, not an activation or a restore operation. */
export async function backupMultiPlanSnapshotV3(expectedFingerprint: string,
  readEvidence: () => readonly RetainedMultiAdjustedEvidenceV3[], dependencies: Dependencies = operating) {
  const unavailable = () => ({ kind: "unavailable" as const })
  try {
    const owner = activeLocalAccount()
    if (owner === null || !dependencies.enabled()) return unavailable()
    const key = activePlanBetaStorageKey(), raw = localStorage.getItem(key)
    if (raw === null) return unavailable()
    const current = () => owner === activeLocalAccount() && dependencies.enabled()
      && key === activePlanBetaStorageKey() && raw === localStorage.getItem(key)
    const read = readStoredMultiAdjustedPlanV6(JSON.parse(raw), readEvidence())
    if (read.kind !== "loaded" || read.state.contentFingerprint !== expectedFingerprint) return unavailable()
    const client = await dependencies.client()
    if (!client || !current()) return unavailable()
    const { data, error } = await client.auth.getSession()
    if (error || data.session?.user.id !== owner || !current()) return unavailable()
    // Re-read independently retained versions after authentication, before crossing the network boundary.
    const checked = readStoredMultiAdjustedPlanV6(JSON.parse(raw), readEvidence())
    if (checked.kind !== "loaded" || checked.state.contentFingerprint !== expectedFingerprint || !current()) return unavailable()
    const { error: writeError } = await client.from("saved_training_plans").upsert({
      user_id: owner, plan_id: `multi-v6:${expectedFingerprint}`, schema_version: 6,
      plan_payload: checked.state, saved_at: checked.state.updatedAt,
    }, { onConflict: "user_id,plan_id", ignoreDuplicates: true })
    if (writeError) return { kind: "failed" as const }
    // A response for a previous account/plan must never mark the current screen as saved.
    if (!current()) return { kind: "stale_response" as const }
    return { kind: "saved" as const, contentFingerprint: expectedFingerprint }
  } catch { return { kind: "failed" as const } }
}
