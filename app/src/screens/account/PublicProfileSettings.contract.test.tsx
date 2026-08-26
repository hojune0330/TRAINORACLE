import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../../domain/plan-beta-store", () => ({
  loadPlanBetaState: () => null,
}))

vi.mock("../../domain/account/public-profile", async importOriginal => {
  const original = await importOriginal<typeof import("../../domain/account/public-profile")>()
  return {
    ...original,
    loadOwnPublicProfile: () => Promise.resolve(null),
    savePublicProfile: () => Promise.resolve({ ok: true, message: "saved" }),
    publishActivePlanCard: () => Promise.resolve({ ok: true, message: "shared" }),
  }
})

import { PublicProfileSettings } from "./PublicProfileSettings"

afterEach(cleanup)

describe("public profile settings boundaries", () => {
  it("uses explicit visibility and an allowlisted introduction instead of a free-form biography", () => {
    render(<PublicProfileSettings userId="00000000-0000-4000-8000-000000000001" />)

    expect(screen.getByRole("checkbox", { name: /다른 사람이 내 프로필을 볼 수 있게 하기/u })).not.toBeChecked()
    expect(screen.getByRole("combobox", { name: "프로필 소개" })).toHaveValue("TRAINING_CONSISTENTLY")
    expect(screen.queryByRole("textbox", { name: /소개/u })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "현재 훈련 계획 요약 공유" })).toBeDisabled()
    expect(screen.getByText(/상세 훈련 처방은 공개하지 않고/u)).toBeInTheDocument()
  })
})
