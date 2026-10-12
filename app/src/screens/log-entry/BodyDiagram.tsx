import React from "react"
import { PainDot } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"
import { BODY_PARTS } from "../../components/body-parts"
import "./BodyDiagram.css"

interface BodyDiagramProps {
  readonly selected?: Readonly<Record<string, number>>
  readonly onChange?: (next: Record<string, number>) => void
}

export function BodyDiagram({ selected = {}, onChange }: BodyDiagramProps) {
  const [openPartId, setOpenPartId] = React.useState<string | null>(null)
  const [guideUnavailable, setGuideUnavailable] = React.useState(false)
  const pickerId = React.useId()
  const firstLevelRef = React.useRef<HTMLButtonElement>(null)
  const partButtonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const openPart = BODY_PARTS.find((part) => part.id === openPartId)

  React.useEffect(() => {
    if (openPartId !== null) firstLevelRef.current?.focus()
  }, [openPartId])

  const chooseLevel = (id: string, level: number) => {
    const output = { ...selected }
    if (level === 0) delete output[id]
    else output[id] = level
    onChange?.(output)
  }

  return (
    <div className="body-pain-selector">
      <div className="body-pain-selector__heading">
        {!guideUnavailable && <div className="body-pain-selector__visual" aria-hidden="true">
          <img
            src={`${import.meta.env.BASE_URL || "/"}illustrations/body-check-emoji-v1.webp`}
            alt=""
            width={80}
            height={80}
            decoding="async"
            draggable={false}
            onError={() => setGuideUnavailable(true)}
          />
        </div>}
        <p className="body-pain-selector__instruction">불편한 부위를 골라요</p>
      </div>
      <div className="body-pain-selector__content">
        <div className="body-pain-selector__buttons">
          {BODY_PARTS.map((part) => {
            const level = selected[part.id] || 0
            const isOpen = openPartId === part.id
            return (
              <div className="body-pain-selector__part" key={part.id}>
                <button
                  type="button"
                  ref={(node) => {
                    if (node) partButtonRefs.current.set(part.id, node)
                    else partButtonRefs.current.delete(part.id)
                  }}
                  aria-label={`${part.name}${level > 0 ? `, 통증 ${level}/5` : ""}`}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? pickerId : undefined}
                  onClick={() => setOpenPartId(current => current === part.id ? null : part.id)}
                  className="body-pain-selector__part-button app-choice-control"
                >
                  <PainDot level={level} />
                  <span className="body-pain-selector__part-name">{part.name}</span>
                  {level > 0 && <span className="body-pain-selector__part-value">{level}/5</span>}
                </button>
              </div>
            )
          })}
        </div>
        {openPart !== undefined && <div className="body-pain-selector__picker" id={pickerId}>
          <h3 className="body-pain-selector__picker-title" id={`${pickerId}-title`}>{openPart.name} 통증 정도</h3>
          <p className="body-pain-selector__scale-range" id={`${pickerId}-range`}>
            <span>약함</span><span aria-hidden="true">→</span><span>심함</span>
          </p>
          <div className="body-pain-selector__level-picker" role="group" aria-labelledby={`${pickerId}-title`} aria-describedby={`${pickerId}-range`}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return
              event.preventDefault()
              setOpenPartId(null)
              partButtonRefs.current.get(openPart.id)?.focus()
            }}>
            {[1, 2, 3, 4, 5].map(value => (
              <button key={value} type="button" className="app-choice-control body-pain-selector__level"
                aria-label={`${openPart.name} 통증 ${value}단계`} aria-pressed={(selected[openPart.id] || 0) === value}
                ref={value === 1 ? firstLevelRef : undefined}
                onClick={() => chooseLevel(openPart.id, value)}>{value}</button>
            ))}
            <button type="button" className="app-choice-control body-pain-selector__clear"
              aria-label={`${openPart.name} 통증 해제`} aria-pressed={(selected[openPart.id] || 0) === 0}
              onClick={() => chooseLevel(openPart.id, 0)}>해제</button>
          </div>
        </div>}
      </div>
    </div>
  )
}

export function PainReviewBanner() {
  return (
    <div role="status" style={{
      marginTop: 10, padding: "10px 12px",
      border: "1.5px solid var(--warn)", background: "rgba(180,83,12,0.06)",
      display: "flex", alignItems: "flex-start", gap: 8,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: "var(--warn)",
        flexShrink: 0, marginTop: 4,
      }}></span>
      <div>
        <div style={{
          fontFamily: "var(--mono)", fontSize: "var(--fs-caption)", fontWeight: 600,
          letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--warn)",
        }}>REVIEW · 통증 4 이상<TermHelp term="review" /></div>
        <div style={{
          marginTop: 4, fontFamily: "var(--sans)", fontSize: 12.5,
          color: "var(--ink-2)", lineHeight: 1.5,
        }}>
          높은 통증은 사람이 꼭 확인해야 하는 기록이에요.
          지도자·보호자와 상의해 주세요.
          기록은 그대로 저장돼요.
        </div>
      </div>
    </div>
  )
}
