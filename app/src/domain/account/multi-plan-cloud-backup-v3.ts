import { readStoredMultiAdjustedPlanV6 } from "../adjusted-plan-storage-v6"
import type { RetainedMultiAdjustedEvidenceV3 } from "../selected-multi-adjusted-plan-v3"
import { activePlanBetaStorageKey } from "../plan-beta-store"
import { activeLocalAccount } from "./local-journal-ownership"
import { planCloudBackupEnabled } from "./plan-cloud-backup"
import { supabase } from "./supabase-client"

type Dependencies = { readonly enabled: () => boolean; readonly client: typeof supabase }
const operating: Dependencies = { enabled: planCloudBackupEnabled, client: supabase }

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
