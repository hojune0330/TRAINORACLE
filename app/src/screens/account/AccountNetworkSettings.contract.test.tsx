import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AccountNetworkSettings, AccountSettingsDisclosure } from "./AccountNetworkSettings"
import { BetaAccountSettings } from "./BetaAccountSettings"
import { AccountDataRightsPanel } from "./AccountDataRightsPanel"
import { ProductAnalyticsConsentPanel } from "./ProductAnalyticsConsentPanel"

vi.mock("./StorageConsentPanel", () => ({
  StorageConsentPanel: () => <div data-testid="synthetic-storage-panel" />,
}))

afterEach(cleanup)

function SyntheticStatusPanel({ state }: { readonly state: "busy" | "error" | "status" }) {
  const [draft, setDraft] = useState("초안")
  return (
    <section aria-busy={state === "busy"}>
      <label>합성 초안<input value={draft} onChange={event => setDraft(event.target.value)} /></label>
      {state === "error" && <p role="alert">민감할 수 있는 합성 오류 상세</p>}
      {state === "status" && <p role="status">합성 처리 상태 상세</p>}
    </section>
  )
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(complete => { resolve = complete })
  return { promise, resolve }
}

describe("account network settings feature boundaries", () => {
  it("keeps selected account purpose closed initially and surfaces only semantic status while closed", async () => {
    const view = render(
      <AccountSettingsDisclosure title="내 자료·백업">
        <SyntheticStatusPanel state="busy" />
      </AccountSettingsDisclosure>,
    )
    const summary = screen.getByRole("button", { name: /내 자료·백업/u })

    expect(summary).toHaveAttribute("aria-expanded", "false")
    await waitFor(() => expect(summary).toHaveTextContent("진행 중"))
    await userEvent.click(summary)
    const draft = screen.getByRole("textbox", { name: "합성 초안" })
    await userEvent.clear(draft)
    await userEvent.type(draft, "바꾼 초안")
    await userEvent.click(summary)

    view.rerender(
      <AccountSettingsDisclosure title="내 자료·백업">
        <SyntheticStatusPanel state="error" />
      </AccountSettingsDisclosure>,
    )
    await waitFor(() => expect(summary).toHaveTextContent("확인 필요"))
    expect(summary).not.toHaveTextContent("민감할 수 있는 합성 오류 상세")

    await userEvent.click(summary)
    expect(screen.getByRole("textbox", { name: "합성 초안" })).toHaveValue("바꾼 초안")
    expect(screen.getByRole("alert")).toHaveTextContent("민감할 수 있는 합성 오류 상세")

    view.rerender(
      <AccountSettingsDisclosure title="내 자료·백업">
        <SyntheticStatusPanel state="status" />
      </AccountSettingsDisclosure>,
    )
    await waitFor(() => expect(summary).toHaveTextContent("알림 확인"))
    expect(summary).not.toHaveTextContent("합성 처리 상태 상세")
  })

  it("groups existing account settings by purpose without opening panels by default", () => {
    render(
      <AccountNetworkSettings
        userId="athlete-a"
        today="2026-08-02"
        profileSetupComplete
        legalDocuments={{
          privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-12" },
          termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-12" },
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /프로필·계정/u })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: /내 자료·백업/u })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: /온라인 보관/u })).toHaveAttribute("aria-expanded", "false")
  })

  it("keeps required profile and legal-acknowledgement setup visible before completion", () => {
    render(
      <AccountNetworkSettings
        userId="synthetic-new-account"
        today="2026-08-02"
        legalDocuments={{
          privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-12" },
          termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-12" },
        }}
      />,
    )

    expect(screen.getByLabelText("생년월일")).toBeVisible()
    expect(screen.getByRole("checkbox", { name: /개인정보 처리방침/u })).toBeVisible()
    expect(screen.getByRole("checkbox", { name: /이용약관/u })).toBeVisible()
    expect(screen.queryByRole("button", { name: /프로필·계정/u })).not.toBeInTheDocument()
  })

  it("keeps account requests visible as pending in the parent summary until each finishes", async () => {
    const deletion = deferred<{ readonly ok: boolean; readonly message: string }>()
    const analytics = deferred<{ readonly ok: boolean; readonly optedIn: boolean; readonly message: string }>()
    const exportResult = deferred<{ readonly ok: false; readonly message: string }>()
    render(
      <AccountSettingsDisclosure title="합성 설정">
        <BetaAccountSettings
          userId="synthetic-owner"
          today="2026-10-08"
          dataRightsOnly
          legalDocuments={{
            privacyPolicy: { url: "https://trainoracle.example/privacy", version: "synthetic" },
            termsOfService: { url: "https://trainoracle.example/terms", version: "synthetic" },
          }}
          onRequestDeletion={() => deletion.promise}
        />
        <ProductAnalyticsConsentPanel
          userId="synthetic-owner"
          onLoadConsent={() => analytics.promise}
          onSetConsent={async () => ({ ok: true, message: "합성 처리됨" })}
        />
        <AccountDataRightsPanel userId="synthetic-owner" exportData={() => exportResult.promise} />
      </AccountSettingsDisclosure>,
    )
    const summary = screen.getByRole("button", { name: /합성 설정/u })

    await waitFor(() => expect(summary).toHaveTextContent("진행 중"))
    await userEvent.click(summary)
    await userEvent.click(screen.getByRole("button", { name: "계정 삭제 요청" }))
    await userEvent.click(screen.getByRole("button", { name: "네, 계정 삭제를 요청할게요" }))
    await userEvent.click(screen.getByRole("button", { name: "선택한 자료 내려받기" }))

    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(3)
    await userEvent.click(summary)
    await waitFor(() => expect(summary).toHaveTextContent("진행 중"))

    deletion.resolve({ ok: false, message: "합성 요청 실패" })
    exportResult.resolve({ ok: false, message: "합성 내려받기 실패" })
    analytics.resolve({ ok: true, optedIn: false, message: "합성 설정 읽음" })
    await waitFor(() => expect(summary).toHaveTextContent("알림 확인"))
    expect(summary).not.toHaveTextContent(/합성 .* 실패/u)
  })

  it("keeps product analytics consent hidden while its feature flag is off", () => {
    render(
      <AccountNetworkSettings
        userId="athlete-a"
        today="2026-08-02"
        legalDocuments={{
          privacyPolicy: { url: "https://trainoracle.example/privacy", version: "2026-08-12" },
          termsOfService: { url: "https://trainoracle.example/terms", version: "2026-08-12" },
        }}
      />,
    )

    expect(screen.queryByRole("checkbox", { name: "선택 사용 흐름 분석 허용" })).not.toBeInTheDocument()
    expect(screen.queryByText(/사용 흐름 분석/u)).not.toBeInTheDocument()
  })
})
