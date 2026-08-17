import type {
  PrescriptionNotationResult,
  UnboundPrescriptionNotation,
} from "./types"

const notationPattern = /^(?:(?<setCount>[1-9]\d*)\s*×\s*\(\s*)?(?<repetitions>[1-9]\d*)\s*×\s*(?<work>[1-9]\d*)\s*(?<unit>m|s)(?:\s*\))?\s*@\s*(?<target>[1-9]\d*)\s*m\s*RP(?:\s*·\s*r(?<repetitionRecovery>[1-9]\d*)\s*(?:″|")\s+(?<repetitionRecoveryMode>WALK|JOG|STAND))?(?:\s*·\s*R(?<setRecovery>[1-9]\d*)\s*(?:′|')\s+(?<setRecoveryMode>WALK|JOG|STAND))?$/u

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function recoveryMode(value: string | undefined): "WALK" | "JOG" | "STAND" | undefined {
  return value === "WALK" || value === "JOG" || value === "STAND" ? value : undefined
}

function reject(): PrescriptionNotationResult {
  return { kind: "rejected", code: "MALFORMED_NOTATION" }
}

// 곱셈 기호 별칭. `×`(U+00D7)는 일반 키보드로 바로 칠 수 없어서 사람들은 `x`, `X`, `*`를 쓴다.
// 이 별칭을 받지 않으면 표기를 정확히 옮겨 적은 사용자에게 "읽지 못해요"가 떠서,
// 자기 입력이 틀린 줄 알게 된다. 숫자를 바꾸는 관용이 아니라 글자 별칭이므로
// 잘못된 값이 사실로 표시될 위험은 없다.
const MULTIPLICATION_ALIASES = /[xX*]/gu

// 아포스트로피/프라임 별칭도 같은 이유다. 기존 패턴은 `″`/`"`와 `′`/`'`만 받았는데,
// iOS·macOS 자동 교정은 `"`를 `“`/`”`로, `'`를 `‘`/`’`로 바꿔 버린다.
const DOUBLE_PRIME_ALIASES = /[“”]/gu
const SINGLE_PRIME_ALIASES = /[‘’]/gu

function normalizedInput(input: string): string {
  return input
    .trim()
    .replace(/\s+/gu, " ")
    .replace(MULTIPLICATION_ALIASES, "×")
    .replace(DOUBLE_PRIME_ALIASES, "\"")
    .replace(SINGLE_PRIME_ALIASES, "'")
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
  readonly repetitionRecoveryMode: "WALK" | "JOG" | "STAND" | undefined
  readonly setRecoverySeconds: number | undefined
  readonly setRecoveryMode: "WALK" | "JOG" | "STAND" | undefined
}): boolean {
  const repetitionRecoveryRequired = input.repetitionsPerSet > 1
  const setRecoveryRequired = input.setCount > 1
  return repetitionRecoveryRequired === (input.repetitionRecoverySeconds !== undefined)
    && repetitionRecoveryRequired === (input.repetitionRecoveryMode !== undefined)
    && setRecoveryRequired === (input.setRecoverySeconds !== undefined)
    && setRecoveryRequired === (input.setRecoveryMode !== undefined)
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
  const repetitionRecoveryMode = recoveryMode(match.groups["repetitionRecoveryMode"])
  const setRecoveryMinutes = positiveNumber(match.groups["setRecovery"])
  const setRecoverySeconds = setRecoveryMinutes === undefined
    ? undefined
    : setRecoveryMinutes * 60
  const setRecoveryMode = recoveryMode(match.groups["setRecoveryMode"])
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
      repetitionRecoveryMode,
      setRecoverySeconds,
      setRecoveryMode,
    })
  ) {
    return reject()
  }
  const parsedRepetitionRecoveryMode = repetitionRecoverySeconds === undefined
    ? "NOT_APPLICABLE"
    : repetitionRecoveryMode
  const parsedSetRecoveryMode = setRecoverySeconds === undefined
    ? "NOT_APPLICABLE"
    : setRecoveryMode
  if (parsedRepetitionRecoveryMode === undefined || parsedSetRecoveryMode === undefined) {
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
      repetitionRecoveryMode: parsedRepetitionRecoveryMode,
      setRecoverySeconds: setRecoverySeconds ?? null,
      setRecoveryMode: parsedSetRecoveryMode,
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
    : [`r${notation.repetitionRecoverySeconds}″ ${notation.repetitionRecoveryMode}`]
  const setRecovery = notation.setRecoverySeconds === null
    ? []
    : [`R${notation.setRecoverySeconds / 60}′ ${notation.setRecoveryMode}`]
  return `${setWork} @${notation.paceTargetEventDistanceM}m RP${[...recovery, ...setRecovery].map((value) => ` · ${value}`).join("")}`
}
