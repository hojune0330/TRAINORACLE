import { supabase } from "./supabase-client"
import { activeLocalAccount } from "./local-journal-ownership"
import { verifyReturnedAuthSession } from "./verified-auth-session"
import { profileComparisonRequestSchema, profileComparisonResponseSchema, type ProfileComparisonRequest, type ProfileComparisonResponse } from "./oracle-profile-comparison-contract"

export type ProfileComparisonResult = { ok: true; data: ProfileComparisonResponse }
  | { ok: false; code: "AUTH_REQUIRED" | "ACCESS_DENIED" | "UNAVAILABLE" | "INVALID_REQUEST" | "INVALID_RESPONSE" | "STALE_RESPONSE" }

/** Authenticated endpoint only. Never falls back to public-profile or manual consent. */
export async function requestProfileComparison(ownerId: string, request: ProfileComparisonRequest, isCurrent: () => boolean,
  dependencies: { client: typeof supabase; owner: typeof activeLocalAccount } = { client: supabase, owner: activeLocalAccount },
): Promise<ProfileComparisonResult> {
  const parsed = profileComparisonRequestSchema.safeParse(request)
  if (!parsed.success) return { ok: false, code: "INVALID_REQUEST" }
  const withdrawal = parsed.data.action === "revoke" || parsed.data.action === "revokeExternal"
  // A legal-version change can close local admission without revoking Auth identity.
  // Only withdrawal may proceed without local scope, and never under another owner.
  const current = () => {
    const owner = dependencies.owner()
    return isCurrent() && (owner === ownerId || withdrawal && owner === null)
  }
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  try {
    const client = await dependencies.client()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "UNAVAILABLE" }
    const before = await client.auth.getSession()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    const session = before.data.session, token = session?.access_token
    if (before.error || session?.user.id !== ownerId || !token || !/^[A-Za-z0-9._~-]+$/u.test(token)) return { ok: false, code: "AUTH_REQUIRED" }
    const sessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: ownerId })
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!sessionId) return { ok: false, code: "AUTH_REQUIRED" }
    const response = await client.functions.invoke("oracle-profile-comparison", { body: parsed.data, headers: { Authorization: `Bearer ${token}` } })
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    const after = await client.auth.getSession()
    if (!current() || after.error || after.data.session?.user.id !== ownerId || after.data.session.access_token !== token) return { ok: false, code: "STALE_RESPONSE" }
    const confirmedSessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: ownerId })
    if (!current() || confirmedSessionId !== sessionId) return { ok: false, code: "STALE_RESPONSE" }
    if (response.error) return { ok: false, code: response.error.context instanceof Response && response.error.context.status === 403 ? "ACCESS_DENIED" : "UNAVAILABLE" }
    const result = profileComparisonResponseSchema.safeParse(response.data)
    const kinds = { createInvite: "invitation-created", acceptInvite: "invitation", invitationStatus: "invitation", consent: "consented", allowExternal: "external-consented", revoke: "revoked", revokeExternal: "external-revoked", compare: "comparison", export: "export", status: "status" }
    if (!result.success || ("comparisonId" in request && result.data.comparisonId !== request.comparisonId) || result.data.kind !== kinds[request.action]) return { ok: false, code: "INVALID_RESPONSE" }
    if ((result.data.kind === "comparison" || result.data.kind === "export")
      && (!Number.isFinite(Date.parse(result.data.validUntil)) || Date.parse(result.data.validUntil) <= Date.now())) return { ok: false, code: "STALE_RESPONSE" }
    return { ok: true, data: result.data }
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
}
