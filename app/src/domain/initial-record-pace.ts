import type { PlanGenerationSuccess } from "@impl/plan-generator/types"
import { canonicalPaceDistance, catalogRecordPaceModel } from "@impl/prescription/record-pace"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import type { AthleteRecord } from "./athlete-records"
import { derivePaceRecordOptions } from "./pace-record-options"
import { createSegmentRecordReference, recordPaceSegments } from "./catalog-pace-reference"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"

/** A new draft offer only. Existing explicit choices and unreviewed mappings are never overwritten. */
export function prepareInitialRecordPaces(generated: PlanGenerationSuccess, records: readonly AthleteRecord[], today: string,
  selectedRecordId?: string) {
  const available = records.filter(record => record.verificationState !== "UNVERIFIED")
  const choose = (event: number) => {
    const choices = derivePaceRecordOptions(available, event, today)
    const id = selectedRecordId ?? choices.recommendedRecordId
    const record = choices.options.find(option => option.sourceSnapshot.id === id)?.sourceSnapshot
    return record && records.filter(row => row.id === record.id).length === 1
      ? available.find(row => row.id === record.id) ?? null : null
  }
  const fiveK = choose(5000)
  const event = canonicalPaceDistance(generated.candidates[0].eventDistanceM)
  const raceRecord = [10000, 21097.5, 42195].includes(event) ? choose(event) : null
  if (!fiveK && !raceRecord) return null
  let next = generated
  const changed: { day: number; slot: "AM" | "PM" }[] = []
  const durationChanges: { day: number; slot: "AM" | "PM"; before: { minimum: number; maximum: number }; after: { minimum: number; maximum: number } }[] = []
  const used = new Map<string, AthleteRecord>()
  let longerDuration = false
  for (const session of generated.candidates[0].sessions) {
    const binding = session.prescription.kind === "RPE_TIME_RANGE" ? session.prescription.catalogWorkout : undefined
    if (session.role !== "QUALITY" || !binding || binding.inputs.fiveK
      || binding.inputs.paceReferences?.length || binding.inputs.segmentPaces.length || binding.inputs.segmentSeconds?.length) continue
    const record = raceRecord && session.plannedEnergyIntent === "MIXED_INTENT" ? raceRecord : fiveK
    if (!record) continue
    const ids = record === raceRecord ? ALL_WORKOUT_CATALOG.filter(entry => entry.id.startsWith("RP-")
      && entry.eventDistances.some(distance => canonicalPaceDistance(distance) === event)
      && entry.experience.includes(binding.inputs.experience)).map(entry => entry.id) : [binding.catalogId]
    const alternatives = ids.flatMap(id => {
      const references = recordPaceSegments(id, binding.inputs).flatMap(segment => {
        const model = catalogRecordPaceModel(segment.intent, record.eventDistanceM, segment.referenceEventDistanceM)
        return model ? [createSegmentRecordReference(segment.segmentId, record, today, model)] : []
      })
      if (!references.length) return []
      const inputs = { ...binding.inputs, paceReferences: references }
      const within = replaceCandidateCatalogWorkout(next, session, id, inputs, false)
      // Only a visible, unaccepted first draft can offer a longer inherited structure.
      const result = within ?? (record === raceRecord ? replaceCandidateCatalogWorkout(next, session, id, inputs, true) : null)
      const changedSession = result?.candidates[0].sessions.find(row => row.day === session.day && row.slot === session.slot)
      return result ? [{ result, longer: !within,
        distanceFormat: id.endsWith("DISTANCE"),
        maximum: changedSession?.prescription.kind === "RPE_TIME_RANGE" ? changedSession.prescription.durationMinutes.maximum : Infinity }] : []
    }).sort((a, b) => Number(a.longer) - Number(b.longer) || Number(b.distanceFormat) - Number(a.distanceFormat) || a.maximum - b.maximum)
    const replacement = alternatives[0]
    if (!replacement) continue
    next = replacement.result
    longerDuration ||= replacement.longer
    const updated = next.candidates[0].sessions.find(row => row.day === session.day && row.slot === session.slot)
    if (session.prescription.kind === "RPE_TIME_RANGE" && updated?.prescription.kind === "RPE_TIME_RANGE") {
      const before = session.prescription.durationMinutes
      const after = updated.prescription.durationMinutes
      if (before.minimum !== after.minimum || before.maximum !== after.maximum) {
        durationChanges.push({ day: session.day, slot: session.slot, before: { ...before }, after: { ...after } })
      }
    }
    used.set(record.id, record)
    changed.push({ day: session.day, slot: session.slot })
  }
  const selected = [...used.values()]
  return changed.length ? { record: selected[0]!, records: selected, generated: next, changed, longerDuration, durationChanges } : null
}
