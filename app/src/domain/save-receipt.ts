import { isEligibleForAnalysis } from "./field-provenance"
import type { JournalEntry } from "./journal-store"
// 영수증에 보여주는 거리도 범위 검증을 통과한 값만 쓴다 — 화면에
// "10억 km 저장했어요"가 뜨면 사용자는 앱을 믿지 못한다.
import { parseDistanceKm } from "./numeric-input"

export type SavedFactReceipt =
  | { readonly kind: "pain"; readonly savedDate: string; readonly moodAlsoSaved: boolean }
  | { readonly kind: "mood"; readonly savedDate: string }
  | { readonly kind: "distance"; readonly savedDate: string; readonly distanceKm: number }
  | { readonly kind: "generic"; readonly savedDate?: string }

export function createSavedFactReceipt(entry: JournalEntry | undefined): SavedFactReceipt {
  if (entry === undefined) return { kind: "generic" }

  switch (entry.kind) {
    case "evening": {
      const painSaved = isEligibleForAnalysis("painParts", entry.fieldProvenance)
        && Object.values(entry.painParts).some((level) => level > 0)
      const moodSaved = isEligibleForAnalysis("mood", entry.fieldProvenance) && entry.mood > 0
      if (painSaved) return { kind: "pain", savedDate: entry.date, moodAlsoSaved: moodSaved }
      return moodSaved ? { kind: "mood", savedDate: entry.date } : { kind: "generic", savedDate: entry.date }
    }
    case "post-session": {
      const distanceKm = parseDistanceKm(entry.distanceKm)
      const distanceSaved = isEligibleForAnalysis("distanceKm", entry.fieldProvenance)
        && distanceKm !== null
        && distanceKm > 0
      return distanceSaved
        ? { kind: "distance", savedDate: entry.date, distanceKm }
        : { kind: "generic", savedDate: entry.date }
    }
    case "race":
      return { kind: "generic", savedDate: entry.date }
  }
}
