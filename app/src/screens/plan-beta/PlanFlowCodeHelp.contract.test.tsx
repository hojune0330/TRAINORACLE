import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { GLOSSARY } from "../../domain/glossary"
import { PlanFlowCodeHelp } from "./PlanFlowCodeHelp"

afterEach(cleanup)

describe("plan flow code help", () => {
  it("explains the primary schedule code and secondary energy code together", async () => {
    const user = userEvent.setup()
    render(<PlanFlowCodeHelp primary="MAIN" secondary="LT" kind="main" />)

    const trigger = screen.getByRole("button", { name: "MAIN LT 훈련 설명 보기" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    await user.click(trigger)

    expect(screen.getByText(GLOSSARY.main.short)).toBeVisible()
    expect(screen.getByText(GLOSSARY.lt.short)).toBeVisible()
    expect(screen.getByRole("button", { name: "MAIN LT 훈련 설명 닫기" })).toHaveAttribute("aria-expanded", "true")
  })

  it.each([
    ["BASE", "base", "base"],
    ["REC", "recovery", "rec"],
    ["OFF", "off", "off"],
  ] as const)("opens the %s beginner explanation", async (primary, kind, term) => {
    const user = userEvent.setup()
    render(<PlanFlowCodeHelp primary={primary} kind={kind} variant="legend" />)

    await user.click(screen.getByRole("button", { name: `${primary} 일정표 구분 설명 보기` }))

    expect(screen.getByText(GLOSSARY[term].short)).toBeVisible()
  })

  it.each([
    ["VO2", "vo2"],
    ["GLY", "gly"],
    ["ATP", "atp"],
    ["MIX", "mix"],
  ] as const)("opens the %s energy-purpose explanation", async (secondary, term) => {
    const user = userEvent.setup()
    render(<PlanFlowCodeHelp primary="MAIN" secondary={secondary} kind="main" />)

    await user.click(screen.getByRole("button", { name: `MAIN ${secondary} 훈련 설명 보기` }))

    expect(screen.getByText(GLOSSARY[term].short)).toBeVisible()
  })
})
