const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

type AuthSessionProofClient = {
  readonly auth: {
    readonly getClaims: (accessToken: string) => Promise<{
      readonly data: { readonly claims?: unknown } | null
      readonly error: unknown
    }>
    readonly getUser: (accessToken: string) => Promise<{
      readonly data: { readonly user?: { readonly id?: unknown } | null }
      readonly error: unknown
    }>
  }
}

/**
 * Verify the exact access token returned by an Auth operation and extract only
 * its server-issued session id. Ambient browser session state is intentionally
 * ignored because another tab can replace it between callback and enrollment.
 */
export async function verifyReturnedAuthSession(
  client: AuthSessionProofClient,
  input: { readonly accessToken: string; readonly expectedUserId: string },
): Promise<string | null> {
  if (input.accessToken.length < 32 || input.accessToken.length > 16_384) return null
  try {
    const claimResult = await client.auth.getClaims(input.accessToken)
    if (claimResult.error != null || claimResult.data === null) return null
    const claims = claimResult.data.claims
    if (typeof claims !== "object" || claims === null) return null
    const subject = Reflect.get(claims, "sub")
    const sessionId = Reflect.get(claims, "session_id")
    if (subject !== input.expectedUserId || typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
      return null
    }

    const userResult = await client.auth.getUser(input.accessToken)
    if (userResult.error != null || userResult.data.user?.id !== input.expectedUserId) return null
    return sessionId
  } catch {
    return null
  }
}
