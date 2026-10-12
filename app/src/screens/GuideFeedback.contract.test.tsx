import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { Guide } from "./Guide"

afterEach(cleanup)

describe("guide feedback entry", () => {
  it("keeps feedback inside TrainOracle and groups help by purpose", async () => {
    const user = userEvent.setup()
    render(<Guide initialSection="guide" feedbackAvailable />)

    expect(screen.getByRole("group", { name: "도움말 종류" })).toBeVisible()
    expect(screen.getByRole("button", { name: "훈련 용어" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("searchbox", { name: "용어 검색" })).toBeVisible()
    expect(screen.queryByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "앱 이용 안내" }))
    expect(screen.queryByRole("searchbox", { name: "용어 검색" })).toBeNull()
    expect(screen.getByRole("heading", { level: 1, name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
    const question = screen.getByText("아직 준비 중인 기능은 무엇인가요?")
    await user.click(question)
    const openQuestion = question.closest("details")
    expect(openQuestion).toHaveAttribute("open")
    await user.click(screen.getByRole("button", { name: "훈련 용어" }))
    expect(screen.queryByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "앱 이용 안내" }))
    expect(openQuestion).toHaveAttribute("open")

    const link = screen.getByRole("link", { name: "문의 게시판 열기" })
    expect(link).toHaveAttribute("href", "?feedback=1")
    expect(screen.queryByText(/GitHub Issues/u)).toBeNull()
  })

  it("uses one configured availability message in the FAQ and Guide footer", async () => {
    const user = userEvent.setup()
    render(<Guide initialSection="guide" feedbackAvailable />)

    await user.click(screen.getByRole("button", { name: "앱 이용 안내" }))
    await user.click(screen.getByText("아직 준비 중인 기능은 무엇인가요?"))

    const footer = within(screen.getByRole("region", { name: "불편한 점이 있었나요?" }))
    expect(footer.getByText(/문의 게시판에 의견을 남겨 주세요./u)).toBeVisible()
    expect(footer.getByText(/알려주신 내용만 보내며, 일지 내용은 자동으로 보내지 않아요./u)).toBeVisible()
    expect(screen.getAllByText(/문의 게시판에 의견을 남겨 주세요./u)).toHaveLength(2)
    expect(screen.queryByText(/문의 게시판은 지금 사용할 수 있어요/u)).toBeNull()
  })

  it("uses one unconfigured availability message in the FAQ and Guide footer", async () => {
    const user = userEvent.setup()
    render(<Guide initialSection="guide" feedbackAvailable={false} />)

    await user.click(screen.getByRole("button", { name: "앱 이용 안내" }))
    await user.click(screen.getByText("아직 준비 중인 기능은 무엇인가요?"))

    const footer = within(screen.getByRole("region", { name: "불편한 점이 있었나요?" }))
    expect(footer.getByText("문의 게시판은 지금 준비 중이에요. 열리면 앱 안에서 알려드릴게요.")).toBeVisible()
    expect(footer.getByRole("link", { name: "문의 게시판 상태 보기" })).toHaveAttribute("href", "?feedback=1")
    expect(screen.getAllByText(/문의 게시판은 지금 준비 중이에요. 열리면 앱 안에서 알려드릴게요./u)).toHaveLength(2)
    expect(screen.queryByText(/문의 게시판은 지금 사용할 수 있어요/u)).toBeNull()
  })

  it("keeps the direct Minji journal path separate from the help-purpose chooser", () => {
    render(<Guide initialSection="minji" />)

    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
    expect(screen.queryByRole("group", { name: "도움말 종류" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "훈련 용어집" })).toBeNull()
  })

  it("lets a reader open and close Minji's diary pages in plain language", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: /2개월.*5시간 잔 다음 날, RPE 8/u }))

    expect(screen.getByRole("heading", { name: "5시간 잔 다음 날, RPE 8" })).toBeVisible()
    expect(screen.getByText(/잠 때문이라고 확정할 수는 없어요/u)).toBeVisible()
    expect(screen.queryByText(/상관관계/u)).toBeNull()

    await user.click(screen.getByRole("button", { name: "민지의 일지 닫기" }))
    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
  })

  it("closes an open Minji page with Escape", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    await user.click(screen.getByRole("button", { name: /2개월.*5시간 잔 다음 날, RPE 8/u }))
    fireEvent.keyDown(window, { key: "Escape" })

    expect(screen.getByRole("heading", { name: "민지의 일지" })).toBeVisible()
  })

  it("explains training notation without presenting it as a recommendation", async () => {
    const user = userEvent.setup()
    render(<Guide />)

    await user.click(screen.getByRole("button", { name: /10개월.*같은 1000m 반복, RPE 9에서 6/u }))
    expect(screen.getByText("민지의 가상 예시이며 따라 하는 훈련계획이 아니에요.")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "훈련 표시 쉽게 보기" }))

    expect(screen.getByText("1000m를 여섯 번 뛰는 예시예요.")).toBeVisible()
    expect(screen.getByText("민지의 가상 기록이며 따라 하라는 계획이 아니에요.")).toBeVisible()
  })
})
