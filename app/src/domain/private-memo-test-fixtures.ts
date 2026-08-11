import type { PostSessionEntry } from "./journal-schema"

export function privateEntry(id: string, memo: string): PostSessionEntry {
  return {
    id,
    kind: "post-session",
    date: "2026-08-01",
    savedAt: `2026-08-01T00:00:0${id.length}.000Z`,
    syncState: "local",
    system: "recovery",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe: 0,
    memo,
    memoPurpose: "PRIVATE_SELF_ONLY",
  }
}
