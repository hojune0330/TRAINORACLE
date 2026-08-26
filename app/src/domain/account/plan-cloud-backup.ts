import { planBetaStateV3Schema } from "../plan-beta-schema"
import type { PlanBetaStateV3 } from "../plan-beta-schema"
import { productFeatures } from "../product-features"
import { activeLocalAccount } from "./local-journal-ownership"
import { supabase } from "./supabase-client"
import { accountScopedStorageKey } from "./local-account-scope"

export const PLAN_CLOUD_ARCHIVE_STORAGE_KEY = "trainoracle.plan-cloud-archive.v1"

export type PlanCloudBackupResult =
  | { readonly kind: "saved" }
  | { readonly kind: "loaded"; readonly state: PlanBetaStateV3 }
  | { readonly kind: "unavailable" }
  | { readonly kind: "failed" }

export function planCloudBackupEnabled(): boolean {
  return productFeatures().planBackup && activeLocalAccount() !== null
}

export async function backupActivePlanToServer(state: unknown): Promise<PlanCloudBackupResult> {
  if (!planCloudBackupEnabled()) return { kind: "unavailable" }
  const parsed = planBetaStateV3Schema.safeParse(state)
  const ownerId = activeLocalAccount()
  if (!parsed.success || ownerId === null) return { kind: "unavailable" }
  if (archivedPlanIds().has(parsed.data.activePlan.candidateId)) return { kind: "unavailable" }
  const client = await supabase()
  if (client === null) return { kind: "unavailable" }
  try {
    const { data: sessionData } = await client.auth.getSession()
    if (sessionData.session?.user.id !== ownerId) return { kind: "unavailable" }
    const { error } = await client.from("saved_training_plans").upsert({
      user_id: ownerId,
      plan_id: parsed.data.activePlan.candidateId,
      plan_payload: parsed.data,
      schema_version: 3,
      saved_at: new Date().toISOString(),
    }, { onConflict: "user_id,plan_id" })
    return error === null ? { kind: "saved" } : { kind: "failed" }
  } catch {
    return { kind: "failed" }
  }
}

export async function loadLatestPlanFromServer(): Promise<PlanCloudBackupResult> {
  if (!planCloudBackupEnabled()) return { kind: "unavailable" }
  const ownerId = activeLocalAccount()
  if (ownerId === null) return { kind: "unavailable" }
  const client = await supabase()
  if (client === null) return { kind: "unavailable" }
  try {
    const { data: sessionData } = await client.auth.getSession()
    if (sessionData.session?.user.id !== ownerId) return { kind: "unavailable" }
    const { data, error } = await client
      .from("saved_training_plans")
      .select("plan_id, plan_payload")
      .eq("user_id", ownerId)
      .is("archived_at", null)
      .order("saved_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error !== null || data === null) return { kind: "unavailable" }
    if (typeof data.plan_id !== "string" || archivedPlanIds().has(data.plan_id)) {
      return { kind: "unavailable" }
    }
    const parsed = planBetaStateV3Schema.safeParse(data.plan_payload)
    return parsed.success ? { kind: "loaded", state: parsed.data } : { kind: "failed" }
  } catch {
    return { kind: "failed" }
  }
}

export async function archivePlanOnServer(planId: string): Promise<void> {
  rememberArchivedPlan(planId)
  if (!productFeatures().planBackup) return
  const ownerId = activeLocalAccount()
  if (ownerId === null) return
  const client = await supabase()
  if (client === null) return
  try {
    const { data: sessionData } = await client.auth.getSession()
    if (sessionData.session?.user.id !== ownerId) return
    await client
      .from("saved_training_plans")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", ownerId)
      .eq("plan_id", planId)
  } catch {
    // The local archive marker remains authoritative until a later retry.
  }
}

function archivedPlanIds(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(accountScopedStorageKey(PLAN_CLOUD_ARCHIVE_STORAGE_KEY))
    if (raw === null) return new Set()
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === "string" && value !== ""))
      : new Set()
  } catch {
    return new Set()
  }
}

function rememberArchivedPlan(planId: string): void {
  if (typeof window === "undefined" || planId === "") return
  try {
    const next = [...new Set([...archivedPlanIds(), planId])].slice(-20)
    window.localStorage.setItem(accountScopedStorageKey(PLAN_CLOUD_ARCHIVE_STORAGE_KEY), JSON.stringify(next))
  } catch {
    // Failing to write the marker leaves the server archive request as the fallback.
  }
}
