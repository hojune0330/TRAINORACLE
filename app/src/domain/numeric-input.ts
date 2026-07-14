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
