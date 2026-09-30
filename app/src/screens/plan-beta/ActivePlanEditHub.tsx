import React from "react"
import { X } from "lucide-react"
import "./ActivePlanEditHub.css"

export type ActivePlanEditIntent = "schedule" | "workout" | "remaining" | "new-plan"

export interface ActivePlanEditAlternative {
  readonly label: string
  readonly onChoose: () => void
}

export interface ActivePlanEditAvailability {
  readonly available: boolean
  readonly hidden?: boolean
  readonly reason?: string
  readonly alternative?: ActivePlanEditAlternative
}

export interface ActivePlanEditHubProps {
  readonly onClose: () => void
  readonly onChoose: (intent: ActivePlanEditIntent) => void
  readonly availability?: Partial<Record<ActivePlanEditIntent, ActivePlanEditAvailability>>
}

const choices: readonly { readonly intent: ActivePlanEditIntent; readonly label: string }[] = [
  { intent: "schedule", label: "훈련 날짜 바꾸기" },
  { intent: "workout", label: "훈련 내용 바꾸기" },
  { intent: "remaining", label: "남은 일정 다시 짜기" },
  { intent: "new-plan", label: "새 계획 만들기" },
]

export function ActivePlanEditHub({ onClose, onChoose, availability }: ActivePlanEditHubProps) {
  const headingId = React.useId()
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const openerRef = React.useRef<HTMLElement | null>(null)

  React.useLayoutEffect(() => {
    const active = document.activeElement
    openerRef.current = active instanceof HTMLElement ? active : null
    headingRef.current?.focus()

    return () => openerRef.current?.focus()
  }, [])

  const close = () => {
    onClose()
    openerRef.current?.focus()
  }

  return (
    <section className="active-plan-edit-hub" role="region" aria-labelledby={headingId}>
      <header className="active-plan-edit-hub__header">
        <div>
          <h2 id={headingId} ref={headingRef} tabIndex={-1}>계획 수정</h2>
          <p>바꾸려는 범위를 선택해 주세요.</p>
        </div>
        <button
          className="active-plan-edit-hub__close"
          type="button"
          aria-label="계획 수정 닫기"
          onClick={close}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>

      <ul className="active-plan-edit-hub__choices">
        {choices.map(({ intent, label }) => {
          const status = availability?.[intent]
          if (status?.hidden) return null
          const available = status?.available ?? true

          return (
            <li
              key={intent}
              className={intent === "new-plan"
                ? "active-plan-edit-hub__choice active-plan-edit-hub__choice--secondary"
                : "active-plan-edit-hub__choice"}
            >
              {available ? (
                <button type="button" onClick={() => onChoose(intent)}>
                  {label}
                </button>
              ) : (
                <div className="active-plan-edit-hub__unavailable">
                  <span className="active-plan-edit-hub__choice-label">{label}</span>
                  <p>{status?.reason ?? "현재 이 변경 경로를 열 수 없어요."}</p>
                  {status?.alternative && (
                    <button type="button" onClick={status.alternative.onChoose}>
                      {status.alternative.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
