import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { EasyFaq } from "./EasyFaq"

afterEach(cleanup)

describe("easy FAQ", () => {
  it("shows the approved beta pricing notice before a reader opens a question", () => {
    render(<EasyFaq />)

    expect(screen.getByTestId("beta-price-notice")).toHaveTextContent(
      "TrainOracle 베타는 현재 무료입니다. 서비스 운영을 위해 나중에 월 구독이나 광고가 포함된 선택 상품이 생길 수 있습니다. 가격이나 무료 기능이 바뀌기 전에는 앱에서 먼저 알려드립니다.",
    )
  })

  it("keeps the easy FAQ separate from the formal privacy and terms documents", () => {
    render(<EasyFaq />)

    expect(screen.getByText(/개인정보 처리방침이나 이용 약관을 대신하지 않아요/u)).toBeVisible()
  })

  it("explains the free beta and possible future paid or ad-supported choices", async () => {
    render(<EasyFaq />)

    expect(screen.getByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
    expect(screen.getByText("지금 무료인가요?")).toBeVisible()
    expect(screen.getByText("나중에 월 구독이나 광고가 생길 수 있나요?")).toBeVisible()
    await userEvent.click(screen.getByText("나중에 월 구독이나 광고가 생길 수 있나요?"))
    expect(screen.getByText(/무료 베타예요/u)).toBeVisible()
  })

  it("uses user roles instead of exposing an Owner role", () => {
    render(<EasyFaq />)

    expect(screen.getByText("코치는 실제 자격을 확인한 사람인가요?")).toBeVisible()
    expect(screen.getByText(/자격 미확인/u)).toBeInTheDocument()
    expect(screen.queryByText(/Owner/u)).not.toBeInTheDocument()
  })

  it("states private memo and guardian boundaries in plain Korean", () => {
    render(<EasyFaq />)

    expect(screen.getByText("나만의 메모는 서비스 운영자도 볼 수 없나요?")).toBeVisible()
    expect(screen.getByText(/복구 코드를 가진 사용자만/u)).toBeInTheDocument()
    expect(screen.getByText("만 14세 미만은 왜 보호자 확인이 필요한가요?")).toBeVisible()
  })

  it("explains the first 200 free beta places while account features stay closed", async () => {
    const user = userEvent.setup()
    render(<EasyFaq />)

    await user.click(screen.getByText("지금 무료인가요?"))
    expect(screen.getByText(/첫 200명에게 열리는 무료 베타/u)).toBeVisible()
    expect(screen.getByText(/지금은 로그인 없이 이 기기에서 일지를 쓸 수 있어요/u)).toBeVisible()
  })

  it("describes account, coach sharing, and plan features as closed when they are closed", async () => {
    const user = userEvent.setup()
    render(<EasyFaq />)

    await user.click(screen.getByText("코치는 무엇을 볼 수 있나요?"))
    expect(screen.getAllByText(/코치 연결은 아직 열지 않았어요/u)).toHaveLength(2)
    await user.click(screen.getByText("훈련계획은 자동으로 바뀌나요?"))
    expect(screen.getByText(/자동으로 계획을 바꾸는 기능은 열지 않았어요/u)).toBeVisible()
    await user.click(screen.getByText("계정을 삭제하면 데이터도 없어지나요?"))
    expect(screen.getByText(/현재는 계정을 사용하지 않아요/u)).toBeVisible()
    expect(screen.getByText(/정식 문서는.*기능을 열기 전에/u)).toBeVisible()
  })

  it("explains that a problem closes only the affected feature", async () => {
    // Given
    const user = userEvent.setup()
    render(<EasyFaq />)

    // When
    await user.click(screen.getByText("문제가 생기면 앱 전체가 멈추나요?"))

    // Then
    expect(screen.getByText(/문제가 난 기능만 잠시 닫고/u)).toBeVisible()
    expect(screen.getByText(/이 기기에서 쓴 일지는 그대로 남아요/u)).toBeVisible()
  })
})
