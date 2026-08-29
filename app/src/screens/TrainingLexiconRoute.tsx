import React from "react"
import { isTermId } from "../domain/glossary"

type TrainingLexiconModule = typeof import("./TrainingLexicon")

const defaultLoader = () => import("./TrainingLexicon")

export function TrainingLexiconRoute({ load = defaultLoader }: { readonly load?: () => Promise<TrainingLexiconModule> }) {
  const LazyTrainingLexicon = React.useMemo(
    () => React.lazy(async () => {
      const module = await load()
      const term = new URLSearchParams(window.location.search).get("term")
      return { default: () => <module.TrainingLexicon standalone initialTerm={isTermId(term) ? term : undefined} /> }
    }),
    [load],
  )

  return (
    <React.Suspense fallback={<main className="training-lexicon"><p>훈련 용어집을 여는 중…</p></main>}>
      <LazyTrainingLexicon />
    </React.Suspense>
  )
}
