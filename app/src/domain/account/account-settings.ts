import { accountConfig, type AccountConfig } from "./config"
import { supabase } from "./supabase-client"
import { verifyReturnedAuthSession } from "./verified-auth-session"
import { accountDeletionBoundaryState } from "./account-deletion-boundary"
import { isAuthSessionQuarantined } from "./auth-session-quarantine"
import { hasPasswordRecoveryCallback, isPasswordRecoveryActive, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-auth"

type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>
type Context = { client: Client; userId: string; sessionId: string }
export type AccountAuthMethods = { ok: boolean; providers: readonly string[]; hasPassword: boolean; message: string }
export type AccountPasswordResult = { ok: boolean; state: "UPDATED" | "REAUTH_REQUIRED" | "LOGIN_REQUIRED" | "ERROR"; message: string }
const denied = (): AccountAuthMethods => ({ ok: false, providers: [], hasPassword: false, message: "로그인 방법을 확인하지 못했어요. 잠시 후 다시 확인해 주세요." })
const boundaryOpen = (userId: string) => accountDeletionBoundaryState(userId) === "OPEN" && !isAuthSessionQuarantined()
  && !hasPasswordRecoveryCallback() && !isPasswordRecoveryActive()

async function context(userId: string, existing?: Context): Promise<Context | null> {
  if (!boundaryOpen(userId)) return null
  const client = existing?.client ?? await supabase()
  if (!client) return null
  const session = await client.auth.getSession()
  const token = session.data.session?.access_token
  if (session.error || !token || session.data.session?.user.id !== userId) return null
  const sessionId = await verifyReturnedAuthSession(client, { accessToken: token, expectedUserId: userId })
  if (!sessionId || existing && existing.sessionId !== sessionId || !boundaryOpen(userId)) return null
  const claims = await client.auth.getClaims(token)
  const amr = claims.data?.claims.amr
  if (claims.error || !Array.isArray(amr) || amr.some(item => typeof item !== "object" || item === null || ["recovery", "invite", "anonymous"].includes(item.method))) return null
  return { client, userId, sessionId }
}

async function methods(checked: Context): Promise<AccountAuthMethods> {
  const { data, error } = await checked.client.rpc("get_account_auth_methods", {
    expected_user_id_input: checked.userId, expected_session_id_input: checked.sessionId,
  })
  if (error || !data || !Array.isArray(data.providers) || data.providers.some((item: unknown) => typeof item !== "string")
    || typeof data.hasPassword !== "boolean" || !await context(checked.userId, checked)) return denied()
  return { ok: true, providers: data.providers, hasPassword: data.hasPassword, message: "" }
}

export async function loadAccountAuthMethods(userId: string): Promise<AccountAuthMethods> {
  try { const checked = await context(userId); return checked ? await methods(checked) : denied() } catch { return denied() }
}

/** Navigation completion is bound to the exact callback session, too. */
export async function isCurrentAccountAuthAttempt(userId: string, expectedSessionId: string): Promise<boolean> {
  try { return (await context(userId))?.sessionId === expectedSessionId } catch { return false }
}

export async function requestAccountPasswordReauthentication(userId: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (!accountConfig()?.passwordAuthEnabled) return { ok: false, message: "비밀번호 설정이 잠시 닫혀 있어요." }
    const checked = await context(userId)
    if (!checked || !(await methods(checked)).ok) return denied()
    const result = await checked.client.auth.reauthenticate()
    if (result.error || !await context(userId, checked)) return { ok: false, message: "추가 확인 메일을 보내지 못했어요. 다시 시도해 주세요." }
    return { ok: true, message: "이 계정의 확인 메일에 있는 인증번호를 입력해 주세요." }
  } catch { return { ok: false, message: "추가 확인 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." } }
}

/** Update the existing account only. Passwords and nonce remain in caller memory. */
export async function updateAccountPassword(input: { userId: string; password: string; currentPassword?: string; nonce?: string }): Promise<AccountPasswordResult> {
  const error = (message: string): AccountPasswordResult => ({ ok: false, state: "ERROR", message })
  if (!accountConfig()?.passwordAuthEnabled) return error("비밀번호 설정이 잠시 닫혀 있어요.")
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) return error(`${PASSWORD_MIN_LENGTH}자 이상 새 비밀번호를 입력해 주세요.`)
  try {
    const checked = await context(input.userId)
    if (!checked) return error("현재 로그인한 계정을 다시 확인해 주세요.")
    const methodState = await methods(checked)
    if (!methodState.ok) return error(methodState.message)
    if (methodState.hasPassword && !input.currentPassword) return error("현재 비밀번호를 입력해 주세요.")
    const result = await checked.client.auth.updateUser({ password: input.password,
      ...(methodState.hasPassword ? { current_password: input.currentPassword } : {}), ...(input.nonce ? { nonce: input.nonce } : {}) })
    if (result.error) {
      if (["reauthentication_needed", "reauthentication_not_valid"].includes(result.error.code ?? "")) {
        return { ok: false, state: "REAUTH_REQUIRED", message: "보안을 위해 이메일로 한 번 더 확인해 주세요." }
      }
      if (result.error.code === "weak_password") return error("비밀번호가 서비스 보안 기준에 맞지 않아요. 더 길고 추측하기 어려운 비밀번호를 입력해 주세요.")
      if (result.error.code === "same_password") return error("현재와 다른 새 비밀번호를 입력해 주세요.")
      return error("비밀번호를 바꾸지 못했어요. 현재 비밀번호와 확인 번호를 확인해 주세요.")
    }
    if (result.data.user?.id !== input.userId) return error("현재 계정이 바뀌어 결과를 확인하지 못했어요.")
    const after = await context(input.userId, checked)
    if (after) return { ok: true, state: "UPDATED", message: "비밀번호를 저장했어요. 같은 계정과 기록을 그대로 사용해요." }
    const session = await checked.client.auth.getSession()
    if (!session.error && session.data.session === null) return { ok: true, state: "LOGIN_REQUIRED", message: "비밀번호를 저장했어요. 새 비밀번호로 로그인해 주세요." }
    return error("비밀번호 저장 응답은 받았지만 현재 세션을 확인하지 못했어요. 다시 계정을 확인해 주세요.")
  } catch { return error("비밀번호 저장 결과를 확인하지 못했어요. 잠시 후 계정 상태를 다시 확인해 주세요.") }
}

export async function reacceptAccountTerms(userId: string, config: AccountConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const checked = await context(userId)
    if (!checked) return { ok: false, message: "현재 로그인한 계정을 다시 확인해 주세요." }
    const result = await checked.client.rpc("reaccept_account_terms", {
      expected_user_id_input: userId, expected_session_id_input: checked.sessionId,
      privacy_policy_version_input: config.privacyPolicy.version, terms_of_service_version_input: config.termsOfService.version,
    })
    if (!result.error && result.data === "ADMITTED_EXISTING" && await context(userId, checked)) {
      return { ok: true, message: "약관 확인을 마쳤어요." }
    }
    return { ok: false, message: "약관 동의를 저장하지 못했어요. 계정 상태를 다시 확인해 주세요." }
  } catch { return { ok: false, message: "약관 동의 결과를 확인하지 못했어요. 잠시 후 다시 확인해 주세요." } }
}
