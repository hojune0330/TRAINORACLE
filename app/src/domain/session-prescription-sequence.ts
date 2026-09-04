import type { PlanSession } from "@impl/plan-generator/types"
import { matchesPacePrescriptionSequence, projectPacePrescriptionSequence } from "@impl/prescription/pace-sequence"
import { parsePrescriptionSequence, type PrescriptionSequence } from "@impl/prescription/sequence"

/** The stored structure and the numeric prescription cannot become separate authorities. */
export function sessionPrescriptionSequence(session: PlanSession): PrescriptionSequence | null {
  const p = session.prescription
  if (p.kind !== "PACE_TARGET") return null
  const expected = projectPacePrescriptionSequence(p)
  if (expected === null) return null
  if (p.sequence !== undefined) {
    const parsed = parsePrescriptionSequence(p.sequence)
    if (parsed.kind !== "parsed" || parsed.sequence.version !== 2) return null
    return matchesPacePrescriptionSequence(p, parsed.sequence) ? parsed.sequence : null
  }

  // Legacy read projection only: do not write a new structure into an old plan.
  const { terminalRecovery: _terminal, ...legacy } = expected
  const parsed = parsePrescriptionSequence({
    ...legacy, version: 1, id: `session-${session.day}-${session.slot}`,
  })
  return parsed.kind === "parsed" ? parsed.sequence : null
}
