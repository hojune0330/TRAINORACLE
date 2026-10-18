import { CompanionMotion } from "./CompanionMotion"
import { EXECUTION_STOP_CUE } from "../screens/plan-beta/labels"
import "../styles/training-instruction-cards.css"

type Instruction = { readonly role: string; readonly title: string; readonly detail: string }

/** Split only explicit top-level transitions; a repeated group stays together. */
function instructionParts(text: string): string[] {
  const parts: string[] = []
  let depth = 0, start = 0
  for (let index = 0; index < text.length; index++) {
    if ("([{".includes(text[index]!)) depth++
    else if (")]}".includes(text[index]!)) depth = Math.max(0, depth - 1)
    else if (text[index] === "→" && depth === 0) {
      parts.push(text.slice(start, index).trim())
      start = index + 1
    }
  }
  parts.push(text.slice(start).trim())
  // Unknown/malformed prose remains intact rather than dropping empty segments.
  return parts.every(Boolean) ? parts : [text]
}

/** Presentation only: keeps source quantities, order, qualifications and stop guidance. */
export function TrainingInstructionCards({ steps }: { readonly steps: readonly Instruction[] }) {
  const hasStopCue = steps.some(step => step.detail.endsWith(EXECUTION_STOP_CUE))
  return <div className="training-instructions">
    <dl className="training-instructions__cards">
      {steps.map((step, index) => {
        const detail = step.detail.endsWith(EXECUTION_STOP_CUE)
          ? step.detail.slice(0, -EXECUTION_STOP_CUE.length).trimEnd() : step.detail
        const total = step.role === "TOTAL_DURATION"
        const main = step.role === "MAIN"
        const totalPrefix = "준비·회복·정리 포함 "
        const separatedTotal = total && detail.startsWith(totalPrefix)
        const parts = instructionParts(detail)
        return <div className={`training-instructions__card${total ? " training-instructions__card--total" : ""}${main ? " training-instructions__card--main" : ""}`} key={`${index}-${step.role}`}>
          <dt>{step.title}</dt>
          <dd>
            {total ? <><div className="training-instructions__total-value">
              <strong className={separatedTotal ? "training-instructions__duration" : "training-instructions__detail"}>{separatedTotal ? detail.slice(totalPrefix.length) : detail}</strong>
              {separatedTotal && <span className="training-instructions__included">{totalPrefix.trimEnd()}</span>}
              </div>
            </> : parts.length > 1 ? <ol className="training-instructions__sequence" aria-label={`${step.title} 순서`}>
              {parts.map((part, partIndex) => {
                const candidate = part.indexOf(" · ")
                const separator = /[()[\]{}]/u.test(part.slice(0, candidate)) ? -1 : candidate
                return <li key={partIndex}>
                  <span className="training-instructions__number" aria-hidden="true">{partIndex + 1}</span>
                  <div>{separator > 0 ? <><strong>{part.slice(0, separator)}</strong><p>{part.slice(separator + 3)}</p></> : <strong>{part}</strong>}</div>
                </li>
              })}
            </ol> : <p className="training-instructions__detail">{detail}</p>}
          </dd>
        </div>
      })}
    </dl>
    {hasStopCue && <aside className="training-instructions__coach" aria-label="운동 중 기억할 점">
      <div className="training-instructions__coach-heading">
        <p className="training-instructions__coach-name">운동 중 기억해 주세요</p>
        <CompanionMotion interactive />
      </div>
      <p>{EXECUTION_STOP_CUE}</p>
    </aside>}
  </div>
}
