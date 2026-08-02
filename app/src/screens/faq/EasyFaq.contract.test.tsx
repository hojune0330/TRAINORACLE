import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { EasyFaq } from "./EasyFaq"

afterEach(cleanup)

describe("easy FAQ", () => {
  it("explains the free beta and possible future paid or ad-supported choices", async () => {
    render(<EasyFaq />)

    expect(screen.getByRole("heading", { name: "궁금한 점을 쉽게 풀어드려요" })).toBeVisible()
    expect(screen.getByText("지금 무료인가요?")).toBeVisible()
    expect(screen.getByText("나중에 월 구독이나 광고가 생길 수 있나요?")).toBeVisible()
    await userEvent.click(screen.getByText("나중에 월 구독이나 광고가 생길 수 있나요?"))
    expect(screen.getByText(/월 구독이나 광고가 포함된 선택 상품/u)).toBeVisible()
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
})
