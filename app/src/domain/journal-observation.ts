import {
  EXTERNAL_DERIVATION_INPUTS,
  FIELD_PROVENANCE,
  hasImportedField,
} from "./field-provenance"
import type { FieldProvenanceMap } from "./field-provenance"
import type { JournalEntry } from "./journal-schema"
import { parseDistanceKm, parseDurationMin, parsePaceText } from "./numeric-input"

export const PACE_DERIVATION_RULE_ID = "JOURNAL_DISTANCE_DURATION_TO_SECONDS_PER_KM_V1"
export const PAIN_MAX_DERIVATION_RULE_ID = "JOURNAL_EXPLICIT_PAIN_PARTS_TO_MAX_V1"

export type ObservationTrustState = "ACCEPTED" | "STALE" | "CONFLICTING" | "MISSING" | "SOURCE_NOT_VERIFIED"

export type ObservationProvenance = "EXPLICIT" | "DERIVED" | "MISSING" | "LEGACY_MISSING_PROVENANCE"

export type StructuredJournalInput =
  | {
      readonly sourceKind: "SESSION_RESULT_RECORD"
      readonly sourceId: string
      readonly loggedOn: string
      readonly observedAt: string
      readonly distanceKm: string
      readonly durationMin: string
      readonly avgPace: string
      readonly rpe: number
      readonly fieldProvenance?: FieldProvenanceMap
    }
  | {
      readonly sourceKind: "DAILY_CHECKIN_RECORD"
      readonly sourceId: string
      readonly loggedOn: string
      readonly observedAt: string
      readonly mood: number
      readonly painParts: Readonly<Record<string, number>>
      readonly fieldProvenance?: FieldProvenanceMap
    }

export type StructuredJournalObservation = {
  readonly sourceRef: {
    readonly sourceKind: StructuredJournalInput["sourceKind"]
    readonly sourceId: string
    readonly sourceVersion: string | null
    readonly observedAt: string | null
    readonly trustState: ObservationTrustState
    readonly containsPrivateRawText: false
  }
  readonly loggedOn: string
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly secondsPerKm: number | null
  readonly rpe: number | null
  readonly mood: number | null
  readonly painMax: number | null
  readonly painSourceLevels: readonly number[]
  readonly fieldProvenance: {
    readonly distanceKm: ObservationProvenance
    readonly durationMin: ObservationProvenance
    readonly secondsPerKm: ObservationProvenance
    readonly rpe: ObservationProvenance
    readonly mood: ObservationProvenance
    readonly painMax: ObservationProvenance
  }
  readonly derivationRefs: readonly (
    | {
        readonly field: "secondsPerKm"
        readonly derivedFrom: readonly ["distanceKm", "durationMin"]
        readonly derivationRuleId: string
      }
    | {
        readonly field: "painMax"
        readonly derivedFrom: readonly ["painParts"]
        readonly derivationRuleId: string
      }
  )[]
}

/**
 * 관측값으로 받아들일 수 있는 거리(km).
 *
 * 상한을 두는 이유: 이 함수의 결과가 추이 그래프와 주간 집계에 그대로
 * 들어간다. 상한이 없으면 오타 하나("999999999")가 그래프 축을 망가뜨려
 * 나머지 주가 전부 0처럼 보인다. 상한을 넘는 값은 **거부**한다 —
 * 잘라내면 사용자가 적지 않은 숫자를 앱이 만든 것이 된다.
 */
function positiveDistance(value: string): number | null {
  return parseDistanceKm(value)
}

/** 관측값으로 받아들일 수 있는 시간(분). 거리와 같은 이유로 상한을 둔다. */
function positiveDuration(value: string): number | null {
  return parseDurationMin(value)
}

function provenanceOf(fieldName: string, provenance: FieldProvenanceMap | undefined): ObservationProvenance {
  const field = provenance?.[fieldName]
  if (field === undefined) return "LEGACY_MISSING_PROVENANCE"
  return field.provenance
}

function sourceTrust(provenance: FieldProvenanceMap | undefined): ObservationTrustState {
  return hasImportedField(provenance) ? "SOURCE_NOT_VERIFIED" : "ACCEPTED"
}

function hasSessionSignal(entry: Extract<JournalEntry, { readonly kind: "post-session" }>): boolean {
  return positiveDistance(entry.distanceKm) !== null
    || positiveDuration(entry.durationMin) !== null
    || parsePaceText(entry.avgPace) !== null
    || entry.rpe > 0
}

function hasEveningSignal(entry: Extract<JournalEntry, { readonly kind: "evening" }>): boolean {
  return entry.mood > 0 || Object.values(entry.painParts).some((level) => level > 0)
}

export function selectStructuredJournalInput(entry: JournalEntry): StructuredJournalInput | null {
  if (entry.kind === "post-session") {
    if (!hasSessionSignal(entry)) return null
    return {
      sourceKind: "SESSION_RESULT_RECORD",
      sourceId: entry.id,
      loggedOn: entry.date,
      observedAt: entry.savedAt,
      distanceKm: entry.distanceKm,
      durationMin: entry.durationMin,
      avgPace: entry.avgPace,
      rpe: entry.rpe,
      ...(entry.fieldProvenance === undefined ? {} : { fieldProvenance: entry.fieldProvenance }),
    }
  }
  if (entry.kind === "evening") {
    if (!hasEveningSignal(entry)) return null
    return {
      sourceKind: "DAILY_CHECKIN_RECORD",
      sourceId: entry.id,
      loggedOn: entry.date,
      observedAt: entry.savedAt,
      mood: entry.mood,
      painParts: entry.painParts,
      ...(entry.fieldProvenance === undefined ? {} : { fieldProvenance: entry.fieldProvenance }),
    }
  }
  return null
}

/**
 * Home과 Analysis가 동일한 구조화 관측 목록을 사용하도록 하는 공용 투영 관문.
 * 메모·노트 원문은 StructuredJournalInput 타입에 들어갈 자리가 없으므로 이
 * 함수의 결과에는 비밀 메모 내용이나 존재 여부가 포함되지 않는다.
 */
export function projectStructuredJournalObservations(
  entries: readonly JournalEntry[],
): readonly StructuredJournalObservation[] {
  return entries.flatMap((entry) => {
    const input = selectStructuredJournalInput(entry)
    return input === null ? [] : [projectStructuredJournalObservation(input)]
  })
}

function validRpe(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= 10 ? value : null
}

function validMood(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null
}

function validPainLevels(parts: Readonly<Record<string, number>>): readonly number[] {
  return Object.values(parts)
    .filter((level) => Number.isInteger(level) && level >= 0 && level <= 5)
    .sort((left, right) => left - right)
}

function canDerivePace(input: Extract<StructuredJournalInput, { readonly sourceKind: "SESSION_RESULT_RECORD" }>): boolean {
  return input.fieldProvenance?.distanceKm?.provenance === FIELD_PROVENANCE.explicit
    && input.fieldProvenance.durationMin?.provenance === FIELD_PROVENANCE.explicit
}

function containsExternalInput(provenance: FieldProvenanceMap | undefined): boolean {
  return Object.values(provenance ?? {}).some((field) =>
    field.provenance === FIELD_PROVENANCE.derived
      && field.derivedFrom.some((input) =>
        EXTERNAL_DERIVATION_INPUTS.some((externalInput) => input === externalInput)))
}

export function projectStructuredJournalObservation(
  input: StructuredJournalInput,
): StructuredJournalObservation {
  const sourceRef: StructuredJournalObservation["sourceRef"] = {
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourceVersion: null,
    observedAt: input.observedAt,
    trustState: containsExternalInput(input.fieldProvenance)
      ? "SOURCE_NOT_VERIFIED"
      : sourceTrust(input.fieldProvenance),
    containsPrivateRawText: false,
  }

  if (input.sourceKind === "DAILY_CHECKIN_RECORD") {
    const painSourceLevels = validPainLevels(input.painParts)
    const painMax = painSourceLevels.length === 0 ? null : Math.max(...painSourceLevels)
    const hasDerivedPain = painMax !== null
      && input.fieldProvenance?.painParts?.provenance === FIELD_PROVENANCE.explicit
    return {
      sourceRef,
      loggedOn: input.loggedOn,
      distanceKm: null,
      durationMin: null,
      secondsPerKm: null,
      rpe: null,
      mood: validMood(input.mood),
      painMax,
      painSourceLevels,
      fieldProvenance: {
        distanceKm: "MISSING",
        durationMin: "MISSING",
        secondsPerKm: "MISSING",
        rpe: "MISSING",
        mood: provenanceOf("mood", input.fieldProvenance),
        painMax: hasDerivedPain
          ? "DERIVED"
          : painMax === null
            ? "MISSING"
            : provenanceOf("painParts", input.fieldProvenance),
      },
      derivationRefs: hasDerivedPain ? [{
        field: "painMax",
        derivedFrom: ["painParts"],
        derivationRuleId: PAIN_MAX_DERIVATION_RULE_ID,
      }] : [],
    }
  }

  const distanceKm = positiveDistance(input.distanceKm)
  const durationMin = positiveDuration(input.durationMin)
  const recordedPace = parsePaceText(input.avgPace)
  const derivedPace = recordedPace === null
    && distanceKm !== null
    && durationMin !== null
    && canDerivePace(input)
      ? Math.round((durationMin * 60) / distanceKm)
      : null
  const hasDerivedPace = derivedPace !== null

  return {
    sourceRef,
    loggedOn: input.loggedOn,
    distanceKm,
    durationMin,
    secondsPerKm: recordedPace ?? derivedPace,
    rpe: validRpe(input.rpe),
    mood: null,
    painMax: null,
    painSourceLevels: [],
    fieldProvenance: {
      distanceKm: provenanceOf("distanceKm", input.fieldProvenance),
      durationMin: provenanceOf("durationMin", input.fieldProvenance),
      secondsPerKm: hasDerivedPace
        ? "DERIVED"
        : provenanceOf("avgPace", input.fieldProvenance),
      rpe: provenanceOf("rpe", input.fieldProvenance),
      mood: "MISSING",
      painMax: "MISSING",
    },
    derivationRefs: hasDerivedPace ? [{
      field: "secondsPerKm",
      derivedFrom: ["distanceKm", "durationMin"],
      derivationRuleId: PACE_DERIVATION_RULE_ID,
    }] : [],
  }
}
