import { isGuardianAuthorityActive } from "./profile"
import type { GuardianAuthorityScope } from "./profile"

export type AgeBand = "UNDER_14" | "AGE_14_OR_OVER"

export type NetworkEligibility = {
  readonly ageBand: AgeBand
  readonly guardianAuthority: unknown | null
}

const DEFAULT_SHARED_FIELDS = [
  "TRAINING_RECORD",
  "TRAINING_NOTE",
  "PAIN",
  "MOOD",
  "BODY_STATE",
] as const

export type SupportConnection = {
  readonly athleteId: string
  readonly supporterId: string
  readonly seasonEndsOn: string
  readonly status: "ACTIVE"
  readonly qualificationLabel: "자격 미확인"
  readonly sharedFields: typeof DEFAULT_SHARED_FIELDS
  readonly guardianAuthority: unknown | null
}

export type ConnectionChange =
  | { readonly kind: "GUARDIAN_CONFIRMATION_REQUIRED"; readonly connection: SupportConnection }
  | { readonly kind: "UPDATED"; readonly connection: SupportConnection }

export type SupportConnectionRequest = ConnectionChange

export function canUseNetworkFeatures(eligibility: NetworkEligibility, serverNow: string): boolean {
  return eligibility.ageBand === "AGE_14_OR_OVER" || isAuthorityUsable(
    eligibility.ageBand,
    eligibility.guardianAuthority,
    "ACCOUNT_SYNC",
    null,
    serverNow,
  )
}

export function createSupportConnection(input: {
  readonly athleteId: string
  readonly supporterId: string
  readonly seasonEndsOn: string
  readonly guardianAuthority: unknown | null
}): SupportConnection {
  return {
    ...input,
    status: "ACTIVE",
    qualificationLabel: "자격 미확인",
    sharedFields: DEFAULT_SHARED_FIELDS,
  }
}

export function requestSupportConnection(input: {
  readonly ageBand: AgeBand
  readonly athleteId: string
  readonly supporterId: string
  readonly seasonEndsOn: string
  readonly guardianAuthority: unknown | null
  readonly serverNow: string
}): SupportConnectionRequest {
  const connection = createSupportConnection(input)
  if (!isAuthorityUsable(
    input.ageBand,
    input.guardianAuthority,
    "FIRST_LINK",
    input.seasonEndsOn,
    input.serverNow,
  )) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return { kind: "UPDATED", connection }
}

export function expandSharingScope(
  connection: SupportConnection,
  ageBand: AgeBand,
  guardianAuthority: unknown | null,
  serverNow: string,
): ConnectionChange {
  if (!isAuthorityUsable(ageBand, guardianAuthority, "SHARE_EXPANSION", connection.seasonEndsOn, serverNow)) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return { kind: "UPDATED", connection: { ...connection, guardianAuthority } }
}

export function renewSupportConnection(
  connection: SupportConnection,
  ageBand: AgeBand,
  seasonEndsOn: string,
  guardianAuthority: unknown | null,
  serverNow: string,
): ConnectionChange {
  if (!isAuthorityUsable(ageBand, guardianAuthority, "SEASON_RENEWAL", seasonEndsOn, serverNow)) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return {
    kind: "UPDATED",
    connection: { ...connection, seasonEndsOn, guardianAuthority },
  }
}

export async function runNetworkControlWhenEligible(
  eligibility: NetworkEligibility,
  serverNow: string,
  networkControl: () => Promise<void>,
): Promise<boolean> {
  if (!canUseNetworkFeatures(eligibility, serverNow)) return false
  await networkControl()
  return true
}

function isAuthorityUsable(
  ageBand: AgeBand,
  authority: unknown | null,
  scope: GuardianAuthorityScope,
  seasonEndsOn: string | null,
  serverNow: string,
): boolean {
  return ageBand === "AGE_14_OR_OVER" || isGuardianAuthorityActive(
    authority,
    scope,
    seasonEndsOn,
    serverNow,
  )
}
