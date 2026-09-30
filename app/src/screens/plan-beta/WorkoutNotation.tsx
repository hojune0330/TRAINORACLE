import { TermHelp } from "../../components/TermHelp"
import { sequenceNotation, sequenceWorkoutName } from "../../domain/workout-notation"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { AdjustedSegmentTarget } from "../../domain/adjusted-method-resolution"

export function WorkoutNotation({ sequence, intent, targets, showName = true }: {
  readonly sequence: PrescriptionSequence | PrescriptionSequenceV3
  readonly intent?: PlannedEnergyIntent
  readonly targets?: readonly AdjustedSegmentTarget[]
  readonly showName?: boolean
}) {
  return <div className="workout-notation" onKeyDown={event => {
    if (event.key !== "Escape") return
    const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
    if (!trigger) return
    // Close the inner help first, without cancelling the native adjustment dialog.
    event.preventDefault(); event.stopPropagation(); trigger.click(); trigger.focus({ preventScroll: true })
  }}>
    {showName && <strong>{sequenceWorkoutName(sequence, intent)}</strong>}
    <p className="plan-detailed-prescription__notation"><code>{sequenceNotation(sequence, targets)}</code><TermHelp term="training-notation" /></p>
  </div>
}
