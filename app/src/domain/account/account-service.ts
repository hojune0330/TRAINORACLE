import { profileFromBirthDate } from "./profile"
import { koreaServiceDate } from "./service-date"
import { supabase } from "./supabase-client"
import { verifyReturnedAuthSession } from "./verified-auth-session"
import { z } from "zod"
import { accountDeletionBoundaryState, closeAccountDeletionBoundary } from "./account-deletion-boundary"
import { activeLocalAccount, setActiveLocalAccount } from "./local-journal-ownership"
import { setAccountAuthState } from "./account-auth-state"

export type AccountActionResult = {
  readonly ok: boolean
  readonly message: string
}

export type SaveProfileInput = {
  readonly userId: string
  /** Exact session proved by the auth callback. Other trusted completion flows resolve it again. */
  readonly expectedSessionId?: string
  readonly birthDate: string
  readonly privacyPolicyVersion: string
  readonly termsOfServiceVersion: string
}

export type PrivateProfileSetupStatus = {
  readonly ok: boolean
  readonly ready: boolean
  readonly canComplete: boolean
  readonly message: string
}

const ADMITTED_STATUSES = new Set(["ADMITTED_NEW", "ADMITTED_EXISTING"])
const COMPLETABLE_ADMISSION_STATUSES = new Set([
  "NEEDS_PROFILE",
  "LEGAL_RECONSENT_REQUIRED",
  "BETA_NOT_ENROLLED",
])

function setupStatusFromServer(value: unknown): PrivateProfileSetupStatus {
  if (value === "ADMITTED") {
    return { ok: true, ready: true, canComplete: false, message: "가입 확인을 마쳤어요." }
  }
  if (typeof value === "string" && COMPLETABLE_ADMISSION_STATUSES.has(value)) {
    return {
      ok: true,
      ready: false,
      canComplete: true,
      message: value === "LEGAL_RECONSENT_REQUIRED"
        ? "필수 약관이 바뀌었어요. 나이와 약관을 다시 확인해 주세요."
        : "가입 확인을 마무리해 주세요.",
    }
  }
  if (value === "ACCOUNT_DISABLED") {
    return { ok: false, ready: false, canComplete: false, message: "계정 기능이 잠시 꺼져 있어요." }
  }
  if (value === "UNDER_14") {
    return {
      ok: false,
      ready: false,
      canComplete: false,
      message: "온라인 계정은 만 14세부터 이용할 수 있어요. 기기 일지와 훈련 계획은 그대로 사용할 수 있어요.",
    }
  }
  if (value === "DELETION_REQUESTED") {
    return { ok: false, ready: false, canComplete: false, message: "삭제를 요청한 계정은 다시 사용할 수 없어요." }
  }
  if (value === "LOGIN_REQUIRED" || value === "IDENTITY_MISMATCH") {
    return { ok: false, ready: false, canComplete: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  if (value === "AUTH_METHOD_UNSUPPORTED") {
    return { ok: false, ready: false, canComplete: false, message: "지원하지 않는 로그인 방식이에요. 로그아웃한 뒤 이메일 확인 링크나 간편 로그인으로 다시 시작해 주세요." }
  }
  return { ok: false, ready: false, canComplete: false, message: "가입 확인 정보를 확인하지 못했어요." }
}

function localProfileBoundaryStatus(userId: string): PrivateProfileSetupStatus | null {
  const state = accountDeletionBoundaryState(userId)
  if (state === "OPEN") return null
  if (state === "CLOSED") return setupStatusFromServer("DELETION_REQUESTED")
  return { ok: false, ready: false, canComplete: false, message: "이 기기의 계정 보호 상태를 확인하지 못했어요. 기록은 유지하고 계정 기능을 잠시 멈췄어요." }
}

export async function loadPrivateProfileSetupStatus(input: {
  readonly userId: string
  // Transitional optional fields keep an older caller source-compatible. They
  // are deliberately ignored: only the server's current policy is authority.
  readonly privacyPolicyVersion?: string
  readonly termsOfServiceVersion?: string
}): Promise<PrivateProfileSetupStatus> {
  const initialBoundary = localProfileBoundaryStatus(input.userId)
  if (initialBoundary) return initialBoundary
  const client = await supabase()
  if (client === null) {
    return { ok: false, ready: false, canComplete: false, message: "계정 확인 기능이 꺼져 있어요." }
  }
  try {
    const { data: userData, error: userError } = await client.auth.getUser()
    const checkedBoundary = localProfileBoundaryStatus(input.userId)
    if (checkedBoundary) return checkedBoundary
    if (userError != null || userData.user?.id !== input.userId) {
      return { ok: false, ready: false, canComplete: false, message: "로그인 정보를 다시 확인해 주세요." }
    }
    const { data, error } = await client.rpc("get_current_account_admission_status", {
      expected_user_id_input: input.userId,
    })
    if (error != null) {
      return { ok: false, ready: false, canComplete: false, message: "가입 확인 정보를 불러오지 못했어요." }
    }
    return localProfileBoundaryStatus(input.userId) ?? setupStatusFromServer(data)
  } catch {
    return { ok: false, ready: false, canComplete: false, message: "가입 확인 정보를 불러오지 못했어요." }
  }
}

export async function savePrivateProfile(input: SaveProfileInput): Promise<AccountActionResult> {
  const initialBoundary = localProfileBoundaryStatus(input.userId)
  if (initialBoundary) return initialBoundary
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  try {
    const profile = profileFromBirthDate(input.birthDate, koreaServiceDate())
    if (profile.ageBand === "UNDER_14") {
      return {
        ok: false,
        message: "온라인 계정은 만 14세부터 만들 수 있어요. 기기 일지와 훈련 계획은 그대로 사용할 수 있어요.",
      }
    }
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: "생년월일을 확인해 주세요." }
    throw error
  }
  const { data: userData, error: userError } = await client.auth.getUser()
  if (accountDeletionBoundaryState(input.userId) !== "OPEN" || userError != null || userData.user?.id !== input.userId) {
    return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  let expectedSessionId = input.expectedSessionId ?? null
  if (expectedSessionId === null) {
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (sessionError != null || typeof accessToken !== "string") {
        return { ok: false, message: "로그인 세션을 다시 확인해 주세요." }
      }
      expectedSessionId = await verifyReturnedAuthSession(client, {
        accessToken,
        expectedUserId: input.userId,
      })
    } catch {
      return { ok: false, message: "로그인 세션을 다시 확인해 주세요." }
    }
    if (expectedSessionId === null) return { ok: false, message: "로그인 세션을 다시 확인해 주세요." }
  }
  const preClaimBoundary = localProfileBoundaryStatus(input.userId)
  if (preClaimBoundary) return preClaimBoundary
  const { data, error } = await client.rpc("claim_beta_seat", {
    expected_user_id_input: input.userId,
    expected_session_id_input: expectedSessionId,
    birth_date_input: input.birthDate,
    privacy_policy_version_input: input.privacyPolicyVersion,
    terms_of_service_version_input: input.termsOfServiceVersion,
  })
  const returnedBoundary = localProfileBoundaryStatus(input.userId)
  if (returnedBoundary) return returnedBoundary
  if (error !== null) return { ok: false, message: "계정 정보를 저장하지 못했어요." }
  if (data === "BETA_FULL") {
    return {
      ok: false,
      message: "무료 베타 200명 자리가 모두 찼어요. 기기 일지는 계속 사용할 수 있어요.",
    }
  }
  if (data === "UNDER_14_NOT_ELIGIBLE") {
    return {
      ok: false,
      message: "온라인 계정은 만 14세부터 만들 수 있어요. 기기 일지와 훈련 계획은 그대로 사용할 수 있어요.",
    }
  }
  if (data === "BIRTH_DATE_MISMATCH") {
    return { ok: false, message: "기존 계정의 생년월일과 달라 정보를 바꾸지 않았어요. 입력값을 다시 확인해 주세요." }
  }
  if (data === "IDENTITY_MISMATCH" || data === "LOGIN_REQUIRED") {
    return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  if (data === "SESSION_MISMATCH") {
    return { ok: false, message: "로그인 세션이 바뀌었어요. 가입 확인을 처음부터 다시 진행해 주세요." }
  }
  if (data === "AUTH_METHOD_UNSUPPORTED") {
    return { ok: false, message: "지원하지 않는 로그인 방식이에요. 로그아웃한 뒤 이메일 확인 링크나 간편 로그인으로 다시 시작해 주세요." }
  }
  if (data === "ACCOUNT_FEATURE_DISABLED") {
    return { ok: false, message: "계정 기능이 잠시 꺼져 있어요." }
  }
  if (data === "ACCOUNT_BLOCKED") {
    return { ok: false, message: "삭제를 요청한 계정은 다시 사용할 수 없어요." }
  }
  if (data === "CLIENT_UPDATE_REQUIRED") {
    return { ok: false, message: "새로고침한 뒤 가입 확인을 다시 진행해 주세요." }
  }
  return typeof data === "string" && ADMITTED_STATUSES.has(data)
    ? { ok: true, message: "계정 정보를 저장했어요." }
    : { ok: false, message: "계정 정보를 저장하지 못했어요." }
}

export async function requestServerAccountDeletion(userId: string): Promise<AccountActionResult> {
  try {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError != null || userData.user?.id !== userId) {
    return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  const { data, error } = await client.rpc("request_account_deletion", {
    expected_user_id_input: userId,
  })
  const confirmed = error === null && z.iso.datetime({ offset: true }).safeParse(data).success
  if (confirmed) {
    // Terminal before UI/logout; never remove this owner's device recovery data.
    closeAccountDeletionBoundary(userId, data as string)
    if (activeLocalAccount() === userId) {
      setActiveLocalAccount(null)
      setAccountAuthState("FAILED")
    }
  }
  return confirmed
    ? { ok: true, message: "계정 삭제 요청을 접수하고 접근을 막았어요. 온라인 건강·일지 자료 삭제와 나머지 계정 정보 정리는 별도 완료 상태를 확인해 주세요. 기기 기록은 그대로이며 백업 정리 완료를 뜻하지 않아요." }
    : { ok: false, message: "계정 삭제를 요청하지 못했어요. 잠시 후 다시 시도해 주세요." }
  } catch { return { ok: false, message: "계정 삭제를 요청하지 못했어요. 잠시 후 다시 시도해 주세요." } }
}
