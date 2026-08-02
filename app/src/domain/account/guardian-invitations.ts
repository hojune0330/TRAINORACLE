import { supabase } from "./supabase-client"
import {
  createSupportInvitationCode,
  hashSupportInvitationCode,
} from "./support-invitations"

export type GuardianInvitationResult = {
  readonly ok: boolean
  readonly message: string
  readonly code?: string
}

export const createGuardianInvitationCode = createSupportInvitationCode
export const hashGuardianInvitationCode = hashSupportInvitationCode

export async function createGuardianInvitation(
  childUserId: string,
): Promise<GuardianInvitationResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "보호자 확인 기능이 꺼져 있어요." }
  const code = createGuardianInvitationCode()
  const codeHash = await hashGuardianInvitationCode(code)
  const { error } = await client.rpc("create_guardian_invitation", {
    invitation_code_hash: codeHash,
  })
  return error === null
    ? { ok: true, message: "보호자 확인 코드를 만들었어요. 7일 안에 전달해 주세요.", code }
    : { ok: false, message: "만 14세 미만 계정에서만 확인 코드를 만들 수 있어요." }
}

export async function acceptGuardianInvitation(
  code: string,
): Promise<GuardianInvitationResult> {
  const client = await supabase()
  if (client === null) return { ok: false, message: "보호자 확인 기능이 꺼져 있어요." }
  let codeHash: string
  try {
    codeHash = await hashGuardianInvitationCode(code)
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, message: error.message }
    throw error
  }
  const { error } = await client.rpc("accept_guardian_invitation", {
    invitation_code_hash: codeHash,
  })
  return error === null
    ? { ok: true, message: "보호자 확인을 마쳤어요. 아이가 다시 로그인하면 동기화를 사용할 수 있어요." }
    : { ok: false, message: "코드가 잘못됐거나 만료됐어요. 아이 계정과 같은 계정에서는 확인할 수 없어요." }
}
