import { z } from "zod"
import type { AgeBand } from "./relationships"

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)

export type AccountProfile = {
  readonly birthDate: string
  readonly ageBand: AgeBand
  readonly guardianConfirmedAt: string | null
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
    guardianConfirmedAt: null,
  }
}

export function networkAccessForProfile(profile: AccountProfile): {
  readonly sync: boolean
  readonly sharing: boolean
} {
  const allowed = profile.ageBand === "AGE_14_OR_OVER" || profile.guardianConfirmedAt !== null
  return { sync: allowed, sharing: allowed }
}

function parseDate(value: string): Date {
  if (!isoDateSchema.safeParse(value).success) throw new RangeError("Invalid ISO date.")
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Invalid calendar date.")
  }
  return date
}
