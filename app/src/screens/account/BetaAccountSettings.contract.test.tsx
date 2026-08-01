import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BetaAccountSettings } from "./BetaAccountSettings"

afterEach(cleanup)

describe("beta account settings", () => {
  it("explains the guardian gate after an under-14 birth date is saved", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText("생년월일"), "2013-08-02")
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2013-08-02",
      analyticsOptIn: false,
    })
    expect(screen.getByText(/보호자 확인 전에는 동기화와 공유를 열지 않아요/u)).toBeVisible()
  })

  it("keeps product analytics optional", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText("생년월일"), "2000-01-01")
    await userEvent.click(screen.getByLabelText("익명 사용 흐름 분석에 참여"))
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ analyticsOptIn: true }))
  })

  it("requires two clicks before requesting server account deletion", async () => {
    const requestDeletion = vi.fn().mockResolvedValue({ ok: true, message: "삭제를 요청했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        onSaveProfile={vi.fn()}
        onRequestDeletion={requestDeletion}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "계정 삭제 요청" }))
    expect(requestDeletion).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "네, 계정 삭제를 요청할게요" }))
    expect(requestDeletion).toHaveBeenCalledWith("athlete-a")
  })
})
