import React from "react"
import { PainDot } from "../../components/JournalPrimitives"
import { TermHelp } from "../../components/TermHelp"

interface BodyDiagramProps {
  readonly selected?: Readonly<Record<string, number>>
  readonly onChange?: (next: Record<string, number>) => void
}

const BODY_PARTS = [
  { id: "rKnee", x: 96, y: 290, name: "오른 무릎" },
  { id: "lKnee", x: 124, y: 290, name: "왼 무릎" },
  { id: "rCalf", x: 96, y: 350, name: "오른 종아리" },
  { id: "lCalf", x: 124, y: 350, name: "왼 종아리" },
  { id: "rHam", x: 96, y: 240, name: "오른 햄스트링" },
  { id: "lHam", x: 124, y: 240, name: "왼 햄스트링" },
  { id: "lBack", x: 110, y: 150, name: "허리" },
  { id: "rFoot", x: 96, y: 410, name: "오른 발" },
  { id: "lFoot", x: 124, y: 410, name: "왼 발" },
  { id: "rShin", x: 96, y: 380, name: "정강이" },
] as const

export function BodyDiagram({ selected = {}, onChange }: BodyDiagramProps) {
  const anySelected = Object.values(selected).some((level) => level > 0)
  // 그림은 기본으로 닫는다. 하루 마무리 화면 길이의 절반을 이 그림이 먹는데
  // (476px / 754px), 그림은 aria-hidden 이고 onClick 도 없어서 고르는 데는
  // 쓰이지 않는다. 선택은 아래 버튼 10개에서만 일어난다. — 작업지시서 UX1 §2-3
  //
  // 통증을 하나라도 고르면 자동으로 펼친다. 어디를 골랐는지 한눈에
  // 보여주는 게 그림이 하는 일이다. 반대로 코드가 닫는 일은 없다.
  //
  // 닫혀 있어도 <svg> 는 DOM 에 그대로 둔다 (display:none). 지우면
  // [data-body-part] 를 읽는 검사가 깨지고, 다시 열 때 그림이 새로 그려진다.
  const [diagramOpen, setDiagramOpen] = React.useState(false)
  const wasSelected = React.useRef(anySelected)

  React.useEffect(() => {
    if (anySelected && !wasSelected.current) setDiagramOpen(true)
    wasSelected.current = anySelected
  }, [anySelected])

  const cycle = (id: string) => {
    const current = selected[id] || 0
    const next = current >= 5 ? 0 : current + 1
    const output = { ...selected }
    if (next === 0) delete output[id]
    else output[id] = next
    onChange?.(output)
  }

  return (
    <div className="body-pain-selector" data-diagram-open={diagramOpen ? "true" : "false"}>
      <div
        className="body-pain-selector__visual"
        style={diagramOpen
          ? { position: "relative", background: "var(--paper)", padding: 8 }
          : { display: "none" }}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 220 460" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", height: "auto" }}>
          <g fill="none" stroke="var(--ink-3)" strokeWidth="1.2">
            <circle cx="110" cy="60" r="22" />
            <line x1="110" y1="82" x2="110" y2="220" />
            <line x1="110" y1="100" x2="70" y2="170" />
            <line x1="110" y1="100" x2="150" y2="170" />
            <line x1="110" y1="220" x2="96" y2="420" />
            <line x1="110" y1="220" x2="124" y2="420" />
          </g>
          {BODY_PARTS.map((part) => {
            const level = selected[part.id] || 0
            return (
              <g key={part.id}>
                <circle data-body-part={part.id} cx={part.x} cy={part.y} r={level ? 9 : 6}
                  fill={level ? `var(--pain-${level})` : "rgba(0,0,0,0)"}
                  stroke={level ? `var(--pain-${level})` : "var(--ink-4)"}
                  strokeWidth={level ? 0 : 1.2} />
                {level > 0 && (
                  <text x={part.x} y={part.y + 3.5} textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="700"
                    fill="#fff">{level}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.04em" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase" }}>탭으로 1→5→해제</span>
          <button
            type="button"
            aria-expanded={diagramOpen}
            onClick={() => setDiagramOpen((current) => !current)}
            style={{
              marginLeft: "auto", minHeight: 44, padding: "8px 10px",
              border: "1px solid var(--line)", background: "transparent", borderRadius: 0,
              fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)",
              letterSpacing: "0.06em", cursor: "pointer",
            }}
          >{diagramOpen ? "몸 그림 접기" : "몸 그림 보기"}</button>
        </div>
        <div className="body-pain-selector__buttons">
          {BODY_PARTS.map((part) => {
            const level = selected[part.id] || 0
            return (
              <button
                key={part.id}
                type="button"
                aria-label={`${part.name}${level > 0 ? `, 통증 ${level}단계` : ", 통증 없음"}. 누르면 ${level >= 5 ? "해제" : `${level + 1}단계`}`}
                aria-pressed={level > 0}
                onClick={() => cycle(part.id)}
                style={{
                  minHeight: 44, width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 8px", border: "1px solid var(--line)", background: level > 0 ? "var(--surface)" : "transparent",
                  color: "var(--ink)", cursor: "pointer", borderRadius: 0, textAlign: "left",
                }}
              >
                <PainDot level={level} />
                <span style={{ color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 12.5 }}>{part.name}</span>
                <span style={{ marginLeft: "auto", color: level > 0 ? `var(--pain-${level})` : "var(--ink-4)", fontWeight: 600 }}>{level > 0 ? `${level}/5` : "—"}</span>
              </button>
            )
          })}
        </div>
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
          fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--warn)",
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
