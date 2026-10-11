import { TermHelp } from "../../components/TermHelp"
import { sequenceWorkoutName, type WorkoutDisplaySession } from "../../domain/workout-notation"
import type { PrescriptionSequenceV3 } from "@impl/prescription/sequence-v3"
import type { PrescriptionSequence } from "@impl/prescription/sequence"
import type { PlannedEnergyIntent } from "@impl/plan-generator/types"
import type { AdjustedSegmentTarget } from "../../domain/adjusted-method-resolution"
import { presentSessionWorkoutNotation, presentWorkoutNotation } from "./workout-notation-presentation"
import "./workout-notation.css"

export function WorkoutNotation({ sequence, intent, targets, showName = true }: {
  readonly sequence: PrescriptionSequence | PrescriptionSequenceV3
  readonly intent?: PlannedEnergyIntent
  readonly targets?: readonly AdjustedSegmentTarget[]
  readonly showName?: boolean
}) {
  const presentation = presentWorkoutNotation(sequence, targets)
  return <div className="workout-notation" onKeyDown={event => {
    if (event.key !== "Escape") return
    const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
    if (trigger) {
      // Close the inner help first, without cancelling the native adjustment dialog.
      event.preventDefault(); event.stopPropagation(); trigger.click(); trigger.focus({ preventScroll: true })
      return
    }
    const detail = event.currentTarget.querySelector<HTMLDetailsElement>("details[open]")
    if (!detail) return
    event.preventDefault(); event.stopPropagation(); detail.open = false
    detail.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true })
  }}>
    {showName && <strong>{sequenceWorkoutName(sequence, intent)}</strong>}
    <p className="plan-detailed-prescription__notation"><code>{presentation.notation}</code><TermHelp term="training-notation" /></p>
    <EffortDetails explanations={presentation.explanations} />
  </div>
}

export function SessionWorkoutNotation({ session }: { readonly session: WorkoutDisplaySession }) {
  const presentation = presentSessionWorkoutNotation(session)
  return <><span>{presentation.notation}</span><EffortDetails explanations={presentation.explanations} /></>
}

function EffortDetails({ explanations }: { readonly explanations: readonly string[] }) {
  return explanations.length > 0 ? <details className="workout-notation__effort" onKeyDown={event => {
    if (event.key !== "Escape" || !event.currentTarget.open) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false
    event.currentTarget.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true })
  }}>
    <summary>강도 안내</summary>
    {explanations.map(explanation => <p key={explanation}>{explanation}</p>)}
  </details> : null
}
