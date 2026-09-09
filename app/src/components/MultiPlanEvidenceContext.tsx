import React from "react"
import type { RetainedMultiAdjustedEvidenceV3 } from "../domain/selected-multi-adjusted-plan-v3"

// A reader, not a captured account's data. Consumers re-read when opening a view.
export const MultiPlanEvidenceContext = React.createContext<
  (() => readonly RetainedMultiAdjustedEvidenceV3[]) | undefined
>(undefined)
