import type { SavedFactReceipt } from "./save-receipt"

export type AnalysisSection = "summary" | "distance" | "mix" | "monthly" | "files"
export type AnalysisNavigation = {
  readonly section: AnalysisSection
  readonly metric?: "DISTANCE_KM" | "MOOD" | "PAIN_MAX" | "SECONDS_PER_KM"
  readonly savedDate?: string
}

/** Keep the saved fact's destination, without copying the record or private text. */
export function analysisNavigationForReceipt(receipt: SavedFactReceipt): AnalysisNavigation | null {
  switch (receipt.kind) {
    case "distance": return { section: "monthly", metric: "DISTANCE_KM", savedDate: receipt.savedDate }
    case "pain": return { section: "monthly", metric: "PAIN_MAX", savedDate: receipt.savedDate }
    case "mood": return { section: "monthly", metric: "MOOD", savedDate: receipt.savedDate }
    case "generic": return null
  }
}
