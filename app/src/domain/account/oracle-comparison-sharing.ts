import { oracleComparisonSnapshotSchema } from "../friend-running-oracle"
import type { OracleComparisonSnapshot } from "../friend-running-oracle"
import { productFeatures } from "../product-features"
import { supabase } from "./supabase-client"

export type OracleComparisonShareResult = {
  readonly ok: boolean
  readonly message: string
}

export async function saveOwnOracleComparisonSnapshot(
  userId: string,
  snapshot: OracleComparisonSnapshot | null,
): Promise<OracleComparisonShareResult> {
  if (!productFeatures().publicProfile) {
    return { ok: false, message: "현재 친구 비교 공유를 사용할 수 없어요." }
  }
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능을 사용할 수 없어요." }
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) {
    return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  if (snapshot === null) {
    const { error } = await client.from("public_oracle_comparison_snapshots").delete().eq("user_id", userId)
    return error === null
      ? { ok: true, message: "친구 비교용 기록 공개를 중단했어요." }
      : { ok: false, message: "친구 비교 공개를 중단하지 못했어요." }
  }
  const parsed = oracleComparisonSnapshotSchema.safeParse(snapshot)
  if (!parsed.success) return { ok: false, message: "공개할 비교 기록을 다시 확인해 주세요." }
  const { error } = await client.from("public_oracle_comparison_snapshots").upsert({
    user_id: userId,
    snapshot_payload: parsed.data,
    is_enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" })
  return error === null
    ? { ok: true, message: "고른 항목만 친구 비교에 공개했어요." }
    : { ok: false, message: "친구 비교 기록을 저장하지 못했어요." }
}

export async function loadOwnOracleComparisonSnapshot(
  userId: string,
): Promise<OracleComparisonSnapshot | null> {
  const client = await supabase()
  if (client === null) return null
  const { data, error } = await client
    .from("public_oracle_comparison_snapshots")
    .select("snapshot_payload, is_enabled")
    .eq("user_id", userId)
    .maybeSingle()
  if (error !== null || data?.is_enabled !== true) return null
  const parsed = oracleComparisonSnapshotSchema.safeParse(data.snapshot_payload)
  return parsed.success ? parsed.data : null
}

export async function loadPublicOracleComparisonSnapshot(
  userId: string,
): Promise<OracleComparisonSnapshot | null> {
  const client = await supabase()
  if (client === null) return null
  const { data, error } = await client
    .from("public_oracle_comparison_snapshots")
    .select("snapshot_payload, is_enabled")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .maybeSingle()
  if (error !== null || data?.is_enabled !== true) return null
  const parsed = oracleComparisonSnapshotSchema.safeParse(data.snapshot_payload)
  return parsed.success ? parsed.data : null
}
