import { z } from "zod"
import type { AgeBand } from "./relationships"

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)
const isoTimestampSchema = z.string().datetime({ offset: true })

export const guardianAuthorityScopes = [
  "ACCOUNT_SYNC",
  "FIRST_LINK",
  "SHARE_EXPANSION",
  "SEASON_RENEWAL",
] as const

export type GuardianAuthorityScope = typeof guardianAuthorityScopes[number]

export const guardianAuthoritySchema = z.object({
  validFrom: isoTimestampSchema,
  validUntil: isoTimestampSchema,
  seasonEndsOn: isoDateSchema,
  scope: z.enum(guardianAuthorityScopes),
  revokedAt: isoTimestampSchema.nullable(),
})

export type GuardianAuthority = z.infer<typeof guardianAuthoritySchema>

export type AccountProfile = {
  readonly birthDate: string
  readonly ageBand: AgeBand
  readonly guardianAuthority: unknown | null
}

export function ageBandOn(birthDate: string, onDate: string): AgeBand {
  const birth = parseDate(birthDate)
  const today = parseDate(onDate)
  if (birth.getTime() > today.getTime()) throw new RangeError("Birth date cannot be in the future.")

  const fourteenthBirthday = new Date(Date.UTC(
    birth.getUTCFullYear() + 14,
    birth.getUTCMonth(),
    birth.getUTCDate(),
  ))
  return fourteenthBirthday.getTime() <= today.getTime() ? "AGE_14_OR_OVER" : "UNDER_14"
}

export function profileFromBirthDate(birthDate: string, onDate: string): AccountProfile {
  return {
    birthDate,
    ageBand: ageBandOn(birthDate, onDate),
    guardianAuthority: null,
  }
}

export function networkAccessForProfile(
  profile: AccountProfile,
  serverNow: string,
): {
  readonly sync: boolean
  readonly sharing: boolean
} {
  const allowed = profile.ageBand === "AGE_14_OR_OVER" || isGuardianAuthorityActive(
    profile.guardianAuthority,
    "ACCOUNT_SYNC",
    null,
    serverNow,
  )
  return { sync: allowed, sharing: allowed }
}

export function isGuardianAuthorityActive(
  authority: unknown,
  requiredScope: GuardianAuthorityScope,
  requiredSeasonEndsOn: string | null,
  serverNow: string,
): boolean {
  const parsedAuthority = guardianAuthoritySchema.safeParse(authority)
  const parsedServerNow = isoTimestampSchema.safeParse(serverNow)
  if (!parsedAuthority.success || !parsedServerNow.success) return false

  const serverNowMs = Date.parse(parsedServerNow.data)
  const validFromMs = Date.parse(parsedAuthority.data.validFrom)
  const validUntilMs = Date.parse(parsedAuthority.data.validUntil)
  const serverDate = parsedServerNow.data.slice(0, 10)
  return Number.isFinite(serverNowMs)
    && validFromMs <= serverNowMs
    && validUntilMs > serverNowMs
    && parsedAuthority.data.revokedAt === null
    && parsedAuthority.data.seasonEndsOn >= serverDate
    && (requiredSeasonEndsOn === null || parsedAuthority.data.seasonEndsOn >= requiredSeasonEndsOn)
    && parsedAuthority.data.scope === requiredScope
}

function parseDate(value: string): Date {
  if (!isoDateSchema.safeParse(value).success) throw new RangeError("Invalid ISO date.")
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Invalid calendar date.")
  }
  return date
}
