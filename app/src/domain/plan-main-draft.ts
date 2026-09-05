import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { PlanBetaIntake } from "./plan-beta-store"
import { isValidIsoDate } from "./dates"
import { z } from "zod"
import { listDetailedSessionTargets } from "./plan-session-target"

export type MainDraftSlot = {
  readonly mainSlotId: string
  readonly day: number
  readonly slot: "AM" | "PM"
}

export type PlanMainDraftSnapshot = {
  readonly version: 1
  readonly scopeFingerprint: string
  readonly contentFingerprint: string
  readonly slots: readonly MainDraftSlot[]
}

/** A session address survives method/pace edits, but never a different calendar or frame. */
export function snapshotPlanMainDraft(
  generated: PlanGenerationSuccess,
  intake: PlanBetaIntake,
  startDate: string,
): PlanMainDraftSnapshot | null {
  if (!isValidIsoDate(startDate)) return null
  try {
    if (!z.json().safeParse(generated.candidates).success) return null
    const scopeFingerprint = canonicalJsonFingerprint("main-draft-scope-v1", {
      startDate,
      eventGroup: intake.eventGroup,
      eventDistanceM: intake.eventDistanceM,
      experienceBand: intake.experienceBand,
      trainingFocus: intake.trainingFocus,
      candidates: generated.candidates.map(candidate => ({
        frame: candidate.frame,
        continuityContext: candidate.continuityContext,
        layout: candidate.sessions.map(session => ({
          day: session.day, slot: session.slot,
          role: session.role, purpose: session.plannedEnergyIntent,
        })).sort((a, b) => a.day - b.day || a.slot.localeCompare(b.slot)),
      })),
    })
    const slots = listDetailedSessionTargets(generated).map(target => Object.freeze({
      ...target,
      mainSlotId: canonicalJsonFingerprint("main-slot-v1", { scopeFingerprint, ...target }),
    }))
    return Object.freeze({
      version: 1,
      scopeFingerprint,
      contentFingerprint: canonicalJsonFingerprint("main-draft-content-v1", {
        scopeFingerprint, candidates: generated.candidates,
      }),
      slots: Object.freeze(slots),
    })
  } catch {
    return null
  }
}

export function mainDraftStillMatches(
  snapshot: PlanMainDraftSnapshot,
  generated: PlanGenerationSuccess,
  intake: PlanBetaIntake,
  startDate: string,
): boolean {
  const current = snapshotPlanMainDraft(generated, intake, startDate)
  return current !== null && current.scopeFingerprint === snapshot.scopeFingerprint
    && current.contentFingerprint === snapshot.contentFingerprint
}
