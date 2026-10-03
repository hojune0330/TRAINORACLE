import { activePlanBetaStorageKey, loadVersionedPlanBetaState } from "../../src/domain/plan-beta-store"
import { loadAthleteRecords } from "../../src/domain/athlete-records"
import { loadEntriesForPlanSafety, todayISO } from "../../src/domain/journal-store"
import { derivePaceRecordOptions } from "../../src/domain/pace-record-options"
import { listPermittedActivePlanEditTargets } from "../../src/domain/active-plan-edit"
import { prepareCurrentActivePlanEdit, prepareCurrentPaceUpdate, applyActivePlanEdit } from "../../src/domain/active-plan-edit-store"
import { setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { resolveCatalogBinding, catalogFamilyForIntent, bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"

export function state() {
  const value = loadVersionedPlanBetaState()
  if (!value || value.version !== 3) throw Error("Expected an accepted V3 plan, not an empty or fallback fixture")
  return value
}

export type NumericRow = { day: number; slot: "AM" | "PM"; unit: string; distance: number;
  minimum: number; maximum: number; model: string;
  source: { id: string; seconds: number; event: number; kind: string; purpose: string } }

export function numeric(): NumericRow[] {
  return state().activePlan.sessions.flatMap<NumericRow>(session => {
    const p = session.prescription
    if (p.kind === "PACE_TARGET") return [{
      day: session.day, slot: session.slot, unit: "seconds", distance: p.repetitionDistanceM,
      minimum: p.targetRepSeconds, maximum: p.targetRepSeconds, model: "RACE_AVERAGE_V1",
      source: { id: p.selectedAnchor.anchorId, seconds: p.selectedAnchor.performanceSeconds,
        event: p.selectedAnchor.eventDistanceM, kind: p.selectedAnchor.kind, purpose: p.selectedAnchor.purpose },
    }]
    if (p.kind !== "RPE_TIME_RANGE" || !p.catalogWorkout) return []
    const binding = p.catalogWorkout, resolved = resolveCatalogBinding(binding)
    if (!resolved) throw Error("Stored catalog prescription could not be resolved")
    return resolved.steps.filter(step => step.kind === "WORK" && step.referenceRecordId).map(step => {
      const reference = binding.inputs.paceReferences?.find(row => row.segmentId === step.segmentId)
      if (!reference || !step.paceSecondsPerKm) throw Error("Numeric MAIN is missing its immutable record reference")
      const range = step.distanceM !== null && step.seconds ? step.seconds : step.paceSecondsPerKm
      return { day: session.day, slot: session.slot, unit: step.distanceM !== null ? "seconds" : "pace",
        distance: step.distanceM ?? 1000, minimum: range.minimum, maximum: range.maximum, model: reference.model,
        source: { id: reference.recordId, seconds: reference.performanceSeconds, event: reference.eventDistanceM,
          kind: reference.kind, purpose: reference.kind === "GOAL" ? "ASPIRATIONAL_TARGET" : "CURRENT_CAPABILITY" } }
    })
  })
}

export function records(event: number) {
  const all = loadAthleteRecords()
  return { all, choices: derivePaceRecordOptions(all, event, todayISO()) }
}

// Read the accepted snapshot only; compute the duration delta without rebinding or relaxing its budget.
export function longEventBudget(event: number, seconds: number) {
  return state().activePlan.sessions.flatMap(session => {
    const p = session.prescription
    if (p.kind !== "RPE_TIME_RANGE" || !p.catalogWorkout) return []
    const binding = p.catalogWorkout
    const references = binding.inputs.paceReferences?.filter(row => row.eventDistanceM === event) ?? []
    if (!references.length) return []
    const resolved = resolveCatalogBinding(binding)
    if (!resolved?.totals.seconds) throw Error("Missing accepted catalog duration")
    let deltaSeconds = 0, occurrences = 0
    for (const step of resolved.steps) {
      const reference = references.find(row => row.segmentId === step.segmentId)
      if (step.kind !== "WORK" || !reference) continue
      if (reference.model !== "RACE_AVERAGE_V1" || step.distanceM === null || step.seconds === null) {
        throw Error("Overbudget journey requires distance-terminated same-event RP, not a timed fallback")
      }
      deltaSeconds += (seconds - reference.performanceSeconds) * step.distanceM / event
      occurrences++
    }
    if (!occurrences) throw Error("Budget probe has no expanded distance MAIN occurrences")
    return [{ day: session.day, slot: session.slot, catalogId: binding.catalogId, occurrences,
      acceptedMaximumSeconds: binding.acceptedDurationSeconds ?? binding.originalEnvelope.durationMinutes.maximum * 60,
      beforeMaximumSeconds: resolved.totals.seconds.maximum,
      proposedMaximumSeconds: resolved.totals.seconds.maximum + deltaSeconds }]
  })
}

// Discover an actually permitted edit; do not invent a plan or relax any product gate.
export async function editChoice() {
  const current = state(), entries = loadEntriesForPlanSafety()
  if (entries.status !== "complete") throw Error("Journal safety read is incomplete")
  const targets = listPermittedActivePlanEditTargets({ state: current, entries: entries.entries,
    today: todayISO(), noFixedFutureCommitments: true })
  for (const target of targets.filter(row => row.role !== "QUALITY")) {
    const session = current.activePlan.sessions.find(row => row.day === target.address.day && row.slot === target.address.slot)!
    const p = session.prescription
    if (p.kind !== "RPE_TIME_RANGE") continue
    if (target.actions.includes("DURATION")) {
      return { source: target.address, action: "DURATION" as const,
        maximumMinutes: p.durationMinutes.maximum - 1, catalogId: null }
    }
    if (!p.catalogWorkout || !target.actions.includes("CATALOG")) continue
    const inputs = p.catalogWorkout.inputs
    for (const alternative of ALL_WORKOUT_CATALOG.filter(row => row.id !== p.catalogWorkout!.catalogId
      && row.family === catalogFamilyForIntent(session.plannedEnergyIntent) && !row.hold && !row.requirements.length)) {
      const replacement = bindCatalogSession(session, alternative.id, inputs)
      if (!replacement || replacement.prescription.kind !== "RPE_TIME_RANGE"
        || replacement.prescription.rpe.maximum > p.rpe.maximum
        || replacement.prescription.durationMinutes.maximum >= p.durationMinutes.maximum) continue
      const preview = await prepareCurrentActivePlanEdit({ source: target.address, action: "CATALOG",
        catalogId: alternative.id, inputs, unstartedConfirmed: true, noFixedFutureCommitments: false })
      if (preview.kind === "ready") return { source: target.address, action: "CATALOG" as const,
        maximumMinutes: null, catalogId: alternative.id }
    }
  }
  throw Error("No permitted non-MAIN duration/catalog edit: lifecycle preservation stage cannot be claimed")
}

export async function scopeSwitch(recordId: string) {
  const record = loadAthleteRecords().find(row => row.id === recordId)
  if (!record) throw Error("Missing preview source")
  const before = localStorage.getItem("trainoracle.plan-beta.v1")
  const preview = await prepareCurrentPaceUpdate(record)
  if (preview.kind !== "ready") throw Error(`Scope probe needs a ready preview: ${preview.message}`)
  const owner = "22222222-2222-4222-8222-222222222222"
  setActiveLocalAccount(owner)
  try {
    const result = await applyActivePlanEdit(preview.proposal, true)
    return { result: result.kind, unchanged: localStorage.getItem("trainoracle.plan-beta.v1") === before,
      otherPlan: localStorage.getItem(activePlanBetaStorageKey()) }
  } finally { setActiveLocalAccount(null) }
}

export function dropNextPlanWrite() {
  const original = Storage.prototype.setItem
  let intercepted = false
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key === "trainoracle.plan-beta.v1" && !intercepted) {
      intercepted = true
      Storage.prototype.setItem = original
      throw new DOMException("Synthetic one-shot plan quota failure", "QuotaExceededError")
    }
    original.call(this, key, value)
  }
}
