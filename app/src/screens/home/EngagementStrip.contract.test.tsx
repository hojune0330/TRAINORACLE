import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { EngagementStrip } from "./EngagementStrip"

afterEach(cleanup)

describe("engagement status", () => {
  it("explains that a missed streak wilts the plant without removing cumulative rewards", () => {
    render(<EngagementStrip summary={{
      points: 24,
      journalDays: 5,
      recordingStreak: 0,
      pointMeaning: "NON_ECONOMIC_LOCAL_BETA",
    }} />)

    expect(screen.getByText(/식물은 잠시 시들었지만/u)).toBeVisible()
    expect(screen.getByText(/함께한 날과 포인트는 그대로/u)).toBeVisible()
  })
})
