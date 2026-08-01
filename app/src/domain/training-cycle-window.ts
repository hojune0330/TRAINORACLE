import { isValidIsoDate, isoShift } from "./dates"

export type TrainingCycleWindow = {
  readonly start: string
  readonly end: string
  readonly lengthDays: 9 | 10
  readonly index: number
}

function frameLength(index: number): 9 | 10 {
  return Math.abs(index) % 2 === 0 ? 10 : 9
}

function startOffset(index: number): number {
  if (index >= 0) {
    let offset = 0
    for (let cursor = 0; cursor < index; cursor += 1) offset += frameLength(cursor)
    return offset
  }
  let offset = 0
  for (let cursor = -1; cursor >= index; cursor -= 1) offset -= frameLength(cursor)
  return offset
}

export function trainingCycleWindow(anchor: string, index: number): TrainingCycleWindow {
  if (!isValidIsoDate(anchor) || !Number.isInteger(index)) throw new RangeError("Invalid cycle window input.")
  const lengthDays = frameLength(index)
  const start = isoShift(anchor, startOffset(index))
  return { start, end: isoShift(start, lengthDays - 1), lengthDays, index }
}
