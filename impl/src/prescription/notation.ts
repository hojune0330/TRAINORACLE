import type {
  PrescriptionNotationResult,
  UnboundPrescriptionNotation,
} from "./types"

const notationPattern = /^(?:(?<setCount>[1-9]\d*)\s*×\s*\(\s*)?(?<repetitions>[1-9]\d*)\s*×\s*(?<work>[1-9]\d*)\s*(?<unit>m|s)(?:\s*\))?\s*@\s*(?<target>[1-9]\d*)\s*m\s*RP(?:\s*·\s*r(?<repetitionRecovery>[1-9]\d*)\s*(?:″|"))?(?:\s*·\s*R(?<setRecovery>[1-9]\d*)\s*(?:′|'))?$/u

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function reject(): PrescriptionNotationResult {
  return { kind: "rejected", code: "MALFORMED_NOTATION" }
}

function normalizedInput(input: string): string {
  return input.trim().replace(/\s+/gu, " ")
}

function isValidParentheses(input: string, setCount: number): boolean {
  const hasOpening = input.includes("(")
  const hasClosing = input.includes(")")
  return setCount > 1 ? hasOpening && hasClosing : !hasOpening && !hasClosing
}

function isValidRecoveryStructure(input: {
  readonly repetitionsPerSet: number
  readonly setCount: number
  readonly repetitionRecoverySeconds: number | undefined
  readonly setRecoverySeconds: number | undefined
}): boolean {
  const repetitionRecoveryRequired = input.repetitionsPerSet > 1
  const setRecoveryRequired = input.setCount > 1
  return repetitionRecoveryRequired === (input.repetitionRecoverySeconds !== undefined)
    && setRecoveryRequired === (input.setRecoverySeconds !== undefined)
}

export function parsePrescriptionNotation(input: string): PrescriptionNotationResult {
  const normalized = normalizedInput(input)
  const match = notationPattern.exec(normalized)
  if (match?.groups === undefined) {
    return reject()
  }

  const repetitionsPerSet = positiveNumber(match.groups["repetitions"])
  const work = positiveNumber(match.groups["work"])
  const paceTargetEventDistanceM = positiveNumber(match.groups["target"])
  const setCount = positiveNumber(match.groups["setCount"]) ?? 1
  const repetitionRecoverySeconds = positiveNumber(match.groups["repetitionRecovery"])
  const setRecoveryMinutes = positiveNumber(match.groups["setRecovery"])
  const setRecoverySeconds = setRecoveryMinutes === undefined
    ? undefined
    : setRecoveryMinutes * 60
  const unit = match.groups["unit"]
  if (
    repetitionsPerSet === undefined
    || work === undefined
    || paceTargetEventDistanceM === undefined
    || (unit !== "m" && unit !== "s")
    || !isValidParentheses(normalized, setCount)
    || !isValidRecoveryStructure({
      repetitionsPerSet,
      setCount,
      repetitionRecoverySeconds,
      setRecoverySeconds,
    })
  ) {
    return reject()
  }

  return {
    kind: "parsed",
    notation: Object.freeze({
      kind: "UNBOUND_PRESCRIPTION_NOTATION",
      setCount,
      repetitionsPerSet,
      repetitionDistanceM: unit === "m" ? work : null,
      repetitionDurationSeconds: unit === "s" ? work : null,
      paceTargetKind: "RACE_PACE",
      paceTargetEventDistanceM,
      repetitionRecoverySeconds: repetitionRecoverySeconds ?? null,
      repetitionRecoveryMode: repetitionRecoverySeconds === undefined ? "NOT_APPLICABLE" : "STAND",
      setRecoverySeconds: setRecoverySeconds ?? null,
      setRecoveryMode: setRecoverySeconds === undefined ? "NOT_APPLICABLE" : "STAND",
    }),
  }
}

export function formatPrescriptionNotation(notation: UnboundPrescriptionNotation): string {
  const work = notation.repetitionDistanceM === null
    ? `${notation.repetitionsPerSet}×${notation.repetitionDurationSeconds}s`
    : `${notation.repetitionsPerSet}×${notation.repetitionDistanceM}m`
  const setWork = notation.setCount === 1 ? work : `${notation.setCount}×(${work})`
  const recovery = notation.repetitionRecoverySeconds === null
    ? []
    : [`r${notation.repetitionRecoverySeconds}″`]
  const setRecovery = notation.setRecoverySeconds === null
    ? []
    : [`R${notation.setRecoverySeconds / 60}′`]
  return `${setWork} @${notation.paceTargetEventDistanceM}m RP${[...recovery, ...setRecovery].map((value) => ` · ${value}`).join("")}`
}
