import { ArrowRight } from "lucide-react"
import "../../styles/home-hub.css"

export type HomeOraclePreviewProps = {
  readonly question: string
  readonly answer: string
  readonly sourceLabel: string
  readonly kind: "personal" | "partial" | "example" | "unavailable"
  readonly onOpen: () => void
}

const KIND_LABELS: Record<HomeOraclePreviewProps["kind"], string> = {
  personal: "내 기록 결과",
  partial: "기록 일부로 확인",
  example: "예시 결과",
  unavailable: "결과를 표시할 수 없어요",
}

export function HomeOraclePreview({ question, answer, sourceLabel, kind, onOpen }: HomeOraclePreviewProps) {
  return <section className={`home-hub__oracle home-hub__oracle--${kind}`} aria-label={`오라클 · ${KIND_LABELS[kind]}`} data-oracle-kind={kind}>
    <div className="home-hub__oracle-heading">
      <span className="home-hub__oracle-brand">오라클</span>
      <span className="home-hub__oracle-kind">{KIND_LABELS[kind]}</span>
    </div>
    <h2>{question}</h2>
    <p className="home-hub__oracle-answer">{answer}</p>
    <p className="home-hub__oracle-source">{sourceLabel}</p>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>
      {kind === "unavailable" ? "기록 상태 확인" : "이 결과 자세히 보기"}<ArrowRight aria-hidden="true" size={17} />
    </button>
  </section>
}
