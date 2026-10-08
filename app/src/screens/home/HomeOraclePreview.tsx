import { ArrowRight } from "lucide-react"
import { ContextualIllustration } from "../../components/ContextualIllustration"
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
  // Examples remain opt-in. The home invitation contains no fictional result.
  if (kind === "example") return <section className="home-hub__oracle home-hub__oracle--example" aria-label="오라클 · 예시 결과" data-oracle-kind={kind}>
    <span className="home-hub__oracle-brand">오라클</span>
    <div className="contextual-entry-intro">
      <h2 className="contextual-entry-intro__copy">훈련량부터 경기 기록 비교까지</h2>
      <ContextualIllustration image="analysis-lens" />
    </div>
    <p className="home-hub__oracle-answer">기록 없이도 예시 결과를 먼저 볼 수 있어요.</p>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>예시 결과 보기<ArrowRight aria-hidden="true" size={17} /></button>
  </section>
  // Detailed loading/error and recovery notices stay at the top of Home.
  if (kind === "unavailable") return <section className="home-hub__oracle-fallback" aria-label="오라클 · 결과를 표시할 수 없어요" data-oracle-kind={kind}>
    <p>{answer}</p>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>기록 상태 확인<ArrowRight aria-hidden="true" size={17} /></button>
  </section>
  return <section className={`home-hub__oracle home-hub__oracle--${kind}`} aria-label={`오라클 · ${KIND_LABELS[kind]}`} data-oracle-kind={kind}>
    <div className="home-hub__oracle-heading">
      <span className="home-hub__oracle-brand">오라클</span>
      <span className="home-hub__oracle-kind">{KIND_LABELS[kind]}</span>
    </div>
    <h2>{question}</h2>
    <p className="home-hub__oracle-answer">{answer}</p>
    <p className="home-hub__oracle-source">{sourceLabel}</p>
    <button className="home-hub__oracle-action" type="button" onClick={onOpen}>
      이 결과 자세히 보기<ArrowRight aria-hidden="true" size={17} />
    </button>
  </section>
}
