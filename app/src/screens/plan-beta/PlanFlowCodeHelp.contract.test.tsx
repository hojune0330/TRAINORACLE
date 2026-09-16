import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { GLOSSARY } from "../../domain/glossary"
import { PlanFlowCodeHelp } from "./PlanFlowCodeHelp"
import { AppOverlayNavigationProvider } from "../../components/AppOverlayNavigation"

afterEach(cleanup)

describe("plan flow code help", () => {
  it("explains the primary schedule code and secondary energy code together", async () => {
    const user = userEvent.setup()
    render(<PlanFlowCodeHelp primary="MAIN" secondary="LT" kind="main" />)

    const trigger = screen.getByRole("button", { name: "주요 훈련 MAIN, 지속 페이스 LT 훈련 설명 보기" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    await user.click(trigger)

    expect(screen.getByText(GLOSSARY.main.short)).toBeVisible()
    expect(screen.getByText(GLOSSARY.lt.short)).toBeVisible()
    expect(screen.getByRole("button", { name: "주요 훈련 MAIN, 지속 페이스 LT 훈련 설명 닫기" })).toHaveAttribute("aria-expanded", "true")
  })

  it.each([
    ["BASE", "base", "base"],
    ["REC", "recovery", "rec"],
    ["OFF", "off", "off"],
  ] as const)("opens the %s beginner explanation", async (primary, kind, term) => {
    const user = userEvent.setup()
    render(<PlanFlowCodeHelp primary={primary} kind={kind} variant="legend" />)

    await user.click(screen.getByRole("button", { name: new RegExp(`${GLOSSARY[term].label}.*${primary}.*일정표 구분 설명 보기`, "u") }))

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

    await user.click(screen.getByRole("button", { name: new RegExp(`주요 훈련 MAIN.*${GLOSSARY[term].label}.*훈련 설명 보기`, "u") }))

    expect(screen.getByText(GLOSSARY[term].short)).toBeVisible()
  })

  it("opens the full term inside the app and closes the floating explanation", async () => {
    const user = userEvent.setup()
    let opened = ""
    render(
      <AppOverlayNavigationProvider openTrainingTerm={(term) => { opened = term }} openFeedback={() => undefined}>
        <PlanFlowCodeHelp primary="MAIN" secondary="LT" kind="main" />
      </AppOverlayNavigationProvider>,
    )

    await user.click(screen.getByRole("button", { name: /주요 훈련 MAIN.*지속 페이스 LT/u }))
    const ltSection = screen.getByText(GLOSSARY.lt.short).closest("section")
    expect(ltSection).not.toBeNull()
    await user.click(within(ltSection!).getByRole("link", { name: "용어 자세히 보기" }))

    expect(opened).toBe("lt")
    expect(screen.queryByText(GLOSSARY.lt.short)).not.toBeInTheDocument()
  })
})
