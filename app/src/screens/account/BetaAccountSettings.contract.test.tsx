import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BetaAccountSettings } from "./BetaAccountSettings"

afterEach(cleanup)

const legalDocuments = {
  privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-12" },
  termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-12" },
}

describe("beta account settings", () => {
  it("explains the guardian gate after an under-14 birth date is saved", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        legalDocuments={legalDocuments}
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText("생년월일"), "2013-08-02")
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/u }))
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2013-08-02",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })
    expect(screen.getByText(/보호자 확인 전에는 계정 동기화와 일지 데이터 공유를 열지 않아요/u)).toBeVisible()
  })

  it("does not bundle product analytics consent into private profile saving", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        legalDocuments={legalDocuments}
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText("생년월일"), "2000-01-01")
    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/u }))
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })
    expect(screen.queryByText(/사용 흐름 분석/u)).not.toBeInTheDocument()
  })

  it("requires two clicks before requesting server account deletion", async () => {
    const requestDeletion = vi.fn().mockResolvedValue({ ok: true, message: "삭제를 요청했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        legalDocuments={legalDocuments}
        onSaveProfile={vi.fn()}
        onRequestDeletion={requestDeletion}
      />,
    )

    await userEvent.click(screen.getByRole("button", { name: "계정 삭제 요청" }))
    expect(requestDeletion).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "네, 계정 삭제를 요청할게요" }))
    expect(requestDeletion).toHaveBeenCalledWith("athlete-a")
  })

  it("requires a checked privacy and terms acknowledgement before profile data can be saved", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        legalDocuments={legalDocuments}
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", legalDocuments.privacyPolicy.url)
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", legalDocuments.termsOfService.url)

    await userEvent.type(screen.getByLabelText("생년월일"), "2000-01-01")
    expect(screen.getByRole("button", { name: "계정 정보 저장" })).toBeDisabled()

    await userEvent.click(screen.getByRole("checkbox", { name: /개인정보 처리방침/u }))
    await userEvent.click(screen.getByRole("checkbox", { name: /이용약관/u }))
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })
  })

  it("uses an acknowledgement already made during the same sign-up flow", async () => {
    const saveProfile = vi.fn().mockResolvedValue({ ok: true, message: "저장했어요." })
    render(
      <BetaAccountSettings
        userId="athlete-a"
        today="2026-08-01"
        legalDocuments={legalDocuments}
        initialPrivacyAcknowledged
        initialTermsAcknowledged
        onSaveProfile={saveProfile}
        onRequestDeletion={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText("생년월일"), "2000-01-01")
    expect(screen.getByRole("button", { name: "계정 정보 저장" })).toBeEnabled()
    await userEvent.click(screen.getByRole("button", { name: "계정 정보 저장" }))

    expect(saveProfile).toHaveBeenCalledWith({
      userId: "athlete-a",
      birthDate: "2000-01-01",
      privacyPolicyVersion: "2026-08-12",
      termsOfServiceVersion: "2026-08-12",
    })
  })
})
