import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { AccountLegalReconsent } from "./AccountLegalReconsent"
import type { AccountConfig } from "../../domain/account/config"
afterEach(cleanup)
const config: AccountConfig = { url: "https://example.com", anonKey: "test", kakaoAuthEnabled: false, googleAuthEnabled: false, emailAuthEnabled: false, phoneAuthEnabled: false, privacyPolicy: { url: "https://example.com/privacy", version: "1" }, termsOfService: { url: "https://example.com/terms", version: "1" } }
it("requires both explicit consents and waits for server success before continuing", async () => {
  const actions = { reacceptAccountTerms: vi.fn().mockResolvedValueOnce({ ok: false, message: "저장 실패" }).mockResolvedValueOnce({ ok: true, message: "저장 완료" }) }
  const onComplete = vi.fn()
  render(<AccountLegalReconsent userId="owner" config={config} actions={actions} onComplete={onComplete} />)
  const submit = screen.getByRole("button", { name: "동의하고 계속하기" })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByLabelText("[필수] 개인정보처리방침에 동의해요"))
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByLabelText("[필수] 이용약관에 동의해요"))
  fireEvent.click(submit)
  await screen.findByText("저장 실패")
  expect(onComplete).not.toHaveBeenCalled()
  fireEvent.click(submit)
  await screen.findByText("저장 완료")
  expect(onComplete).toHaveBeenCalledOnce()
  expect(actions.reacceptAccountTerms).toHaveBeenLastCalledWith("owner", config)
  expect(screen.getByRole("link", { name: "개인정보처리방침 읽기 (새 창)" })).toHaveAttribute("href", config.privacyPolicy.url)
})
