export type AgeBand = "UNDER_14" | "AGE_14_OR_OVER"

export type NetworkEligibility = {
  readonly ageBand: AgeBand
  readonly guardianConfirmedAt: string | null
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
  readonly guardianConfirmedAt: string | null
}

export type ConnectionChange =
  | { readonly kind: "GUARDIAN_CONFIRMATION_REQUIRED"; readonly connection: SupportConnection }
  | { readonly kind: "UPDATED"; readonly connection: SupportConnection }

export type SupportConnectionRequest = ConnectionChange

export function canUseNetworkFeatures(eligibility: NetworkEligibility): boolean {
  return eligibility.ageBand === "AGE_14_OR_OVER" || eligibility.guardianConfirmedAt !== null
}

export function createSupportConnection(input: {
  readonly athleteId: string
  readonly supporterId: string
  readonly seasonEndsOn: string
  readonly guardianConfirmedAt: string | null
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
  readonly guardianConfirmedAt: string | null
}): SupportConnectionRequest {
  const connection = createSupportConnection(input)
  if (input.ageBand === "UNDER_14" && input.guardianConfirmedAt === null) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return { kind: "UPDATED", connection }
}

export function expandSharingScope(
  connection: SupportConnection,
  ageBand: AgeBand,
  guardianConfirmedAt: string | null,
): ConnectionChange {
  if (ageBand === "UNDER_14" && guardianConfirmedAt === null) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return { kind: "UPDATED", connection: { ...connection, guardianConfirmedAt } }
}

export function renewSupportConnection(
  connection: SupportConnection,
  ageBand: AgeBand,
  seasonEndsOn: string,
  guardianConfirmedAt: string | null,
): ConnectionChange {
  if (ageBand === "UNDER_14" && guardianConfirmedAt === null) {
    return { kind: "GUARDIAN_CONFIRMATION_REQUIRED", connection }
  }
  return {
    kind: "UPDATED",
    connection: { ...connection, seasonEndsOn, guardianConfirmedAt },
  }
}
