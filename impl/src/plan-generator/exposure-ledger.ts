import type {
  ExplicitMainExposure,
  LocalCivilNinePointFiveFormation,
  PlanReviewReasonCode,
} from "./types"

export type MainExposureLedgerEntry = {
  readonly exposureId: string
  readonly classification: ExplicitMainExposure["classification"]
  readonly localDayKey: string
  readonly component: ExplicitMainExposure["component"]
}

export type CompiledExposureLedger =
  | {
      readonly kind: "valid"
      readonly entries: readonly MainExposureLedgerEntry[]
      readonly countedExposureIds: readonly string[]
      readonly mainExposureCount: number
      readonly competitionDayKeys: readonly string[]
    }
  | {
      readonly kind: "needs_review"
      readonly reasonCodes: readonly PlanReviewReasonCode[]
    }

function invalidComposite(): CompiledExposureLedger {
  return {
    kind: "needs_review",
    reasonCodes: Object.freeze(["INVALID_COMPOSITE_RELATION_REQUIRES_REVIEW"]),
  }
}

function collision(): CompiledExposureLedger {
  return {
    kind: "needs_review",
    reasonCodes: Object.freeze([
      "COMPETITION_DAY_COLLISION_REQUIRES_COACH_CLARIFICATION",
      "NEEDS_COACH_CLARIFICATION",
    ]),
  }
}

function hasCanonicalSlotTopology(formation: LocalCivilNinePointFiveFormation): boolean {
  if (formation.kind !== "LOCAL_CIVIL_9_5" || formation.slots.length !== 19) {
    return false
  }

  for (let slotIndex = 0; slotIndex < formation.slots.length; slotIndex += 1) {
    const slot = formation.slots[slotIndex]
    if (slot === undefined || slot.slotIndex !== slotIndex) {
      return false
    }

    const expectedSlot = slotIndex === 18 || slotIndex % 2 === 0 ? "AM" : "PM"
    if (slot.slot !== expectedSlot) {
      return false
    }
  }

  return true
}

function validateCompositeRelations(
  exposures: readonly ExplicitMainExposure[],
): boolean {
  const seenIds = new Set<string>()
  const byId = new Map<string, ExplicitMainExposure>()
  for (const exposure of exposures) {
    if (seenIds.has(exposure.exposureId)) {
      return false
    }
    seenIds.add(exposure.exposureId)
    byId.set(exposure.exposureId, exposure)
  }

  for (const exposure of exposures) {
    if (exposure.component.kind !== "LEAF") {
      continue
    }

    const parent = byId.get(exposure.component.parentExposureId)
    if (
      parent === undefined ||
      parent.component.kind !== "PARENT" ||
      parent.localDayKey !== exposure.localDayKey
    ) {
      return false
    }
  }

  return true
}

export function compileExposureLedger(
  formation: LocalCivilNinePointFiveFormation,
): CompiledExposureLedger {
  if (!hasCanonicalSlotTopology(formation) || !validateCompositeRelations(formation.exposures)) {
    return invalidComposite()
  }

  const entries = formation.exposures.map((exposure) => Object.freeze({
    exposureId: exposure.exposureId,
    classification: exposure.classification,
    localDayKey: exposure.localDayKey,
    component: exposure.component,
  }))
  const competitionDayKeys = new Set<string>()
  const trainingMainDayKeys = new Set<string>()
  const countedExposureIds: string[] = []

  for (const exposure of formation.exposures) {
    if (exposure.component.kind === "LEAF") {
      continue
    }

    switch (exposure.classification) {
      case "TRAINING_MAIN":
        trainingMainDayKeys.add(exposure.localDayKey)
        countedExposureIds.push(exposure.exposureId)
        break
      case "COMPETITION":
        if (!competitionDayKeys.has(exposure.localDayKey)) {
          competitionDayKeys.add(exposure.localDayKey)
          countedExposureIds.push(exposure.exposureId)
        }
        break
      case "NONE":
        break
    }
  }

  for (const localDayKey of competitionDayKeys) {
    if (trainingMainDayKeys.has(localDayKey)) {
      return collision()
    }
  }

  return Object.freeze({
    kind: "valid",
    entries: Object.freeze(entries),
    countedExposureIds: Object.freeze(countedExposureIds),
    mainExposureCount: countedExposureIds.length,
    competitionDayKeys: Object.freeze([...competitionDayKeys].sort()),
  })
}
