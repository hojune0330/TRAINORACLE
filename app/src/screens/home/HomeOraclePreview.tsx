import { CategoryCard } from "../../components/CategoryCard"
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

export function HomeOraclePreview({ answer, kind, onOpen }: HomeOraclePreviewProps) {
  // Examples remain opt-in. The home invitation contains no fictional result.
  if (kind === "example") return <section className="home-hub__oracle home-hub__oracle--example" aria-label="오라클 · 예시 결과" data-oracle-kind={kind}>
    <CategoryCard category="oracle" title="운동 분석 예시 보기" onClick={onOpen} />
  </section>
  // Detailed loading/error and recovery notices stay at the top of Home.
  if (kind === "unavailable") return <section className="home-hub__oracle-fallback" aria-label="오라클 · 결과를 표시할 수 없어요" data-oracle-kind={kind}>
    <p>{answer}</p>
    <CategoryCard category="oracle" title="기록 상태 확인" onClick={onOpen} />
  </section>
  if (kind === "plan") return null
  return <section className={`home-hub__oracle home-hub__oracle--${kind}`} aria-label={`오라클 · ${KIND_LABELS[kind]}`} data-oracle-kind={kind}>
    <CategoryCard category="oracle" title="내 훈련 분석" headingLevel={2}
      aria-label="내 훈련 분석" onClick={onOpen} />
  </section>
}
