import { z } from "zod"

const decimalStringSchema = z.string()
  .trim()
  .regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u)
  .transform(Number)
  .pipe(z.number().finite())

export function parseDecimalString(value: string): number | null {
  const parsed = decimalStringSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function parsePaceText(value: string): number | null {
  const match = /^(\d+):(\d{1,2})$/u.exec(value.trim())
  if (match === null) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds >= 60) return null
  const secondsPerKm = minutes * 60 + seconds
  return Number.isSafeInteger(secondsPerKm) && secondsPerKm > 0 ? secondsPerKm : null
}
