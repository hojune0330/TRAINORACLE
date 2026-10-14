import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BodyDiagram, PainReviewBanner } from "./BodyDiagram"
import { EveningCheckin } from "./EveningCheckin"
import { PostSessionForm } from "./PostSessionForm"

afterEach(cleanup)

describe("form input names", () => {
  it("names each adjacent post-session input when its question is active", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)

    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    expect(screen.getByRole("textbox", { name: "세션 제목" })).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "거리 (km)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    expect(screen.getByRole("textbox", { name: "거리 (km)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "시간 (분)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "평균 페이스 (/km)" })).toBeVisible()
  })

  it("names controls in the active evening step and keeps optional measures grouped", async () => {
    const user = userEvent.setup()
    render(<EveningCheckin />)

    await user.click(screen.getByRole("button", { name: "수면" }))
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "수면 시간" })).toHaveAttribute("inputmode", "decimal")
    expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: "기분 입력" }))
    expect(screen.getByRole("button", { name: "기분 4 좋음" })).toBeVisible()
    expect(screen.queryByRole("textbox", { name: "체중 (kg)" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "입력 확인으로" }))
    await user.click(screen.getByRole("button", { name: "체중 · 안정시 심박 입력" }))
    expect(screen.getByRole("textbox", { name: "체중 (kg)" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: "안정시 심박 (bpm)" })).toBeVisible()
  })
})

describe("selector state", () => {
  it("exposes the selected energy system and RPE as pressed", async () => {
    const user = userEvent.setup()
    render(<PostSessionForm />)
    await user.click(screen.getByRole("button", { name: "결과는 생략하고 계속" }))
    const vo2 = screen.getByRole("button", { name: /VO₂ 강한 유산소 반복/u })

    expect(screen.getAllByRole("button", { name: /^(?:REC|BASE|LT|VO₂|GLY|ATP-PC|MIX) /u })
      .every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true)
    expect(vo2).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("button", { name: "6" })).toBeNull()
    await user.click(vo2)
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    await user.click(screen.getByRole("button", { name: "다음 질문" }))
    const rpeSix = screen.getByRole("button", { name: "6" })
    expect(rpeSix).toHaveAttribute("aria-pressed", "false")
    await user.click(rpeSix)
    expect(vo2).toHaveAttribute("aria-pressed", "true")
    expect(rpeSix).toHaveAttribute("aria-pressed", "true")
  })
})

describe("high-pain review guidance", () => {
  it("asks for human review without claiming the plan was held", () => {
    // Given
    render(<PainReviewBanner />)

    // When
    const guidance = screen.getByRole("status")

    // Then
    expect(guidance).not.toHaveTextContent("계획이 보류")
    expect(guidance).toHaveTextContent(/사람.*확인/u)
    expect(guidance).toHaveTextContent(/지도자.*보호자.*상의/u)
  })
})

describe("body pain keyboard controls", () => {
  it("uses the static guide image and named buttons while the drawing stays noninteractive", () => {
    const { container } = render(<BodyDiagram />)
    const bodyPartButtons = screen.getAllByRole("button")
    const guide = container.querySelector(".body-pain-selector__visual img")

    expect(bodyPartButtons).toHaveLength(6)
    expect(bodyPartButtons.map(button => button.textContent)).toEqual(["무릎", "종아리", "허벅지 뒤", "발", "정강이", "허리"])
    expect(bodyPartButtons.every((button) => button.tagName === "BUTTON")).toBe(true)
    expect(guide?.getAttribute("src")).toMatch(/\/illustrations\/body-check-emoji-v1\.webp$/u)
    expect(guide).toHaveAttribute("width", "80")
    expect(guide).toHaveAttribute("height", "80")
    expect(guide?.closest("button")).toBeNull()
    expect(guide?.parentElement?.querySelector("svg, canvas")).toBeNull()
    expect(container.querySelector("[data-diagram-open]")).toBeNull()
  })

  it("removes the optional picture space after a load failure without losing pain controls", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const view = render(<BodyDiagram selected={{ lKnee: 2 }} onChange={onChange} />)
    fireEvent.error(view.container.querySelector(".body-pain-selector__visual img") as HTMLImageElement)

    expect(view.container.querySelector(".body-pain-selector__visual")).toBeNull()
    expect(screen.getByText("선택한 부위")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "다른 부위 추가" }))
    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "무릎" }))
    await user.click(within(dialog).getByRole("button", { name: "오른 무릎" }))
    await user.click(screen.getByRole("button", { name: "오른 무릎 통증 3단계" }))
    expect(onChange).toHaveBeenCalledWith({ lKnee: 2, rKnee: 3 })
  })

  it("opens a named part in a dialog by keyboard and selects a direct level", async () => {
    // Given
    const user = userEvent.setup()
    const onChange = vi.fn()
    const view = render(<BodyDiagram onChange={onChange} />)
    const kneeGroup = screen.getByRole("button", { name: "무릎" })
    // When
    kneeGroup.focus()
    await user.keyboard("{Enter}")
    const dialog = await screen.findByRole("dialog", { name: "무릎 · 어느 쪽인가요?" })
    const rightKnee = within(dialog).getByRole("button", { name: "오른 무릎" })
    rightKnee.focus()
    await user.keyboard("{Enter}")
    expect(dialog).toHaveAccessibleName("내 오른쪽 무릎")
    expect(kneeGroup).toHaveAttribute("aria-expanded", "true")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog.querySelector("img")).toHaveAttribute("alt", "내 오른쪽 무릎 위치 · 앞면")
    expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "내 오른쪽 무릎" }))
    await user.click(screen.getByRole("button", { name: "오른 무릎 통증 1단계" }))

    // Then
    expect(onChange).toHaveBeenCalledWith({ rKnee: 1 })
    expect(dialog).toHaveAccessibleName("선택한 부위")
    await user.click(within(dialog).getByRole("button", { name: "입력 완료" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(document.activeElement).toBe(kneeGroup)
    view.rerender(<BodyDiagram selected={{ rKnee: 1 }} onChange={onChange} />)
    expect(screen.getByRole("button", { name: "오른 무릎, 통증 1/5" })).toBeVisible()
  })

  it("lets a saved level be changed or explicitly cleared without inventing zero-filled parts", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BodyDiagram selected={{ rKnee: 3 }} onChange={onChange} />)
    const rightKnee = screen.getByRole("button", { name: "오른 무릎, 통증 3/5" })

    await user.click(rightKnee)
    expect(screen.getByRole("heading", { name: "내 오른쪽 무릎" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "오른 무릎 통증 5단계" }))
    expect(onChange).toHaveBeenNthCalledWith(1, { rKnee: 5 })
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "입력 완료" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await user.click(rightKnee)
    await user.click(screen.getByRole("button", { name: "오른 무릎 선택 취소" }))
    expect(onChange).toHaveBeenNthCalledWith(2, {})
  })
})
