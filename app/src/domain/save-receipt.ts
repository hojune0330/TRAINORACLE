import { isEligibleForAnalysis } from "./field-provenance"
import type { JournalEntry } from "./journal-store"
import { parseDecimalString } from "./numeric-input"

export type SavedFactReceipt =
  | { readonly kind: "pain"; readonly moodAlsoSaved: boolean }
  | { readonly kind: "mood" }
  | { readonly kind: "distance"; readonly distanceKm: number }
  | { readonly kind: "generic" }

export function createSavedFactReceipt(entry: JournalEntry | undefined): SavedFactReceipt {
  if (entry === undefined) return { kind: "generic" }

  switch (entry.kind) {
    case "evening": {
      const painSaved = isEligibleForAnalysis("painParts", entry.fieldProvenance)
        && Object.values(entry.painParts).some((level) => level > 0)
      const moodSaved = isEligibleForAnalysis("mood", entry.fieldProvenance) && entry.mood > 0
      if (painSaved) return { kind: "pain", moodAlsoSaved: moodSaved }
      return moodSaved ? { kind: "mood" } : { kind: "generic" }
    }
    case "post-session": {
      const distanceKm = parseDecimalString(entry.distanceKm)
      const distanceSaved = isEligibleForAnalysis("distanceKm", entry.fieldProvenance)
        && distanceKm !== null
        && distanceKm > 0
      return distanceSaved ? { kind: "distance", distanceKm } : { kind: "generic" }
    }
    case "race":
      return { kind: "generic" }
  }
}
