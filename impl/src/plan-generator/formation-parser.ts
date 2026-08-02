import { isRecord } from "./input-values"
import type {
  ExplicitMainExposure,
  LocalCivilHalfDaySlot,
  LocalCivilNinePointFiveFormation,
  MainExposureClassification,
  MainExposureComponent,
} from "./formation-types"

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)
}

function isLocalCivilDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function hasForbiddenFreeText(record: Record<string, unknown>): boolean {
  return ["reason", "note", "notes", "description", "memo", "symptom"].some((key) => key in record)
}

function parseClassification(value: unknown): MainExposureClassification | undefined {
  switch (value) {
    case "TRAINING_MAIN":
    case "COMPETITION":
    case "NONE":
      return value
    default:
      return undefined
  }
}

function parseComponent(value: unknown): MainExposureComponent | undefined {
  if (!isRecord(value) || hasForbiddenFreeText(value)) {
    return undefined
  }

  switch (value["kind"]) {
    case "STANDALONE":
    case "PARENT":
      return { kind: value["kind"] }
    case "LEAF": {
      const parentExposureId = value["parentExposureId"]
      if (!isSafeIdentifier(parentExposureId)) {
        return undefined
      }
      return { kind: "LEAF", parentExposureId }
    }
    default:
      return undefined
  }
}

function parseSlots(value: unknown): readonly LocalCivilHalfDaySlot[] | undefined {
  if (!Array.isArray(value) || value.length !== 19) {
    return undefined
  }

  const slots: LocalCivilHalfDaySlot[] = []
  for (let slotIndex = 0; slotIndex < 19; slotIndex += 1) {
    const rawSlot = value[slotIndex]
    if (!isRecord(rawSlot) || hasForbiddenFreeText(rawSlot)) {
      return undefined
    }

    const expectedSlot = slotIndex === 18 || slotIndex % 2 === 0 ? "AM" : "PM"
    const localDayKey = rawSlot["localDayKey"]
    if (
      rawSlot["slotIndex"] !== slotIndex ||
      rawSlot["slot"] !== expectedSlot ||
      !isLocalCivilDayKey(localDayKey)
    ) {
      return undefined
    }

    if (slotIndex > 0 && slotIndex % 2 === 1 && localDayKey !== slots[slotIndex - 1]?.localDayKey) {
      return undefined
    }
    if (slotIndex > 0 && slotIndex % 2 === 0 && localDayKey === slots[slotIndex - 1]?.localDayKey) {
      return undefined
    }

    slots.push({ slotIndex, localDayKey, slot: expectedSlot })
  }

  return Object.freeze(slots)
}

function parseExposures(
  value: unknown,
  knownLocalDayKeys: ReadonlySet<string>,
): readonly ExplicitMainExposure[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const exposures: ExplicitMainExposure[] = []
  const seenExposureIds = new Set<string>()
  for (const rawExposure of value) {
    if (!isRecord(rawExposure) || hasForbiddenFreeText(rawExposure)) {
      return undefined
    }

    const exposureId = rawExposure["exposureId"]
    const classification = parseClassification(rawExposure["classification"])
    const localDayKey = rawExposure["localDayKey"]
    const component = parseComponent(rawExposure["component"])
    if (
      !isSafeIdentifier(exposureId) ||
      classification === undefined ||
      !isLocalCivilDayKey(localDayKey) ||
      !knownLocalDayKeys.has(localDayKey) ||
      component === undefined ||
      seenExposureIds.has(exposureId)
    ) {
      return undefined
    }

    seenExposureIds.add(exposureId)
    exposures.push({ exposureId, classification, localDayKey, component })
  }

  const byId = new Map(exposures.map((exposure) => [exposure.exposureId, exposure] as const))
  for (const exposure of exposures) {
    if (exposure.component.kind !== "LEAF") {
      continue
    }

    const parent = byId.get(exposure.component.parentExposureId)
    if (parent?.component.kind !== "PARENT") {
      return undefined
    }
  }

  return Object.freeze(exposures)
}

export function parseFormation(value: unknown): LocalCivilNinePointFiveFormation | undefined {
  if (!isRecord(value) || value["kind"] !== "LOCAL_CIVIL_9_5" || hasForbiddenFreeText(value)) {
    return undefined
  }

  const slots = parseSlots(value["slots"])
  if (slots === undefined) {
    return undefined
  }

  const knownLocalDayKeys = new Set(slots.map((slot) => slot.localDayKey))
  const exposures = parseExposures(value["exposures"], knownLocalDayKeys)
  if (exposures === undefined) {
    return undefined
  }

  return Object.freeze({ kind: "LOCAL_CIVIL_9_5", slots, exposures })
}
