import type { PostSessionEntry } from "./journal-schema"

const RPE_BAND_LABEL: Readonly<Record<NonNullable<PostSessionEntry["rpeBand"]>, string | null>> = {
  RPE_1_2: "1~2",
  RPE_3_4: "3~4",
  RPE_5_6: "5~6",
  RPE_7_8: "7~8",
  RPE_9_10: "9~10",
  UNKNOWN: null,
}

export function journalRpeLabel(entry: PostSessionEntry): string | null {
  if (entry.rpe > 0) return String(entry.rpe)
  return entry.rpeBand === undefined ? null : RPE_BAND_LABEL[entry.rpeBand]
}

export function quickOutcomeLabel(entry: PostSessionEntry): string | null {
  switch (entry.activityOutcome) {
    case "COMPLETED": return "훈련 완료"
    case "PARTIAL": return "일부 완료"
    case "LIGHT_ACTIVITY": return "가벼운 운동"
    case "RESTED": return "휴식"
    case "SKIPPED": return "건너뜀"
    default: return null
  }
}
