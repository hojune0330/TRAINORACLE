import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { EngagementStrip } from "./EngagementStrip"

describe("engagement copy", () => {
  it("names earned points honestly and avoids shame after a missed day", () => {
    render(<EngagementStrip summary={{
      points: 8,
      recordingStreak: 0,
      journalDays: 2,
      pointMeaning: "NON_ECONOMIC_LOCAL_BETA",
    }} />)

    expect(screen.getByText("누적 획득 · BETA")).toBeVisible()
    expect(screen.getByText(/연속 기록은 쉬어가도/u)).toBeVisible()
    expect(screen.queryByText(/시들/u)).toBeNull()
    expect(screen.getByText(/몸 상태·회복 체크/u)).toBeVisible()
  })
})
