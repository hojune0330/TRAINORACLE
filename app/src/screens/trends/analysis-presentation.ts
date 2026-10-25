/** Presentation only. Eligibility and all numerical calculations remain in the domain. */
export function analysisPresentation(input: {
  readonly readComplete: boolean
  readonly hasRecords: boolean
  readonly hasFacts: boolean
}): "unavailable" | "empty" | "records-only" | "facts" {
  if (!input.readComplete) return "unavailable"
  if (input.hasFacts) return "facts"
  return input.hasRecords ? "records-only" : "empty"
}
