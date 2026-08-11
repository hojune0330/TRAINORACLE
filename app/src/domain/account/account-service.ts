import { profileFromBirthDate } from "./profile"
import { supabase } from "./supabase-client"

export type AccountActionResult = {
  readonly ok: boolean
  readonly message: string
}

export type SaveProfileInput = {
  readonly userId: string
  readonly birthDate: string
  readonly privacyPolicyVersion: string
  readonly termsOfServiceVersion: string
}

const ADMITTED_STATUSES = new Set(["ADMITTED_NEW", "ADMITTED_EXISTING"])

export async function savePrivateProfile(input: SaveProfileInput): Promise<AccountActionResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  try {
    profileFromBirthDate(input.birthDate, new Date().toISOString().slice(0, 10))
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: "생년월일을 확인해 주세요." }
    throw error
  }
  const { data, error } = await client.rpc("claim_beta_seat", {
    birth_date_input: input.birthDate,
    privacy_policy_version_input: input.privacyPolicyVersion,
    terms_of_service_version_input: input.termsOfServiceVersion,
  })
  if (error !== null) return { ok: false, message: "계정 정보를 저장하지 못했어요." }
  if (data === "BETA_FULL") {
    return {
      ok: false,
      message: "무료 베타 200명 자리가 모두 찼어요. 기기 일지는 계속 사용할 수 있어요.",
    }
  }
  return typeof data === "string" && ADMITTED_STATUSES.has(data)
    ? { ok: true, message: "계정 정보를 저장했어요." }
    : { ok: false, message: "계정 정보를 저장하지 못했어요." }
}

export async function requestServerAccountDeletion(userId: string): Promise<AccountActionResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "계정 기능이 꺼져 있어요." }
  const { data: sessionData } = await client.auth.getSession()
  if (sessionData.session?.user.id !== userId) {
    return { ok: false, message: "로그인 정보를 다시 확인해 주세요." }
  }
  const { error } = await client.rpc("request_account_deletion")
  return error === null
    ? { ok: true, message: "계정 접근을 막았어요. 서버와 백업 데이터는 30일 안에 삭제해요." }
    : { ok: false, message: "계정 삭제를 요청하지 못했어요. 잠시 후 다시 시도해 주세요." }
}
