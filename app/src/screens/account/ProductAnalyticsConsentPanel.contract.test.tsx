import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProductAnalyticsConsentPanel } from "./ProductAnalyticsConsentPanel"

afterEach(cleanup)

describe("product analytics consent panel", () => {
  it("explains the account-linked 30-day boundary and saves consent separately", async () => {
    const loadConsent = vi.fn().mockResolvedValue({ ok: true, optedIn: false, message: "설정을 불러왔어요." })
    const setConsent = vi.fn().mockResolvedValue({ ok: true, message: "분석 참여를 켰어요." })
    render(
      <ProductAnalyticsConsentPanel
        userId="athlete-a"
        onLoadConsent={loadConsent}
        onSetConsent={setConsent}
      />,
    )

    await waitFor(() => expect(loadConsent).toHaveBeenCalledWith("athlete-a"))
    expect(screen.getByText(/어떤 화면을 열고 저장이 성공했는지/u)).toBeVisible()
    expect(screen.getByText(/30일 뒤 자동으로 삭제/u)).toBeVisible()
    expect(screen.getByText(/메모 원문, 통증값, 기분값, 훈련 내용/u)).toBeVisible()
    expect(screen.getByText(/거절해도 기본 기능/u)).toBeVisible()
    expect(screen.queryByText(/익명/u)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("checkbox", { name: "앱 사용 정보 보내기 허용" }))
    await userEvent.click(screen.getByRole("button", { name: "분석 설정 저장" }))

    expect(setConsent).toHaveBeenCalledWith("athlete-a", true)
  })

  it("makes withdrawal explicit and removes previously collected events", async () => {
    const setConsent = vi.fn().mockResolvedValue({ ok: true, message: "분석 참여를 껐어요." })
    render(
      <ProductAnalyticsConsentPanel
        userId="athlete-a"
        onLoadConsent={vi.fn().mockResolvedValue({ ok: true, optedIn: true, message: "설정을 불러왔어요." })}
        onSetConsent={setConsent}
      />,
    )

    const checkbox = await screen.findByRole("checkbox", { name: "앱 사용 정보 보내기 허용" })
    expect(checkbox).toBeChecked()
    await userEvent.click(checkbox)
    expect(screen.getByText(/전에 모인 기록도 삭제/u)).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "분석 설정 저장" }))

    expect(setConsent).toHaveBeenCalledWith("athlete-a", false)
  })
})
