import { beforeEach, describe, expect, it } from "vitest"
import { dismissFirstVisit, hasDismissedFirstVisit } from "./onboarding-state"

describe("first visit dismissal", () => {
  beforeEach(() => window.localStorage.clear())

  it("stays dismissed after a reload", () => {
    expect(hasDismissedFirstVisit()).toBe(false)

    dismissFirstVisit()

    expect(hasDismissedFirstVisit()).toBe(true)
  })
})
