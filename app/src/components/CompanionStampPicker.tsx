import { Check } from "lucide-react"
import { COMPANION_ANIMALS, COMPANION_POSES, companionStampUrl, type CompanionStamp } from "../domain/training-companions"
import "../styles/training-companions.css"

export function CompanionStampPicker({ value, onChange, disabled = false }: {
  readonly value: CompanionStamp | null; readonly onChange: (value: CompanionStamp | null) => void; readonly disabled?: boolean
}) {
  return <fieldset className="companion-stamp-picker" disabled={disabled}>
    <legend>동물 스티커</legend>
    <div className="companion-stamp-picker__animals app-choice-group" role="group" aria-label="메모 동물">
      <button type="button" className="app-choice-control" aria-pressed={value === null} onClick={() => onChange(null)}><span className="companion-stamp-picker__empty" aria-hidden="true">—</span><span>없음</span><Check size={14} aria-hidden="true" style={{ visibility: value === null ? "visible" : "hidden" }} /></button>
      {COMPANION_ANIMALS.map(animal => <button type="button" className="app-choice-control" key={animal.id} aria-pressed={value?.animal === animal.id}
        onClick={() => onChange({ animal: animal.id, pose: value?.pose ?? "run" })}>
        <img src={companionStampUrl({ animal: animal.id, pose: value?.pose ?? "run" })} alt="" width={48} height={48} loading="lazy" />
        <span>{animal.name}</span><Check size={14} aria-hidden="true" style={{ visibility: value?.animal === animal.id ? "visible" : "hidden" }} />
      </button>)}
    </div>
    {value && <div className="companion-stamp-picker__poses app-choice-group" role="group" aria-label="메모 동물 자세">
      {COMPANION_POSES.map(pose => <button type="button" className="app-choice-control" key={pose.id} aria-pressed={value.pose === pose.id}
        onClick={() => onChange({ ...value, pose: pose.id })}>{pose.name}</button>)}
    </div>}
  </fieldset>
}
