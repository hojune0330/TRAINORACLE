import { ArrowRight } from "lucide-react"
import { useId } from "react"
import { ContextualIllustration } from "../../components/ContextualIllustration"
import { InfoDisclosure } from "../../components/InfoDisclosure"
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
    <button className="home-hub__oracle-card" type="button" onClick={onOpen}
      aria-label={kind === "plan" ? "계획 자세히 보기" : "이 결과 자세히 보기"} aria-describedby={resultDescriptionId}>
      <span className="home-hub__oracle-copy" id={resultDescriptionId}>
        <span className="home-hub__oracle-title" role="heading" aria-level={2}>{question}</span>
        <span className="home-hub__oracle-answer">{answer}</span>
        <span className="home-hub__oracle-source">{kind === "plan" ? "운동 일지와 별도" : sourceLabel}</span>
      </span>
      <ArrowRight aria-hidden="true" size={18} />
    </button>
    {kind === "plan" && <InfoDisclosure title="계획 진행 기준" purpose="help" preview="계획과 완료 체크 기준">
      <p className="home-hub__oracle-source-detail">{sourceLabel}</p>
    </InfoDisclosure>}
  </section>
}
