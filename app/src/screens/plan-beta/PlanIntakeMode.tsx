import { Check, ChevronRight, SlidersHorizontal, Sparkles, X } from "lucide-react"
import { useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CategoryIcon } from "../../components/CategoryCard"
import { useReaderDialog } from "../../hooks/useReaderDialog"
import "./PlanIntakeMode.css"

type IntakeMode = "quick" | "precision"

const MODES = [
  { value: "quick", label: "간단히", caption: "기본 질문만", icon: Sparkles },
  { value: "precision", label: "직접 설정", caption: "일정·구성도 조절", icon: SlidersHorizontal },
] as const

export function PlanIntakeMode({ value, disabled = false, onChange }: {
  readonly value: IntakeMode
  readonly disabled?: boolean
  readonly onChange: (mode: IntakeMode) => void
}) {
  const id = useId()
  const differenceButton = useRef<HTMLButtonElement>(null)
  const [differenceOpen, setDifferenceOpen] = useState(false)

  return <div className="plan-intake-mode" data-category="training">
    <div className="plan-intake-mode__choices app-choice-group" role="group" aria-label="계획 입력 방식">
      {MODES.map(({ value: mode, label, caption, icon }) => <button key={mode}
        type="button" className="plan-intake-mode__choice app-choice-control category-choice"
        aria-pressed={value === mode} aria-labelledby={`${id}-${mode}-label`}
        aria-describedby={`${id}-${mode}-caption`} disabled={disabled}
        onClick={() => { if (!disabled && value !== mode) onChange(mode) }}>
        <span className="plan-intake-mode__symbols" aria-hidden="true">
          <CategoryIcon category="training" icon={icon} compact />
          <Check className="plan-intake-mode__check" size={18} />
        </span>
        <span id={`${id}-${mode}-label`} className="plan-intake-mode__label">{label}</span>
        <span id={`${id}-${mode}-caption`} className="plan-intake-mode__caption">{caption}</span>
      </button>)}
    </div>
    <div className="plan-intake-mode__support">
      <p className="plan-intake-mode__next" aria-live="polite">
        {value === "precision" && <span>종목·기록을 고른 뒤, 일정과 훈련 구성을 차례로 설정해요.</span>}
      </p>
      <button ref={differenceButton} type="button" className="plan-intake-mode__difference"
        aria-haspopup="dialog" disabled={disabled} onClick={() => setDifferenceOpen(true)}>
        차이 보기<ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
    {disabled && <p className="plan-intake-mode__busy" role="status">기록을 준비하는 동안 입력 방식은 잠시 바꿀 수 없어요.</p>}
    {differenceOpen && createPortal(<IntakeModeDifference onClose={() => setDifferenceOpen(false)}
      returnFocusTo={() => differenceButton.current} />, document.body)}
  </div>
}

function IntakeModeDifference({ onClose, returnFocusTo }: {
  readonly onClose: () => void
  readonly returnFocusTo: () => HTMLElement | null
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const close = useReaderDialog(dialog, onClose, returnFocusTo)

  return <dialog ref={dialog} className="plan-intake-mode__dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="plan-intake-mode__dialog-surface">
      <header className="plan-intake-mode__dialog-header">
        <h2 id={titleId}>입력 방식 차이</h2>
        <button type="button" autoFocus onClick={close} aria-label="입력 방식 차이 닫기"><X size={20} aria-hidden="true" /></button>
      </header>
      <div className="plan-intake-mode__dialog-body">
        <dl>
          <div><dt><Sparkles size={18} aria-hidden="true" />간단히</dt>
            <dd>종목·기록, 경험, 운동일, 몸 상태에 답해 계획안을 확인해요.</dd></div>
          <div><dt><SlidersHorizontal size={18} aria-hidden="true" />직접 설정</dt>
            <dd>기본 질문에 더해 대회 날짜, 일정과 훈련 구성을 차례로 조절해요.</dd></div>
        </dl>
        <p>두 방식 모두 몸 상태를 확인한 뒤 계획안을 만들어요. 방식을 바꿔도 입력한 내용은 유지돼요.</p>
      </div>
    </div>
  </dialog>
}
