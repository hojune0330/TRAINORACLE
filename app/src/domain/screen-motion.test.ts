import { describe, expect, it } from "vitest"
import { orderedStepMotion, screenMotion, tabMotion } from "./screen-motion"

describe("screen motion direction", () => {
  it("follows the visible bottom-tab order", () => {
    expect(tabMotion("home", "plan")).toBe("tab-forward")
    expect(tabMotion("trends", "journal")).toBe("tab-backward")
    expect(tabMotion("plan", "plan")).toBe("replace")
  })

  it("distinguishes detail entry, return, replacement, and first paint", () => {
    const root = { key: "home", tab: "home", depth: 0 } as const
    const detail = { key: "home:detail", tab: "home", depth: 1 } as const
    const sibling = { key: "home:more", tab: "home", depth: 1 } as const

    expect(screenMotion(null, root)).toBe("initial")
    expect(screenMotion(root, detail)).toBe("push")
    expect(screenMotion(detail, root)).toBe("pop")
    expect(screenMotion(detail, sibling)).toBe("replace")
    expect(screenMotion(root, root)).toBe("none")
  })

  it("gives repeated decision flows a forward and backward direction", () => {
    const order = ["pick", "review", "saved"] as const
    expect(orderedStepMotion(null, "pick", order)).toBe("initial")
    expect(orderedStepMotion("pick", "review", order)).toBe("forward")
    expect(orderedStepMotion("saved", "review", order)).toBe("backward")
  })
})
