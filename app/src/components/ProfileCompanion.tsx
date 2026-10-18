import { useId, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ContextualIllustration } from "./ContextualIllustration"
import { useCalendarMotion } from "../hooks/useCalendarMotion"
import "../styles/profile-companion.css"

type Props = { readonly mode: "intro" | "result" }

/** A voluntary reading tip, never an answer evaluator or a save/reward signal. */
export function ProfileCompanion({ mode }: Props) {
  return <CompanionTip key={mode} mode={mode} />
}

function CompanionTip({ mode }: Props) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { reduced } = useCalendarMotion()
  const label = mode === "intro" ? "답변 팁 보기" : "결과 안내 보기"
  const Chevron = open ? ChevronUp : ChevronDown
  return <div className="profile-companion" data-reduced-motion={reduced} onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
  }}>
    <button type="button" className="profile-companion__button" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}>
      <ContextualIllustration image={open ? "mari-profile-wave" : mode === "intro" ? "mari-profile-hello" : "mari-profile-explain"} size="medium" />
      <span className="profile-companion__action">{label}<Chevron size={16} aria-hidden="true" /></span>
    </button>
    <p id={id} className="profile-companion__tip" hidden={!open}>
      {mode === "intro" ? "정답은 없어요. 평소 내 모습에 가까운 답을 골라요." : "선택한 답으로 정리한 취향이에요. 실력이나 건강을 평가한 결과는 아니에요."}
    </p>
  </div>
}
