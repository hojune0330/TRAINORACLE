import { ArrowRight } from "lucide-react"
import { useId } from "react"
import "../../styles/home-hub.css"

export type HomeOraclePreviewProps = {
  readonly question: string
  readonly answer: string
  readonly sourceLabel: string
  readonly kind: "personal" | "partial" | "plan" | "example" | "unavailable"
  readonly onOpen: () => void
}

const KIND_LABELS: Record<HomeOraclePreviewProps["kind"], string> = {
  personal: "내 기록 결과",
  partial: "기록 일부로 확인",
  plan: "내 계획 진행",
  example: "예시 결과",
  unavailable: "결과를 표시할 수 없어요",
}

export function HomeOraclePreview({ question, answer, sourceLabel, kind, onOpen }: HomeOraclePreviewProps) {
  const resultDescriptionId = useId()
  // Examples remain opt-in. The home invitation contains no fictional result.
  if (kind === "example") return <section className="home-hub__oracle home-hub__oracle--example" aria-label="오라클 · 예시 결과" data-oracle-kind={kind}>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>예시 결과 보기<ArrowRight aria-hidden="true" size={17} /></button>
  </section>
  // Detailed loading/error and recovery notices stay at the top of Home.
  if (kind === "unavailable") return <section className="home-hub__oracle-fallback" aria-label="오라클 · 결과를 표시할 수 없어요" data-oracle-kind={kind}>
    <p>{answer}</p>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>기록 상태 확인<ArrowRight aria-hidden="true" size={17} /></button>
  </section>
  if (kind === "plan") return null
  return <section className={`home-hub__oracle home-hub__oracle--${kind}`} aria-label={`오라클 · ${KIND_LABELS[kind]}`} data-oracle-kind={kind}>
    <button className="home-hub__oracle-card" type="button" onClick={onOpen}
      aria-label="이 결과 자세히 보기" aria-describedby={resultDescriptionId}>
      <span className="home-hub__oracle-copy" id={resultDescriptionId}>
        <span className="home-hub__oracle-title" role="heading" aria-level={2}>{question}</span>
        <span className="home-hub__oracle-answer">{answer}</span>
        <span className="home-hub__oracle-source">{sourceLabel}</span>
      </span>
      <ArrowRight aria-hidden="true" size={18} />
    </button>
  </section>
}
