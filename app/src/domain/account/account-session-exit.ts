import { signOut } from "./auth"
import type { AccountSignOutOptions, AuthResult } from "./auth"

export type DeletedAccountExitResult = AuthResult & {
  /** True only when this browser's session was confirmed closed. */
  readonly localSessionClosed: boolean
}

type SignOutPort = (options: AccountSignOutOptions) => Promise<AuthResult>

async function safeSignOut(onSignOut: SignOutPort, scope: "global" | "local"): Promise<AuthResult> {
  try {
    return await onSignOut({ scope })
  } catch {
    return { ok: false, message: "로그아웃에 실패했어요." }
  }
}

/**
 * A successful deletion request must not leave the deleted account looking
 * usable. We first ask Supabase to close every session. If that cannot be
 * confirmed, we still try to close this browser, but explicitly report that
 * other devices were not confirmed instead of claiming a global logout.
 */
export async function closeDeletedAccountSessions(
  onSignOut: SignOutPort = signOut,
): Promise<DeletedAccountExitResult> {
  const globalResult = await safeSignOut(onSignOut, "global")
  if (globalResult.ok) {
    return {
      ok: true,
      localSessionClosed: true,
      message: "계정 삭제 요청을 저장했고 모든 기기에서 로그아웃했어요.",
    }
  }

  const localResult = await safeSignOut(onSignOut, "local")
  if (localResult.ok) {
    return {
      ok: false,
      localSessionClosed: true,
      message: "계정 삭제 요청은 저장했어요. 이 기기에서는 로그아웃했지만 다른 기기의 로그아웃은 확인하지 못했어요.",
    }
  }

  return {
    ok: false,
    localSessionClosed: false,
    message: "계정 삭제 요청은 저장했지만 로그아웃을 확인하지 못했어요. 계정 접근은 서버에서 차단됐고, 이 기기에서 다시 로그아웃해 주세요.",
  }
}
