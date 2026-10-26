/** Read-only display data. Adapters own validation; this model never calculates a dose. */
export type VisualTrainingStep = {
  readonly id: string
  readonly label: string
  readonly amount: string
  readonly instruction: string
  readonly explanation?: string
  readonly details?: readonly string[]
  readonly kind: "work" | "recovery" | "preparation" | "buildup" | "walk" | "cooldown" | "record" | "concept"
  readonly phase?: "warmup" | "main" | "cooldown"
  readonly group?: string
}

export type VisualTrainingGuideData = {
  /** Opaque context fingerprint. Never put account/record identifiers in the DOM or history. */
  readonly id: string
  readonly title: string
  readonly contextLabel: string
  readonly summary?: string
  readonly steps: readonly VisualTrainingStep[]
  readonly notes?: readonly string[]
  readonly sources?: readonly { readonly label: string; readonly url: string }[]
  readonly layout?: "sequence" | "comparison" | "facts"
}
