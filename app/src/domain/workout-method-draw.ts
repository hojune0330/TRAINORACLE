export type WorkoutMethodDraw = {
  readonly index: number
  readonly seen: readonly number[]
}

/** Draw only from caller-validated, distinct methods; never generate a dose here. */
export function drawWorkoutMethod(
  count: number,
  current: number,
  seen: readonly number[],
  random: () => number = Math.random,
): WorkoutMethodDraw | null {
  if (!Number.isInteger(count) || count < 1) return null
  const alternatives = Array.from({ length: count }, (_, index) => index).filter(index => index !== current)
  if (!alternatives.length) return null
  const previous = new Set(seen.filter(index => Number.isInteger(index) && index >= 0 && index < count))
  const unseen = alternatives.filter(index => !previous.has(index))
  const pool = unseen.length ? unseen : alternatives
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) return null
  const index = pool[Math.floor(sample * pool.length)]!
  const cycle = unseen.length ? [...previous] : current >= 0 && current < count ? [current] : []
  return { index, seen: [...new Set([...cycle, index])] }
}
