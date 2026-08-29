import { describe, expect, it } from "vitest"
import {
  buildEngagementSharePayload,
  engagementBadges,
  nextEngagementMilestone,
} from "./engagement-rewards"

describe("engagement rewards", () => {
  it("unlocks cumulative badges without requiring consecutive dates", () => {
    expect(engagementBadges(0)).toEqual([])
    expect(engagementBadges(14).map((badge) => badge.requiredJournalDays)).toEqual([1, 7, 14])
  })

  it("points to the next cumulative recording milestone", () => {
    expect(nextEngagementMilestone(7)).toMatchObject({
      requiredJournalDays: 14,
      remainingJournalDays: 7,
    })
    expect(nextEngagementMilestone(30)).toBeNull()
  })

  it("builds a share payload from derived engagement facts only", () => {
    const privateText = "raw journal: pain 7, RPE 9, 20km at 3:30/km"
    const input = {
      journalDays: 14,
      availablePoints: 12,
      ownedDecorationIds: ["STICKER_FINISH_LINE"],
      appUrl: `https://example.test/TRAINORACLE/?memo=${encodeURIComponent(privateText)}#pain`,
      memo: privateText,
    } as const
    const payload = buildEngagementSharePayload(input)

    expect(payload).toMatchObject({
      title: "TrainOracle 러닝 기록",
      url: "https://example.test/TRAINORACLE/",
    })
    expect(payload.text).toContain("14일")
    expect(payload.text).toContain("12P")
    expect(payload.text).toContain("꾸미기 결승선 스티커")
    expect(JSON.stringify(payload)).not.toContain(privateText)
    expect(Object.keys(payload).sort()).toEqual(["text", "title", "url"])
  })
})
