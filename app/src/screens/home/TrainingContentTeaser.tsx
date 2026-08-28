import { ArrowRight } from "lucide-react"
import { TRAINING_CONTENT_CATALOG } from "../../domain/training-content-catalog"

export function TrainingContentTeaser({ onOpen }: { readonly onOpen?: () => void }) {
  const featured = TRAINING_CONTENT_CATALOG[0]
  return (
    <section className="training-content-teaser" aria-labelledby="training-content-teaser-title">
      <div>
        <span>읽을거리</span>
        <h2 id="training-content-teaser-title">요즘 주목받는 훈련법</h2>
      </div>
      <button type="button" onClick={onOpen} aria-label={`${featured.shortTitle} 읽기`}> 
        <span>
          <small>{featured.category}</small>
          <strong>{featured.shortTitle}</strong>
          <em>{featured.summary}</em>
        </span>
        <ArrowRight aria-hidden="true" size={18} />
      </button>
      <p>읽거나 저장해도 내 훈련 계획은 자동으로 바뀌지 않아요.</p>
    </section>
  )
}
