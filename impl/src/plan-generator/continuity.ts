import { isRecord } from "./input-values"
import { assertNever } from "../shared/assert-never"
import type {
  PlanCandidateKind,
  PlanContinuityInput,
  PlanProgressState,
  PlanProgressStateCount,
} from "./types"

export type ParsedContinuityInput =
  | {
      readonly kind: "absent"
    }
  | {
      readonly kind: "parsed"
      readonly continuity: PlanContinuityInput
    }
  | {
      readonly kind: "invalid"
    }

function parseCandidateKind(value: unknown): PlanCandidateKind | undefined {
  switch (value) {
    case "BALANCED":
    case "CONSERVATIVE":
      return value
    default:
      return undefined
  }
}

function parseProgressState(value: unknown): PlanProgressState | undefined {
  switch (value) {
    case "COMPLETED":
    case "RESTED":
    case "SKIPPED":
    case "PAIN_CHECKIN":
      return value
    default:
      return undefined
  }
}

function progressStateRank(state: PlanProgressState): number {
  switch (state) {
    case "COMPLETED":
      return 0
    case "RESTED":
      return 1
    case "SKIPPED":
      return 2
    case "PAIN_CHECKIN":
      return 3
    default:
      return assertNever(state)
  }
}

function parseProgressCounts(value: unknown): readonly PlanProgressStateCount[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }

  const counts: PlanProgressStateCount[] = []
  let priorRank = -1
  for (const item of value) {
    if (!isRecord(item)) {
      return undefined
    }

    const state = parseProgressState(item["state"])
    const count = item["count"]
    if (
      state === undefined ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      return undefined
    }

    const rank = progressStateRank(state)
    if (rank <= priorRank) {
      return undefined
    }
    counts.push(Object.freeze({ state, count }))
    priorRank = rank
  }
  return Object.freeze(counts)
}

export function parseContinuityInput(value: unknown): ParsedContinuityInput {
  if (value === undefined) {
    return { kind: "absent" }
  }
  if (!isRecord(value)) {
    return { kind: "invalid" }
  }

  const previousCandidateKind = parseCandidateKind(value["previousCandidateKind"])
  const progressStateCounts = parseProgressCounts(value["progressStateCounts"])
  if (previousCandidateKind === undefined || progressStateCounts === undefined) {
    return { kind: "invalid" }
  }

  return {
    kind: "parsed",
    continuity: Object.freeze({
      previousCandidateKind,
      progressStateCounts,
    }),
  }
}
