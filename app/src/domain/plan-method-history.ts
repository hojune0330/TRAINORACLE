import type { DetailedTemplateRef } from "@impl/plan-generator/types"
import type { MethodHistoryEntry, MethodReference } from "@impl/prescription/method-recommendation"
import type { StoredPlanProgress } from "./plan-beta-schema"
import { resolvePlanMethodMapping } from "./plan-method-registry"
import type { StoredAdjustedPlanState } from "./adjusted-plan-storage-schema"

export type StoredPlanMethodHistory = {
  readonly sessionDay: number
  readonly sessionSlot: "AM" | "PM"
  readonly selectedDetailedTemplateRef: DetailedTemplateRef
  readonly outcome: "PERFORMED" | "NOT_PERFORMED" | "MISSING"
}

type MethodHistorySource = {
  readonly sessions: readonly {
    readonly day: number
    readonly slot: "AM" | "PM"
    readonly prescription:
      | {
          readonly kind: "PACE_TARGET"
          readonly templateId: string
          readonly templateVersion: string
          readonly templateContentFingerprint: string
        }
      | { readonly kind: "RPE_TIME_RANGE" | "REST" }
  }[]
  readonly progress: readonly StoredPlanProgress[]
}

export function methodReferenceFromTemplate(reference: DetailedTemplateRef): MethodReference | null {
  return resolvePlanMethodMapping(reference)?.method ?? null
}

export function deriveStoredPlanMethodHistory(source: MethodHistorySource): readonly StoredPlanMethodHistory[] {
  const progress = new Map(source.progress.map(item => [`${item.sessionDay}:${item.sessionSlot}`, item.state] as const))
  return Object.freeze(source.sessions.flatMap(session => {
    if (session.prescription.kind !== "PACE_TARGET") return []
    const state = progress.get(`${session.day}:${session.slot}`)
    const outcome = state === "COMPLETED"
      ? "PERFORMED" as const
      : state === undefined
        ? "MISSING" as const
        : "NOT_PERFORMED" as const
    return [Object.freeze({
      sessionDay: session.day,
      sessionSlot: session.slot,
      selectedDetailedTemplateRef: Object.freeze({
        templateId: session.prescription.templateId,
        version: session.prescription.templateVersion,
        fingerprint: session.prescription.templateContentFingerprint,
      }),
      outcome,
    })]
  }))
}

export function recommendationHistoryFromStored(rows: readonly StoredPlanMethodHistory[]): readonly MethodHistoryEntry[] {
  return Object.freeze(rows.flatMap(row => {
    const method = methodReferenceFromTemplate(row.selectedDetailedTemplateRef)
    // Unmapped planned references stay stored, but cannot establish family exposure.
    if (method === null) return []
    return [Object.freeze({
      selected: method,
      performed: row.outcome === "PERFORMED"
        ? Object.freeze({ status: "PERFORMED" as const, method })
        : Object.freeze({ status: row.outcome }),
    })]
  }))
}

/** Only call after the adjusted original has passed retained-evidence validation.
 * The configured method, not its pre-adjustment template, is the selected fact. */
export function recommendationHistoryFromAdjusted(state: StoredAdjustedPlanState): readonly MethodHistoryEntry[] {
  const progress = new Map(state.progress.map(item => [`${item.sessionDay}:${item.sessionSlot}`, item.state]))
  return Object.freeze(state.selection.activePlan.sessions.flatMap(session => {
    if (session.prescription.kind !== "ADJUSTED_METHOD") {
      return recommendationHistoryFromStored(deriveStoredPlanMethodHistory({ sessions: [{
        day: session.day, slot: session.slot, prescription: session.prescription,
      }], progress: state.progress }))
    }
    const { familyId, configurationId, version } = session.prescription.snapshot.projection.source.to
    const method = Object.freeze({ familyId, configurationId, version })
    const outcome = progress.get(`${session.day}:${session.slot}`)
    return [Object.freeze({ selected: method, performed: outcome === "COMPLETED"
      ? Object.freeze({ status: "PERFORMED" as const, method })
      : Object.freeze({ status: outcome === undefined ? "MISSING" as const : "NOT_PERFORMED" as const }) })]
  }))
}
